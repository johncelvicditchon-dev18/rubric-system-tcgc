# Plan: Delete Approved Accounts with Cascade Groups/Ratings/Sections Deletion

## Goal
Enable admin to delete **approved** instructor accounts (not just pending) with full cascade deletion of all related data: `groups_table`, `group_ratings`, and `section_config` documents matching the instructor's name. Add an "APPROVED ACCOUNTS" management UI mirroring the existing "PENDING ACCOUNTS" flow.

## Users
- **Admin/Instructor** (logged-in instructor with access to Account section)
- **System** (Firestore data integrity via cascade delete)

## Scope
**In scope:**
- `assets/js/firestore-api.js`:
  - `deleteAccount(id)`: remove pending-only guard; add `section_config` cascade; keep success message
  - NEW `getApprovedAccounts()`: mirror `getPendingAccounts()` for `status == 'approved'`
- `index.html`:
  - NEW "APPROVED ACCOUNTS" card in `accountSection` (after PENDING ACCOUNTS card)
  - NEW `approvedModal` markup mirroring `pendingModal` (table: Instructor Name | Username | Actions with delete buttons, empty state)
  - Cache-bust: `firestore-api.js?v=7` → `v8`, `script.js?v=30` → `v31`
- `assets/js/script.js`:
  - NEW `openApprovedModal` / `closeApprovedModal` / `loadApprovedAccounts` / `deleteApprovedAccount` mirroring pending patterns
  - `deleteApprovedAccount`: danger confirmation → `Api.deleteAccount(id)` → success toast → reload list + badge
  - **SELF-DELETE**: if deleted `id` == current session `accountUsername`, clear `sessionStorage` auth keys, toast info, navigate to `#login`
  - Wire events (badge click, modal buttons)

**Out of scope (non-goals):**
- No `firestore.rules` change (rules are open; client writes work)
- No Cloud Functions / server-side triggers
- No soft-delete / audit log / recovery
- No authorization beyond existing admin UI (any logged-in instructor can delete any approved account; confirmed by danger dialog)
- `pendingCount` badge and pending-account delete behavior unchanged (regression guard)
- README.md MUST NOT be modified on plan branch (known add/add conflict trap vs main; README updates are post-release residual)
- No UI/UX designer pass (UI mirrors existing pending modal; contract defined here)
- No API/data-contract pass (contracts defined in this plan)

## Architecture / Data Flow

### Collections
| Collection | Constant | Role in Cascade |
|------------|----------|-----------------|
| `accounts` | `COLL_ACCOUNTS` | Source of truth for `instructor_name` (uppercased) and `status` |
| `groups_table` | `COLL_GROUPS` | Deleted where `instructor == instructor_name` (all sections) |
| `group_ratings` | `COLL_RATINGS` | Deleted where `instructor == instructor_name` (all sections) |
| `section_config` | `COLL_SECTIONS` | **NEW** Deleted where `instructor == instructor_name` |

### Doc ID Conventions (unchanged)
- `groupDocId(instructor, section, groupName)` → `G_<instructor>_<section>_<group>` (double underscore when section empty)
- `sectionDocId(instructor, section)` → `S_<instructor>_<section>`
- `accountDocId(username)` → `A_<username>`

### Cascade Order (binding per architect)
1. `deleteWhere(COLL_GROUPS, [['instructor','==',instructorName]])`
2. `deleteWhere(COLL_RATINGS, [['instructor','==',instructorName]])`
3. **NEW** `deleteWhere(COLL_SECTIONS, [['instructor','==',instructorName]])`
4. `doc.ref.delete()` (account doc)

All deletes use existing `deleteWhere` helper (batched in chunks of 450). No transaction (cross-collection); best-effort atomicity accepted.

### Uppercased Contract
- Account stores `instructor_name: UPPERCASE(name)` at signup (line 189)
- All cascade queries **must** use the exact same uppercased `instructorName` from the account doc
- Case-sensitivity is exact-match in Firestore; mismatch = orphan rows (Risk R2)

### Session Edge (Documented, Accepted Residual)
- Admin deletes instructor **B** while **B** is logged in → **B**'s next `getGroups` lazily recreates 10 group rows (section `''`) via existing logic (line 390-396)
- **Mitigated for self-delete**: `deleteApprovedAccount` detects `id == session accountUsername` → clears session → redirects to login (no lazy recreation possible)

## API Contracts (Exact Signatures)

### Existing — Modified
```javascript
// firestore-api.js ~line 252
async deleteAccount(id) {
    // Input: id (string) — account document ID
    // Guard: if (!doc.exists) return { status:'error', message:'Account not found' }
    // Cascade: groups_table → group_ratings → section_config → account
    // Returns: { status:'success', message:'Account and all related data deleted successfully!' }
    //          or { status:'error', message:'Account not found' } (no throw)
}
```

