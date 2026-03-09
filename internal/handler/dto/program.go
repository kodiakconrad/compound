package dto

import (
	"strings"
	"time"

	"compound/internal/domain"
)

// Compile-time interface checks.
var (
	_ Validator = (*CreateProgramRequest)(nil)
	_ Validator = (*UpdateProgramRequest)(nil)
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
	UUID         string `json:"uuid"`
	Name         string `json:"name"`
	IsPrebuilt   bool   `json:"is_prebuilt"`
	WorkoutCount int    `json:"workout_count"`
	UpdatedAt    string `json:"updated_at"`
}

// ProgramTreeResponse is the full tree JSON shape for GET program and copy.
type ProgramTreeResponse struct {
	UUID        string                `json:"uuid"`
	Name        string                `json:"name"`
	Description *string               `json:"description,omitempty"`
	IsPrebuilt  bool                  `json:"is_prebuilt"`
	Workouts    []WorkoutTreeResponse `json:"workouts"`
	CreatedAt   string                `json:"created_at"`
	UpdatedAt   string                `json:"updated_at"`
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
		UUID:         p.UUID,
		Name:         p.Name,
		IsPrebuilt:   p.IsPrebuilt,
		WorkoutCount: p.WorkoutCount,
		UpdatedAt:    p.UpdatedAt.Format(time.RFC3339),
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
		UUID:        p.UUID,
		Name:        p.Name,
		Description: p.Description,
		IsPrebuilt:  p.IsPrebuilt,
		Workouts:    workouts,
		CreatedAt:   p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   p.UpdatedAt.Format(time.RFC3339),
	}
}
