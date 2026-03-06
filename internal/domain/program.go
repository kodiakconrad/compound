package domain

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// --- Value Objects ---

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

// --- Entities ---

// Program is a multi-day workout plan. Templates are programs with IsTemplate=true.
type Program struct {
	ID          int64
	UUID        string
	Name        string
	Description *string
	IsTemplate  bool
	IsPrebuilt  bool
	Workouts    []*ProgramWorkout
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   *time.Time
}

// Validate enforces domain business rules on a Program.
func (p *Program) Validate() error {
	if strings.TrimSpace(p.Name) == "" {
		return NewValidationError("name", "must not be empty")
	}
	return nil
}

// HasDayNumber checks if dayNumber conflicts with the given existing day numbers.
// Returns ConflictError if a duplicate is found.
func (p *Program) HasDayNumber(dayNumber int, existingDayNumbers []int) error {
	for _, dn := range existingDayNumbers {
		if dn == dayNumber {
			return NewConflictError("day_number already exists in this program")
		}
	}
	return nil
}

// DeepCopy creates a fully independent copy of the program and its entire tree.
// All nodes get new UUIDs and fresh timestamps. IDs are zeroed (assigned on insert).
// The copy is always a regular program (IsTemplate=false, IsPrebuilt=false).
func (p *Program) DeepCopy() *Program {
	now := time.Now().UTC()

	cp := &Program{
		UUID:        uuid.NewString(),
		Name:        p.Name + " (Copy)",
		Description: copyStringPtr(p.Description),
		IsTemplate:  false,
		IsPrebuilt:  false,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	for _, w := range p.Workouts {
		cw := &ProgramWorkout{
			UUID:      uuid.NewString(),
			Name:      w.Name,
			DayNumber: w.DayNumber,
			SortOrder: w.SortOrder,
			CreatedAt: now,
			UpdatedAt: now,
		}

		for _, s := range w.Sections {
			cs := &Section{
				UUID:        uuid.NewString(),
				Name:        s.Name,
				SortOrder:   s.SortOrder,
				RestSeconds: copyIntPtr(s.RestSeconds),
				CreatedAt:   now,
				UpdatedAt:   now,
			}

			for _, se := range s.Exercises {
				cse := &SectionExercise{
					UUID:           uuid.NewString(),
					ExerciseID:     se.ExerciseID,
					TargetSets:     copyIntPtr(se.TargetSets),
					TargetReps:     copyIntPtr(se.TargetReps),
					TargetWeight:   copyFloat64Ptr(se.TargetWeight),
					TargetDuration: copyIntPtr(se.TargetDuration),
					TargetDistance: copyFloat64Ptr(se.TargetDistance),
					SortOrder:      se.SortOrder,
					Notes:          copyStringPtr(se.Notes),
					CreatedAt:      now,
					UpdatedAt:      now,
				}

				if se.ProgressionRule != nil {
					cse.ProgressionRule = &ProgressionRule{
						UUID:            uuid.NewString(),
						Strategy:        se.ProgressionRule.Strategy,
						Increment:       copyFloat64Ptr(se.ProgressionRule.Increment),
						IncrementPct:    copyFloat64Ptr(se.ProgressionRule.IncrementPct),
						DeloadThreshold: se.ProgressionRule.DeloadThreshold,
						DeloadPct:       se.ProgressionRule.DeloadPct,
						CreatedAt:       now,
						UpdatedAt:       now,
					}
				}

				cs.Exercises = append(cs.Exercises, cse)
			}

			cw.Sections = append(cw.Sections, cs)
		}

		cp.Workouts = append(cp.Workouts, cw)
	}

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
	ID              int64
	UUID            string
	SectionID       int64
	ExerciseID      int64
	TargetSets      *int
	TargetReps      *int
	TargetWeight    *float64
	TargetDuration  *int
	TargetDistance   *float64
	SortOrder       int
	Notes           *string
	ProgressionRule *ProgressionRule
	CreatedAt       time.Time
	UpdatedAt       time.Time

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

// --- Copy helpers ---

func copyStringPtr(s *string) *string {
	if s == nil {
		return nil
	}
	v := *s
	return &v
}

func copyIntPtr(i *int) *int {
	if i == nil {
		return nil
	}
	v := *i
	return &v
}

func copyFloat64Ptr(f *float64) *float64 {
	if f == nil {
		return nil
	}
	v := *f
	return &v
}
