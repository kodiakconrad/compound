package seed

import (
	"context"
	"log/slog"

	"compound/internal/domain"
	"compound/internal/store"
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
