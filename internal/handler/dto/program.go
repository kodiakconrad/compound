package dto

import (
	"fmt"
	"strings"
	"time"

	"compound/internal/domain"

	"github.com/google/uuid"
)

// Compile-time interface checks.
var (
	_ Validator = (*CreateProgramRequest)(nil)
	_ Validator = (*UpdateProgramRequest)(nil)
	_ Validator = (*ScaffoldProgramRequest)(nil)
)

// CreateProgramRequest is the JSON body for POST /api/v1/programs.
type CreateProgramRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
}

// Validate checks request shape.
func (r *CreateProgramRequest) Validate() []FieldError {
	var errs []FieldError
	if strings.TrimSpace(r.Name) == "" {
		errs = append(errs, FieldError{Field: "name", Message: "is required"})
	}
	return errs
}

// ToProgram converts the request DTO to a domain Program.
func (r *CreateProgramRequest) ToProgram() *domain.Program {
	return &domain.Program{
		Name:        strings.TrimSpace(r.Name),
		Description: r.Description,
	}
}

// UpdateProgramRequest is the JSON body for PUT /api/v1/programs/{id}.
type UpdateProgramRequest struct {
	Name        *string `json:"name"`
	Description *string `json:"description"`
}

// Validate checks the update request shape.
func (r *UpdateProgramRequest) Validate() []FieldError {
	var errs []FieldError
	if r.Name != nil && strings.TrimSpace(*r.Name) == "" {
		errs = append(errs, FieldError{Field: "name", Message: "must not be empty"})
	}
	return errs
}

// ApplyTo merges non-nil fields onto an existing Program.
func (r *UpdateProgramRequest) ApplyTo(p *domain.Program) {
	if r.Name != nil {
		p.Name = strings.TrimSpace(*r.Name)
	}
	if r.Description != nil {
		p.Description = r.Description
	}
}

