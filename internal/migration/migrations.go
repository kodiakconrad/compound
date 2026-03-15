package migration

import (
	"database/sql"
	_ "embed"
	"fmt"
	"log/slog"
)

//go:embed 001_initial.sql
var initialSQL string

//go:embed 002_add_set_scheme.sql
var addSetSchemeSQL string

// migration represents a single schema migration.
type migration struct {
	Version int
	Name    string
	SQL     string
}

// allMigrations lists every migration in order. Add new migrations here.
var allMigrations = []migration{
	{Version: 1, Name: "001_initial", SQL: initialSQL},
	{Version: 2, Name: "002_add_set_scheme", SQL: addSetSchemeSQL},
}

// Run applies any unapplied migrations to db. It creates the
// schema_migrations tracking table if it doesn't exist, then executes
// each pending migration inside its own transaction.
func Run(db *sql.DB) error {
	// Ensure foreign keys are always on for this connection.
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return fmt.Errorf("enable foreign keys: %w", err)
	}

	if err := ensureTrackingTable(db); err != nil {
		return fmt.Errorf("create tracking table: %w", err)
	}

	applied, err := appliedVersions(db)
	if err != nil {
		return fmt.Errorf("read applied migrations: %w", err)
	}

	for _, m := range allMigrations {
		if applied[m.Version] {
			continue
		}
		slog.Info("applying migration", "version", m.Version, "name", m.Name)

		tx, err := db.Begin()
		if err != nil {
			return fmt.Errorf("begin tx for migration %d: %w", m.Version, err)
		}

		if _, err := tx.Exec(m.SQL); err != nil {
			tx.Rollback()
			return fmt.Errorf("execute migration %d (%s): %w", m.Version, m.Name, err)
		}

		if _, err := tx.Exec(
			"INSERT INTO schema_migrations (version, name) VALUES (?, ?)",
			m.Version, m.Name,
		); err != nil {
			tx.Rollback()
			return fmt.Errorf("record migration %d: %w", m.Version, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit migration %d: %w", m.Version, err)
		}

		slog.Info("migration applied", "version", m.Version, "name", m.Name)
	}

	return nil
}

func ensureTrackingTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version    INTEGER PRIMARY KEY,
			name       TEXT    NOT NULL,
			applied_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
		)
	`)
	return err
}

func appliedVersions(db *sql.DB) (map[int]bool, error) {
	rows, err := db.Query("SELECT version FROM schema_migrations")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	applied := make(map[int]bool)
	for rows.Next() {
		var v int
		if err := rows.Scan(&v); err != nil {
			return nil, err
		}
		applied[v] = true
	}
	return applied, rows.Err()
}
