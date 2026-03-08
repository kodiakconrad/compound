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
	CurrentStreak int   `json:"current_streak"`
}

// ToProgressSummaryResponse converts a domain ProgressSummary to the response DTO.
func ToProgressSummaryResponse(s *domain.ProgressSummary) ProgressSummaryResponse {
	return ProgressSummaryResponse{
		TotalSessions: s.TotalSessions,
		CurrentStreak: s.CurrentStreak,
	}
}
