# Plan: On-Demand Group Rows + Approved Accounts UI Fix

## Goal
Reverse the auto-group-rows feature (signup-time 10-row batch creation) so that `groups_table` documents are created **only on demand** when an instructor adds at least one student member. Also fix the "Manage Approved Accounts" modal delete button to use an icon-only design consistent with the pending modal's updated styling.

## Background
**Prior work:**
- `auto-group-rows` (Plan: `docs/plans/auto-group-rows.md`) added a 10-row batch create in `signup()` (lines 197–218) and a lazy-create fallback in `getGroups()` (lines 397–404).
- `delete-account-groups-cascade` (Plan: `docs/plans/delete-account-groups-cascade.md`) added `getApprovedAccounts()`, the `approvedModal` UI, and cascade delete for approved accounts. It documented **R1/D6**: stale-session recreation of 10 rows after account deletion (when a deleted instructor's session calls `getGroups()`).

**This plan reverses the auto-group behavior** and fixes the residual R1/D6 by making `getGroups` read-only. The UI fix for the approved modal delete button is a follow-up request.

## Scope

### In Scope — Two Workstreams
| Workstream | Files Touched | Summary |
|------------|---------------|---------|
| **WS-1: On-demand group rows (data behavior)** | `assets/js/firestore-api.js`, `index.html` (cache-bust only) | Remove signup batch + rollback; remove `getGroups` lazy-create; make `saveGroupMembers` create/delete docs based on member presence; make `toggleGroupStatus` never create; bump `firestore-api.js?v=8 → v9`. |
| **WS-2: Approved Accounts UI fix** | `assets/js/script.js`, `assets/css/styles.css`, `index.html` (cache-bust) | Replace `.btn-delete` in `#approvedModal` with icon-only `.btn-delete-icon` (aria-label, title); add scoped CSS for `#approvedModal` modal polish, button styling, focus ring, responsive touch targets; fix `td:nth-child(3)` monospace inheritance; bump `styles.css?v=10 → v11`, `script.js?v=31 → v32`. |

### Out of Scope (Non-Goals)
- No `firestore.rules` changes (rules are permissive; client writes work).
- No Cloud Functions / server-side triggers.
- No migration of legacy empty rows (residual; accepted).
- No `README.md` changes (README MUST NOT be modified on plan branches — add/add conflict trap vs main).
- No new dependencies.
- WS-1: No `script.js` changes (UI already iterates `GROUP_NAMES` keys from `getGroups` response).
- WS-2: No `deleteApprovedAccount` logic changes; pending modal byte-identical (regression guard).

## Architecture / Data Flow

### Collections (unchanged)
| Collection | Constant | Role |
|------------|----------|------|
| `accounts` | `COLL_ACCOUNTS` | Source of truth for `instructor_name` (uppercased) and `status` |
| `groups_table` | `COLL_GROUPS` | Created **only** when `saveGroupMembers` sees ≥1 non-empty member; deleted when all members cleared |
| `group_ratings` | `COLL_RATINGS` | Unchanged; `renameRaterRatings` logic preserved |
| `section_config` | `COLL_SECTIONS` | Unchanged |

### Doc ID Conventions (unchanged)
- `groupDocId(instructor, section, groupName)` → `G_<instructor>_<section>_<group>` (double underscore when section empty)
- `sectionDocId(instructor, section)` → `S_<instructor>_<section>`
- `accountDocId(username)` → `A_<username>`

### Key Behavioral Changes (WS-1)

| Function | Old Behavior | New Behavior |
|----------|--------------|--------------|
| `signup()` | Creates account + 10 empty group docs (batch) + rollback on failure | Creates **only** the account doc (status: 'pending') |
| `getGroups()` | If 0 docs found → batch-create 10 empty rows | **READ-ONLY**; returns `GROUP_NAMES` map with empty defaults for missing docs (lines 414–430 unchanged) |
| `saveGroupMembers()` | Upserts doc unconditionally | Members normalized (trim + uppercase). **Create doc ONLY when ≥1 of 6 members non-empty** (carries passed `section`). Update existing in place (keep `renameRaterRatings` lines 466–471). **DELETE doc when save leaves ALL members empty** (if doc exists). All-empty save with no doc = success no-op. |
| `toggleGroupStatus()` | Creates doc with `is_closed:1` if missing | **NEVER create doc**. When missing → return `{status:'success', is_closed:0, message:'Group opened'}` without writing. When exists → flip `is_closed` as today. |
| `getGroupStatus()` | Unchanged | Unchanged (reads existing docs, defaults to 0 for 10 keys) |
| `studentLogin()` | Unchanged | Unchanged (fails "Name not found" when no groups — correct) |

### Residual Fix
Removing the `getGroups` lazy-create **fixes R1/D6** from `delete-account-groups-cascade.md`: stale-session recreation of 10 rows after account deletion no longer occurs.

### Legacy Handling (Accepted Residuals)
- Empty `section: ''` vs named-section legacy rows may coexist; `pickGroupDoc` (lines 158–165) handles canonical lookup.
- Orphaned `group_ratings` on clear-all members: documented, no cascade delete added (ratings remain keyed by rater_name; instructor can reset ratings separately).
- Stale local main ref `fd7352f` — **never use as base**; plan branch base is `563cd223524e7168ffb8d5288bacf6edea373a9d` (tree-identical to remote main `805e197e`).

## Workstreams

### WS-1: On-Demand Group Rows (Data Behavior)

#### File: `assets/js/firestore-api.js`

| Location | Change |
|----------|--------|
| `signup()` ~lines 185–220 | **Remove** the `existingGroups` guard + 10-row batch + rollback block (lines 197–218). `signup` creates **only** the accounts doc. Keep username check, hash, account add, success return. |
| `getGroups()` ~lines 392–432 | **Remove** the lazy-create block (lines 397–404). Function becomes read-only: query → compute rating sums → build `GROUP_NAMES` response map (lines 414–430) with empty defaults for missing docs. No Firestore writes. |
| `saveGroupMembers()` ~lines 450–483 | Normalize members: `[m1..m6].map(m => String(m || '').trim().toUpperCase())`.<br>• If `existing` doc (via `pickGroupDoc`): update in place; run `renameRaterRatings` for changed non-empty names (lines 466–471 preserved).<br>• Else (no existing doc): **create only if `members.some(m => m !== '')`**; write with passed `section`.<br>• **After update/create**: if **all 6 members empty** AND doc existed → `delete` the doc; return success.<br>• All-empty save with no doc → success no-op (0 writes). |
| `toggleGroupStatus()` ~lines 485–498 | **Never create doc**. If `existing` → flip `is_closed`, update, return new status. If missing → return `{status:'success', is_closed:0, message:'Group opened'}` (no write). |

#### File: `index.html`
- Line 465: `firestore-api.js?v=8` → `firestore-api.js?v=9` (cache-bust).

#### Verification (WS-1 Static)
- `node --check assets/js/firestore-api.js` → exit 0.
- `grep` asserts:
  - `signup` contains **no** `batch.commit` / `GROUP_NAMES.forEach` / `emptyGroupData` / `deleteWhere` rollback.
  - `getGroups` contains **no** `batch.commit` / `GROUP_NAMES.forEach` / `emptyGroupData` inside the function.
  - `saveGroupMembers` contains: `members.map(...trim().toUpperCase())`, conditional create (`members.some(...)`), `deleteWhere` or `doc.ref.delete()` for all-empty cleanup.
  - `toggleGroupStatus` contains **no** `batch.set` / `emptyGroupData` / `groupDocId(...).set`; contains early return for missing doc.
  - `index.html` line 465: `firestore-api.js?v=9` present, `v=8` absent.
  - `git diff --name-only` shows only `assets/js/firestore-api.js`, `index.html`.

### WS-2: Approved Accounts UI Fix

#### File: `assets/js/script.js` (lines 2019–2059 `loadApprovedAccounts`)
- Row builder (DOM-based, closure — XSS-safe) unchanged except the delete button:
  - **Old**: `btn.className = 'btn-delete'; btn.innerHTML = '<i class="fas fa-trash"></i> Delete';`
  - **New**: `btn.className = 'btn-delete-icon'; btn.setAttribute('aria-label', 'Delete ' + a.username); btn.setAttribute('title', 'Delete account'); btn.innerHTML = '<i class="fas fa-trash" aria-hidden="true"></i>';`
- `deleteApprovedAccount` flow (lines 2079–2107) **unchanged**.

#### File: `assets/css/styles.css`
**Add after line 1977 (end of developer modal styles, before toasts):**

```css
/* ========== APPROVED ACCOUNTS MODAL ========== */
#approvedModal .modal-content {
  background: white;
  border-radius: var(--radius-xl);
  width: 90%;
  max-width: 640px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 25px 60px rgba(0,0,0,0.25);
  animation: scaleIn 0.3s ease;
}
#approvedModal .modal-header {
  padding: 20px 24px;
  border-bottom: 2px solid var(--neutral-100);
  background: linear-gradient(135deg, var(--green-700), var(--green-600));
  color: white;
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
}
#approvedModal .modal-header h3 {
  font-family: var(--font-display);
  font-size: 20px;
  letter-spacing: 2px;
  color: white;
}
#approvedModal .modal-close {
  color: rgba(255,255,255,0.6);
}
#approvedModal .modal-close:hover { color: white; background: rgba(255,255,255,0.1); }
#approvedModal .modal-body {
  padding: 20px 24px;
  overflow-y: auto;
  flex: 1;
}
/* Fix monospace inheritance on Actions column (3rd child) */
#approvedModal .modal-table td:nth-child(3) {
  font-family: inherit;
  letter-spacing: normal;
}

/* Icon-only delete button */
#approvedModal .btn-delete-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--red-600);
  color: white;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition);
  padding: 0;
}
#approvedModal .btn-delete-icon:hover {
  background: var(--red-700);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(220,38,38,0.35);
}
#approvedModal .btn-delete-icon:active {
  background: var(--red-800);
  transform: translateY(0);
}
/* Focus ring — append to existing selector at ~line 2134 */
#approvedModal .btn-delete-icon:focus-visible {
  outline: 2px solid var(--red-500);
  outline-offset: 2px;
}

/* Responsive: ≤480px */
@media (max-width: 480px) {
  #approvedModal .modal-content { border-radius: var(--radius-lg); }
  #approvedModal .modal-header { border-radius: var(--radius-lg) var(--radius-lg) 0 0; padding: 14px 16px; }
  #approvedModal .modal-header h3 { font-size: 16px; }
  #approvedModal .modal-body { padding: 14px; }
  #approvedModal .btn-delete-icon {
    width: 40px;
    height: 40px;
    border-radius: var(--radius-lg);
  }
  #approvedModal .modal-table td { padding: 8px 4px; font-size: 11px; }
  #approvedModal .modal-table th { font-size: 9px; padding: 8px 4px; }
}
@media (max-width: 375px) {
  #approvedModal .modal-header h3 { font-size: 14px; }
}
@media (max-width: 320px) {
  #approvedModal .modal-content { width: 96vw; }
}
```

**Focus-visible selector update** (around line 2134): append `#approvedModal .btn-delete-icon:focus-visible` to the existing list:
```css
.btn:focus-visible,
.modal-close:focus-visible,
.toast-close:focus-visible,
.modal-table a:focus-visible,
.profile-edit-btn:focus-visible,
#approvedModal .btn-delete-icon:focus-visible { ... }
```

#### File: `index.html`
- Line 11: `styles.css?v=10` → `styles.css?v=11`
- Line 467: `script.js?v=31` → `script.js?v=32`

#### Verification (WS-2 Static)
- `node --check assets/js/script.js` → exit 0.
- `grep` asserts:
  - `script.js` `loadApprovedAccounts` contains `btn-delete-icon`, `aria-label`, `title`, `<i class="fas fa-trash" aria-hidden="true"></i>`, **no** `btn-delete` class, **no** "Delete" text.
  - `styles.css` contains `#approvedModal .modal-content` block with green gradient header, `max-width: 640px`, `max-height: 80vh`.
  - `styles.css` contains `#approvedModal .modal-table td:nth-child(3) { font-family: inherit; letter-spacing: normal; }`.
  - `styles.css` contains `#approvedModal .btn-delete-icon` with `width: 36px; height: 36px; background: var(--red-600)`, hover `red-700`, active `red-800`, focus-visible ring.
  - `styles.css` focus-visible selector includes `#approvedModal .btn-delete-icon:focus-visible`.
  - Responsive: `@media (max-width: 480px)` has `width: 40px; height: 40px; border-radius: var(--radius-lg);`.
  - `index.html` line 11: `styles.css?v=11`; line 467: `script.js?v=32`; old versions absent.
  - `git diff assets/js/script.js` shows **only** the button markup change in `loadApprovedAccounts` (WS-1 scope = empty diff for script.js).
  - Pending modal (`#pendingModal`) styles and `script.js` `loadPendingAccounts` **byte-identical** to before (regression guard).

## Acceptance Criteria

### WS-1: On-Demand Group Rows (Data Behavior)
| # | Criterion | Evidence Steps |
|---|-----------|----------------|
| AC-1 | Zero `groups_table` docs after signup + approval | Sign up new instructor → approve → Firestore console: `groups_table` where instructor == name → 0 docs |
| AC-2 | `getGroups` returns 10 keys with **no Firestore writes** | Call `Api.getGroups(instructor, section)` → returns object with 10 `GROUP 1..10` keys; Firestore write count = 0 |
| AC-3 | Saving 1 member creates exactly 1 doc with section | In Group Results, add 1 student to GROUP 1, section "A" → save → Firestore: 1 doc `G_<INSTRUCTOR>_A_GROUP 1` with `section: "A"` |
| AC-4 | Saving a second group creates exactly 2 docs | Add member to GROUP 2, same section → save → 2 docs total |
| AC-5 | Clearing all members deletes the doc | Open GROUP 1, clear all 6 fields → save → Firestore: GROUP 1 doc deleted; GROUP 2 doc remains |
| AC-6 | All-empty save with no doc = 0 docs + success | Open GROUP 3 (never saved), leave all empty → save → 0 docs created, returns success |
| AC-7 | Toggle existing flips `is_closed`, count unchanged | Toggle GROUP 1 → `is_closed:1`; toggle again → `is_closed:0`; doc count = 1 throughout |
| AC-8 | Toggle missing = success no-op + 0 docs | Toggle GROUP 5 (never created) → returns `{status:'success', is_closed:0, message:'Group opened'}`; 0 docs created |
| AC-9 | `getGroupStatus` returns 10 keys | Call `Api.getGroupStatus(instructor, section)` → object with 10 keys, values 0/1 |
| AC-10 | Cache-bust `v=9` present, `v=8` absent | `grep "firestore-api.js?v=9" index.html` → match; `grep "firestore-api.js?v=8" index.html` → no match |
| AC-11 | `script.js` diff empty (WS-1 scope) | `git diff assets/js/script.js` → no changes from WS-1 |
| AC-12 | Legacy rows untouched | Pre-existing empty-section rows remain; `pickGroupDoc` logic handles |
| AC-13 | Student login unchanged | Student login with no groups → "Name not found" (correct) |
| AC-14 | Ratings/rater/PDF 10-column rendering unchanged | All 10 GROUP columns render in tables/PDFs (response shape unchanged) |
| AC-15 | Stale-session delete no longer recreates rows | Delete approved instructor A while A logged in → A's next `getGroups` → 0 docs created (R1/D6 fixed) |

### WS-2: Approved Accounts UI Fix
| # | Criterion | Evidence Steps |
|---|-----------|----------------|
| AC-16 | Icon-only delete button present in `#approvedModal` | Open modal → Actions column shows trash icon only (no "Delete" text) |
| AC-17 | Button has `aria-label="Delete <username>"` + `title="Delete account"` | Inspect button → attributes present with dynamic username |
| AC-18 | `#approvedModal` scoped CSS present (green gradient header, radius-xl, max-width 640px, max-height 80vh) | DevTools: computed styles match spec |
| AC-19 | Pending modal byte-identical (no regression) | `git diff` shows **no** changes to `#pendingModal` styles or `loadPendingAccounts` |
| AC-20 | Focus-visible ring (2px `var(--red-500)` offset 2px) on `.btn-delete-icon` | Tab to button → red focus ring visible |
| AC-21 | 40px touch target at ≤480px (`border-radius: var(--radius-lg)`) | Resize viewport ≤480px → button 40×40px, rounded |
| AC-22 | Cache-busts: `styles.css?v=11`, `script.js?v=32`, `firestore-api.js?v=9` | `grep` index.html for all three; old versions absent |

## Verification Strategy

### Pre-Commit Static Checks (Builder Responsibility)
1. **Syntax**: `node --check assets/js/firestore-api.js` → exit 0; `node --check assets/js/script.js` → exit 0.
2. **Grep Asserts** (see AC tables above for exact patterns).
3. **Code Review**:
   - WS-1: Uppercased `instructorName` used consistently; `saveGroupMembers` conditional create/delete logic correct; `renameRaterRatings` preserved; `toggleGroupStatus` no-create path correct.
   - WS-2: CSS scoped strictly under `#approvedModal`; no leakage to `#pendingModal`; focus-visible selector appended correctly; responsive breakpoints at 480/375/320px.
4. **Diff Scope**: `git diff --name-only` shows only:
   - WS-1: `assets/js/firestore-api.js`, `index.html`
   - WS-2: `assets/js/script.js`, `assets/css/styles.css`, `index.html`

### Live Verification (PR Tester / Vercel Preview)
1. Deploy preview (Vercel auto-deploys PR).
2. **WS-1 Flow**:
   - Sign up new instructor → approve → verify 0 group docs.
   - Open Group Results → `getGroups` returns 10 empty keys (no writes).
   - Add 1 student to GROUP 1, section "SEC-A" → save → verify 1 doc with `section: "SEC-A"`.
   - Add student to GROUP 2 → save → verify 2 docs.
   - Clear GROUP 1 members → save → verify GROUP 1 doc deleted, GROUP 2 remains.
   - Clear GROUP 2 members → save → verify 0 docs.
   - Toggle GROUP 3 (missing) → success no-op, 0 docs.
   - Toggle GROUP 2 (exists) → flips `is_closed`, count = 1.
   - `getGroupStatus` → 10 keys.
   - Stale-session test: login as instructor B; delete B via admin (different tab) → B's session `getGroups` → 0 docs created.
3. **WS-2 Flow**:
   - Open Manage Approved Accounts modal → verify icon-only trash buttons, aria-labels.
   - Tab navigation → red focus ring on delete buttons.
   - Resize to ≤480px → 40×40px touch targets.
   - Open Pending Accounts modal → verify unchanged (Approve + Delete buttons, pastel style).
   - Delete approved account → confirm danger dialog → success toast → list refreshes.

### Integration Tester (Full Workflow)
- End-to-end: signup → approve → add members → rate → PDF export → delete account cascade.
- Cross-workstream: WS-1 data behavior + WS-2 UI both functional in same preview.

### Cache-Bust Checklist
| File | Old | New | Verified |
|------|-----|-----|----------|
| `index.html:11` | `styles.css?v=10` | `styles.css?v=11` | [ ] |
| `index.html:465` | `firestore-api.js?v=8` | `firestore-api.js?v=9` | [ ] |
| `index.html:467` | `script.js?v=31` | `script.js?v=32` | [ ] |
| Others | unchanged | unchanged | [ ] |

## Decisions (Binding)

### WS-1 (from Product Analyst D-1..D-9 + Solution Architect)
| ID | Decision |
|----|----------|
| D1 | `signup` creates ONLY the accounts doc; 10-row batch + rollback removed. |
| D2 | `getGroups` becomes READ-ONLY; lazy-create block removed; 10-key response shape preserved. |
| D3 | `saveGroupMembers`: members normalized (trim+uppercase); create doc ONLY when ≥1 non-empty member; carries passed `section`. |
| D4 | `saveGroupMembers`: update existing in place; `renameRaterRatings` (lines 466–471) runs only when doc still exists. |
| D5 | `saveGroupMembers`: DELETE doc when save leaves ALL members empty (if doc exists); all-empty + no doc = success no-op. |
| D6 | `toggleGroupStatus`: NEVER create doc; missing → return success no-op (`is_closed:0`); existing → flip. |
| D7 | `getGroupStatus`, `studentLogin` unchanged. |
| D8 | No `firestore.rules` changes; no migration of legacy empty rows (residual). |
| D9 | Section `''` vs named-section legacy residual accepted; `pickGroupDoc` handles. |
| D10 | Removing `getGroups` lazy-create FIXES R1/D6 from cascade plan (stale-session recreation). |

### WS-2 (from UI/UX Designer, verified against code)
| ID | Decision |
|----|----------|
| D1 | Icon-only trash button with new class `.btn-delete-icon` scoped under `#approvedModal`. |
| D2 | `aria-label="Delete <username>"` + `title="Delete account"`; innerHTML `<i class="fas fa-trash" aria-hidden="true"></i>`. |
| D3 | DOM-based row builder + closure (XSS-safe) and `deleteApprovedAccount` flow unchanged. |
| D4 | CSS additions scoped under `#approvedModal`; insert after line 1977 (end of developer modal). |
| D5 | `#approvedModal .modal-table td:nth-child(3) { font-family: inherit; letter-spacing: normal; }` fixes monospace Actions column. |
| D6 | `.btn-delete-icon`: 36×36px, `var(--red-600)`, hover `red-700` + translateY(-1px) + shadow, active `red-800`, focus-visible 2px `var(--red-500)` outline offset 2px. |
| D7 | Focus-visible selector appended to existing list (~line 2134). |
| D8 | Responsive: ≤480px → 40×40px, `radius-lg`, smaller paddings/font; ≤375px → h3 14px; ≤320px → width 96vw. |
| D9 | Cache-bust: `styles.css?v=11`, `script.js?v=32`. |
| D10 | Pending modal untouched; `deleteApprovedAccount` logic untouched; no README changes. |

## Risks & Residuals

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **R1** Legacy empty rows (from auto-group-rows) remain in `groups_table` | High | Visual clutter / stale data | Accepted residual (D8); admin can clear via UI (save all-empty → deletes doc). No migration script. |
| **R2** Orphaned `group_ratings` when clearing all members (doc deleted, ratings remain) | Medium | Ratings for non-existent groups | Documented; no cascade added (ratings keyed by `rater_name`, not group doc). Instructor can use "Reset All Ratings" if needed. |
| **R3** Section `''` vs named-section ambiguity for legacy docs | Low | `pickGroupDoc` may pick non-canonical | `pickGroupDoc` (lines 158–165) prefers canonical ID, then section match, then empty-section fallback — accepted. |
| **R4** Stale local main ref `fd7352f` used as base by mistake | Low | Plan built on wrong history | **Hard rule**: base is `563cd223524e7168ffb8d5288bacf6edea373a9d` (tree-identical to remote main `805e197e`). Never use `fd7352f`. |
| **R5** WS-2 CSS leaks to pending modal | Low | Visual regression | Scoped strictly under `#approvedModal`; pending modal uses `#pendingModal` selectors; static grep asserts. |
| **R6** `saveGroupMembers` all-empty delete race (concurrent saves) | Low | Doc recreated then deleted | `pickGroupDoc` + update/delete in same call; Firestore single-doc atomicity sufficient. |
| **R7** README add/add conflict on plan branch | High | Merge conflict vs main | **Hard rule**: README.md NOT modified on plan branch (D9/D10). |

## Execution Order
1. **Plan commit** → this artifact committed to `plan/on-demand-group-rows` worktree.
2. **PR Coordinator** opens **Draft Plan PR**: `plan/on-demand-group-rows` → `main`.
3. **WS-1 child PR**: `feat/on-demand-group-rows` → `plan/on-demand-group-rows` (firestore-api.js + index.html cache-bust).
4. **WS-2 child PR**: `fix/approved-accounts-ui` → `plan/on-demand-group-rows` (script.js + styles.css + index.html cache-busts).
5. **Reviews** → Pre-Commit Tester gate (static checks) → merge to plan branch (merge commits, keep head branches).
6. **Integration** → Vercel preview deployed from plan branch → Integration Tester full workflow.
7. **Release** → PR Coordinator merges plan branch → main (Vercel CI advisory, no required checks).

> **Branch naming convention**: `plan/<slug>` for plan branch; `feat/<slug>` or `fix/<slug>` for child workstream PRs targeting the plan branch.

## Cache-Bust Table
| Asset | Line in index.html | Old Version | New Version | Workstream |
|-------|-------------------|-------------|-------------|------------|
| `styles.css` | 11 | `v=10` | `v=11` | WS-2 |
| `firestore-api.js` | 465 | `v=8` | `v=9` | WS-1 |
| `script.js` | 467 | `v=31` | `v=32` | WS-2 |
| `firebase-init.js` | 464 | `v=2` | `v=2` | — (unchanged) |

---
**Branch:** `plan/on-demand-group-rows` (base `563cd223524e7168ffb8d5288bacf6edea373a9d`, tree-identical to remote main `805e197e`)  
**Worktree:** `.worktrees/plan-on-demand-group-rows`  
**Plan PR:** to be opened by PR Coordinator after this artifact is committed.

(End of file)