package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const maxPhotoBytes = 4 << 20 // Vercel functions accept bodies up to 4.5 MB

type DateEntry struct {
	Letter    string     `json:"letter"`
	Idea      string     `json:"idea"`
	Place     string     `json:"place"`
	Notes     string     `json:"notes"`
	DoneOn    *string    `json:"doneOn"`
	Photos    [2]*string `json:"photos"` // versioned URLs for slot 1 and 2, nil if empty
	UpdatedAt time.Time  `json:"updatedAt"`
}

type Settings struct {
	Person1 string `json:"person1"`
	Person2 string `json:"person2"`
}

// NewHandler returns the full API router. Paths are all under /api.
func NewHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	mux.HandleFunc("GET /api/me", handleMe)
	mux.HandleFunc("POST /api/login", handleLogin)
	mux.HandleFunc("POST /api/logout", handleLogout)

	mux.Handle("GET /api/dates", protected(handleListDates))
	mux.Handle("PUT /api/dates/{letter}", protected(handleUpdateDate))
	mux.Handle("PUT /api/dates/{letter}/photos/{slot}", protected(handlePutPhoto))
	mux.Handle("DELETE /api/dates/{letter}/photos/{slot}", protected(handleDeletePhoto))
	mux.Handle("GET /api/photos/{letter}/{slot}", protected(handleGetPhoto))
	mux.Handle("GET /api/settings", protected(handleGetSettings))
	mux.Handle("PUT /api/settings", protected(handlePutSettings))

	return withVercelPath(mux)
}

// withVercelPath restores the original path when the request reaches the
// function through the vercel.json rewrite (`/api/index?__path=...`).
func withVercelPath(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if p := q.Get("__path"); p != "" {
			r.URL.Path = "/api/" + strings.TrimPrefix(p, "/")
			r.URL.RawPath = ""
			q.Del("__path")
			r.URL.RawQuery = q.Encode()
		}
		next.ServeHTTP(w, r)
	})
}

func protected(h http.HandlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !authenticated(r) {
			writeErr(w, http.StatusUnauthorized, "non connectée")
			return
		}
		h(w, r)
	})
}

func handleMe(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]bool{
		"authenticated":    authenticated(r),
		"passwordRequired": password() != "",
	})
}

func handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Password string `json:"password"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "requête invalide")
		return
	}
	if password() != "" && !checkPassword(body.Password) {
		writeErr(w, http.StatusUnauthorized, "mot de passe incorrect")
		return
	}
	setSession(w, r, sessionToken(), 365*24*3600)
	writeJSON(w, http.StatusOK, map[string]bool{"authenticated": true})
}

func handleLogout(w http.ResponseWriter, r *http.Request) {
	setSession(w, r, "", -1)
	w.WriteHeader(http.StatusNoContent)
}

func handleListDates(w http.ResponseWriter, r *http.Request) {
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	rows, err := db.Query(r.Context(), `
		SELECT d.letter, d.idea, d.place, d.notes, to_char(d.done_on, 'YYYY-MM-DD'), d.updated_at,
		       (SELECT (extract(epoch FROM p.updated_at) * 1000)::bigint FROM photos p WHERE p.letter = d.letter AND p.slot = 1),
		       (SELECT (extract(epoch FROM p.updated_at) * 1000)::bigint FROM photos p WHERE p.letter = d.letter AND p.slot = 2)
		FROM dates d ORDER BY d.letter`)
	if err != nil {
		serverErr(w, err)
		return
	}
	defer rows.Close()

	out := []DateEntry{}
	for rows.Next() {
		var e DateEntry
		var v1, v2 *int64
		if err := rows.Scan(&e.Letter, &e.Idea, &e.Place, &e.Notes, &e.DoneOn, &e.UpdatedAt, &v1, &v2); err != nil {
			serverErr(w, err)
			return
		}
		e.Photos[0] = photoURL(e.Letter, 1, v1)
		e.Photos[1] = photoURL(e.Letter, 2, v2)
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		serverErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func photoURL(letter string, slot int, version *int64) *string {
	if version == nil {
		return nil
	}
	u := fmt.Sprintf("/api/photos/%s/%d?v=%d", letter, slot, *version)
	return &u
}

func handleUpdateDate(w http.ResponseWriter, r *http.Request) {
	letter, ok := parseLetter(w, r)
	if !ok {
		return
	}
	var body struct {
		Idea   string  `json:"idea"`
		Place  string  `json:"place"`
		Notes  string  `json:"notes"`
		DoneOn *string `json:"doneOn"`
	}
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&body); err != nil {
		writeErr(w, http.StatusBadRequest, "requête invalide")
		return
	}
	var doneOn *time.Time
	if body.DoneOn != nil && *body.DoneOn != "" {
		t, err := time.Parse("2006-01-02", *body.DoneOn)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "date invalide (AAAA-MM-JJ)")
			return
		}
		doneOn = &t
	}
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	_, err = db.Exec(r.Context(),
		`UPDATE dates SET idea = $2, place = $3, notes = $4, done_on = $5, updated_at = now() WHERE letter = $1`,
		letter, strings.TrimSpace(body.Idea), strings.TrimSpace(body.Place), strings.TrimSpace(body.Notes), doneOn)
	if err != nil {
		serverErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func handlePutPhoto(w http.ResponseWriter, r *http.Request) {
	letter, ok := parseLetter(w, r)
	if !ok {
		return
	}
	slot, ok := parseSlot(w, r)
	if !ok {
		return
	}
	data, err := io.ReadAll(io.LimitReader(r.Body, maxPhotoBytes+1))
	if err != nil {
		writeErr(w, http.StatusBadRequest, "lecture impossible")
		return
	}
	if len(data) > maxPhotoBytes {
		writeErr(w, http.StatusRequestEntityTooLarge, "photo trop lourde (4 Mo max)")
		return
	}
	mime := http.DetectContentType(data)
	if !strings.HasPrefix(mime, "image/") {
		writeErr(w, http.StatusUnsupportedMediaType, "ce fichier n'est pas une image")
		return
	}
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	_, err = db.Exec(r.Context(), `
		INSERT INTO photos (letter, slot, mime, data, updated_at) VALUES ($1, $2, $3, $4, now())
		ON CONFLICT (letter, slot) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, updated_at = now()`,
		letter, slot, mime, data)
	if err != nil {
		serverErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func handleDeletePhoto(w http.ResponseWriter, r *http.Request) {
	letter, ok := parseLetter(w, r)
	if !ok {
		return
	}
	slot, ok := parseSlot(w, r)
	if !ok {
		return
	}
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	if _, err := db.Exec(r.Context(), `DELETE FROM photos WHERE letter = $1 AND slot = $2`, letter, slot); err != nil {
		serverErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func handleGetPhoto(w http.ResponseWriter, r *http.Request) {
	letter, ok := parseLetter(w, r)
	if !ok {
		return
	}
	slot, ok := parseSlot(w, r)
	if !ok {
		return
	}
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	var mime string
	var data []byte
	err = db.QueryRow(r.Context(), `SELECT mime, data FROM photos WHERE letter = $1 AND slot = $2`, letter, slot).Scan(&mime, &data)
	if errors.Is(err, pgx.ErrNoRows) {
		writeErr(w, http.StatusNotFound, "pas de photo")
		return
	}
	if err != nil {
		serverErr(w, err)
		return
	}
	w.Header().Set("Content-Type", mime)
	w.Header().Set("Content-Length", strconv.Itoa(len(data)))
	// URLs carry a ?v= version, so the browser may keep them forever.
	w.Header().Set("Cache-Control", "private, max-age=31536000, immutable")
	w.Write(data)
}

func handleGetSettings(w http.ResponseWriter, r *http.Request) {
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	s := Settings{Person1: "Moi", Person2: "Elle"}
	rows, err := db.Query(r.Context(), `SELECT key, value FROM settings`)
	if err != nil {
		serverErr(w, err)
		return
	}
	defer rows.Close()
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			serverErr(w, err)
			return
		}
		switch k {
		case "person1":
			s.Person1 = v
		case "person2":
			s.Person2 = v
		}
	}
	writeJSON(w, http.StatusOK, s)
}

func handlePutSettings(w http.ResponseWriter, r *http.Request) {
	var s Settings
	if err := json.NewDecoder(io.LimitReader(r.Body, 4096)).Decode(&s); err != nil {
		writeErr(w, http.StatusBadRequest, "requête invalide")
		return
	}
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	for k, v := range map[string]string{"person1": s.Person1, "person2": s.Person2} {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		if _, err := db.Exec(r.Context(),
			`INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`, k, v); err != nil {
			serverErr(w, err)
			return
		}
	}
	w.WriteHeader(http.StatusNoContent)
}

func parseLetter(w http.ResponseWriter, r *http.Request) (string, bool) {
	l := strings.ToUpper(r.PathValue("letter"))
	if len(l) != 1 || !strings.Contains(Letters, l) {
		writeErr(w, http.StatusBadRequest, "lettre invalide")
		return "", false
	}
	return l, true
}

func parseSlot(w http.ResponseWriter, r *http.Request) (int, bool) {
	s, err := strconv.Atoi(r.PathValue("slot"))
	if err != nil || (s != 1 && s != 2) {
		writeErr(w, http.StatusBadRequest, "photo invalide (1 ou 2)")
		return 0, false
	}
	return s, true
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeErr(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func serverErr(w http.ResponseWriter, err error) {
	log.Printf("error: %v", err)
	writeErr(w, http.StatusInternalServerError, "erreur serveur")
}
