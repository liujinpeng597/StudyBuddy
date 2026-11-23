# Phase 3: Import, Normalization, Knowledge Merge, and Today View

**Goal:** Deliver the daily pipeline from Markdown/image upload through extraction, `learn-something` normalization, global-node merging and a reviewable “今日整合” result.

**Prerequisites:** Phases 1-2 are complete; auth, private storage dependencies, model profiles and the AI Adapter work with the fake provider.

**Deliverables:** One import operation accepts `.md` files and screenshots, survives refresh, runs in a retriable Worker, records provenance, updates the global knowledge graph transactionally and reports the changes.

**Implementation Status:** Done

**Interface Decisions Implemented:** Top-bar Import action; file drop/select state; visible progress; safe-to-leave processing; Today integration summary; source evidence; changed-node and new-relation display; model-unavailable and partial-import errors.

---

## Task 1: Create import/source records and private file upload APIs

**Goal:** Validate and store daily Markdown and image sources without exposing object storage or accepting unsafe files.

**Files:**
- Create: `StudyBuddy/packages/db/src/schema/import.ts`
- Create: `StudyBuddy/packages/db/src/migrations/0003_imports_and_sources.sql`
- Create: `StudyBuddy/packages/core/src/import/file-policy.ts`
- Create: `StudyBuddy/packages/core/src/import/file-policy.test.ts`
- Create: `StudyBuddy/packages/storage/src/source-vault.ts`
- Create: `StudyBuddy/packages/storage/src/source-vault.test.ts`
- Create: `StudyBuddy/packages/storage/src/source-vault.integration.test.ts`
- Create: `StudyBuddy/apps/web/src/app/api/imports/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/imports/[id]/assets/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/imports/[id]/submit/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/imports/[id]/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/imports/imports.integration.test.ts`

**Steps:**
- [ ] Create `import_jobs` and `source_assets` tables with `user_id`, state, progress, retry metadata, checksum, study date and storage path.
- [ ] Allow `.md`/`.markdown` files up to 5 MiB and PNG/JPEG/WebP images up to 20 MiB. Allow at most 20 assets and 60 MiB total per job.
- [ ] Validate extension, declared MIME, decoded signature and content decoding. Reject executables, SVG, animated formats and mismatched MIME.
- [ ] Create a job with status `draft`; upload assets one at a time under `users/{userId}/imports/{jobId}/{assetId}/{safeFilename}`; submit changes status from `draft` to `queued`.
- [ ] Compute SHA-256 while streaming and reject duplicate checksums within the same job. Reuse of an identical source in a later job is allowed and recorded as source history.
- [ ] Return user-scoped job/asset DTOs without storage credentials or raw object keys.
- [ ] Ensure an abandoned `draft` job has no Worker claim and can be deleted only by its owner.
- [ ] Write tests for size/type limits, mismatched MIME, path traversal filenames, duplicate assets, cross-user access and successful MinIO round trip.
- [ ] Run: `pnpm exec vitest run packages/core/src/import/file-policy.test.ts packages/storage/src/source-vault.test.ts`
  - Expected: policy and private storage tests pass.
- [ ] Run: `pnpm test:integration -- apps/web/src/app/api/imports/imports.integration.test.ts`
  - Expected: job, asset and submit API tests pass against local PostgreSQL/MinIO.
- [ ] Run: `pnpm test:integration -- packages/storage/src/source-vault.integration.test.ts`
  - Expected: the private store round trip passes against MinIO.

**Security/Boundary Notes:** Storage keys are generated server-side. Object URLs are private and short-lived. Uploads never execute or render file content.

---

## Task 2: Implement the PostgreSQL job queue and Worker state machine

**Goal:** Process each queued import exactly once per attempt, recover stale jobs and prevent partial work from being treated as success.

**Files:**
- Create: `StudyBuddy/apps/worker/src/index.ts`
- Create: `StudyBuddy/apps/worker/src/queue.ts`
- Create: `StudyBuddy/apps/worker/src/import-pipeline.ts`
- Create: `StudyBuddy/apps/worker/src/queue.integration.test.ts`
- Create: `StudyBuddy/apps/worker/src/import-pipeline.integration.test.ts`
- Create: `StudyBuddy/packages/db/src/repositories/job-repository.ts`
- Create: `StudyBuddy/packages/db/src/migrations/0004_job_leases.sql`

