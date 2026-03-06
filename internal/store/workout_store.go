package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	dbgen "compound/internal/db"
	"compound/internal/domain"

	"github.com/google/uuid"
)

// --- Workout CRUD ---

// CreateWorkout inserts a new workout. Assigns the next sort_order automatically.
func (s *Store) CreateWorkout(ctx context.Context, db DBTX, w *domain.ProgramWorkout) error {
	w.UUID = uuid.NewString()
	now := time.Now().UTC()
	w.CreatedAt = now
	w.UpdatedAt = now

	raw, err := dbgen.New(db).GetMaxWorkoutSortOrder(ctx, w.ProgramID)
	if err != nil {
		return err
	}
	if raw != nil {
		w.SortOrder = int(raw.(int64)) + 1
	} else {
		w.SortOrder = 1
	}

	result, err := dbgen.New(db).InsertWorkout(ctx, dbgen.InsertWorkoutParams{
		Uuid:      w.UUID,
		ProgramID: w.ProgramID,
		Name:      w.Name,
		DayNumber: int64(w.DayNumber),
		SortOrder: int64(w.SortOrder),
		CreatedAt: w.CreatedAt,
		UpdatedAt: w.UpdatedAt,
	})
	if err != nil {
		return err
	}
	w.ID, _ = result.LastInsertId()
	return nil
}

// GetWorkoutByUUID retrieves a single workout by UUID.
func (s *Store) GetWorkoutByUUID(ctx context.Context, db DBTX, id string) (*domain.ProgramWorkout, error) {
	row, err := dbgen.New(db).GetWorkoutByUUID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.NewNotFoundError("workout", id)
	}
	if err != nil {
		return nil, err
	}
	return mapWorkout(row), nil
}

// GetWorkoutInternalID resolves a workout UUID to its integer ID.
func (s *Store) GetWorkoutInternalID(ctx context.Context, db DBTX, id string) (int64, error) {
	wid, err := dbgen.New(db).GetWorkoutInternalID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, domain.NewNotFoundError("workout", id)
	}
	if err != nil {
		return 0, err
	}
	return wid, nil
}

// GetDayNumbersForProgram returns the existing day_numbers for a program's workouts.
func (s *Store) GetDayNumbersForProgram(ctx context.Context, db DBTX, programID int64) ([]int, error) {
	rows, err := dbgen.New(db).GetDayNumbersForProgram(ctx, programID)
	if err != nil {
		return nil, err
	}
	result := make([]int, len(rows))
	for i, v := range rows {
		result[i] = int(v)
	}
	return result, nil
}

// UpdateWorkout updates a workout's name and/or day_number.
func (s *Store) UpdateWorkout(ctx context.Context, db DBTX, id string, w *domain.ProgramWorkout) error {
	now := time.Now().UTC()
	w.UpdatedAt = now

	result, err := dbgen.New(db).UpdateWorkout(ctx, dbgen.UpdateWorkoutParams{
		Name:      w.Name,
		DayNumber: int64(w.DayNumber),
		UpdatedAt: w.UpdatedAt,
		Uuid:      id,
	})
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("workout", id)
	}
	return nil
}

// DeleteWorkout hard-deletes a workout by UUID (children cascade).
func (s *Store) DeleteWorkout(ctx context.Context, db DBTX, id string) error {
	row, err := dbgen.New(db).GetWorkoutByUUID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.NewNotFoundError("workout", id)
	}
	if err != nil {
		return err
	}
	programID := row.ProgramID

	result, err := dbgen.New(db).DeleteWorkout(ctx, id)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("workout", id)
	}

	return s.reindexSortOrder(ctx, db, "program_workouts", "program_id", programID)
}

// ReorderWorkouts reorders workouts within a program to match the given UUID order.
func (s *Store) ReorderWorkouts(ctx context.Context, db DBTX, programID int64, uuids []string) error {
	return s.reorderByUUIDs(ctx, db, "program_workouts", "program_id", programID, uuids)
}

