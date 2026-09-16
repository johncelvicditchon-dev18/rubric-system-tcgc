# Implementation Plan: Auth Inline Errors (feat/auth-inline-errors)

## 1. Overview

**Objective**: Convert all authentication error messages from toast popups to inline field errors, matching the existing "Username is required" inline style. Success toasts remain unchanged.

**Scope**: Single frontend workstream — `assets/js/script.js` (primary) + `assets/css/styles.css` (verify existing styles). No backend changes.

**Branch**: `feat/auth-inline-errors` (from `plan` branch)
**Worktree**: `.worktrees/feat-auth-inline-errors-frontend/`

---

## 2. Acceptance Criteria (from Product Analyst handoff)

| ID  | Criterion |
|-----|-----------|
| A1  | Instructor login: wrong password shows inline error on password field (no toast) |
| A2  | Instructor login: unknown username shows inline error on username field (no toast) |
| A3  | Instructor login: empty username/password shows inline errors on respective fields (existing behavior preserved) |
| A4  | Student login: wrong name/section shows inline error on appropriate field (no toast) |
| A5  | Student login: empty name/section shows inline errors (existing behavior preserved) |
| A6  | Signup: username taken shows inline error on username field (no toast) |
| A7  | Signup: empty fields show inline errors (existing behavior preserved) |
| A8  | All server error responses mapped to specific input fields via `mapServerErrorToField()` |
| A9  | Inline errors use existing `.has-error` + `.form-error` + `aria-invalid` + `aria-describedby` pattern |
| B1  | Error clears on `input` event for the affected field (reuse existing `clearFieldError` binding) |
| B2  | Error clears on `change` event for `<select>` elements |
| B3  | ARIA attributes properly maintained (`aria-invalid="true"`, `aria-describedby` pointing to error span) |
| C1  | Success toasts remain for: instructor login, student login, signup success |
| C2  | No `showToast(..., 'error')` calls remain in `handleLogin` or `handleSignup` |
| D1  | `node -c assets/js/script.js` passes (syntax clean) |
| D2  | `grep -n "showToast.*error" assets/js/script.js` returns zero matches inside `handleLogin`/`handleSignup` |
| D3  | Manual QA: each error scenario (T1–T15) displays inline, no popup |

---

## 3. Solution Architecture (from Solution Architect handoff)

### 3.1 New Functions (added to `assets/js/script.js`)

#### `mapServerErrorToField(endpoint, errorMessage, formType)`
Maps server error strings to specific input field IDs for inline display.

| Endpoint / Form | Error Message Pattern | Target Field ID |
|-----------------|----------------------|-----------------|
| `login` (instructor) | "Invalid username or password" / "Wrong password" | `loginPassword` |
| `login` (instructor) | "User not found" / "Invalid username" | `loginUsername` |
| `login` (instructor) | "Account not approved" | `loginUsername` |
| `studentLogin` | "Student not found" / "Invalid name or section" | `loginStudentName` |
| `studentLogin` | "Section mismatch" | `loginStudentSection` |
| `signup` | "Username already exists" / "Username taken" | `signupUsername` |
| `signup` | "Email already registered" | `signupUsername` (or email field if added) |
| *fallback* | any other error | first visible required field in form |

Returns `{ fieldId: string, message: string }` or `null` if no mapping.

#### `bindInlineErrorClearing()`
Attaches `input`/`change` listeners to auth form fields to auto-clear inline errors on user interaction. Reuses existing `clearFieldError` logic. Called once in `initAuth()` or `DOMContentLoaded`.

### 3.2 Refactored Functions

#### `handleLogin(e)` — Instructor branch
- Remove `showToast(data.message, 'error')` on line 306
- Remove `showToast('Error: ' + err.message, 'error')` on line 310
- Replace with: `const mapped = mapServerErrorToField('login', data.message || err.message, 'instructor'); if (mapped) setFieldError(document.getElementById(mapped.fieldId), mapped.message);`
- Keep `showToast('Login successful!', 'success')` on line 303

#### `handleLogin(e)` — Student branch
- Remove `showToast(data.message, 'error')` on line 339
- Remove `showToast('Error: ' + err.message, 'error')` on line 343
- Replace with mapped inline errors via `mapServerErrorToField('studentLogin', ...)`
- Keep `showToast('Welcome ' + name + '!', 'success')` on line 336

#### `handleSignup(e)`
- Remove `showToast(data.message, 'error')` on line 378
- Remove `showToast('Network error. Please try again.', 'error')` on line 382
- Replace with mapped inline errors via `mapServerErrorToField('signup', ...)`
- Keep `showToast('Account created! Awaiting instructor approval.', 'success')` on line 372

### 3.3 CSS Verification
Existing styles in `assets/css/styles.css` (lines 183–239) already define:
- `.form-group.has-error input` — red border
- `.form-error` — red text below input
- `input[aria-invalid="true"]` — red border + aria
No new CSS required. Verify only.

---

## 4. Implementation Steps (Ordered)

