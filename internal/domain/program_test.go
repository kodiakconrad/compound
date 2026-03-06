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

func TestProgramWorkout_Validate(t *testing.T) {
	tests := []struct {
		name     string
		w        ProgramWorkout
		wantErr  bool
		errField string
	}{
		{
			name: "valid workout",
			w:    ProgramWorkout{Name: "Day 1", DayNumber: 1},
		},
		{
			name:     "empty name",
			w:        ProgramWorkout{Name: "", DayNumber: 1},
			wantErr:  true,
			errField: "name",
		},
		{
			name:     "day_number zero",
			w:        ProgramWorkout{Name: "Day 1", DayNumber: 0},
			wantErr:  true,
			errField: "day_number",
		},
		{
			name:     "negative day_number",
			w:        ProgramWorkout{Name: "Day 1", DayNumber: -1},
			wantErr:  true,
			errField: "day_number",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.w.Validate()
			assertValidationResult(t, err, tt.wantErr, tt.errField)
		})
	}
}

func TestSection_Validate(t *testing.T) {
	tests := []struct {
		name     string
		s        Section
		wantErr  bool
		errField string
	}{
		{
			name: "valid section",
			s:    Section{Name: "Compound Lifts"},
		},
		{
			name:     "empty name",
			s:        Section{Name: ""},
			wantErr:  true,
			errField: "name",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.s.Validate()
			assertValidationResult(t, err, tt.wantErr, tt.errField)
		})
	}
}

func TestSectionExercise_Validate(t *testing.T) {
	sets := 3
	reps := 5
	weight := 135.0

	tests := []struct {
		name     string
		se       SectionExercise
		wantErr  bool
		errField string
	}{
		{
			name: "valid with sets and reps",
			se:   SectionExercise{ExerciseID: 1, TargetSets: &sets, TargetReps: &reps},
		},
		{
			name: "valid with weight only",
			se:   SectionExercise{ExerciseID: 1, TargetWeight: &weight},
		},
		{
			name:     "zero exercise ID",
			se:       SectionExercise{ExerciseID: 0, TargetSets: &sets},
			wantErr:  true,
			errField: "exercise_id",
		},
		{
			name:     "no targets set",
			se:       SectionExercise{ExerciseID: 1},
			wantErr:  true,
			errField: "targets",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.se.Validate()
			assertValidationResult(t, err, tt.wantErr, tt.errField)
		})
	}
}

func TestProgressionRule_Validate(t *testing.T) {
	inc5 := 5.0
	pct2 := 2.5
	zero := 0.0
	neg := -1.0

	tests := []struct {
		name     string
		r        ProgressionRule
		wantErr  bool
		errField string
	}{
		{
			name: "valid linear",
			r: ProgressionRule{
				Strategy: ProgressionLinear, Increment: &inc5,
				DeloadThreshold: 3, DeloadPct: 10,
			},
		},
		{
			name: "valid percentage",
			r: ProgressionRule{
				Strategy: ProgressionPercentage, IncrementPct: &pct2,
				DeloadThreshold: 3, DeloadPct: 10,
			},
		},
		{
			name: "valid wave",
			r: ProgressionRule{
				Strategy: ProgressionWave,
				DeloadThreshold: 3, DeloadPct: 10,
			},
		},
		{
			name: "invalid strategy",
			r: ProgressionRule{
				Strategy: "invalid", DeloadThreshold: 3, DeloadPct: 10,
			},
			wantErr:  true,
			errField: "strategy",
		},
		{
			name: "linear missing increment",
			r: ProgressionRule{
				Strategy: ProgressionLinear,
				DeloadThreshold: 3, DeloadPct: 10,
			},
			wantErr:  true,
			errField: "increment",
		},
		{
			name: "linear zero increment",
			r: ProgressionRule{
				Strategy: ProgressionLinear, Increment: &zero,
				DeloadThreshold: 3, DeloadPct: 10,
			},
			wantErr:  true,
			errField: "increment",
		},
		{
			name: "linear negative increment",
			r: ProgressionRule{
				Strategy: ProgressionLinear, Increment: &neg,
				DeloadThreshold: 3, DeloadPct: 10,
			},
			wantErr:  true,
			errField: "increment",
		},
		{
			name: "percentage missing increment_pct",
			r: ProgressionRule{
				Strategy: ProgressionPercentage,
				DeloadThreshold: 3, DeloadPct: 10,
			},
			wantErr:  true,
			errField: "increment_pct",
		},
		{
			name: "deload_threshold zero",
			r: ProgressionRule{
				Strategy: ProgressionLinear, Increment: &inc5,
				DeloadThreshold: 0, DeloadPct: 10,
			},
			wantErr:  true,
			errField: "deload_threshold",
		},
		{
			name: "deload_pct over 100",
			r: ProgressionRule{
				Strategy: ProgressionLinear, Increment: &inc5,
				DeloadThreshold: 3, DeloadPct: 101,
			},
			wantErr:  true,
			errField: "deload_pct",
		},
		{
			name: "deload_pct negative",
			r: ProgressionRule{
				Strategy: ProgressionLinear, Increment: &inc5,
				DeloadThreshold: 3, DeloadPct: -1,
			},
			wantErr:  true,
			errField: "deload_pct",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.r.Validate()
			assertValidationResult(t, err, tt.wantErr, tt.errField)
		})
	}
}