**Steps:**
- [ ] Add `lock_token`, `locked_at`, `lease_expires_at`, `attempt_count`, `last_error_code` and `last_error_message` fields to `import_jobs`.
- [ ] Claim one job with `SELECT ... FOR UPDATE SKIP LOCKED`, set a 90-second lease and increment the attempt only when claiming.
- [ ] Permit only these transitions: `queued → parsing → extracting → resolving → committing → completed`, plus `failed`; retryable failures return to `queued`.
- [ ] Retry network/model failures up to three attempts with backoff; do not retry validation, authorization or malformed-file errors.
- [ ] Expire stale leases back to `queued` only when no transaction has committed results.
- [ ] Make Worker shutdown finish or release its current lease; the process exposes a `/health` endpoint and logs job IDs but not note content.
- [ ] Write concurrency tests where two Workers claim ten jobs without overlap, a stale lease is reclaimed once, a user retry is idempotent and a failed commit leaves status out of `completed`.
- [ ] Run: `pnpm --filter @studybuddy/worker dev`
  - Expected: process waits for queued jobs and logs a readiness message.
- [ ] Run: `pnpm test:integration -- apps/worker/src/queue.integration.test.ts apps/worker/src/import-pipeline.integration.test.ts`
  - Expected: concurrency and state-transition tests pass.

**Dependencies:** Phase 1 local infrastructure and Phase 2 fake model provider.

**Security/Boundary Notes:** A Worker may access only the user ID carried by the claimed job. It uses a service DB connection but all writes still include that user ID and pass domain validation.

---

## Task 3: Parse and normalize Markdown Q&A into knowledge candidates

**Goal:** Convert a daily Markdown note into deterministic chunks and validated `learn-something` knowledge candidates without writing the graph yet.

**Files:**
- Create: `StudyBuddy/packages/core/src/schemas/knowledge-candidate.ts`
- Create: `StudyBuddy/packages/core/src/import/markdown-parser.ts`
- Create: `StudyBuddy/packages/core/src/import/markdown-parser.test.ts`
- Create: `StudyBuddy/packages/core/src/import/chunker.ts`
- Create: `StudyBuddy/packages/core/src/import/chunker.test.ts`
- Create: `StudyBuddy/packages/db/src/schema/candidates.ts`
- Create: `StudyBuddy/packages/db/src/migrations/0005_knowledge_candidates.sql`
- Create: `StudyBuddy/packages/ai/src/prompts/learn-something.ts`
- Create: `StudyBuddy/packages/ai/src/prompts/learn-something.test.ts`

**Steps:**
- [ ] Parse headings, paragraphs, code fences, tables, explicit question/answer labels and Markdown links without executing raw HTML.
- [ ] Preserve each original question and its source excerpt; chunk by heading first, then paragraph boundaries, with no more than 12,000 characters and no more than 400 characters of overlap.
- [ ] Define a Zod `KnowledgeCandidate` containing title, module hint, aliases, one-sentence summary, the eight `learn-something` sections, related titles, distinctions, source excerpts and original questions.
- [ ] Encode the eight approved sections in the prompt in fixed order: definition, purpose, implementation, use cases, rationale, advantages/disadvantages, related knowledge points, differences.
- [ ] Wrap note content as untrusted data; instructions in the note must not alter output schema or trigger tools.
- [ ] Store candidates in `knowledge_candidates` linked to job/source with status `pending`, `validated` or `rejected`, and a validation error list.
- [ ] Reject candidates with empty required sections, no source excerpt, invalid relation types or source spans outside the document.
- [ ] Add fixtures for a 6000-character mixed note, nested code fences, Chinese Q&A headings, a table and a question with no explicit answer.
- [ ] Run: `pnpm exec vitest run packages/core/src/import/markdown-parser.test.ts packages/core/src/import/chunker.test.ts packages/ai/src/prompts/learn-something.test.ts`
  - Expected: parsing, chunk limits, prompt ordering and schema rejection tests pass.

**Security/Boundary Notes:** Markdown is stored as source text; no HTML is trusted. Prompts label source blocks as data and separate them from system instructions.

---

## Task 4: Extract screenshot content with optional vision capability

