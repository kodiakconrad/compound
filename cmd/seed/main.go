package main

import (
	"context"
	"database/sql"
	"log/slog"
	"os"

	"compound/internal/config"
	"compound/internal/migration"
	"compound/internal/seed"

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

	if err := seed.SeedExercises(context.Background(), db); err != nil {
		slog.Error("failed to seed exercises", "error", err)
		os.Exit(1)
	}

	if err := seed.SeedPrograms(context.Background(), db); err != nil {
		slog.Error("failed to seed programs", "error", err)
		os.Exit(1)
	}

	if err := seed.SeedProgress(context.Background(), db); err != nil {
		slog.Error("failed to seed progress", "error", err)
		os.Exit(1)
	}

	slog.Info("seed complete")
}
