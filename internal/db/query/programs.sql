-- name: InsertProgram :execresult
INSERT INTO programs (uuid, name, description, is_prebuilt, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?);

-- name: GetProgramByUUID :one
SELECT id, uuid, name, description, is_prebuilt, created_at, updated_at, deleted_at
FROM programs
WHERE uuid = ? AND deleted_at IS NULL;

-- name: GetProgramInternalID :one
SELECT id FROM programs
WHERE uuid = ? AND deleted_at IS NULL;

-- name: UpdateProgram :execresult
UPDATE programs
SET name = ?, description = ?, updated_at = ?
WHERE uuid = ? AND deleted_at IS NULL;

-- name: SoftDeleteProgram :execresult
UPDATE programs
SET deleted_at = ?, updated_at = ?
WHERE uuid = ? AND deleted_at IS NULL;

-- name: HasActiveCycle :one
SELECT COUNT(*) FROM cycles
WHERE program_id = ? AND status = 'active';

-- name: GetWorkoutsForProgram :many
SELECT id, uuid, program_id, name, day_number, sort_order, created_at, updated_at
FROM program_workouts
WHERE program_id = ?
ORDER BY sort_order;
