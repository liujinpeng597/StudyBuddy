# Phase 4: Knowledge Tree, Graph, and Search

**Goal:** Make the merged knowledge network usable through the approved left directory, visual graph and global keyword/semantic search.

**Prerequisites:** Phase 3 is complete; nodes, relations, source links and Today integration results are available.

**Deliverables:** A complete knowledge tree, readable node content, an interactive graph with “今日织入,” and a global search that finds both normalized knowledge and original evidence.

**Implementation Status:** Done

**Interface Decisions Implemented:** Tree navigation; node reading layout; graph focus and selected state; relation-type styling; today highlight; search overlay with filters; keyboard shortcuts; mobile graph/list fallback; source-to-current-node routing.

---

## Task 1: Add tree and knowledge-content APIs and reading UI

**Goal:** Display the current global knowledge hierarchy and open canonical node content without exposing daily-note fragmentation.

**Files:**
- Create: `StudyBuddy/apps/web/src/app/api/tree/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/knowledge/[id]/route.ts`
- Create: `StudyBuddy/apps/web/src/app/(workbench)/knowledge/[id]/page.tsx`
- Modify: `StudyBuddy/apps/web/src/app/(workbench)/layout.tsx`
- Modify: `StudyBuddy/apps/web/src/components/workbench/WorkbenchShell.tsx`
- Create: `StudyBuddy/apps/web/src/components/knowledge/KnowledgeTree.tsx`
- Create: `StudyBuddy/apps/web/src/components/knowledge/KnowledgeTree.test.tsx`
- Create: `StudyBuddy/apps/web/src/components/knowledge/KnowledgeReader.tsx`
- Create: `StudyBuddy/apps/web/src/components/knowledge/MarkdownContent.tsx`
- Create: `StudyBuddy/apps/web/src/lib/server/markdown.ts`
- Create: `StudyBuddy/apps/web/e2e/knowledge-navigation.spec.ts`

**Steps:**
- [ ] Return a module → topic → knowledge-point tree sorted by stable module/title order, plus `changedByLatestJob` and `needsReview` flags from the latest completed import.
- [ ] Return node sections in the approved order, relation groups by type, source excerpts and the current canonical path. Do not return another user’s node or source.
- [ ] Render only sanitized Markdown with raw HTML disabled; render code as highlighted plain text, tables responsively and links with safe URL protocols.
- [ ] Implement a WAI-ARIA tree with Up/Down selection, Right expand, Left collapse, Home/End and Enter to open. Preserve the selected node after route navigation.
- [ ] Keep today’s changed nodes visually low-contrast but also expose a text “今日有更新” label for non-color users.
- [ ] Add loading, empty, node-not-found and section-render-error states.
- [ ] Write component tests for keyboard navigation and accessible names; write E2E coverage for opening a node from the tree and returning to the same focus.
- [ ] Run: `pnpm exec vitest run apps/web/src/components/knowledge/KnowledgeTree.test.tsx`
  - Expected: keyboard and expanded-state tests pass.
- [ ] Run: `pnpm test:e2e -- e2e/knowledge-navigation.spec.ts`
  - Expected: desktop and mobile routes open the same canonical node.

**Security/Boundary Notes:** The page and API resolve the user server-side. Sanitization happens server-side and again during React rendering where possible.

---

## Task 2: Add deterministic graph layout and the “今日织入” graph UI

**Goal:** Visualize 500 nodes and 1500 relations without changing the meaning of graph data, while making the latest import easy to inspect.

