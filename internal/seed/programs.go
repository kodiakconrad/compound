package seed

import (
	"compound/internal/domain"
)

// intPtr returns a pointer to the given int.
func intPtr(i int) *int { return &i }

// float64Ptr returns a pointer to the given float64.
func float64Ptr(f float64) *float64 { return &f }

// exercise is a shorthand for building a SectionExercise by name.
// The ExerciseUUID is resolved later (looked up by name before inserting).
type exercise struct {
	Name         string
	TargetSets   *int
	TargetReps   *int
	TargetWeight *float64
	SetScheme    *domain.SetScheme
}

// seedProgram describes a program to seed. Exercise names are resolved to UUIDs
// at seed time because the exercises table must be populated first.
type seedProgram struct {
	Name        string
	Description string
	Workouts    []seedWorkout
}

type seedWorkout struct {
	Name      string
	DayNumber int
	Sections  []seedSection
}

type seedSection struct {
	Name      string
	Exercises []exercise
}

// Programs returns the list of prebuilt programs to seed.
// Each references exercises by name — the caller must resolve names to UUIDs
// before inserting.
func Programs() []seedProgram {
	return []seedProgram{
		startingStrength(),
		fiveThreeOne(),
		pushPullLegs(),
	}
}

// ---------------------------------------------------------------------------
// Starting Strength — a simple novice linear-progression template.
// 2 workouts alternating A/B, all straight sets at 3×5 (deadlift 1×5).
// ---------------------------------------------------------------------------

func startingStrength() seedProgram {
	return seedProgram{
		Name:        "Starting Strength",
		Description: "Classic novice barbell program. Two alternating workouts (A/B) with 3×5 compounds.",
		Workouts: []seedWorkout{
			{
				Name:      "Day A",
				DayNumber: 1,
				Sections: []seedSection{
					{
						Name: "Compound",
						Exercises: []exercise{
							{Name: "Barbell Squat", TargetSets: intPtr(3), TargetReps: intPtr(5)},
							{Name: "Barbell Bench Press", TargetSets: intPtr(3), TargetReps: intPtr(5)},
							{Name: "Deadlift", TargetSets: intPtr(1), TargetReps: intPtr(5)},
						},
					},
				},
			},
			{
				Name:      "Day B",
				DayNumber: 2,
				Sections: []seedSection{
					{
						Name: "Compound",
						Exercises: []exercise{
							{Name: "Barbell Squat", TargetSets: intPtr(3), TargetReps: intPtr(5)},
							{Name: "Overhead Press", TargetSets: intPtr(3), TargetReps: intPtr(5)},
							{Name: "Barbell Row", TargetSets: intPtr(3), TargetReps: intPtr(5)},
						},
					},
				},
			},
		},
	}
}

// ---------------------------------------------------------------------------
// 5/3/1 Beginner — 4 workouts, each with one main 5/3/1 lift + accessories.
// Main lifts use a 5/3/1 set scheme (week 1 defaults, placeholder 1RM of 100).
// ---------------------------------------------------------------------------