// --- Section CRUD ---

// CreateSection inserts a new section. Assigns the next sort_order automatically.
func (s *Store) CreateSection(ctx context.Context, db DBTX, sec *domain.Section) error {
	sec.UUID = uuid.NewString()
	now := time.Now().UTC()
	sec.CreatedAt = now
	sec.UpdatedAt = now

	raw, err := dbgen.New(db).GetMaxSectionSortOrder(ctx, sec.ProgramWorkoutID)
	if err != nil {
		return err
	}
	if raw != nil {
		sec.SortOrder = int(raw.(int64)) + 1
	} else {
		sec.SortOrder = 1
	}

	result, err := dbgen.New(db).InsertSection(ctx, dbgen.InsertSectionParams{
		Uuid:             sec.UUID,
		ProgramWorkoutID: sec.ProgramWorkoutID,
		Name:             sec.Name,
		SortOrder:        int64(sec.SortOrder),
		RestSeconds:      intToInt64Ptr(sec.RestSeconds),
		CreatedAt:        sec.CreatedAt,
		UpdatedAt:        sec.UpdatedAt,
	})
	if err != nil {
		return err
	}
	sec.ID, _ = result.LastInsertId()
	return nil
}

// GetSectionByUUID retrieves a single section by UUID.
func (s *Store) GetSectionByUUID(ctx context.Context, db DBTX, id string) (*domain.Section, error) {
	row, err := dbgen.New(db).GetSectionByUUID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.NewNotFoundError("section", id)
	}
	if err != nil {
		return nil, err
	}
	return mapSection(row), nil
}

// GetSectionInternalID resolves a section UUID to its integer ID.
func (s *Store) GetSectionInternalID(ctx context.Context, db DBTX, id string) (int64, error) {
	sid, err := dbgen.New(db).GetSectionInternalID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, domain.NewNotFoundError("section", id)
	}
	if err != nil {
		return 0, err
	}
	return sid, nil
}

// UpdateSection updates a section's name and/or rest_seconds.
func (s *Store) UpdateSection(ctx context.Context, db DBTX, id string, sec *domain.Section) error {
	now := time.Now().UTC()
	sec.UpdatedAt = now

	result, err := dbgen.New(db).UpdateSection(ctx, dbgen.UpdateSectionParams{
		Name:        sec.Name,
		RestSeconds: intToInt64Ptr(sec.RestSeconds),
		UpdatedAt:   sec.UpdatedAt,
		Uuid:        id,
	})
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("section", id)
	}
	return nil
}

// DeleteSection hard-deletes a section by UUID (children cascade).
func (s *Store) DeleteSection(ctx context.Context, db DBTX, id string) error {
	row, err := dbgen.New(db).GetSectionByUUID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.NewNotFoundError("section", id)
	}
	if err != nil {
		return err
	}
	workoutID := row.ProgramWorkoutID

	result, err := dbgen.New(db).DeleteSection(ctx, id)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("section", id)
	}

	return s.reindexSortOrder(ctx, db, "sections", "program_workout_id", workoutID)
}

// ReorderSections reorders sections within a workout.
func (s *Store) ReorderSections(ctx context.Context, db DBTX, workoutID int64, uuids []string) error {
	return s.reorderByUUIDs(ctx, db, "sections", "program_workout_id", workoutID, uuids)
}

// --- Section Exercise CRUD ---

