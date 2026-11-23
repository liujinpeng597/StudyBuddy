# Phase 1: Foundation, Authentication, and Workbench Shell

**Goal:** Create a runnable TypeScript workspace with local infrastructure, a controlled single-user login, the initial database foundation and the approved responsive workbench shell.

**Prerequisites:** Node.js, pnpm and Docker are available; no application source exists yet.

**Deliverables:** A user can start the development stack, sign in, and use an empty but responsive workbench with the approved visual tokens and navigation.

**Implementation Status:** Done

**Interface Decisions Implemented:** Fresh light technical-workbench visual direction; left knowledge tree/right workspace layout; desktop, tablet and mobile breakpoints; keyboard focus; empty states; no purple, gradients or glow.

---

## Task 1: Initialize the pnpm workspace and quality gates

**Goal:** Establish a reproducible monorepo whose lint, type, unit test and build commands work before feature code is added.

**Files:**
- Create: `StudyBuddy/package.json`
- Create: `StudyBuddy/pnpm-workspace.yaml`
- Create: `StudyBuddy/tsconfig.base.json`
- Create: `StudyBuddy/eslint.config.mjs`
- Create: `StudyBuddy/prettier.config.mjs`
- Create: `StudyBuddy/.gitignore`
- Create: `StudyBuddy/.editorconfig`
- Create: `StudyBuddy/apps/web/package.json`
- Create: `StudyBuddy/apps/web/next.config.ts`
- Create: `StudyBuddy/apps/web/tsconfig.json`
- Create: `StudyBuddy/apps/worker/package.json`
- Create: `StudyBuddy/apps/worker/tsconfig.json`
- Create: `StudyBuddy/packages/core/package.json`
- Create: `StudyBuddy/packages/db/package.json`
- Create: `StudyBuddy/packages/ai/package.json`
- Create: `StudyBuddy/packages/storage/package.json`
- Create: `StudyBuddy/packages/test-fixtures/package.json`
- Create: `StudyBuddy/vitest.config.ts`
- Create: `StudyBuddy/playwright.config.ts`
- Create: `StudyBuddy/packages/core/src/workspace.test.ts`

**Steps:**
- [ ] Create a strict TypeScript workspace with package names `@studybuddy/web`, `@studybuddy/worker`, `@studybuddy/core`, `@studybuddy/db`, `@studybuddy/ai`, `@studybuddy/storage`, and `@studybuddy/test-fixtures`.
- [ ] Add root scripts: `dev`, `build`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `infra:up`, `infra:down`, `storage:init`, `db:migrate`, `auth:create-user`, `env:check`, and `smoke`.
- [ ] Define `test` as `vitest run`, `test:integration` as `vitest run --config vitest.integration.config.ts`, `test:e2e` as `playwright test --config playwright.config.ts`, `typecheck` as `tsc -b`, and `build` as `pnpm -r build`; configure the normal Vitest project to exclude `**/*.integration.test.ts` and the integration project to include only that pattern.
- [ ] Add dependencies: Next.js, React, TypeScript, Zod, Drizzle ORM, `pg`, `dotenv`, `@node-rs/argon2`, AWS S3 client/presigner, `archiver`, `@xyflow/react`, `d3-force`, `lucide-react`, React Markdown/GFM/sanitize, Shiki, `sharp`, Vitest, Testing Library, `jsdom`, Playwright, `@axe-core/playwright`, ESLint, Prettier, `tsx`, and `concurrently`.
- [ ] Configure path aliases so Web and Worker import shared packages by package name rather than relative paths across packages.
- [ ] Write `workspace.test.ts` to import both `@studybuddy/core` and `@studybuddy/test-fixtures` and assert their version marker is `1`.
- [ ] Run: `pnpm install`
  - Expected: lockfile generated and workspace packages linked.
- [ ] Run: `pnpm exec vitest run packages/core/src/workspace.test.ts`
  - Expected: one passing test after the minimum exports are implemented.
- [ ] Run: `pnpm lint`
  - Expected: command exits `0`.
- [ ] Run: `pnpm typecheck`
  - Expected: command exits `0`.

**Security/Boundary Notes:** `.env*` files are ignored except `.env.example`; no real credential is added to source or fixtures.

---

## Task 2: Provision PostgreSQL, pgvector, object storage and environment validation

**Goal:** Provide deterministic local infrastructure and fail fast when required runtime configuration is missing or malformed.

**Files:**
- Create: `StudyBuddy/docker-compose.yml`
- Create: `StudyBuddy/.env.example`
- Create: `StudyBuddy/scripts/check-env.ts`
- Create: `StudyBuddy/scripts/init-storage.ts`
- Create: `StudyBuddy/scripts/generate-icons.ts`
- Create: `StudyBuddy/tests/integration-global-setup.ts`
- Create: `StudyBuddy/apps/web/src/lib/server/env.ts`
- Create: `StudyBuddy/apps/worker/src/env.ts`
- Create: `StudyBuddy/apps/web/src/app/api/health/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/health/route.test.ts`

