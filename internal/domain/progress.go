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

// PersonalRecordListEntry holds a PR for one exercise, used in the batch PR list.
type PersonalRecordListEntry struct {
	ExerciseUUID string
	ExerciseName string
	Weight       float64
	ActualReps   *int
	CompletedAt  time.Time
}

// ExerciseChartPoint is one data point for an exercise progress chart.
// Represents the best (heaviest eligible) set per completed session.
type ExerciseChartPoint struct {
	Date   string  // ISO date (YYYY-MM-DD)
	Weight float64
	Reps   int
	Volume float64 // weight * reps
}

// RecentSession is a completed or skipped session with context for display.
type RecentSession struct {
	UUID        string
	CycleUUID   string
	Status      SessionStatus
	CompletedAt *time.Time
	WorkoutName string
	ProgramName string
}

// ProgressSummary holds aggregate stats for all sessions across all cycles.
type ProgressSummary struct {
	TotalSessions int64
	WeeksTrained  int64
	CurrentStreak int
}
