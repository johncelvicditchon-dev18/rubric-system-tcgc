# Parent Plan PR: Comprehensive UI/UX Overhaul

## Goal
Elevate the entire Reporting Rubrics System to a professional, consistent, accessible, and fully responsive design system (320–1920 px) without changing any business logic, data contracts, or Firebase/Firestore integrations.

## Users
- **Instructors** on desktop (1280–1920 px), tablet (768–1024 px), and phone (320–480 px)
- **Students** primarily on mobile (320–480 px) and tablet (768 px)
- **Developers** accessing dev tools on any device

## Scope
**In scope (UI layer only):**
- `assets/css/styles.css` — design tokens, component library, responsive overrides, animations, accessibility helpers
- `index.html` — semantic/ARIA markup improvements, cache-bust `styles.css?v=9` → `v=10`, `script.js?v=29` → `v=30`
- `assets/js/script.js` — **strictly presentational/UX-layer**: button loading states, inline validation display, aria/disabled toggles, toast/dialog usage consistency, focus management; **NO** business logic, scoring, auth flows, Firestore calls, PDF generation, or data handling

**Out of scope (non-goals):**
- No changes to `firestore-api.js`, `firebase-init.js`, `firestore.rules`, or any data contract
- No new dependencies, build tools, or test harness
- No changes to scoring logic, auth flows, rubric criteria, PDF export internals
- No server-side or infrastructure changes

## Non-Goals
- Re-architecting to a framework (React/Vue/Svelte) or adding a build step
- Automated visual regression or E2E test suite
- Changing Firebase project configuration or security rules
- Adding new user-facing features beyond UI polish

## Architecture (Brief)
- **Stack:** Firebase static SPA — `index.html` (439 lines) + `assets/css/styles.css` (2704 lines, design tokens at `:root`, keyframes, reduced-motion at end) + `assets/js/script.js` (2334 lines) + `assets/js/firestore-api.js` (631) + `assets/js/firebase-init.js` (11)
- **Existing breakpoints (max-width):** 1200 / 1024 / 900 / 768 / 480 / 375 — **retain and extend**
- **Toast system:** `showToast(message,type,duration)` (line 2145, 89 call sites), `showLoadingToast/hideLoadingToast`, `showAlertDialog`, `showConfirmDialog` (danger option, Escape→cancel), `showLoadingDialog` — **standardize usage everywhere**
- **Modal system:** Static modals in `index.html` (pendingModal, resetModal, studentDetailModal, developerModal) + `openModalOverlay/closeModalOverlay` (2203/2213), `rememberFocus/restoreFocus`, global Escape handler
- **Responsive CSS:** Sidebar drawer ≤768; rubric tables→stacked cards ≤768; instructor tables scroll in `.table-container`; dev FAB with safe-area
- **Cache-bust convention:** `index.html` currently references `styles.css?v=9` and `script.js?v=29` — **plan must bump both to v=10 and v=30** as final implementation step

## Acceptance Criteria (Checklist)

