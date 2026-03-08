-- name: GetExerciseHistoryPage :many
SELECT s.id, s.uuid, s.completed_at, MAX(sl.weight) AS weight
FROM set_logs sl
JOIN sessions s ON s.id = sl.session_id
JOIN exercises e ON e.id = sl.exercise_id
WHERE e.uuid = ?
  AND s.status = 'completed'
  AND sl.weight IS NOT NULL
  AND (sl.target_reps IS NULL OR sl.actual_reps >= sl.target_reps)
GROUP BY sl.session_id, s.id, s.uuid, s.completed_at
ORDER BY s.completed_at DESC, s.id DESC
LIMIT ?;

-- name: GetExerciseHistoryPageAfter :many
SELECT s.id, s.uuid, s.completed_at, MAX(sl.weight) AS weight
FROM set_logs sl
JOIN sessions s ON s.id = sl.session_id
JOIN exercises e ON e.id = sl.exercise_id
WHERE e.uuid = ?
  AND s.status = 'completed'
  AND sl.weight IS NOT NULL
  AND (sl.target_reps IS NULL OR sl.actual_reps >= sl.target_reps)
  AND s.id < ?
GROUP BY sl.session_id, s.id, s.uuid, s.completed_at
ORDER BY s.completed_at DESC, s.id DESC
LIMIT ?;

-- name: GetPersonalRecord :one
SELECT sl.weight, sl.actual_reps, s.uuid, s.completed_at
FROM set_logs sl
JOIN sessions s ON s.id = sl.session_id
JOIN exercises e ON e.id = sl.exercise_id
WHERE e.uuid = ?
  AND s.status = 'completed'
  AND sl.weight IS NOT NULL
  AND (sl.target_reps IS NULL OR sl.actual_reps >= sl.target_reps)
ORDER BY sl.weight DESC, s.completed_at DESC
LIMIT 1;

-- name: CountCompletedSessions :one
SELECT COUNT(*) FROM sessions WHERE status = 'completed';

-- name: ListSessionStatusNewestFirst :many
SELECT status FROM sessions
WHERE status IN ('completed', 'skipped')
ORDER BY updated_at DESC, id DESC;
