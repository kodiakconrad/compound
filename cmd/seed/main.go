package main

import (
	"context"
	"database/sql"
	"log/slog"
	"os"

	"compound/internal/config"
	"compound/internal/migration"
	"compound/internal/seed"
	"compound/internal/store"

	_ "modernc.org/sqlite"
)

func main() {
	cfgPath := config.ConfigPath("compound.yaml")
	cfg, err := config.Load(cfgPath)
	if err != nil {
		slog.Error("failed to load config", "path", cfgPath, "error", err)
		os.Exit(1)
	}

	db, err := sql.Open("sqlite", cfg.Database.Path+"?_loc=UTC")
	if err != nil {
		slog.Error("failed to open database", "path", cfg.Database.Path, "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := migration.Run(db); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}

	s := store.New(db)

	if err := seed.SeedExercises(context.Background(), s); err != nil {
		slog.Error("failed to seed exercises", "error", err)
		os.Exit(1)
	}

	// Program/template seeds will be added in Step 3.
	slog.Info("seed complete")
}
