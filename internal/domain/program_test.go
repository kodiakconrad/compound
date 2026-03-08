package domain

import (
	"errors"
	"testing"
)

func TestProgram_Validate(t *testing.T) {
	tests := []struct {
		name     string
		p        Program
		wantErr  bool
		errField string
	}{
		{
			name: "valid program",
			p:    Program{Name: "My Program"},
		},
		{
			name:     "empty name",
			p:        Program{Name: ""},
			wantErr:  true,
			errField: "name",
		},
		{
			name:     "whitespace only name",
			p:        Program{Name: "   "},
			wantErr:  true,
			errField: "name",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.p.Validate()
			assertValidationResult(t, err, tt.wantErr, tt.errField)
		})
	}
}

func TestProgram_HasDayNumber(t *testing.T) {
	p := &Program{Name: "Test"}

	// No conflict.
	if err := p.HasDayNumber(1, []int{2, 3}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Conflict.
	err := p.HasDayNumber(2, []int{1, 2, 3})
	if err == nil {
		t.Fatal("expected conflict error, got nil")
	}
	var ce *ConflictError
	if !errors.As(err, &ce) {
		t.Fatalf("expected ConflictError, got %T", err)
	}
}

func TestProgram_DeepCopy(t *testing.T) {
	sets := 3
	reps := 5
	weight := 135.0
	inc := 5.0
	desc := "A template"
	notes := "some notes"

	source := &Program{
		ID:          1,
		UUID:        "source-uuid",
		Name:        "Source",
		Description: &desc,
		IsPrebuilt:  true,
		Workouts: []*ProgramWorkout{
			{
				ID: 10, UUID: "workout-uuid", Name: "Day 1",
				DayNumber: 1, SortOrder: 1,
				Sections: []*Section{
					{
						ID: 20, UUID: "section-uuid", Name: "Main",
						SortOrder: 1,
						Exercises: []*SectionExercise{
							{
								ID: 30, UUID: "se-uuid", ExerciseID: 99,
								TargetSets: &sets, TargetReps: &reps,
								TargetWeight: &weight, SortOrder: 1, Notes: &notes,
								ProgressionRule: &ProgressionRule{
									ID: 40, UUID: "pr-uuid",
									Strategy: ProgressionLinear, Increment: &inc,
									DeloadThreshold: 3, DeloadPct: 10,
								},
							},
						},
					},
				},
			},
		},
	}

	cp := source.DeepCopy()

	// Copy is a user program — never prebuilt.
	if cp.IsPrebuilt {
		t.Error("copy should not be prebuilt")
	}

	// IDs are zeroed.
	if cp.ID != 0 {
		t.Error("copy ID should be 0")
	}

	// UUIDs are new at every level.
	if cp.UUID == source.UUID {
		t.Error("copy UUID should differ from source")
	}
	if cp.UUID == "" {
		t.Error("copy UUID should not be empty")
	}

	// Name gets "(Copy)" suffix.
	if cp.Name != "Source (Copy)" {
		t.Errorf("expected name %q, got %q", "Source (Copy)", cp.Name)
	}

	// Description is copied but independent.
	if cp.Description == nil || *cp.Description != desc {
		t.Error("description should be copied")
	}
	newDesc := "changed"
	cp.Description = &newDesc
	if *source.Description != desc {
		t.Error("modifying copy should not affect source")
	}

	// Tree structure preserved.
	if len(cp.Workouts) != 1 {
		t.Fatalf("expected 1 workout, got %d", len(cp.Workouts))
	}
	cw := cp.Workouts[0]
	if cw.UUID == "workout-uuid" || cw.UUID == "" {
		t.Error("workout UUID should be new and non-empty")
	}
	if cw.ID != 0 {
		t.Error("workout ID should be 0")
	}
	if cw.Name != "Day 1" || cw.DayNumber != 1 {
		t.Error("workout data should match source")
	}

	if len(cw.Sections) != 1 {
		t.Fatalf("expected 1 section, got %d", len(cw.Sections))
	}
	cs := cw.Sections[0]
	if cs.UUID == "section-uuid" || cs.UUID == "" {
		t.Error("section UUID should be new and non-empty")
	}

	if len(cs.Exercises) != 1 {
		t.Fatalf("expected 1 exercise, got %d", len(cs.Exercises))
	}
	cse := cs.Exercises[0]
	if cse.UUID == "se-uuid" || cse.UUID == "" {
		t.Error("section exercise UUID should be new and non-empty")
	}
	if cse.ExerciseID != 99 {
		t.Error("exercise ID reference should be preserved")
	}
	if cse.TargetSets == nil || *cse.TargetSets != sets {
		t.Error("target sets should be copied")
	}

	if cse.ProgressionRule == nil {
		t.Fatal("progression rule should be copied")
	}
	if cse.ProgressionRule.UUID == "pr-uuid" || cse.ProgressionRule.UUID == "" {
		t.Error("progression rule UUID should be new and non-empty")
	}
	if cse.ProgressionRule.Strategy != ProgressionLinear {
		t.Error("progression strategy should be preserved")
	}
	if cse.ProgressionRule.Increment == nil || *cse.ProgressionRule.Increment != inc {
		t.Error("increment should be copied")
	}
}

// assertValidationResult is a shared helper for validation test cases.
func assertValidationResult(t *testing.T, err error, wantErr bool, errField string) {
	t.Helper()
	if wantErr {
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		var ve *ValidationError
		if !errors.As(err, &ve) {
			t.Fatalf("expected ValidationError, got %T: %v", err, err)
		}
		if ve.Field != errField {
			t.Errorf("expected error on field %q, got %q", errField, ve.Field)
		}
	} else {
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
	}
}
