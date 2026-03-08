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

// CreateCycle starts a new cycle for the given program and pre-generates
// one session per workout. All writes are performed within the caller's db/tx.
func (s *Store) CreateCycle(ctx context.Context, db DBTX, programID int64, workouts []*domain.ProgramWorkout) (*domain.Cycle, error) {
	if len(workouts) == 0 {
		return nil, domain.NewUnprocessableError("program has no workouts; cannot start a cycle")
	}

	now := time.Now().UTC()
	cycleUUID := uuid.NewString()
	q := dbgen.New(db)

	result, err := q.InsertCycle(ctx, dbgen.InsertCycleParams{
		Uuid:      cycleUUID,
		ProgramID: programID,
		Status:    string(domain.CycleActive),
		StartedAt: &now,
		CreatedAt: now,
		UpdatedAt: now,
	})
	if err != nil {
		return nil, err
	}
	cycleID, _ := result.LastInsertId()

	for _, w := range workouts {
		sessUUID := uuid.NewString()
		_, err := q.InsertSession(ctx, dbgen.InsertSessionParams{
			Uuid:             sessUUID,
			CycleID:          cycleID,
			ProgramWorkoutID: w.ID,
			SortOrder:        int64(w.SortOrder),
			Status:           string(domain.SessionPending),
			CreatedAt:        now,
			UpdatedAt:        now,
		})
		if err != nil {
			return nil, err
		}
	}

	return s.GetCycleWithSessions(ctx, db, cycleUUID)
}

// GetCycleByUUID returns a cycle by UUID without its sessions.
func (s *Store) GetCycleByUUID(ctx context.Context, db DBTX, id string) (*domain.Cycle, error) {
	row, err := dbgen.New(db).GetCycleByUUID(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.NewNotFoundError("cycle", id)
	}
	if err != nil {
		return nil, err
	}
	return mapCycle(row), nil
}

// GetCycleWithSessions returns a cycle with its pre-generated sessions.
func (s *Store) GetCycleWithSessions(ctx context.Context, db DBTX, id string) (*domain.Cycle, error) {
	c, err := s.GetCycleByUUID(ctx, db, id)
	if err != nil {
		return nil, err
	}
	sessionRows, err := dbgen.New(db).GetSessionsByCycleID(ctx, c.ID)
	if err != nil {
		return nil, err
	}
	for _, sr := range sessionRows {
		c.Sessions = append(c.Sessions, mapSession(sr))
	}
	return c, nil
}

// CycleListParams holds filter/pagination options for listing cycles.
type CycleListParams struct {
	Status *domain.CycleStatus
	Limit  int
	Cursor *int64
}

// ListCycles returns a paginated list of cycles, newest first.
// Optional status filter narrows results.
func (s *Store) ListCycles(ctx context.Context, db DBTX, p CycleListParams) ([]*domain.Cycle, bool, error) {
	var conditions []string
	var args []any

	if p.Status != nil {
		conditions = append(conditions, "status = ?")
		args = append(args, string(*p.Status))
	}
	if p.Cursor != nil {
		conditions = append(conditions, "id < ?")
		args = append(args, *p.Cursor)
	}

	where := "1=1"
	if len(conditions) > 0 {
		where = strings.Join(conditions, " AND ")
	}

	query := fmt.Sprintf(
		`SELECT id, uuid, program_id, status, started_at, completed_at, created_at, updated_at
		 FROM cycles
		 WHERE %s
		 ORDER BY id DESC
		 LIMIT ?`,
		where,
	)
	args = append(args, p.Limit+1)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()

	var cycles []*domain.Cycle
	for rows.Next() {
		var c domain.Cycle
		var statusStr string
		var startedAt, completedAt *time.Time
		if err := rows.Scan(
			&c.ID, &c.UUID, &c.ProgramID, &statusStr,
			&startedAt, &completedAt,
			&c.CreatedAt, &c.UpdatedAt,
		); err != nil {
			return nil, false, err
		}
		c.Status = domain.CycleStatus(statusStr)
		c.StartedAt = startedAt
		c.CompletedAt = completedAt
		cycles = append(cycles, &c)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}

	hasMore := len(cycles) > p.Limit
	if hasMore {
		cycles = cycles[:p.Limit]
	}
	return cycles, hasMore, nil
}

// UpdateCycleStatus validates and applies a CycleStatus transition, then persists it.
func (s *Store) UpdateCycleStatus(ctx context.Context, db DBTX, id string, newStatus domain.CycleStatus) (*domain.Cycle, error) {
	c, err := s.GetCycleByUUID(ctx, db, id)
	if err != nil {
		return nil, err
	}
	if err := c.TransitionTo(newStatus); err != nil {
		return nil, err
	}

	now := time.Now().UTC()
	var completedAt *time.Time
	if newStatus == domain.CycleCompleted {
		completedAt = &now
	} else {
		completedAt = c.CompletedAt
	}

	_, err = dbgen.New(db).UpdateCycle(ctx, dbgen.UpdateCycleParams{
		Status:      string(c.Status),
		CompletedAt: completedAt,
		UpdatedAt:   now,
		Uuid:        id,
	})
	if err != nil {
		return nil, err
	}
	c.UpdatedAt = now
	c.CompletedAt = completedAt
	return c, nil
}

// AutoCompleteCycleByID transitions a cycle to completed by its internal ID.
// Used when the last session in a cycle is completed or skipped.
func (s *Store) AutoCompleteCycleByID(ctx context.Context, db DBTX, cycleID int64) error {
	now := time.Now().UTC()
	_, err := dbgen.New(db).AutoCompleteCycle(ctx, dbgen.AutoCompleteCycleParams{
		CompletedAt: &now,
		UpdatedAt:   now,
		ID:          cycleID,
	})
	return err
}
