// Package handler is the Vercel serverless entrypoint: every /api/* request is
// rewritten to this function (see vercel.json).
package handler

import (
	"net/http"

	"github.com/lailacha/alphabet-date/pkg/server"
)

var app = server.NewHandler()

func Handler(w http.ResponseWriter, r *http.Request) {
	app.ServeHTTP(w, r)
}
