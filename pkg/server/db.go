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
CREATE TABLE IF NOT EXISTS entries (
	id         BIGSERIAL PRIMARY KEY,
	letter     CHAR(1) NOT NULL CHECK (letter BETWEEN 'A' AND 'Z'),
	idea       TEXT NOT NULL DEFAULT '',
	place      TEXT NOT NULL DEFAULT '',
	notes      TEXT NOT NULL DEFAULT '',
	done_on    DATE,
	created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS entries_letter_idx ON entries (letter);
CREATE TABLE IF NOT EXISTS entry_photos (
	entry_id   BIGINT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
	slot       SMALLINT NOT NULL CHECK (slot IN (1, 2)),
	mime       TEXT NOT NULL,
	data       BYTEA NOT NULL,
	updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
	PRIMARY KEY (entry_id, slot)
);
CREATE TABLE IF NOT EXISTS settings (
	key   TEXT PRIMARY KEY,
	value TEXT NOT NULL
);
`

// migrateV1 moves data from the first version (one date per letter, tables
// "dates" and "photos") into "entries" / "entry_photos". It runs once; the
// old tables are left untouched as a backup.
const migrateV1 = `
DO $$
BEGIN
	-- Two cold-starting functions could migrate at the same time.
	PERFORM pg_advisory_xact_lock(727165);
	IF EXISTS (SELECT 1 FROM settings WHERE key = 'migrated_v1') THEN
		RETURN;
	END IF;
	IF to_regclass('dates') IS NOT NULL AND to_regclass('photos') IS NOT NULL THEN
		CREATE TEMP TABLE v1_map ON COMMIT DROP AS
		SELECT d.letter, nextval(pg_get_serial_sequence('entries', 'id')) AS id
		FROM dates d
		WHERE d.idea <> '' OR d.place <> '' OR d.notes <> '' OR d.done_on IS NOT NULL
		   OR EXISTS (SELECT 1 FROM photos p WHERE p.letter = d.letter);

		INSERT INTO entries (id, letter, idea, place, notes, done_on, updated_at)
		SELECT m.id, d.letter, d.idea, d.place, d.notes, d.done_on, d.updated_at
		FROM v1_map m JOIN dates d USING (letter);

		INSERT INTO entry_photos (entry_id, slot, mime, data, updated_at)
		SELECT m.id, p.slot, p.mime, p.data, p.updated_at
		FROM v1_map m JOIN photos p USING (letter);
	END IF;
	INSERT INTO settings (key, value) VALUES ('migrated_v1', now()::text);
END $$;
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
	for _, stmt := range []string{schema, migrateV1} {
		if _, err := p.Exec(ctx, stmt); err != nil {
			p.Close()
			return nil, fmt.Errorf("migrate: %w", err)
		}
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
