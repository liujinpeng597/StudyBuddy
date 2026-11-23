# Phase 6: Undo, Hardening, and Acceptance

**Goal:** Make imports reversible, close cross-cutting security and reliability gaps, verify the full desktop/mobile experience and document deployment and rollback.

**Prerequisites:** Phases 1-5 are complete; import, graph, search, review and LeetCode flows pass focused tests.

**Deliverables:** Import history with safe undo, account export/deletion, DB-enforced user boundaries, security headers and quotas, full E2E/accessibility/performance evidence, and an operations runbook.

**Implementation Status:** Done for local acceptance; production deployment and managed-service backup execution remain deferred.

**Interface Decisions Implemented:** Import history states and diff; undo confirmation and dependency conflict; account data actions; final responsive and reduced-motion polish; complete screenshot review.

---

## Task 1: Build import history, change diff and safe undo

**Goal:** Let the user inspect each import and reverse its graph effects without deleting later valid knowledge.

**Files:**
- Create: `StudyBuddy/packages/db/src/migrations/0010_import_undo.sql`
- Create: `StudyBuddy/packages/core/src/knowledge/revision-undo.ts`
- Create: `StudyBuddy/packages/core/src/knowledge/revision-undo.test.ts`
- Create: `StudyBuddy/packages/db/src/repositories/revision-repository.ts`
- Create: `StudyBuddy/apps/web/src/app/api/imports/[id]/diff/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/imports/[id]/undo/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/imports/[id]/undo/route.integration.test.ts`
- Modify: `StudyBuddy/apps/web/src/app/(workbench)/imports/page.tsx`
- Create: `StudyBuddy/apps/web/src/components/imports/ImportHistoryList.tsx`
- Create: `StudyBuddy/apps/web/src/components/imports/ImportDiff.tsx`
- Create: `StudyBuddy/apps/web/src/components/imports/UndoDialog.tsx`
- Create: `StudyBuddy/apps/web/e2e/import-undo.spec.ts`

**Steps:**
- [ ] Add explicit undo metadata and indexes to `import_jobs` and `knowledge_revisions`; derive import history from committed jobs rather than a new parallel history table.
- [ ] Build a diff endpoint returning source files, created/updated nodes, added/removed relations, questions generated and `needs_review` changes without exposing another user’s data.
- [ ] Compute undo safety by checking whether later committed jobs reference, modify or depend on the original nodes/relations. Return `UNDO_CONFLICT` with conflicting job IDs and node titles when reversal would destroy later work.
- [ ] When safe, reverse the job’s graph effects in one user-scoped transaction, mark job-owned questions `retired`, keep existing attempts as historical records, record a new inverse revision set and mark the original job `undone`. Repeated undo requests return the existing undone result.
- [ ] When a conflict exists, do not partially undo. Offer Open conflicting import and Keep current knowledge actions with plain-language explanations.
- [ ] Show status, source count, time, change totals, review-generation result and Undo action in Import History; show a destructive confirmation that names the job date and affected node count.
- [ ] Write integration tests for undo with no later changes, repeated undo, later node update conflict, later source-link conflict, removed questions and transaction rollback.
- [ ] Run: `pnpm db:migrate`
  - Expected: undo metadata and indexes exist.
- [ ] Run: `pnpm test:integration -- 'apps/web/src/app/api/imports/[id]/undo/route.integration.test.ts'`
  - Expected: safe and conflicting undo tests pass without partial changes.
- [ ] Run: `pnpm test:e2e -- e2e/import-undo.spec.ts`
  - Expected: diff, confirmation, successful undo and conflict UI pass.

**Security/Boundary Notes:** Undo is a privileged mutation under the same user boundary. It cannot restore deleted files or bypass graph validation; it only reverses recorded graph/source links and keeps both revision sets.

---

## Task 2: Enforce database boundaries, security headers, quotas and data lifecycle

**Goal:** Close cross-cutting authorization, secret-handling, abuse and account-data gaps before production use.

**Files:**
- Create: `StudyBuddy/packages/db/src/migrations/0011_row_level_security.sql`
- Create: `StudyBuddy/apps/web/src/lib/server/user-transaction.ts`
- Create: `StudyBuddy/apps/web/src/lib/server/rate-limit.ts`
- Create: `StudyBuddy/apps/web/src/lib/server/rate-limit.test.ts`
- Create: `StudyBuddy/apps/web/src/app/api/account/export/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/account/delete/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/account/export/route.integration.test.ts`
- Create: `StudyBuddy/apps/web/src/app/api/account/delete/route.integration.test.ts`
- Create: `StudyBuddy/packages/db/src/rls.integration.test.ts`
- Create: `StudyBuddy/apps/worker/src/user-scope.integration.test.ts`
- Create: `StudyBuddy/apps/web/src/app/(workbench)/settings/account/page.tsx`
- Create: `StudyBuddy/apps/web/src/components/account/AccountDataActions.tsx`
- Create: `StudyBuddy/apps/web/src/components/account/DeleteAccountDialog.tsx`
- Modify: `StudyBuddy/apps/web/src/components/workbench/WorkbenchShell.tsx`
- Create: `StudyBuddy/scripts/rotate-secret-box.ts`
- Create: `StudyBuddy/scripts/rotate-secret-box.test.ts`
- Modify: `StudyBuddy/apps/web/next.config.ts`
- Create: `StudyBuddy/apps/web/e2e/security-boundaries.spec.ts`

