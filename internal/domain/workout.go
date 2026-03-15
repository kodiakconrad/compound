package domain

import (
	"fmt"
	"strings"
	"time"
)

// ---------------------------------------------------------------------------
// Set Scheme — per-set targets for progression schemes (Pyramid, 5/3/1, Drop Set).
// ---------------------------------------------------------------------------

// SetSchemeType enumerates the supported progression scheme types.
type SetSchemeType string

const (
	SetSchemePyramid SetSchemeType = "pyramid"
	SetScheme531     SetSchemeType = "531"
	SetSchemeDropSet SetSchemeType = "dropset"
)

// SchemeSet is one set within a set scheme — its target reps and weight.
type SchemeSet struct {
	Reps   int     `json:"reps"`
	Weight float64 `json:"weight"`
}

// SetScheme defines per-set targets for progression schemes.
// Stored as JSON in the database but represented as a typed struct in Go.
type SetScheme struct {
	Type          SetSchemeType `json:"type"`
	Sets          []SchemeSet   `json:"sets"`
	OneRepMax     *float64      `json:"one_rep_max,omitempty"`
	WorkingWeight *float64      `json:"working_weight,omitempty"`
	Week          *int          `json:"week,omitempty"`
}

// Validate enforces domain rules on a SetScheme.
func (ss *SetScheme) Validate() error {
	switch ss.Type {
	case SetSchemePyramid, SetScheme531, SetSchemeDropSet:
		// valid
	default:
		return NewValidationError("set_scheme.type", fmt.Sprintf("unknown scheme type %q", ss.Type))
	}

	if len(ss.Sets) == 0 {
		return NewValidationError("set_scheme.sets", "must have at least one set")
	}

	for i, s := range ss.Sets {
		if s.Reps < 1 {
			return NewValidationError(
				fmt.Sprintf("set_scheme.sets[%d].reps", i), "must be at least 1",
			)
		}
		if s.Weight < 0 {
			return NewValidationError(
				fmt.Sprintf("set_scheme.sets[%d].weight", i), "must not be negative",
			)
		}
	}

	if ss.Type == SetScheme531 {
		if ss.Week == nil {
			return NewValidationError("set_scheme.week", "is required for 5/3/1 schemes")
		}
		if *ss.Week < 1 || *ss.Week > 3 {
			return NewValidationError("set_scheme.week", "must be 1, 2, or 3")
		}
	}

	return nil
}

// DeepCopy creates an independent copy of the SetScheme.
func (ss *SetScheme) DeepCopy() *SetScheme {
	if ss == nil {
		return nil
	}
	cp := &SetScheme{
		Type:          ss.Type,
		Sets:          make([]SchemeSet, len(ss.Sets)),
		OneRepMax:     copyFloat64Ptr(ss.OneRepMax),
		WorkingWeight: copyFloat64Ptr(ss.WorkingWeight),
		Week:          copyIntPtr(ss.Week),
	}
	copy(cp.Sets, ss.Sets)
	return cp
}

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
	SetScheme      *SetScheme
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
		se.TargetDuration == nil && se.TargetDistance == nil && se.SetScheme == nil {
		return NewValidationError("targets", "at least one target field or set_scheme must be set")
	}
	if se.SetScheme != nil {
		if err := se.SetScheme.Validate(); err != nil {
			return err
		}
	}
	return nil
}
