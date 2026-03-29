.PHONY: install dev test build run push deploy check clean help

# Configuration — override with environment variables
DOCKER_USER ?= YOUR_DOCKERHUB_USERNAME
IMAGE_NAME  ?= nosana-mcp-agent
IMAGE_TAG   ?= latest
IMAGE       := $(DOCKER_USER)/$(IMAGE_NAME):$(IMAGE_TAG)
NOSANA_MARKET ?= nvidia-a5000
MODEL       ?= qwen3.5:9b

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies
	bun install

dev: ## Start agent locally (requires Ollama running)
	bun run start

test: ## Run test client against running agent
	bun run test

check: ## Type-check the project
	bunx tsc --noEmit

build: ## Build Docker image
	docker build -t $(IMAGE_NAME) .

run: ## Run Docker container locally
	docker run --rm -p 3000:3000 $(IMAGE_NAME)

run-gpu: ## Run Docker container with GPU
	docker run --rm --gpus all -p 3000:3000 $(IMAGE_NAME)

push: build ## Build and push Docker image to registry
	docker tag $(IMAGE_NAME) $(IMAGE)
	docker push $(IMAGE)

deploy: ## Deploy to Nosana GPU network
	@echo "Deploying to Nosana market: $(NOSANA_MARKET)"
	nosana job post \
		--file job-definition.json \
		--market $(NOSANA_MARKET) \
		--gpu \
		--wait

validate: ## Validate Nosana job definition
	nosana job validate job-definition.json

markets: ## List available Nosana GPU markets
	nosana market list

pull-model: ## Pull the Qwen3.5 model via Ollama
	ollama pull $(MODEL)
	ollama pull nomic-embed-text:latest

clean: ## Remove build artifacts
	rm -rf dist node_modules