**Steps:**
- [ ] Add a PostgreSQL 16 container using the `pgvector/pgvector` image with a health check and persistent named volume.
- [ ] Add a MinIO container with a persistent volume and implement `scripts/init-storage.ts` to create the private `studybuddy-sources` bucket idempotently.
- [ ] Add migrations bootstrap SQL that enables `vector` and `pg_trgm`.
- [ ] Load `.env` in every `scripts/*.ts` entry point with `import "dotenv/config"`; Vitest integration config loads `.env.test` and never falls back silently to the development database.
- [ ] Configure the integration global setup to refuse when `TEST_DATABASE_URL` equals `DATABASE_URL`, create/reset only the test schema, apply migrations and verify MinIO test-bucket access before tests start.
- [ ] Define Zod-validated environment variables for `DATABASE_URL`, `TEST_DATABASE_URL`, `S3_ENDPOINT`, `S3_PUBLIC_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`, `S3_FORCE_PATH_STYLE`, `SECRET_BOX_ACTIVE_KEY_ID`, `SECRET_BOX_KEYS_JSON`, `EMBEDDING_DIMENSIONS`, `APP_URL`, `WORKER_HEALTH_URL`, and `NODE_ENV`.
- [ ] Require `SECRET_BOX_ACTIVE_KEY_ID` to exist in `SECRET_BOX_KEYS_JSON`; require every key in the keyring to decode to exactly 32 bytes and reject startup otherwise.
- [ ] Implement `/api/health` to return `200` only when the database and bucket are reachable, without returning credentials or internal connection strings.
- [ ] Write tests for missing env vars, short master key, malformed URL and healthy dependencies via mocked clients.
- [ ] Run: `pnpm infra:up`
  - Expected: Docker reports PostgreSQL and MinIO healthy.
- [ ] Run: `pnpm storage:init`
  - Expected: private bucket exists and rerunning exits successfully.
- [ ] Run: `pnpm env:check`
  - Expected: process exits `0` with variable names only and no secret values.
- [ ] Run: `pnpm exec vitest run apps/web/src/app/api/health/route.test.ts`
  - Expected: healthy and failure responses pass.

**Security/Boundary Notes:** Local credentials may use obvious development values in `.env.example`, never real credentials. Health responses must not reveal endpoint credentials.

---

## Task 3: Implement controlled single-user authentication and authorization guard

**Goal:** Protect every workbench page and API with an opaque server-side session while keeping public registration disabled.

**Files:**
- Create: `StudyBuddy/packages/db/src/schema/auth.ts`
- Create: `StudyBuddy/packages/db/src/migrations/0001_auth.sql`
- Create: `StudyBuddy/packages/core/src/auth/session.ts`
- Create: `StudyBuddy/packages/core/src/auth/session.test.ts`
- Create: `StudyBuddy/packages/db/src/repositories/auth-repository.ts`
- Create: `StudyBuddy/apps/web/src/lib/server/auth.ts`
- Create: `StudyBuddy/apps/web/src/app/api/auth/login/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/auth/logout/route.ts`
- Create: `StudyBuddy/apps/web/src/app/login/page.tsx`
- Create: `StudyBuddy/apps/web/src/app/login/login-form.tsx`
- Create: `StudyBuddy/scripts/create-user.ts`

**Steps:**
- [ ] Add `users`, `sessions` and `auth_login_attempts` tables. Store Argon2id password hashes and only SHA-256 hashes of random session tokens.
- [ ] Generate sessions from 32 random bytes, expire them after 30 days, rotate the token after login and delete expired sessions on authentication checks.
- [ ] Set the session cookie with `httpOnly`, `sameSite=lax`, `secure` in production, `path=/` and the correct expiry.
- [ ] Reject mutation requests whose `Origin` does not match `APP_URL`.
- [ ] Limit failed login attempts to five per normalized email and client identifier hash in a rolling 15-minute window; return the same generic credential error for unknown email and bad password.
- [ ] Write unit tests for token hashing, expiry, cookie flags, Origin rejection and rate-limit reset.
- [ ] Create `scripts/create-user.ts` to create or update the sole account from interactive input or documented environment variables; never print the password.
- [ ] Add `requireUser()` for server pages and `withAuthenticatedUser()` for route handlers; each returns a typed user and never trusts a client-supplied user ID.
- [ ] Run: `pnpm db:migrate`
  - Expected: auth tables and indexes exist in the local database.