**Goal:** Turn a LeetCode screenshot containing problem text and code into validated structured evidence, while behaving predictably when vision is not configured.

**Files:**
- Create: `StudyBuddy/packages/core/src/schemas/image-extraction.ts`
- Create: `StudyBuddy/packages/ai/src/prompts/image-extraction.ts`
- Create: `StudyBuddy/apps/worker/src/image-extraction-step.ts`
- Create: `StudyBuddy/apps/worker/src/image-extraction-step.test.ts`
- Create: `StudyBuddy/packages/test-fixtures/generate-leetcode-image.ts`
- Create: `StudyBuddy/packages/test-fixtures/leetcode-two-sum.html`
- Create: `StudyBuddy/packages/test-fixtures/images/leetcode-two-sum.png`
- Create: `StudyBuddy/packages/test-fixtures/ai/leetcode-two-sum.json`

**Steps:**
- [ ] Build a prompt that extracts only visible title, problem number when visible, description, programming language and code; classify data structures, algorithm, complexity and optimization notes as inferred fields.
- [ ] Return `isInferred` and per-field confidence for every computed field. Missing text must remain `null`; the model may not fabricate a title, number or problem statement.
- [ ] Convert images to a supported data URL or provider-compatible image part only inside the server-side adapter.
- [ ] If `image_extraction` has no active vision role, mark the image asset `VISION_MODEL_NOT_CONFIGURED`, keep the original private, and allow Markdown assets in the same job to continue.
- [ ] Store validated extraction in `knowledge_candidates` with kind `leetcode_problem` and link it to the source asset.
- [ ] Write fake-provider tests for complete extraction, missing title, inferred complexity, provider refusal and unsupported-vision partial import.
- [ ] Generate `leetcode-two-sum.png` deterministically from the local HTML fixture with Playwright, then assert the generated file is a valid PNG before using it in tests.
- [ ] Run: `pnpm exec vitest run apps/worker/src/image-extraction-step.test.ts`
  - Expected: fixture extraction is stable and no field is invented when absent.

**Security/Boundary Notes:** The original screenshot remains private evidence. OCR/vision results are treated as untrusted proposals until schema validation.

---

## Task 5: Resolve, merge and transactionally commit the global knowledge graph

**Goal:** Reuse existing concepts, add new ones and prevent malformed or partial graph writes when content arrives over multiple study days.

**Files:**
- Create: `StudyBuddy/packages/core/src/schemas/knowledge.ts`
- Create: `StudyBuddy/packages/core/src/knowledge/node-resolver.ts`
- Create: `StudyBuddy/packages/core/src/knowledge/node-resolver.test.ts`
- Create: `StudyBuddy/packages/core/src/knowledge/relation-validator.ts`
- Create: `StudyBuddy/packages/core/src/knowledge/relation-validator.test.ts`
- Create: `StudyBuddy/packages/core/src/knowledge/commit-plan.ts`
- Create: `StudyBuddy/packages/core/src/knowledge/commit-plan.test.ts`
- Create: `StudyBuddy/packages/db/src/schema/knowledge.ts`
- Create: `StudyBuddy/packages/db/src/migrations/0006_knowledge_graph.sql`
- Create: `StudyBuddy/packages/db/src/repositories/knowledge-repository.ts`
- Create: `StudyBuddy/apps/worker/src/knowledge-commit-step.ts`
- Create: `StudyBuddy/apps/worker/src/knowledge-commit-step.integration.test.ts`

