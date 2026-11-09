package seed

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
)

// SeedExercises inserts all prebuilt exercises. Idempotent — exercises that
// already exist (by name) are skipped.
func SeedExercises(ctx context.Context, db *sql.DB) error {
	exercises := Exercises()
	var created int

	for _, se := range exercises {
		// Check if exercise already exists by name.
		var count int
		err := db.QueryRowContext(ctx,
			"SELECT COUNT(*) FROM exercises WHERE name = ? AND deleted_at IS NULL",
			se.Name,
		).Scan(&count)
		if err != nil {
			return err
		}
		if count > 0 {
			continue
		}

		now := time.Now().UTC().Format(time.RFC3339)
		_, err = db.ExecContext(ctx, `
			INSERT INTO exercises (uuid, name, muscle_group, equipment, tracking_type, is_custom, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, 0, ?, ?)
		`, uuid.NewString(), se.Name, se.MuscleGroup, se.Equipment, string(se.TrackingType), now, now)
		if err != nil {
			return fmt.Errorf("insert exercise %q: %w", se.Name, err)
		}
		created++
	}

	slog.Info("exercises seeded", "created", created, "total", len(exercises))
	return nil
}

// SeedPrograms inserts prebuilt programs. Idempotent — programs that already
// exist (by name + is_prebuilt=1) are skipped. Exercises must be seeded first
// since programs reference them by name.
func SeedPrograms(ctx context.Context, db *sql.DB) error {
	// Build a lookup map: exercise name -> ID.
	exerciseIDs, err := buildExerciseIDMap(ctx, db)
	if err != nil {
		return fmt.Errorf("build exercise ID map: %w", err)
	}

	programs := Programs()
	var created int

	for _, sp := range programs {
		// Idempotent check — skip if prebuilt program with this name already exists.
		var count int
		err := db.QueryRowContext(ctx,
			"SELECT COUNT(*) FROM programs WHERE name = ? AND is_prebuilt = 1 AND deleted_at IS NULL",
			sp.Name,
		).Scan(&count)
		if err != nil {
			return fmt.Errorf("check existing program %q: %w", sp.Name, err)
		}
		if count > 0 {
			continue
		}

		// Insert the full tree inside a transaction.
		tx, err := db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin tx for program %q: %w", sp.Name, err)
		}

		if err := insertProgramTree(ctx, tx, sp, exerciseIDs); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("insert program %q: %w", sp.Name, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit program %q: %w", sp.Name, err)
		}

		created++
	}

	slog.Info("programs seeded", "created", created, "total", len(programs))
	return nil
}

// buildExerciseIDMap queries all non-deleted exercises and returns a map
// from exercise name -> internal ID.
func buildExerciseIDMap(ctx context.Context, db *sql.DB) (map[string]int64, error) {
	rows, err := db.QueryContext(ctx,
		"SELECT name, id FROM exercises WHERE deleted_at IS NULL",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]int64)
	for rows.Next() {
		var name string
		var id int64
		if err := rows.Scan(&name, &id); err != nil {
			return nil, err
		}
		m[name] = id
	}
	return m, rows.Err()
}

// insertProgramTree inserts a program with all its workouts, sections, and
// section exercises using raw SQL within the given transaction.
func insertProgramTree(ctx context.Context, tx *sql.Tx, sp seedProgram, exerciseIDs map[string]int64) error {
	now := time.Now().UTC().Format(time.RFC3339)

	// Insert program.
	result, err := tx.ExecContext(ctx, `
		INSERT INTO programs (uuid, name, description, is_prebuilt, created_at, updated_at)
		VALUES (?, ?, ?, 1, ?, ?)
	`, uuid.NewString(), sp.Name, sp.Description, now, now)
	if err != nil {
		return fmt.Errorf("insert program: %w", err)
	}
	programID, _ := result.LastInsertId()

	for wi, sw := range sp.Workouts {
		// Insert workout.
		result, err := tx.ExecContext(ctx, `
			INSERT INTO program_workouts (uuid, program_id, name, day_number, sort_order, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, uuid.NewString(), programID, sw.Name, sw.DayNumber, wi+1, now, now)
		if err != nil {
			return fmt.Errorf("insert workout %q: %w", sw.Name, err)
		}
		workoutID, _ := result.LastInsertId()

		for si, ss := range sw.Sections {
			// Insert section.
			result, err := tx.ExecContext(ctx, `
				INSERT INTO sections (uuid, program_workout_id, name, sort_order, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?)
			`, uuid.NewString(), workoutID, ss.Name, si+1, now, now)
			if err != nil {
				return fmt.Errorf("insert section %q: %w", ss.Name, err)
			}
			sectionID, _ := result.LastInsertId()

			for ei, se := range ss.Exercises {
				exerciseID, ok := exerciseIDs[se.Name]
				if !ok {
					return fmt.Errorf("exercise %q not found — is it seeded?", se.Name)
				}

				var setSchemeJSON *string
				if se.SetScheme != nil {
					b, err := json.Marshal(se.SetScheme)
					if err != nil {
						return fmt.Errorf("marshal set_scheme for %q: %w", se.Name, err)
					}
					s := string(b)
					setSchemeJSON = &s
				}

				_, err := tx.ExecContext(ctx, `
					INSERT INTO section_exercises (uuid, section_id, exercise_id, target_sets, target_reps, target_weight, sort_order, set_scheme, created_at, updated_at)
					VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
				`, uuid.NewString(), sectionID, exerciseID, se.TargetSets, se.TargetReps, se.TargetWeight, ei+1, setSchemeJSON, now, now)
				if err != nil {
					return fmt.Errorf("insert section_exercise %q: %w", se.Name, err)
				}
			}
		}
	}

	return nil
}
