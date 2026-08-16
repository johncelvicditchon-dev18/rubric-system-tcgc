# Plan: Instructor Account Guards

## Goal
Implement two defensive guards for instructor accounts:
- **R1 — Section gate**: A newly approved instructor account must NOT be able to add students (members) into group rows if that account has NO section created yet. The UI disables the 6 member inputs per group card and shows a banner; the handler and data layer both enforce the rule.
- **R2 — Self-delete guard**: In the "Manage Approved Accounts" modal, the currently logged-in account's OWN row must not be deletable. The delete button is rendered disabled with a tooltip; the handler and data layer both reject the operation.

Both are defense-in-depth client-side guards (Firestore rules remain fully open). No new data contracts, collections, migrations, rules changes, or backend work.

## Users
- **Instructors (approved)** — every approved instructor can open the ACCOUNTS tab and the "Manage Approved Accounts" modal; they manage their own sections, groups, and members.
- **Admins** — same capabilities; the self-delete guard protects the admin from accidentally deleting their own account via the approved accounts modal.

## Scope

### In Scope (Exact Changes per Architecture)

**R1 — Section Gate (three-layer enforcement)**
| Layer | File / Location | Change |
|-------|-----------------|--------|
| UI | `assets/js/script.js` `renderAdminGroupResults` (lines ~1830–1869; member inputs 1858–1863) | When `currentSection === ''` (zero sections): render the 6 member inputs with `disabled` attribute; inject a visible banner `<div class="no-sections-banner">Create a section first to add members.</div>` styled like `#noSections` empty state. Group toggle button remains enabled. |
| Handler | `assets/js/script.js` `debouncedSaveMembers` (lines ~1879–1899) | Early-return with `showToast('Create a section first.', 'warning')` when `!currentSection` — BEFORE the `Api.saveGroupMembers` call. |
| Data | `assets/js/firestore-api.js` `saveGroupMembers` (lines ~420–458) | After existing `!instructor || !group_name` guard, add: `if (!section) return { status:'error', message:'Create a section first to add members' };`. Closes the empty-section write hole (legacy `emptyGroupData` line 147 uses `section: section || ''`). Legacy `''`-section docs remain READ-only via `pickGroupDoc` (lines 158–165) — do NOT gate on `pickGroupDoc`. |

**R2 — Self-Delete Guard (three-layer enforcement)**
| Layer | File / Location | Change |
|-------|-----------------|--------|
| UI | `assets/js/script.js` `loadApprovedAccounts` row build (lines ~2019–2061; delete button 2040–2047) | When `a.username === sessionStorage.getItem('accountUsername')`, render the delete button with `disabled` attribute + `title`/`aria-label` "Cannot delete your own account". Rely on generic `.btn[disabled]` rule (styles.css:1618–1624) — no scoped CSS needed. |
| Handler | `assets/js/script.js` `deleteApprovedAccount` (lines ~2081–2109) | Early-return with `showToast('You cannot delete your own account.', 'warning')` when `username === sessionStorage.getItem('accountUsername')` — BEFORE `showConfirmDialog` (line 2082). **REMOVE the now-dead force-logout block** (lines 2090–2102) — keep the else-branch behavior (reload approved list / modal state). |
| Data | `assets/js/firestore-api.js` `deleteAccount` (lines ~236–245) | Change signature to `deleteAccount(id, currentUsername)`. After the doc read (line 237), add: `if (currentUsername && doc.data().username === currentUsername) return { status:'error', message:'Cannot delete your own account' };`. Update both callers: `deletePendingAccount` (script.js ~1995) passes nothing (`undefined`); `deleteApprovedAccount` (script.js:2085) passes `sessionStorage.getItem('accountUsername')`. |

**Cross-Cutting**
| Item | Change |
|------|--------|
| Identity | `sessionStorage.getItem('accountUsername')` vs account doc `username` field (stable, unique, synced on rename at script.js:2259). Doc id is NOT stored client-side. |
| Roles | Only 'instructor'/'student' — every approved instructor can open the ACCOUNTS tab and the approved modal. |
| Cache-bust bumps (verified current values in worktree index.html) | Line 11: `styles.css?v=11` → `?v=12` (banner CSS)<br>Line 465: `firestore-api.js?v=9` → `?v=10`<br>Line 467: `script.js?v=32` → `?v=33` |
| Firestore rules | Fully open — client-side enforcement only; guards are defense-in-depth. |
| Data contracts | None new; collections unchanged. |

### Out of Scope (Non-Goals)
- No changes to section creation flow, student flows, PDF export, rubric criteria, or `firestore.rules`.
- No migration of legacy `''`-section group docs (they remain readable via `pickGroupDoc`).
- No new test harness (verification is static checks + manual browser matrix).
- No README or documentation changes on this plan branch.

## Workstreams
Single integrated frontend workstream — no separate API/UI contracts needed (all changes are in the existing client codebase; no data contract or storage layer is touched beyond the two API function signatures).

