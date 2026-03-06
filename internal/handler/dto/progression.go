package dto

import (
	"time"

	"compound/internal/domain"
)

// ProgressionRuleResponse is the JSON shape for progression rule resources.
type ProgressionRuleResponse struct {
	UUID            string   `json:"uuid"`
	Strategy        string   `json:"strategy"`
	Increment       *float64 `json:"increment,omitempty"`
	IncrementPct    *float64 `json:"increment_pct,omitempty"`
	DeloadThreshold int      `json:"deload_threshold"`
	DeloadPct       float64  `json:"deload_pct"`
	CreatedAt       string   `json:"created_at"`
	UpdatedAt       string   `json:"updated_at"`
}

// ToProgressionRuleResponse converts a domain ProgressionRule to the response DTO.
func ToProgressionRuleResponse(pr *domain.ProgressionRule) ProgressionRuleResponse {
	return ProgressionRuleResponse{
		UUID:            pr.UUID,
		Strategy:        string(pr.Strategy),
		Increment:       pr.Increment,
		IncrementPct:    pr.IncrementPct,
		DeloadThreshold: pr.DeloadThreshold,
		DeloadPct:       pr.DeloadPct,
		CreatedAt:       pr.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       pr.UpdatedAt.Format(time.RFC3339),
	}
}
