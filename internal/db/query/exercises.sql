-- name: InsertExercise :execresult
INSERT INTO exercises (uuid, name, muscle_group, equipment, tracking_type, notes, is_custom, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: GetExerciseByUUID :one
SELECT id, uuid, name, muscle_group, equipment, tracking_type, notes, is_custom, created_at, updated_at
FROM exercises
WHERE uuid = ? AND deleted_at IS NULL;

-- name: UpdateExercise :execresult
UPDATE exercises
SET name = ?, muscle_group = ?, equipment = ?, tracking_type = ?, notes = ?, updated_at = ?
WHERE uuid = ? AND deleted_at IS NULL;

-- name: SoftDeleteExercise :execresult
UPDATE exercises
SET deleted_at = ?, updated_at = ?
WHERE uuid = ? AND deleted_at IS NULL;