func fiveThreeOne() seedProgram {
	week1 := intPtr(1)
	orm := float64Ptr(100) // Placeholder — user replaces with their actual 1RM.

	build531Scheme := func() *domain.SetScheme {
		// Week 1: 5×65%, 5×75%, 5×85% of training max (90% of 1RM).
		// TM = 90 (90% of 100). Sets: 58.5→55, 67.5, 76.5→77.5.
		tm := 90.0
		return &domain.SetScheme{
			Type:      domain.SetScheme531,
			OneRepMax: orm,
			Week:      week1,
			Sets: []domain.SchemeSet{
				{Reps: 5, Weight: roundToNearest(tm*0.65, 2.5)},
				{Reps: 5, Weight: roundToNearest(tm*0.75, 2.5)},
				{Reps: 5, Weight: roundToNearest(tm*0.85, 2.5)},
			},
		}
	}

	return seedProgram{
		Name:        "5/3/1 Beginner",
		Description: "Wendler's 5/3/1 with beginner accessories. Four days: Squat, Bench, Deadlift, OHP.",
		Workouts: []seedWorkout{
			{
				Name:      "Squat Day",
				DayNumber: 1,
				Sections: []seedSection{
					{
						Name: "Main Lift",
						Exercises: []exercise{
							{Name: "Barbell Squat", SetScheme: build531Scheme()},
						},
					},
					{
						Name: "Accessories",
						Exercises: []exercise{
							{Name: "Leg Press", TargetSets: intPtr(3), TargetReps: intPtr(10)},
							{Name: "Leg Curl", TargetSets: intPtr(3), TargetReps: intPtr(12)},
							{Name: "Hanging Leg Raise", TargetSets: intPtr(3), TargetReps: intPtr(15)},
						},
					},
				},
			},
			{
				Name:      "Bench Day",
				DayNumber: 2,
				Sections: []seedSection{
					{
						Name: "Main Lift",
						Exercises: []exercise{
							{Name: "Barbell Bench Press", SetScheme: build531Scheme()},
						},
					},
					{
						Name: "Accessories",
						Exercises: []exercise{
							{Name: "Dumbbell Row", TargetSets: intPtr(3), TargetReps: intPtr(10)},
							{Name: "Dumbbell Fly", TargetSets: intPtr(3), TargetReps: intPtr(12)},
							{Name: "Tricep Pushdown", TargetSets: intPtr(3), TargetReps: intPtr(15)},
						},
					},
				},
			},
			{
				Name:      "Deadlift Day",
				DayNumber: 3,
				Sections: []seedSection{
					{
						Name: "Main Lift",
						Exercises: []exercise{
							{Name: "Deadlift", SetScheme: build531Scheme()},
						},
					},
					{
						Name: "Accessories",
						Exercises: []exercise{
							{Name: "Romanian Deadlift", TargetSets: intPtr(3), TargetReps: intPtr(10)},
							{Name: "Barbell Row", TargetSets: intPtr(3), TargetReps: intPtr(10)},
							{Name: "Plank", TargetSets: intPtr(3), TargetReps: intPtr(1)},
						},
					},
				},
			},
			{
				Name:      "OHP Day",
				DayNumber: 4,
				Sections: []seedSection{
					{
						Name: "Main Lift",
						Exercises: []exercise{
							{Name: "Overhead Press", SetScheme: build531Scheme()},
						},
					},
					{
						Name: "Accessories",
						Exercises: []exercise{
							{Name: "Lat Pulldown", TargetSets: intPtr(3), TargetReps: intPtr(10)},
							{Name: "Lateral Raise", TargetSets: intPtr(3), TargetReps: intPtr(15)},
							{Name: "Face Pull", TargetSets: intPtr(3), TargetReps: intPtr(15)},
						},
					},
				},
			},
		},
	}
}

// ---------------------------------------------------------------------------
// Push/Pull/Legs — 3 workouts showcasing pyramid and drop set schemes.
// ---------------------------------------------------------------------------

