package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	dbgen "compound/internal/db"
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

	result, err := dbgen.New(db).InsertExercise(ctx, dbgen.InsertExerciseParams{
		Uuid:         e.UUID,
		Name:         e.Name,
		MuscleGroup:  e.MuscleGroup,
		Equipment:    e.Equipment,
		TrackingType: string(e.TrackingType),
		Notes:        e.Notes,
		IsCustom:     e.IsCustom,
		CreatedAt:    e.CreatedAt,
		UpdatedAt:    e.UpdatedAt,
	})
	if err != nil {
		return err
	}
	e.ID, _ = result.LastInsertId()
	return nil
}

// GetExerciseByUUID retrieves a single non-deleted exercise by UUID.
// Returns NotFoundError if no matching exercise exists.
func (s *Store) GetExerciseByUUID(ctx context.Context, db DBTX, id string) (*domain.Exercise, error) {
	row, err := dbgen.New(db).GetExerciseByUUID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.NewNotFoundError("exercise", id)
	}
	if err != nil {
		return nil, err
	}
	return mapExercise(row), nil
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

	sortCol := "name"
	if p.Sort == "created_at" {
		sortCol = "created_at"
	}
	order := "ASC"
	if strings.EqualFold(p.Order, "desc") {
		order = "DESC"
	}

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
		var e domain.Exercise
		var muscleGroup, equipment, notes *string
		var isCustom bool
		var createdAt, updatedAt time.Time

		if err := rows.Scan(
			&e.ID, &e.UUID, &e.Name,
			&muscleGroup, &equipment, &e.TrackingType,
			&notes, &isCustom, &createdAt, &updatedAt,
		); err != nil {
			return nil, false, err
		}
		e.MuscleGroup = muscleGroup
		e.Equipment = equipment
		e.Notes = notes
		e.IsCustom = isCustom
		e.CreatedAt = createdAt
		e.UpdatedAt = updatedAt
		exercises = append(exercises, &e)
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

	result, err := dbgen.New(db).UpdateExercise(ctx, dbgen.UpdateExerciseParams{
		Name:         e.Name,
		MuscleGroup:  e.MuscleGroup,
		Equipment:    e.Equipment,
		TrackingType: string(e.TrackingType),
		Notes:        e.Notes,
		UpdatedAt:    e.UpdatedAt,
		Uuid:         id,
	})
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
	result, err := dbgen.New(db).SoftDeleteExercise(ctx, dbgen.SoftDeleteExerciseParams{
		DeletedAt: &now,
		UpdatedAt: now,
		Uuid:      id,
	})
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("exercise", id)
	}
	return nil
}