| Workstream | Branch | Agent | Scope |
|------------|--------|-------|-------|
| **Frontend** | `feat/instructor-account-guards` | Frontend Builder | `assets/js/script.js` (R1 UI+handler, R2 UI+handler), `assets/js/firestore-api.js` (R1 data, R2 data), `index.html` (3 cache-bust bumps) |

> **Ownership rule:** Frontend Builder owns **only** the files above. MUST NOT touch: section creation flow (`addNewSection`, `getSections`), student login/rating flows, PDF export, criteria management, `firestore.rules`, `firebase-init.js`, or any HTML structure beyond the version bumps.

## Acceptance Criteria

| # | Criterion | Verified At |
|---|-----------|-------------|
| **AC-1** | Zero-section account: group cards render 6 member inputs with `disabled` attribute; `.no-sections-banner` div present with text "Create a section first to add members." | Manual: approve fresh account → open Group Results (no section selected) |
| **AC-2** | Create section → select it → member inputs become enabled; banner disappears | Manual: create section via SECTIONS tab → select in dropdown → Group Results refresh |
| **AC-3** | `debouncedSaveMembers` early-returns with warning toast "Create a section first." when `!currentSection`; no `Api.saveGroupMembers` call | Manual: type in disabled input (should not trigger) or DevTools console call with `currentSection=''` |
| **AC-4** | `saveGroupMembers` returns `{status:'error', message:'Create a section first to add members'}` when `section` is empty/falsy; no Firestore doc write | Static grep + Manual: Network tab shows no write |
| **AC-5** | Sections-exist account (has ≥1 section, one selected): member inputs enabled, no banner, save works normally | Manual: existing instructor with sections |
| **AC-6** | Legacy `''`-section group docs still readable (appear in group cards, toggle works) — `pickGroupDoc` unchanged | Manual: pre-existing data |
| **AC-7** | Own row in approved accounts modal: delete button has `disabled` attribute, `title="Cannot delete your own account"`, `aria-label="Cannot delete your own account"` | Manual: open Manage Approved Accounts modal as that user |
| **AC-8** | Click own row's disabled delete button → no confirm dialog, warning toast "You cannot delete your own account.", no API call | Manual click |
| **AC-9** | `deleteApprovedAccount` direct call (bypassing UI) with own username → early-return with toast, no `Api.deleteAccount` call | DevTools console test |
| **AC-10** | `Api.deleteAccount(ownId, ownUsername)` returns `{status:'error', message:'Cannot delete your own account'}`; no Firestore writes | Static grep + Manual: Network tab |
| **AC-11** | Other accounts (not own): fully deletable with cascade (groups/ratings/sections) — confirm dialog → success toast → list refreshes | Manual: delete another instructor's approved account |
| **AC-12** | Pending accounts delete unaffected: `deletePendingAccount` passes `undefined` for `currentUsername`; no self-check; cascade works | Manual: delete a pending account |

## Verification (Static-Only + Manual)

### Static Checks (Builder Responsibility)
1. **Syntax**: `node --check assets/js/script.js` → exit 0; `node --check assets/js/firestore-api.js` → exit 0.
2. **Grep Asserts**:
   - `no-sections-banner` present in `renderAdminGroupResults` (script.js).
   - `disabled` attribute rendered on member inputs when `currentSection === ''` (script.js).
   - `debouncedSaveMembers` has early-return `if (!currentSection) { showToast('Create a section first.', 'warning'); return; }` BEFORE `Api.saveGroupMembers`.
   - `saveGroupMembers` has `if (!section) return { status:'error', message:'Create a section first to add members' };` after line 421.
   - `loadApprovedAccounts` renders delete button with `disabled`, `title="Cannot delete your own account"`, `aria-label="Cannot delete your own account"` when `a.username === sessionStorage.getItem('accountUsername')`.
   - `deleteApprovedAccount` has early-return `if (username === sessionStorage.getItem('accountUsername')) { showToast('You cannot delete your own account.', 'warning'); return; }` BEFORE `showConfirmDialog`.
   - Force-logout block (lines ~2090–2102 in current worktree) **removed** from `deleteApprovedAccount`.
   - `deleteAccount` signature changed to `deleteAccount(id, currentUsername)` with guard `if (currentUsername && doc.data().username === currentUsername) return { status:'error', message:'Cannot delete your own account' };`.
   - `deletePendingAccount` caller passes no second argument (or `undefined`).
   - `deleteApprovedAccount` caller passes `sessionStorage.getItem('accountUsername')`.
   - Old cache-busts absent: `styles.css?v=11`, `firestore-api.js?v=9`, `script.js?v=32` NOT in index.html.
   - New cache-busts present: `styles.css?v=12`, `firestore-api.js?v=10`, `script.js?v=33` IN index.html.
3. **Diff Scope**: `git diff --name-only` shows only `assets/js/script.js`, `assets/js/firestore-api.js`, `index.html`.

