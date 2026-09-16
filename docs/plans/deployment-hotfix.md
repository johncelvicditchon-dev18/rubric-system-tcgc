# Deployment Hotfix Plan

**Plan ID:** deployment-hotfix  
**Branch:** main (hotfix bundle, no Plan PR)  
**Target:** Vercel deployment readiness + "button does not work" fixes  
**Date:** 2026-09-15  

---

## 1. Goal / Users / Scope / Non-Goals

### Goal
Make the app **deployment-ready** and resolve all "button does not work" complaints by fixing the prioritized Code Reviewer blocking findings (B1–B4, B6) and high-impact nit findings (N1, N2/N3, N6, N14), plus the critical Firestore security rule, without over-engineering.

### Users
- **Instructors** (admin): manage sections, groups, members, criteria, approve accounts, export PDFs
- **Students** (raters): select group, rate on live rubric criteria, submit ratings
- **Admins** (super-instructors): approve/delete instructor accounts

### Scope (In-Scope)
| ID | Area | Description |
|----|------|-------------|
| B1 | Firestore indexes | Missing composite indexes → empty tables (silent failures) |
| B2 | debouncedSaveMembers | Silent early returns → no toast on missing section / locked / disabled |
| B3 | PDF busy lock | `exportStudentPDF` / `exportRaterListPDF` bypass `pdfBusy` guard → Print vs Download race |
| B4 | toggleGroupStatus | Optimistic UI flip + no failure toast + double-click vulnerability |
| B6 | queryWhere | Swallows `PERMISSION_DENIED` / `FAILED_PRECONDITION` → silent empty results |
| N1 | Select error rendering | Inline validation errors not shown on `<select>` (login section dropdown) |
| N2/N3 | Modal focus | Focus not trapped/moved on open; not returned on close |
| N6 | Instructor derivation | `saveGroupRating` infers instructor from rater → race on new raters |
| N14 | Criteria IDs | `criteria_` prefix inconsistency between UI and Firestore |
| SEC | Firestore rules | `allow read, write: if true` → public read/write (critical) |
| TECH | Inline styles | 33 inline `style=` attributes → move to CSS |
| TECH | jsPDF defer race | `<script defer>` + `window.jspdf` check timing |
| TECH | Auth error spacing | Inline error messages lack consistent spacing |

### Non-Goals
- UI/UX overhaul (covered by separate plans)
- New features (on-demand groups, auto-group-rows, etc.)
- Performance optimization beyond hotfix scope
- Test infrastructure (no test suite exists)
- TypeScript migration (vanilla JS only)

---

## 2. Architecture Summary

**Stack:** Vanilla ES6+ (modules via `<script type=module>` not used; globals on `window`), Firebase JS SDK v10 (compat), jsPDF v4 (UMD), Font Awesome 6, Inter/Bebas Neue fonts.

**Firebase Collections:**
| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `accounts` | Instructor auth | `username`, `password` (SHA-256), `instructor_name`, `status` (pending/approved) |
| `section_config` | Section metadata | `instructor`, `section_name`, `max_score`, `members_locked` |
| `groups_table` | Group membership + status | `instructor`, `section`, `group_name`, `member1_name`…`member6_name`, `is_closed` |
| `group_ratings` | Student ratings | `rater_name`, `group_name`, `section`, `instructor`, `total_score`, `criteria_*` scores |
| `rubric_criteria` | Live rubric (single source of truth) | `id`, `name`, `desc1-4`, `position` |

**Key Invariants:**
- Groups 1–10 are fixed (cannot delete); only groups 11+ are deletable
- Criteria IDs are stable snake_case (`content_accuracy`, `criteria_understanding_topic`, etc.)
- `rubric_criteria` collection is the **single source of truth** for criteria (legacy keys preserved only for reading old rating docs)
- Section-scoped data: all group/rating queries filtered by `instructor` + `section`

---

## 3. Acceptance Criteria (Observable, Testable)