**Steps:**
- [ ] Split database access into an auth lookup role and a user-data execution path. For user data transactions, set `LOCAL app.user_id` after authentication and enable/force RLS policies on all tables containing user-owned rows.
- [ ] Create `account_deletion_jobs` for retryable private-object cleanup and inaccessible-account state.
- [ ] Ensure Web routes use the user transaction wrapper for every read/write; Worker transactions set the claimed job’s user ID and may not query unrelated users.
- [ ] Add rate limits for login, import creation, model tests, short-answer evaluation and search. Return `429` with a safe retry time and do not reveal internal counters.
- [ ] Add `AI_DAILY_REQUEST_LIMIT` and `AI_DAILY_TOKEN_LIMIT` environment defaults; enforce per-user daily quotas by AI task role from `ai_usage_logs` and reject calls before reaching the provider when exhausted.
- [ ] Add a nonce-based Content Security Policy, `X-Content-Type-Options`, Referrer Policy, frame denial and strict transport headers for production. Permit only required Web/object-store/model connections.
- [ ] Implement account export as a ZIP containing JSON domain data, normalized Markdown, question/attempt records and original Markdown/image assets. Exclude password hashes, session tokens, encrypted model keys, encryption material and internal lease tokens. Generate the archive server-side and offer it through a short-lived authenticated response.
- [ ] Implement account deletion with password re-entry and exact confirmation text. Delete database rows, embeddings, revisions, AI usage records and private objects; if object deletion partially fails, keep a retryable deletion job and remove access immediately.
- [ ] Add account settings access from the workbench menu, an export download flow and a destructive dialog that requires password re-entry plus the exact confirmation phrase `删除我的全部数据`.
- [ ] Implement online master-key rotation using the keyring: decrypt each profile with its envelope key ID, re-encrypt with the active key, verify round trip and only then retire the old key from deployment config.
- [ ] Add tests for cross-user RLS denial, Worker user scoping, all quotas, full export contents, deletion access revocation, partial object-store failure and key rotation resumability.
- [ ] Run: `pnpm db:migrate`
  - Expected: RLS policies are present on every user-owned table.
- [ ] Run: `pnpm exec vitest run apps/web/src/lib/server/rate-limit.test.ts scripts/rotate-secret-box.test.ts`
  - Expected: quota and encryption-rotation unit tests pass.
- [ ] Run: `pnpm test:integration -- apps/web/src/app/api/account/export/route.integration.test.ts`
  - Expected: export archive and secret-exclusion tests pass.
- [ ] Run: `pnpm test:integration -- apps/web/src/app/api/account/delete/route.integration.test.ts packages/db/src/rls.integration.test.ts apps/worker/src/user-scope.integration.test.ts`
  - Expected: deletion, RLS and Worker user-scope tests pass.
- [ ] Run: `pnpm audit --prod`
  - Expected: no unaccepted high or critical production advisory; document any accepted lower-severity advisory with rationale.

**Security/Boundary Notes:** This task blocks production acceptance. Full session tokens, model keys and returned Authorization headers must be absent from logs and error responses.

---

## Task 3: Run full functional, accessibility, performance and visual acceptance

**Goal:** Verify every approved journey and design contract at the required states and viewports, then fix visible or behavioral regressions before handoff.

**Files:**
- Create: `StudyBuddy/apps/web/e2e/full-journey.spec.ts`
- Create: `StudyBuddy/apps/web/e2e/accessibility.spec.ts`
- Create: `StudyBuddy/apps/web/e2e/visual-review.spec.ts`
- Create: `StudyBuddy/apps/web/e2e/performance.spec.ts`
- Create: `StudyBuddy/apps/web/e2e/fixtures/authenticated-user.ts`
- Create: `StudyBuddy/packages/test-fixtures/notes/cpp-class-basics.md`
- Create: `StudyBuddy/packages/test-fixtures/notes/cpp-class-advanced.md`
- Create: `StudyBuddy/packages/test-fixtures/notes/network-tcp.md`
- Create: `StudyBuddy/packages/test-fixtures/expected/cpp-merged-graph.json`
- Create: `StudyBuddy/packages/test-fixtures/expected/review-set.json`

