package server

import (
	"bufio"
	"context"
	_ "embed"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

// Our date list. [x] = already done.
//
//go:embed alphabet.md
var alphabetList string

type seedItem struct {
	letter, idea string
	done         bool
}

type SeedResult struct{ Added, MarkedDone, Existing int }

// Seed imports alphabet.md. An idea already present for its letter (same
// name, any case) is not added again, only marked done if ticked.
func Seed(ctx context.Context, tx pgx.Tx) (SeedResult, error) {
	var res SeedResult
	items, err := parseList(alphabetList)
	if err != nil {
		return res, err
	}
	for _, it := range items {
		tag, err := tx.Exec(ctx, `
			INSERT INTO entries (letter, idea, done)
			SELECT $1, $2, $3
			WHERE NOT EXISTS (SELECT 1 FROM entries WHERE letter = $1 AND lower(idea) = lower($2))`,
			it.letter, it.idea, it.done)
		if err != nil {
			return res, fmt.Errorf("%s %q: %w", it.letter, it.idea, err)
		}
		if tag.RowsAffected() == 1 {
			res.Added++
			continue
		}
		if it.done {
			tag, err := tx.Exec(ctx,
				`UPDATE entries SET done = true, updated_at = now() WHERE letter = $1 AND lower(idea) = lower($2) AND NOT done`,
				it.letter, it.idea)
			if err != nil {
				return res, fmt.Errorf("%s %q: %w", it.letter, it.idea, err)
			}
			if tag.RowsAffected() > 0 {
				res.MarkedDone++
				continue
			}
		}
		res.Existing++
	}
	return res, nil
}

// seedOnce runs Seed the first time the app starts on a database, so the
// list shows up online without any manual step.
func seedOnce(ctx context.Context, db interface {
	Begin(context.Context) (pgx.Tx, error)
}) error {
	tx, err := db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(727166)`); err != nil {
		return err
	}
	var done bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM settings WHERE key = 'seeded_alphabet')`).Scan(&done); err != nil {
		return err
	}
	if done {
		return nil
	}
	if _, err := Seed(ctx, tx); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `INSERT INTO settings (key, value) VALUES ('seeded_alphabet', now()::text)`); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// parseList reads "A" section lines and "- [x] idea" / "- [ ] idea" lines.
func parseList(s string) ([]seedItem, error) {
	var items []seedItem
	letter := ""
	sc := bufio.NewScanner(strings.NewReader(s))
	for n := 1; sc.Scan(); n++ {
		line := strings.TrimSpace(sc.Text())
		switch {
		case line == "" || strings.HasPrefix(line, "#"):
		case len(line) == 1 && strings.Contains(Letters, line):
			letter = line
		case strings.HasPrefix(line, "- [x] "), strings.HasPrefix(line, "- [ ] "):
			if letter == "" {
				return nil, fmt.Errorf("alphabet.md ligne %d : idée avant la première lettre", n)
			}
			items = append(items, seedItem{letter, strings.Join(strings.Fields(line[6:]), " "), line[3] == 'x'})
		default:
			return nil, fmt.Errorf("alphabet.md ligne %d non comprise : %q", n, line)
		}
	}
	return items, sc.Err()
}