| AC ID | Criterion | Verification |
|-------|-----------|--------------|
| AC-B1 | Student Ratings / Rater List / Group Results tables render data when composite indexes exist; show actionable error toast when index missing | 1. Deploy rules + indexes; 2. Load each table → data visible; 3. Temporarily drop index → toast "Query requires index: [link]" |
| AC-B2 | Editing a member field in a locked section / no section selected / disabled input shows toast "Cannot save: section not selected" / "Member registration is locked" / "Input disabled" | 1. Lock section → type in member field → toast; 2. No section → type → toast; 3. Disable via JS → type → toast |
| AC-B3 | Clicking **Print** then immediately **Download PDF** (or vice versa) for Student Ratings / Rater List: second click shows "A PDF is already being generated. Please wait." and does not corrupt output | 1. Open Student List; 2. Click Print; 3. Immediately click Download PDF → toast appears, first PDF completes cleanly |
| AC-B4 | Toggle group Open/Closed: UI flips optimistically; if server fails, UI reverts + toast "Failed to update group status. Try again."; double-click during request is ignored | 1. Click toggle → immediate flip; 2. Simulate network failure (devtools offline) → revert + toast; 3. Double-click fast → only one request sent |
| AC-B6 | Any Firestore permission/precondition error surfaces as toast "Database error: [code]. Contact admin." instead of empty table | 1. Tighten rules to deny read; 2. Load table → toast appears with code |
| AC-N1 | Login section `<select>` shows red border + error message "Section is required" on submit without selection | 1. Student login, leave section blank → submit → inline error on select |
| AC-N2 | Opening any modal (Pending, Approved, Delete Group, Student Detail, Reset Ratings) moves focus to first focusable element (close button or first input) | 1. Tab to "View Pending Accounts" → Enter → focus on modal close button |
| AC-N3 | Closing modal returns focus to trigger element | 1. Open modal → close → focus back on triggering button |
| AC-N6 | `saveGroupRating` uses `currentInstructor` from session (not derived from rater lookup) | 1. New rater rates group → rating saved with correct instructor |
| AC-N14 | All criterion IDs in UI (`data-criteria`, `score_${id}`, radio `name`) match Firestore `rubric_criteria.id` exactly (no `criteria_` prefix mismatch) | 1. Inspect radio `name="rubric_content_accuracy"` matches doc `id: "content_accuracy"` |
| AC-SEC | Firestore rules enforce: authenticated users only; instructors read/write own data; students read own ratings + group membership | 1. Deploy rules; 2. Unauthenticated request → denied; 3. Cross-instructor access → denied |
| AC-TECH | Zero inline `style=` attributes in `index.html` (moved to `styles.css`) | 1. `grep -n 'style=' index.html` → 0 matches |
| AC-TECH | jsPDF loads reliably: `window.jspdf` available before any PDF button click | 1. Load page → wait 2s → click Download PDF → generates without "PDF library not loaded" error |

---

## 4. Workstreams

| WS ID | Agent | Workstream Title | Status | Branch | PR |
|-------|-------|------------------|--------|--------|----|
| WS-B1 | Backend | Firestore Composite Indexes + Error Surfacing | ☐ TODO | `fix/b1-query-error-surfacing` | #TBD |
| WS-B2 | Frontend | debouncedSaveMembers Toasts + Early-Return Guard | ☐ TODO | `fix/b2-debounce-toasts` | #TBD |
| WS-B3 | Frontend | PDF Busy Lock for Print/Download | ☐ TODO | `fix/b3-pdf-busy` | #TBD |
| WS-B4 | Frontend | Toggle Group Status Race + Failure Toast | ☐ TODO | `fix/b4-toggle-race` | #TBD |
| WS-B6 | Backend | queryWhere Error Surfacing (PERMISSION_DENIED/FAILED_PRECONDITION) | ☐ TODO | `fix/b6-query-error-surfacing` | #TBD |
| WS-N1 | Frontend | Select Inline Error Rendering | ☐ TODO | `fix/n1-select-errors` | #TBD |
| WS-N23 | Frontend | Modal Focus Management (open/close) | ☐ TODO | `fix/n2-n3-modal-focus` | #TBD |
| WS-N6 | Frontend | Instructor Derivation Fix in saveGroupRating | ☐ TODO | `fix/n6-instructor-derivation` | #TBD |
| WS-N14 | Frontend | Criteria ID Consistency (criteria_ prefix) | ☐ TODO | `fix/n14-criteria-ids` | #TBD |
| WS-SEC | Backend | Firestore Security Rules Hardening | ☐ TODO | `fix/sec-firestore-rules` | #TBD |
| WS-UI | Frontend | Inline Style Removal + Auth Error Spacing | ☐ TODO | `fix/ui-inline-styles` | #TBD |
| WS-JSPDF | Frontend | jsPDF Defer Race Fix | ☐ TODO | `fix/jspdf-defer-race` | #TBD |

**Total: 12 workstreams, 12 isolated branches, 12 PRs (or direct pushes to main with pre-commit gate).**

---

## 5. Dependencies

