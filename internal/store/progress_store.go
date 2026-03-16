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

// GetProgressSummary returns aggregate stats: total completed sessions,
// distinct weeks trained, and current consecutive session streak.
// A skipped session breaks the streak.
func (s *Store) GetProgressSummary(ctx context.Context, db DBTX) (*domain.ProgressSummary, error) {
	q := dbgen.New(db)

	total, err := q.CountCompletedSessions(ctx)
	if err != nil {
		return nil, err
	}

	weeks, err := q.CountDistinctWeeksTrained(ctx)
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
		WeeksTrained:  weeks,
		CurrentStreak: streak,
	}, nil
}

// GetAllPersonalRecords returns the heaviest eligible set for each exercise
// that has logged sets across all completed sessions.
func (s *Store) GetAllPersonalRecords(ctx context.Context, db DBTX) ([]*domain.PersonalRecordListEntry, error) {
	rows, err := dbgen.New(db).GetAllPersonalRecords(ctx)
	if err != nil {
		return nil, err
	}

	out := make([]*domain.PersonalRecordListEntry, len(rows))
	for i, r := range rows {
		out[i] = mapPersonalRecordListEntry(r)
	}
	return out, nil
}

// GetRecentSessions returns the most recently completed/skipped sessions with
// workout and program names for display.
func (s *Store) GetRecentSessions(ctx context.Context, db DBTX, limit int) ([]*domain.RecentSession, error) {
	rows, err := dbgen.New(db).GetRecentSessions(ctx, int64(limit))
	if err != nil {
		return nil, err
	}

	out := make([]*domain.RecentSession, len(rows))
	for i, r := range rows {
		out[i] = mapRecentSession(r)
	}
	return out, nil
}

// GetExerciseChartData returns chart-ready data points for a given exercise UUID.
// Each point represents the best eligible set from one completed session.
func (s *Store) GetExerciseChartData(ctx context.Context, db DBTX, exerciseUUID string) ([]*domain.ExerciseChartPoint, error) {
	rows, err := dbgen.New(db).GetExerciseChartData(ctx, exerciseUUID)
	if err != nil {
		return nil, err
	}

	out := make([]*domain.ExerciseChartPoint, len(rows))
	for i, r := range rows {
		out[i] = mapExerciseChartPoint(r)
	}
	return out, nil
}
