package domain

import (
	"strings"
	"time"
)

// ProgressionStrategy determines how target weight changes between sessions.
type ProgressionStrategy string

const (
	ProgressionLinear     ProgressionStrategy = "linear"
	ProgressionPercentage ProgressionStrategy = "percentage"
	ProgressionWave       ProgressionStrategy = "wave"
)

// IsValid returns true if s is a recognized progression strategy.
func (s ProgressionStrategy) IsValid() bool {
	switch s {
	case ProgressionLinear, ProgressionPercentage, ProgressionWave:
		return true
	}
	return false
}

// ValidProgressionStrategies returns the allowed strategy string values.
func ValidProgressionStrategies() []string {
	return []string{
		string(ProgressionLinear),
		string(ProgressionPercentage),
		string(ProgressionWave),
	}
}

// ProgressionStrategyMessage returns the validation error message for strategy.
func ProgressionStrategyMessage() string {
	return "must be one of: " + strings.Join(ValidProgressionStrategies(), ", ")
}

// ProgressionRule defines how target weight changes between sessions for a section exercise.
type ProgressionRule struct {
	ID                int64
	UUID              string
	SectionExerciseID int64
	Strategy          ProgressionStrategy
	Increment         *float64
	IncrementPct      *float64
	DeloadThreshold   int
	DeloadPct         float64
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// Validate enforces domain business rules on a ProgressionRule.
func (r *ProgressionRule) Validate() error {
	if !r.Strategy.IsValid() {
		return NewValidationError("strategy", ProgressionStrategyMessage())
	}
	if r.Strategy == ProgressionLinear && (r.Increment == nil || *r.Increment <= 0) {
		return NewValidationError("increment", "is required and must be positive for linear strategy")
	}
	if r.Strategy == ProgressionPercentage && (r.IncrementPct == nil || *r.IncrementPct <= 0) {
		return NewValidationError("increment_pct", "is required and must be positive for percentage strategy")
	}
	if r.DeloadThreshold < 1 {
		return NewValidationError("deload_threshold", "must be at least 1")
	}
	if r.DeloadPct < 0 || r.DeloadPct > 100 {
		return NewValidationError("deload_pct", "must be between 0 and 100")
	}
	return nil
}

// NextWeight calculates the target weight for the next session based on the
// current weight, the number of consecutive failures, and the progression rule.
func (r *ProgressionRule) NextWeight(current float64, consecutiveFailures int) float64 {
	if consecutiveFailures >= r.DeloadThreshold {
		return current * (1 - r.DeloadPct/100)
	}
	if consecutiveFailures > 0 {
		return current // hold weight on failure below deload threshold
	}
	switch r.Strategy {
	case ProgressionLinear:
		return current + *r.Increment
	case ProgressionPercentage:
		return current * (1 + *r.IncrementPct/100)
	case ProgressionWave:
		// Wave loading deferred — seeded 5/3/1 programs use static target weights.
		return current
	}
	return current
}