```
WS-SEC (rules) ──────► WS-B1 (indexes must match rules)
WS-B6 (queryWhere) ──► WS-B1 (error surfacing uses same helper)
WS-N14 (criteria) ───► WS-B1 (indexes on criteria fields if any)
WS-B3 (pdf busy) ────► WS-JSPDF (jsPDF must load before lock used)
WS-N6 (instructor) ──► WS-B2/B4 (shared session state)
WS-N23 (modal focus) ┤ independent
WS-UI (inline styles) ┤ independent
```

**Critical Path:** `WS-SEC → WS-B1 → WS-B6` (rules enable indexes, indexes enable queries, queryWhere surfaces errors)

**Parallelizable Groups:**
- Group A (backend): WS-SEC, WS-B1, WS-B6
- Group B (frontend PDF): WS-B3, WS-JSPDF
- Group C (frontend forms): WS-B2, WS-B4, WS-N1, WS-N6, WS-N14
- Group D (frontend a11y): WS-N23, WS-UI

---

## 6. File Ownership (Isolated Worktrees, Non-Overlapping Paths)

| Workstream | Files Modified | Ownership Notes |
|------------|----------------|-----------------|
| WS-B1 | `firestore.indexes.json` (new), `assets/js/firestore-api.js` (error helper) | New index file; helper in shared API |
| WS-B2 | `assets/js/script.js` (debouncedSaveMembers + toasts) | Lines 2054–2080 only |
| WS-B3 | `assets/js/script.js` (exportStudentPDF, exportRaterListPDF → withPdfLock) | Lines 950–987, 1065–1102 |
| WS-B4 | `assets/js/script.js` (handleToggleGroupStatus) | Lines 2082–2134 |
| WS-B6 | `assets/js/firestore-api.js` (queryWhere, firstDoc, deleteWhere) | Lines 82–114 |
| WS-N1 | `assets/js/script.js` (handleLogin student path), `assets/css/styles.css` (select error styles) | Login validation + CSS |
| WS-N23 | `assets/js/script.js` (openModalOverlay, closeModalOverlay + all callers) | Modal helpers + 6 call sites |
| WS-N6 | `assets/js/firestore-api.js` (saveGroupRating), `assets/js/script.js` (handleSaveStudentRating) | API + caller |
| WS-N14 | `assets/js/script.js` (renderStudentRubric, updateStudentScore, handleSaveStudentRating), `assets/js/firestore-api.js` (saveGroupRating) | 4 files, criterion ID plumbing |
| WS-SEC | `firestore.rules` (full rewrite) | Single file, high risk |
| WS-UI | `index.html` (remove 33 inline styles), `assets/css/styles.css` (add classes) | HTML + CSS only |
| WS-JSPDF | `index.html` (jsPDF load strategy), `assets/js/script.js` (downloadStudentPDF, downloadRaterListPDF guard) | HTML script tag + 2 functions |

**No overlapping paths.** Each workstream touches a distinct logical area.

---

## 7. Verification Checks

### Per-Workstream Gates (run in worktree before PR)

| Workstream | Formatter/Lint | Focused Tests | Build/Deploy Check |
|------------|----------------|---------------|---------------------|
| WS-B1 | `npx prettier --check firestore.indexes.json` | Manual: deploy indexes → load tables | `firebase deploy --only firestore:indexes` |
| WS-B2 | `npx prettier --check assets/js/script.js` | Manual: lock section → edit member → toast | Vercel preview deploy |
| WS-B3 | `npx prettier --check assets/js/script.js` | Manual: Print → immediate Download → toast | Vercel preview deploy |
| WS-B4 | `npx prettier --check assets/js/script.js` | Manual: toggle → offline → revert + toast | Vercel preview deploy |
| WS-B6 | `npx prettier --check assets/js/firestore-api.js` | Manual: tighten rules → load table → toast | Vercel preview deploy |
| WS-N1 | `npx prettier --check assets/js/script.js assets/css/styles.css` | Manual: student login no section → error | Vercel preview deploy |
| WS-N23 | `npx prettier --check assets/js/script.js` | Manual: Tab→Enter each modal → focus check | Vercel preview deploy |
| WS-N6 | `npx prettier --check assets/js/firestore-api.js assets/js/script.js` | Manual: new rater → rating saved | Vercel preview deploy |
| WS-N14 | `npx prettier --check assets/js/script.js assets/js/firestore-api.js` | Manual: inspect radio names vs Firestore IDs | Vercel preview deploy |
| WS-SEC | `npx prettier --check firestore.rules` | **Automated**: `firebase firestore:rules:test` (if test suite) + manual unauth/cross-tenant | `firebase deploy --only firestore:rules` |
| WS-UI | `npx prettier --check index.html assets/css/styles.css` | `grep -n 'style=' index.html` → 0 | Vercel preview deploy |
| WS-JSPDF | `npx prettier --check index.html assets/js/script.js` | Manual: cold load → wait 2s → Download PDF | Vercel preview deploy |

