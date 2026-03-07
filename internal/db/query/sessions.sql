-- name: InsertSession :execresult
INSERT INTO sessions (uuid, cycle_id, program_workout_id, sort_order, status, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: GetSessionByUUID :one
SELECT id, uuid, cycle_id, program_workout_id, sort_order, status, started_at, completed_at, notes, created_at, updated_at
FROM sessions
WHERE uuid = ?;

-- name: GetSessionInternalID :one
SELECT id FROM sessions WHERE uuid = ?;

-- name: UpdateSession :execresult
UPDATE sessions
SET status = ?, started_at = ?, completed_at = ?, notes = ?, updated_at = ?
WHERE uuid = ?;

-- name: CountIncompleteSessionsInCycle :one
SELECT COUNT(*) FROM sessions
WHERE cycle_id = ? AND status NOT IN ('completed', 'skipped');

-- name: InsertSetLog :execresult
INSERT INTO set_logs (uuid, session_id, exercise_id, section_exercise_id, set_number, target_reps, actual_reps, weight, duration, distance, rpe, completed_at, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: GetSetLogsBySessionID :many
SELECT id, uuid, session_id, exercise_id, section_exercise_id, set_number, target_reps, actual_reps, weight, duration, distance, rpe, completed_at, created_at
FROM set_logs
WHERE session_id = ?
ORDER BY set_number;
