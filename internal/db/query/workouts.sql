-- ============================================================
-- program_workouts
-- ============================================================

-- name: GetMaxWorkoutSortOrder :one
SELECT COALESCE(MAX(sort_order), 0) FROM program_workouts
WHERE program_id = ?;

-- name: InsertWorkout :execresult
INSERT INTO program_workouts (uuid, program_id, name, day_number, sort_order, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: GetWorkoutByUUID :one
SELECT id, uuid, program_id, name, day_number, sort_order, created_at, updated_at
FROM program_workouts
WHERE uuid = ?;

-- name: GetWorkoutInternalID :one
SELECT id FROM program_workouts
WHERE uuid = ?;

-- name: GetDayNumbersForProgram :many
SELECT day_number FROM program_workouts
WHERE program_id = ?
ORDER BY day_number;

-- name: UpdateWorkout :execresult
UPDATE program_workouts
SET name = ?, day_number = ?, updated_at = ?
WHERE uuid = ?;

-- name: DeleteWorkout :execresult
DELETE FROM program_workouts
WHERE uuid = ?;

-- name: VerifyWorkoutBelongsToProgram :one
SELECT COUNT(*) FROM program_workouts
WHERE id = ? AND program_id = ?;

-- ============================================================
-- sections
-- ============================================================

-- name: GetSectionsByWorkoutID :many
SELECT id, uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at
FROM sections
WHERE program_workout_id = ?
ORDER BY sort_order;

-- name: GetSectionsByWorkoutIDs :many
SELECT id, uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at
FROM sections
WHERE program_workout_id IN (sqlc.slice('workout_ids'))
ORDER BY sort_order;

-- name: GetMaxSectionSortOrder :one
SELECT COALESCE(MAX(sort_order), 0) FROM sections
WHERE program_workout_id = ?;

-- name: InsertSection :execresult
INSERT INTO sections (uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?);

-- name: GetSectionByUUID :one
SELECT id, uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at
FROM sections
WHERE uuid = ?;

-- name: GetSectionInternalID :one
SELECT id FROM sections
WHERE uuid = ?;

-- name: UpdateSection :execresult
UPDATE sections
SET name = ?, rest_seconds = ?, updated_at = ?
WHERE uuid = ?;

-- name: DeleteSection :execresult
DELETE FROM sections
WHERE uuid = ?;

-- name: VerifySectionBelongsToWorkout :one
SELECT COUNT(*) FROM sections
WHERE id = ? AND program_workout_id = ?;

-- ============================================================
-- section_exercises
-- ============================================================

-- name: GetMaxSectionExerciseSortOrder :one
SELECT COALESCE(MAX(sort_order), 0) FROM section_exercises
WHERE section_id = ?;

-- name: InsertSectionExercise :execresult
INSERT INTO section_exercises (uuid, section_id, exercise_id, target_sets, target_reps, target_weight, target_duration, target_distance, sort_order, notes, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: GetSectionExerciseByUUID :one
SELECT id, uuid, section_id, exercise_id, target_sets, target_reps, target_weight, target_duration, target_distance, sort_order, notes, created_at, updated_at
FROM section_exercises
WHERE uuid = ?;

-- name: UpdateSectionExercise :execresult
UPDATE section_exercises
SET target_sets = ?, target_reps = ?, target_weight = ?, target_duration = ?, target_distance = ?, notes = ?, updated_at = ?
WHERE uuid = ?;

-- name: DeleteSectionExercise :execresult
DELETE FROM section_exercises
WHERE uuid = ?;

-- name: VerifySectionExerciseBelongsToSection :one
SELECT COUNT(*) FROM section_exercises
WHERE id = ? AND section_id = ?;

-- name: GetSectionExercisesWithExerciseBySectionIDs :many
SELECT se.id, se.uuid, se.section_id, se.exercise_id,
       se.target_sets, se.target_reps, se.target_weight,
       se.target_duration, se.target_distance,
       se.sort_order, se.notes, se.created_at, se.updated_at,
       e.uuid AS exercise_uuid, e.name AS exercise_name
FROM section_exercises se
JOIN exercises e ON e.id = se.exercise_id
WHERE se.section_id IN (sqlc.slice('section_ids'))
ORDER BY se.sort_order;

-- name: GetProgressionRulesBySectionExerciseIDs :many
SELECT id, uuid, section_exercise_id, strategy,
       increment, increment_pct, deload_threshold, deload_pct,
       created_at, updated_at
FROM progression_rules
WHERE section_exercise_id IN (sqlc.slice('section_exercise_ids'));

-- ============================================================
-- progression_rules
-- ============================================================

-- name: InsertProgressionRule :execresult
INSERT INTO progression_rules (uuid, section_exercise_id, strategy, increment, increment_pct, deload_threshold, deload_pct, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: GetProgressionRuleBySectionExerciseID :one
SELECT id, uuid, section_exercise_id, strategy, increment, increment_pct, deload_threshold, deload_pct, created_at, updated_at
FROM progression_rules
WHERE section_exercise_id = ?;

-- name: UpdateProgressionRule :execresult
UPDATE progression_rules
SET strategy = ?, increment = ?, increment_pct = ?, deload_threshold = ?, deload_pct = ?, updated_at = ?
WHERE section_exercise_id = ?;