func pushPullLegs() seedProgram {
	return seedProgram{
		Name:        "Push/Pull/Legs",
		Description: "Classic 3-day split with pyramid sets on compounds and drop sets for burnouts.",
		Workouts: []seedWorkout{
			{
				Name:      "Push",
				DayNumber: 1,
				Sections: []seedSection{
					{
						Name: "Compound",
						Exercises: []exercise{
							{
								Name: "Barbell Bench Press",
								SetScheme: &domain.SetScheme{
									Type: domain.SetSchemePyramid,
									Sets: []domain.SchemeSet{
										{Reps: 12, Weight: 50},
										{Reps: 10, Weight: 60},
										{Reps: 8, Weight: 70},
										{Reps: 6, Weight: 80},
									},
								},
							},
							{Name: "Dumbbell Shoulder Press", TargetSets: intPtr(3), TargetReps: intPtr(10)},
						},
					},
					{
						Name: "Isolation",
						Exercises: []exercise{
							{Name: "Cable Fly", TargetSets: intPtr(3), TargetReps: intPtr(12)},
							{Name: "Lateral Raise", TargetSets: intPtr(3), TargetReps: intPtr(15)},
							{Name: "Tricep Pushdown", TargetSets: intPtr(3), TargetReps: intPtr(12)},
						},
					},
					{
						Name: "Burnout",
						Exercises: []exercise{
							{
								Name: "Pec Deck",
								SetScheme: &domain.SetScheme{
									Type: domain.SetSchemeDropSet,
									Sets: []domain.SchemeSet{
										{Reps: 10, Weight: 50},
										{Reps: 10, Weight: 40},
										{Reps: 10, Weight: 30},
									},
								},
							},
						},
					},
				},
			},
			{
				Name:      "Pull",
				DayNumber: 2,
				Sections: []seedSection{
					{
						Name: "Compound",
						Exercises: []exercise{
							{
								Name: "Barbell Row",
								SetScheme: &domain.SetScheme{
									Type: domain.SetSchemePyramid,
									Sets: []domain.SchemeSet{
										{Reps: 12, Weight: 40},
										{Reps: 10, Weight: 50},
										{Reps: 8, Weight: 60},
										{Reps: 6, Weight: 70},
									},
								},
							},
							{Name: "Lat Pulldown", TargetSets: intPtr(3), TargetReps: intPtr(10)},
						},
					},
					{
						Name: "Isolation",
						Exercises: []exercise{
							{Name: "Face Pull", TargetSets: intPtr(3), TargetReps: intPtr(15)},
							{Name: "Dumbbell Curl", TargetSets: intPtr(3), TargetReps: intPtr(12)},
							{Name: "Hammer Curl", TargetSets: intPtr(3), TargetReps: intPtr(12)},
						},
					},
					{
						Name: "Burnout",
						Exercises: []exercise{
							{
								Name: "Seated Cable Row",
								SetScheme: &domain.SetScheme{
									Type: domain.SetSchemeDropSet,
									Sets: []domain.SchemeSet{
										{Reps: 10, Weight: 45},
										{Reps: 10, Weight: 35},
										{Reps: 10, Weight: 25},
									},
								},
							},
						},
					},
				},
			},
			{
				Name:      "Legs",
				DayNumber: 3,
				Sections: []seedSection{
					{
						Name: "Compound",
						Exercises: []exercise{
							{
								Name: "Barbell Squat",
								SetScheme: &domain.SetScheme{
									Type: domain.SetSchemePyramid,
									Sets: []domain.SchemeSet{
										{Reps: 12, Weight: 60},
										{Reps: 10, Weight: 80},
										{Reps: 8, Weight: 90},
										{Reps: 6, Weight: 100},
									},
								},
							},
							{Name: "Romanian Deadlift", TargetSets: intPtr(3), TargetReps: intPtr(10)},
						},
					},
					{
						Name: "Isolation",
						Exercises: []exercise{
							{Name: "Leg Extension", TargetSets: intPtr(3), TargetReps: intPtr(12)},
							{Name: "Leg Curl", TargetSets: intPtr(3), TargetReps: intPtr(12)},
							{Name: "Calf Raise (Standing)", TargetSets: intPtr(3), TargetReps: intPtr(15)},
						},
					},
					{
						Name: "Burnout",
						Exercises: []exercise{
							{
								Name: "Leg Press",
								SetScheme: &domain.SetScheme{
									Type: domain.SetSchemeDropSet,
									Sets: []domain.SchemeSet{
										{Reps: 10, Weight: 120},
										{Reps: 10, Weight: 90},
										{Reps: 10, Weight: 60},
									},
								},
							},
						},
					},
				},
			},
		},
	}
}

// roundToNearest rounds a weight to the nearest increment (e.g., 2.5 kg plates).
func roundToNearest(value, increment float64) float64 {
	return float64(int(value/increment+0.5)) * increment
}
