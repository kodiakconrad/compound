package dto

import (
	"strings"
	"time"

	"compound/internal/domain"
)

// --- Request DTOs ---

// CreateExerciseRequest is the JSON body for POST /api/v1/exercises.
type CreateExerciseRequest struct {
	Name         string  `json:"name"`
	MuscleGroup  *string `json:"muscle_group"`
	Equipment    *string `json:"equipment"`
	TrackingType string  `json:"tracking_type"`
	Notes        *string `json:"notes"`
}

// Validate checks request shape and returns all field errors at once.
func (r *CreateExerciseRequest) Validate() []FieldError {
	var errs []FieldError
	if strings.TrimSpace(r.Name) == "" {
		errs = append(errs, FieldError{Field: "name", Message: "is required"})
	}
	if r.TrackingType != "" && !domain.TrackingType(r.TrackingType).IsValid() {
		errs = append(errs, FieldError{Field: "tracking_type",
			Message: "must be one of: weight_reps, bodyweight_reps, duration, distance"})
	}
	if r.MuscleGroup != nil && !domain.IsValidMuscleGroup(*r.MuscleGroup) {
		errs = append(errs, FieldError{Field: "muscle_group",
			Message: "must be one of: chest, back, legs, shoulders, biceps, triceps, core, cardio, other"})
	}
	if r.Equipment != nil && !domain.IsValidEquipment(*r.Equipment) {
		errs = append(errs, FieldError{Field: "equipment",
			Message: "must be one of: barbell, dumbbell, cable, machine, bodyweight, band, kettlebell, other"})
	}
	return errs
}

// ToExercise converts the request DTO to a domain Exercise.
func (r *CreateExerciseRequest) ToExercise() *domain.Exercise {
	trackingType := domain.TrackingWeightReps
	if r.TrackingType != "" {
		trackingType = domain.TrackingType(r.TrackingType)
	}
	return &domain.Exercise{
		Name:         strings.TrimSpace(r.Name),
		MuscleGroup:  r.MuscleGroup,
		Equipment:    r.Equipment,
		TrackingType: trackingType,
		Notes:        r.Notes,
		IsCustom:     true, // POST always creates custom exercises.
	}
}

// UpdateExerciseRequest is the JSON body for PUT /api/v1/exercises/{id}.
// All fields are pointers to support partial updates — nil means "don't change".
type UpdateExerciseRequest struct {
	Name         *string `json:"name"`
	MuscleGroup  *string `json:"muscle_group"`
	Equipment    *string `json:"equipment"`
	TrackingType *string `json:"tracking_type"`
	Notes        *string `json:"notes"`
}

// Validate checks the update request shape.
func (r *UpdateExerciseRequest) Validate() []FieldError {
	var errs []FieldError
	if r.Name != nil && strings.TrimSpace(*r.Name) == "" {
		errs = append(errs, FieldError{Field: "name", Message: "must not be empty"})
	}
	if r.TrackingType != nil && !domain.TrackingType(*r.TrackingType).IsValid() {
		errs = append(errs, FieldError{Field: "tracking_type",
			Message: "must be one of: weight_reps, bodyweight_reps, duration, distance"})
	}
	if r.MuscleGroup != nil && !domain.IsValidMuscleGroup(*r.MuscleGroup) {
		errs = append(errs, FieldError{Field: "muscle_group",
			Message: "must be one of: chest, back, legs, shoulders, biceps, triceps, core, cardio, other"})
	}
	if r.Equipment != nil && !domain.IsValidEquipment(*r.Equipment) {
		errs = append(errs, FieldError{Field: "equipment",
			Message: "must be one of: barbell, dumbbell, cable, machine, bodyweight, band, kettlebell, other"})
	}
	return errs
}

// ApplyTo merges non-nil fields from the update request onto an existing Exercise.
func (r *UpdateExerciseRequest) ApplyTo(e *domain.Exercise) {
	if r.Name != nil {
		e.Name = strings.TrimSpace(*r.Name)
	}
	if r.MuscleGroup != nil {
		e.MuscleGroup = r.MuscleGroup
	}
	if r.Equipment != nil {
		e.Equipment = r.Equipment
	}
	if r.TrackingType != nil {
		e.TrackingType = domain.TrackingType(*r.TrackingType)
	}
	if r.Notes != nil {
		e.Notes = r.Notes
	}
}

// --- Response DTO ---

// ExerciseResponse is the JSON shape returned for exercise endpoints.
type ExerciseResponse struct {
	UUID         string  `json:"uuid"`
	Name         string  `json:"name"`
	MuscleGroup  *string `json:"muscle_group,omitempty"`
	Equipment    *string `json:"equipment,omitempty"`
	TrackingType string  `json:"tracking_type"`
	Notes        *string `json:"notes,omitempty"`
	IsCustom     bool    `json:"is_custom"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

// ToExerciseResponse converts a domain Exercise to the response DTO.
func ToExerciseResponse(e *domain.Exercise) ExerciseResponse {
	return ExerciseResponse{
		UUID:         e.UUID,
		Name:         e.Name,
		MuscleGroup:  e.MuscleGroup,
		Equipment:    e.Equipment,
		TrackingType: string(e.TrackingType),
		Notes:        e.Notes,
		IsCustom:     e.IsCustom,
		CreatedAt:    e.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    e.UpdatedAt.Format(time.RFC3339),
	}
}

// ToExerciseListResponse converts a slice of domain Exercises.
func ToExerciseListResponse(exercises []*domain.Exercise) []ExerciseResponse {
	resp := make([]ExerciseResponse, len(exercises))
	for i, e := range exercises {
		resp[i] = ToExerciseResponse(e)
	}
	return resp
}
