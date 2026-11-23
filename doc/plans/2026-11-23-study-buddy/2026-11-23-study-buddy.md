# StudyBuddy Implementation Plan

**Created:** 2026-11-23  
**Status:** Done (local implementation and acceptance complete; production deployment deferred)  
**Source Spec:** `C:\Users\24191\Desktop\Colin\colin-7\xmbB\StudyBuddy\doc\2026-11-23-study-buddy-design.md`

## Overview

**Goal:** Build a personal, responsive StudyBuddy web application that imports daily Markdown notes and LeetCode screenshots, continuously merges them into one knowledge graph, supports search, and generates objective and free-response review questions.

**Architecture:** Use a `pnpm` TypeScript workspace with a Next.js web application, a separately started PostgreSQL-backed Worker, PostgreSQL with `pgvector`, and S3-compatible private object storage. AI calls go through a server-only, user-configurable OpenAI-compatible adapter; DeepSeek V4.1 Flash is the prefilled default profile. A deterministic pipeline, not an Agent framework, controls extraction, normalization, validation, and database commits.

**Tech Stack:** Node.js 24, pnpm 11, Next.js App Router, React, TypeScript, CSS Modules with global design tokens, PostgreSQL 16, pgvector, Drizzle ORM, Vitest, Testing Library, Playwright, Axe, React Flow, Zod, MinIO for local object storage. No Tailwind or broad third-party UI kit is introduced in the first version.

**Runtime baseline discovered:** `node v24.14.0`, `npm 11.9.0`, `pnpm 11.19.0`, Git `2.31.1.windows.1`, and Docker `29.8.0` are installed. The project is not yet a Git repository.

## Files and Responsibilities

| File/Module | Action | Responsibility | Notes |
|---|---|---|---|
| `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json` | Create | Workspace scripts, shared TypeScript defaults, quality gates | No monorepo tool beyond pnpm workspaces |
| `eslint.config.mjs`, `prettier.config.mjs`, `.gitignore`, `.env.example` | Create | Formatting, linting, ignored secrets/artifacts, environment contract | Never commit real keys |
| `docker-compose.yml` | Create | Local PostgreSQL/pgvector and MinIO services | Development and integration tests only |
| `apps/web/src/app` | Create | Routes, layouts, server pages and route handlers | Workbench routes and API boundary |
| `apps/web/src/components` | Create | Workbench, graph, search, review, import and model settings components | Preserve approved visual contract |
| `apps/web/src/lib/server` | Create | Web-only auth, authorization, request validation and service composition | Never imports client code |
| `apps/web/src/styles` | Create | Global CSS variables, base typography and responsive rules | Small reusable token layer, not a broad design system |
| `apps/web/e2e` | Create | Playwright user journeys and screenshot checks | Desktop, tablet and mobile |
| `apps/worker/src` | Create | Long-running job worker, queue lease, retries and import pipeline | No UI code and no unrestricted DB access |
| `packages/core/src/schemas` | Create | Zod contracts for notes, model responses, graph changes, questions and auth | Shared source of runtime truth |
| `packages/core/src/auth` | Create | Password hashing, session token creation and authorization policy | Single controlled user in first version |
| `packages/core/src/import` | Create | Markdown parsing, chunking and source classification | Deterministic logic before AI |
| `packages/core/src/knowledge` | Create | Node resolution, relation validation, merge diffs and revisions | Sole owner of graph mutation rules |
| `packages/core/src/review` | Create | Question answer normalization and objective scoring | AI-provided feedback is validated separately |
| `packages/core/src/search` | Create | Query normalization, result deduplication and ranking inputs | SQL execution stays in repository layer |
| `packages/core/src/security` | Create | AES-GCM secret box, model URL policy and redaction helpers | No external crypto service |
| `packages/db/src/schema` | Create | Drizzle table definitions and enums | Mirrors the approved domain model |
| `packages/db/src/migrations` | Create | SQL migrations, indexes and RLS policies | Applied with Drizzle Kit |
| `packages/db/src/repositories` | Create | User-scoped data access and transactional commit operations | Every query enforces user boundary |
| `packages/ai/src` | Create | Provider interface, OpenAI-compatible client, prompts, retries and usage capture | No LangChain/LangGraph |
| `packages/storage/src` | Create | Private S3-compatible upload, signed read and delete operations | No public objects |
| `packages/test-fixtures` | Create | Golden Markdown notes, screenshots, AI responses and expected graph results | Tests do not depend on live AI |
| `scripts` | Create | Environment check, user creation, migration wrapper and fixture loading | Non-interactive commands for agents/CI |

