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

	q := dbgen.New(db)
	workoutRows, err := q.GetWorkoutsForProgram(ctx, p.ID)
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

	sectionRows, err := q.GetSectionsByWorkoutIDs(ctx, workoutIDs)
	if err != nil {
		return nil, err
	}

	var sectionIDs []int64
	sectionMap := make(map[int64]*domain.Section)
	for _, sr := range sectionRows {
		sec := mapSection(sr)
		if w, ok := workoutMap[sec.ProgramWorkoutID]; ok {
			w.Sections = append(w.Sections, sec)
		}
		sectionIDs = append(sectionIDs, sec.ID)
		sectionMap[sec.ID] = sec
	}

	if len(sectionIDs) == 0 {
		return p, nil
	}

	seRows, err := q.GetSectionExercisesWithExerciseBySectionIDs(ctx, sectionIDs)
	if err != nil {
		return nil, err
	}

	var seIDs []int64
	seMap := make(map[int64]*domain.SectionExercise)
	for _, sr := range seRows {
		se := mapSectionExerciseWithExercise(sr)
		if sec, ok := sectionMap[se.SectionID]; ok {
			sec.Exercises = append(sec.Exercises, se)
		}
		seIDs = append(seIDs, se.ID)
		seMap[se.ID] = se
	}

	if len(seIDs) == 0 {
		return p, nil
	}

	prRows, err := q.GetProgressionRulesBySectionExerciseIDs(ctx, seIDs)
	if err != nil {
		return nil, err
	}
	for _, pr := range prRows {
		if se, ok := seMap[pr.SectionExerciseID]; ok {
			se.ProgressionRule = mapProgressionRule(pr)
		}
	}

	return p, nil
}

// ProgramListParams holds filter/sort/pagination options for listing programs.
type ProgramListParams struct {
	IsPrebuilt *bool
	Sort       string
	Order      string
	Limit      int
	Cursor     *int64
}

func (s *Store) ListPrograms(ctx context.Context, db DBTX, p ProgramListParams) ([]*domain.Program, bool, error) {
	var conditions []string
	var args []any

	conditions = append(conditions, "p.deleted_at IS NULL")

	if p.IsPrebuilt != nil {
		conditions = append(conditions, "p.is_prebuilt = ?")
		args = append(args, *p.IsPrebuilt)
	}
	if p.Cursor != nil {
		conditions = append(conditions, "p.id > ?")
		args = append(args, *p.Cursor)
	}

	sortCol := "p.updated_at"
	if p.Sort == "name" {
		sortCol = "p.name"
	}
	order := "DESC"
	if strings.EqualFold(p.Order, "asc") {
		order = "ASC"
	}

	query := fmt.Sprintf(
		`SELECT p.id, p.uuid, p.name, p.description, p.is_prebuilt,
		        p.created_at, p.updated_at,
		        COUNT(w.id) AS workout_count
		 FROM programs p
		 LEFT JOIN program_workouts w ON w.program_id = p.id
		 WHERE %s
		 GROUP BY p.id
		 ORDER BY %s %s, p.id ASC
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
		var isPrebuilt bool
		var createdAt, updatedAt time.Time

		if err := rows.Scan(
			&prog.ID, &prog.UUID, &prog.Name, &description,
			&isPrebuilt, &createdAt, &updatedAt, &prog.WorkoutCount,
		); err != nil {
			return nil, false, err
		}
		prog.Description = description
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

