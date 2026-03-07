package store

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"compound/internal/domain"
)

// HistoryParams controls pagination for GetExerciseHistory.
type HistoryParams struct {
	Limit  int
	Cursor *int64 // session integer ID — newest-first cursor
}

// GetExerciseHistory returns the best eligible set per completed session for
// the given exercise UUID, ordered newest first.
//
// "Eligible" means: actual_reps >= target_reps for weight_reps exercises.
// Sets with no target_reps (ad-hoc, non-rep tracking types) are always included.
func (s *Store) GetExerciseHistory(ctx context.Context, db DBTX, exerciseUUID string, p HistoryParams) ([]*domain.HistoryEntry, bool, error) {
	var conditions []string
	var args []any

	conditions = append(conditions, "e.uuid = ?")
	args = append(args, exerciseUUID)

	conditions = append(conditions, "s.status = 'completed'")
	conditions = append(conditions, "sl.weight IS NOT NULL")
	conditions = append(conditions, "(sl.target_reps IS NULL OR sl.actual_reps >= sl.target_reps)")

	if p.Cursor != nil {
		conditions = append(conditions, "s.id < ?")
		args = append(args, *p.Cursor)
	}

	where := strings.Join(conditions, " AND ")
	query := fmt.Sprintf(
		`SELECT s.id, s.uuid, s.completed_at, MAX(sl.weight) AS weight
		 FROM set_logs sl
		 JOIN sessions s ON s.id = sl.session_id
		 JOIN exercises e ON e.id = sl.exercise_id
		 WHERE %s
		 GROUP BY sl.session_id, s.id, s.uuid, s.completed_at
		 ORDER BY s.completed_at DESC, s.id DESC
		 LIMIT ?`,
		where,
	)
	args = append(args, p.Limit+1)

	rows, err := db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()

	var entries []*domain.HistoryEntry
	for rows.Next() {
		var sessionID int64
		var sessionUUID string
		var completedAt *time.Time
		var weight float64
		if err := rows.Scan(&sessionID, &sessionUUID, &completedAt, &weight); err != nil {
			return nil, false, err
		}
		entries = append(entries, &domain.HistoryEntry{
			SessionID:   sessionID,
			SessionUUID: sessionUUID,
			CompletedAt: derefTime(completedAt),
			Weight:      weight,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}

	hasMore := len(entries) > p.Limit
	if hasMore {
		entries = entries[:p.Limit]
	}
	return entries, hasMore, nil
}

// GetPersonalRecord returns the heaviest eligible set ever logged for an exercise.
// Returns domain.NotFoundError if no eligible sets have been logged.
func (s *Store) GetPersonalRecord(ctx context.Context, db DBTX, exerciseUUID string) (*domain.PersonalRecord, error) {
	var sessionUUID string
	var completedAt *time.Time
	var weight float64
	var actualReps *int64

	err := db.QueryRowContext(ctx,
		`SELECT sl.weight, sl.actual_reps, s.uuid, s.completed_at
		 FROM set_logs sl
		 JOIN sessions s ON s.id = sl.session_id
		 JOIN exercises e ON e.id = sl.exercise_id
		 WHERE e.uuid = ?
		   AND s.status = 'completed'
		   AND sl.weight IS NOT NULL
		   AND (sl.target_reps IS NULL OR sl.actual_reps >= sl.target_reps)
		 ORDER BY sl.weight DESC, s.completed_at DESC
		 LIMIT 1`,
		exerciseUUID,
	).Scan(&weight, &actualReps, &sessionUUID, &completedAt)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.NewNotFoundError("record", exerciseUUID)
	}
	if err != nil {
		return nil, err
	}

	pr := &domain.PersonalRecord{
		Weight:      weight,
		SessionUUID: sessionUUID,
		CompletedAt: derefTime(completedAt),
	}
	if actualReps != nil {
		v := int(*actualReps)
		pr.ActualReps = &v
	}
	return pr, nil
}

// GetProgressSummary returns aggregate stats: total completed sessions and
// current streak of consecutive completed sessions from most recent backward.
// A skipped session breaks the streak.
func (s *Store) GetProgressSummary(ctx context.Context, db DBTX) (*domain.ProgressSummary, error) {
	var total int64
	if err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM sessions WHERE status = 'completed'`,
	).Scan(&total); err != nil {
		return nil, err
	}

	// Walk completed/skipped sessions newest-first to compute streak.
	rows, err := db.QueryContext(ctx,
		`SELECT status FROM sessions
		 WHERE status IN ('completed', 'skipped')
		 ORDER BY updated_at DESC, id DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	streak := 0
	for rows.Next() {
		var status string
		if err := rows.Scan(&status); err != nil {
			return nil, err
		}
		if status == string(domain.SessionCompleted) {
			streak++
		} else {
			break // skipped session ends the streak
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &domain.ProgressSummary{
		TotalSessions: total,
		CurrentStreak: streak,
	}, nil
}

// derefTime dereferences a *time.Time safely, returning zero value if nil.
func derefTime(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return *t
}
