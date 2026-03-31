# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install
npm install

# Build
npm run build:api          # Build API app
npm run build:batch        # Build Batch app

# Run locally
npm run start:local        # API with hot reload (NODE_ENV=local)
npm run start:batch:local  # Batch with hot reload

# Lint & Format
npm run lint               # ESLint with auto-fix
npm run format             # Prettier

# Test
npm run test:full          # Full cycle: db down → up → integration tests → db down
npm run test:integration   # Integration tests only (requires running test DB)
npm run test:db:up         # Start test PostgreSQL + Redis via docker-compose.test.yml
npm run test:db:down       # Stop test containers
```

## Architecture

NestJS monorepo with two applications and shared libraries.

### Applications (`apps/`)

- **api** — Main REST API server (port 3000). Bootstrap in `main.ts` sets up Swagger (`/docs`, `/docs-plen`), global validation pipes, exception filters, Morgan logging, and Redis-backed Socket.IO adapter.
- **batch** — Scheduled background jobs (Google Sheets crawler, OpenSearch indexing).

### Shared Libraries (`libs/`)

Path aliases defined in `tsconfig.json`:

| Alias             | Purpose                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------- |
| `@app/database`   | TypeORM + PostgreSQL (SnakeNamingStrategy, auto-sync)                                        |
| `@app/config`     | Environment config loader (`env/local.ts`, `dev.ts`, `test.ts`, `prod.ts`)                   |
| `@app/repository` | Entities (50+), repository services, DTOs, enums                                             |
| `@app/common`     | Swagger docs helpers, exception filters, Winston logger, email templates, utilities          |
| `@app/external`   | External API clients: AWS S3, Google (Sheets/Drive/Gmail), Kakao, OpenAI, OpenSearch, Serper |
| `@app/cache`      | Redis caching service (`@liaoliaots/nestjs-redis`)                                           |
| `@app/auth`       | JWT auth, Passport strategies, email verification                                            |
| `@app/socket`     | Socket.IO gateway for real-time features (chat, plan rooms)                                  |
| `@app/http`       | HTTP client utilities                                                                        |

### Key Patterns

- **Auth**: JWT-based with guards in `apps/api/src/guard/` — `AdminRoleGuard`, `RefreshTokenGuard`, `KakaoGuard`, `OneTimeTokenGuard`. Role-based access via `@AdminRole` decorator.
- **Transactions**: `typeorm-transactional` — initialize in `main.ts`, use in repository services.
- **Multilingual**: `Accept-Language` header (ko/en/zh) drives response language selection.
- **Product Search**: OpenSearch index `product-items` with full-text search, filtering, and sorting.
- **Error Handling**: Three global filters — `HttpExceptionFilter`, `ServiceErrorFilter`, `InternalExceptionFilter`. Use `ServiceError` class for business errors.
- **Logging**: Winston structured JSON logs + Morgan HTTP request logs with UUID scope per request.

## Code Style

- ESLint enforces **max 50 lines per function** (`max-lines-per-function`).
- `no-console: warn` (only `console.warn`/`console.error` allowed).
- Import sorting enforced via `simple-import-sort`. Unused imports are errors.
- Prettier: single quotes, semicolons, trailing commas, 80 char width.

## Testing

- Integration/E2E tests preferred over mocked unit tests.
- BDD pattern with Given-When-Then comments.
- Test infra: `docker-compose.test.yml` runs PostgreSQL (port 5433) + Redis (port 6380).
- Use `Testcontainers` for real DB instances, `@faker-js/faker` for test data.

## Conventions (from .cursorrules)

- Strictly follow NestJS modular architecture: Module → Controller → Service.
- Validate requests with DTOs using `class-validator` / `class-transformer`.
- Business logic in Service layer, not Controllers.
- Apply `@nestjs/swagger` decorators on all controllers and DTOs (`@ApiOperation`, `@ApiProperty` with descriptions and examples).
- Avoid `any` type — define explicit types.
- Use `ServiceError` for error handling, not raw exceptions.

## Deployment

- Docker multi-stage build (node:20). Build arg `APP` selects api or batch.
- GitHub Actions → AWS ECR → ECS. Workflows: `deploy-main.yml` (prod), `deploy-dev.yml` (dev).
- DEV ECR region: ap-northeast-2.
- PROD ECR region: ap-east-2.
