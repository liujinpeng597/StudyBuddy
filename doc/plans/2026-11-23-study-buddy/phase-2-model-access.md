# Phase 2: Model Access and AI Adapter

**Goal:** Give the user a secure in-app way to connect an OpenAI-compatible model, prefill DeepSeek V4.1 Flash, verify its capabilities and bind it to import/review tasks.

**Prerequisites:** Phase 1 is complete; PostgreSQL, auth, server environment validation and the workbench shell are working.

**Deliverables:** Model profiles can be created, tested, updated, disabled and cleared; keys never return to the browser; a common adapter supports text, JSON and optional image calls.

**Implementation Status:** Done

**Interface Decisions Implemented:** Account-menu entry to “模型设置”; write-only API key field; explicit provider data-sharing notice; capability results; partial-capability state; disabled model state; desktop and mobile settings layout.

---

## Task 1: Build encrypted model profiles and task-role contracts

**Goal:** Persist model settings safely and expose a typed profile/task-role boundary before any network call exists.

**Files:**
- Create: `StudyBuddy/packages/core/src/schemas/model-profile.ts`
- Create: `StudyBuddy/packages/core/src/security/secret-box.ts`
- Create: `StudyBuddy/packages/core/src/security/secret-box.test.ts`
- Create: `StudyBuddy/packages/core/src/models/model-service.ts`
- Create: `StudyBuddy/packages/core/src/models/model-service.test.ts`
- Create: `StudyBuddy/packages/db/src/schema/models.ts`
- Create: `StudyBuddy/packages/db/src/repositories/model-repository.ts`
- Create: `StudyBuddy/packages/db/src/migrations/0002_model_profiles.sql`

**Steps:**
- [ ] Define Zod enums for `ModelTaskRole`: `image_extraction`, `normalization`, `merge_judgement`, `embedding`, `question_generation`, `answer_evaluation`.
- [ ] Define Zod enums for `ModelCapability`: `text`, `json`, `vision`, `embedding`; define profile status `untested`, `available`, `partial`, `failed`, `disabled`.
- [ ] Implement a versioned AES-256-GCM secret box using a random 12-byte IV per encryption and an authenticated envelope: format version, active key ID, IV, auth tag and ciphertext. Use the profile UUID as additional authenticated data.
- [ ] Store `api_key_ciphertext` as bytea, `api_key_hint` as the final four characters, and never store a full key in a hint or audit field.
- [ ] Add `ai_model_profiles`, `ai_usage_logs` and ordered `ai_task_routes` tables. `ai_task_routes` stores `user_id`, `task_role`, `position` and `profile_id` with a unique user/role/position constraint.
- [ ] Implement create/update/disable/clear-secret operations that always require `userId` and cannot modify another user’s profile.
- [ ] Write tests for encrypt/decrypt round trip, tamper rejection, wrong-profile AAD rejection, key masking, replacement, clearing and disabled-profile resolution.
- [ ] Run: `pnpm db:migrate`
  - Expected: model tables and constraints exist.
- [ ] Run: `pnpm exec vitest run packages/core/src/security/secret-box.test.ts packages/core/src/models/model-service.test.ts`
  - Expected: encryption and profile lifecycle tests pass.

**Security/Boundary Notes:** The model repository returns ciphertext only to the server-side service. Public profile DTOs contain `apiKeyHint` but no ciphertext or plaintext.

---

## Task 2: Implement the OpenAI-compatible provider and URL security policy

**Goal:** Provide one server-side adapter for text, structured JSON, optional image input, timeout, retry and sanitized failures.

**Files:**
- Create: `StudyBuddy/packages/ai/src/types.ts`
- Create: `StudyBuddy/packages/ai/src/openai-compatible-provider.ts`
- Create: `StudyBuddy/packages/ai/src/openai-compatible-provider.test.ts`
- Create: `StudyBuddy/packages/ai/src/validate-model-url.ts`
- Create: `StudyBuddy/packages/ai/src/validate-model-url.test.ts`
- Create: `StudyBuddy/packages/ai/src/prompts/connection-tests.ts`
- Create: `StudyBuddy/packages/ai/src/usage.ts`

