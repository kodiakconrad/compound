-- name: InsertCycle :execresult
INSERT INTO cycles (uuid, program_id, status, started_at, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?);

-- name: GetCycleByUUID :one
SELECT id, uuid, program_id, status, started_at, completed_at, created_at, updated_at
FROM cycles
WHERE uuid = ?;

-- name: GetCycleInternalID :one
SELECT id FROM cycles WHERE uuid = ?;

-- name: UpdateCycle :execresult
UPDATE cycles
SET status = ?, completed_at = ?, updated_at = ?
WHERE uuid = ?;

-- name: GetSessionsByCycleID :many
SELECT id, uuid, cycle_id, program_workout_id, sort_order, status, started_at, completed_at, notes, created_at, updated_at
FROM sessions
WHERE cycle_id = ?
ORDER BY sort_order;
