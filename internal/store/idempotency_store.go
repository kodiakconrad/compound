package store

import (
	"context"
	"database/sql"
	"time"

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
	now := time.Now().UTC().Format(time.RFC3339)

	var storedMethod, storedPath string
	var status int
	var response string

	err := db.QueryRowContext(ctx,
		`SELECT method, path, status, response
		 FROM idempotency_keys
		 WHERE key = ? AND expires_at > ?`, key, now,
	).Scan(&storedMethod, &storedPath, &status, &response)

	if err == sql.ErrNoRows {
		return nil, nil // Key not found — proceed normally.
	}
	if err != nil {
		return nil, err
	}

	// Same key on a different endpoint is a misuse.
	if storedMethod != method || storedPath != path {
		return nil, domain.NewUnprocessableError("idempotency key already used with a different request")
	}

	return &IdempotencyResult{
		Status:   status,
		Response: []byte(response),
	}, nil
}

// SaveIdempotencyKey stores the response for future replay. Keys expire after 24 hours.
func (s *Store) SaveIdempotencyKey(ctx context.Context, db DBTX, key, method, path string, status int, response []byte) error {
	now := time.Now().UTC()
	expiresAt := now.Add(24 * time.Hour)

	_, err := db.ExecContext(ctx,
		`INSERT INTO idempotency_keys (key, method, path, status, response, created_at, expires_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		key, method, path, status, string(response),
		now.Format(time.RFC3339), expiresAt.Format(time.RFC3339),
	)
	return err
}