**Steps:**
- [ ] Define `ModelProvider` methods for text generation, schema-constrained JSON generation and optional image extraction. Every request receives a resolved profile, task role, timeout and token limit.
- [ ] Build an OpenAI-compatible `/chat/completions` request without an SDK lock-in, using `Authorization: Bearer <decrypted-key>` only in server memory.
- [ ] Treat the configured Base URL as the provider root, reject query/fragment components, and append `/chat/completions` or `/embeddings` exactly once.
- [ ] Send `response_format` when JSON capability is enabled; validate the returned JSON with the caller’s Zod schema and return a typed parse error rather than accepting partial fields.
- [ ] Implement one retry for network errors, `429` and `5xx` with bounded exponential backoff; do not retry `401`, `403`, `404` or schema-invalid content.
- [ ] Sanitize provider errors to status class, safe message and request ID; never include Authorization headers, key text or full note content.
- [ ] Accept only HTTPS model URLs. Resolve the hostname and reject loopback, private, link-local, multicast and metadata-service targets unless an explicit injected test policy is used.
- [ ] Record latency, token counts, task role, profile, status and error code in `ai_usage_logs`; never log prompt text or image bytes.
- [ ] Write mocked-fetch tests for text, JSON, vision content, `429` retry, `401` no-retry, timeout and malformed JSON.
- [ ] Write SSRF tests for `http://169.254.169.254`, `https://127.0.0.1`, a private RFC1918 address and a valid public HTTPS endpoint.
- [ ] Run: `pnpm exec vitest run packages/ai/src/openai-compatible-provider.test.ts packages/ai/src/validate-model-url.test.ts`
  - Expected: all provider and URL policy cases pass without external network access.

**Security/Boundary Notes:** Prompt content is untrusted data. System instructions and note content use separate message roles; response data cannot trigger tools or database operations.

---

## Task 3: Add model APIs, connection tests and role resolution

**Goal:** Expose authenticated profile CRUD and a capability test that enables only task roles actually proven by the endpoint.

**Files:**
- Create: `StudyBuddy/apps/web/src/app/api/models/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/models/route.integration.test.ts`
- Create: `StudyBuddy/apps/web/src/app/api/models/[id]/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/models/[id]/test/route.ts`
- Create: `StudyBuddy/packages/core/src/models/connection-tester.ts`
- Create: `StudyBuddy/packages/core/src/models/connection-tester.test.ts`
- Create: `StudyBuddy/packages/ai/src/profile-resolver.ts`
- Create: `StudyBuddy/packages/ai/src/profile-resolver.test.ts`

**Steps:**
- [ ] Implement authenticated `GET`/`POST /api/models`, `PATCH`/`DELETE /api/models/:id`, and `POST /api/models/:id/test`.
- [ ] On `PATCH`, preserve the existing key when the key field is omitted; require an explicit Replace key action to change it and an explicit Clear key action to remove it.
- [ ] Validate profile fields: display name 1–80 characters, Base URL 1–2048 characters, Model ID 1–200 characters, API key 1–4096 characters and at least one requested role.
- [ ] Prefill new profile display name with `DeepSeek V4.1 Flash`; leave Base URL, Model ID and key blank for intentional user entry.
- [ ] Test text first, JSON second, vision only when requested and embedding only when requested. Use fixed synthetic prompts, a tiny generated test image and a one-sentence embedding input; do not use user notes.
- [ ] Set profile status to `available`, `partial` or `failed`. Bind a task role only when its required test passes: JSON roles require `json`; image extraction requires `vision`.
- [ ] For `embedding`, require a numeric vector of the configured `EMBEDDING_DIMENSIONS` (default `1536`); reject mismatched dimensions with `EMBEDDING_DIMENSION_MISMATCH`.
- [ ] Resolve a task role to exactly one active profile or an explicitly ordered user-configured fallback list. If none is configured, return `MODEL_ROLE_NOT_CONFIGURED`.
- [ ] Reject model calls when a profile is disabled even if it previously passed tests.
- [ ] Write route tests for unauthenticated access, another-user denial, key-not-returned, invalid role bindings, partial capability, embedding dimension mismatch and disabled-profile resolution.
- [ ] Run: `pnpm test:integration -- apps/web/src/app/api/models/route.integration.test.ts`
  - Expected: model CRUD, secret masking and user-isolation tests pass against the test database.