// CreateSectionExercise inserts a new section exercise. Assigns sort_order automatically.
func (s *Store) CreateSectionExercise(ctx context.Context, db DBTX, se *domain.SectionExercise) error {
	se.UUID = uuid.NewString()
	now := time.Now().UTC()
	se.CreatedAt = now
	se.UpdatedAt = now

	raw, err := dbgen.New(db).GetMaxSectionExerciseSortOrder(ctx, se.SectionID)
	if err != nil {
		return err
	}
	if raw != nil {
		se.SortOrder = int(raw.(int64)) + 1
	} else {
		se.SortOrder = 1
	}

	result, err := dbgen.New(db).InsertSectionExercise(ctx, dbgen.InsertSectionExerciseParams{
		Uuid:           se.UUID,
		SectionID:      se.SectionID,
		ExerciseID:     se.ExerciseID,
		TargetSets:     intToInt64Ptr(se.TargetSets),
		TargetReps:     intToInt64Ptr(se.TargetReps),
		TargetWeight:   se.TargetWeight,
		TargetDuration: intToInt64Ptr(se.TargetDuration),
		TargetDistance: se.TargetDistance,
		SortOrder:      int64(se.SortOrder),
		Notes:          se.Notes,
		CreatedAt:      se.CreatedAt,
		UpdatedAt:      se.UpdatedAt,
	})
	if err != nil {
		return err
	}
	se.ID, _ = result.LastInsertId()
	return nil
}

// GetSectionExerciseByUUID retrieves a single section exercise by UUID.
func (s *Store) GetSectionExerciseByUUID(ctx context.Context, db DBTX, id string) (*domain.SectionExercise, error) {
	row, err := dbgen.New(db).GetSectionExerciseByUUID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.NewNotFoundError("section_exercise", id)
	}
	if err != nil {
		return nil, err
	}
	return mapSectionExercise(row), nil
}

// UpdateSectionExercise updates a section exercise's target fields.
func (s *Store) UpdateSectionExercise(ctx context.Context, db DBTX, id string, se *domain.SectionExercise) error {
	now := time.Now().UTC()
	se.UpdatedAt = now

	result, err := dbgen.New(db).UpdateSectionExercise(ctx, dbgen.UpdateSectionExerciseParams{
		TargetSets:     intToInt64Ptr(se.TargetSets),
		TargetReps:     intToInt64Ptr(se.TargetReps),
		TargetWeight:   se.TargetWeight,
		TargetDuration: intToInt64Ptr(se.TargetDuration),
		TargetDistance: se.TargetDistance,
		Notes:          se.Notes,
		UpdatedAt:      se.UpdatedAt,
		Uuid:           id,
	})
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("section_exercise", id)
	}
	return nil
}

// DeleteSectionExercise hard-deletes a section exercise by UUID (progression rule cascades).
func (s *Store) DeleteSectionExercise(ctx context.Context, db DBTX, id string) error {
	row, err := dbgen.New(db).GetSectionExerciseByUUID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return domain.NewNotFoundError("section_exercise", id)
	}
	if err != nil {
		return err
	}
	sectionID := row.SectionID

	result, err := dbgen.New(db).DeleteSectionExercise(ctx, id)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("section_exercise", id)
	}

	return s.reindexSortOrder(ctx, db, "section_exercises", "section_id", sectionID)
}

// ReorderSectionExercises reorders exercises within a section.
func (s *Store) ReorderSectionExercises(ctx context.Context, db DBTX, sectionID int64, uuids []string) error {
	return s.reorderByUUIDs(ctx, db, "section_exercises", "section_id", sectionID, uuids)
}

// --- Progression Rule CRUD ---

// CreateProgressionRule inserts a new progression rule.
func (s *Store) CreateProgressionRule(ctx context.Context, db DBTX, pr *domain.ProgressionRule) error {
	pr.UUID = uuid.NewString()
	now := time.Now().UTC()
	pr.CreatedAt = now
	pr.UpdatedAt = now

	result, err := dbgen.New(db).InsertProgressionRule(ctx, dbgen.InsertProgressionRuleParams{
		Uuid:              pr.UUID,
		SectionExerciseID: pr.SectionExerciseID,
		Strategy:          string(pr.Strategy),
		Increment:         pr.Increment,
		IncrementPct:      pr.IncrementPct,
		DeloadThreshold:   int64(pr.DeloadThreshold),
		DeloadPct:         pr.DeloadPct,
		CreatedAt:         pr.CreatedAt,
		UpdatedAt:         pr.UpdatedAt,
	})
	if err != nil {
		return err
	}
	pr.ID, _ = result.LastInsertId()
	return nil
}

