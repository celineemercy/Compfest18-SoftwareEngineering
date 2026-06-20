# Day 1: Groundwork & Architecture

This repository is set up as a monorepo with a NestJS API, React/Vite web app, Dockerized PostgreSQL database, and a sandbox branch workflow.

## 1. Monorepo Layout

```text
apps/
  api/    NestJS backend
  web/    React + Vite frontend
```

Root scripts are available from `package.json`:

```powershell
npm run dev:api
npm run dev:web
npm run build:api
npm run build:web
```

## 2. Environment Files

Create local env files from the committed examples:

```powershell
Copy-Item .env.example .env
Copy-Item apps/api/.env.example apps/api/.env
```

The Postgres container reads the root `.env` through `docker-compose.yaml`.

The NestJS API loads env values from:

1. `apps/api/.env`
2. root `.env`

That keeps database credentials available whether commands are run from the repo root or from `apps/api`.

## 3. PostgreSQL Container

Start the database:

```powershell
npm run db:up
```

Check Compose configuration:

```powershell
npm run setup:check
```

Watch database logs:

```powershell
npm run db:logs
```

Stop the database:

```powershell
npm run db:down
```

## 4. Prisma

Generate the Prisma client:

```powershell
npm run prisma:generate
```

Run migrations:

```powershell
npm run prisma:migrate
```

## 5. Sandbox Branch Workflow

Keep `main` stable. For each level, start from the latest `main` and create a dedicated branch:

```powershell
git checkout main
git pull
git checkout -b feature/level-1-auth
```

For later levels, repeat the same pattern:

```powershell
git checkout main
git pull
git checkout -b feature/level-2-product-catalog
git checkout -b feature/level-3-orders
```

The current working branch is:

```powershell
git branch --show-current
```