**Steps:**
- [ ] Build a deterministic E2E fixture where day-one “C++ 类基础” and day-two “类进阶” merge into one node, a related题 connects to it, search finds a phrase from the original question, review produces all five question types, and undo restores the first revision.
- [ ] Add viewport projects for `1440×900`, `1024×768` and `390×844`; ensure no horizontal page overflow and preserve at least 44×44px touch targets.
- [ ] Capture screenshots for Today empty/completed, import processing/partial error, tree selected, graph today/selected/list fallback, search results/no result, objective wrong answer, short-answer feedback, model partial capability, import diff and undo conflict.
- [ ] Run Axe on login, Today, a knowledge node, graph list view, search result, review feedback, model settings and import history. Fail on serious or critical violations.
- [ ] Verify keyboard-only access to login, global search, tree, graph controls, question choices, model form and undo dialog; verify focus restoration after every dialog/overlay.
- [ ] Verify reduced motion disables graph path animation and all nonessential transitions.
- [ ] Seed 500 nodes and 1500 relations through the test fixture loader. Measure graph route payload/rendering and assert the approved 1.5-second client render budget on the CI reference environment; record initial hydration and interaction timings.
- [ ] Perform the post-implementation visual critique against the design contract and correct hierarchy, spacing, clipping, overlap, contrast, focus and selected-state issues.
- [ ] Run: `pnpm lint`
  - Expected: static lint checks pass.
- [ ] Run: `pnpm typecheck`
  - Expected: all workspace projects type-check.
- [ ] Run: `pnpm test`
  - Expected: all unit tests pass.
- [ ] Run: `pnpm test:integration`
  - Expected: all database, object-store and pipeline integration suites pass.
- [ ] Run: `pnpm test:e2e`
  - Expected: full journey, accessibility, visual review and performance suites pass.
- [ ] Run: `pnpm build`
  - Expected: Web and Worker production builds complete without type errors.

**Visual Verification:** This task is not complete from automated pass alone. A human reviewer must inspect the named screenshots and record corrections. The graph remains the only dominant visual element; purple gradients, neon glows and decorative motion are rejected.

---

## Task 4: Add deployment, backup, restore and rollback runbooks

**Goal:** Make the completed app runnable outside the development machine and recoverable after failed deployment or data damage.

**Files:**
- Create: `StudyBuddy/README.md`
- Create: `StudyBuddy/docs/operations/deployment.md`
- Create: `StudyBuddy/docs/operations/backup-restore.md`
- Create: `StudyBuddy/docs/operations/model-setup.md`
- Create: `StudyBuddy/apps/web/Dockerfile`
- Create: `StudyBuddy/apps/worker/Dockerfile`
- Create: `StudyBuddy/scripts/backup-db.ts`
- Create: `StudyBuddy/scripts/restore-db.ts`
- Create: `StudyBuddy/scripts/smoke.ts`
- Create: `StudyBuddy/.dockerignore`

**Steps:**
- [ ] Document prerequisites, pnpm install, Docker Compose infrastructure, migrations, user creation, Web/Worker startup and first model-profile configuration without including real credentials.
- [ ] Build separate multi-stage Web and Worker images from the same lockfile; run both as non-root users and include health checks.
- [ ] Document production requirements for managed PostgreSQL 16 with `pgvector`, private S3-compatible storage, HTTPS and separately deployed Web/Worker services.
- [ ] Document DeepSeek V4.1 Flash setup: enter the provider Base URL and exact API Model ID, test text/JSON, test image capability separately, and add a vision profile only if the main endpoint cannot accept screenshots.
- [ ] Implement a repeatable encrypted backup procedure for PostgreSQL and object storage plus a restore procedure that verifies schema version, row counts and signed object access.
- [ ] Implement `scripts/smoke.ts` to check health, authenticated login, model-role presence without calling the provider, latest migration, private bucket access and Worker heartbeat.
- [ ] Define rollout order: backup → migrate → deploy Worker → deploy Web → smoke → enable daily imports. Define rollback: stop Worker, revert app containers to the previous digest, restore only additive schema when necessary, then restore DB/object backup if data corruption occurred.
- [ ] Run: `pnpm smoke`
  - Expected: all local smoke checks pass and no secret values are printed.
- [ ] Follow the backup and restore document against a disposable local database and bucket.
  - Expected: sample Markdown, image, graph, question and attempt records are restored and readable.

**Security/Boundary Notes:** Production setup must not use `.env.example` credentials or the MinIO development access key. Backup encryption keys are stored separately from backup files.

---

## Phase Completion Checklist

- [ ] All four tasks completed
- [ ] Safe undo and conflict-blocked undo are covered by integration and E2E tests
- [ ] RLS, quotas, security headers, key rotation, export and deletion are verified
- [ ] Full journey, accessibility, performance and visual screenshots pass review
- [ ] Deployment, model setup, backup, restore and rollback documentation is executable
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, `pnpm build` and `pnpm smoke` pass
- [ ] The approved first-version design is implementation-complete
