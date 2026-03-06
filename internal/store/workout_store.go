package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

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

	// Assign sort_order = max + 1.
	var maxSort sql.NullInt64
	err := db.QueryRowContext(ctx,
		`SELECT MAX(sort_order) FROM program_workouts WHERE program_id = ?`,
		w.ProgramID,
	).Scan(&maxSort)
	if err != nil {
		return err
	}
	if maxSort.Valid {
		w.SortOrder = int(maxSort.Int64) + 1
	} else {
		w.SortOrder = 1
	}

	result, err := db.ExecContext(ctx,
		`INSERT INTO program_workouts (uuid, program_id, name, day_number, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		w.UUID, w.ProgramID, w.Name, w.DayNumber, w.SortOrder,
		w.CreatedAt.Format(time.RFC3339), w.UpdatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	w.ID = id
	return nil
}

// GetWorkoutByUUID retrieves a single workout by UUID.
func (s *Store) GetWorkoutByUUID(ctx context.Context, db DBTX, id string) (*domain.ProgramWorkout, error) {
	row := db.QueryRowContext(ctx,
		`SELECT id, uuid, program_id, name, day_number, sort_order, created_at, updated_at
		 FROM program_workouts
		 WHERE uuid = ?`, id)

	w, err := scanProgramWorkout(row)
	if err != nil {
		return nil, domain.NewNotFoundError("workout", id)
	}
	return w, nil
}

// GetWorkoutInternalID resolves a workout UUID to its integer ID.
func (s *Store) GetWorkoutInternalID(ctx context.Context, db DBTX, id string) (int64, error) {
	var workoutID int64
	err := db.QueryRowContext(ctx,
		`SELECT id FROM program_workouts WHERE uuid = ?`, id,
	).Scan(&workoutID)
	if err != nil {
		return 0, domain.NewNotFoundError("workout", id)
	}
	return workoutID, nil
}

// GetDayNumbersForProgram returns the existing day_numbers for a program's workouts.
func (s *Store) GetDayNumbersForProgram(ctx context.Context, db DBTX, programID int64) ([]int, error) {
	rows, err := db.QueryContext(ctx,
		`SELECT day_number FROM program_workouts WHERE program_id = ?`, programID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var dayNumbers []int
	for rows.Next() {
		var dn int
		if err := rows.Scan(&dn); err != nil {
			return nil, err
		}
		dayNumbers = append(dayNumbers, dn)
	}
	return dayNumbers, rows.Err()
}

// UpdateWorkout updates a workout's name and/or day_number.
func (s *Store) UpdateWorkout(ctx context.Context, db DBTX, id string, w *domain.ProgramWorkout) error {
	now := time.Now().UTC()
	w.UpdatedAt = now

	result, err := db.ExecContext(ctx,
		`UPDATE program_workouts
		 SET name = ?, day_number = ?, updated_at = ?
		 WHERE uuid = ?`,
		w.Name, w.DayNumber, w.UpdatedAt.Format(time.RFC3339), id,
	)
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
	// Get program_id before deleting for reindex.
	var programID int64
	err := db.QueryRowContext(ctx,
		`SELECT program_id FROM program_workouts WHERE uuid = ?`, id,
	).Scan(&programID)
	if err != nil {
		return domain.NewNotFoundError("workout", id)
	}

	result, err := db.ExecContext(ctx,
		`DELETE FROM program_workouts WHERE uuid = ?`, id)
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

	var maxSort sql.NullInt64
	err := db.QueryRowContext(ctx,
		`SELECT MAX(sort_order) FROM sections WHERE program_workout_id = ?`,
		sec.ProgramWorkoutID,
	).Scan(&maxSort)
	if err != nil {
		return err
	}
	if maxSort.Valid {
		sec.SortOrder = int(maxSort.Int64) + 1
	} else {
		sec.SortOrder = 1
	}

	result, err := db.ExecContext(ctx,
		`INSERT INTO sections (uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		sec.UUID, sec.ProgramWorkoutID, sec.Name, sec.SortOrder, sec.RestSeconds,
		sec.CreatedAt.Format(time.RFC3339), sec.UpdatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	sec.ID = id
	return nil
}

// GetSectionByUUID retrieves a single section by UUID.
func (s *Store) GetSectionByUUID(ctx context.Context, db DBTX, id string) (*domain.Section, error) {
	row := db.QueryRowContext(ctx,
		`SELECT id, uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at
		 FROM sections
		 WHERE uuid = ?`, id)

	sec, err := scanSection(row)
	if err != nil {
		return nil, domain.NewNotFoundError("section", id)
	}
	return sec, nil
}

// GetSectionInternalID resolves a section UUID to its integer ID.
func (s *Store) GetSectionInternalID(ctx context.Context, db DBTX, id string) (int64, error) {
	var sectionID int64
	err := db.QueryRowContext(ctx,
		`SELECT id FROM sections WHERE uuid = ?`, id,
	).Scan(&sectionID)
	if err != nil {
		return 0, domain.NewNotFoundError("section", id)
	}
	return sectionID, nil
}

// UpdateSection updates a section's name and/or rest_seconds.
func (s *Store) UpdateSection(ctx context.Context, db DBTX, id string, sec *domain.Section) error {
	now := time.Now().UTC()
	sec.UpdatedAt = now

	result, err := db.ExecContext(ctx,
		`UPDATE sections
		 SET name = ?, rest_seconds = ?, updated_at = ?
		 WHERE uuid = ?`,
		sec.Name, sec.RestSeconds, sec.UpdatedAt.Format(time.RFC3339), id,
	)
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
	var workoutID int64
	err := db.QueryRowContext(ctx,
		`SELECT program_workout_id FROM sections WHERE uuid = ?`, id,
	).Scan(&workoutID)
	if err != nil {
		return domain.NewNotFoundError("section", id)
	}

	result, err := db.ExecContext(ctx,
		`DELETE FROM sections WHERE uuid = ?`, id)
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

	var maxSort sql.NullInt64
	err := db.QueryRowContext(ctx,
		`SELECT MAX(sort_order) FROM section_exercises WHERE section_id = ?`,
		se.SectionID,
	).Scan(&maxSort)
	if err != nil {
		return err
	}
	if maxSort.Valid {
		se.SortOrder = int(maxSort.Int64) + 1
	} else {
		se.SortOrder = 1
	}

	result, err := db.ExecContext(ctx,
		`INSERT INTO section_exercises
		 (uuid, section_id, exercise_id, target_sets, target_reps, target_weight,
		  target_duration, target_distance, sort_order, notes, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		se.UUID, se.SectionID, se.ExerciseID,
		se.TargetSets, se.TargetReps, se.TargetWeight,
		se.TargetDuration, se.TargetDistance,
		se.SortOrder, se.Notes,
		se.CreatedAt.Format(time.RFC3339), se.UpdatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	se.ID = id
	return nil
}

// GetSectionExerciseByUUID retrieves a single section exercise by UUID.
func (s *Store) GetSectionExerciseByUUID(ctx context.Context, db DBTX, id string) (*domain.SectionExercise, error) {
	row := db.QueryRowContext(ctx,
		`SELECT id, uuid, section_id, exercise_id,
		        target_sets, target_reps, target_weight,
		        target_duration, target_distance,
		        sort_order, notes, created_at, updated_at
		 FROM section_exercises
		 WHERE uuid = ?`, id)

	se, err := scanSectionExercise(row)
	if err != nil {
		return nil, domain.NewNotFoundError("section_exercise", id)
	}
	return se, nil
}

// UpdateSectionExercise updates a section exercise's target fields.
func (s *Store) UpdateSectionExercise(ctx context.Context, db DBTX, id string, se *domain.SectionExercise) error {
	now := time.Now().UTC()
	se.UpdatedAt = now

	result, err := db.ExecContext(ctx,
		`UPDATE section_exercises
		 SET target_sets = ?, target_reps = ?, target_weight = ?,
		     target_duration = ?, target_distance = ?,
		     notes = ?, updated_at = ?
		 WHERE uuid = ?`,
		se.TargetSets, se.TargetReps, se.TargetWeight,
		se.TargetDuration, se.TargetDistance,
		se.Notes, se.UpdatedAt.Format(time.RFC3339), id,
	)
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
	var sectionID int64
	err := db.QueryRowContext(ctx,
		`SELECT section_id FROM section_exercises WHERE uuid = ?`, id,
	).Scan(&sectionID)
	if err != nil {
		return domain.NewNotFoundError("section_exercise", id)
	}

	result, err := db.ExecContext(ctx,
		`DELETE FROM section_exercises WHERE uuid = ?`, id)
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

	result, err := db.ExecContext(ctx,
		`INSERT INTO progression_rules
		 (uuid, section_exercise_id, strategy, increment, increment_pct,
		  deload_threshold, deload_pct, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		pr.UUID, pr.SectionExerciseID, string(pr.Strategy),
		pr.Increment, pr.IncrementPct,
		pr.DeloadThreshold, pr.DeloadPct,
		pr.CreatedAt.Format(time.RFC3339), pr.UpdatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	pr.ID = id
	return nil
}

// UpdateProgressionRule updates a progression rule.
func (s *Store) UpdateProgressionRule(ctx context.Context, db DBTX, id string, pr *domain.ProgressionRule) error {
	now := time.Now().UTC()
	pr.UpdatedAt = now

	result, err := db.ExecContext(ctx,
		`UPDATE progression_rules
		 SET strategy = ?, increment = ?, increment_pct = ?,
		     deload_threshold = ?, deload_pct = ?, updated_at = ?
		 WHERE uuid = ?`,
		string(pr.Strategy), pr.Increment, pr.IncrementPct,
		pr.DeloadThreshold, pr.DeloadPct,
		pr.UpdatedAt.Format(time.RFC3339), id,
	)
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
	var count int
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM program_workouts WHERE id = ? AND program_id = ?`,
		workoutID, programID,
	).Scan(&count)
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
	var count int
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM sections WHERE id = ? AND program_workout_id = ?`,
		sectionID, workoutID,
	).Scan(&count)
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
	var count int
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM section_exercises WHERE id = ? AND section_id = ?`,
		seID, sectionID,
	).Scan(&count)
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
		// Verify each UUID belongs to the parent and update sort_order.
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

// --- Scan helpers ---

func scanProgramWorkout(row *sql.Row) (*domain.ProgramWorkout, error) {
	var w domain.ProgramWorkout
	var createdAt, updatedAt string

	err := row.Scan(
		&w.ID, &w.UUID, &w.ProgramID, &w.Name,
		&w.DayNumber, &w.SortOrder, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	w.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	w.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	return &w, nil
}

func scanProgramWorkoutRows(rows *sql.Rows) (*domain.ProgramWorkout, error) {
	var w domain.ProgramWorkout
	var createdAt, updatedAt string

	err := rows.Scan(
		&w.ID, &w.UUID, &w.ProgramID, &w.Name,
		&w.DayNumber, &w.SortOrder, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	w.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	w.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	return &w, nil
}

func scanSection(row *sql.Row) (*domain.Section, error) {
	var sec domain.Section
	var restSeconds sql.NullInt64
	var createdAt, updatedAt string

	err := row.Scan(
		&sec.ID, &sec.UUID, &sec.ProgramWorkoutID, &sec.Name,
		&sec.SortOrder, &restSeconds, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	if restSeconds.Valid {
		v := int(restSeconds.Int64)
		sec.RestSeconds = &v
	}
	sec.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	sec.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	return &sec, nil
}

func scanSectionRows(rows *sql.Rows) (*domain.Section, error) {
	var sec domain.Section
	var restSeconds sql.NullInt64
	var createdAt, updatedAt string

	err := rows.Scan(
		&sec.ID, &sec.UUID, &sec.ProgramWorkoutID, &sec.Name,
		&sec.SortOrder, &restSeconds, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	if restSeconds.Valid {
		v := int(restSeconds.Int64)
		sec.RestSeconds = &v
	}
	sec.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	sec.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	return &sec, nil
}

func scanSectionExercise(row *sql.Row) (*domain.SectionExercise, error) {
	var se domain.SectionExercise
	var targetSets, targetReps, targetDuration sql.NullInt64
	var targetWeight, targetDistance sql.NullFloat64
	var notes sql.NullString
	var createdAt, updatedAt string

	err := row.Scan(
		&se.ID, &se.UUID, &se.SectionID, &se.ExerciseID,
		&targetSets, &targetReps, &targetWeight,
		&targetDuration, &targetDistance,
		&se.SortOrder, &notes, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	populateSectionExercise(&se, targetSets, targetReps, targetWeight, targetDuration, targetDistance, notes, createdAt, updatedAt)
	return &se, nil
}

// scanSectionExerciseWithExerciseRows scans a section exercise joined with exercises table.
func scanSectionExerciseWithExerciseRows(rows *sql.Rows) (*domain.SectionExercise, error) {
	var se domain.SectionExercise
	var targetSets, targetReps, targetDuration sql.NullInt64
	var targetWeight, targetDistance sql.NullFloat64
	var notes sql.NullString
	var createdAt, updatedAt string

	err := rows.Scan(
		&se.ID, &se.UUID, &se.SectionID, &se.ExerciseID,
		&targetSets, &targetReps, &targetWeight,
		&targetDuration, &targetDistance,
		&se.SortOrder, &notes, &createdAt, &updatedAt,
		&se.ExerciseUUID, &se.ExerciseName,
	)
	if err != nil {
		return nil, err
	}

	populateSectionExercise(&se, targetSets, targetReps, targetWeight, targetDuration, targetDistance, notes, createdAt, updatedAt)
	return &se, nil
}

func populateSectionExercise(se *domain.SectionExercise, targetSets, targetReps sql.NullInt64, targetWeight sql.NullFloat64, targetDuration sql.NullInt64, targetDistance sql.NullFloat64, notes sql.NullString, createdAt, updatedAt string) {
	if targetSets.Valid {
		v := int(targetSets.Int64)
		se.TargetSets = &v
	}
	if targetReps.Valid {
		v := int(targetReps.Int64)
		se.TargetReps = &v
	}
	if targetWeight.Valid {
		se.TargetWeight = &targetWeight.Float64
	}
	if targetDuration.Valid {
		v := int(targetDuration.Int64)
		se.TargetDuration = &v
	}
	if targetDistance.Valid {
		se.TargetDistance = &targetDistance.Float64
	}
	if notes.Valid {
		se.Notes = &notes.String
	}
	se.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	se.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
}

func scanProgressionRuleRows(rows *sql.Rows) (*domain.ProgressionRule, error) {
	var pr domain.ProgressionRule
	var strategy string
	var increment, incrementPct sql.NullFloat64
	var createdAt, updatedAt string

	err := rows.Scan(
		&pr.ID, &pr.UUID, &pr.SectionExerciseID, &strategy,
		&increment, &incrementPct, &pr.DeloadThreshold, &pr.DeloadPct,
		&createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	pr.Strategy = domain.ProgressionStrategy(strategy)
	if increment.Valid {
		pr.Increment = &increment.Float64
	}
	if incrementPct.Valid {
		pr.IncrementPct = &incrementPct.Float64
	}
	pr.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	pr.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
	return &pr, nil
}
