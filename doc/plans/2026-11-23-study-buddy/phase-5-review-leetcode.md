# Phase 5: Review Questions and LeetCode Links

**Goal:** Turn committed daily knowledge into objective and free-response review, and preserve LeetCode screenshots as searchable, graph-linked problem evidence.

**Prerequisites:** Phases 1-4 are complete; merged node provenance, relations, tree, graph and search work.

**Deliverables:** Imported knowledge generates answerable questions with automatic objective scoring, rubric-based free-response feedback and links to LeetCode problem records.

**Implementation Status:** Done

**Interface Decisions Implemented:** Review tab; objective question states; free-response submission and feedback; source-node links; LeetCode evidence card; inferred metadata labels; retry when AI feedback fails.

---

## Task 1: Define question generation and objective scoring

**Goal:** Generate grounded, validated questions from the latest import and one-hop related nodes, then score objective answers deterministically.

**Files:**
- Create: `StudyBuddy/packages/core/src/schemas/question.ts`
- Create: `StudyBuddy/packages/core/src/review/question-generation.ts`
- Create: `StudyBuddy/packages/core/src/review/question-generation.test.ts`
- Create: `StudyBuddy/packages/core/src/review/objective-scoring.ts`
- Create: `StudyBuddy/packages/core/src/review/objective-scoring.test.ts`
- Create: `StudyBuddy/apps/worker/src/question-generation-step.ts`
- Create: `StudyBuddy/apps/worker/src/question-generation-step.test.ts`
- Modify: `StudyBuddy/apps/worker/src/import-pipeline.ts`
- Create: `StudyBuddy/packages/db/src/schema/review.ts`
- Create: `StudyBuddy/packages/db/src/migrations/0008_questions_attempts.sql`
- Create: `StudyBuddy/packages/ai/src/prompts/question-generation.ts`
- Create: `StudyBuddy/packages/test-fixtures/ai/review-questions.json`

**Steps:**
- [ ] Define question types `single_choice`, `multiple_choice`, `fill_blank`, `true_false` and `short_answer`; require at least one `sourceNodeId`, prompt, answer key, explanation and generated-from-job ID.
- [ ] After graph commit, select every changed node plus its one-hop `prerequisite`, `related` and `contrast` neighbors, deduplicated by node ID and capped at 12 nodes.
- [ ] Generate five objective questions and two short-answer questions by default from source-grounded prompts; discard any question that references a missing node or adds an unsupported fact.
- [ ] Validate that single-choice has exactly four unique options and one correct option, multiple-choice has 2–6 unique options, fill/true-false keys are non-empty, and short answers have at least three rubric points.
- [ ] If question generation fails after the graph has committed, keep the import complete and mark the review sub-step `failed` with a retry action. Do not roll back valid knowledge.
- [ ] Implement deterministic scoring for sets, normalized whitespace, case-insensitive Latin text and configured alternate answers. Never send an objective answer to AI for scoring.
- [ ] Write tests for grounded generation rejection, duplicate neighbors, each objective type, multiple-answer order, Chinese whitespace, alternate answers and invalid question schemas.
- [ ] Run: `pnpm db:migrate`
  - Expected: `questions` and `attempts` tables exist with source relationships.
- [ ] Run: `pnpm exec vitest run packages/core/src/review/question-generation.test.ts packages/core/src/review/objective-scoring.test.ts apps/worker/src/question-generation-step.test.ts`
  - Expected: all generation-validation and scoring cases pass.

**Security/Boundary Notes:** Generated question prompts are data, not executable instructions. Source-node IDs are validated against the committing user before database insert.

---

## Task 2: Implement short-answer evaluation with structured feedback

**Goal:** Evaluate a free-response answer against the imported explanation rubric without rewriting the knowledge graph.

