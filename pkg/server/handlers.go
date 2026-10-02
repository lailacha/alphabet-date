package server

import (
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"strings"
)

type Settings struct {
	Person1 string `json:"person1"`
	Person2 string `json:"person2"`
}

// NewHandler returns the full API router. Paths are all under /api.
func NewHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		db := "ok"
		if _, err := DB(r.Context()); err != nil {
			log.Printf("health: %v", err)
			db = "ko"
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "db": db})
	})
	mux.HandleFunc("GET /api/me", handleMe)
	mux.HandleFunc("POST /api/login", handleLogin)
	mux.HandleFunc("POST /api/logout", handleLogout)

	mux.Handle("GET /api/entries", protected(handleListEntries))
	// Old name, still used by app versions cached on phones before the switch
	// to several dates per letter.
	mux.Handle("GET /api/dates", protected(handleListEntries))
	mux.Handle("POST /api/entries", protected(handleCreateEntry))
	mux.Handle("PUT /api/entries/{id}", protected(handleUpdateEntry))
	mux.Handle("DELETE /api/entries/{id}", protected(handleDeleteEntry))
	mux.Handle("PUT /api/entries/{id}/photos/{slot}", protected(handlePutPhoto))
	mux.Handle("DELETE /api/entries/{id}/photos/{slot}", protected(handleDeletePhoto))
	mux.Handle("GET /api/photos/{id}/{slot}", protected(handleGetPhoto))
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

func handleGetSettings(w http.ResponseWriter, r *http.Request) {
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	s := Settings{Person1: "Anaïs", Person2: "Laïla"}
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

func parseID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeErr(w, http.StatusBadRequest, "date invalide")
		return 0, false
	}
	return id, true
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

// serverErr is only used behind protected(), so the detail is shown to the
// two logged-in users only; it makes setup problems (DB URL, network…)
// diagnosable without digging through Vercel logs.
func serverErr(w http.ResponseWriter, err error) {
	log.Printf("error: %v", err)
	writeJSON(w, http.StatusInternalServerError, map[string]string{
		"error":  "erreur serveur",
		"detail": err.Error(),
	})
}