**Steps:**
- [ ] Create `knowledge_modules` with self-referencing `parent_id` and kind `module|topic`, plus `knowledge_nodes`, `knowledge_relations`, `source_node_links`, `knowledge_revisions` and `graph_layout` tables. Add enum values exactly `prerequisite`, `part_of`, `related`, `contrast`, `applies_to`.
- [ ] Store node sections as validated JSONB with the fixed keys `definition`, `purpose`, `implementation`, `useCases`, `rationale`, `advantages`, `disadvantages`, `relatedPoints` and `differences`; store aliases as a string array and embeddings as configured-dimension vectors.
- [ ] Resolve a candidate in this order: canonical title/module exact match, alias match, trigram similarity, optional vector similarity, then AI merge judgment constrained to existing IDs.
- [ ] For “类基础 → 类进阶”, produce an update to one node by merging sections, aliases, source links and questions rather than creating a dated second node.
- [ ] Reject unknown node IDs, self-relations, duplicate unordered edges and prerequisite cycles. Mark genuinely uncertain merges or edges `needs_review` without blocking the valid part of the import.
- [ ] Serialize commits per user with a transaction-scoped advisory lock, validate the complete plan, then write modules, nodes, relations, source links, revisions and job result in one transaction.
- [ ] Record enough before/after state per job to support Phase 6 undo; never physically delete a prior source during import.
- [ ] Write tests for alias reuse, semantic reuse, new-node creation, two-day section merge, duplicate relation rejection, prerequisite cycle rejection, low-confidence review state and forced transaction rollback.
- [ ] Run: `pnpm db:migrate`
  - Expected: knowledge graph schema and indexes exist.
- [ ] Run: `pnpm test:integration -- apps/worker/src/knowledge-commit-step.integration.test.ts`
  - Expected: golden import results match the expected graph and all invalid plans roll back.

**Security/Boundary Notes:** The model cannot commit SQL. Only the Knowledge Service may convert a validated candidate and resolution result into mutations.

---

## Task 6: Build import progress and “今日整合” end-to-end UI

**Goal:** Let the user submit files, leave or refresh the page safely, and inspect the exact knowledge changes from the completed import.

**Files:**
- Modify: `StudyBuddy/apps/web/src/app/(workbench)/today/page.tsx`
- Modify: `StudyBuddy/apps/web/src/components/workbench/WorkbenchShell.tsx`
- Create: `StudyBuddy/apps/web/src/components/import/ImportDrawer.tsx`
- Create: `StudyBuddy/apps/web/src/components/import/FileDropZone.tsx`
- Create: `StudyBuddy/apps/web/src/components/import/ImportJobProgress.tsx`
- Create: `StudyBuddy/apps/web/src/components/today/TodayIntegration.tsx`
- Create: `StudyBuddy/apps/web/src/components/today/ChangedNodeList.tsx`
- Create: `StudyBuddy/apps/web/src/components/today/SourceEvidence.tsx`
- Create: `StudyBuddy/apps/web/e2e/import-flow.spec.ts`

**Steps:**
- [ ] Build the Import drawer with drag/drop, file picker, per-file type, size, remove action, a study-date field defaulted to the client’s local date and explicit “开始整理” action.
- [ ] Upload assets sequentially, show per-file completion, submit the job and poll `/api/imports/:id` every two seconds while active.
- [ ] Show phase labels and progress without preventing workbench navigation; on refresh, restore the latest active job from the API.
- [ ] On successful submit, navigate to `/today?jobId=<id>` and keep polling there; completion replaces progress with the integration result.
- [ ] Today integration groups added nodes, updated nodes, new relations and `needs_review` items, with counts and source excerpts available on demand.
- [ ] Show actionable errors for unsupported formats, missing model role, provider failure, partial image extraction and committed/no-change outcomes.
- [ ] Add empty and completed states using the approved content labels; never expose “embedding”, “job” or raw error codes as primary user copy.
- [ ] Write Playwright tests for Markdown-only import, Markdown+image partial import, refresh during processing, retry after provider failure and viewing the integration result.
- [ ] Run: `pnpm test:e2e -- e2e/import-flow.spec.ts`
  - Expected: import and refresh recovery paths pass with the fake provider.
- [ ] Review Today screenshots at `1440×900` and `390×844`.
  - Expected: changed nodes, relation counts and evidence remain readable; no horizontal overflow; progress remains visible while the user browses.

**Visual Verification:** Verify empty, uploading, processing, partial failure, completed and no-change states. The summary hierarchy is change count first, changed topics second, source evidence third.

---

## Phase Completion Checklist

- [ ] All six tasks completed
- [ ] A real Markdown fixture and mocked LeetCode image fixture merge into the graph end to end
- [ ] Refresh during processing restores job state
- [ ] Same-concept imports reuse one node and preserve source links
- [ ] Invalid plans and failed transactions leave no partial graph mutation
- [ ] Today integration and import states pass desktop/mobile visual review
- [ ] Ready for Phase 4: tree, graph and search