**Files:**
- Create: `StudyBuddy/packages/core/src/schemas/answer-evaluation.ts`
- Create: `StudyBuddy/packages/core/src/review/short-answer-evaluation.ts`
- Create: `StudyBuddy/packages/core/src/review/short-answer-evaluation.test.ts`
- Create: `StudyBuddy/packages/ai/src/prompts/answer-evaluation.ts`
- Create: `StudyBuddy/packages/ai/src/prompts/answer-evaluation.test.ts`
- Create: `StudyBuddy/apps/web/src/app/api/attempts/route.ts`
- Create: `StudyBuddy/apps/web/src/app/api/attempts/route.integration.test.ts`
- Modify: `StudyBuddy/apps/worker/src/env.ts`
- Modify: `StudyBuddy/apps/web/src/lib/server/env.ts`

**Steps:**
- [ ] Define evaluation output with `coveredPoints`, `missingPoints`, `incorrectPoints`, `clarityFeedback`, `score` from 0–5, `confidence` and `usedSourceNodeIds`.
- [ ] Build the evaluator prompt from the question, rubric, the current answer, and only the cited node sections. Forbid adding unrelated knowledge or changing the rubric.
- [ ] Validate every referenced rubric point and source ID; if the response is invalid, preserve the user’s answer and return `EVALUATION_UNAVAILABLE`.
- [ ] Show clear feedback when model confidence is below the configured threshold: mark it as “需自行对照”，never present a low-confidence score as authoritative.
- [ ] Save objective scores immediately and save short-answer feedback only after successful schema validation. Retries of the same answer create a new attempt linked to the same question.
- [ ] Add env defaults `SHORT_ANSWER_CONFIDENCE_THRESHOLD=0.65` and `MAX_AI_EVALUATIONS_PER_DAY=100`; validate both at startup.
- [ ] Write tests for covered/missing/incorrect classification, low confidence, hallucinated source rejection, provider failure, daily limit and answer preservation.
- [ ] Run: `pnpm exec vitest run packages/core/src/review/short-answer-evaluation.test.ts`
  - Expected: feedback validation and answer-preservation tests pass.
- [ ] Run: `pnpm test:integration -- apps/web/src/app/api/attempts/route.integration.test.ts`
  - Expected: feedback validation, limits and persistence tests pass.

**Security/Boundary Notes:** The evaluator cannot mutate nodes, relations or questions. Full user answers stay private and are excluded from usage logs.

---

## Task 3: Persist LeetCode evidence and link it to the knowledge graph

**Goal:** Store screenshot-derived problem records with explicit uncertainty and connect them to relevant knowledge nodes without creating an online judge.

**Files:**
- Create: `StudyBuddy/packages/core/src/schemas/leetcode-problem.ts`
- Create: `StudyBuddy/packages/core/src/knowledge/leetcode-linker.ts`
- Create: `StudyBuddy/packages/core/src/knowledge/leetcode-linker.test.ts`
- Create: `StudyBuddy/packages/db/src/schema/leetcode.ts`
- Create: `StudyBuddy/packages/db/src/migrations/0009_leetcode_problems.sql`
- Create: `StudyBuddy/packages/db/src/repositories/leetcode-repository.ts`
- Modify: `StudyBuddy/apps/worker/src/knowledge-commit-step.ts`
- Create: `StudyBuddy/apps/web/src/components/leetcode/LeetCodeCard.tsx`
- Modify: `StudyBuddy/apps/web/src/app/api/knowledge/[id]/route.ts`

**Steps:**
- [ ] Create `leetcode_problems` and `problem_node_links`. Store source asset, visible title/number/description/code, inferred data structures, algorithm, complexity and optimization notes.
- [ ] Backfill any Phase 3 `leetcode_problem` candidates already present in the local development database into `leetcode_problems`, marking them unlinked and `needs_review=true` until re-resolution succeeds.
- [ ] Upsert a `search_documents` row for each problem title, description and code so LeetCode evidence participates in the Phase 4 global search.
- [ ] Keep visible extracted values and inferred values as separate fields. Missing visible fields remain null; `incompleteFields` lists what the screenshot did not show.
- [ ] During knowledge commit, link each problem to at least one validated node when possible; if no safe relation exists, save it unlinked with `needs_review=true` rather than inventing a concept.
- [ ] Return a short-lived signed screenshot URL only to the owner and expose no object key.
- [ ] Render a compact LeetCode card with code, complexity, optimization notes, linked knowledge points and clearly visible “AI 推断” badges.
- [ ] Do not create coding prompts, run code, submit solutions or generate LeetCode variants.
- [ ] Write tests for a complete fixture, missing title, missing complexity, no-safe-node link, cross-user denial and signed URL expiry.
- [ ] Run: `pnpm exec vitest run packages/core/src/knowledge/leetcode-linker.test.ts`
  - Expected: linking and uncertainty tests pass.
