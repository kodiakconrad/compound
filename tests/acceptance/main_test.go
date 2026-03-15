package acceptance

import (
	"context"
	"database/sql"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/cucumber/godog"

	"compound/internal/migration"
	"compound/internal/server"
	"compound/internal/store"

	_ "modernc.org/sqlite"
)

// testServer is the shared httptest server for all scenarios.
var testServer *httptest.Server

// testDB is the shared database for direct inserts in step definitions.
var testDB *sql.DB

func TestFeatures(t *testing.T) {
	// Set up a file-based SQLite database in a temp directory so that
	// timestamps are serialized to TEXT on disk (matching production behaviour).
	// t.TempDir() is automatically cleaned up when the test completes.
	dbPath := filepath.Join(t.TempDir(), "test.db")
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("open test db: %v", err)
	}
	defer db.Close()

	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		t.Fatalf("enable foreign keys: %v", err)
	}

	if err := migration.Run(db); err != nil {
		t.Fatalf("run migrations: %v", err)
	}

	testDB = db
	s := store.New(db)
	testCfg := server.TestServerConfig()
	srv := server.NewServer(&testCfg, s)
	testServer = httptest.NewServer(srv.Router())
	defer testServer.Close()

	suite := godog.TestSuite{
		ScenarioInitializer: func(ctx *godog.ScenarioContext) {
			client := NewTestClient(testServer.URL, testDB)

			// Truncate all tables before each scenario (reverse FK order).
			ctx.Before(func(goCtx context.Context, sc *godog.Scenario) (context.Context, error) {
				tables := []string{
					"set_logs", "sessions", "cycles",
					"progression_rules", "section_exercises", "sections",
					"program_workouts", "programs", "exercises",
					"idempotency_keys",
				}
				for _, table := range tables {
					if _, err := testDB.Exec("DELETE FROM " + table); err != nil {
						return goCtx, err
					}
				}
				return goCtx, nil
			})

			InitializeCommonSteps(ctx, client)
			InitializeExerciseSteps(ctx, client)
			InitializeProgramSteps(ctx, client)
			InitializeScaffoldSteps(ctx, client)
			InitializeCycleSteps(ctx, client)
			InitializeSessionSteps(ctx, client)
			InitializeProgressSteps(ctx, client)
		},
		Options: &godog.Options{
			Format:   "pretty",
			Paths:    []string{"features"},
			Tags:     "~@wip",
			TestingT: t,
		},
	}

	if suite.Run() != 0 {
		t.Fatal("non-zero exit from godog")
	}
}