## Interface Implementation Map

| Design Decision | Source | Implementation Surface | Verification |
|---|---|---|---|
| Left global tree, right workspace, workbench tabs | Spec: Layout and Responsive Behavior | `app/(workbench)/layout.tsx`, `components/workbench/*`, routes `/today`, `/graph`, `/review`, `/imports` | Playwright layout assertions and screenshots |
| `< 768px` drawer, horizontal work tabs, full-width graph | Spec: Layout and Responsive Behavior | `MobileNavigation.tsx`, `WorkbenchTabs.tsx`, CSS media queries | 390×844 screenshot and keyboard/touch checks |
| Fresh technical-workbench visual system and no purple/glow | Spec: Visual System | `styles/tokens.css`, `styles/globals.css` | Token assertions, computed-style checks and screenshot review |
| “今日织入” graph signature | Spec: Visual System | `components/graph/GraphCanvas.tsx`, `TodayWeaveLegend.tsx` | Graph selected/today state at 1440 and 390 widths; reduced-motion check |
| Daily import, progress and integration result | Spec: Experience and Journeys | `/today`, `ImportDrawer`, `/api/imports`, Worker | E2E import fixture and refresh-during-processing test |
| Global search overlay, filters and highlighted snippets | Spec: Experience and Journeys | `SearchOverlay`, `/api/search` | `Ctrl/Cmd+K`, empty/loading/error/no-result tests |
| Model self-configuration and capability test | Spec: 自主接入模型 | `/settings/models`, model API routes, Model Settings Service | CRUD/test API tests and 1024-width settings screenshot |
| Objective and free-response review | Spec: Components and States | `/review`, `ReviewPanel`, `QuestionCard`, `/api/questions`, `/api/attempts` | Scoring unit tests, feedback states and source-link E2E |
| LeetCode visual evidence and inferred metadata | Spec: LeetCode 档案 | `LeetCodeCard`, problem extraction schema, graph node links | Fixture screenshot extraction and inference-label check |
| Import history, diff and undo | Spec: Data Flow / 撤销 | `/imports`, revision service and confirmation dialog | Conflict/no-conflict undo integration tests |
| Keyboard, focus, semantic tree and reduced motion | Spec: Accessibility and Visual Verification | All interactive components and Playwright accessibility checks | Axe scans plus manual keyboard checks |
| WCAG AA colors and approved type scale | Spec: Visual System | CSS tokens and base styles | Contrast script and visual review |

## Phases

### Phase 1: Foundation, Authentication, and Workbench Shell

**File:** [phase-1-foundation-workbench.md](phase-1-foundation-workbench.md)  
**Goal:** Create the workspace, local infrastructure, controlled single-user login, database foundation and approved responsive workbench shell.  
**Tasks:** 4  
**Status:** Done

### Phase 2: Model Access and AI Adapter

**File:** [phase-2-model-access.md](phase-2-model-access.md)  
**Goal:** Let the user securely configure and test an OpenAI-compatible model profile, including DeepSeek V4.1 Flash defaults, and route task roles through a validated adapter.  
**Tasks:** 4  
**Status:** Done

### Phase 3: Import, Normalization, Knowledge Merge, and Today View

**File:** [phase-3-import-knowledge-merge.md](phase-3-import-knowledge-merge.md)  
**Goal:** Deliver the end-to-end daily flow from Markdown/image upload through normalization and transactional merge into the global knowledge graph, with progress and an integration summary.  
**Tasks:** 6  
**Status:** Done

### Phase 4: Knowledge Tree, Graph, and Search

**File:** [phase-4-tree-graph-search.md](phase-4-tree-graph-search.md)  
**Goal:** Make merged knowledge navigable through the approved workbench tree and graph, and make both normalized content and original sources searchable.  
**Tasks:** 4  
**Status:** Done

### Phase 5: Review Questions and LeetCode Links

**File:** [phase-5-review-leetcode.md](phase-5-review-leetcode.md)  
**Goal:** Generate and grade objective questions, evaluate free-response explanations, and connect LeetCode screenshot evidence to relevant knowledge nodes.  
**Tasks:** 4  
**Status:** Done

### Phase 6: Undo, Hardening, and Acceptance

