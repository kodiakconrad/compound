package domain

import (
	"fmt"
	"time"
)

// --- Value Objects ---

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

// SessionStatus represents the lifecycle state of a single session.
type SessionStatus string

const (
	SessionPending    SessionStatus = "pending"
	SessionInProgress SessionStatus = "in_progress"
	SessionCompleted  SessionStatus = "completed"
	SessionSkipped    SessionStatus = "skipped"
)

// IsValid returns true if s is a recognized session status.
func (s SessionStatus) IsValid() bool {
	switch s {
	case SessionPending, SessionInProgress, SessionCompleted, SessionSkipped:
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

// --- Entity: Session ---

// Session is a single workout instance within a cycle.
type Session struct {
	ID               int64
	UUID             string
	CycleID          int64
	ProgramWorkoutID int64
	SortOrder        int
	Status           SessionStatus
	StartedAt        *time.Time
	CompletedAt      *time.Time
	Notes            *string
	SetLogs          []*SetLog
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// Start transitions a session from pending to in_progress.
func (s *Session) Start() error {
	if s.Status != SessionPending {
		return NewUnprocessableError(
			fmt.Sprintf("cannot start session with status %q", s.Status),
		)
	}
	now := time.Now().UTC()
	s.Status = SessionInProgress
	s.StartedAt = &now
	return nil
}

// Complete transitions a session from in_progress to completed.
func (s *Session) Complete(notes *string) error {
	if s.Status != SessionInProgress {
		return NewUnprocessableError(
			fmt.Sprintf("cannot complete session with status %q", s.Status),
		)
	}
	now := time.Now().UTC()
	s.Status = SessionCompleted
	s.CompletedAt = &now
	s.Notes = notes
	return nil
}

// Skip transitions a session from pending or in_progress to skipped.
func (s *Session) Skip(notes *string) error {
	if s.Status != SessionPending && s.Status != SessionInProgress {
		return NewUnprocessableError(
			fmt.Sprintf("cannot skip session with status %q", s.Status),
		)
	}
	s.Status = SessionSkipped
	s.Notes = notes
	return nil
}

// --- Entity: SetLog ---

// SetLog records an actual set performed during a session.
// set_logs are append-only — no UpdatedAt field.
type SetLog struct {
	ID                int64
	UUID              string
	SessionID         int64
	ExerciseID        int64
	SectionExerciseID *int64
	SetNumber         int
	TargetReps        *int
	ActualReps        *int
	Weight            *float64
	Duration          *int
	Distance          *float64
	RPE               *float64
	CompletedAt       time.Time
	CreatedAt         time.Time
}

// --- Read Models ---

// SessionDetail is a flattened read-model returned by GET /sessions/{id}.
// It nests sections → exercises with computed target weights and any
// set_logs already recorded for this session.
type SessionDetail struct {
	UUID             string
	CycleID          int64
	ProgramWorkoutID int64
	SortOrder        int
	Status           SessionStatus
	StartedAt        *time.Time
	CompletedAt      *time.Time
	Notes            *string
	Sections         []*SessionDetailSection
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// SessionDetailSection is one section within a SessionDetail.
type SessionDetailSection struct {
	UUID        string
	Name        string
	SortOrder   int
	RestSeconds *int
	Exercises   []*SessionDetailExercise
}

// SessionDetailExercise is one exercise row within a SessionDetailSection.
// ComputedTargetWeight is nil when no ProgressionRule exists (falls back to
// the static SectionExercise.TargetWeight).
type SessionDetailExercise struct {
	SectionExerciseUUID  string
	ExerciseUUID         string
	ExerciseName         string
	TargetSets           *int
	TargetReps           *int
	StaticTargetWeight   *float64 // from section_exercises.target_weight
	ComputedTargetWeight *float64 // from progression rule + set_log history
	TargetDuration       *int
	TargetDistance       *float64
	SortOrder            int
	Notes                *string
	SetLogs              []*SetLog
}