// UpdateProgressionRule updates a progression rule by section_exercise_id.
func (s *Store) UpdateProgressionRule(ctx context.Context, db DBTX, id string, pr *domain.ProgressionRule) error {
	now := time.Now().UTC()
	pr.UpdatedAt = now

	result, err := dbgen.New(db).UpdateProgressionRule(ctx, dbgen.UpdateProgressionRuleParams{
		Strategy:          string(pr.Strategy),
		Increment:         pr.Increment,
		IncrementPct:      pr.IncrementPct,
		DeloadThreshold:   int64(pr.DeloadThreshold),
		DeloadPct:         pr.DeloadPct,
		UpdatedAt:         pr.UpdatedAt,
		SectionExerciseID: pr.SectionExerciseID,
	})
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("progression_rule", id)
	}
	return nil
}

// --- Parent ownership verification ---

// VerifyWorkoutBelongsToProgram checks that a workout belongs to a program.
func (s *Store) VerifyWorkoutBelongsToProgram(ctx context.Context, db DBTX, workoutID, programID int64) error {
	count, err := dbgen.New(db).VerifyWorkoutBelongsToProgram(ctx, dbgen.VerifyWorkoutBelongsToProgramParams{
		ID:        workoutID,
		ProgramID: programID,
	})
	if err != nil {
		return err
	}
	if count == 0 {
		return domain.NewNotFoundError("workout", "")
	}
	return nil
}

// VerifySectionBelongsToWorkout checks that a section belongs to a workout.
func (s *Store) VerifySectionBelongsToWorkout(ctx context.Context, db DBTX, sectionID, workoutID int64) error {
	count, err := dbgen.New(db).VerifySectionBelongsToWorkout(ctx, dbgen.VerifySectionBelongsToWorkoutParams{
		ID:               sectionID,
		ProgramWorkoutID: workoutID,
	})
	if err != nil {
		return err
	}
	if count == 0 {
		return domain.NewNotFoundError("section", "")
	}
	return nil
}

// VerifySectionExerciseBelongsToSection checks that a section exercise belongs to a section.
func (s *Store) VerifySectionExerciseBelongsToSection(ctx context.Context, db DBTX, seID, sectionID int64) error {
	count, err := dbgen.New(db).VerifySectionExerciseBelongsToSection(ctx, dbgen.VerifySectionExerciseBelongsToSectionParams{
		ID:        seID,
		SectionID: sectionID,
	})
	if err != nil {
		return err
	}
	if count == 0 {
		return domain.NewNotFoundError("section_exercise", "")
	}
	return nil
}

// --- Reindex + reorder helpers ---

// reindexSortOrder renumbers all siblings sequentially (1, 2, 3...).
func (s *Store) reindexSortOrder(ctx context.Context, db DBTX, table, parentCol string, parentID int64) error {
	rows, err := db.QueryContext(ctx,
		fmt.Sprintf("SELECT id FROM %s WHERE %s = ? ORDER BY sort_order, id", table, parentCol),
		parentID,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return err
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return err
	}

	for i, id := range ids {
		_, err := db.ExecContext(ctx,
			fmt.Sprintf("UPDATE %s SET sort_order = ? WHERE id = ?", table),
			i+1, id,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

// reorderByUUIDs validates UUIDs belong to parent and reindexes in the given order.
func (s *Store) reorderByUUIDs(ctx context.Context, db DBTX, table, parentCol string, parentID int64, uuids []string) error {
	for i, u := range uuids {
		result, err := db.ExecContext(ctx,
			fmt.Sprintf("UPDATE %s SET sort_order = ? WHERE uuid = ? AND %s = ?", table, parentCol),
			i+1, u, parentID,
		)
		if err != nil {
			return err
		}
		affected, _ := result.RowsAffected()
		if affected == 0 {
			return domain.NewUnprocessableError(
				fmt.Sprintf("uuid %s does not belong to the parent resource", u))
		}
	}
	return nil
}
