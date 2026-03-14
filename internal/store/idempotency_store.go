package store

import (
	"context"
	"database/sql"
	"errors"
	"time"

	dbgen "compound/internal/db"
	"compound/internal/dbutil"
	"compound/internal/domain"
)

// IdempotencyResult holds the stored response for a previously processed request.
type IdempotencyResult struct {
	Status   int
	Response []byte
}

// CheckIdempotencyKey looks up a non-expired idempotency key. If found and
// the method+path match, returns the stored response. If the key exists but
// with a different method+path, returns an UnprocessableError.
func (s *Store) CheckIdempotencyKey(ctx context.Context, db DBTX, key, method, path string) (*IdempotencyResult, error) {
	now := time.Now().UTC()

	row, err := dbgen.New(db).GetIdempotencyKey(ctx, dbgen.GetIdempotencyKeyParams{
		Key:       key,
		ExpiresAt: dbutil.TimeFrom(now),
	})
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil // Key not found — proceed normally.
	}
	if err != nil {
		return nil, err
	}

	// Same key on a different endpoint is a misuse.
	if row.Method != method || row.Path != path {
		return nil, domain.NewUnprocessableError("idempotency key already used with a different request")
	}

	return &IdempotencyResult{
		Status:   int(row.Status),
		Response: []byte(row.Response),
	}, nil
}

// SaveIdempotencyKey stores the response for future replay. Keys expire after 24 hours.
func (s *Store) SaveIdempotencyKey(ctx context.Context, db DBTX, key, method, path string, status int, response []byte) error {
	now := time.Now().UTC()
	expiresAt := now.Add(24 * time.Hour)

	_, err := dbgen.New(db).InsertIdempotencyKey(ctx, dbgen.InsertIdempotencyKeyParams{
		Key:       key,
		Method:    method,
		Path:      path,
		Status:    int64(status),
		Response:  string(response),
		CreatedAt: dbutil.TimeFrom(now),
		ExpiresAt: dbutil.TimeFrom(expiresAt),
	})
	return err
}
