package domain

import (
	"strings"
	"time"
)

// --- Validation messages ---
// Built from the source-of-truth slices so they never drift.

// ValidTrackingTypes returns the allowed tracking type string values.
func ValidTrackingTypes() []string {
	return []string{
		string(TrackingWeightReps),
		string(TrackingBodyweightReps),
		string(TrackingDuration),
		string(TrackingDistance),
	}
}

// TrackingTypeMessage returns the validation error message for tracking_type.
func TrackingTypeMessage() string {
	return "must be one of: " + strings.Join(ValidTrackingTypes(), ", ")
}

// MuscleGroupMessage returns the validation error message for muscle_group.
func MuscleGroupMessage() string {
	return "must be one of: " + strings.Join(ValidMuscleGroups, ", ")
}

// EquipmentMessage returns the validation error message for equipment.
func EquipmentMessage() string {
	return "must be one of: " + strings.Join(ValidEquipment, ", ")
}

// --- Value Objects ---

// TrackingType determines which fields are relevant for an exercise.
type TrackingType string

const (
	TrackingWeightReps     TrackingType = "weight_reps"
	TrackingBodyweightReps TrackingType = "bodyweight_reps"
	TrackingDuration       TrackingType = "duration"
	TrackingDistance        TrackingType = "distance"
)

// IsValid returns true if t is a recognized tracking type.
func (t TrackingType) IsValid() bool {
	switch t {
	case TrackingWeightReps, TrackingBodyweightReps, TrackingDuration, TrackingDistance:
		return true
	}
	return false
}

// ValidMuscleGroups is the exhaustive list of allowed muscle group values.
var ValidMuscleGroups = []string{
	"chest", "back", "legs", "shoulders",
	"biceps", "triceps", "core", "cardio", "other",
}

// IsValidMuscleGroup checks whether s is an allowed muscle group value.
func IsValidMuscleGroup(s string) bool {
	for _, v := range ValidMuscleGroups {
		if v == s {
			return true
		}
	}
	return false
}

// ValidEquipment is the exhaustive list of allowed equipment values.
var ValidEquipment = []string{
	"barbell", "dumbbell", "cable", "machine",
	"bodyweight", "band", "kettlebell", "other",
}

// IsValidEquipment checks whether s is an allowed equipment value.
func IsValidEquipment(s string) bool {
	for _, v := range ValidEquipment {
		if v == s {
			return true
		}
	}
	return false
}

// --- Entity ---

// Exercise is a named movement that can be added to program sections
// and tracked in sessions.
type Exercise struct {
	ID           int64
	UUID         string
	Name         string
	MuscleGroup  *string
	Equipment    *string
	TrackingType TrackingType
	Notes        *string
	IsCustom     bool
	CreatedAt    time.Time
	UpdatedAt    time.Time
	DeletedAt    *time.Time
}

// Validate enforces domain business rules on an Exercise.
func (e *Exercise) Validate() error {
	if strings.TrimSpace(e.Name) == "" {
		return NewValidationError("name", "must not be empty")
	}
	if !e.TrackingType.IsValid() {
		return NewValidationError("tracking_type", TrackingTypeMessage())
	}
	if e.MuscleGroup != nil && !IsValidMuscleGroup(*e.MuscleGroup) {
		return NewValidationError("muscle_group", MuscleGroupMessage())
	}
	if e.Equipment != nil && !IsValidEquipment(*e.Equipment) {
		return NewValidationError("equipment", EquipmentMessage())
	}
	return nil
}