| # | Criterion | Verified At |
|---|-----------|-------------|
| 1 | Design tokens (colors, spacing, radii, shadows, typography) defined in `:root` and used consistently; no hardcoded values in component CSS | `grep -n "var(--" assets/css/styles.css \| wc -l` + visual audit |
| 2 | Button system: 7 variants (primary/secondary/success/danger/warning/outline/ghost/icon) each with hover/active/focus/disabled/loading states; 44 px min touch target | DevTools device toolbar 360/480/768/1024/1280/1440 |
| 3 | Form design: labels, placeholders, required markers (*), inline validation errors, focus/error/success states; no browser-only validation | Manual interaction + `:invalid`/`:valid` styling audit |
| 4 | Professional tables: sticky headers, hover, proper alignment (numeric right, text left), horizontal scroll in `.table-container` on mobile, search/filter/pagination where supported | 360/480/768/1024/1280/1440 |
| 5 | Dashboard: summary cards with hierarchy, responsive grid (4→2→1 cols), consistent card styling | 360/480/768/1024/1280/1440 |
| 6 | Navigation: active indicators, icons, mobile hamburger (≤768), keyboard accessible, focus visible | 360/480/768/1024/1280/1440 |
| 7 | Search/filter inputs: clean styling, debounced where appropriate, empty states, accessible labels | 360/480/768/1024 |
| 8 | Empty states (`.no-data`): illustration/icon, friendly copy, primary action button where applicable | All views at 360/480/768/1024 |
| 9 | Toast/notification system: consistent usage (success/error/warning/info), entrance/exit animation, auto+manual dismissal, no duplicate toasts | `grep -n "showToast\|showAlertDialog\|showConfirmDialog" assets/js/script.js` + manual |
| 10 | Confirmation modals for ALL destructive/important actions (delete, reset, logout, submit): consistent usage, danger variant, Escape→cancel | `grep -rn "confirm\|delete\|reset" assets/js/script.js` + manual flows |
| 11 | Loading states everywhere: page, submit, save, delete, search; button loading states (spinner + disabled); prevent double submits | Manual E2E at each breakpoint |
| 12 | Friendly error states: no raw SQLSTATE/Firestore errors to users; toast + inline where appropriate | Console + manual error injection |
| 13 | Auth UI: show/hide password, loading, error handling, responsive, accessible labels | 360/480/768/1024 |
| 14 | Accessibility: labels on all inputs, keyboard nav, focus indicators (`:focus-visible`), contrast ≥4.5:1, ARIA roles, semantic HTML, not color-only | axe-core DevTools + keyboard-only nav |
| 15 | Animations: subtle, respect `prefers-reduced-motion` (already present), no layout shift | DevTools rendering → emulate reduced motion |
| 16 | Responsive modals: 95 vw/98 vw, max-height 85–90 vh, internal scroll, 44 px close button at ≤480 | 360/480/768/1024 |
| 17 | UX behavior: "Saving…" → success toast → reset form; keep input on error; no jarring transitions | Manual E2E all flows |
| 18 | Consistency audit: no duplicate CSS rules, no inline style proliferation, reusable utility classes | `grep -rn "style=" index.html assets/js/script.js` + CSS dedup check |
| 19 | No horizontal **page** overflow at 360/480/768/1024/1280/1440 | DevTools device toolbar + console |
| 20 | All flows unchanged: login→dashboard→sections→modals; student→grid→rubric→submit→back; logout; PDF export | Manual E2E at each breakpoint |
| 21 | Console clean (no errors/warnings) at all tested widths | DevTools console |
| 22 | Cache-bust: `index.html` references `styles.css?v=10` and `script.js?v=30` | `grep "v=10\|v=30" index.html` |

## Workstreams

| Workstream | Branch | Agent | Scope |
|------------|--------|-------|-------|
| **Frontend** | `feat/ui-ux-overhaul-frontend` | Frontend Builder | `assets/css/styles.css` (all design system + responsive CSS) + `index.html` (version bumps + semantic/ARIA markup) + `assets/js/script.js` (UI-layer only: loading states, validation display, aria/disabled toggles, toast/dialog consistency, focus management) |
| **Documentation** | `docs/ui-ux-overhaul` | Docs Agent | Minimal README/update if needed (optional, post-merge) |

> **Ownership rule:** Frontend workstream owns **only** `assets/css/styles.css`, `index.html` (version bumps + markup/ARIA), and presentational slices of `assets/js/script.js`. **No** changes to `firestore-api.js`, `firebase-init.js`, `firestore.rules`, or business logic in `script.js`.

## Verification Procedure (Browser Emulation)
No test harness exists. Verification:
1. Serve `index.html` via `http-server` or `npx serve` on localhost
2. DevTools → Device Toolbar → test each width: **360, 480, 768, 1024, 1280, 1440**
3. At each width:
   - Check horizontal scrollbar on `html/body` → **must be absent**
   - Exercise all flows (login, dashboard nav, modals, student rating, PDF export, logout)
   - Inspect console for errors
   - Keyboard-only navigation (Tab/Shift+Tab/Enter/Escape)
   - Emulate `prefers-reduced-motion: reduce`
