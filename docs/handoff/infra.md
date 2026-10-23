# Handoff – Infrastructure (branch `agent/infra`)

## What I built

- **Root scripts** (`package.json`): `dev` (web + server via concurrently), `dev:web`, `dev:server`, `build`, `start`,
  `test` (vitest, then server tests), `test:web`, `test:server`, `typecheck` (`tsc -b` + server `typecheck` if the
  script exists), `lint`, `format`, `format:check`, `check` (all of CI), and `postinstall` (installs server deps).
  Every server step goes through `tools/if-server.mjs`, which skips cleanly until `server/package.json` exists and
  passes npm's exit code through otherwise. `SKIP_SERVER_INSTALL=1` turns off the postinstall (used in CI and Docker).
- **Vite**: dev and preview proxy `/api` → `http://localhost:3001` (override with `API_URL` or `PORT`). Vitest now
  excludes `server/**` and `tools/**`.
- **TypeScript**: `tsconfig.json` is now a solution file referencing `tsconfig.app.json` (src + shared, unchanged
  options) and `tsconfig.node.json` (vite.config.ts, `@types/node`). `server/` is excluded – the backend owns
  `server/tsconfig.json`.
- **ESLint** (`eslint.config.js`, flat config): `@eslint/js` recommended + typescript-eslint recommended + react-hooks
  (`rules-of-hooks` error, `exhaustive-deps` warn) on `src/`. Node globals for `server/**`, configs and `tools/`.
  Passes on the current code with no edits to others' files.
- **Prettier** (`.prettierrc.json`): singleQuote, semi, printWidth 120, trailingComma all. `.editorconfig` matches.
- **CI** (`.github/workflows/ci.yml`): Node from `.nvmrc` (22), `npm ci`, server `npm ci` if `server/package.json`
  exists, typecheck, lint, format check (informational, `continue-on-error`), web tests, server tests (conditional),
  build. A second job builds the Docker image once the server exists. PR template in `.github/`.
- **Docker**: multi-stage `Dockerfile` (build web → install server deps → runtime with `src/`, `shared/`, `server/`,
  `dist/`), runs as `node`, `HEALTHCHECK` on `/api/health`, `CMD npm start` in `/app/server`. `docker-compose.yml`
  with the `baktana-data` volume at `/app/data`, `DATABASE_PATH=/app/data/baktana.db`, required `JWT_SECRET`.
- **PWA**: `public/manifest.webmanifest` (Hebrew name, `dir: rtl`, `lang: he`, theme `#1f7cf2`), SVG icons (plus a PNG apple-touch icon) in
  `public/icons/`, `<link rel="manifest">` + apple meta tags in `index.html`, and a small network-first service worker
  (`public/sw.js`, never touches `/api/`) registered by an inline script in `index.html` on non-localhost hosts only.
- `.env.example` (PORT, DATABASE_PATH, JWT_SECRET, NODE_ENV), `.nvmrc` (22), `.gitignore` additions (`.env`, `data/`,
  `*.db*`, `.claude/worktrees/`), `CONTRIBUTING.md`, `.claude/settings.json` + `.claude/hooks/session-start.sh`
  (runs `npm install` in Claude Code web sessions).

## How to run

```bash
npm install && npm run dev          # http://localhost:5173, API on :3001
npm run check                       # typecheck + lint + test + build
JWT_SECRET=$(openssl rand -hex 32) docker compose up --build   # http://localhost:3001
```

## What other agents must know / wire up

**Backend (`server/`)**

- `server/package.json` scripts used by the root: `dev` (e.g. `tsx watch src/index.ts`), `start`
  (e.g. `tsx src/index.ts`), `test`, and optionally `typecheck` (`tsc --noEmit -p .`). Commit a
  `server/package-lock.json` so CI and Docker can `npm ci`.
- Docker installs **all** server deps (dev included), so `tsx` may stay in devDependencies. If it moves to
  `dependencies`, the Dockerfile can switch to `npm ci --omit=dev`.
- Read `PORT` (default 3001), `DATABASE_PATH` (default `./data/baktana.db`; create the parent dir), `JWT_SECRET`,
  `NODE_ENV`. A `.env` file is not loaded automatically – use `node --env-file-if-exists=../.env` / tsx's equivalent
  or `process.loadEnvFile` if you want it.
- **When `NODE_ENV=production` the server must serve the built web app**: static files from `../dist` (resolve it
  relative to the server file, e.g. `path.resolve(import.meta.dirname, '../../dist')` from `server/src/`), and fall
  back to `dist/index.html` for every non-`/api` GET so client routes work. Keep `/api/*` 404s as JSON.
  Don't cache `sw.js` and `index.html` aggressively (`Cache-Control: no-cache`).
- The runtime image has `/app/src`, `/app/shared`, `/app/server`, `/app/dist`; the server's relative imports of
  `../src/lib/progress.ts`, `../src/data/course.ts`, `../shared/api.ts` work as in the repo. Root `node_modules`
  is **not** in the image, so server code must not import packages that only the root installs.
- `GET /api/health` is used by the Docker `HEALTHCHECK`.
- Root ESLint also lints `server/**` (typescript-eslint recommended, Node globals). Unused vars prefixed with `_` are
  allowed. If something is noisy, tell the integrator rather than adding a separate config.

**UI (`src/`)**

- Use relative `/api/...` URLs – the dev proxy handles them. The service worker never intercepts `/api/`.
- `index.html` now has the manifest link and SW registration; no change needed in `src/main.tsx`.

## Open issues / notes for the integrator

- **TypeScript 7 + typescript-eslint**: TS 7 ships no JS API and typescript-eslint's peer range is `<6.1`. Solution:
  `overrides` map typescript-eslint's `typescript` peer to the root version (silences ERESOLVE), and a local package
  `tools/eslint-typescript` (devDependency `file:tools/eslint-typescript`) depends on `typescript@~6.0.3`;
  `tools/eslint-typescript/register.mjs` uses `module.registerHooks` (Node ≥ 22.15) to redirect typescript-eslint's
  `require('typescript')` there. `npx tsc` is still TS 7. Remove all of this once typescript-eslint supports TS 7.
- `npm run format:check` currently reports 4 existing files (`src/App.tsx`, `LearningPath.tsx`, `ChoiceExercise.tsx`,
  `src/lib/exercises.ts`) – small line-wrapping differences. Not reformatted on purpose; CI treats the check as
  informational. Owners can run `npx prettier --write <file>` and then drop `continue-on-error`.
- New root devDependencies: `eslint`, `@eslint/js`, `typescript-eslint`, `eslint-plugin-react-hooks`, `globals`,
  `prettier`, `concurrently`, `@types/node@^22`, `eslint-typescript` (local file:). If other branches also changed
  root `package.json`/`package-lock.json`, take this branch's version and re-run `npm install` to merge their additions.
- The Dockerfile could not be built here (no Docker daemon in the sandbox); CI's `docker` job will exercise it once
  `server/` exists.
- `README.md` (docs owner) can link to `CONTRIBUTING.md` for scripts and Docker.
