package seed

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"compound/internal/domain"
	"compound/internal/store"

	"github.com/google/uuid"
)

// SeedExercises inserts all prebuilt exercises. Idempotent — exercises that
// already exist (by name) are skipped.
func SeedExercises(ctx context.Context, s *store.Store) error {
	exercises := Exercises()
	var created int

	for _, se := range exercises {
		// Check if exercise already exists by name.
		var count int
		err := s.DB.QueryRowContext(ctx,
			"SELECT COUNT(*) FROM exercises WHERE name = ? AND deleted_at IS NULL",
			se.Name,
		).Scan(&count)
		if err != nil {
			return err
		}
		if count > 0 {
			continue
		}

		mg := se.MuscleGroup
		eq := se.Equipment
		e := &domain.Exercise{
			Name:         se.Name,
			MuscleGroup:  &mg,
			Equipment:    &eq,
			TrackingType: se.TrackingType,
			IsCustom:     false,
		}

		if err := s.CreateExercise(ctx, s.DB, e); err != nil {
			return err
		}
		created++
	}

	slog.Info("exercises seeded", "created", created, "total", len(exercises))
	return nil
}

// SeedPrograms inserts prebuilt programs. Idempotent — programs that already
// exist (by name + is_prebuilt=1) are skipped. Exercises must be seeded first
// since programs reference them by name.
func SeedPrograms(ctx context.Context, s *store.Store) error {
	// Build a lookup map: exercise name → UUID.
	exerciseUUIDs, err := buildExerciseUUIDMap(ctx, s)
	if err != nil {
		return fmt.Errorf("build exercise UUID map: %w", err)
	}

	programs := Programs()
	var created int

	for _, sp := range programs {
		// Idempotent check — skip if prebuilt program with this name already exists.
		var count int
		err := s.DB.QueryRowContext(ctx,
			"SELECT COUNT(*) FROM programs WHERE name = ? AND is_prebuilt = 1 AND deleted_at IS NULL",
			sp.Name,
		).Scan(&count)
		if err != nil {
			return fmt.Errorf("check existing program %q: %w", sp.Name, err)
		}
		if count > 0 {
			continue
		}

		// Convert the seed definition to a domain.Program tree.
		prog, err := buildDomainProgram(sp, exerciseUUIDs)
		if err != nil {
			return fmt.Errorf("build program %q: %w", sp.Name, err)
		}

		// Insert the full tree inside a transaction.
		tx, err := s.DB.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("begin tx for program %q: %w", sp.Name, err)
		}

		if _, err := s.ScaffoldProgram(ctx, tx, prog); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("scaffold program %q: %w", sp.Name, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("commit program %q: %w", sp.Name, err)
		}

		created++
	}

	slog.Info("programs seeded", "created", created, "total", len(programs))
	return nil
}

// buildExerciseUUIDMap queries all non-deleted exercises and returns a map
// from exercise name → UUID.
func buildExerciseUUIDMap(ctx context.Context, s *store.Store) (map[string]string, error) {
	rows, err := s.DB.QueryContext(ctx,
		"SELECT name, uuid FROM exercises WHERE deleted_at IS NULL",
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	m := make(map[string]string)
	for rows.Next() {
		var name, uid string
		if err := rows.Scan(&name, &uid); err != nil {
			return nil, err
		}
		m[name] = uid
	}
	return m, rows.Err()
}

// buildDomainProgram converts a seedProgram definition into a domain.Program
// tree ready for ScaffoldProgram. Exercise names are resolved to UUIDs via the
// lookup map.
func buildDomainProgram(sp seedProgram, exerciseUUIDs map[string]string) (*domain.Program, error) {
	now := time.Now().UTC()
	desc := sp.Description

	p := &domain.Program{
		UUID:        uuid.NewString(),
		Name:        sp.Name,
		Description: &desc,
		IsPrebuilt:  true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	for _, sw := range sp.Workouts {
		w := &domain.ProgramWorkout{
			UUID:      uuid.NewString(),
			Name:      sw.Name,
			DayNumber: sw.DayNumber,
			CreatedAt: now,
			UpdatedAt: now,
		}

		for j, ss := range sw.Sections {
			sec := &domain.Section{
				UUID:      uuid.NewString(),
				Name:      ss.Name,
				SortOrder: j + 1,
				CreatedAt: now,
				UpdatedAt: now,
			}

			for k, se := range ss.Exercises {
				exUUID, ok := exerciseUUIDs[se.Name]
				if !ok {
					return nil, fmt.Errorf("exercise %q not found — is it seeded?", se.Name)
				}

				sec.Exercises = append(sec.Exercises, &domain.SectionExercise{
					UUID:         uuid.NewString(),
					ExerciseUUID: exUUID,
					TargetSets:   se.TargetSets,
					TargetReps:   se.TargetReps,
					TargetWeight: se.TargetWeight,
					SetScheme:    se.SetScheme,
					SortOrder:    k + 1,
					CreatedAt:    now,
					UpdatedAt:    now,
				})
			}

			w.Sections = append(w.Sections, sec)
		}

		p.Workouts = append(p.Workouts, w)
	}

	return p, nil
}