| Step | Task | Owner | Depends On |
|------|------|-------|------------|
| 1 | Create worktree `feat-auth-inline-errors-frontend` from `plan` branch | Planning Agent | — |
| 2 | Add `mapServerErrorToField()` function in `assets/js/script.js` (after `clearFieldError`, ~line 60) | Frontend Agent | Step 1 |
| 3 | Add `bindInlineErrorClearing()` function in `assets/js/script.js` (after `mapServerErrorToField`) | Frontend Agent | Step 2 |
| 4 | Call `bindInlineErrorClearing()` in `initAuth()` (line 209) | Frontend Agent | Step 3 |
| 5 | Refactor `handleLogin` instructor branch: replace error toasts with `mapServerErrorToField` + `setFieldError` | Frontend Agent | Step 4 |
| 6 | Refactor `handleLogin` student branch: replace error toasts with `mapServerErrorToField` + `setFieldError` | Frontend Agent | Step 5 |
| 7 | Refactor `handleSignup`: replace error toasts with `mapServerErrorToField` + `setFieldError` | Frontend Agent | Step 6 |
| 8 | Verify CSS: confirm `.has-error`, `.form-error`, `aria-invalid` styles exist in `assets/css/styles.css` | Frontend Agent | Step 1 |
| 9 | Run syntax check: `node -c assets/js/script.js` | Frontend Agent | Step 7 |
| 10 | Run grep check: `grep -n "showToast.*error" assets/js/script.js` — confirm zero in auth handlers | Frontend Agent | Step 9 |
| 11 | Manual QA: execute test matrix T1–T15 (see §6) | Frontend Agent | Step 10 |
| 12 | Document results in handoff.md | Frontend Agent | Step 11 |

---

## 5. File Ownership & Worktree Map

| Path | Owner | Worktree |
|------|-------|----------|
| `assets/js/script.js` | Frontend Agent | `.worktrees/feat-auth-inline-errors-frontend/assets/js/script.js` |
| `assets/css/styles.css` | Frontend Agent (verify only) | `.worktrees/feat-auth-inline-errors-frontend/assets/css/styles.css` |
| `docs/plans/auth-inline-errors.md` | Planning Agent | `.worktrees/feat-auth-inline-errors-frontend/docs/plans/auth-inline-errors.md` |

**Non-overlapping guarantee**: Only the two frontend files are modified. No other workstream touches these paths.

---

## 6. Verification Gates

### 6.1 Automated Checks (must pass before manual QA)
```bash
# Syntax
node -c assets/js/script.js

# No error toasts in auth handlers
grep -n "showToast.*error" assets/js/script.js
# Expected: zero matches inside handleLogin/handleSignup (other showToast calls elsewhere are OK)
```

### 6.2 Manual QA Test Matrix (T1–T15)

| Test | Scenario | Expected |
|------|----------|----------|
| T1 | Instructor login: empty username | Inline "Username is required" on username field |
| T2 | Instructor login: empty password | Inline "Password is required" on password field |
| T3 | Instructor login: wrong password | Inline "Invalid username or password" on password field |
| T4 | Instructor login: unknown username | Inline "User not found" on username field |
| T5 | Instructor login: account not approved | Inline "Account not approved. Contact administrator." on username field |
| T6 | Instructor login: valid credentials | Success toast "Login successful!" + redirect |
| T7 | Student login: empty name | Inline "Rater name is required" on name field |
| T8 | Student login: empty section | Inline "Section is required" on section select |
| T9 | Student login: wrong name/section | Inline "Student not found" on name field |
| T10 | Student login: valid credentials | Success toast "Welcome [Name]!" + redirect |
| T11 | Signup: empty name | Inline "Full name is required" on name field |
| T12 | Signup: empty username | Inline "Username is required" on username field |
| T13 | Signup: empty password | Inline "Password is required" on password field |
| T14 | Signup: username taken | Inline "Username already exists" on username field |
| T15 | Signup: valid data | Success toast "Account created! Awaiting instructor approval." + switch to login |

**Clear-on-input verification**: For T1–T5, T7–T9, T11–T14 — after error appears, type in the errored field → error clears immediately.

**ARIA verification**: Inspect DOM — errored input has `aria-invalid="true"`, `aria-describedby="err_<fieldId>"`, error span has `id="err_<fieldId>"` and class `.form-error`.

---

## 7. Risk Controls

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Server error message changes break mapping | Medium | High | `mapServerErrorToField` uses substring matching; fallback to first required field |
| Double error display (toast + inline) | Low | Medium | Grep gate (Step 10) catches residual `showToast.*error` in auth handlers |
| ARIA regressions on clear | Low | Medium | Reuse existing `clearFieldError` which already handles ARIA cleanup |
| CSS regression on inline errors | Low | Low | Verify-only step (Step 8); existing styles unchanged |
| Worktree contamination | Low | High | Isolated worktree; only two files in scope |
| Success toast removal by mistake | Low | Medium | Explicit keep-list in Steps 5–7; QA T6/T10/T15 verify |

---

## 8. Plan PR Body (for GitHub)

```markdown
## Summary
Convert all authentication error messages from toast popups to inline field errors (matching existing "Username is required" style). Success toasts preserved.

## Changes
- `assets/js/script.js`: +2 functions (`mapServerErrorToField`, `bindInlineErrorClearing`), refactor `handleLogin`/`handleSignup`
- `assets/css/styles.css`: verify only (existing inline error styles sufficient)

## Acceptance
- A1–D4 from Product Analyst handoff
- T1–T15 manual QA matrix
- `node -c` clean, `grep showToast.*error` zero in auth handlers

## Testing
- Automated: syntax + grep gates
- Manual: 15 test cases covering instructor/student login + signup error/success paths

## Risks
- Server message drift → fallback mapping
- ARIA regressions → reuse existing clearFieldError
```

---

## 9. Dependencies & Sequencing

```
plan branch
  └─> feat/auth-inline-errors (this plan)
        └─> .worktrees/feat-auth-inline-errors-frontend/ (implementation)
              ├─> Frontend Agent: Steps 2–11
              └─> Planning Agent: Step 12 (handoff)
```

No cross-workstream dependencies. This is a standalone frontend workstream.

---

## 10. Recommended Next Action

**Create worktree and begin Step 2 (add `mapServerErrorToField`)**. The plan is complete and ready for implementation.