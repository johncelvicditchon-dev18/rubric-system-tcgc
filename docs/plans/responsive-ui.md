# Parent Plan PR: Responsive UI (320–1920px)

## Goal
Make every view of the Reporting Rubrics System fully responsive on any device width from 320 px to 1920 px, without changing any flows, logic, or data contracts.

## Users
- **Instructors** using desktop (1280–1920 px), tablet (768–1024 px), and phone (320–480 px)
- **Students** primarily on mobile (320–480 px) and tablet (768 px)

## Scope
**In scope (UI/CSS only):**
- `assets/css/styles.css` — all responsive fixes, breakpoint overrides, touch-target sizing, modal fitting, table scrolling, font-size floors
- `index.html` line 11 — cache-bust `styles.css?v=3` → `styles.css?v=4`

**Out of scope (non-goals):**
- No JavaScript logic changes (keep `window.innerWidth <= 768` sidebar coupling intact)
- No Firebase / Firestore changes
- No HTML structure changes beyond the version bump
- No new test harness (verification is manual browser emulation)
- No README or .gitignore (Documentation workstream may add later)

## Non-Goals
- Re-architecting layout to CSS Grid / Flexbox beyond targeted overrides
- Adding automated visual regression tests
- Changing rubric criteria, scoring logic, or auth flows
- Server-side or build-tool changes

## Architecture (Brief)
- **Stack:** Firebase static SPA — `index.html` + `assets/css/styles.css` (2338 lines) + `assets/js/*.js`
- **Existing breakpoints (max-width):** 1200 / 1024 / 900 / 768 / 480 / 375 — **keep these**
- **Sidebar drawer:** JS toggles `.sidebar.open` + `.sidebar-overlay.show` at ≤768 px; CSS handles transform/width
- **Rubrics table:** JS does **not** toggle layout; CSS at ≤768 px converts `<table>` → stacked cards (see lines 2006–2075)
- **Tables:** Instructor tables (`#studentRatingsTable`, `#raterListTable`) use `.table-container { overflow-x: auto }` for horizontal scroll

## Acceptance Criteria (Checklist)
| # | Criterion | Verified At |
|---|-----------|-------------|
| 1 | No horizontal **page** overflow at 360 / 480 / 768 / 1024 / 1280 / 1440 | DevTools device toolbar + console |
| 2 | Sidebar drawer (≤768) opens/closes, overlay traps focus, hamburger works | Manual tap/click |
| 3 | Rubric cards (student rating view) fluid, stacked, no squeeze at ≤768 | 360 / 480 / 768 |
| 4 | Instructor tables scroll **inside** `.table-container` with min-widths (`#studentRatingsTable` ~820 px, `#raterListTable` ~640 px), font-size ≥10 px | 360 / 480 / 768 |
| 5 | Sections table `max-score` inputs (`#newSectionMaxInput`, `#sec_max_*`) width 100% / max-width 90–100 px at ≤480 | 360 / 480 |
| 6 | All modals fit viewport (95 vw / 98 vw, max-height 85–90 vh, internal scroll), close buttons 44 px hit area at ≤480 | 360 / 480 / 768 |
| 7 | Student group grid already 5→1 cols; verify fluid at all breakpoints | 360 / 480 / 768 / 1024 / 1280 |
| 8 | Auth cards, headers, dropdowns, toast, dev FAB (safe-area inset `env(safe-area-inset-bottom)`) fit and touch targets ≥44 px at ≤480 | 360 / 480 |
| 9 | All flows unchanged: login→dashboard→sections→modals; student→grid→rubric→submit→back; logout; PDF export | Manual E2E at each breakpoint |
| 10 | Console clean (no errors/warnings) at all tested widths | DevTools console |

## Workstreams

| Workstream | Branch | Agent | Scope |
|------------|--------|-------|-------|
| **Frontend** | `feat/responsive-ui-frontend` | Frontend Builder | `assets/css/styles.css` (all responsive CSS) + `index.html` line 11 (version bump) |
| **Documentation** | `docs/responsive-ui` | Docs Agent | Minimal README/update if needed (optional, post-merge) |

> **Ownership rule:** Frontend workstream owns **only** `assets/css/styles.css` and `index.html:11`. No other files.

## Verification Checklist (Browser Emulation)
No test harness exists. Verification procedure:
1. Open `index.html` via `http-server` or `npx serve` on localhost
2. DevTools → Device Toolbar → test each width: **360, 480, 768, 1024, 1280, 1440**
3. At each width:
   - Check horizontal scrollbar on `html/body` → **must be absent**
   - Exercise all flows (login, dashboard nav, modals, student rating, PDF export, logout)
   - Inspect console for errors
4. Record pass/fail per Acceptance Criteria row

## Decisions (Recorded)
| Decision | Rationale |
|----------|-----------|
| **Table strategy:** Keep horizontal scroll inside `.table-container` for instructor tables; set explicit `min-width` on tables (~820 px / ~640 px) and floor `font-size: 10px` at ≤480/375 | Preserves column alignment & sticky headers; avoids squeezing content to unreadable 8–9 px |
| **Rubrics min-width fix:** Override `.rubrics-container { min-width: 700px }` at ≤768 with `min-width: 0; width: 100%` so stacked-card layout is fluid | Current 700 px floor forces page overflow on phones; stacked cards (CSS lines 2006–2075) need full fluid width |
| **Cache-bust:** `styles.css?v=3` → `styles.css?v=4` on `index.html:11` | Ensures clients fetch new responsive CSS immediately |
| **Breakpoints:** Retain existing 1200/1024/900/768/480/375 | No design-system change; minimizes risk |
| **Modal sizing:** 95 vw (≤768) / 98 vw (≤480), max-height 85–90 vh, internal `overflow-y: auto`; close button `min-height: 44px` at ≤480 | Viewport-fit + touch-target compliance |
| **Dev FAB:** Add `bottom: env(safe-area-inset-bottom, 24px)` and `right: env(safe-area-inset-right, 24px)` | Safe-area compliance on notched devices |

## Risks and Assumptions
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Stacked-card rubric layout (≤768) may have edge cases with long criteria descriptions | Medium | Visual overflow | `min-width: 0` on cells, `word-break: break-word`, test with longest criteria |
| Instructor table horizontal scroll on iOS Safari may hide scrollbar until swipe | Low | Discoverability | `-webkit-overflow-scrolling: touch` already present; verify |
| Modal `max-height` + internal scroll may clip content on very short viewports (landscape phone) | Medium | Usability | Set `max-height: 85vh` and test iPhone SE landscape (375×667) |
| Cache-bust version bump missed in `index.html` | Low | Stale CSS | Explicitly called out in plan; Frontend Builder must update line 11 |
| JS sidebar coupling (`window.innerWidth <= 768`) diverges from CSS breakpoints | Low | Layout mismatch | Documented as invariant; no JS changes allowed |

---

**Branch:** `plan/responsive-ui` (base `a911fb32ee92ca2967622796da6f27a77df528c7`)  
**Worktree:** `.worktrees/plan-responsive-ui`  
**Plan PR:** Parent Draft Plan PR will be opened by PR Coordinator after this artifact is committed.