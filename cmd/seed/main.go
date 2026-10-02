// Re-imports our date list (pkg/server/alphabet.md) into the database from
// .env: go run ./cmd/seed
//
// The server already does it once on its own; use this after editing the
// list. Safe to run several times: existing ideas are not duplicated.
package main

import (
	"context"
	"fmt"
	"log"

	"github.com/lailacha/alphabet-date/pkg/server"
)

func main() {
	server.LoadDotEnv(".env")
	ctx := context.Background()
	db, err := server.DB(ctx)
	if err != nil {
		log.Fatal(err)
	}
	tx, err := db.Begin(ctx)
	if err != nil {
		log.Fatal(err)
	}
	defer tx.Rollback(ctx)
	res, err := server.Seed(ctx, tx)
	if err != nil {
		log.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		log.Fatal(err)
	}
	fmt.Printf("%d idées ajoutées, %d marquées comme faites, %d déjà présentes.\n", res.Added, res.MarkedDone, res.Existing)
}