**Files:**
- Create: `StudyBuddy/packages/core/src/knowledge/graph-layout.ts`
- Create: `StudyBuddy/packages/core/src/knowledge/graph-layout.test.ts`
- Create: `StudyBuddy/apps/web/src/app/api/graph/route.ts`
- Modify: `StudyBuddy/apps/web/src/app/(workbench)/graph/page.tsx`
- Create: `StudyBuddy/apps/web/src/components/graph/GraphCanvas.tsx`
- Create: `StudyBuddy/apps/web/src/components/graph/GraphControls.tsx`
- Create: `StudyBuddy/apps/web/src/components/graph/GraphLegend.tsx`
- Create: `StudyBuddy/apps/web/src/components/graph/GraphAccessibleList.tsx`
- Create: `StudyBuddy/apps/web/src/components/graph/TodayWeaveLegend.tsx`
- Create: `StudyBuddy/apps/web/e2e/knowledge-graph.spec.ts`

**Steps:**
- [ ] Return nodes, typed edges, focus path, latest-job changed node IDs and persisted positions. Validate node/edge payloads with the shared graph schema.
- [ ] Seed each new module at a stable cluster anchor and each node from a deterministic hash; apply bounded collision layout once, then persist coordinates in `graph_layout` so the map does not jump between sessions.
- [ ] Add relation styles that differ by line pattern, label and color: prerequisite, part_of, related, contrast and applies_to. Never rely on color alone.
- [ ] Implement “今日织入”: teal outline for changed nodes; newly added relations include a short path animation only when reduced motion is not requested and only on first graph visit for the latest job.
- [ ] Clicking a node opens its detail route and centers/selects it when returning. Search results can pass `focusNodeId` to center a node.
- [ ] Add zoom, fit, module filter, relation filter and reset view controls with keyboard labels and 44px mobile targets.
- [ ] Provide `GraphAccessibleList` as an equivalent DOM list of nodes and typed relations; it is visible through a “列表视图” toggle and is the screen-reader fallback.
- [ ] Write a 500-node/1500-edge performance test with a 1.5-second client render budget, plus E2E tests for node selection, focus reset, today highlight, mobile list toggle and reduced motion.
- [ ] Run: `pnpm exec vitest run packages/core/src/knowledge/graph-layout.test.ts`
  - Expected: identical graph input yields identical layout and respects module anchors.
- [ ] Run: `pnpm test:e2e -- e2e/knowledge-graph.spec.ts`
  - Expected: graph and accessible list show the same node/relation set.

**Visual Verification:** Capture full graph, selected node, today highlight and list fallback at `1440×900`, `1024×768` and `390×844`. Check label collisions, edge legibility and excessive motion.

**Security/Boundary Notes:** Graph positions are display data only. No UI interaction may create or mutate a relation.

---

## Task 3: Implement exact, fuzzy and optional semantic search

**Goal:** Search normalized knowledge, original Q&A and LeetCode evidence with predictable ranking and current-node routing.

**Files:**
- Create: `StudyBuddy/packages/db/src/schema/search.ts`
- Create: `StudyBuddy/packages/db/src/migrations/0007_search_indexes.sql`
- Create: `StudyBuddy/packages/core/src/search/query.ts`
- Create: `StudyBuddy/packages/core/src/search/query.test.ts`
- Create: `StudyBuddy/packages/core/src/search/rank.ts`
- Create: `StudyBuddy/packages/core/src/search/rank.test.ts`
- Create: `StudyBuddy/packages/db/src/repositories/search-repository.ts`
- Create: `StudyBuddy/apps/web/src/app/api/search/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/search/route.integration.test.ts`

**Steps:**
- [ ] Add a `search_documents` table for knowledge-node and source text with `user_id`, type, title, body, node ID, source ID, updated time and `last_accessed_at`; update content inside the knowledge commit transaction and update access time when a user opens the node.
- [ ] Backfill `search_documents` from all existing knowledge nodes and source links in the same migration so Phase 3 data remains searchable.
- [ ] Add `pg_trgm` GIN indexes for title/body substring and similarity queries.
- [ ] Normalize queries by trimming, collapsing whitespace, enforcing 1–120 characters, rejecting control characters and escaping SQL wildcard characters; parse optional module, content-type and ISO `from`/`to` date filters.
- [ ] Rank exact title, exact alias, exact body, trigram similarity, recent access and recent update. Use deterministic tie-breaking by node ID.
- [ ] Deduplicate source hits into their canonical node while retaining a source snippet and content type.
- [ ] Generate a query embedding only when an `embedding` role is configured; merge vector results with keyword results and annotate the match reason. Without embeddings, keyword/trigram search remains fully functional.
- [ ] Limit responses to 20 and return highlighted snippet offsets rather than trusted HTML.
- [ ] Write tests for Chinese and English keywords, literal `%`/`_` characters, title/alias/body matches, source-to-node mapping, duplicate suppression, filters, empty query, control characters, cross-user isolation and no-embedding fallback.
- [ ] Run: `pnpm db:migrate`
  - Expected: `pg_trgm` indexes and optional vector index exist.
