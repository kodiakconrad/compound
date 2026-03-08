package domain

import "time"

// HistoryEntry is one data point in an exercise's weight history.
// It represents the best (heaviest) eligible set logged in a single
// completed session. "Eligible" means actual_reps >= target_reps for
// weight_reps exercises; all sets count for other tracking types.
type HistoryEntry struct {
	SessionID   int64 // internal ID used for cursor pagination
	SessionUUID string
	CompletedAt time.Time
	Weight      float64
}

// PersonalRecord holds the heaviest eligible set ever logged for an exercise.
type PersonalRecord struct {
	Weight      float64
	ActualReps  *int
	SessionUUID string
	CompletedAt time.Time
}

// ProgressSummary holds aggregate stats for all sessions across all cycles.
type ProgressSummary struct {
	TotalSessions int64
	CurrentStreak int
}
