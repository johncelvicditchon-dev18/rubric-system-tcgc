# Plan: Score Badge Visibility on "SELECT GROUP TO RATE"

## Goal
Hide the numeric score badge (e.g., "40/40") on the student group grid for OPEN groups the
student has already rated — the "Update Rating" button already makes the rating editable, so
showing the score invites score-gaming and duplicates information available in the form. KEEP
the score badge for LOCKED (closed) groups with a rating, where the rating view is already
read-only and the score is the only feedback the student gets.

## Users
- **Students** — see a clean grid: "RATED" instead of a numeric score on open groups they rated;
  still see their score on locked groups via the read-only "View My Score" view.
- **Instructors** — unaffected: admin tables, detail views, and PDF exports keep scores.

## Scope
**In scope (2-line change, JS + cache-bust only):**
- `assets/js/script.js` line 459, inside `renderStudentGroups()` (function spans lines 432–485):
  in the **open + rated** branch, replace
  `<span class="score-badge">${displayScore}/${criteriaDenominator()}</span>`
  with `<span class="rate-badge-inline">RATED</span>`.
  - Reuses the existing `.rate-badge-inline` class (`assets/css/styles.css` lines 446–456,
    already used for "RATE HERE") — **no CSS change**.
- `assets/js/script.js` lines 454–455 (**KEEP unchanged**): closed + rated branch still renders
  `<span class="closed-badge">… CLOSED</span>` **and** `<span class="score-badge">${displayScore}/${criteriaDenominator()}</span>`.
- `index.html` line 436: bump cache-buster `assets/js/script.js?v=26` → `assets/js/script.js?v=27`.

**Out of scope:**
- No changes to `openStudentGroupRating()`, `handleSaveStudentRating()`, or any rating flow.
- No changes to instructor views / PDF exports (script.js lines 666 / 755 / 1180 / 1350 keep scores).
- No changes to `firestore-api.js`, `firestore.rules`, or `styles.css`.
- No new data contracts, no API changes, no migrations.

## Non-Goals
- Changing badge styling or adding a new CSS class (`.rate-badge-inline` is reused as-is).
- Altering score computation, denominators, or Firestore rating documents.
- Touching the closed+rated, closed+unrated, or own-group branches of `renderStudentGroups()`.
- Adding a test harness (verification is static checks + manual browser matrix).

## Workstreams
Single integrated workstream — no separate API/UI contracts needed (this is a 2-line,
view-only change; no data contract, API, or storage layer is touched).

| Workstream | Branch | Agent | Scope |
|------------|--------|-------|-------|
| **Frontend** | `feat/score-badge-visibility` | Frontend Builder | `assets/js/script.js:459` (open+rated badge swap) + `index.html:436` (cache-bust `?v=27`) |

> **Ownership rule:** Frontend Builder owns **only** `assets/js/script.js:459` and
> `index.html:436`. MUST NOT touch script.js lines 666/755/1180/1350, `openStudentGroupRating()`,
> `handleSaveStudentRating()`, `firestore-api.js`, `firestore.rules`, or `styles.css`.
> No separate API contract or UI contract document is produced for this change.

## Acceptance Criteria
| # | Criterion | Verified At |
|---|-----------|-------------|
| AC1 | OPEN + RATED group card shows **no** numeric score badge; shows `RATED` badge instead; "Update Rating" button still opens the **editable** form (radios enabled, save works). | Manual grid + form |
| AC2 | LOCKED + RATED group card **keeps** the score badge (`{score}/{denominator}`) plus CLOSED badge; "View My Score" opens **read-only** view (radios disabled, save blocked). | Manual grid + form |
| AC3 | LOCKED + UNRATED group card shows CLOSED badge + disabled "Group Closed" button; no score badge. | Manual grid |
| AC4 | Own group card unchanged: "YOUR GROUP" badge + disabled "Cannot Rate Own Group" button. | Manual grid |
| AC5 | Rating flow unchanged: open+unrated → "RATE HERE" + "Rate Now" opens editable form; open+rated → "Update Rating" opens editable form; save + toast + return to grid behave as before. | Manual E2E |
| AC6 | PDF exports unchanged: student detail modal + exported PDFs still render scores (script.js 666/755/1180/1350 untouched). | Manual PDF export |
| AC7 | Admin tables unchanged: `#studentRatingsTable`, rater list, and admin detail views keep score columns/badges. | Manual admin view |

## Verification (static-only + manual)
- `node --check assets/js/script.js` → exit 0 (no syntax errors).
- grep asserts:
  - `rate-badge-inline">RATED` **present** (new open+rated badge, script.js:459).
  - `score-badge.*displayScore` appears **exactly once** — only on the closed+rated branch (script.js:455); no `score-badge` remains in the open+rated branch (script.js:459).
  - `script.js?v=27` **present** in `index.html` (and `script.js?v=26` absent).
  - `closed-badge` + `View My Score` block unchanged (script.js:454–455, 467–468).
- Manual browser matrix (desktop + ≤768 via DevTools device toolbar):
  - Student A rated GROUP 2 (open) → `RATED` badge, no score, "Update Rating" opens editable form.
  - Student A rated GROUP 3 (locked) → score badge stays, "View My Score" opens read-only (radios disabled, save blocked).
  - Student B, GROUP 3 (locked, unrated) → CLOSED badge + disabled "Group Closed" button.
  - Own group → "YOUR GROUP" + disabled button, unchanged.
  - Fresh open+unrated group → "RATE HERE" + "Rate Now".
  - Submit a rating → toast, grid refresh, new state matches AC1/AC2 rules.
  - PDF export + admin tables → scores still visible (AC6/AC7).
  - Console clean; `?v=27` forces fresh script.js (verify via Network tab).

## Risks and Assumptions
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **WIP base `7b7049f`** — plan branch sits on `main @ 7b7049f9ef638a618b36c39133afaf0ad86d2d04`, which may advance before implementation | Medium | Rebase needed | Diff is 2 lines; PR Coordinator rebases `feat/score-badge-visibility` onto latest `main` before merge |
| **Stale packed-refs** — worktree refs may be stale after upstream branch updates | Low | Wrong base diff | `git fetch --prune` + verify `git rev-parse` matches `7b7049f` before implementing |
| **No test harness** — regressions only caught manually | Medium | Flow regression unnoticed | Strict grep asserts (exact patterns above) + follow the full manual browser matrix; change is 2 lines |
| **Scope bleed** — temptation to restyle badges, touch other branches, or "fix" adjacent code | Medium | Diff creep / review noise | Ownership rule (only script.js:459 + index.html:436); MUST-NOT list enforced in review |
| **RATED vs RATE HERE look identical** (same `.rate-badge-inline` style) | Low | Momentary confusion | Button labels differ ("Update Rating" vs "Rate Now"); no CSS change per handoff — defer styling to a future plan if needed |

---

**Branch:** `plan/score-badge-visibility` (base `main` @ `7b7049f9ef638a618b36c39133afaf0ad86d2d04`)
**Worktree:** `.worktrees/plan-score-badge-visibility`
**Plan PR:** to be opened by PR Coordinator after this artifact is committed.
