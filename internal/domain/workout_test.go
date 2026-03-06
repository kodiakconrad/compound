package domain

import "testing"

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
