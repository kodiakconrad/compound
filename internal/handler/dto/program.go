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
	_ Validator = (*CreateWorkoutRequest)(nil)
	_ Validator = (*UpdateWorkoutRequest)(nil)
	_ Validator = (*CreateSectionRequest)(nil)
	_ Validator = (*UpdateSectionRequest)(nil)
	_ Validator = (*CreateSectionExerciseRequest)(nil)
	_ Validator = (*UpdateSectionExerciseRequest)(nil)
	_ Validator = (*ReorderRequest)(nil)
)

// --- Program Request DTOs ---

// CreateProgramRequest is the JSON body for POST /api/v1/programs.
type CreateProgramRequest struct {
	Name        string  `json:"name"`
	Description *string `json:"description"`
	IsTemplate  bool    `json:"is_template"`
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
		IsTemplate:  r.IsTemplate,
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

// --- Workout Request DTOs ---

// CreateWorkoutRequest is the JSON body for POST /api/v1/programs/{id}/workouts.
type CreateWorkoutRequest struct {
	Name      string `json:"name"`
	DayNumber int    `json:"day_number"`
}

// Validate checks request shape.
func (r *CreateWorkoutRequest) Validate() []FieldError {
	var errs []FieldError
	if strings.TrimSpace(r.Name) == "" {
		errs = append(errs, FieldError{Field: "name", Message: "is required"})
	}
	if r.DayNumber < 1 {
		errs = append(errs, FieldError{Field: "day_number", Message: "must be at least 1"})
	}
	return errs
}

// ToWorkout converts the request DTO to a domain ProgramWorkout.
func (r *CreateWorkoutRequest) ToWorkout() *domain.ProgramWorkout {
	return &domain.ProgramWorkout{
		Name:      strings.TrimSpace(r.Name),
		DayNumber: r.DayNumber,
	}
}

// UpdateWorkoutRequest is the JSON body for PUT /api/v1/programs/{id}/workouts/{wid}.
type UpdateWorkoutRequest struct {
	Name      *string `json:"name"`
	DayNumber *int    `json:"day_number"`
}

// Validate checks the update request shape.
func (r *UpdateWorkoutRequest) Validate() []FieldError {
	var errs []FieldError
	if r.Name != nil && strings.TrimSpace(*r.Name) == "" {
		errs = append(errs, FieldError{Field: "name", Message: "must not be empty"})
	}
	if r.DayNumber != nil && *r.DayNumber < 1 {
		errs = append(errs, FieldError{Field: "day_number", Message: "must be at least 1"})
	}
	return errs
}

// ApplyTo merges non-nil fields onto an existing ProgramWorkout.
func (r *UpdateWorkoutRequest) ApplyTo(w *domain.ProgramWorkout) {
	if r.Name != nil {
		w.Name = strings.TrimSpace(*r.Name)
	}
	if r.DayNumber != nil {
		w.DayNumber = *r.DayNumber
	}
}

// --- Section Request DTOs ---

// CreateSectionRequest is the JSON body for POST .../sections.
type CreateSectionRequest struct {
	Name        string `json:"name"`
	RestSeconds *int   `json:"rest_seconds"`
}

// Validate checks request shape.
func (r *CreateSectionRequest) Validate() []FieldError {
	var errs []FieldError
	if strings.TrimSpace(r.Name) == "" {
		errs = append(errs, FieldError{Field: "name", Message: "is required"})
	}
	return errs
}

// ToSection converts the request DTO to a domain Section.
func (r *CreateSectionRequest) ToSection() *domain.Section {
	return &domain.Section{
		Name:        strings.TrimSpace(r.Name),
		RestSeconds: r.RestSeconds,
	}
}

// UpdateSectionRequest is the JSON body for PUT .../sections/{sid}.
type UpdateSectionRequest struct {
	Name        *string `json:"name"`
	RestSeconds *int    `json:"rest_seconds"`
}

// Validate checks the update request shape.
func (r *UpdateSectionRequest) Validate() []FieldError {
	var errs []FieldError
	if r.Name != nil && strings.TrimSpace(*r.Name) == "" {
		errs = append(errs, FieldError{Field: "name", Message: "must not be empty"})
	}
	return errs
}

// ApplyTo merges non-nil fields onto an existing Section.
func (r *UpdateSectionRequest) ApplyTo(s *domain.Section) {
	if r.Name != nil {
		s.Name = strings.TrimSpace(*r.Name)
	}
	if r.RestSeconds != nil {
		s.RestSeconds = r.RestSeconds
	}
}

// --- Section Exercise Request DTOs ---

// CreateSectionExerciseRequest is the JSON body for POST .../exercises.
type CreateSectionExerciseRequest struct {
	ExerciseUUID   string   `json:"exercise_uuid"`
	TargetSets     *int     `json:"target_sets"`
	TargetReps     *int     `json:"target_reps"`
	TargetWeight   *float64 `json:"target_weight"`
	TargetDuration *int     `json:"target_duration"`
	TargetDistance *float64  `json:"target_distance"`
	Notes          *string  `json:"notes"`
}

// Validate checks request shape.
func (r *CreateSectionExerciseRequest) Validate() []FieldError {
	var errs []FieldError
	if strings.TrimSpace(r.ExerciseUUID) == "" {
		errs = append(errs, FieldError{Field: "exercise_uuid", Message: "is required"})
	}
	return errs
}

// UpdateSectionExerciseRequest is the JSON body for PUT .../exercises/{eid}.
type UpdateSectionExerciseRequest struct {
	TargetSets     *int     `json:"target_sets"`
	TargetReps     *int     `json:"target_reps"`
	TargetWeight   *float64 `json:"target_weight"`
	TargetDuration *int     `json:"target_duration"`
	TargetDistance *float64  `json:"target_distance"`
	Notes          *string  `json:"notes"`
}

// Validate checks the update request shape.
func (r *UpdateSectionExerciseRequest) Validate() []FieldError {
	return nil
}

// ApplyTo merges non-nil fields onto an existing SectionExercise.
func (r *UpdateSectionExerciseRequest) ApplyTo(se *domain.SectionExercise) {
	if r.TargetSets != nil {
		se.TargetSets = r.TargetSets
	}
	if r.TargetReps != nil {
		se.TargetReps = r.TargetReps
	}
	if r.TargetWeight != nil {
		se.TargetWeight = r.TargetWeight
	}
	if r.TargetDuration != nil {
		se.TargetDuration = r.TargetDuration
	}
	if r.TargetDistance != nil {
		se.TargetDistance = r.TargetDistance
	}
	if r.Notes != nil {
		se.Notes = r.Notes
	}
}

// --- Reorder Request ---

// ReorderRequest is the JSON body for PUT .../reorder endpoints.
type ReorderRequest struct {
	UUIDs []string `json:"uuids"`
}

// Validate checks request shape.
func (r *ReorderRequest) Validate() []FieldError {
	if len(r.UUIDs) == 0 {
		return []FieldError{{Field: "uuids", Message: "must not be empty"}}
	}
	return nil
}

// --- Response DTOs ---

// ProgramResponse is the flat JSON shape for program metadata (list items, create, update).
type ProgramResponse struct {
	UUID        string  `json:"uuid"`
	Name        string  `json:"name"`
	Description *string `json:"description,omitempty"`
	IsTemplate  bool    `json:"is_template"`
	IsPrebuilt  bool    `json:"is_prebuilt"`
	CreatedAt   string  `json:"created_at"`
	UpdatedAt   string  `json:"updated_at"`
}

// ProgramTreeResponse is the full tree JSON shape for GET program and copy.
type ProgramTreeResponse struct {
	UUID        string                `json:"uuid"`
	Name        string                `json:"name"`
	Description *string               `json:"description,omitempty"`
	IsTemplate  bool                  `json:"is_template"`
	IsPrebuilt  bool                  `json:"is_prebuilt"`
	Workouts    []WorkoutTreeResponse `json:"workouts"`
	CreatedAt   string                `json:"created_at"`
	UpdatedAt   string                `json:"updated_at"`
}

// WorkoutResponse is the flat JSON shape for individual workout operations.
type WorkoutResponse struct {
	UUID      string `json:"uuid"`
	Name      string `json:"name"`
	DayNumber int    `json:"day_number"`
	SortOrder int    `json:"sort_order"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// WorkoutTreeResponse is the nested JSON shape within a program tree.
type WorkoutTreeResponse struct {
	UUID      string                `json:"uuid"`
	Name      string                `json:"name"`
	DayNumber int                   `json:"day_number"`
	SortOrder int                   `json:"sort_order"`
	Sections  []SectionTreeResponse `json:"sections"`
	CreatedAt string                `json:"created_at"`
	UpdatedAt string                `json:"updated_at"`
}

// SectionResponse is the flat JSON shape for individual section operations.
type SectionResponse struct {
	UUID        string `json:"uuid"`
	Name        string `json:"name"`
	SortOrder   int    `json:"sort_order"`
	RestSeconds *int   `json:"rest_seconds,omitempty"`
	CreatedAt   string `json:"created_at"`
	UpdatedAt   string `json:"updated_at"`
}

// SectionTreeResponse is the nested JSON shape within a workout tree.
type SectionTreeResponse struct {
	UUID        string                    `json:"uuid"`
	Name        string                    `json:"name"`
	SortOrder   int                       `json:"sort_order"`
	RestSeconds *int                      `json:"rest_seconds,omitempty"`
	Exercises   []SectionExerciseResponse `json:"exercises"`
	CreatedAt   string                    `json:"created_at"`
	UpdatedAt   string                    `json:"updated_at"`
}

// SectionExerciseResponse is the JSON shape for section exercise resources.
type SectionExerciseResponse struct {
	UUID            string                   `json:"uuid"`
	ExerciseUUID    string                   `json:"exercise_uuid"`
	ExerciseName    string                   `json:"exercise_name"`
	TargetSets      *int                     `json:"target_sets,omitempty"`
	TargetReps      *int                     `json:"target_reps,omitempty"`
	TargetWeight    *float64                 `json:"target_weight,omitempty"`
	TargetDuration  *int                     `json:"target_duration,omitempty"`
	TargetDistance  *float64                  `json:"target_distance,omitempty"`
	SortOrder       int                      `json:"sort_order"`
	Notes           *string                  `json:"notes,omitempty"`
	ProgressionRule *ProgressionRuleResponse `json:"progression_rule,omitempty"`
	CreatedAt       string                   `json:"created_at"`
	UpdatedAt       string                   `json:"updated_at"`
}

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

// --- Conversion functions ---

// ToProgramResponse converts a domain Program to the flat response DTO.
func ToProgramResponse(p *domain.Program) ProgramResponse {
	return ProgramResponse{
		UUID:        p.UUID,
		Name:        p.Name,
		Description: p.Description,
		IsTemplate:  p.IsTemplate,
		IsPrebuilt:  p.IsPrebuilt,
		CreatedAt:   p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   p.UpdatedAt.Format(time.RFC3339),
	}
}

// ToProgramListResponse converts a slice of domain Programs to flat response DTOs.
func ToProgramListResponse(programs []*domain.Program) []ProgramResponse {
	resp := make([]ProgramResponse, len(programs))
	for i, p := range programs {
		resp[i] = ToProgramResponse(p)
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
		IsTemplate:  p.IsTemplate,
		IsPrebuilt:  p.IsPrebuilt,
		Workouts:    workouts,
		CreatedAt:   p.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   p.UpdatedAt.Format(time.RFC3339),
	}
}

// ToWorkoutResponse converts a domain ProgramWorkout to the flat response DTO.
func ToWorkoutResponse(w *domain.ProgramWorkout) WorkoutResponse {
	return WorkoutResponse{
		UUID:      w.UUID,
		Name:      w.Name,
		DayNumber: w.DayNumber,
		SortOrder: w.SortOrder,
		CreatedAt: w.CreatedAt.Format(time.RFC3339),
		UpdatedAt: w.UpdatedAt.Format(time.RFC3339),
	}
}

// ToSectionResponse converts a domain Section to the flat response DTO.
func ToSectionResponse(s *domain.Section) SectionResponse {
	return SectionResponse{
		UUID:        s.UUID,
		Name:        s.Name,
		SortOrder:   s.SortOrder,
		RestSeconds: s.RestSeconds,
		CreatedAt:   s.CreatedAt.Format(time.RFC3339),
		UpdatedAt:   s.UpdatedAt.Format(time.RFC3339),
	}
}

// ToSectionExerciseResponse converts a domain SectionExercise to the response DTO.
func ToSectionExerciseResponse(se *domain.SectionExercise) SectionExerciseResponse {
	resp := SectionExerciseResponse{
		UUID:           se.UUID,
		ExerciseUUID:   se.ExerciseUUID,
		ExerciseName:   se.ExerciseName,
		TargetSets:     se.TargetSets,
		TargetReps:     se.TargetReps,
		TargetWeight:   se.TargetWeight,
		TargetDuration: se.TargetDuration,
		TargetDistance: se.TargetDistance,
		SortOrder:      se.SortOrder,
		Notes:          se.Notes,
		CreatedAt:      se.CreatedAt.Format(time.RFC3339),
		UpdatedAt:      se.UpdatedAt.Format(time.RFC3339),
	}
	if se.ProgressionRule != nil {
		pr := ToProgressionRuleResponse(se.ProgressionRule)
		resp.ProgressionRule = &pr
	}
	return resp
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