- [ ] Run: `pnpm exec vitest run packages/core/src/models/connection-tester.test.ts packages/ai/src/profile-resolver.test.ts`
  - Expected: capability and ordered-role resolution tests pass with a fake provider.

**Security/Boundary Notes:** `POST /test` must consume a user-scoped profile by ID and must not accept a raw key from an arbitrary request body after profile creation.

---

## Task 4: Build the model settings interface

**Goal:** Let the user configure and understand model access without exposing secrets or requiring a redeploy.

**Files:**
- Create: `StudyBuddy/apps/web/src/app/(workbench)/settings/models/page.tsx`
- Modify: `StudyBuddy/apps/web/src/components/workbench/WorkbenchShell.tsx`
- Create: `StudyBuddy/apps/web/src/components/models/ModelProfileList.tsx`
- Create: `StudyBuddy/apps/web/src/components/models/ModelProfileForm.tsx`
- Create: `StudyBuddy/apps/web/src/components/models/CapabilityBadges.tsx`
- Create: `StudyBuddy/apps/web/src/components/models/ModelTestResult.tsx`
- Create: `StudyBuddy/apps/web/e2e/model-settings.spec.ts`

**Steps:**
- [ ] Show existing profiles as rows with display name, masked key hint, status, last test time and bound task roles.
- [ ] Add “模型设置” to the account menu and keep the active model status visible after navigation.
- [ ] Build a form with display name, Base URL, API Model ID, write-only API key, requested capabilities and ordered task-role selectors; make a backup profile optional rather than automatic.
- [ ] Show helper text for DeepSeek V4.1 Flash: the exact Model ID and endpoint come from the user’s provider and are not inferred by the app.
- [ ] Display the required data-sharing notice before the first test: notes/screenshots are sent to the configured provider.
- [ ] After saving a key, show only its final four characters. Offer Replace key and Clear key actions with confirmation for Clear.
- [ ] Implement these states: no profiles, editing, testing, available, partial, failed, disabled and loading.
- [ ] Add a manual Refresh capability test action; preserve previously tested roles if a later network test fails, but mark the profile `failed` and prevent task execution until retested.
- [ ] Write Playwright tests for creating a profile, validation errors, key masking, partial capabilities, disabled profile and mobile layout.
- [ ] Run: `pnpm test:e2e -- e2e/model-settings.spec.ts`
  - Expected: all settings states and secret-masking assertions pass.
- [ ] Capture `/settings/models` at `1440×900`, `1024×768` and `390×844`.
  - Expected: labels and statuses remain readable, no secret is rendered, and the action hierarchy is clear.

**Visual Verification:** Use the approved token palette, borders and restrained focus styles. Capability/status badges must include text, not color alone. Review empty, failed and partial states for hierarchy and overflow.

---

## Phase Completion Checklist

- [ ] All four tasks completed
- [ ] Model API keys exist only as AES-GCM ciphertext in the database and transient server memory
- [ ] DeepSeek V4.1 Flash can be configured without code/deploy changes
- [ ] Text, JSON and optional vision tests produce explicit capability results
- [ ] Model settings passes API, E2E, keyboard and responsive visual checks
- [ ] Ready for Phase 3: importing and merging notes
