package seed

import "compound/internal/domain"

// SeedExercise holds the data needed to insert a prebuilt exercise.
type SeedExercise struct {
	Name         string
	MuscleGroup  string
	Equipment    string
	TrackingType domain.TrackingType
}

// Exercises returns the full list of prebuilt exercises to seed.
func Exercises() []SeedExercise {
	return []SeedExercise{
		// --- Chest ---
		{Name: "Barbell Bench Press", MuscleGroup: "chest", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Incline Barbell Bench Press", MuscleGroup: "chest", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Decline Barbell Bench Press", MuscleGroup: "chest", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Dumbbell Bench Press", MuscleGroup: "chest", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Incline Dumbbell Press", MuscleGroup: "chest", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Dumbbell Fly", MuscleGroup: "chest", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Cable Fly", MuscleGroup: "chest", Equipment: "cable", TrackingType: domain.TrackingWeightReps},
		{Name: "Pec Deck", MuscleGroup: "chest", Equipment: "machine", TrackingType: domain.TrackingWeightReps},
		{Name: "Push-Up", MuscleGroup: "chest", Equipment: "bodyweight", TrackingType: domain.TrackingBodyweightReps},
		{Name: "Dips (Chest)", MuscleGroup: "chest", Equipment: "bodyweight", TrackingType: domain.TrackingBodyweightReps},
		{Name: "Machine Chest Press", MuscleGroup: "chest", Equipment: "machine", TrackingType: domain.TrackingWeightReps},

		// --- Back ---
		{Name: "Barbell Row", MuscleGroup: "back", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Pendlay Row", MuscleGroup: "back", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Dumbbell Row", MuscleGroup: "back", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Seated Cable Row", MuscleGroup: "back", Equipment: "cable", TrackingType: domain.TrackingWeightReps},
		{Name: "Lat Pulldown", MuscleGroup: "back", Equipment: "cable", TrackingType: domain.TrackingWeightReps},
		{Name: "Pull-Up", MuscleGroup: "back", Equipment: "bodyweight", TrackingType: domain.TrackingBodyweightReps},
		{Name: "Chin-Up", MuscleGroup: "back", Equipment: "bodyweight", TrackingType: domain.TrackingBodyweightReps},
		{Name: "T-Bar Row", MuscleGroup: "back", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Face Pull", MuscleGroup: "back", Equipment: "cable", TrackingType: domain.TrackingWeightReps},
		{Name: "Deadlift", MuscleGroup: "back", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Rack Pull", MuscleGroup: "back", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},

		// --- Legs ---
		{Name: "Barbell Squat", MuscleGroup: "legs", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Front Squat", MuscleGroup: "legs", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Leg Press", MuscleGroup: "legs", Equipment: "machine", TrackingType: domain.TrackingWeightReps},
		{Name: "Hack Squat", MuscleGroup: "legs", Equipment: "machine", TrackingType: domain.TrackingWeightReps},
		{Name: "Romanian Deadlift", MuscleGroup: "legs", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Bulgarian Split Squat", MuscleGroup: "legs", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Goblet Squat", MuscleGroup: "legs", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Walking Lunge", MuscleGroup: "legs", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Leg Extension", MuscleGroup: "legs", Equipment: "machine", TrackingType: domain.TrackingWeightReps},
		{Name: "Leg Curl", MuscleGroup: "legs", Equipment: "machine", TrackingType: domain.TrackingWeightReps},
		{Name: "Calf Raise (Standing)", MuscleGroup: "legs", Equipment: "machine", TrackingType: domain.TrackingWeightReps},
		{Name: "Calf Raise (Seated)", MuscleGroup: "legs", Equipment: "machine", TrackingType: domain.TrackingWeightReps},
		{Name: "Hip Thrust", MuscleGroup: "legs", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Sumo Deadlift", MuscleGroup: "legs", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},

		// --- Shoulders ---
		{Name: "Overhead Press", MuscleGroup: "shoulders", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Dumbbell Shoulder Press", MuscleGroup: "shoulders", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Arnold Press", MuscleGroup: "shoulders", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Lateral Raise", MuscleGroup: "shoulders", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Front Raise", MuscleGroup: "shoulders", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Rear Delt Fly", MuscleGroup: "shoulders", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Cable Lateral Raise", MuscleGroup: "shoulders", Equipment: "cable", TrackingType: domain.TrackingWeightReps},
		{Name: "Upright Row", MuscleGroup: "shoulders", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Machine Shoulder Press", MuscleGroup: "shoulders", Equipment: "machine", TrackingType: domain.TrackingWeightReps},

		// --- Biceps ---
		{Name: "Barbell Curl", MuscleGroup: "biceps", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "EZ Bar Curl", MuscleGroup: "biceps", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Dumbbell Curl", MuscleGroup: "biceps", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Hammer Curl", MuscleGroup: "biceps", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Incline Dumbbell Curl", MuscleGroup: "biceps", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Preacher Curl", MuscleGroup: "biceps", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Cable Curl", MuscleGroup: "biceps", Equipment: "cable", TrackingType: domain.TrackingWeightReps},
		{Name: "Concentration Curl", MuscleGroup: "biceps", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},

		// --- Triceps ---
		{Name: "Close-Grip Bench Press", MuscleGroup: "triceps", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Tricep Pushdown", MuscleGroup: "triceps", Equipment: "cable", TrackingType: domain.TrackingWeightReps},
		{Name: "Overhead Tricep Extension", MuscleGroup: "triceps", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Skull Crusher", MuscleGroup: "triceps", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Dips (Triceps)", MuscleGroup: "triceps", Equipment: "bodyweight", TrackingType: domain.TrackingBodyweightReps},
		{Name: "Cable Overhead Extension", MuscleGroup: "triceps", Equipment: "cable", TrackingType: domain.TrackingWeightReps},
		{Name: "Kickback", MuscleGroup: "triceps", Equipment: "dumbbell", TrackingType: domain.TrackingWeightReps},

		// --- Core ---
		{Name: "Plank", MuscleGroup: "core", Equipment: "bodyweight", TrackingType: domain.TrackingDuration},
		{Name: "Side Plank", MuscleGroup: "core", Equipment: "bodyweight", TrackingType: domain.TrackingDuration},
		{Name: "Hanging Leg Raise", MuscleGroup: "core", Equipment: "bodyweight", TrackingType: domain.TrackingBodyweightReps},
		{Name: "Cable Crunch", MuscleGroup: "core", Equipment: "cable", TrackingType: domain.TrackingWeightReps},
		{Name: "Ab Wheel Rollout", MuscleGroup: "core", Equipment: "other", TrackingType: domain.TrackingBodyweightReps},
		{Name: "Russian Twist", MuscleGroup: "core", Equipment: "other", TrackingType: domain.TrackingBodyweightReps},
		{Name: "Dead Bug", MuscleGroup: "core", Equipment: "bodyweight", TrackingType: domain.TrackingBodyweightReps},
		{Name: "Farmer's Walk", MuscleGroup: "core", Equipment: "dumbbell", TrackingType: domain.TrackingDuration},
		{Name: "Pallof Press", MuscleGroup: "core", Equipment: "cable", TrackingType: domain.TrackingWeightReps},

		// --- Cardio ---
		{Name: "Treadmill Run", MuscleGroup: "cardio", Equipment: "machine", TrackingType: domain.TrackingDistance},
		{Name: "Rowing Machine", MuscleGroup: "cardio", Equipment: "machine", TrackingType: domain.TrackingDistance},
		{Name: "Stationary Bike", MuscleGroup: "cardio", Equipment: "machine", TrackingType: domain.TrackingDuration},
		{Name: "Stair Climber", MuscleGroup: "cardio", Equipment: "machine", TrackingType: domain.TrackingDuration},
		{Name: "Jump Rope", MuscleGroup: "cardio", Equipment: "other", TrackingType: domain.TrackingDuration},
		{Name: "Battle Ropes", MuscleGroup: "cardio", Equipment: "other", TrackingType: domain.TrackingDuration},
		{Name: "Kettlebell Swing", MuscleGroup: "cardio", Equipment: "kettlebell", TrackingType: domain.TrackingWeightReps},
		{Name: "Box Jump", MuscleGroup: "cardio", Equipment: "other", TrackingType: domain.TrackingBodyweightReps},
		{Name: "Burpee", MuscleGroup: "cardio", Equipment: "bodyweight", TrackingType: domain.TrackingBodyweightReps},

		// --- Other / Compound ---
		{Name: "Power Clean", MuscleGroup: "other", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Snatch", MuscleGroup: "other", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Clean and Jerk", MuscleGroup: "other", Equipment: "barbell", TrackingType: domain.TrackingWeightReps},
		{Name: "Turkish Get-Up", MuscleGroup: "other", Equipment: "kettlebell", TrackingType: domain.TrackingWeightReps},
		{Name: "Sled Push", MuscleGroup: "other", Equipment: "other", TrackingType: domain.TrackingDistance},
	}
}
