package main

import (
	"database/sql"
	"log/slog"
	"os"

	"compound/internal/config"
	"compound/internal/migration"

	_ "modernc.org/sqlite"
)

func main() {
	cfgPath := config.ConfigPath("compound.yaml")
	cfg, err := config.Load(cfgPath)
	if err != nil {
		slog.Error("failed to load config", "path", cfgPath, "error", err)
		os.Exit(1)
	}

	db, err := sql.Open("sqlite", cfg.Database.Path)
	if err != nil {
		slog.Error("failed to open database", "path", cfg.Database.Path, "error", err)
		os.Exit(1)
	}
	defer db.Close()

	if err := migration.Run(db); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}

	// Seed functions will be added in Step 2 (exercises) and Step 3 (programs/templates).
	slog.Info("seed complete (no seed data defined yet)")
}
