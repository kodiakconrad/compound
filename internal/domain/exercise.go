package domain

import (
	"strings"
	"time"
)

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
		return NewValidationError("tracking_type",
			"must be one of: weight_reps, bodyweight_reps, duration, distance")
	}
	if e.MuscleGroup != nil && !IsValidMuscleGroup(*e.MuscleGroup) {
		return NewValidationError("muscle_group",
			"must be one of: chest, back, legs, shoulders, biceps, triceps, core, cardio, other")
	}
	if e.Equipment != nil && !IsValidEquipment(*e.Equipment) {
		return NewValidationError("equipment",
			"must be one of: barbell, dumbbell, cable, machine, bodyweight, band, kettlebell, other")
	}
	return nil
}
