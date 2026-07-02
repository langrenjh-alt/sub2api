.PHONY: wire build build-api build-embed test-unit test-integration test-e2e test-cover-integration

VERSION ?= $(shell ./scripts/resolve-version.sh)
LDFLAGS ?= -s -w -X main.Version=$(VERSION)

wire:
	@echo "Generating Wire code..."
	@cd cmd/server && go generate
	@echo "Wire code generated"

build:
	@echo "Building backend with embedded frontend..."
	@go build -tags embed -o bin/server ./cmd/server
	@echo "Build complete: bin/server (with embedded frontend)"

build-api:
	@echo "Building backend API-only binary..."
	@go build -o bin/server ./cmd/server
	@echo "Build complete: bin/server"

build-embed:
	@echo "Building backend with embedded frontend..."
	@go build -tags embed -o bin/server ./cmd/server
	@echo "Build complete: bin/server (with embedded frontend)"

test-unit:
	@go test -tags unit ./... -count=1

test-integration:
	@go test -tags integration ./... -count=1 -race -parallel=8

test-e2e:
	@echo "Running E2E tests (requires local server)..."
	@go test -tags e2e ./internal/integration/... -count=1 -v

test-cover-integration:
	@echo "Running integration tests and generating coverage report..."
	@go test -tags=integration -cover -coverprofile=coverage.out -count=1 -race -parallel=8 ./...
	@go tool cover -func=coverage.out | tail -1
	@go tool cover -html=coverage.out -o coverage.html
	@echo "Coverage report generated: coverage.html"

clean-coverage:
	@rm -f coverage.out coverage.html
	@echo "Coverage files cleaned"

clean: clean-coverage
	@rm -rf bin/
	@echo "Build artifacts cleaned"
