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

// --- Program CRUD ---

func (s *Store) CreateProgram(ctx context.Context, db DBTX, p *domain.Program) error {
	p.UUID = uuid.NewString()
	now := time.Now().UTC()
	p.CreatedAt = now
	p.UpdatedAt = now

	result, err := dbgen.New(db).InsertProgram(ctx, dbgen.InsertProgramParams{
		Uuid:        p.UUID,
		Name:        p.Name,
		Description: p.Description,
		IsTemplate:  p.IsTemplate,
		IsPrebuilt:  p.IsPrebuilt,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
	})
	if err != nil {
		return err
	}
	p.ID, _ = result.LastInsertId()
	return nil
}

func (s *Store) GetProgramByUUID(ctx context.Context, db DBTX, id string) (*domain.Program, error) {
	row, err := dbgen.New(db).GetProgramByUUID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.NewNotFoundError("program", id)
	}
	if err != nil {
		return nil, err
	}
	return mapProgram(row), nil
}

func (s *Store) GetProgramInternalID(ctx context.Context, db DBTX, id string) (int64, error) {
	programID, err := dbgen.New(db).GetProgramInternalID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, domain.NewNotFoundError("program", id)
	}
	if err != nil {
		return 0, err
	}
	return programID, nil
}

func (s *Store) GetProgramWithTree(ctx context.Context, db DBTX, id string) (*domain.Program, error) {
	p, err := s.GetProgramByUUID(ctx, db, id)
	if err != nil {
		return nil, err
	}

	workoutRows, err := dbgen.New(db).GetWorkoutsForProgram(ctx, p.ID)
	if err != nil {
		return nil, err
	}

	var workoutIDs []int64
	workoutMap := make(map[int64]*domain.ProgramWorkout)
	for _, wr := range workoutRows {
		w := mapWorkout(wr)
		p.Workouts = append(p.Workouts, w)
		workoutIDs = append(workoutIDs, w.ID)
		workoutMap[w.ID] = w
	}

	if len(workoutIDs) == 0 {
		return p, nil
	}

	// Sections — IN clause stays raw SQL.
	sQuery := fmt.Sprintf(
		`SELECT id, uuid, program_workout_id, name, sort_order, rest_seconds, created_at, updated_at
		 FROM sections
		 WHERE program_workout_id IN (%s)
		 ORDER BY sort_order`,
		placeholders(len(workoutIDs)),
	)
	sRows, err := db.QueryContext(ctx, sQuery, int64sToAny(workoutIDs)...)
	if err != nil {
		return nil, err
	}
	defer sRows.Close()

	var sectionIDs []int64
	sectionMap := make(map[int64]*domain.Section)
	for sRows.Next() {
		var secID, programWorkoutID int64
		var secUUID, name string
		var sortOrder int64
		var restSeconds *int64
		var createdAt, updatedAt time.Time

		if err := sRows.Scan(&secID, &secUUID, &programWorkoutID, &name,
			&sortOrder, &restSeconds, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		sec := &domain.Section{
			ID: secID, UUID: secUUID, ProgramWorkoutID: programWorkoutID,
			Name: name, SortOrder: int(sortOrder), RestSeconds: ptrInt64ToInt(restSeconds),
			CreatedAt: createdAt, UpdatedAt: updatedAt,
		}
		if w, ok := workoutMap[sec.ProgramWorkoutID]; ok {
			w.Sections = append(w.Sections, sec)
		}
		sectionIDs = append(sectionIDs, sec.ID)
		sectionMap[sec.ID] = sec
	}
	if err := sRows.Err(); err != nil {
		return nil, err
	}

	if len(sectionIDs) == 0 {
		return p, nil
	}

	// Section exercises with JOIN — IN clause stays raw SQL.
	seQuery := fmt.Sprintf(
		`SELECT se.id, se.uuid, se.section_id, se.exercise_id,
		        se.target_sets, se.target_reps, se.target_weight,
		        se.target_duration, se.target_distance,
		        se.sort_order, se.notes, se.created_at, se.updated_at,
		        e.uuid, e.name
		 FROM section_exercises se
		 JOIN exercises e ON e.id = se.exercise_id
		 WHERE se.section_id IN (%s)
		 ORDER BY se.sort_order`,
		placeholders(len(sectionIDs)),
	)
	seRows, err := db.QueryContext(ctx, seQuery, int64sToAny(sectionIDs)...)
	if err != nil {
		return nil, err
	}
	defer seRows.Close()

	var seIDs []int64
	seMap := make(map[int64]*domain.SectionExercise)
	for seRows.Next() {
		var seID, sectionID, exerciseID int64
		var seUUID, exerciseUUID, exerciseName string
		var targetSets, targetReps, targetDuration *int64
		var targetWeight, targetDistance *float64
		var sortOrder int64
		var notes *string
		var createdAt, updatedAt time.Time

		if err := seRows.Scan(
			&seID, &seUUID, &sectionID, &exerciseID,
			&targetSets, &targetReps, &targetWeight,
			&targetDuration, &targetDistance,
			&sortOrder, &notes, &createdAt, &updatedAt,
			&exerciseUUID, &exerciseName,
		); err != nil {
			return nil, err
		}
		se := &domain.SectionExercise{
			ID: seID, UUID: seUUID, SectionID: sectionID, ExerciseID: exerciseID,
			ExerciseUUID: exerciseUUID, ExerciseName: exerciseName,
			TargetSets: ptrInt64ToInt(targetSets), TargetReps: ptrInt64ToInt(targetReps),
			TargetWeight: targetWeight, TargetDuration: ptrInt64ToInt(targetDuration),
			TargetDistance: targetDistance, SortOrder: int(sortOrder), Notes: notes,
			CreatedAt: createdAt, UpdatedAt: updatedAt,
		}
		if sec, ok := sectionMap[se.SectionID]; ok {
			sec.Exercises = append(sec.Exercises, se)
		}
		seIDs = append(seIDs, se.ID)
		seMap[se.ID] = se
	}
	if err := seRows.Err(); err != nil {
		return nil, err
	}

	if len(seIDs) == 0 {
		return p, nil
	}

	// Progression rules — IN clause stays raw SQL.
	prQuery := fmt.Sprintf(
		`SELECT id, uuid, section_exercise_id, strategy,
		        increment, increment_pct, deload_threshold, deload_pct,
		        created_at, updated_at
		 FROM progression_rules
		 WHERE section_exercise_id IN (%s)`,
		placeholders(len(seIDs)),
	)
	prRows, err := db.QueryContext(ctx, prQuery, int64sToAny(seIDs)...)
	if err != nil {
		return nil, err
	}
	defer prRows.Close()

	for prRows.Next() {
		var prID, sectionExerciseID int64
		var prUUID, strategy string
		var increment, incrementPct *float64
		var deloadThreshold int64
		var deloadPct float64
		var createdAt, updatedAt time.Time

		if err := prRows.Scan(
			&prID, &prUUID, &sectionExerciseID, &strategy,
			&increment, &incrementPct, &deloadThreshold, &deloadPct,
			&createdAt, &updatedAt,
		); err != nil {
			return nil, err
		}
		pr := &domain.ProgressionRule{
			ID: prID, UUID: prUUID, SectionExerciseID: sectionExerciseID,
			Strategy: domain.ProgressionStrategy(strategy),
			Increment: increment, IncrementPct: incrementPct,
			DeloadThreshold: int(deloadThreshold), DeloadPct: deloadPct,
			CreatedAt: createdAt, UpdatedAt: updatedAt,
		}
		if se, ok := seMap[pr.SectionExerciseID]; ok {
			se.ProgressionRule = pr
		}
	}
	if err := prRows.Err(); err != nil {
		return nil, err
	}

	return p, nil
}

// ProgramListParams holds filter/sort/pagination options for listing programs.
type ProgramListParams struct {
	IsTemplate *bool
	Sort       string
	Order      string
	Limit      int
	Cursor     *int64
}

func (s *Store) ListPrograms(ctx context.Context, db DBTX, p ProgramListParams) ([]*domain.Program, bool, error) {
	var conditions []string
	var args []any

	conditions = append(conditions, "deleted_at IS NULL")

	if p.IsTemplate != nil {
		conditions = append(conditions, "is_template = ?")
		args = append(args, *p.IsTemplate)
	}
	if p.Cursor != nil {
		conditions = append(conditions, "id > ?")
		args = append(args, *p.Cursor)
	}

	sortCol := "updated_at"
	if p.Sort == "name" {
		sortCol = "name"
	}
	order := "DESC"
	if strings.EqualFold(p.Order, "asc") {
		order = "ASC"
	}

	query := fmt.Sprintf(
		`SELECT id, uuid, name, description, is_template, is_prebuilt,
		        created_at, updated_at
		 FROM programs
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

	var programs []*domain.Program
	for rows.Next() {
		var prog domain.Program
		var description *string
		var isTemplate, isPrebuilt bool
		var createdAt, updatedAt time.Time

		if err := rows.Scan(
			&prog.ID, &prog.UUID, &prog.Name, &description,
			&isTemplate, &isPrebuilt, &createdAt, &updatedAt,
		); err != nil {
			return nil, false, err
		}
		prog.Description = description
		prog.IsTemplate = isTemplate
		prog.IsPrebuilt = isPrebuilt
		prog.CreatedAt = createdAt
		prog.UpdatedAt = updatedAt
		programs = append(programs, &prog)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}

	hasMore := len(programs) > p.Limit
	if hasMore {
		programs = programs[:p.Limit]
	}
	return programs, hasMore, nil
}

func (s *Store) UpdateProgram(ctx context.Context, db DBTX, id string, p *domain.Program) error {
	now := time.Now().UTC()
	p.UpdatedAt = now

	result, err := dbgen.New(db).UpdateProgram(ctx, dbgen.UpdateProgramParams{
		Name:        p.Name,
		Description: p.Description,
		UpdatedAt:   p.UpdatedAt,
		Uuid:        id,
	})
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("program", id)
	}
	return nil
}

func (s *Store) DeleteProgram(ctx context.Context, db DBTX, id string) error {
	now := time.Now().UTC()
	result, err := dbgen.New(db).SoftDeleteProgram(ctx, dbgen.SoftDeleteProgramParams{
		DeletedAt: &now,
		UpdatedAt: now,
		Uuid:      id,
	})
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("program", id)
	}
	return nil
}

func (s *Store) HasActiveCycle(ctx context.Context, db DBTX, programID int64) (bool, error) {
	count, err := dbgen.New(db).HasActiveCycle(ctx, programID)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *Store) CopyProgram(ctx context.Context, db DBTX, sourceUUID string) (*domain.Program, error) {
	source, err := s.GetProgramWithTree(ctx, db, sourceUUID)
	if err != nil {
		return nil, err
	}

	cp := source.DeepCopy()

	if err := s.CreateProgram(ctx, db, cp); err != nil {
		return nil, err
	}

	for _, w := range cp.Workouts {
		w.ProgramID = cp.ID
		if err := s.CreateWorkout(ctx, db, w); err != nil {
			return nil, err
		}

		for _, sec := range w.Sections {
			sec.ProgramWorkoutID = w.ID
			if err := s.CreateSection(ctx, db, sec); err != nil {
				return nil, err
			}

			for _, se := range sec.Exercises {
				se.SectionID = sec.ID
				if err := s.CreateSectionExercise(ctx, db, se); err != nil {
					return nil, err
				}

				if se.ProgressionRule != nil {
					se.ProgressionRule.SectionExerciseID = se.ID
					if err := s.CreateProgressionRule(ctx, db, se.ProgressionRule); err != nil {
						return nil, err
					}
				}
			}
		}
	}

	return s.GetProgramWithTree(ctx, db, cp.UUID)
}

// --- Query helpers ---

func placeholders(n int) string {
	if n <= 0 {
		return ""
	}
	return strings.Repeat("?,", n-1) + "?"
}

func int64sToAny(ids []int64) []any {
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	return args
}
