# Plan: Auto Group Rows on Instructor Signup

## Goal
Create 10 empty group rows (GROUP 1–10, 6 members each) in `groups_table` atomically at signup so they exist immediately; if the pending instructor is later deleted/not approved, `deleteAccount` already cascades and removes them.

## Background / Current Behavior
- `Api.signup()` (firestore-api.js:185) creates ONE account doc with `status:'pending'` and `instructor_name` uppercased. **No group rows are created.**
- `Api.getGroups()` (firestore-api.js:361) lazily batch-creates the 10 groups only when an instructor first opens Group Results — rows appear on-demand, not at signup.
- `Api.deleteAccount()` (firestore-api.js:228) **already deletes** all `groups_table` and `group_ratings` rows matching `instructor == instructor_name` before deleting the account (guard: only `status === 'pending'`).
- `GROUP_NAMES` (10 groups) and `MEMBER_FIELDS` (6 members) are constants; `emptyGroupData()` and `groupDocId()` are reusable helpers.

## Goal & Scope
**In scope:**
- `assets/js/firestore-api.js`: modify `signup()` to batch-create 10 group docs with canonical IDs after the account doc succeeds.
- `index.html` line 435: bump cache-bust `firestore-api.js?v=6` → `?v=7`.

**Out of scope (non-goals):**
- No `firestore.rules` change (already permissive; client batch writes work).
- No `script.js` change (signup/delete UI already correct).
- No change to `getGroups()` lazy creation for pre-existing instructors — it will find the 10 rows and skip its creation branch.
- No new dependencies, collections, or data contracts.

## Architecture / Data Model
- **Collections**: `accounts`, `groups_table` (COLL_GROUPS), `group_ratings` (COLL_RATINGS).
- **Doc IDs**: `groupDocId(instructor, '', gn)` — canonical `G_<instructor>__<group>` format (double underscore when section is empty).
- **Batch semantics**: Single Firestore `WriteBatch` with 10 `set()` operations — atomic commit or full rollback.
- **Rollback**: If batch commit fails, best-effort `delete()` the just-created account doc to avoid orphan pending account without rows.
- **Uppercased contract**: Account stores `instructor_name: UPPERCASE(name)`; group rows MUST use the same uppercased value so `deleteAccount`'s `deleteWhere(COLL_GROUPS, [['instructor','==',instructorName]])` matches.

## Implementation Plan
1. **assets/js/firestore-api.js:185–196** — In `signup()`, after `db.collection(COLL_ACCOUNTS).add({...})` resolves, capture the `instructorName` (uppercased) and run a batch:
   ```js
   const batch = db.batch();
   GROUP_NAMES.forEach(gn => {
       batch.set(db.collection(COLL_GROUPS).doc(groupDocId(instructorName, '', gn)),
                 emptyGroupData(instructorName, '', gn));
   });
   await batch.commit();
   ```
   Wrap in `try/catch`; on failure, `await db.collection(COLL_ACCOUNTS).doc(accountRef.id).delete()` (best-effort rollback) and return `{status:'error', message:'Signup failed — please try again'}`.
2. **index.html:435** — Change `assets/js/firestore-api.js?v=6` to `assets/js/firestore-api.js?v=7`.

## Workstreams

| Workstream | Branch | Agent | Scope |
|------------|--------|-------|-------|
| **feat/auto-group-rows** | `feat/auto-group-rows` | Data layer (Backend/Database Builder, fallback code agent) | `assets/js/firestore-api.js` (signup batch + rollback) + `index.html:435` (cache-bust) |

> **Ownership rule:** This workstream owns ONLY the two files above. No UI, rules, or other API changes.

## Acceptance Criteria

| # | Criterion | Verified At |
|---|-----------|-------------|
| AC-1 | `signup()` creates exactly 10 `groups_table` docs (GROUP 1..10) in one batch; each has 6 empty `memberX_name` fields, `is_closed:0`, `section:''`, `instructor` = UPPERCASED name | Static grep: batch loop over `GROUP_NAMES` calling `groupDocId` + `emptyGroupData` |
| AC-2 | Canonical doc IDs (`groupDocId` with section `''`) — `getGroups('')` later finds 10 rows and skips its creation branch (query non-empty) | Code trace: `getGroups` at line 366 checks `groups.length === 0`; rows exist → branch skipped |
| AC-3 | Duplicate-username signup fails BEFORE any row creation (no orphan rows) | Code trace: `firstDoc` username check at line 186 precedes account add and batch |
| AC-4 | Batch failure rolls back the account doc (no orphan pending account) | Static check: `try/catch` around `batch.commit()` with `accountRef.delete()` in catch |
| AC-5 | `deleteAccount` cascade removes the 10 signup-created rows + ratings + account (code-path trace) | Static trace: `deleteAccount` line 231 gets `instructorName`, lines 232–234 `deleteWhere` groups & ratings by that name, then deletes account |
| AC-6 | Approved accounts unaffected; `getGroups` lazy creation intact for legacy instructors | Non-goal; no changes to approval flow or `getGroups` logic for existing data |
| AC-7 | Cache-bust `firestore-api.js?v=7` present in `index.html`; `?v=6` absent | `grep "firestore-api.js?v=7" index.html` → match; `grep "firestore-api.js?v=6" index.html` → no match |
| AC-8 | No UI/rules/dependency changes; `script.js` diff empty | `git diff --name-only` shows only `assets/js/firestore-api.js` and `index.html` |

## Verification Strategy (Pre-Commit Static Checks)
1. **Syntax**: `node --check assets/js/firestore-api.js` → exit 0.
2. **Grep asserts**:
   - `signup` function contains `batch.commit` + `GROUP_NAMES.forEach` + `groupDocId` + `emptyGroupData`.
   - `catch` block contains `accountRef.delete` (or equivalent rollback).
   - `index.html` line 435 contains `firestore-api.js?v=7` and not `v=6`.
   - `script.js` unchanged (`git diff assets/js/script.js` → empty).
   - `firestore.rules` unchanged.
3. **Code review**: Verify uppercased `instructorName` used consistently in batch; `deleteAccount` condition matches.
4. **Code review**: Verify uppercased `instructorName` used consistently; `deleteAccount` cascade condition matches; rollback path correct. (No live Firestore testing in this environment — see Risks.)

## Risks & Controls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Batch atomicity — partial commit on failure | Low (Firestore batch is atomic) | Orphan rows | Firestore batches succeed or fail entirely; rollback deletes account |
| Uppercased name mismatch between account and group rows | Medium | Delete cascade misses rows | Plan mandates same `instructorName` variable (uppercased) for both |
| Rollback `delete()` fails (network) | Low | Orphan pending account | Best-effort only; admin can manually clean via Pending Accounts UI |
| No live Firestore testing in this environment | High | Cannot verify end-to-end | Static checks + code-path trace; PR tester does live verification |

## Decisions (Recorded)
- Rows created with `section: ''` at signup (no sections exist yet); `getGroups(instructor, '')` reuses them.
- Reuse `emptyGroupData()` and `groupDocId()` — no new helpers.
- Reuse `deleteAccount` cascade — no new deletion logic.
- Cache-bust only `firestore-api.js` (v6→v7); `script.js?v=30` and `styles.css?v=10` unchanged.

---
**Branch:** `plan/auto-group-rows` (base `d00145c`)  
**Worktree:** `.worktrees/plan-auto-group-rows`  
**Plan PR:** to be opened by PR Coordinator after this artifact is committed.

(End of file)