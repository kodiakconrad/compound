package store

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"compound/internal/domain"

	"github.com/google/uuid"
)

// --- Program CRUD ---

// CreateProgram inserts a new program. UUID and timestamps are generated
// automatically. The program's ID, UUID, CreatedAt, and UpdatedAt fields
// are populated on return.
func (s *Store) CreateProgram(ctx context.Context, db DBTX, p *domain.Program) error {
	p.UUID = uuid.NewString()
	now := time.Now().UTC()
	p.CreatedAt = now
	p.UpdatedAt = now

	result, err := db.ExecContext(ctx,
		`INSERT INTO programs (uuid, name, description, is_template, is_prebuilt, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		p.UUID, p.Name, p.Description,
		boolToInt(p.IsTemplate), boolToInt(p.IsPrebuilt),
		p.CreatedAt.Format(time.RFC3339), p.UpdatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return err
	}
	id, _ := result.LastInsertId()
	p.ID = id
	return nil
}

// GetProgramByUUID retrieves a single non-deleted program by UUID (metadata only, no tree).
func (s *Store) GetProgramByUUID(ctx context.Context, db DBTX, id string) (*domain.Program, error) {
	row := db.QueryRowContext(ctx,
		`SELECT id, uuid, name, description, is_template, is_prebuilt,
		        created_at, updated_at
		 FROM programs
		 WHERE uuid = ? AND deleted_at IS NULL`, id)

	p, err := scanProgram(row)
	if err != nil {
		return nil, domain.NewNotFoundError("program", id)
	}
	return p, nil
}

// GetProgramInternalID resolves a program UUID to its integer ID.
func (s *Store) GetProgramInternalID(ctx context.Context, db DBTX, id string) (int64, error) {
	var programID int64
	err := db.QueryRowContext(ctx,
		`SELECT id FROM programs WHERE uuid = ? AND deleted_at IS NULL`, id,
	).Scan(&programID)
	if err != nil {
		return 0, domain.NewNotFoundError("program", id)
	}
	return programID, nil
}

// GetProgramWithTree retrieves a program with its full tree (workouts → sections →
// section_exercises → progression_rules) using sequential queries assembled in memory.
func (s *Store) GetProgramWithTree(ctx context.Context, db DBTX, id string) (*domain.Program, error) {
	// 1. Load program.
	p, err := s.GetProgramByUUID(ctx, db, id)
	if err != nil {
		return nil, err
	}

	// 2. Load workouts.
	wRows, err := db.QueryContext(ctx,
		`SELECT id, uuid, program_id, name, day_number, sort_order, created_at, updated_at
		 FROM program_workouts
		 WHERE program_id = ?
		 ORDER BY sort_order`, p.ID)
	if err != nil {
		return nil, err
	}
	defer wRows.Close()

	var workoutIDs []int64
	workoutMap := make(map[int64]*domain.ProgramWorkout)
	for wRows.Next() {
		w, err := scanProgramWorkoutRows(wRows)
		if err != nil {
			return nil, err
		}
		p.Workouts = append(p.Workouts, w)
		workoutIDs = append(workoutIDs, w.ID)
		workoutMap[w.ID] = w
	}
	if err := wRows.Err(); err != nil {
		return nil, err
	}

	if len(workoutIDs) == 0 {
		return p, nil
	}

	// 3. Load sections.
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
		sec, err := scanSectionRows(sRows)
		if err != nil {
			return nil, err
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

	// 4. Load section exercises (with exercise name/uuid via JOIN).
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
		se, err := scanSectionExerciseWithExerciseRows(seRows)
		if err != nil {
			return nil, err
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

	// 5. Load progression rules.
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
		pr, err := scanProgressionRuleRows(prRows)
		if err != nil {
			return nil, err
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
	Sort       string // "name" or "updated_at" (default: "updated_at")
	Order      string // "asc" or "desc" (default: "desc")
	Limit      int
	Cursor     *int64
}

// ListPrograms returns paginated, filtered programs (metadata only).
func (s *Store) ListPrograms(ctx context.Context, db DBTX, p ProgramListParams) ([]*domain.Program, bool, error) {
	var conditions []string
	var args []any

	conditions = append(conditions, "deleted_at IS NULL")

	if p.IsTemplate != nil {
		conditions = append(conditions, "is_template = ?")
		args = append(args, boolToInt(*p.IsTemplate))
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
		prog, err := scanProgramRows(rows)
		if err != nil {
			return nil, false, err
		}
		programs = append(programs, prog)
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

// UpdateProgram updates a non-deleted program's metadata by UUID.
func (s *Store) UpdateProgram(ctx context.Context, db DBTX, id string, p *domain.Program) error {
	now := time.Now().UTC()
	p.UpdatedAt = now

	result, err := db.ExecContext(ctx,
		`UPDATE programs
		 SET name = ?, description = ?, updated_at = ?
		 WHERE uuid = ? AND deleted_at IS NULL`,
		p.Name, p.Description, p.UpdatedAt.Format(time.RFC3339), id,
	)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("program", id)
	}
	return nil
}

// DeleteProgram soft-deletes a non-deleted program by UUID.
func (s *Store) DeleteProgram(ctx context.Context, db DBTX, id string) error {
	now := time.Now().UTC()
	result, err := db.ExecContext(ctx,
		`UPDATE programs SET deleted_at = ?, updated_at = ?
		 WHERE uuid = ? AND deleted_at IS NULL`,
		now.Format(time.RFC3339), now.Format(time.RFC3339), id,
	)
	if err != nil {
		return err
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return domain.NewNotFoundError("program", id)
	}
	return nil
}

// HasActiveCycle returns true if the program has at least one active cycle.
func (s *Store) HasActiveCycle(ctx context.Context, db DBTX, programID int64) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM cycles WHERE program_id = ? AND status = 'active'`,
		programID,
	).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// CopyProgram deep copies a program (or template) into a new independent program.
// Must be called inside a transaction.
func (s *Store) CopyProgram(ctx context.Context, db DBTX, sourceUUID string) (*domain.Program, error) {
	// Load source with full tree.
	source, err := s.GetProgramWithTree(ctx, db, sourceUUID)
	if err != nil {
		return nil, err
	}

	// Create domain-level copy.
	cp := source.DeepCopy()

	// Insert program.
	if err := s.CreateProgram(ctx, db, cp); err != nil {
		return nil, err
	}

	// Insert workouts.
	for _, w := range cp.Workouts {
		w.ProgramID = cp.ID
		if err := s.CreateWorkout(ctx, db, w); err != nil {
			return nil, err
		}

		// Insert sections.
		for _, sec := range w.Sections {
			sec.ProgramWorkoutID = w.ID
			if err := s.CreateSection(ctx, db, sec); err != nil {
				return nil, err
			}

			// Insert section exercises.
			for _, se := range sec.Exercises {
				se.SectionID = sec.ID
				if err := s.CreateSectionExercise(ctx, db, se); err != nil {
					return nil, err
				}

				// Insert progression rule.
				if se.ProgressionRule != nil {
					se.ProgressionRule.SectionExerciseID = se.ID
					if err := s.CreateProgressionRule(ctx, db, se.ProgressionRule); err != nil {
						return nil, err
					}
				}
			}
		}
	}

	// Re-load the full tree for the response.
	return s.GetProgramWithTree(ctx, db, cp.UUID)
}

// --- Scan helpers ---

func scanProgram(row *sql.Row) (*domain.Program, error) {
	var p domain.Program
	var description sql.NullString
	var isTemplate, isPrebuilt int
	var createdAt, updatedAt string

	err := row.Scan(
		&p.ID, &p.UUID, &p.Name, &description,
		&isTemplate, &isPrebuilt, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	populateProgram(&p, description, isTemplate, isPrebuilt, createdAt, updatedAt)
	return &p, nil
}

func scanProgramRows(rows *sql.Rows) (*domain.Program, error) {
	var p domain.Program
	var description sql.NullString
	var isTemplate, isPrebuilt int
	var createdAt, updatedAt string

	err := rows.Scan(
		&p.ID, &p.UUID, &p.Name, &description,
		&isTemplate, &isPrebuilt, &createdAt, &updatedAt,
	)
	if err != nil {
		return nil, err
	}

	populateProgram(&p, description, isTemplate, isPrebuilt, createdAt, updatedAt)
	return &p, nil
}

func populateProgram(p *domain.Program, description sql.NullString, isTemplate, isPrebuilt int, createdAt, updatedAt string) {
	p.IsTemplate = isTemplate == 1
	p.IsPrebuilt = isPrebuilt == 1
	if description.Valid {
		p.Description = &description.String
	}
	p.CreatedAt, _ = time.Parse(time.RFC3339, createdAt)
	p.UpdatedAt, _ = time.Parse(time.RFC3339, updatedAt)
}

// --- Query helpers ---

// placeholders returns a comma-separated string of "?" placeholders.
func placeholders(n int) string {
	if n <= 0 {
		return ""
	}
	return strings.Repeat("?,", n-1) + "?"
}

// int64sToAny converts a slice of int64 to []any for use with QueryContext.
func int64sToAny(ids []int64) []any {
	args := make([]any, len(ids))
	for i, id := range ids {
		args[i] = id
	}
	return args
}