// ProgramResponse is the flat JSON shape for program metadata (create, update).
type ProgramResponse struct {
	UUID        string  `json:"uuid"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	IsPrebuilt  bool    `json:"is_prebuilt"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

// ProgramListItemResponse is the summary shape for GET /api/v1/programs list items.
// Full tree is only returned by GET /api/v1/programs/{id}.
type ProgramListItemResponse struct {
	UUID           string `json:"uuid"`
	Name           string `json:"name"`
	IsPrebuilt     bool   `json:"is_prebuilt"`
	WorkoutCount   int    `json:"workout_count"`
	HasActiveCycle bool   `json:"has_active_cycle"`
	UpdatedAt      string `json:"updated_at"`
}

// ProgramTreeResponse is the full tree JSON shape for GET program and copy.
type ProgramTreeResponse struct {
	UUID           string                `json:"uuid"`
	Name           string                `json:"name"`
	Description    *string               `json:"description,omitempty"`
	IsPrebuilt     bool                  `json:"is_prebuilt"`
	HasActiveCycle bool                  `json:"has_active_cycle"`
	Workouts       []WorkoutTreeResponse `json:"workouts"`
	CreatedAt      string                `json:"created_at"`
	UpdatedAt      string                `json:"updated_at"`
}

// ToProgramResponse converts a domain Program to the flat response DTO.
func ToProgramResponse(p *domain.Program) ProgramResponse {
	return ProgramResponse{
		UUID:        p.UUID,
		Name:        p.Name,
		Description: p.Description,
		IsPrebuilt:  p.IsPrebuilt,
		CreatedAt:   p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   p.UpdatedAt.Format(time.RFC3339),
	}
}

// ToProgramListItemResponse converts a domain Program to the list summary DTO.
func ToProgramListItemResponse(p *domain.Program) ProgramListItemResponse {
	return ProgramListItemResponse{
		UUID:           p.UUID,
		Name:           p.Name,
		IsPrebuilt:     p.IsPrebuilt,
		WorkoutCount:   p.WorkoutCount,
		HasActiveCycle: p.HasActiveCycle,
		UpdatedAt:      p.UpdatedAt.Format(time.RFC3339),
	}
}

// ToProgramListResponse converts a slice of domain Programs to list summary DTOs.
func ToProgramListResponse(programs []*domain.Program) []ProgramListItemResponse {
	resp := make([]ProgramListItemResponse, len(programs))
	for i, p := range programs {
		resp[i] = ToProgramListItemResponse(p)
	}
	return resp
}

// ScaffoldProgramRequest is the JSON body for POST /api/v1/programs/scaffold.
// It creates a program with pre-defined workouts and sections in a single request.
type ScaffoldProgramRequest struct {
	Name     string            `json:"name"`
	Workouts []ScaffoldWorkout `json:"workouts"`
}

// ScaffoldWorkout defines one workout within a scaffold request.
type ScaffoldWorkout struct {
	Name      string            `json:"name"`
	DayNumber int               `json:"day_number"`
	Sections  []ScaffoldSection `json:"sections"`
}

// ScaffoldSection defines one section within a scaffold workout.
type ScaffoldSection struct {
	Name      string             `json:"name"`
	Exercises []ScaffoldExercise `json:"exercises,omitempty"`
}

// ScaffoldExercise defines one exercise to add to a scaffolded section.
type ScaffoldExercise struct {
	ExerciseUUID string            `json:"exercise_uuid"`
	TargetSets   *int              `json:"target_sets"`
	TargetReps   *int              `json:"target_reps"`
	TargetWeight *float64          `json:"target_weight"`
	SetScheme    *domain.SetScheme `json:"set_scheme,omitempty"`
}

// Validate checks the scaffold request shape.
func (r *ScaffoldProgramRequest) Validate() []FieldError {
	var errs []FieldError
	if strings.TrimSpace(r.Name) == "" {
		errs = append(errs, FieldError{Field: "name", Message: "is required"})
	}
	if len(r.Workouts) == 0 {
		errs = append(errs, FieldError{Field: "workouts", Message: "must have at least one workout"})
	}
	for i, w := range r.Workouts {
		prefix := fmt.Sprintf("workouts[%d]", i)
		if strings.TrimSpace(w.Name) == "" {
			errs = append(errs, FieldError{Field: prefix + ".name", Message: "is required"})
		}
		if w.DayNumber < 1 {
			errs = append(errs, FieldError{Field: prefix + ".day_number", Message: "must be at least 1"})
		}
		if len(w.Sections) == 0 {
			errs = append(errs, FieldError{Field: prefix + ".sections", Message: "must have at least one section"})
		}
		for j, sec := range w.Sections {
			secPrefix := fmt.Sprintf("%s.sections[%d]", prefix, j)
			if strings.TrimSpace(sec.Name) == "" {
				errs = append(errs, FieldError{Field: secPrefix + ".name", Message: "is required"})
			}
			for k, ex := range sec.Exercises {
				exPrefix := fmt.Sprintf("%s.exercises[%d]", secPrefix, k)
				if strings.TrimSpace(ex.ExerciseUUID) == "" {
					errs = append(errs, FieldError{Field: exPrefix + ".exercise_uuid", Message: "is required"})
				}
				if ex.SetScheme != nil {
					if err := ex.SetScheme.Validate(); err != nil {
						errs = append(errs, FieldError{Field: exPrefix + ".set_scheme", Message: err.Error()})
					}
				}
			}
		}
	}
	return errs
}

// ToProgram converts the scaffold request into a domain Program tree.
// Each struct gets a fresh UUID and timestamp; integer IDs are zero (set by store on insert).
func (r *ScaffoldProgramRequest) ToProgram() *domain.Program {
	now := time.Now().UTC()
	p := &domain.Program{
		UUID:      uuid.NewString(),
		Name:      strings.TrimSpace(r.Name),
		CreatedAt: now,
		UpdatedAt: now,
	}
	for _, sw := range r.Workouts {
		w := &domain.ProgramWorkout{
			UUID:      uuid.NewString(),
			Name:      strings.TrimSpace(sw.Name),
			DayNumber: sw.DayNumber,
			CreatedAt: now,
			UpdatedAt: now,
		}
		for j, ss := range sw.Sections {
			sec := &domain.Section{
				UUID:      uuid.NewString(),
				Name:      strings.TrimSpace(ss.Name),
				SortOrder: j + 1,
				CreatedAt: now,
				UpdatedAt: now,
			}
			for k, se := range ss.Exercises {
				sec.Exercises = append(sec.Exercises, &domain.SectionExercise{
					UUID:         uuid.NewString(),
					ExerciseUUID: se.ExerciseUUID,
					TargetSets:   se.TargetSets,
					TargetReps:   se.TargetReps,
					TargetWeight: se.TargetWeight,
					SetScheme:    se.SetScheme,
					SortOrder:    k + 1,
					CreatedAt:    now,
					UpdatedAt:    now,
				})
			}
			w.Sections = append(w.Sections, sec)
		}
		p.Workouts = append(p.Workouts, w)
	}
	return p
}

// ToProgramTreeResponse converts a domain Program with its full tree to the tree DTO.
func ToProgramTreeResponse(p *domain.Program) ProgramTreeResponse {
	workouts := make([]WorkoutTreeResponse, len(p.Workouts))
	for i, w := range p.Workouts {
		sections := make([]SectionTreeResponse, len(w.Sections))
		for j, s := range w.Sections {
			exercises := make([]SectionExerciseResponse, len(s.Exercises))
			for k, se := range s.Exercises {
				exercises[k] = ToSectionExerciseResponse(se)
			}
			sections[j] = SectionTreeResponse{
				UUID:        s.UUID,
				Name:        s.Name,
				SortOrder:   s.SortOrder,
				RestSeconds: s.RestSeconds,
				Exercises:   exercises,
				CreatedAt:   s.CreatedAt.Format(time.RFC3339),
				UpdatedAt:   s.UpdatedAt.Format(time.RFC3339),
			}
		}
		workouts[i] = WorkoutTreeResponse{
			UUID:      w.UUID,
			Name:      w.Name,
			DayNumber: w.DayNumber,
			SortOrder: w.SortOrder,
			Sections:  sections,
			CreatedAt: w.CreatedAt.Format(time.RFC3339),
			UpdatedAt: w.UpdatedAt.Format(time.RFC3339),
		}
	}

	return ProgramTreeResponse{
		UUID:           p.UUID,
		Name:           p.Name,
		Description:    p.Description,
		IsPrebuilt:     p.IsPrebuilt,
		HasActiveCycle: p.HasActiveCycle,
		Workouts:       workouts,
		CreatedAt:      p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      p.UpdatedAt.Format(time.RFC3339),
	}
}
