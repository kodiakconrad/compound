package dto

import (
	"time"

	"compound/internal/domain"
)

// --- History ---

// HistoryEntryResponse is one entry in an exercise's weight history.
type HistoryEntryResponse struct {
	SessionUUID string  `json:"session_uuid"`
	CompletedAt string  `json:"completed_at"`
	Weight      float64 `json:"weight"`
}

// ToHistoryEntryResponse converts a domain HistoryEntry to the response DTO.
func ToHistoryEntryResponse(e *domain.HistoryEntry) HistoryEntryResponse {
	return HistoryEntryResponse{
		SessionUUID: e.SessionUUID,
		CompletedAt: e.CompletedAt.Format(time.RFC3339),
		Weight:      e.Weight,
	}
}

// ToHistoryEntryList converts a slice of domain HistoryEntry to response DTOs.
func ToHistoryEntryList(entries []*domain.HistoryEntry) []HistoryEntryResponse {
	out := make([]HistoryEntryResponse, len(entries))
	for i, e := range entries {
		out[i] = ToHistoryEntryResponse(e)
	}
	return out
}

// --- Personal record ---

// PersonalRecordResponse is the heaviest eligible set for an exercise.
type PersonalRecordResponse struct {
	Weight      float64 `json:"weight"`
	ActualReps  *int    `json:"actual_reps,omitempty"`
	SessionUUID string  `json:"session_uuid"`
	CompletedAt string  `json:"completed_at"`
}

// ToPersonalRecordResponse converts a domain PersonalRecord to the response DTO.
func ToPersonalRecordResponse(pr *domain.PersonalRecord) PersonalRecordResponse {
	return PersonalRecordResponse{
		Weight:      pr.Weight,
		ActualReps:  pr.ActualReps,
		SessionUUID: pr.SessionUUID,
		CompletedAt: pr.CompletedAt.Format(time.RFC3339),
	}
}

// --- Summary ---

// ProgressSummaryResponse holds aggregate session statistics.
type ProgressSummaryResponse struct {
	TotalSessions int64 `json:"total_sessions"`
	WeeksTrained  int64 `json:"weeks_trained"`
	CurrentStreak int   `json:"current_streak"`
}

// ToProgressSummaryResponse converts a domain ProgressSummary to the response DTO.
func ToProgressSummaryResponse(s *domain.ProgressSummary) ProgressSummaryResponse {
	return ProgressSummaryResponse{
		TotalSessions: s.TotalSessions,
		WeeksTrained:  s.WeeksTrained,
		CurrentStreak: s.CurrentStreak,
	}
}

// --- Recent Sessions ---

// RecentSessionResponse is one item in the recent sessions list.
type RecentSessionResponse struct {
	UUID        string  `json:"uuid"`
	CycleUUID   string  `json:"cycle_uuid"`
	Status      string  `json:"status"`
	CompletedAt *string `json:"completed_at,omitempty"`
	WorkoutName string  `json:"workout_name"`
	ProgramName string  `json:"program_name"`
}

// ToRecentSessionResponse converts a domain RecentSession to the response DTO.
func ToRecentSessionResponse(s *domain.RecentSession) RecentSessionResponse {
	r := RecentSessionResponse{
		UUID:        s.UUID,
		CycleUUID:   s.CycleUUID,
		Status:      string(s.Status),
		WorkoutName: s.WorkoutName,
		ProgramName: s.ProgramName,
	}
	if s.CompletedAt != nil {
		t := s.CompletedAt.Format(time.RFC3339)
		r.CompletedAt = &t
	}
	return r
}

// ToRecentSessionListResponse converts a slice of domain RecentSession to response DTOs.
func ToRecentSessionListResponse(sessions []*domain.RecentSession) []RecentSessionResponse {
	out := make([]RecentSessionResponse, len(sessions))
	for i, s := range sessions {
		out[i] = ToRecentSessionResponse(s)
	}
	return out
}

// --- Batch Personal Records ---

// PersonalRecordListEntryResponse is one exercise's PR in the batch list.
type PersonalRecordListEntryResponse struct {
	ExerciseUUID string  `json:"exercise_uuid"`
	ExerciseName string  `json:"exercise_name"`
	Weight       float64 `json:"weight"`
	ActualReps   *int    `json:"actual_reps,omitempty"`
	CompletedAt  string  `json:"completed_at"`
}

// ToPersonalRecordListEntryResponse converts a domain PersonalRecordListEntry to the response DTO.
func ToPersonalRecordListEntryResponse(e *domain.PersonalRecordListEntry) PersonalRecordListEntryResponse {
	return PersonalRecordListEntryResponse{
		ExerciseUUID: e.ExerciseUUID,
		ExerciseName: e.ExerciseName,
		Weight:       e.Weight,
		ActualReps:   e.ActualReps,
		CompletedAt:  e.CompletedAt.Format(time.RFC3339),
	}
}

// ToPersonalRecordListResponse converts a slice of domain entries to response DTOs.
func ToPersonalRecordListResponse(entries []*domain.PersonalRecordListEntry) []PersonalRecordListEntryResponse {
	out := make([]PersonalRecordListEntryResponse, len(entries))
	for i, e := range entries {
		out[i] = ToPersonalRecordListEntryResponse(e)
	}
	return out
}

// --- Exercise Chart ---

// ExerciseChartPointResponse is one data point for an exercise progress chart.
type ExerciseChartPointResponse struct {
	Date   string  `json:"date"`
	Weight float64 `json:"weight"`
	Reps   int     `json:"reps"`
	Volume float64 `json:"volume"`
}

// ToExerciseChartPointResponse converts a domain ExerciseChartPoint to the response DTO.
func ToExerciseChartPointResponse(p *domain.ExerciseChartPoint) ExerciseChartPointResponse {
	return ExerciseChartPointResponse{
		Date:   p.Date,
		Weight: p.Weight,
		Reps:   p.Reps,
		Volume: p.Volume,
	}
}

// ToExerciseChartResponse converts a slice of domain chart points to response DTOs.
func ToExerciseChartResponse(points []*domain.ExerciseChartPoint) []ExerciseChartPointResponse {
	out := make([]ExerciseChartPointResponse, len(points))
	for i, p := range points {
		out[i] = ToExerciseChartPointResponse(p)
	}
	return out
}