### New
```javascript
// firestore-api.js (after getPendingAccounts ~line 243)
async getApprovedAccounts() {
    // Returns: { status:'success', accounts: [
    //     { id, instructor_name, username }, ...  // sorted by id asc
    // ]}
    // Query: where status == 'approved', order by id (client-side sort)
}
```

## UI Contract

### index.html — New Card (after line 193, before DANGER ZONE card)
```html
<div class="card account-card">
    <div class="card-header account-card-header">
        <h3><i class="fas fa-user-check"></i> APPROVED ACCOUNTS</h3>
        <span class="approved-count-badge u-hidden" id="approvedCount">0</span>
    </div>
    <div class="card-body account-card-body">
        <p class="account-card-desc">Manage approved instructor accounts.</p>
        <button class="btn btn-primary" onclick="openApprovedModal()"><i class="fas fa-user-check"></i> View Approved Accounts</button>
    </div>
</div>
```
- Badge class `approved-count-badge` mirrors `pending-count-badge`
- Button style `btn-primary` (distinct from pending's `btn-success`)

### index.html — New Modal (after `pendingModal` ~line 224)
```html
<div id="approvedModal" class="modal-overlay u-hidden" onclick="closeApprovedModal(event)" role="dialog" aria-modal="true" aria-labelledby="approvedModalTitle">
    <div class="modal-content" onclick="event.stopPropagation()">
        <div class="modal-header">
            <h3 id="approvedModalTitle"><i class="fas fa-user-check"></i> APPROVED ACCOUNTS</h3>
            <button class="modal-close" onclick="closeApprovedModal()" aria-label="Close dialog"><i class="fas fa-times"></i></button>
        </div>
        <div class="modal-body">
            <p class="no-data" id="noApprovedAccounts"><i class="fas fa-inbox"></i> No approved accounts.</p>
            <div class="table-wrap">
                <table id="approvedAccountsTable" class="modal-table u-hidden">
                    <thead><tr><th>Instructor Name</th><th>Username</th><th>Actions</th></tr></thead>
                    <tbody id="approvedAccountsBody"></tbody>
                </table>
            </div>
        </div>
    </div>
</div>
```
- Table columns: Instructor Name | Username | Actions
- Actions column: single `<button class="btn-delete" onclick="deleteApprovedAccount('${id}')"><i class="fas fa-trash"></i> Delete</button>` (no Approve button)
- Empty state mirrors pending: `#noApprovedAccounts` shown when 0 rows

### script.js — New Functions (after `deletePendingAccount` ~line 2005)
```javascript
function openApprovedModal() {
    openModalOverlay(document.getElementById('approvedModal'));
    loadApprovedAccounts();
}
function closeApprovedModal(e) {
    if (e && e.target !== e.currentTarget) return;
    closeModalOverlay(document.getElementById('approvedModal'));
}
async function loadApprovedAccounts() {
    // Mirror loadPendingAccounts: Api.getApprovedAccounts() → render #approvedAccountsBody
    // Show/hide #approvedAccountsTable vs #noApprovedAccounts
    // Update badge #approvedCount (show if >0, hide if 0)
}
async function deleteApprovedAccount(id) {
    // 1. Danger confirm: showConfirmDialog({ title:'Delete Account', message:'Delete this approved instructor account and ALL their data (groups, ratings, sections)? This cannot be undone.', type:'warning', confirmText:'Delete', cancelText:'Cancel', danger:true })
    // 2. If confirmed: Api.deleteAccount(id)
    // 3. On success: showToast(message, 'success'); loadApprovedAccounts(); loadApprovedCount()
    // 4. SELF-DELETE CHECK: if id == sessionStorage.getItem('accountUsername'):
    //       sessionStorage.clear();
    //       showToast('Your account has been deleted. You have been logged out.', 'info');
    //       navigate to #login (show authContainer, hide dashboard)
    // 5. On error: showToast(message, 'error')
}
async function loadApprovedCount() {
    // Mirror loadPendingCount: Api.getApprovedAccounts() → update #approvedCount badge visibility/text
}
```

## Implementation Steps (Ordered with Dependencies)

| Step | File | Change | Depends On |
|------|------|--------|------------|
| 1 | `assets/js/firestore-api.js` | Modify `deleteAccount(id)`: remove `doc.data().status !== 'pending'` guard (line 254); new guard `if (!doc.exists) return {status:'error',message:'Account not found'}`; add `await deleteWhere(COLL_SECTIONS, [['instructor','==',instructorName]])` between ratings and account delete | — |
| 2 | `assets/js/firestore-api.js` | Add `getApprovedAccounts()` after `getPendingAccounts()` (line 243): query `status=='approved'`, sort by id, return `{id, instructor_name, username}` | — |
| 3 | `index.html` | Insert APPROVED ACCOUNTS card after PENDING ACCOUNTS card (~line 193) | — |
| 4 | `index.html` | Insert `approvedModal` markup after `pendingModal` (~line 224) | Step 3 |
| 5 | `index.html` | Cache-bust: `firestore-api.js?v=7` → `v8` (line 435); `script.js?v=30` → `v31` (line 437) | Steps 1-2, 6 |
| 6 | `assets/js/script.js` | Add `openApprovedModal`, `closeApprovedModal`, `loadApprovedAccounts`, `loadApprovedCount`, `deleteApprovedAccount` after `deletePendingAccount` (~line 2005) | Steps 1-2 |
| 7 | `assets/js/script.js` | Wire badge click (optional) and ensure modal events work | Step 6 |

## Workstreams

| Workstream | Branch | Agent | Scope |
|------------|--------|-------|-------|
| **WS-1** `feat/delete-account-groups-cascade` | `feat/delete-account-groups-cascade` | Frontend/Backend Builder (fallback: app-fallback-code-deepseek class runtime) | `assets/js/firestore-api.js`, `assets/js/script.js`, `index.html` |
| **WS-2** Plan artifact | `plan/delete-account-groups-cascade` (this worktree) | Planning Agent (this fallback) | `docs/plans/delete-account-groups-cascade.md` committed on plan branch |

> **Ownership rule:** WS-1 owns ONLY the three files above. No rules, README, or other files.

## Acceptance Criteria

| # | Criterion | Evidence Steps | Verified At |
|---|-----------|----------------|-------------|
| AC-1 | `deleteAccount` accepts approved accounts and returns success | Call `Api.deleteAccount(approvedId)` → returns `{status:'success', message:'Account and all related data deleted successfully!'}` | |
| AC-2 | After delete: zero `groups_table` docs where `instructor == instructor_name` | Firestore console: query `groups_table` where instructor == deleted name → 0 docs | |
| AC-3 | After delete: zero `group_ratings` docs where `instructor == instructor_name` | Firestore console: query `group_ratings` where instructor == deleted name → 0 docs | |
| AC-4 | After delete: zero `section_config` docs where `instructor == instructor_name` | Firestore console: query `section_config` where instructor == deleted name → 0 docs | |
| AC-5 | Account doc deleted | Firestore console: `accounts` doc with deleted ID → not found | |
| AC-6 | Non-existent id returns `{status:'error', message:'Account not found'}` (no throw) | Call `Api.deleteAccount('nonexistent')` → returns error object, no exception | |
| AC-7 | Pending-account delete behavior unchanged (regression) | Call `Api.deleteAccount(pendingId)` → still works, cascades groups/ratings, returns success | |
| AC-8 | `getApprovedAccounts` returns sorted approved list with `id/instructor_name/username` | Call `Api.getApprovedAccounts()` → returns `{status:'success', accounts:[...]}` sorted by id asc | |
| AC-9 | UI: APPROVED ACCOUNTS card + modal list with delete buttons + count badge | Visual: card appears in Account section; modal opens; table renders columns; badge shows count | |
| AC-10 | Delete button opens danger confirmation dialog | Click delete → modal with red styling, "Delete" confirm, "Cancel", danger=true | |
| AC-11 | Confirmed delete → success toast, list + badge refresh | Confirm delete → toast "Account and all related data deleted successfully!"; modal table reloads; badge updates | |
| AC-12 | Self-delete clears session and returns to login | Login as instructor A; delete A's account via admin UI → sessionStorage cleared, toast info, auth view shown | |
| AC-13 | Cache-bust versions updated (`firestore-api.js?v=8`, `script.js?v=31`); other instructors' data untouched | `grep` index.html for versions; create two instructors, delete one → other's groups/ratings/sections intact | |
| AC-14 | `node --check` passes for `firestore-api.js` and `script.js` | Run `node --check assets/js/firestore-api.js` and `node --check assets/js/script.js` → exit 0 | |

## Verification Strategy

### Pre-Commit Static Checks (Builder responsibility)
1. **Syntax**: `node --check assets/js/firestore-api.js` → exit 0; `node --check assets/js/script.js` → exit 0
2. **Grep asserts**:
   - `deleteAccount` contains no `status !== 'pending'` check; contains `deleteWhere(COLL_SECTIONS`
   - `getApprovedAccounts` exists with `status == 'approved'` query and client-side sort
   - `index.html` contains `approvedCount`, `approvedModal`, `approvedAccountsTable`, `approvedAccountsBody`, `noApprovedAccounts`
   - `index.html` line 435: `firestore-api.js?v=8` (not v7); line 437: `script.js?v=31` (not v30)
   - `script.js` contains `openApprovedModal`, `closeApprovedModal`, `loadApprovedAccounts`, `loadApprovedCount`, `deleteApprovedAccount`
   - `deleteApprovedAccount` contains self-delete check: `sessionStorage.getItem('accountUsername')`
3. **Code review**: Verify uppercased `instructorName` used consistently in cascade; `deleteWhere` order correct
4. **Diff scope**: `git diff --name-only` shows only `assets/js/firestore-api.js`, `assets/js/script.js`, `index.html`

### Live Verification (PR Tester / Vercel Preview)
1. Deploy preview (Vercel auto-deploys PR)
2. Create two instructor accounts (A, B); approve both
3. As admin, open APPROVED ACCOUNTS modal → verify both listed with count badge = 2
4. Delete instructor A → confirm danger dialog → success toast → modal shows only B, badge = 1
5. Firestore console: verify A's `groups_table`, `group_ratings`, `section_config`, `accounts` all gone; B's data intact
6. Self-delete test: login as B; delete B via admin (different tab) → B's session cleared, redirected to login
7. Pending regression: create pending C; delete C via PENDING ACCOUNTS → still works

### Cache-Bust Checklist
- [ ] `index.html:435` `firestore-api.js?v=8`
- [ ] `index.html:437` `script.js?v=31`
- [ ] No other `?v=` changes (styles.css remains `v=10`, firebase-init.js remains `v=2`)

## Risks & Controls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| **R1** Stale session / getGroups recreation | Medium | Orphan rows reappear for deleted instructor if they were logged in | Self-delete clears session + redirect (AC-12). Other-instructor delete: accepted residual (architect D6); next `getGroups` lazily recreates 10 rows — admin can re-delete if needed |
| **R2** Case-sensitivity mismatch (instructor_name uppercased vs query) | Medium | Cascade misses rows, orphans remain | Contract: account stores uppercased; cascade uses same `instructorName` variable from `doc.data().instructor_name` (line 255). Code review verifies exact match |
| **R3** Concurrent delete idempotency | Low | Double-delete returns error on second call | `deleteAccount` guard `if (!doc.exists) return {status:'error',message:'Account not found'}` — idempotent error, no throw |
| **R4** No authorization (any instructor can delete any approved account) | High (by design) | Data loss if malicious/accidental | Danger confirmation dialog (type='warning', danger=true) requires explicit "Delete" click; audit via Firestore write logs; accepted per architect D8 |
| **R5** README add/add conflict trap on plan branch | High | Merge conflict vs main if README modified | **Hard rule**: README.md NOT modified on plan branch (architect D9). README updates are post-release residual |
| **R6** Partial cascade failure (network error mid-batch) | Low | Some collections deleted, others remain | `deleteWhere` batches in chunks of 450; each chunk atomic. Best-effort only; no transaction across collections. Re-run delete to clean remainder |
| **R7** Section config delete affects other instructors | None | — | Query filters `instructor == instructorName` exact match; other instructors' sections untouched |

## Decisions (from Architect Handoff — Binding)

| ID | Decision |
|----|----------|
| D1 | `deleteAccount` guard changed from `status !== 'pending'` → `!doc.exists` only |
| D2 | Cascade order: `groups_table` → `group_ratings` → **NEW `section_config`** → account |
| D3 | Success message unchanged: `'Account and all related data deleted successfully!'` |
| D4 | `getApprovedAccounts` mirrors `getPendingAccounts` (query `status=='approved'`, sort by id, return `{id, instructor_name, username}`) |
| D5 | UI: APPROVED ACCOUNTS card + modal mirror PENDING ACCOUNTS (badge, table, delete-only actions) |
| D6 | Session edge documented: other-instructor delete → lazy 10-row recreation on next `getGroups` (accepted residual) |
| D7 | Self-delete: clear `sessionStorage`, toast info, navigate to `#login` |
| D8 | No authz beyond danger confirmation dialog (any logged-in instructor can delete any approved account) |
| D9 | README.md MUST NOT be modified on plan branch (conflict trap) |

## Cache-Bust Checklist
- [ ] `index.html:435` `assets/js/firestore-api.js?v=8`
- [ ] `index.html:437` `assets/js/script.js?v=31`
- [ ] `styles.css?v=10` unchanged
- [ ] `firebase-init.js?v=2` unchanged

---

**Branch:** `plan/delete-account-groups-cascade` (base `350d051976d06bf14cf606a928b58aae2b68d54e`)  
**Worktree:** `.worktrees/plan-delete-account-groups-cascade`  
**Plan PR:** to be opened by PR Coordinator after this artifact is committed.

(End of file)