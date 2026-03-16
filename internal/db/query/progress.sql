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

-- name: CountDistinctWeeksTrained :one
SELECT COUNT(DISTINCT strftime('%Y-%W', completed_at)) AS weeks
FROM sessions
WHERE status = 'completed' AND completed_at IS NOT NULL;

-- name: ListSessionStatusNewestFirst :many
SELECT status FROM sessions
WHERE status IN ('completed', 'skipped')
ORDER BY updated_at DESC, id DESC;

-- name: GetAllPersonalRecords :many
SELECT e.uuid AS exercise_uuid,
       e.name AS exercise_name,
       sl.weight,
       sl.actual_reps,
       s.completed_at
FROM set_logs sl
JOIN sessions s ON s.id = sl.session_id
JOIN exercises e ON e.id = sl.exercise_id
WHERE s.status = 'completed'
  AND sl.weight IS NOT NULL
  AND (sl.target_reps IS NULL OR sl.actual_reps >= sl.target_reps)
  AND sl.weight = (
    SELECT MAX(sl2.weight)
    FROM set_logs sl2
    JOIN sessions s2 ON s2.id = sl2.session_id
    WHERE sl2.exercise_id = sl.exercise_id
      AND s2.status = 'completed'
      AND sl2.weight IS NOT NULL
      AND (sl2.target_reps IS NULL OR sl2.actual_reps >= sl2.target_reps)
  )
GROUP BY sl.exercise_id
ORDER BY e.name;

-- name: GetRecentSessions :many
SELECT s.uuid,
       s.status,
       s.completed_at,
       pw.name AS workout_name,
       p.name AS program_name,
       c.uuid AS cycle_uuid
FROM sessions s
JOIN program_workouts pw ON pw.id = s.program_workout_id
JOIN cycles c ON c.id = s.cycle_id
JOIN programs p ON p.id = c.program_id
WHERE s.status IN ('completed', 'skipped')
ORDER BY s.completed_at DESC, s.id DESC
LIMIT ?;

-- name: GetExerciseChartData :many
SELECT DATE(s.completed_at) AS date,
       MAX(sl.weight) AS weight,
       sl.actual_reps,
       CAST(MAX(sl.weight) * sl.actual_reps AS REAL) AS volume
FROM set_logs sl
JOIN sessions s ON s.id = sl.session_id
JOIN exercises e ON e.id = sl.exercise_id
WHERE e.uuid = ?
  AND s.status = 'completed'
  AND sl.weight IS NOT NULL
  AND (sl.target_reps IS NULL OR sl.actual_reps >= sl.target_reps)
GROUP BY s.id
ORDER BY s.completed_at ASC;
