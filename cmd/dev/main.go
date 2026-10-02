// Local development server: go run ./cmd/dev
//
// Reads variables from a .env file at the repository root if present
// (DATABASE_URL, APP_PASSWORD…); variables already set in the shell win.
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/lailacha/alphabet-date/pkg/server"
)

func main() {
	server.LoadDotEnv(".env")
	if os.Getenv("DATABASE_URL") == "" && os.Getenv("POSTGRES_URL") == "" {
		log.Fatal("DATABASE_URL manquant : copie .env.example en .env et remplis-le")
	}

	addr := ":8080"
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}
	log.Printf("API listening on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, logRequests(server.NewHandler())))
}

// logRequests prints every API call with its status, so errors show up in
// the terminal.
func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		rec := &statusRecorder{ResponseWriter: w, status: 200}
		next.ServeHTTP(rec, r)
		log.Printf("%d %s %s", rec.status, r.Method, r.URL.Path)
	})
}

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}
