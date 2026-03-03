package acceptance

import (
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

func TestFeatures(t *testing.T) {
	// Set up in-memory SQLite database.
	db, err := sql.Open("sqlite", ":memory:")
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

	s := store.New(db)
	testCfg := server.TestServerConfig()
	srv := server.NewServer(&testCfg, s)
	testServer = httptest.NewServer(srv.Router())
	defer testServer.Close()

	// Skip if no .feature files exist yet (Step 1 has none).
	features, _ := filepath.Glob("features/*.feature")
	if len(features) == 0 {
		t.Skip("no feature files found — skipping acceptance tests")
	}

	suite := godog.TestSuite{
		ScenarioInitializer: func(ctx *godog.ScenarioContext) {
			// Step definitions will be registered here in Step 2+.
		},
		Options: &godog.Options{
			Format:   "pretty",
			Paths:    []string{"features"},
			TestingT: t,
		},
	}

	if suite.Run() != 0 {
		t.Fatal("non-zero exit from godog")
	}
}
