# Contributing to Baktana English (formerly Baktana English)

## Setup

Requirements: Node 22.15+ (`nvm use` reads `.nvmrc`).

```bash
npm install          # installs web deps, then server/ deps via postinstall
cp .env.example .env # optional: server settings (PORT, DATABASE_PATH, JWT_SECRET, NODE_ENV)
npm run dev          # web (Vite, http://localhost:5173) + API server (http://localhost:3001)
```

`npm run dev:web` runs only the web app. It works without the server (guest mode, progress in localStorage);
Vite proxies `/api` to `http://localhost:3001` (override with `API_URL` or `PORT`).

## Scripts

| Script                 | What it does                                                           |
| ---------------------- | ---------------------------------------------------------------------- |
| `npm run dev`          | Web + server together (concurrently)                                   |
| `npm run dev:web`      | Vite dev server only                                                   |
| `npm run dev:server`   | API server only (`npm --prefix server run dev`)                        |
| `npm run build`        | Typecheck + production web build into `dist/`                          |
| `npm start`            | Start the server (`npm --prefix server start`); serves `dist/` in prod |
| `npm test`             | Web tests (vitest) + server tests                                      |
| `npm run typecheck`    | `tsc -b` for web/shared + server typecheck                             |
| `npm run lint`         | ESLint over the repo                                                   |
| `npm run format:check` | Prettier check (`npm run format` to write – only on files you own)     |
| `npm run check`        | Everything CI runs: typecheck, lint, test, build                       |

Server scripts are skipped automatically while `server/package.json` does not exist (`tools/if-server.mjs`).

## Project layout

```
src/        React web app (Hebrew, RTL)
shared/     api.ts – the HTTP contract between web and server
server/     Express + SQLite (node:sqlite) API, its own package.json and tsconfig
public/     static files, PWA manifest, icons, service worker
tools/      repo tooling (conditional server scripts, TypeScript API for ESLint)
```

## Rules of the road

- **`shared/api.ts` is a contract.** Change it only together with both the web client and the server.
- **Pure modules** (`src/lib/progress.ts`, `answer.ts`, `exercises.ts`) are also used by the server: add new exports,
  but don't change existing signatures.
- Code style: 2 spaces, single quotes, semicolons, trailing commas, ~120 columns (Prettier + EditorConfig).
  Don't reformat files you aren't otherwise changing.
- User-facing text is in Hebrew; the layout is right-to-left.
- Keep the app working without a backend.
- Before opening a PR run `npm run check`. CI runs the same steps on Node 22.

## TypeScript & ESLint note

`tsc` is TypeScript 7 (the native compiler), which has no JavaScript API. typescript-eslint needs one, so ESLint
loads TypeScript 6 from `tools/eslint-typescript/` (see `tools/eslint-typescript/register.mjs`). Nothing else uses it.

## Docker

```bash
JWT_SECRET=$(openssl rand -hex 32) docker compose up --build   # http://localhost:3001
```

The image builds the web app and runs the server with `NODE_ENV=production`; the SQLite file lives on the
`baktana-data` volume (`DATABASE_PATH=/app/data/baktana.db`).
