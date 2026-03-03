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
	rm -f compound.db compound.db-shm compound.db-wal compound.db-journal
	@echo "Database deleted. Run 'make run' to recreate, then 'make seed' to repopulate."
