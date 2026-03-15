package domain

import (
	"fmt"
	"time"
)

// CycleStatus represents the lifecycle state of a training cycle.
type CycleStatus string

const (
	CycleActive    CycleStatus = "active"
	CyclePaused    CycleStatus = "paused"
	CycleCompleted CycleStatus = "completed"
)

// IsValid returns true if s is a recognized cycle status.
func (s CycleStatus) IsValid() bool {
	switch s {
	case CycleActive, CyclePaused, CycleCompleted:
		return true
	}
	return false
}

// --- Aggregate: Cycle ---

// Cycle is an active run of a program. Created when a user starts a program.
// Sessions are pre-generated (one per ProgramWorkout) when the cycle starts.
type Cycle struct {
	ID          int64
	UUID        string
	ProgramID   int64
	ProgramName string
	Status      CycleStatus
	StartedAt   *time.Time
	CompletedAt *time.Time
	Sessions    []*Session
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// TransitionTo validates and applies a status transition on the cycle.
// Valid transitions: active→paused, paused→active, active→completed, paused→completed.
func (c *Cycle) TransitionTo(next CycleStatus) error {
	switch c.Status {
	case CycleActive:
		if next == CyclePaused || next == CycleCompleted {
			c.Status = next
			return nil
		}
	case CyclePaused:
		if next == CycleActive || next == CycleCompleted {
			c.Status = next
			return nil
		}
	case CycleCompleted:
		// Terminal state — no transitions allowed.
	}
	return NewUnprocessableError(
		fmt.Sprintf("cannot transition cycle from %q to %q", c.Status, next),
	)
}
