// Local development server: go run ./cmd/dev
package main

import (
	"log"
	"net/http"
	"os"

	"github.com/lailacha/alphabet-date/pkg/server"
)

func main() {
	addr := ":8080"
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}
	log.Printf("API listening on http://localhost%s", addr)
	log.Fatal(http.ListenAndServe(addr, server.NewHandler()))
}
