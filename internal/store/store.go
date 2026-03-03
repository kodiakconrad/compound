package store

import (
	"context"
	"database/sql"
)

// DBTX is the interface satisfied by both *sql.DB and *sql.Tx. Store methods
// accept DBTX so callers can choose whether to run inside a transaction.
type DBTX interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, query string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, query string, args ...any) *sql.Row
}

// Store holds the database connection. All domain-specific query methods
// are defined on Store in separate files (exercise_store.go, etc.).
type Store struct {
	DB *sql.DB
}

// New creates a new Store wrapping the given database connection.
func New(db *sql.DB) *Store {
	return &Store{DB: db}
}

// WithTx executes fn inside a database transaction. If fn returns an error
// the transaction is rolled back; otherwise it is committed. The deferred
// Rollback is a no-op after a successful Commit.
func (s *Store) WithTx(ctx context.Context, fn func(tx *sql.Tx) error) error {
	tx, err := s.DB.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	if err := fn(tx); err != nil {
		return err
	}
	return tx.Commit()
}
