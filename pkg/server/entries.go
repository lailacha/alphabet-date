package server

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const maxPhotoBytes = 4 << 20 // Vercel functions accept bodies up to 4.5 MB

// Entry is one date: a letter can have several.
type Entry struct {
	ID        int64      `json:"id"`
	Letter    string     `json:"letter"`
	Idea      string     `json:"idea"`
	Place     string     `json:"place"`
	Notes     string     `json:"notes"`
	Done      bool       `json:"done"`
	DoneOn    *string    `json:"doneOn"` // optional: when it was done
	Featured  bool       `json:"featured"`
	Photos    [2]*string `json:"photos"` // versioned URLs for slot 1 and 2, nil if empty
	CreatedAt time.Time  `json:"createdAt"`
}

type entryInput struct {
	Letter string  `json:"letter"`
	Idea   string  `json:"idea"`
	Place  string  `json:"place"`
	Notes  string  `json:"notes"`
	Done   *bool   `json:"done"` // omitted by old clients: derived from doneOn
	DoneOn *string `json:"doneOn"`
}

// isDone: a date with a done day is always done.
func (in entryInput) isDone(doneOn *time.Time) bool {
	return doneOn != nil || (in.Done != nil && *in.Done)
}

// decodeEntry reads and validates the request body. The letter is only
// required when creating.
func decodeEntry(w http.ResponseWriter, r *http.Request, needLetter bool) (in entryInput, doneOn *time.Time, ok bool) {
	if err := json.NewDecoder(io.LimitReader(r.Body, 64<<10)).Decode(&in); err != nil {
		writeErr(w, http.StatusBadRequest, "requête invalide")
		return in, nil, false
	}
	in.Letter = strings.ToUpper(strings.TrimSpace(in.Letter))
	if needLetter && (len(in.Letter) != 1 || !strings.Contains(Letters, in.Letter)) {
		writeErr(w, http.StatusBadRequest, "lettre invalide")
		return in, nil, false
	}
	in.Idea = strings.TrimSpace(in.Idea)
	in.Place = strings.TrimSpace(in.Place)
	in.Notes = strings.TrimSpace(in.Notes)
	if in.DoneOn != nil && *in.DoneOn != "" {
		t, err := time.Parse("2006-01-02", *in.DoneOn)
		if err != nil {
			writeErr(w, http.StatusBadRequest, "date invalide (AAAA-MM-JJ)")
			return in, nil, false
		}
		doneOn = &t
	}
	return in, doneOn, true
}

func handleListEntries(w http.ResponseWriter, r *http.Request) {
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	rows, err := db.Query(r.Context(), `
		SELECT e.id, e.letter, e.idea, e.place, e.notes, e.done, to_char(e.done_on, 'YYYY-MM-DD'), e.featured, e.created_at,
		       (SELECT (extract(epoch FROM p.updated_at) * 1000)::bigint FROM entry_photos p WHERE p.entry_id = e.id AND p.slot = 1),
		       (SELECT (extract(epoch FROM p.updated_at) * 1000)::bigint FROM entry_photos p WHERE p.entry_id = e.id AND p.slot = 2)
		FROM entries e
		ORDER BY e.letter, e.featured DESC, e.done DESC, e.done_on NULLS LAST, e.created_at`)
	if err != nil {
		serverErr(w, err)
		return
	}
	defer rows.Close()

	out := []Entry{}
	for rows.Next() {
		var e Entry
		var v1, v2 *int64
		if err := rows.Scan(&e.ID, &e.Letter, &e.Idea, &e.Place, &e.Notes, &e.Done, &e.DoneOn, &e.Featured, &e.CreatedAt, &v1, &v2); err != nil {
			serverErr(w, err)
			return
		}
		e.Photos[0] = photoURL(e.ID, 1, v1)
		e.Photos[1] = photoURL(e.ID, 2, v2)
		out = append(out, e)
	}
	if err := rows.Err(); err != nil {
		serverErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func photoURL(id int64, slot int, version *int64) *string {
	if version == nil {
		return nil
	}
	u := fmt.Sprintf("/api/photos/%d/%d?v=%d", id, slot, *version)
	return &u
}

func handleCreateEntry(w http.ResponseWriter, r *http.Request) {
	in, doneOn, ok := decodeEntry(w, r, true)
	if !ok {
		return
	}
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	var id int64
	err = db.QueryRow(r.Context(),
		`INSERT INTO entries (letter, idea, place, notes, done, done_on) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
		in.Letter, in.Idea, in.Place, in.Notes, in.isDone(doneOn), doneOn).Scan(&id)
	if err != nil {
		serverErr(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]int64{"id": id})
}

func handleUpdateEntry(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	in, doneOn, ok := decodeEntry(w, r, false)
	if !ok {
		return
	}
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	tag, err := db.Exec(r.Context(),
		`UPDATE entries SET idea = $2, place = $3, notes = $4, done = $5, done_on = $6, updated_at = now() WHERE id = $1`,
		id, in.Idea, in.Place, in.Notes, in.isDone(doneOn), doneOn)
	if err != nil {
		serverErr(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, http.StatusNotFound, "date introuvable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// handleFeatureEntry makes this date the one shown for its letter (and
// un-features the others of the same letter); DELETE removes the highlight.
func handleFeatureEntry(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	query := `UPDATE entries SET featured = (id = $1)
		WHERE letter = (SELECT letter FROM entries WHERE id = $1)`
	if r.Method == http.MethodDelete {
		query = `UPDATE entries SET featured = false WHERE id = $1`
	}
	tag, err := db.Exec(r.Context(), query, id)
	if err != nil {
		serverErr(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, http.StatusNotFound, "date introuvable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func handleDeleteEntry(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}
	db, err := DB(r.Context())
	if err != nil {
		serverErr(w, err)
		return
	}
	if _, err := db.Exec(r.Context(), `DELETE FROM entries WHERE id = $1`, id); err != nil {
		serverErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func handlePutPhoto(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
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
	tag, err := db.Exec(r.Context(), `
		INSERT INTO entry_photos (entry_id, slot, mime, data, updated_at)
		SELECT id, $2, $3, $4, now() FROM entries WHERE id = $1
		ON CONFLICT (entry_id, slot) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, updated_at = now()`,
		id, slot, mime, data)
	if err != nil {
		serverErr(w, err)
		return
	}
	if tag.RowsAffected() == 0 {
		writeErr(w, http.StatusNotFound, "date introuvable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func handleDeletePhoto(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
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
	if _, err := db.Exec(r.Context(), `DELETE FROM entry_photos WHERE entry_id = $1 AND slot = $2`, id, slot); err != nil {
		serverErr(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func handleGetPhoto(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
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
	err = db.QueryRow(r.Context(), `SELECT mime, data FROM entry_photos WHERE entry_id = $1 AND slot = $2`, id, slot).Scan(&mime, &data)
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
