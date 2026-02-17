---
name: github-actions
description: GitHub Actions CI/CD expertise for automating workflows, testing, building, and deploying applications. Covers workflow syntax, reusable workflows, matrix builds, and deployment patterns.
category: devops
compatible_with:
  - docker
  - aws
  - jest
  - playwright
---

# GitHub Actions CI/CD

## Instructions

1. **Assess the workflow need**: CI (test/lint), CD (deploy), or automation.
2. **Follow GitHub Actions best practices**:
   - Use specific action versions
   - Cache dependencies
   - Use secrets for sensitive data
   - Minimize workflow run time
3. **Provide complete workflows**: Include all necessary steps and configuration.
4. **Guide on security**: Secrets management, OIDC, least privilege.

## Workflow Structure

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Run tests
        run: npm test
```

## Common Triggers

```yaml
on:
  # Push to branches
  push:
    branches: [main, develop]
    paths:
      - 'src/**'
      - 'package.json'
    paths-ignore:
      - '**.md'
      - 'docs/**'

  # Pull requests
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened]

  # Manual trigger
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production

  # Scheduled
  schedule:
    - cron: '0 2 * * *'  # 2 AM UTC daily

  # On release
  release:
    types: [published]

  # Called by other workflows
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
    secrets:
      deploy_key:
        required: true
```

## Caching

```yaml
# Node.js with npm
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'

# Custom cache
- uses: actions/cache@v4
  with:
    path: |
      ~/.npm
      node_modules
    key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-node-

# Rust
- uses: Swatinem/rust-cache@v2

# Go
- uses: actions/cache@v4
  with:
    path: |
      ~/go/pkg/mod
      ~/.cache/go-build
    key: ${{ runner.os }}-go-${{ hashFiles('**/go.sum') }}
```

## Matrix Builds

```yaml
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [18, 20, 22]
        exclude:
          - os: windows-latest
            node: 18
        include:
          - os: ubuntu-latest
            node: 20
            coverage: true
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
      - run: npm ci
      - run: npm test
      - if: matrix.coverage
        run: npm run coverage
```

## Secrets and Environment Variables

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production  # GitHub environment with secrets
    env:
      CI: true
    steps:
      - name: Deploy
        env:
          API_KEY: ${{ secrets.API_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
        run: |
          echo "Deploying to production"
          ./deploy.sh
```

## Artifacts

```yaml
# Upload artifacts
- uses: actions/upload-artifact@v4
  with:
    name: build-output
    path: dist/
    retention-days: 5

# Download artifacts
- uses: actions/download-artifact@v4
  with:
    name: build-output
    path: dist/
```

## Job Dependencies

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - id: version
        run: echo "version=$(cat VERSION)" >> $GITHUB_OUTPUT

  test:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - run: echo "Testing version ${{ needs.build.outputs.version }}"

  deploy:
    needs: [build, test]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying"
```

## Reusable Workflows

```yaml
# .github/workflows/reusable-deploy.yml
name: Reusable Deploy

on:
  workflow_call:
    inputs:
      environment:
        required: true
        type: string
      image_tag:
        required: true
        type: string
    secrets:
      DEPLOY_KEY:
        required: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - name: Deploy
        run: |
          echo "Deploying ${{ inputs.image_tag }} to ${{ inputs.environment }}"

# Calling workflow
jobs:
  call-deploy:
    uses: ./.github/workflows/reusable-deploy.yml
    with:
      environment: staging
      image_tag: v1.0.0
    secrets:
      DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
```

## Complete CI/CD Pipeline

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/test

  build:
    needs: [lint, test]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/

  deploy-staging:
    needs: build
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: staging
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build
          path: dist/
      - name: Deploy to staging
        run: echo "Deploying to staging"

  deploy-production:
    needs: deploy-staging
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build
          path: dist/
      - name: Deploy to production
        run: echo "Deploying to production"
```

## Docker Build and Push

```yaml
jobs:
  docker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Login to Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ghcr.io/${{ github.repository }}:${{ github.sha }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

## Conditional Execution

```yaml
steps:
  - name: Only on main
    if: github.ref == 'refs/heads/main'
    run: echo "Main branch"

  - name: Only on PR
    if: github.event_name == 'pull_request'
    run: echo "Pull request"

  - name: Continue on error
    continue-on-error: true
    run: might-fail.sh

  - name: Run if previous failed
    if: failure()
    run: echo "Previous step failed"

  - name: Always run
    if: always()
    run: cleanup.sh
```

## Best Practices

- **Pin action versions** - Use `@v4` or commit SHA, not `@main`
- **Use caching** - Dramatically speeds up builds
- **Fail fast** - Use `fail-fast: false` only when needed
- **Use environments** - For deployment protection rules
- **Minimize secrets scope** - Only pass secrets where needed
- **Use OIDC** - For cloud provider authentication (AWS, GCP, Azure)
- **Concurrency control** - Cancel in-progress runs for same branch

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

## References

- GitHub Actions Documentation: https://docs.github.com/en/actions
- Workflow Syntax: https://docs.github.com/en/actions/reference/workflow-syntax-for-github-actions
- Actions Marketplace: https://github.com/marketplace?type=actions
