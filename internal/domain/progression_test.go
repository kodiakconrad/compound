package domain

import "testing"

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
				Strategy:        ProgressionWave,
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
				Strategy:        ProgressionLinear,
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
				Strategy:        ProgressionPercentage,
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
			name:     "hold on failure below threshold",
			rule:     ProgressionRule{Strategy: ProgressionLinear, Increment: &inc, DeloadThreshold: 3, DeloadPct: 10},
			current:  100, failures: 2,
			expected: 100,
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