- [ ] Run: `pnpm test:integration -- apps/worker/src/knowledge-commit-step.integration.test.ts`
  - Expected: the screenshot fixture creates one problem and the expected knowledge links.

**Visual Verification:** Review linked, unlinked, incomplete and AI-inferred LeetCode cards at desktop and mobile widths. The screenshot evidence and inferred labels must remain distinguishable.

---

## Task 4: Build the review workbench and complete answer flow

**Goal:** Let the user complete a daily mixed review, receive trustworthy feedback and jump back to every question’s source knowledge.

**Files:**
- Modify: `StudyBuddy/apps/web/src/app/(workbench)/review/page.tsx`
- Create: `StudyBuddy/apps/web/src/app/api/questions/route.ts`
- Create: `StudyBuddy/apps/web/src/components/review/ReviewPanel.tsx`
- Create: `StudyBuddy/apps/web/src/components/review/QuestionCard.tsx`
- Create: `StudyBuddy/apps/web/src/components/review/ObjectiveQuestion.tsx`
- Create: `StudyBuddy/apps/web/src/components/review/ShortAnswerQuestion.tsx`
- Create: `StudyBuddy/apps/web/src/components/review/AnswerFeedback.tsx`
- Create: `StudyBuddy/apps/web/src/components/review/ReviewProgress.tsx`
- Create: `StudyBuddy/apps/web/e2e/review-flow.spec.ts`

**Steps:**
- [ ] Fetch questions for the latest import job, ordered objective first then short answer, while preserving question IDs and source references.
- [ ] Render radio controls for single choice, checkboxes for multiple choice, a single-line text control for fill blank, a two-state control for true/false and a resizable text area for short answer.
- [ ] Immediately show correctness, selected/correct answers and explanation for objective questions; provide Retry evaluation and manual rubric comparison for unavailable short-answer evaluation.
- [ ] Show review progress as answered questions out of total questions and provide direct links to each question’s source knowledge node.
- [ ] Preserve unsent answers when navigating between questions; warn before leaving only if the short-answer text is non-empty and unsent.
- [ ] Add loading, no-questions, generation-failed with retry, partially answered, completed and evaluation-failed states.
- [ ] Write Playwright tests for all four objective types, short-answer feedback, retry, source navigation, mobile text-area layout and keyboard selection.
- [ ] Run: `pnpm test:e2e -- e2e/review-flow.spec.ts`
  - Expected: complete daily review flow passes with deterministic fake AI responses.
- [ ] Capture review list, incorrect feedback and short-answer feedback at `1440×900` and `390×844`.
  - Expected: answer controls meet 44px touch targets; long feedback wraps without clipping.

**Visual Verification:** Feedback is ordered as result, correction/covered points, explanation/rubric, then source link. Do not use celebratory decoration or high-motion effects that compete with the approved graph signature.

---

## Phase Completion Checklist

- [ ] All four tasks completed
- [ ] Every question cites at least one accessible source node
- [ ] Objective questions score deterministically without model cost
- [ ] Short-answer failures preserve the user’s answer and expose retry/manual comparison
- [ ] LeetCode records retain screenshots and separate visible evidence from inference
- [ ] Review flow, source navigation and mobile controls pass E2E and visual review
- [ ] Ready for Phase 6: undo, hardening and acceptance
