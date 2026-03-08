-- name: GetIdempotencyKey :one
SELECT method, path, status, response
FROM idempotency_keys
WHERE key = ? AND expires_at > ?;

-- name: InsertIdempotencyKey :execresult
INSERT INTO idempotency_keys (key, method, path, status, response, created_at, expires_at)
VALUES (?, ?, ?, ?, ?, ?, ?);
