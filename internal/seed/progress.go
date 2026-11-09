package seed

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"math/rand"
	"time"

	"github.com/google/uuid"
)

// SeedProgress creates fake completed cycles, sessions, and set_logs so the
// Progress tab has data to display. Idempotent — skips if any completed
// session already exists.
//
// Simulates ~8 weeks of training on the first prebuilt program, with gradual
// weight progression on each exercise.
func SeedProgress(ctx context.Context, db *sql.DB) error {
	// Idempotent guard — skip if completed sessions already exist.
	var count int
	err := db.QueryRowContext(ctx,
		"SELECT COUNT(*) FROM sessions WHERE status = 'completed'",
	).Scan(&count)
	if err != nil {
		return fmt.Errorf("check existing sessions: %w", err)
	}
	if count > 0 {
		slog.Info("progress already seeded, skipping", "completed_sessions", count)
		return nil
	}

	// Find the first prebuilt program with its workouts.
	var programID int64
	err = db.QueryRowContext(ctx,
		"SELECT id FROM programs WHERE is_prebuilt = 1 AND deleted_at IS NULL ORDER BY id LIMIT 1",
	).Scan(&programID)
	if err != nil {
		return fmt.Errorf("find prebuilt program: %w", err)
	}

	// Load workouts for the program.
	type workout struct {
		id   int64
		name string
	}
	rows, err := db.QueryContext(ctx,
		"SELECT id, name FROM program_workouts WHERE program_id = ? ORDER BY sort_order",
		programID,
	)
	if err != nil {
		return fmt.Errorf("load workouts: %w", err)
	}
	defer rows.Close()

	var workouts []workout
	for rows.Next() {
		var w workout
		if err := rows.Scan(&w.id, &w.name); err != nil {
			return err
		}
		workouts = append(workouts, w)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	if len(workouts) == 0 {
		slog.Warn("no workouts found for prebuilt program, skipping progress seed")
		return nil
	}

	// Load section_exercises for each workout.
	type sectionExercise struct {
		seID        int64
		exerciseID  int64
		targetSets  int
		targetReps  int
		targetWeight float64
	}
	workoutExercises := make(map[int64][]sectionExercise)
	for _, w := range workouts {
		exRows, err := db.QueryContext(ctx, `
			SELECT se.id, se.exercise_id,
				   COALESCE(se.target_sets, 3),
				   COALESCE(se.target_reps, 5),
				   COALESCE(se.target_weight, 60.0)
			FROM section_exercises se
			JOIN sections s ON s.id = se.section_id
			WHERE s.program_workout_id = ?
			ORDER BY s.sort_order, se.sort_order
		`, w.id)
		if err != nil {
			return fmt.Errorf("load exercises for workout %d: %w", w.id, err)
		}

		var exercises []sectionExercise
		for exRows.Next() {
			var se sectionExercise
			if err := exRows.Scan(&se.seID, &se.exerciseID, &se.targetSets, &se.targetReps, &se.targetWeight); err != nil {
				exRows.Close()
				return err
			}
			exercises = append(exercises, se)
		}
		exRows.Close()
		if err := exRows.Err(); err != nil {
			return err
		}
		workoutExercises[w.id] = exercises
	}

	// Simulate 6 completed cycles over ~8 weeks. Each cycle runs all workouts
	// once, with sessions spaced ~3 days apart. This gives 12+ completed sessions
	// with progressive weight increases — enough data for charts and PRs.
	now := time.Now().UTC()
	baseDate := now.AddDate(0, -2, 0) // start 2 months ago
	rng := rand.New(rand.NewSource(42))

	// Track weight progression per exercise across all sessions.
	exerciseWeights := make(map[int64]float64)

	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}

	cycleCount := 6
	sessionIdx := 0

	// daysPerCycle: how many calendar days one cycle takes.
	// Each cycle runs len(workouts) sessions ~3 days apart, plus a 1-day gap.
	daysPerCycle := len(workouts)*3 + 1

	for c := 0; c < cycleCount; c++ {
		cycleUUID := uuid.NewString()
		cycleStarted := baseDate.Add(time.Duration(c*daysPerCycle*24) * time.Hour)
		cycleEnd := cycleStarted.Add(time.Duration((daysPerCycle-1)*24) * time.Hour)

		_, err := tx.ExecContext(ctx, `
			INSERT INTO cycles (uuid, program_id, status, started_at, completed_at, created_at, updated_at)
			VALUES (?, ?, 'completed', ?, ?, ?, ?)
		`, cycleUUID, programID,
			cycleStarted.Format(time.RFC3339),
			cycleEnd.Format(time.RFC3339),
			cycleStarted.Format(time.RFC3339),
			cycleStarted.Format(time.RFC3339),
		)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("insert cycle: %w", err)
		}

		var cycleID int64
		err = tx.QueryRowContext(ctx, "SELECT id FROM cycles WHERE uuid = ?", cycleUUID).Scan(&cycleID)
		if err != nil {
			tx.Rollback()
			return fmt.Errorf("get cycle id: %w", err)
		}

		for wi, w := range workouts {
			sessionUUID := uuid.NewString()
			// Space sessions ~3 days apart within the cycle.
			sessionDate := cycleStarted.Add(time.Duration(wi*3*24) * time.Hour).
				Add(time.Duration(rng.Intn(8)) * time.Hour)

			_, err := tx.ExecContext(ctx, `
				INSERT INTO sessions (uuid, cycle_id, program_workout_id, sort_order, status, started_at, completed_at, created_at, updated_at)
				VALUES (?, ?, ?, ?, 'completed', ?, ?, ?, ?)
			`, sessionUUID, cycleID, w.id, wi+1,
				sessionDate.Format(time.RFC3339),
				sessionDate.Add(time.Hour).Format(time.RFC3339),
				sessionDate.Format(time.RFC3339),
				sessionDate.Format(time.RFC3339),
			)
			if err != nil {
				tx.Rollback()
				return fmt.Errorf("insert session: %w", err)
			}

			var sessionID int64
			err = tx.QueryRowContext(ctx, "SELECT id FROM sessions WHERE uuid = ?", sessionUUID).Scan(&sessionID)
			if err != nil {
				tx.Rollback()
				return fmt.Errorf("get session id: %w", err)
			}

			// Log sets for each exercise in this workout.
			exercises := workoutExercises[w.id]
			for _, se := range exercises {
				// Initialize or progress weight.
				currentWeight, exists := exerciseWeights[se.exerciseID]
				if !exists {
					currentWeight = se.targetWeight
					if currentWeight == 0 {
						currentWeight = 60.0
					}
					exerciseWeights[se.exerciseID] = currentWeight
				} else {
					// ~70% chance of a small increase each session.
					if rng.Float64() < 0.7 {
						currentWeight += 2.5
						exerciseWeights[se.exerciseID] = currentWeight
					}
				}

				for setNum := 1; setNum <= se.targetSets; setNum++ {
					// Simulate reps — usually hitting target, sometimes one fewer.
					reps := se.targetReps
					if rng.Float64() < 0.15 {
						reps = se.targetReps - 1
						if reps < 1 {
							reps = 1
						}
					}

					setTime := sessionDate.Add(time.Duration(setNum*3) * time.Minute)
					_, err := tx.ExecContext(ctx, `
						INSERT INTO set_logs (uuid, session_id, exercise_id, section_exercise_id, set_number, target_reps, actual_reps, weight, completed_at, created_at)
						VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					`, uuid.NewString(), sessionID, se.exerciseID, se.seID, setNum,
						se.targetReps, reps, currentWeight,
						setTime.Format(time.RFC3339),
						setTime.Format(time.RFC3339),
					)
					if err != nil {
						tx.Rollback()
						return fmt.Errorf("insert set_log: %w", err)
					}
				}
			}

			sessionIdx++
		}
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	slog.Info("progress seeded", "cycles", cycleCount, "sessions", sessionIdx)
	return nil
}
