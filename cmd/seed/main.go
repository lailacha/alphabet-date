// Imports our date list (alphabet.md) into the database: go run ./cmd/seed
//
// Uses DATABASE_URL from .env like the dev server. Safe to run several times:
// an idea that already exists for its letter (same name, any case) is not
// added again, it is only marked done if it is ticked in the list.
package main

import (
	"bufio"
	"context"
	_ "embed"
	"fmt"
	"log"
	"strings"

	"github.com/lailacha/alphabet-date/pkg/server"
)

//go:embed alphabet.md
var list string

type item struct {
	letter string
	idea   string
	done   bool
}

func main() {
	server.LoadDotEnv(".env")
	items, err := parse(list)
	if err != nil {
		log.Fatal(err)
	}

	ctx := context.Background()
	db, err := server.DB(ctx)
	if err != nil {
		log.Fatal(err)
	}

	var added, markedDone, skipped int
	for _, it := range items {
		tag, err := db.Exec(ctx, `
			INSERT INTO entries (letter, idea, done)
			SELECT $1, $2, $3
			WHERE NOT EXISTS (SELECT 1 FROM entries WHERE letter = $1 AND lower(idea) = lower($2))`,
			it.letter, it.idea, it.done)
		if err != nil {
			log.Fatalf("%s %q: %v", it.letter, it.idea, err)
		}
		if tag.RowsAffected() == 1 {
			added++
			continue
		}
		if it.done {
			tag, err := db.Exec(ctx,
				`UPDATE entries SET done = true, updated_at = now() WHERE letter = $1 AND lower(idea) = lower($2) AND NOT done`,
				it.letter, it.idea)
			if err != nil {
				log.Fatalf("%s %q: %v", it.letter, it.idea, err)
			}
			if tag.RowsAffected() > 0 {
				markedDone++
				continue
			}
		}
		skipped++
	}
	fmt.Printf("%d idées ajoutées, %d marquées comme faites, %d déjà présentes.\n", added, markedDone, skipped)
}

// parse reads "A" section lines and "- [x] idea" / "- [ ] idea" item lines.
func parse(s string) ([]item, error) {
	var items []item
	letter := ""
	sc := bufio.NewScanner(strings.NewReader(s))
	for n := 1; sc.Scan(); n++ {
		line := strings.TrimSpace(sc.Text())
		switch {
		case line == "" || strings.HasPrefix(line, "#"):
		case len(line) == 1 && strings.Contains(server.Letters, line):
			letter = line
		case strings.HasPrefix(line, "- [x] "), strings.HasPrefix(line, "- [ ] "):
			if letter == "" {
				return nil, fmt.Errorf("ligne %d : idée avant la première lettre", n)
			}
			items = append(items, item{letter, strings.Join(strings.Fields(line[6:]), " "), line[3] == 'x'})
		default:
			return nil, fmt.Errorf("ligne %d non comprise : %q", n, line)
		}
	}
	return items, sc.Err()
}
