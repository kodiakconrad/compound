package store

import (
	"context"
	"database/sql"
	"errors"

	dbgen "compound/internal/db"
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
	limit := int64(p.Limit + 1)
	q := dbgen.New(db)

	var entries []*domain.HistoryEntry

	if p.Cursor != nil {
		rows, err := q.GetExerciseHistoryPageAfter(ctx, dbgen.GetExerciseHistoryPageAfterParams{
			Uuid:  exerciseUUID,
			ID:    *p.Cursor,
			Limit: limit,
		})
		if err != nil {
			return nil, false, err
		}
		for _, r := range rows {
			entries = append(entries, mapHistoryEntryPageAfter(r))
		}
	} else {
		rows, err := q.GetExerciseHistoryPage(ctx, dbgen.GetExerciseHistoryPageParams{
			Uuid:  exerciseUUID,
			Limit: limit,
		})
		if err != nil {
			return nil, false, err
		}
		for _, r := range rows {
			entries = append(entries, mapHistoryEntryPage(r))
		}
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
	row, err := dbgen.New(db).GetPersonalRecord(ctx, exerciseUUID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, domain.NewNotFoundError("record", exerciseUUID)
	}
	if err != nil {
		return nil, err
	}
	return mapPersonalRecord(row), nil
}

// GetProgressSummary returns aggregate stats: total completed sessions and
// current streak of consecutive completed sessions from most recent backward.
// A skipped session breaks the streak.
func (s *Store) GetProgressSummary(ctx context.Context, db DBTX) (*domain.ProgressSummary, error) {
	q := dbgen.New(db)

	total, err := q.CountCompletedSessions(ctx)
	if err != nil {
		return nil, err
	}

	statuses, err := q.ListSessionStatusNewestFirst(ctx)
	if err != nil {
		return nil, err
	}

	streak := 0
	for _, status := range statuses {
		if status == string(domain.SessionCompleted) {
			streak++
		} else {
			break // skipped session ends the streak
		}
	}

	return &domain.ProgressSummary{
		TotalSessions: total,
		CurrentStreak: streak,
	}, nil
}