- [ ] Run: `pnpm test:integration -- apps/web/src/app/api/search/route.integration.test.ts`
  - Expected: all search ranking and isolation cases pass.

**Security/Boundary Notes:** SQL parameters are bound, snippets are encoded by the client and highlight offsets never inject HTML.

---

## Task 4: Build the global search overlay and mobile search route

**Goal:** Make search reachable from anywhere with keyword highlighting, filters and direct navigation to matched current knowledge.

**Files:**
- Create: `StudyBuddy/apps/web/src/components/search/SearchOverlay.tsx`
- Create: `StudyBuddy/apps/web/src/components/search/SearchResults.tsx`
- Create: `StudyBuddy/apps/web/src/components/search/SearchFilters.tsx`
- Create: `StudyBuddy/apps/web/src/components/search/HighlightedSnippet.tsx`
- Create: `StudyBuddy/apps/web/src/components/search/SearchOverlay.test.tsx`
- Create: `StudyBuddy/apps/web/src/app/(workbench)/search/page.tsx`
- Modify: `StudyBuddy/apps/web/src/components/workbench/WorkbenchShell.tsx`
- Create: `StudyBuddy/apps/web/e2e/search.spec.ts`

**Steps:**
- [ ] Open the search overlay from the persistent top-bar field and `Ctrl/Cmd+K`; close with Escape and restore focus to the trigger.
- [ ] Debounce requests by 250ms, abort stale requests, and maintain explicit idle, loading, success, no-result and error states.
- [ ] Show result title, module path, highlighted snippet, type (知识点/原始笔记/LeetCode), updated time and match reason when semantic search contributed.
- [ ] Provide filters for module, content type and time; filters must be removable in the empty state so the user can recover.
- [ ] On result selection, navigate to `/knowledge/:nodeId?highlight=:token`, scroll to the section/source evidence and center the graph node when requested.
- [ ] On screens below 768px, use a full-height search page while preserving same query/filter logic.
- [ ] Implement focus trapping, listbox semantics, arrow-key result selection and visible focus.
- [ ] Write component tests for shortcut open/close, stale request cancellation and highlight encoding; write E2E for keyword, source-only, semantic reason, filters, empty and mobile full-screen.
- [ ] Run: `pnpm exec vitest run apps/web/src/components/search/SearchOverlay.test.tsx`
  - Expected: interaction and accessibility tests pass.
- [ ] Run: `pnpm test:e2e -- e2e/search.spec.ts`
  - Expected: desktop overlay and mobile route return equivalent results.
- [ ] Capture search result, no-result and error states at `1440×900` and `390×844`.

**Visual Verification:** Search is a quiet overlay, not a new dashboard. Review keyboard focus, highlight contrast, long snippets, filters, overflow and sticky controls.

---

## Phase Completion Checklist

- [ ] All four tasks completed
- [ ] Tree, graph and search route to the same canonical node IDs
- [ ] “今日织入” is distinguishable without color and respects reduced motion
- [ ] Exact keyword search works without an embedding model
- [ ] Source-only matches jump to the merged current node
- [ ] 500-node graph, keyboard navigation and desktop/mobile screenshots pass review
- [ ] Ready for Phase 5: review questions and LeetCode links