### Global Gates (run on integration branch / main)
1. **Secret scan:** `git secrets --scan` / `trufflehog filesystem .` (no Firebase config secrets in repo — `firebase-init.js` has public config only)
2. **Pre-commit:** `npx prettier --check .` + `npm run lint` (if eslint configured)
3. **Build:** Vercel preview deploy succeeds (static hosting, no build step)
4. **Smoke test:** Manual run through all 7 acceptance criteria (AC-B1…AC-N14, AC-SEC, AC-TECH)

---

## 8. Risk Controls

| Control | Implementation |
|---------|----------------|
| No `git add .` | Each workstream uses `git add -p` or explicit file paths; PR diff inspected |
| Pre-commit gate | Husky + `prettier --check` + `eslint` (if configured) on `git commit` |
| Secret scan | `trufflehog` in CI; `git-secrets` pre-commit; Firebase config is public (API key safe) |
| Firestore rules deploy | **Never** deploy rules without indexes first (WS-SEC → WS-B1 order); use `firebase firestore:rules:release` with `--dry-run` equivalent (staging project) |
| Index deploy | `firebase deploy --only firestore:indexes` before rules that require them |
| Rollback plan | Each workstream is a single commit on its branch; `git revert <commit>` restores main |
| Worktree isolation | `.worktrees/<branch>/` per workstream; no shared file writes |
| No concurrent main pushes | All workstreams via PR (or sequenced direct push with gate) |

---

## 9. Plan PR Body Content (for tracking)

```markdown
# Deployment Hotfix Bundle — Plan PR

**Goal:** Deployment-ready app + fix all "button does not work" complaints.

## Workstreams (12)
| WS | Title | Branch | PR | Status |
|----|-------|--------|----|--------|
| WS-SEC | Firestore Security Rules Hardening | `fix/sec-firestore-rules` | | ☐ |
| WS-B1 | Firestore Composite Indexes + Error Surfacing | `fix/b1-query-error-surfacing` | | ☐ |
| WS-B6 | queryWhere Error Surfacing | `fix/b6-query-error-surfacing` | | ☐ |
| WS-B2 | debouncedSaveMembers Toasts | `fix/b2-debounce-toasts` | | ☐ |
| WS-B4 | Toggle Group Status Race + Failure Toast | `fix/b4-toggle-race` | | ☐ |
| WS-B3 | PDF Busy Lock for Print/Download | `fix/b3-pdf-busy` | | ☐ |
| WS-JSPDF | jsPDF Defer Race Fix | `fix/jspdf-defer-race` | | ☐ |
| WS-N1 | Select Inline Error Rendering | `fix/n1-select-errors` | | ☐ |
| WS-N23 | Modal Focus Management | `fix/n2-n3-modal-focus` | | ☐ |
| WS-N6 | Instructor Derivation Fix | `fix/n6-instructor-derivation` | | ☐ |
| WS-N14 | Criteria ID Consistency | `fix/n14-criteria-ids` | | ☐ |
| WS-UI | Inline Style Removal + Auth Error Spacing | `fix/ui-inline-styles` | | ☐ |

## Execution Order
1. **WS-SEC** → **WS-B1** → **WS-B6** (backend critical path)
2. **WS-JSPDF** → **WS-B3** (PDF load → lock)
3. **WS-B2**, **WS-B4**, **WS-N1**, **WS-N6**, **WS-N14** (parallel frontend forms)
4. **WS-N23**, **WS-UI** (parallel a11y/polish)

## Acceptance Criteria
See `docs/plans/deployment-hotfix.md` §3 (15 observable, testable ACs).

## Risk Controls
- No `git add .`; explicit file staging
- Pre-commit: Prettier + ESLint + TruffleHog
- Firestore rules deployed **after** indexes
- Worktree isolation per workstream
- Single-commit per workstream for instant rollback

## Verification
Per-workstream manual checks (documented in plan) + global smoke test on integration.

---

**Handoff:** This plan is ready for Orchestrator to dispatch workstreams. Each workstream agent receives its branch, file ownership, and acceptance criteria.
```

---

## 10. Handoff

**Role:** Planning Agent (fallback)  
**Artifact:** `docs/plans/deployment-hotfix.md`  
**Next:** Orchestrator dispatches 12 workstreams per dependency order.  
**Fallback Attempt:** #1 (no prior plan PR exists; this is the initial hotfix bundle plan).