### Manual Browser Matrix
1. **Fresh approved account (no sections)**:
   - Open Group Results → 6 member inputs disabled per card + banner visible.
   - Create section in SECTIONS tab → select it → Group Results refreshes → inputs enabled, banner gone.
   - Add member → save → toast success → doc created with section.
2. **Existing account with sections**:
   - Group Results → inputs enabled, no banner → save works.
3. **Self-delete guard**:
   - Open Manage Approved Accounts modal → own row delete button disabled, tooltip shows "Cannot delete your own account".
   - Click own delete button → no confirm dialog, warning toast.
   - Delete another account → confirm dialog → success → cascade delete works.
4. **Pending accounts**:
   - Delete pending account → works (no self-check).
5. **Console clean** at all steps; cache-bust verified via Network tab (`?v=12`, `?v=10`, `?v=33`).

## Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Gate condition: `currentSection === ''` (synchronous proxy) + `Api.getSections(currentInstructor)` → `sections.length === 0` (authoritative) | `currentSection` is already the selected section; empty string = no section selected. The banner/inputs use the synchronous check for zero-latency UI; the handler/data layer enforce the same. |
| D2 | Data-layer guard: `if (!section) return error` in `saveGroupMembers` | Closes the write hole where `emptyGroupData` line 147 writes `section: section || ''`. Legacy `''`-section docs remain readable via `pickGroupDoc` (no gate there). |
| D3 | `deleteAccount` signature change: `deleteAccount(id, currentUsername)` | Minimal change; `currentUsername` is `undefined` for pending delete (no self-check), set for approved delete. |
| D4 | Generic `.btn[disabled]` CSS (styles.css:1618–1624) for own-row delete button | No scoped CSS needed; existing rule provides `cursor: not-allowed`, opacity, etc. |
| D5 | Force-logout block removed from `deleteApprovedAccount` | Now unreachable (data layer rejects own-delete); else-branch (reload list) is correct behavior. |
| D6 | Cache-bust bumps: `styles.css?v=12`, `firestore-api.js?v=10`, `script.js?v=33` | Ensures clients fetch new banner CSS, updated API signatures, and updated handler logic immediately. |
| D7 | Error messages: "Create a section first to add members" (R1), "You cannot delete your own account." (R2 — UI), "Cannot delete your own account" (R2 — data) | Consistent, user-facing wording. |
| D8 | Banner component: new `.no-sections-banner` div, styled like `#noSections` empty state | Reuses existing visual language; no new CSS classes beyond the banner itself. |

## Risks and Assumptions

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **Race condition**: concurrent section creation + member save | Low | Member save might slip through before section selected | Dual enforcement (handler + data layer) catches it; `saveGroupMembers` is the ultimate gate. |
| **DevTools bypass**: user removes `disabled` in browser | Medium | Could trigger handler | Handler early-return + data-layer guard both check `currentSection`/`section` server-side. |
| **Legacy `''`-section group docs** | High (existing data) | Confusion about which section a group belongs to | `pickGroupDoc` prefers canonical ID, then section match, then `''`-section fallback — accepted residual. |
| **Username rename sync** | Low | `sessionStorage` username stale after rename | `saveEditUsername` updates `sessionStorage` immediately (script.js:2259); guard uses current value. |
| **Stale local main ref** | Low | Plan built on wrong base | Worktree HEAD = `0c9d8fe` (origin/main); never use other refs. |
| **No test harness** | Medium | Regressions only caught manually | Strict grep asserts (exact patterns above) + full manual browser matrix; changes are localized. |

## Execution Order
1. **Plan commit** → this artifact committed to `plan/instructor-account-guards` worktree.
2. **PR Coordinator** opens **Draft Plan PR**: `plan/instructor-account-guards` → `main`.
3. **Child PR**: `feat/instructor-account-guards` → `plan/instructor-account-guards` (all 3 files).
4. **Reviews** → Pre-Commit Tester gate (static checks) → merge to plan branch (merge commit, keep head branch).
5. **Integration** → Vercel preview deployed from plan branch → Integration Tester full workflow.
6. **Release** → PR Coordinator merges plan branch → `main` (Vercel CI advisory, no required checks).

> **Branch naming convention**: `plan/<slug>` for plan branch; `feat/<slug>` for child workstream PRs targeting the plan branch.

## Cache-Bust Table

| Asset | Line in index.html | Old Version | New Version | Workstream |
|-------|-------------------|-------------|-------------|------------|
| `styles.css` | 11 | `v=11` | `v=12` | Frontend |
| `firestore-api.js` | 465 | `v=9` | `v=10` | Frontend |
| `script.js` | 467 | `v=32` | `v=33` | Frontend |
| `firebase-init.js` | 464 | `v=2` | `v=2` | — (unchanged) |

---

**Branch:** `plan/instructor-account-guards` (base `main` @ `0c9d8fe5d44b5620b3ad400c0e89f8cafe614458`)  
**Worktree:** `.worktrees/plan-instructor-account-guards`  
**Plan PR:** to be opened by PR Coordinator after this artifact is committed.

(End of file)