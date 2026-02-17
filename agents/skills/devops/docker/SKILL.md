---
name: docker
description: Docker containerization expertise for building, running, and orchestrating containers. Covers Dockerfiles, multi-stage builds, Docker Compose, networking, and production best practices.
category: devops
compatible_with:
  - kubernetes
  - github-actions
  - terraform
---

# Docker Containerization

## Instructions

1. **Assess the containerization need**: Determine if it's single container, multi-container, or production deployment.
2. **Follow Docker best practices**:
   - Use official base images
   - Minimize layers and image size
   - Don't run as root
   - Use multi-stage builds for compiled languages
3. **Provide complete examples**: Include Dockerfiles, compose files, and commands.
4. **Guide on security**: Image scanning, secrets management, least privilege.

## Dockerfile Basics

```dockerfile
# Use specific version tags, not 'latest'
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first (layer caching)
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Expose port (documentation)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Start command
CMD ["node", "server.js"]
```

## Multi-Stage Builds

### Node.js Application

```dockerfile
# Build stage
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./

USER node
EXPOSE 3000
CMD ["node", "dist/server.js"]
```

### Go Application

```dockerfile
# Build stage
FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -o /app/main .

# Production stage (scratch for minimal image)
FROM scratch
COPY --from=builder /app/main /main
COPY --from=builder /etc/ssl/certs/ca-certificates.crt /etc/ssl/certs/
EXPOSE 8080
ENTRYPOINT ["/main"]
```

### Rust Application

```dockerfile
FROM rust:1.75 AS builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --release

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/target/release/myapp /usr/local/bin/
EXPOSE 8080
CMD ["myapp"]
```

## Docker Compose

### Development Setup

```yaml
# docker-compose.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - .:/app
      - /app/node_modules  # Anonymous volume for node_modules
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://user:pass@db:5432/mydb
    depends_on:
      db:
        condition: service_healthy

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: pass
      POSTGRES_DB: mydb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user -d mydb"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
```

### Production Setup

```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    image: myregistry/myapp:${VERSION:-latest}
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
    environment:
      - NODE_ENV=production
    secrets:
      - db_password
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

secrets:
  db_password:
    external: true
```

## Common Commands

```bash
# Build
docker build -t myapp:latest .
docker build -t myapp:latest --no-cache .
docker build -t myapp:latest --target builder .  # Multi-stage target

# Run
docker run -d --name myapp -p 3000:3000 myapp:latest
docker run -it --rm myapp:latest sh  # Interactive shell
docker run --env-file .env myapp:latest  # With env file

# Compose
docker compose up -d
docker compose up -d --build  # Rebuild
docker compose down -v  # Remove volumes
docker compose logs -f app  # Follow logs
docker compose exec app sh  # Shell into running container

# Inspect
docker ps -a
docker logs myapp
docker inspect myapp
docker stats  # Resource usage

# Cleanup
docker system prune -a  # Remove all unused
docker volume prune  # Remove unused volumes
docker image prune -a  # Remove unused images
```

## Networking

```yaml
# Custom networks for isolation
version: '3.8'

services:
  frontend:
    networks:
      - frontend

  api:
    networks:
      - frontend
      - backend

  db:
    networks:
      - backend

networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true  # No external access
```

## Best Practices

### Image Size Optimization

```dockerfile
# Use alpine base images
FROM node:20-alpine  # ~180MB vs node:20 ~1GB

# Combine RUN commands
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl && \
    rm -rf /var/lib/apt/lists/*

# Use .dockerignore
# .dockerignore
node_modules
.git
*.md
.env*
```

### Security

```dockerfile
# Don't run as root
USER node

# Use specific versions
FROM node:20.10.0-alpine3.19

# Scan images
# docker scout cves myapp:latest

# Don't store secrets in images
# Use Docker secrets or environment variables at runtime
```

### Layer Caching

```dockerfile
# Order from least to most frequently changed
COPY package*.json ./
RUN npm ci
COPY . .  # Application code last
```

## Development vs Production

```dockerfile
# Dockerfile.dev
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install  # Include devDependencies
COPY . .
CMD ["npm", "run", "dev"]

# Dockerfile (production)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/server.js"]
```

## Debugging

```bash
# Shell into running container
docker exec -it myapp sh

# Shell into stopped container
docker run -it --entrypoint sh myapp:latest

# Copy files from container
docker cp myapp:/app/logs ./logs

# View container processes
docker top myapp

# Inspect layers
docker history myapp:latest
```

## References

- Docker Documentation: https://docs.docker.com/
- Dockerfile Best Practices: https://docs.docker.com/develop/develop-images/dockerfile_best-practices/
- Docker Compose: https://docs.docker.com/compose/
