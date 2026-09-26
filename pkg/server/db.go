package server

import (
	"context"
	"errors"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const Letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

var (
	poolOnce sync.Once
	pool     *pgxpool.Pool
	poolErr  error
)

const schema = `
CREATE TABLE IF NOT EXISTS dates (
	letter     CHAR(1) PRIMARY KEY,
	idea       TEXT NOT NULL DEFAULT '',
	place      TEXT NOT NULL DEFAULT '',
	notes      TEXT NOT NULL DEFAULT '',
	done_on    DATE,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS photos (
	letter     CHAR(1) NOT NULL REFERENCES dates(letter) ON DELETE CASCADE,
	slot       SMALLINT NOT NULL CHECK (slot IN (1, 2)),
	mime       TEXT NOT NULL,
	data       BYTEA NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (letter, slot)
);
CREATE TABLE IF NOT EXISTS settings (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
INSERT INTO dates (letter)
SELECT chr(c) FROM generate_series(65, 90) AS c
ON CONFLICT DO NOTHING;
`

// DB returns a lazily-initialised pool. On Vercel the pool is reused across
// warm invocations of the same function instance.
func DB(ctx context.Context) (*pgxpool.Pool, error) {
	poolOnce.Do(func() {
		url := os.Getenv("DATABASE_URL")
		if url == "" {
			url = os.Getenv("POSTGRES_URL")
		}
		if url == "" {
			poolErr = errors.New("DATABASE_URL is not set")
			return
		}
		cfg, err := pgxpool.ParseConfig(url)
		if err != nil {
			poolErr = fmt.Errorf("parse DATABASE_URL: %w", err)
			return
		}
		cfg.MaxConns = 4
		cfg.MaxConnIdleTime = 30 * time.Second
		// Plays nicely with transaction poolers (Neon / Supabase pooled URLs).
		cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec

		p, err := pgxpool.NewWithConfig(ctx, cfg)
		if err != nil {
			poolErr = err
			return
		}
		if _, err := p.Exec(ctx, schema); err != nil {
			p.Close()
			poolErr = fmt.Errorf("migrate: %w", err)
			return
		}
		pool = p
	})
	return pool, poolErr
}
