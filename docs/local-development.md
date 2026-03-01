# Local Development

How to run and develop the Compound backend locally.

## Prerequisites

- Go 1.26+

## First Run

```bash
go run main.go
```

On first run the app will:
1. Generate a default `compound.yaml` config file in the current directory (if one doesn't exist)
2. Create the SQLite database file at the configured path (`./compound.db` by default)
3. Run all pending migrations
4. Start the HTTP server

The database will be empty (no exercises or templates). Run `make seed` to populate it.

## Config File

`compound.yaml` is auto-generated on first run with these defaults:

```yaml
server:
  port: 8080
  host: "localhost"

database:
  path: "compound.db"

log:
  level: "info"   # debug, info, warn, error
```

The config file path can be overridden with the `COMPOUND_CONFIG` environment variable:

```bash
COMPOUND_CONFIG=/path/to/config.yaml go run main.go
```

`compound.yaml` is gitignored — each developer has their own local config.

## Database

SQLite database lives at `./compound.db` by default (configurable in `compound.yaml`).

- **Migrations** run automatically on server startup — no manual step needed
- **Reset**: delete the file and restart: `rm compound.db && go run main.go`

## Seeding

Seed data (exercises + prebuilt program templates) is loaded via a separate command:

```bash
make seed
```

This runs `go run cmd/seed/main.go`, which:
- Reads the same `compound.yaml` config to find the database
- Inserts ~80-100 common exercises (bench press, squat, deadlift, etc.)
- Inserts prebuilt program templates (5/3/1, PPL, Starting Strength) with `is_template=1, is_prebuilt=1`
- Is idempotent — safe to run multiple times (skips existing records)

## Makefile

```makefile
.PHONY: run build test vet seed reset-db

# Start the server
run:
	go run main.go

# Compile the binary
build:
	go build -o compound .

# Run all tests
test:
	go test ./...

# Static analysis
vet:
	go vet ./...

# Seed exercises and prebuilt templates
seed:
	go run cmd/seed/main.go

# Delete the database and restart fresh
reset-db:
	rm -f compound.db
	@echo "Database deleted. Run 'make run' to recreate, then 'make seed' to repopulate."
```

## Project Layout for Commands

```
/compound
  main.go              — server entrypoint
  cmd/
    seed/
      main.go          — seed data entrypoint
```

Both entrypoints share the same `internal/` packages (config, store, domain, migration).

## Typical Workflow

```bash
# First time setup
make run              # generates config, creates DB, runs migrations, starts server
# (Ctrl+C to stop)
make seed             # populate exercises and templates

# Daily development
make run              # start server
# edit code...
# Ctrl+C, then make run again (sub-second restart)

# Testing
make test             # run all tests
make vet              # static analysis

# Start over
make reset-db         # delete DB
make run              # recreate
make seed             # repopulate
```

## Testing API Endpoints

No frontend in Phase 1. Test with curl:

```bash
# List exercises
curl http://localhost:8080/api/exercises

# Create a custom exercise
curl -X POST http://localhost:8080/api/exercises \
  -H "Content-Type: application/json" \
  -d '{"name": "Bulgarian Split Squat", "muscle_group": "legs", "equipment": "dumbbell", "tracking_type": "weight_reps"}'

# Get a program with full tree
curl http://localhost:8080/api/programs/{uuid}
```