4. Static checks:
   - `grep -rn "alert(\|confirm(" assets/js/script.js` → **must be zero**
   - `grep -rn "style=" index.html assets/js/script.js` → **minimal, only dynamic**
   - `grep -n "var(--" assets/css/styles.css | wc -l` → **high usage of tokens**
5. Record pass/fail per Acceptance Criteria row

## Decisions (Recorded)

| Decision | Rationale |
|----------|-----------|
| **Design tokens in `:root`** | Single source of truth; enables theming; already partially present — extend systematically |
| **Button variants as utility classes** (`.btn`, `.btn--primary`, `.btn--loading`, etc.) | Reusable, composable, no inline styles; matches existing CSS methodology |
| **Form validation: inline + ARIA** (`aria-invalid`, `aria-describedby` pointing to error `<span>`) | Accessible, no browser-only validation, consistent with toast system |
| **Table strategy:** Keep horizontal scroll in `.table-container`; add sticky `<thead>`; set explicit `min-width` per table; floor `font-size: 10px` at ≤480 | Preserves alignment & headers; avoids unreadable squeeze |
| **Modal sizing:** 95 vw (≤768) / 98 vw (≤480), max-height 85–90 vh, internal `overflow-y: auto`; close button `min-height: 44px` at ≤480 | Viewport-fit + touch-target compliance; existing pattern |
| **Toast standardization:** Audit all 89 call sites → consistent type (success/error/warning/info), duration, no stacking >3 | Professional UX; prevents toast fatigue |
| **Confirm dialogs for ALL destructive actions** (delete section, reset ratings, logout, submit final) | Safety; existing `showConfirmDialog` supports danger variant |
| **Loading states:** Button `.btn--loading` (spinner + `disabled` + `aria-busy`); page skeleton where meaningful | Prevents double submits; perceived performance |
| **Cache-bust:** `styles.css?v=9` → `v=10`, `script.js?v=29` → `v=30` on `index.html` lines 11 & 13 | Ensures clients fetch new CSS/JS immediately |
| **Breakpoints:** Retain 1200/1024/900/768/480/375; add 320 floor where needed | No design-system churn; minimizes risk |
| **No new dependencies** | Hard constraint; vanilla CSS/JS only |

## Risks and Assumptions

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Inline validation display conflicts with existing `showToast` error patterns | Medium | UX inconsistency | Define clear rule: inline for field-level, toast for form-level/submit errors |
| Button loading state (`disabled` + spinner) may break existing submit handlers that don't re-enable | Medium | Broken flows | Audit all `showLoadingToast`/`hideLoadingToast` pairs; add `finally` blocks |
| `showConfirmDialog` Promise-based — some call sites may not `await` properly | Low | Silent failures | Grep all call sites; verify `await`/`then` usage |
| Reduced-motion media query exists but keyframes may not all respect it | Medium | Accessibility violation | Wrap all `@keyframes` in `@media (prefers-reduced-motion: no-preference)` |
| Mobile hamburger JS coupling (`window.innerWidth <= 768`) vs CSS breakpoints | Low | Layout mismatch | Documented invariant; no JS changes allowed |
| Cache-bust version bump missed in `index.html` | Low | Stale assets | Explicitly called out as AC #22; final step in implementation |
| CSS dedup may inadvertently remove needed specificity | Low | Visual regression | Group-by-property audit; test at each breakpoint after dedup |

---

**Branch:** `plan/ui-ux-overhaul` (base `fd7352f`)  
**Worktree:** `.worktrees/plan-ui-ux-overhaul`  
**Plan PR:** Parent Draft Plan PR will be opened by PR Coordinator after this artifact is committed.

(End of file)