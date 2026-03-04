package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"compound/internal/domain"

	"github.com/google/uuid"
)

// CreateExercise inserts a new exercise. UUID and timestamps are generated
// automatically. The exercise's ID, UUID, CreatedAt, and UpdatedAt fields
// are populated on return.
func (s *Store) CreateExercise(ctx context.Context, db DBTX, e *domain.Exercise) error {
	e.UUID = uuid.NewString()
	now := time.Now().UTC()
	e.CreatedAt = now
	e.UpdatedAt = now

	result, err := db.ExecContext(ctx,
		`INSERT INTO exercises (uuid, name, muscle_group, equipment, tracking_type, notes, is_custom, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		e.UUID, e.Name, e.MuscleGroup, e.Equipment,
		string(e.TrackingType), e.Notes, boolToInt(e.IsCustom),
		e.CreatedAt.Format(time.RFC3339), e.UpdatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	e.ID = id
	return nil
}

// GetExerciseByUUID retrieves a single non-deleted exercise by UUID.
// Returns NotFoundError if no matching exercise exists.
func (s *Store) GetExerciseByUUID(ctx context.Context, db DBTX, id string) (*domain.Exercise, error) {
	row := db.QueryRowContext(ctx,
		`SELECT id, uuid, name, muscle_group, equipment, tracking_type, notes, is_custom,
		        created_at, updated_at
		 FROM exercises
		 WHERE uuid = ? AND deleted_at IS NULL`, id)

	e, err := scanExercise(row)
	if err != nil {
		var nf *domain.NotFoundError
		if errors.As(err, &nf) {
			return nil, domain.NewNotFoundError("exercise", id)
		}
		return nil, err
	}
	return e, nil
}

// ExerciseListParams holds filter/search/sort/pagination options.
type ExerciseListParams struct {
	MuscleGroup *string
	Equipment   *string
	Search      *string
	Sort        string // "name" or "created_at" (default: "name")
	Order       string // "asc" or "desc" (default: "asc")
	Limit       int
	Cursor      *int64 // nil = first page
}

// ListExercises returns paginated, filtered, sorted exercises.
// The boolean return value indicates whether more results exist beyond the page.
func (s *Store) ListExercises(ctx context.Context, db DBTX, p ExerciseListParams) ([]*domain.Exercise, bool, error) {
	var conditions []string
	var args []any

	conditions = append(conditions, "deleted_at IS NULL")

	if p.MuscleGroup != nil {
		conditions = append(conditions, "muscle_group = ?")
		args = append(args, *p.MuscleGroup)
	}
	if p.Equipment != nil {
		conditions = append(conditions, "equipment = ?")
		args = append(args, *p.Equipment)
	}
	if p.Search != nil {
		conditions = append(conditions, "name LIKE ?")
		args = append(args, "%"+*p.Search+"%")
	}
	if p.Cursor != nil {
		conditions = append(conditions, "id > ?")
		args = append(args, *p.Cursor)
	}

	// Validate and default sort/order.
	sortCol := "name"
	if p.Sort == "created_at" {
		sortCol = "created_at"
	}
	order := "ASC"
	if strings.EqualFold(p.Order, "desc") {
		order = "DESC"
	}

	// Fetch limit+1 to determine hasMore.
	query := fmt.Sprintf(
		`SELECT id, uuid, name, muscle_group, equipment, tracking_type, notes, is_custom,
		        created_at, updated_at
		 FROM exercises
		 WHERE %s
		 ORDER BY %s %s, id ASC
		 LIMIT ?`,
		strings.Join(conditions, " AND "), sortCol, order,
	)
	args = append(args, p.Limit+1)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()

	var exercises []*domain.Exercise
	for rows.Next() {
		e, err := scanExerciseRows(rows)
		if err != nil {
			return nil, false, err
		}
		exercises = append(exercises, e)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}

	hasMore := len(exercises) > p.Limit
	if hasMore {
		exercises = exercises[:p.Limit]
	}
	return exercises, hasMore, nil
}

// UpdateExercise updates a non-deleted exercise by UUID.
// Returns NotFoundError if the exercise does not exist.
func (s *Store) UpdateExercise(ctx context.Context, db DBTX, id string, e *domain.Exercise) error {
	now := time.Now().UTC()
	e.UpdatedAt = now

	result, err := db.ExecContext(ctx,
		`UPDATE exercises
		 SET name = ?, muscle_group = ?, equipment = ?, tracking_type = ?,
		     notes = ?, updated_at = ?
		 WHERE uuid = ? AND deleted_at IS NULL`,
		e.Name, e.MuscleGroup, e.Equipment, string(e.TrackingType),
		e.Notes, e.UpdatedAt.Format(time.RFC3339), id,
	)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("exercise", id)
	}
	return nil
}

// DeleteExercise soft-deletes a non-deleted exercise by UUID.
// Returns NotFoundError if the exercise does not exist.
func (s *Store) DeleteExercise(ctx context.Context, db DBTX, id string) error {
	now := time.Now().UTC()
	result, err := db.ExecContext(ctx,
		`UPDATE exercises SET deleted_at = ?, updated_at = ?
		 WHERE uuid = ? AND deleted_at IS NULL`,
		now.Format(time.RFC3339), now.Format(time.RFC3339), id,
	)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("exercise", id)
	}
	return nil
}

// --- Scan helpers ---

// scanExercise scans a single exercise from a *sql.Row.
func scanExercise(row *sql.Row) (*domain.Exercise, error) {
	var e domain.Exercise
	var muscleGroup, equipment, notes sql.NullString
	var trackingType string
	var isCustom int
	var createdAt, updatedAt string

	err := row.Scan(
		&e.ID, &e.UUID, &e.Name,
		&muscleGroup, &equipment, &trackingType,
		&notes, &isCustom, &createdAt, &updatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, domain.NewNotFoundError("exercise", "")
		}
		return nil, err
	}

	populateExercise(&e, muscleGroup, equipment, notes, trackingType, isCustom, createdAt, updatedAt)
	return &e, nil
}

// scanExerciseRows scans a single exercise from *sql.Rows.
func scanExerciseRows(rows *sql.Rows) (*domain.Exercise, error) {
	var e domain.Exercise
	var muscleGroup, equipment, notes sql.NullString
	var trackingType string
	var isCustom int
	var createdAt, updatedAt string

	err := rows.Scan(
		&e.ID, &e.UUID, &e.Name,
		&muscleGroup, &equipment, &trackingType,
		&notes, &isCustom, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	populateExercise(&e, muscleGroup, equipment, notes, trackingType, isCustom, createdAt, updatedAt)
	return &e, nil
}

// populateExercise maps scanned values onto a domain Exercise.
func populateExercise(e *domain.Exercise, muscleGroup, equipment, notes sql.NullString, trackingType string, isCustom int, createdAt, updatedAt string) {
	e.TrackingType = domain.TrackingType(trackingType)
	e.IsCustom = isCustom == 1
	if muscleGroup.Valid {
		e.MuscleGroup = &muscleGroup.String
	}
	if equipment.Valid {
		e.Equipment = &equipment.String
	}
	if notes.Valid {
		e.Notes = &notes.String
	}
	e.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	e.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
}

// --- Utility helpers ---

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