- [ ] Run: `pnpm exec vitest run packages/core/src/auth/session.test.ts`
  - Expected: all session and rate-limit cases pass.
- [ ] Run: `pnpm auth:create-user`
  - Expected: one account exists; rerunning updates only the documented account.

**Security/Boundary Notes:** Public registration is absent. API errors must not disclose whether an email exists. Session tokens never appear in URLs, logs or database plaintext.

---

## Task 4: Build the approved workbench shell and design tokens

**Goal:** Implement the responsive left-tree/right-workspace shell with the approved fresh visual system and accessible navigation.

**Files:**
- Create: `StudyBuddy/apps/web/src/app/layout.tsx`
- Create: `StudyBuddy/apps/web/src/app/page.tsx`
- Create: `StudyBuddy/apps/web/src/app/(workbench)/layout.tsx`
- Create: `StudyBuddy/apps/web/src/app/(workbench)/today/page.tsx`
- Create: `StudyBuddy/apps/web/src/app/(workbench)/graph/page.tsx`
- Create: `StudyBuddy/apps/web/src/app/(workbench)/review/page.tsx`
- Create: `StudyBuddy/apps/web/src/app/(workbench)/imports/page.tsx`
- Create: `StudyBuddy/apps/web/src/app/manifest.ts`
- Create: `StudyBuddy/apps/web/public/icons/studybuddy.svg`
- Create: `StudyBuddy/apps/web/public/icons/studybuddy-192.png`
- Create: `StudyBuddy/apps/web/public/icons/studybuddy-512.png`
- Create: `StudyBuddy/apps/web/src/styles/tokens.css`
- Create: `StudyBuddy/apps/web/src/styles/globals.css`
- Create: `StudyBuddy/apps/web/src/components/workbench/WorkbenchShell.tsx`
- Create: `StudyBuddy/apps/web/src/components/workbench/KnowledgeTreeEmpty.tsx`
- Create: `StudyBuddy/apps/web/src/components/workbench/MobileNavigation.tsx`
- Create: `StudyBuddy/apps/web/src/components/workbench/WorkbenchTabs.tsx`
- Create: `StudyBuddy/apps/web/src/components/ui/Button.tsx`
- Create: `StudyBuddy/apps/web/src/components/ui/EmptyState.tsx`
- Create: `StudyBuddy/apps/web/e2e/workbench.spec.ts`

**Steps:**
- [ ] Implement the seven approved color roles exactly as CSS variables: `surface`, `surface-raised`, `ink`, `accent`, `attention`, `danger`, `border`.
- [ ] Add the approved typography scale, 4px spacing grid, 8/12px radii, 1px borders, restrained shadows and 120–180ms motion tokens.
- [ ] Build a fixed top bar with search entry, Import action, job status area and account menu; build a 280px desktop directory and the right tabbed workspace.
- [ ] Redirect `/` to `/today` for a new session and restore the last authenticated workbench route from local storage when available.
- [ ] At widths below 1280px reduce/collapse the directory; below 768px replace it with a keyboard-accessible drawer and make work tabs horizontally scrollable.
- [ ] `KnowledgeTreeEmpty` renders the real first-use state titled “知识树正在等待第一份笔记”, with a working Import action.
- [ ] Add visible `:focus-visible` styles, a skip link, semantic landmarks and 44px minimum mobile controls.
- [ ] Add install metadata and a code-native monogram SVG; generate 192px and 512px PNG icons with `scripts/generate-icons.ts`; ship no service worker or offline-write behavior in this version.
- [ ] Write Playwright checks for authenticated redirect, desktop width, tablet collapse, mobile drawer, tab overflow and `prefers-reduced-motion`.
- [ ] Run: `pnpm dev`
  - Expected: login and authenticated workbench load without console errors.
- [ ] Run: `pnpm test:e2e -- e2e/workbench.spec.ts`
  - Expected: all workbench layout tests pass.
- [ ] Capture screenshots at `1440×900`, `1024×768` and `390×844`.
  - Expected: no horizontal page overflow; left directory and right workspace hierarchy matches the spec; no purple, gradient or glow appears.

**Visual Verification:** Review the empty Today page, mobile navigation open state and keyboard focus sequence. Fix spacing, overlap, clipped labels and contrast before marking the task complete.

**Security/Boundary Notes:** Shell components receive no database clients. The authenticated layout resolves the user server-side and renders only sanitized display fields.

---

## Phase Completion Checklist

- [ ] All four tasks completed
- [ ] `pnpm lint`, `pnpm typecheck`, focused tests and workbench E2E pass
- [ ] Login is the only public route; workbench and API routes require a valid session
- [ ] Desktop, tablet and mobile shell screenshots reviewed
- [ ] Ready for Phase 2: model access