**File:** [phase-6-recovery-hardening.md](phase-6-recovery-hardening.md)  
**Goal:** Add import history and safe undo, close security and reliability gaps, verify performance/accessibility, and define deployment and rollback.  
**Tasks:** 4  
**Status:** Done

## Dependencies

- Phase 2 depends on the environment, database, auth and server composition established in Phase 1.
- Phase 3 depends on a tested model profile interface and fake provider from Phase 2.
- Phase 4 depends on committed normalized nodes and relations from Phase 3.
- Phase 5 depends on node-level provenance and cross-node relations from Phases 3-4.
- Phase 6 requires working migrations and stable APIs from Phases 1-5.
- Local development uses PostgreSQL 16 with `pgvector` and MinIO through Docker Compose.
- Production can use any S3-compatible private store and managed PostgreSQL 16; provider selection remains deferred.
- Live AI credentials are entered through the application. CI and deterministic tests use `FakeModelProvider`.
- The first authorization model is one controlled password account with no public registration. This satisfies the approved “受控登录” option.
- Semantic search and embedding-based node matching activate only after an `embedding` model profile is configured; exact, alias and trigram matching must continue to work without one.

## Success Criteria

- [x] The application starts locally with `pnpm dev`; first launch creates the single account.
- [x] The workbench matches the approved left-tree/right-workspace design at 1440×900, 1024×768 and 390×844.
- [x] A model profile can be created, edited, tested, assigned to task roles and deleted without exposing its full API key.
- [x] Markdown and screenshot imports survive page refresh and use transactional graph commits.
- [x] Two study days of the same C++ topic reuse one canonical node with source links.
- [x] The knowledge tree, graph, “今日织入,” and keyword search route to the same canonical nodes.
- [x] Objective and free-response questions are generated from source nodes and provide validated feedback.
- [x] LeetCode screenshots preserve visual evidence and expose extracted fields plus inference labels.
- [x] Import undo restores the pre-import graph when safe.
- [x] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, and `pnpm build` pass.
- [x] Model keys and session tokens are not returned to browser clients.
- [x] Mobile navigation, focus styles, reduced motion and graph list fallback are implemented.

## Deferred Decisions

- **Production hosting:** PostgreSQL, object storage and Web/Worker hosts remain provider-neutral. Local default is PGlite plus private filesystem storage; production is a managed PostgreSQL 16 instance, private S3-compatible storage, and separate Web/Worker Node processes.
- **Exact DeepSeek endpoint and Model ID:** supplied through UI. Safe default: prefill display name `DeepSeek V4.1 Flash`; do not hardcode a model slug or endpoint.
- **Vision capability:** the user may use the same profile for images or add a vision profile. Safe default: do not assume image support; connection tests enable only tested task roles.
- **Embedding model and dimensions:** semantic search is optional. Current portable implementation stores JSON vectors and compares them with cosine similarity; exact/trigram matching works without an embedding profile.
- **PWA offline mode:** the first version ships install metadata and responsive HTML only. Safe default: no service worker/offline write queue.
- **Dark theme:** safe default is the approved light-only token set.
- **Local model endpoints:** safe default blocks private IP targets; a later explicit local-endpoint policy can expand this without changing the AI Adapter interface.
- **Automatic spaced repetition:** safe default reviews the latest imported job plus one-hop related nodes; no memory-curve scheduler in this plan.

## Implementation Status

**Implemented:** 2026-11-23

- The application runs at `http://localhost:3000` with the Web app, Worker, local PostgreSQL-compatible PGlite database, and local private file storage.
- Docker Desktop data was moved out of the C drive to `D:\DockerData\DockerDesktopWSL`.
- StudyBuddy runtime data is stored at `D:\StudyBuddyData`.
- The local development fallback uses PGlite because Docker Hub image pulls timed out in this environment. Production PostgreSQL and S3-compatible storage remain supported.
- Embeddings are stored as JSON vectors and compared with cosine similarity locally, allowing the same behavior with PGlite and PostgreSQL.
- The test account and test data were removed after acceptance, leaving the app in first-use setup state.

**Verification completed:**

- `pnpm typecheck`
- `pnpm lint`
- `pnpm test` — 13 tests passed
- `pnpm test:integration` — 2 tests passed
- `pnpm test:e2e` — 12 tests passed across desktop, tablet and mobile
- `pnpm build`
- `pnpm smoke`

**Production-only follow-up:** deploy PostgreSQL/object storage, configure production secrets and model credentials, run backup/restore against the chosen managed database, and deploy Web/Worker containers.
