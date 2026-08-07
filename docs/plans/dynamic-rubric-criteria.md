# Plan: Dynamic Admin-Editable Rubric Criteria (single source of truth)

## Goal
Let the instructor add, edit, delete, and reorder rubric CRITERIA from the administration
dashboard, persisted in Firestore as a SINGLE source of truth. The student rating form, the
admin group results, the student detail modal, and the PDF exports all render dynamically
from that same source — so students immediately see and rate against the instructor's changes.

## Users
- **Instructors** — manage criteria rows (add / edit / delete / reorder) in a new CRITERIA admin tab.
- **Students** — always see and rate against the current live criteria set (no stale static HTML).

## Scope
**In scope:**
- `index.html` — new CRITERIA nav tab + admin editor section; student rubric `<tbody>` becomes
  a dynamic container (`#studentRubricBody`) with an empty-rubric message and a submit button
  that can be disabled; cache-busters bumped for `firestore-api.js?v=5` and `script.js?v=15`.
- `assets/js/firestore-api.js` — `rubric_criteria` collection + `getCriteria`,
  `seedCriteriaIfEmpty`, `saveCriterion`, `deleteCriterion`, `reorderCriteria`;
  `saveGroupRating` / `getStudentDetail` iterate the LIVE criteria ids.
- `assets/js/script.js` — criteria management UI (list/add/save/delete/reorder), dynamic student
  rubric rendering, live completeness check (`N` criteria), `4 * N` denominators everywhere,
  live criteria in student detail + PDF exports, empty-rubric safety.
- `docs/plans/dynamic-rubric-criteria.md` — this plan (docs/ only).
- `firestore.rules` — **no change** (repo convention `allow read, write: if true;`; see Risks).

**Out of scope:**
- No change to the number of groups (GROUP 1..10) or section `max_score` behavior.
- No hardening of Firestore security rules.
- No new test harness (verification is static + manual).

## Non-Goals
- Migrating legacy rating documents or rewriting `total_score` history.
- Per-instructor / per-section criteria sets (the rubric is global).
- Restricting editing by role beyond the existing client-side gating.

## Data Contract (BINDING)
- New Firestore collection: `rubric_criteria`
- Doc id: `C_<stable-slug-id>` where slug id = the criterion's stable key
  (existing 10 keep their exact keys; new ones get `criteria_<snake_case_slug>` generated
  once at creation and NEVER changed on rename).
- Doc fields:
  - `id` — stable key string
  - `name` — display name
  - `desc4`, `desc3`, `desc2`, `desc1` — level descriptions (Excellent=4 … Needs Improvement=1)
  - `position` — 0-based integer
  - `updatedAt` — Firestore server timestamp
- API (firestore-api.js, IIFE style):
  - `getCriteria()` → array ordered by position (seeds + returns defaults if collection empty; caches once per session)
  - `seedCriteriaIfEmpty()` → writes the 10 defaults in order; idempotent (checks count > 0)
  - `saveCriterion({id, name, desc4, desc3, desc2, desc1, position})` → set doc `C_<id>`
  - `deleteCriterion(id)` → delete doc `C_<id>`
  - `reorderCriteria(orderedIds)` → batch-update `position` on each doc
  - The legacy `CRITERIA` constant remains ONLY as a fallback for backward reads; the primary
    source is `getCriteria()`.
- `saveGroupRating` writes per-key fields from the LIVE criteria ids (skips unknown/legacy keys;
  legacy keys already stored in old docs remain).
- Level points are FIXED: Excellent=4, Good=3, Fair=2, Needs Improvement=1.

## 10 Default Criteria (seed, in order)
Keys (stable): `content_accuracy`, `understanding_topic`, `organization_structure`,
`delivery_communication`, `audience_engagement`, `visual_aids`, `professional_appearance`,
`teamwork_collaboration`, `time_allocation`, `strategies`. Names: Content Accuracy; Understanding
of Topic; Organization & Structure; Delivery & Communication; Audience Engagement; Visual
Aids/Materials; Professional Appearance; Teamwork/Collaboration; Time Allocation: 30 mins;
Strategies & Enjoyment. Level descriptions are copied VERBATIM from the original rubric table in
index.html (see `DEFAULT_CRITERIA` in firestore-api.js).

## Workstreams
Single integrated builder (Frontend + Data) on branch `feat/dynamic-rubric-criteria`.
All changes land as ONE unstaged diff in the worktree
`.worktrees/feat-responsive-ui-frontend` (tree identical to remote main `821b4d3` after PR #6).

## Acceptance Criteria
| # | Criterion |
|---|-----------|
| AC1 | First load (empty collection) creates exactly 10 seed criteria with exact names + verbatim descriptions, in order. |
| AC2 | Admin adds a criterion → new doc with stable slug id + correct position; list shows 11 rows. |
| AC3 | Admin edits name/descriptions → fields updated; id and position unchanged. |
| AC4 | Reorder → positions update so the ordered fetch reflects the new order. |
| AC5 | Student opening a group after admin changes → sees updated names/descriptions/order. |
| AC6 | Existing rating with `content_accuracy=3` survives a rename; score stays under the same id; total unchanged. |
| AC7 | Completeness check uses live N (submit blocked when fewer than N selected); total = 4·N when all Excellent. |
| AC8 | All denominator displays = 4·N (no hardcoded /40). |
| AC9 | Delete with confirm → removed from list; legacy stored field for that id ignored consistently; new totals recompute from live set; no corruption. |
| AC10 | Deleting the last criterion is blocked ("At least one criterion is required."). |
| AC11 | Empty rubric → "No criteria configured yet."; no crash; submit blocked. |
| AC12 | exportStudentPDF / exportRaterListPDF render live criteria without errors. |
| AC13 | Fresh session observes saved criteria changes (no stale static HTML). |

## Verification (static-only)
- `node --check assets/js/script.js` / `firestore-api.js` / `firebase-init.js` → exit 0
- grep: no `checkedCount < 10`, no `/40` remainders; `studentRubricBody`, `criteriaSection`,
  `rubric_criteria`, `noRubricCriteria`, `submitStudentBtn` present; cache versions bumped.
- Manual: admin CRITERIA tab add/edit/delete/reorder; student rating reflects changes; PDF exports work.

## Risks
- **Open Firestore rules** (`allow read, write: if true;`) — repo convention kept; anyone can
  read/write `rubric_criteria`. Noted, not hardened in this PR.
- **Client-side gating** — "admin" CRUD is gated only by the UI role, not server rules.
- **Mid-rating edits** — a student with the rating form open may see a different rubric if the
  instructor edits mid-session; the form re-renders on open and completeness uses the live count.
- **Max 20 / min 1 guards** — enforced client-side (toast on 20, block on deleting the last one).
- **Legacy ratings** — old per-key fields survive in stored docs but are ignored by the live UI;
  `total_score` history is not rewritten.
