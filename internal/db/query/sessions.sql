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
SELECT sl.id, sl.uuid, sl.session_id, sl.exercise_id, sl.section_exercise_id,
       sl.set_number, sl.target_reps, sl.actual_reps, sl.weight, sl.duration,
       sl.distance, sl.rpe, sl.completed_at, sl.created_at,
       e.uuid AS exercise_uuid,
       se.uuid AS section_exercise_uuid
FROM set_logs sl
JOIN exercises e ON e.id = sl.exercise_id
LEFT JOIN section_exercises se ON se.id = sl.section_exercise_id
WHERE sl.session_id = ?
ORDER BY sl.set_number;

-- name: ResolveSectionExercise :one
SELECT se.id AS section_exercise_id, e.id AS exercise_id, e.uuid AS exercise_uuid
FROM section_exercises se
JOIN exercises e ON e.id = se.exercise_id
WHERE se.uuid = ?;

-- name: GetExerciseTrackingTypeBySectionExerciseID :one
SELECT e.tracking_type, e.id AS exercise_id
FROM section_exercises se
JOIN exercises e ON e.id = se.exercise_id
WHERE se.id = ?;

-- name: GetExerciseTrackingTypeByID :one
SELECT tracking_type FROM exercises WHERE id = ?;

-- name: DeleteSetLogsForSessionAndExercise :exec
DELETE FROM set_logs
WHERE session_id = ? AND exercise_id = ?;

-- name: GetSetLogProgressionHistory :many
SELECT sl.section_exercise_id, sl.set_number,
       sl.actual_reps, sl.target_reps, sl.weight,
       s.id AS session_id, s.completed_at
FROM set_logs sl
JOIN sessions s ON s.id = sl.session_id
WHERE sl.section_exercise_id IN (sqlc.slice('section_exercise_ids'))
  AND s.status = 'completed'
ORDER BY sl.section_exercise_id, s.completed_at DESC, s.id DESC, sl.set_number ASC;
