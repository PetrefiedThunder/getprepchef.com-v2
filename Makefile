.PHONY: help dev build test lint clean seed docker-up docker-down docker-logs

# Default target
.DEFAULT_GOAL := help

# Colors for output
CYAN := \033[0;36m
RESET := \033[0m

help: ## Show this help message
	@echo "$(CYAN)PrepChef - Available Commands$(RESET)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(CYAN)%-20s$(RESET) %s\n", $$1, $$2}'

# Development
dev: ## Start development server (hot reload)
	@echo "$(CYAN)Starting development server...$(RESET)"
	@cd server && npm run dev

dev-docker: ## Start development server with Docker Compose
	@echo "$(CYAN)Starting Docker development environment...$(RESET)"
	@cd server && docker-compose --profile dev up

# Build
build: ## Build production server
	@echo "$(CYAN)Building server...$(RESET)"
	@cd server && npm run build

build-docker: ## Build Docker image
	@echo "$(CYAN)Building Docker image...$(RESET)"
	@cd server && docker build -t prepchef-server .

# Testing
test: ## Run all tests
	@echo "$(CYAN)Running tests...$(RESET)"
	@cd server && npm test

test-watch: ## Run tests in watch mode
	@echo "$(CYAN)Running tests in watch mode...$(RESET)"
	@cd server && npm run test:watch

test-coverage: ## Generate test coverage report
	@echo "$(CYAN)Generating coverage report...$(RESET)"
	@cd server && npm run test:coverage

# Linting
lint: ## Lint code
	@echo "$(CYAN)Linting code...$(RESET)"
	@cd server && npm run lint

lint-fix: ## Fix linting issues
	@echo "$(CYAN)Fixing linting issues...$(RESET)"
	@cd server && npm run lint:fix

typecheck: ## Type check code
	@echo "$(CYAN)Type checking...$(RESET)"
	@cd server && npm run typecheck

# Database
seed: ## Seed database with demo data
	@echo "$(CYAN)Seeding database...$(RESET)"
	@cd server && npm run seed:all

seed-regulations: ## Seed regulatory data only
	@echo "$(CYAN)Seeding regulatory data...$(RESET)"
	@cd server && npm run seed:regulations

seed-demo: ## Seed demo data only
	@echo "$(CYAN)Seeding demo data...$(RESET)"
	@cd server && npm run seed:demo

# Docker operations
docker-up: ## Start all services with Docker Compose
	@echo "$(CYAN)Starting Docker services...$(RESET)"
	@cd server && docker-compose up -d

docker-down: ## Stop all Docker services
	@echo "$(CYAN)Stopping Docker services...$(RESET)"
	@cd server && docker-compose down

docker-logs: ## View Docker logs
	@cd server && docker-compose logs -f

docker-clean: ## Stop and remove all Docker containers and volumes
	@echo "$(CYAN)Cleaning Docker environment...$(RESET)"
	@cd server && docker-compose down -v
	@docker system prune -f

# Setup
install: ## Install dependencies
	@echo "$(CYAN)Installing server dependencies...$(RESET)"
	@cd server && npm install

setup: install ## Full setup (install + env)
	@echo "$(CYAN)Setting up environment...$(RESET)"
	@if [ ! -f server/.env ]; then cp server/.env.example server/.env; echo "Created server/.env from example"; fi
	@echo "$(CYAN)Setup complete! Edit server/.env with your configuration.$(RESET)"

# Cleanup
clean: ## Clean build artifacts and dependencies
	@echo "$(CYAN)Cleaning...$(RESET)"
	@cd server && rm -rf dist node_modules coverage
	@echo "$(CYAN)Clean complete$(RESET)"

# Quick start
quickstart: setup docker-up seed ## Quick start: setup + docker + seed
	@echo "$(CYAN)PrepChef is running!$(RESET)"
	@echo ""
	@echo "API: http://localhost:3000"
	@echo "Health: http://localhost:3000/health"
	@echo ""
	@echo "Next steps:"
	@echo "  - View logs: make docker-logs"
	@echo "  - Stop services: make docker-down"

# Production
start: build ## Start production server
	@echo "$(CYAN)Starting production server...$(RESET)"
	@cd server && npm start
