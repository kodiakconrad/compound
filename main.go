package main

import (
	"database/sql"
	"log/slog"
	"os"
	"strings"

	"compound/internal/config"
	"compound/internal/migration"
	"compound/internal/server"

	_ "modernc.org/sqlite"
)

func main() {
	// 1. Load configuration.
	cfgPath := config.ConfigPath("compound.yaml")
	cfg, err := config.Load(cfgPath)
	if err != nil {
		slog.Error("failed to load config", "path", cfgPath, "error", err)
		os.Exit(1)
	}

	// 2. Configure slog from config level.
	setupLogger(cfg.Log.Level)

	slog.Info("config loaded", "path", cfgPath)

	// 3. Open SQLite database.
	db, err := sql.Open("sqlite", cfg.Database.Path+"?_loc=UTC")
	if err != nil {
		slog.Error("failed to open database", "path", cfg.Database.Path, "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Enable WAL mode for better concurrent read performance.
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		slog.Error("failed to set WAL mode", "error", err)
		os.Exit(1)
	}

	// 4. Run migrations.
	if err := migration.Run(db); err != nil {
		slog.Error("migration failed", "error", err)
		os.Exit(1)
	}

	// 5. Build server and start.
	srv := server.NewServer(&cfg.Server)

	if err := srv.Start(); err != nil {
		slog.Error("server stopped", "error", err)
		os.Exit(1)
	}
}

func setupLogger(level string) {
	var lvl slog.Level
	switch strings.ToLower(level) {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: lvl})))
}
