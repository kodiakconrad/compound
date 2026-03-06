package domain

import (
	"strings"
	"time"
)

// ProgramWorkout is one day's workout within a program.
type ProgramWorkout struct {
	ID        int64
	UUID      string
	ProgramID int64
	Name      string
	DayNumber int
	SortOrder int
	Sections  []*Section
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Validate enforces domain business rules on a ProgramWorkout.
func (w *ProgramWorkout) Validate() error {
	if strings.TrimSpace(w.Name) == "" {
		return NewValidationError("name", "must not be empty")
	}
	if w.DayNumber < 1 {
		return NewValidationError("day_number", "must be at least 1")
	}
	return nil
}

// Section is a movement group within a workout (e.g., compound, isolation, burnout).
type Section struct {
	ID               int64
	UUID             string
	ProgramWorkoutID int64
	Name             string
	SortOrder        int
	RestSeconds      *int
	Exercises        []*SectionExercise
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// Validate enforces domain business rules on a Section.
func (s *Section) Validate() error {
	if strings.TrimSpace(s.Name) == "" {
		return NewValidationError("name", "must not be empty")
	}
	return nil
}

// SectionExercise is a single exercise placed in a section with target parameters.
type SectionExercise struct {
	ID             int64
	UUID           string
	SectionID      int64
	ExerciseID     int64
	TargetSets     *int
	TargetReps     *int
	TargetWeight   *float64
	TargetDuration *int
	TargetDistance *float64
	SortOrder      int
	Notes          *string
	ProgressionRule *ProgressionRule
	CreatedAt      time.Time
	UpdatedAt      time.Time

	// Denormalized read-only fields, populated by GetProgramWithTree.
	ExerciseUUID string
	ExerciseName string
}

// Validate enforces domain business rules on a SectionExercise.
func (se *SectionExercise) Validate() error {
	if se.ExerciseID <= 0 {
		return NewValidationError("exercise_id", "is required")
	}
	if se.TargetSets == nil && se.TargetReps == nil && se.TargetWeight == nil &&
		se.TargetDuration == nil && se.TargetDistance == nil {
		return NewValidationError("targets", "at least one target field must be set")
	}
	return nil
}
