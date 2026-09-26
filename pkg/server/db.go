package server

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"os"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const Letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"

var (
	poolMu sync.Mutex
	pool   *pgxpool.Pool
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
// warm invocations of the same function instance. A failed initialisation is
// retried on the next call (e.g. while a Neon database is waking up).
func DB(ctx context.Context) (*pgxpool.Pool, error) {
	poolMu.Lock()
	defer poolMu.Unlock()
	if pool != nil {
		return pool, nil
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = os.Getenv("POSTGRES_URL")
	}
	if dsn == "" {
		return nil, errors.New("DATABASE_URL is not set")
	}
	cfg, err := pgxpool.ParseConfig(stripUnsupportedParams(dsn))
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	cfg.MaxConns = 4
	cfg.MaxConnIdleTime = 30 * time.Second
	// Plays nicely with transaction poolers (Neon / Supabase pooled URLs).
	cfg.ConnConfig.DefaultQueryExecMode = pgx.QueryExecModeExec

	p, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, err
	}
	if _, err := p.Exec(ctx, schema); err != nil {
		p.Close()
		return nil, fmt.Errorf("migrate: %w", err)
	}
	pool = p
	return pool, nil
}

// stripUnsupportedParams removes libpq options that pgx does not understand
// and would otherwise forward to the server as runtime parameters, which
// fails the connection. Neon's connection strings include channel_binding.
func stripUnsupportedParams(dsn string) string {
	u, err := url.Parse(dsn)
	if err != nil || u.Scheme == "" {
		return dsn
	}
	q := u.Query()
	q.Del("channel_binding")
	u.RawQuery = q.Encode()
	return u.String()
}