func TestProgressionStrategy_IsValid(t *testing.T) {
	valid := []ProgressionStrategy{ProgressionLinear, ProgressionPercentage, ProgressionWave}
	for _, s := range valid {
		if !s.IsValid() {
			t.Errorf("expected %q to be valid", s)
		}
	}
	invalid := []ProgressionStrategy{"", "invalid", "LINEAR", "none"}
	for _, s := range invalid {
		if s.IsValid() {
			t.Errorf("expected %q to be invalid", s)
		}
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
		IsTemplate:  true,
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

	// Copy is a regular program, not a template, not prebuilt.
	if cp.IsTemplate {
		t.Error("copy should not be a template")
	}
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

func TestProgressionRule_NextWeight(t *testing.T) {
	inc := 5.0
	pct := 2.5

	tests := []struct {
		name     string
		rule     ProgressionRule
		current  float64
		failures int
		expected float64
	}{
		{
			name:     "linear increment",
			rule:     ProgressionRule{Strategy: ProgressionLinear, Increment: &inc, DeloadThreshold: 3, DeloadPct: 10},
			current:  100, failures: 0,
			expected: 105,
		},
		{
			name:     "percentage increment",
			rule:     ProgressionRule{Strategy: ProgressionPercentage, IncrementPct: &pct, DeloadThreshold: 3, DeloadPct: 10},
			current:  200, failures: 0,
			expected: 205,
		},
		{
			name:     "wave returns current",
			rule:     ProgressionRule{Strategy: ProgressionWave, DeloadThreshold: 3, DeloadPct: 10},
			current:  100, failures: 0,
			expected: 100,
		},
		{
			name:     "deload triggered",
			rule:     ProgressionRule{Strategy: ProgressionLinear, Increment: &inc, DeloadThreshold: 3, DeloadPct: 10},
			current:  100, failures: 3,
			expected: 90,
		},
		{
			name:     "deload at exact threshold",
			rule:     ProgressionRule{Strategy: ProgressionPercentage, IncrementPct: &pct, DeloadThreshold: 2, DeloadPct: 20},
			current:  200, failures: 2,
			expected: 160,
		},
		{
			name:     "no deload below threshold",
			rule:     ProgressionRule{Strategy: ProgressionLinear, Increment: &inc, DeloadThreshold: 3, DeloadPct: 10},
			current:  100, failures: 2,
			expected: 105,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := tt.rule.NextWeight(tt.current, tt.failures)
			diff := got - tt.expected
			if diff < -0.001 || diff > 0.001 {
				t.Errorf("expected %.2f, got %.2f", tt.expected, got)
			}
		})
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
