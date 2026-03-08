package domain

import (
	"strings"
	"time"

	"github.com/google/uuid"
)

// Program is a multi-day workout plan. Prebuilt programs (IsPrebuilt=true) are
// seeded content that is read-only. All other programs are user-created and editable.
type Program struct {
	ID          int64
	UUID        string
	Name        string
	Description *string
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
// The copy is always a user program (IsPrebuilt=false).
func (p *Program) DeepCopy() *Program {
	now := time.Now().UTC()

	cp := &Program{
		UUID:        uuid.NewString(),
		Name:        p.Name + " (Copy)",
		Description: copyStringPtr(p.Description),
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

// --- Copy helpers (used by DeepCopy) ---

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
