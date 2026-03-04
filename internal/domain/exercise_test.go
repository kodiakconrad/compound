package domain

import (
	"errors"
	"testing"
)

func TestExercise_Validate(t *testing.T) {
	mg := "chest"
	eq := "barbell"

	tests := []struct {
		name     string
		ex       Exercise
		wantErr  bool
		errField string
	}{
		{
			name: "valid exercise with all fields",
			ex: Exercise{
				Name: "Bench Press", TrackingType: TrackingWeightReps,
				MuscleGroup: &mg, Equipment: &eq,
			},
		},
		{
			name: "valid exercise minimal fields",
			ex:   Exercise{Name: "Squat", TrackingType: TrackingWeightReps},
		},
		{
			name:     "empty name",
			ex:       Exercise{Name: "", TrackingType: TrackingWeightReps},
			wantErr:  true,
			errField: "name",
		},
		{
			name:     "whitespace only name",
			ex:       Exercise{Name: "   ", TrackingType: TrackingWeightReps},
			wantErr:  true,
			errField: "name",
		},
		{
			name:     "invalid tracking type",
			ex:       Exercise{Name: "Squat", TrackingType: "invalid"},
			wantErr:  true,
			errField: "tracking_type",
		},
		{
			name: "invalid muscle group",
			ex: Exercise{
				Name: "Squat", TrackingType: TrackingWeightReps,
				MuscleGroup: strPtr("invalid_group"),
			},
			wantErr:  true,
			errField: "muscle_group",
		},
		{
			name: "invalid equipment",
			ex: Exercise{
				Name: "Squat", TrackingType: TrackingWeightReps,
				Equipment: strPtr("invalid_equip"),
			},
			wantErr:  true,
			errField: "equipment",
		},
		{
			name: "nil muscle group is valid",
			ex:   Exercise{Name: "Squat", TrackingType: TrackingWeightReps, MuscleGroup: nil},
		},
		{
			name: "nil equipment is valid",
			ex:   Exercise{Name: "Squat", TrackingType: TrackingWeightReps, Equipment: nil},
		},
		{
			name: "all tracking types valid - bodyweight_reps",
			ex:   Exercise{Name: "Pull-Up", TrackingType: TrackingBodyweightReps},
		},
		{
			name: "all tracking types valid - duration",
			ex:   Exercise{Name: "Plank", TrackingType: TrackingDuration},
		},
		{
			name: "all tracking types valid - distance",
			ex:   Exercise{Name: "Running", TrackingType: TrackingDistance},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.ex.Validate()
			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				var ve *ValidationError
				if !errors.As(err, &ve) {
					t.Fatalf("expected ValidationError, got %T", err)
				}
				if ve.Field != tt.errField {
					t.Errorf("expected error on field %q, got %q", tt.errField, ve.Field)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
			}
		})
	}
}

func TestTrackingType_IsValid(t *testing.T) {
	valid := []TrackingType{TrackingWeightReps, TrackingBodyweightReps, TrackingDuration, TrackingDistance}
	for _, tt := range valid {
		if !tt.IsValid() {
			t.Errorf("expected %q to be valid", tt)
		}
	}
	invalid := []TrackingType{"", "invalid", "WEIGHT_REPS", "reps"}
	for _, tt := range invalid {
		if tt.IsValid() {
			t.Errorf("expected %q to be invalid", tt)
		}
	}
}

func TestIsValidMuscleGroup(t *testing.T) {
	for _, mg := range ValidMuscleGroups {
		if !IsValidMuscleGroup(mg) {
			t.Errorf("expected %q to be valid", mg)
		}
	}
	if IsValidMuscleGroup("arms") {
		t.Error("expected 'arms' to be invalid")
	}
	if IsValidMuscleGroup("") {
		t.Error("expected empty string to be invalid")
	}
	if IsValidMuscleGroup("Chest") {
		t.Error("expected 'Chest' (capitalized) to be invalid")
	}
}

func TestIsValidEquipment(t *testing.T) {
	for _, eq := range ValidEquipment {
		if !IsValidEquipment(eq) {
			t.Errorf("expected %q to be valid", eq)
		}
	}
	if IsValidEquipment("smith_machine") {
		t.Error("expected 'smith_machine' to be invalid")
	}
	if IsValidEquipment("") {
		t.Error("expected empty string to be invalid")
	}
}

func strPtr(s string) *string { return &s }
