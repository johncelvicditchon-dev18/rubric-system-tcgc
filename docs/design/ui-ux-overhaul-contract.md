# UI/UX Overhaul — Visual & Interaction Design Contract

**Status:** Frozen for implementation
**Branch:** plan/ui-ux-overhaul | Commit: 9f4e404
**Scope:** styles.css (token + component + layout), index.html (markup/ARIA + cache-bust), script.js (presentational only)
**Constraints:** No business logic, Firestore, PDF, or data changes; no new dependencies; vanilla CSS/JS only.

---

## 1. Design Tokens

### 1.1 Palette

| Token | Value | Use |
|---|---|---|
| `--green-900` | `#0a1e14` | Deepest background tint |
| `--green-800` | `#0f3d24` | Sidebar gradient end |
| `--green-700` | `#115c2e` | **Primary** — headers, active states, text accents |
| `--green-600` | `#1a7a3a` | Primary hover gradient |
| `--green-500` | `#1a8a42` | **Accent** — buttons, progress bars, focus rings |
| `--green-400` | `#2ea85a` | Success icon fills |
| `--green-300` | `#4ade80` | Score badges, nav active indicator |
| `--green-200` | `#8be8aa` | Light accents, avatar ring |
| `--green-100` | `#c8f0d4` | Status pill bg, tag backgrounds |
| `--green-50` | `#e8f5e9` | Alt-row stripe, hover hint bg |
| `--neutral-900` | `#1a2332` | Body text |
| `--neutral-800` | `#2d3748` | Secondary text |
| `--neutral-700` | `#4a5568` | Muted text, labels |
| `--neutral-600` | `#718096` | Placeholder, tertiary text |
| `--neutral-500` | `#a0aec0` | Borders, disabled text |
| `--neutral-400` | `#cbd5e0` | Input borders, empty-state |
| `--neutral-300` | `#d4dbe5` | Default borders |
| `--neutral-200` | `#e2e8f0` | Divider lines, card borders |
| `--neutral-100` | `#eef2e8` | Card border-bottom, table row dividers |
| `--neutral-50` | `#f7faf5` | Page background, subtle bg |
| `--white` | `#ffffff` | Card/surface bg |
| `--red-600` | `#dc2626` | **Danger** — delete, reset |
| `--red-500` | `#ef4444` | Error toast, error border |
| `--red-100` | `#fef2f2` | Danger card header bg |
| `--red-50` | `#fce4ec` | Error hover bg, danger card bg |
| `--amber-500` | `#f59e0b` | **Warning** — pending badge, warning toast |
| `--amber-50` | `#fffbeb` | Warning icon bg |
| `--blue-500` | `#3b82f6` | **Info** — info toast, own-group border |
| `--blue-100` | `#dbeafe` | Info pill bg |

**Contrast compliance:** `--green-700` on `--white` = 8.1:1, `--neutral-900` on `--neutral-50` = 15.0:1, `--red-600` on `--white` = 4.8:1. All pass WCAG AA (4.5:1 min).

### 1.2 Typography

| Token | Value | Use |
|---|---|---|
| `--font-body` | `'Inter', -apple-system, BlinkMacSystemFont, sans-serif` | All body text, labels, inputs, buttons |
| `--font-display` | `'Bebas Neue', sans-serif` | **Demoted** — headings/titles only (h2 in auth, card headers, section title, student title, modal h3, group card names, sidebar h2). Never for body text or buttons. |

**Type scale:**

| Name | Size | Weight | Line-height | Use |
|---|---|---|---|---|
| `text-xs` | 10px | 700 | 1.3 | Table headers, pill labels |
| `text-sm` | 11px | 700 | 1.3 | Uppercase labels, nav links, tag text |
| `text-base` | 13px | 600 | 1.5 | Body text, table cells, descriptions |
| `text-md` | 14px | 700 | 1.45 | Inputs, body copy |
| `text-lg` | 18px | 700 | 1.2 | Card subheadings |
| `text-xl` | 20px | 700 | 1.2 | Modal titles, card headers |
| `text-2xl` | 22px | 700 | 1.3 | Dialog titles |
| `text-3xl` | 24-28px | 700 | 1.1 | Profile names, group card names, section title |
| `text-4xl` | 28-34px | 700 | 1.1 | Auth card title, delete title |

### 1.3 Spacing Scale

| Token | Value |
|---|---|
| `--space-1` | 2px |
| `--space-2` | 4px |
| `--space-3` | 6px |
| `--space-4` | 8px |
| `--space-5` | 12px |
| `--space-6` | 14px |
| `--space-7` | 16px |
| `--space-8` | 20px |
| `--space-9` | 24px |
| `--space-10` | 28px |
| `--space-11` | 32px |
| `--space-12` | 36px |
| `--space-13` | 44px |

### 1.4 Radii (existing — keep as-is)

| Token | Value |
|---|---|
| `--radius-sm` | 6px |
| `--radius-md` | 10px |
| `--radius-lg` | 14px |
| `--radius-xl` | 20px |
| `--radius-full` | 9999px |

### 1.5 Shadows (existing — keep as-is)

| Token | Value | Use |
|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.06)` | Card resting |
| `--shadow-md` | `0 4px 16px rgba(0,0,0,0.08)` | Card hover, sticky header |
| `--shadow-lg` | `0 8px 32px rgba(0,0,0,0.12)` | Dropdown, toast |
| `--shadow-xl` | `0 20px 60px rgba(0,0,0,0.18)` | Modal, auth card |
| `--shadow-glow` | `0 0 30px rgba(26,138,66,0.15)` | Feature accent |

### 1.6 Transitions

| Token | Value | Use |
|---|---|---|
| `--transition` | `0.2s cubic-bezier(0.4, 0, 0.2, 1)` | Standard hover/focus |
| `--transition-slow` | `0.35s cubic-bezier(0.4, 0, 0.2, 1)` | Sidebar collapse, layout shifts |

---

## 2. Component Specs

### 2.1 Buttons

**Base `.btn`:** `padding: 10px 22px; border-radius: var(--radius-sm); font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; transition: all var(--transition);`

| Variant | Class | Bg | Color | Hover | Focus-visible |
|---|---|---|---|---|---|
| Primary | `.btn` | default (inherit) | — | `translateY(-1px)` | `outline: 2px solid var(--green-500); outline-offset: 2px` |
| Success | `.btn-success` | `linear-gradient(135deg, var(--green-500), var(--green-700))` | white | `translateY(-1px); box-shadow: 0 6px 20px rgba(26,138,66,0.35)` | same focus ring |
| Danger | `.btn-danger` | `linear-gradient(135deg, var(--red-600), #c62828)` | white | `translateY(-1px); box-shadow: 0 6px 20px rgba(220,53,69,0.3)` | same focus ring |
| Ghost | `.btn-cancel` | `rgba(255,255,255,0.12)` | white | `bg: rgba(255,255,255,0.2)` | same |
| Outline | `.btn-edit-inline` | `var(--neutral-50)` | `var(--green-700)` | `bg: var(--green-700); color: white` | same |
| Submit | `.btn-submit` | `linear-gradient(135deg, var(--green-500), var(--green-700))` | white | `translateY(-2px); box-shadow: 0 8px 28px rgba(17,92,46,0.35)` | same |
| PDF Print | `.btn-pdf` | `#dc2626` | white | `bg: #b91c1c; translateY(-1px)` | same |
| PDF Download | `.btn-pdf.btn-download` | `var(--green-700)` | white | `bg: var(--green-600)` | same |

**State machine for every `.btn`:**

| State | Indicators |
|---|---|
| Default | Base bg, cursor: pointer |
| Hover | translateY(-1px), shadow increase |
| Active | `translateY(0)` (snap back) |
| Focus-visible | `outline: 2px solid var(--green-500); outline-offset: 2px` |
| Disabled | `opacity: 0.5; cursor: not-allowed; pointer-events: none; transform: none !important; box-shadow: none !important` |
| Loading | Add class `.btn-loading`; set `aria-busy="true"`; replace icon with CSS spinner (14px, 2px border, white top border, `animation: spin 0.6s linear infinite`); keep button text; set `pointer-events: none` |

### 2.2 Forms

| Element | Spec |
|---|---|
| **Label** | `display: block; font-weight: 700; font-size: 12px; color: var(--neutral-600); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px` |
| **Required marker** | `::after { content: ' *'; color: var(--red-500); font-weight: 800 }` — append via `[required]` selector |
| **Input/Select** | `padding: 12px 14px; border: 2px solid var(--neutral-300); border-radius: var(--radius-md); font-size: 14px; background: var(--neutral-50); transition: all var(--transition)` |
| **Placeholder** | `color: var(--neutral-400)` |
| **Hover** | `border-color: var(--neutral-400)` |
| **Focus** | `border-color: var(--green-500); background: white; box-shadow: 0 0 0 3px rgba(26,138,66,0.1)` |
| **Error state** | `.form-group.has-error input` → `border-color: var(--red-500); box-shadow: 0 0 0 3px rgba(239,68,68,0.1)` — add `aria-invalid="true"` + `aria-describedby` pointing to error message element |
| **Error message** | `.form-error` → `font-size: 11px; color: var(--red-600); margin-top: 4px; font-weight: 600; display: none` — shown via `.has-error .form-error { display: block }` |
| **Success state** | `.form-group.has-success input` → `border-color: var(--green-500)` |
| **Inline validation** | Pattern: on blur, validate; on input, clear error class + `aria-invalid`. Always set `aria-describedby` for both error and helper text. |

### 2.3 Tables

| Spec | Value |
|---|---|
| **Container** | `.table-container { overflow-x: auto; -webkit-overflow-scrolling: touch }` — prevents horizontal page overflow |
| **Sticky thead** | `thead { position: sticky; top: 0; z-index: 2 }` — all data tables |
| **Row hover** | `tbody tr:hover td { background: var(--neutral-50) }` |
| **Even rows** | `tbody tr:nth-child(even) td { background: #fafcf9 }` |
| **Alignment** | Numeric cells: `text-align: center; font-weight: 700`. Name cells: `text-align: left`. Action cells: `text-align: right; white-space: nowrap` |
| **Min-widths** | `#studentRatingsTable: 940px`; `#raterListTable: 700px`; `.rubrics-container: 700px` (overridden to `0` at <=768px) |
| **Borders** | `border-bottom: 1px solid var(--neutral-100)` per `td`; footer/total row: `border-top: 2px solid var(--green-700)` |
| **Empty state** | `.no-data { display: none; text-align: center; padding: 56px 20px; color: var(--neutral-400); font-size: 16px; font-weight: 600 }` with `.no-data i { display: block; font-size: 52px; margin-bottom: 16px; opacity: 0.25 }` — toggled by `display: block` when table has no rows |

### 2.4 Cards

| Spec | Value |
|---|---|
| **Base** | `.card { background: white; border-radius: var(--radius-lg); box-shadow: var(--shadow-md); border: 1px solid var(--neutral-100); transition: all var(--transition) }` |
| **Hover** | `box-shadow: var(--shadow-lg)` |
| **Header** | `padding: 20px 28px; background: linear-gradient(135deg, var(--green-700), var(--green-600)); color: white; border-radius: var(--radius-lg) var(--radius-lg) 0 0; border-bottom: 2px solid var(--neutral-100)` |
| **Body** | `padding: 28px` (16px at <=768, 12px at <=480) |

### 2.5 Modals

| Spec | Value |
|---|---|
| **Overlay** | `position: fixed; inset: 0; z-index: 2000; background: rgba(0,0,0,0.55); backdrop-filter: blur(6px); justify-content: center; align-items: center` |
| **Content** | `background: white; border-radius: var(--radius-xl); max-height: 85vh; display: flex; flex-direction: column; box-shadow: 0 25px 60px rgba(0,0,0,0.25)` |
| **Sizes** | Default: `width: 480px; max-width: 92vw` (95vw at <=768, 98vw at <=480). Pending: `width: 90%; max-width: 640px; max-height: 80vh`. Detail: `width: 90%; max-width: 800px; max-height: 85vh` (95vw/98vw responsive). Developer: `width: 380px; max-width: 90vw` |
| **Close button** | `.modal-close { padding: 4px 8px; min-width: 44px; min-height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer }` — 44px hit area |
| **Animation** | Enter: `scaleIn 0.3s ease`; Exit: add `.modal-overlay.closing` → `animation: scaleOut 0.2s ease forwards` (new keyframe needed) |
| **Focus trap** | On open: focus first focusable element; Tab cycles within modal; Escape closes. On close: return focus to trigger. |
| **Body scroll lock** | When open: `document.body.style.overflow = 'hidden'`; restore on close |

### 2.6 Toasts

| Type | Class | Border-left | Icon bg | Duration |
|---|---|---|---|---|
| Success | `.toast-success` | `var(--green-500)` | `linear-gradient(135deg, var(--green-500), var(--green-700))` | 3800ms |
| Error | `.toast-error` | `var(--red-500)` | `linear-gradient(135deg, var(--red-500), #c62828)` | 5000ms |
| Warning | `.toast-warning` | `var(--amber-500)` | `linear-gradient(135deg, #f59e0b, #d97706)` | 4500ms |
| Info | `.toast-info` | `var(--blue-500)` | `linear-gradient(135deg, var(--blue-500), #1d4ed8)` | 4000ms |

**Common:** `position: fixed; bottom: 24px; right: 24px; z-index: 4000; width: min(400px, calc(100vw - 48px))`. Stacking: `flex-direction: column; gap: 10px`. Enter: `toastIn 0.3s`; Exit: `toastOut 0.25s forwards`. Progress bar at bottom: `height: 3px; animation: toastProgress var(--toast-duration) linear forwards`. Close button: `width: 30px; height: 30px`. At <=768: `left: 10px; right: 10px; bottom: 10px; width: auto`.

### 2.7 Badges / Pills

| Type | Style |
|---|---|
| Pending count | `.pending-count-badge { background: var(--amber-500); color: white; font-size: 11px; font-weight: 800; padding: 2px 10px; border-radius: var(--radius-full) }` |
| Score badge | `.score-badge { background: var(--green-50); color: var(--green-700); padding: 5px 16px; border-radius: var(--radius-full); font-weight: 800 }` |
| Role pill | `.profile-role-pill { background: var(--green-100); color: var(--green-700); font-size: 10px; font-weight: 700; letter-spacing: 1.5px; padding: 4px 14px; border-radius: var(--radius-full) }` |
| Status approved | `.status-approved { background: var(--green-100); color: var(--green-700) }` |
| Section badge | `.section-badge { background: rgba(255,255,255,0.15); color: white; padding: 5px 14px; border-radius: var(--radius-full) }` |
| Closed badge | `.closed-badge { background: rgba(220,53,69,0.25); color: #ff6b6b; padding: 5px 16px; border-radius: var(--radius-full); font-weight: 800; font-size: 12px }` |
| Own-group badge | `.own-group-badge { background: rgba(59,130,246,0.2); color: #93c5fd; padding: 5px 16px; border-radius: var(--radius-full); font-weight: 800 }` |
| Rate badge | `.rate-badge-inline { background: rgba(255,255,255,0.12); color: rgba(255,255,255,0.55); padding: 5px 16px; border-radius: var(--radius-full); font-size: 11px }` |

### 2.8 Search Inputs

`.search-input { padding: 10px 16px; border: 2px solid rgba(255,255,255,0.2); border-radius: var(--radius-sm); background: rgba(255,255,255,0.12); color: white; font-size: 13px; width: 260px; transition: all var(--transition) }` — used inside `.card-header` gradient background.

Focus: `border-color: rgba(255,255,255,0.5); background: rgba(255,255,255,0.18)`. Placeholder: `color: rgba(255,255,255,0.45)`.

### 2.9 Empty States

`.no-data { display: none; text-align: center; padding: 56px 20px; color: var(--neutral-400); font-size: 16px; font-weight: 600 }`. Icon: `.no-data i { display: block; font-size: 52px; margin-bottom: 16px; opacity: 0.25 }`. Toggled visible via JS `el.style.display = 'block'`. Existing pattern: icon (fa-inbox) + text string. Keep as-is.

### 2.10 Skeleton / Spinner Loading

| Type | Spec |
|---|---|
| **CSS spinner** | `.btn-loading::before { content: ''; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.6s linear infinite }` — new keyframe `@keyframes spin { to { transform: rotate(360deg) } }` |
| **Skeleton** | `.skeleton { background: linear-gradient(90deg, var(--neutral-200) 25%, var(--neutral-100) 50%, var(--neutral-200) 75%); background-size: 200% 100%; animation: shimmer 1.5s ease-in-out infinite; border-radius: var(--radius-sm) }` — shimmer keyframe already exists |
| **Loading dialog** | `.ui-dialog-icon-loading` uses `animation: pulse 1.2s ease-in-out infinite` on icon (existing) |

---

## 3. View-Level Layouts

### 3.1 Auth Screen

| Element | Layout |
|---|---|
| `.auth-bg` | `position: fixed; inset: 0; display: flex; justify-content: center; align-items: center; background: url('../images/place.jpg') center/cover; z-index: 1000` |
| `.auth-card` | `width: 420px; max-width: 92vw; padding: 44px 38px; border-radius: var(--radius-xl); animation: scaleIn 0.4s ease` |
| **<=480** | `padding: 28px 20px; max-width: 95vw; border-radius: var(--radius-lg); max-height: calc(100vh - 32px); overflow-y: auto` |
| **<=375** | `padding: 20px 14px` |
| **Overflow rule** | Auth card never exceeds viewport width; `max-width: 92vw/95vw` prevents horizontal overflow. |

### 3.2 Instructor Dashboard

| Element | Layout | Breakpoints |
|---|---|---|
| `.dashboard` | `display: flex; min-height: 100vh` | — |
| `.sidebar` | `width: 260px; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100` | <=768: `transform: translateX(-100%); width: 280px; z-index: 100`. `.open`: `translateX(0)`. `.collapsed` -> width 280px + translateX(-100%). |
| `.main-content` | `flex: 1; margin-left: 260px` | <=768: `margin-left: 0 !important`. Collapsed: `margin-left: 64px`. |
| `.main-header` | `position: sticky; top: 0; z-index: 50; padding: 16px 32px; background: white; border-bottom: 2px solid var(--neutral-100)` | <=768: 12px 14px. <=480: 10px 12px. |
| `.profile-hero` | `margin-bottom: 24px; border-radius: var(--radius-lg); overflow: hidden` | <=768: header goes column. <=480: detail row goes single-column with absolute edit btn. |
| `.card` (content) | `margin-bottom: 0` (within `.content-section`) | Padding: 32px -> 16px (768) -> 12px (480) -> 8px (375) |
| `.admin-group-card` | Stack vertically, `margin-bottom: 12px`. First: `radius-lg radius-lg radius-md radius-md`. Last: `radius-md radius-md radius-lg radius-lg`. | All <=768: `radius-md` |
| Sidebar overlay | `.sidebar-overlay` z-index: 99, `rgba(0,0,0,0.5)`, `backdrop-filter: blur(4px)`. `.show`: `display: block`. | |

**Group Results admin cards layout:** Flexbox column, each card has `.admin-card-header` (flex between, 4px left green bar via ::before), `.admin-card-body` (member inputs in 2-col grid -> 1-col at <=768).

### 3.3 Student Dashboard

| Element | Layout | Breakpoints |
|---|---|---|
| `.student-dashboard` | `min-height: 100vh; background: linear-gradient(160deg, var(--green-900), var(--green-700) 45%, var(--green-600))` | — |
| `.student-header` | `display: flex; justify-content: space-between; padding: 14px 36px; background: rgba(0,0,0,0.25); position: sticky; top: 0; z-index: 50; backdrop-filter: blur(10px)` | <=768: 12px 14px, flex-wrap. <=480: 10px 12px, profile name hidden. |
| `.student-content` | `padding: 36px; max-width: 1400px; margin: 0 auto` | <=1024: 24px. <=900: 20px. <=768: 14px. <=480: 10px. <=375: inherited. |
| `.student-groups-grid` | `display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px` | <=1200: 4-col. <=1024: 3-col. <=900: 2-col. <=768: 1-col. <=480: gap 10px. |
| `.rubric table` (card layout <=768) | Table becomes block: thead hidden, each `tr` becomes a card with `border-radius: var(--radius-md); margin-bottom: 12px; border: 1px solid var(--neutral-100)`. First `td.criteria-name` gets green gradient header. `tfoot` becomes centered flex pill. | |
| **No-overflow rule** | `.rubrics-wrapper { overflow-x: auto }`, `.rubrics-container { min-width: 700px }` on desktop; `min-width: 0; width: 100%` at <=768. Student content never exceeds viewport. | |

### 3.4 320px Floor (min-width-safe extension)

Plan breakpoints (1200/1024/900/768/480/375) are retained as `max-width` overrides; 320px is a **floor** — the rules below extend the existing stack without changing behavior at larger widths.

| Rule | Spec |
|---|---|
| **Fluid layout** | All sizing is `max-width`-based; no fixed width exceeds 100vw. Flex/grid children use `min-width: 0` so content can shrink to the 320px viewport without page overflow. |
| **Min font sizes** | Floor at `text-xs` (10px) / `text-base` (13px) — never below 10px at <=320. Uppercase labels stay 11px; §1.2 scale holds. |
| **Modal sizing** | `max-width: 98vw` (same as <=480) holds down to the 320px floor; `max-height: 85vh` with internal `overflow-y: auto`. |
| **Touch targets** | `min-height: 44px` / `min-width: 44px` on all interactive elements at <=480, carried through to 320px (see §2.5 close button). |
| **No horizontal page overflow** | `.table-container` / `.rubrics-wrapper` scroll internally; `.rubrics-container` keeps `min-width: 0; width: 100%` at <=768 (incl. 320px); `html/body` never exceeds the viewport at 320px. |

---

## 4. Interaction & UX States

### 4.1 Async Action State Machine

```
IDLE ──[user action]──> LOADING ──[success]──> SUCCESS (toast, auto-dismiss)
                   │                    └──[error]──> ERROR (inline + toast)
                   └──[cancelled]──> IDLE
```

| Phase | UI Changes |
|---|---|
| **Idle** | Button enabled, form fields enabled |
| **Loading** | Button: `.btn-loading` class, `aria-busy="true"`, `pointer-events: none`. Form inputs: `disabled`. Modal actions: disabled. Optional: `showLoadingDialog()` for long operations. |
| **Success** | Toast: `showToast(message, 'success')` (green, 3800ms). If form: reset fields, clear error states. If modal action: close modal, return focus to trigger. |
| **Error** | Toast: `showToast(message, 'error')` (red, 5000ms). Inline: add `.has-error` to relevant `.form-group`, set `aria-invalid="true"`, populate `.form-error` text, set `aria-describedby` to error element ID. |

### 4.2 Confirmation Dialogs (Destructive Actions)

| Action | Dialog |
|---|---|
| Reset all ratings | `showConfirmDialog({ title: 'RESET ALL RATINGS', message: 'This will permanently delete ALL ratings...', icon: 'fas fa-exclamation-triangle', iconClass: 'ui-dialog-icon-warning', confirmLabel: 'Confirm Reset', cancelLabel: 'Cancel' })` — requires type-to-confirm (instructor name) before enabling confirm button |
| Delete student entry | `showConfirmDialog({ title: 'DELETE STUDENT', icon: 'fas fa-trash', iconClass: 'ui-dialog-icon-error', confirmLabel: 'Delete', cancelLabel: 'Cancel' })` |
| Approve/reject pending | `showConfirmDialog({ title: 'APPROVE ACCOUNT', icon: 'fas fa-check', iconClass: 'ui-dialog-icon-success', ... })` |

### 4.3 Focus Management

| Context | Behavior |
|---|---|
| Modal open | Focus moves to first focusable inside modal (close btn or first input) |
| Modal close | Focus returns to trigger element that opened the modal |
| Dropdown open | Focus stays on trigger; Escape closes and returns focus |
| Sidebar mobile | On open, focus moves to first nav-link; Escape closes sidebar overlay |
| Toast | No focus trap; toast close button is focusable; auto-dismiss does not steal focus |
| Tab order | Logical: sidebar nav -> main content -> cards -> tables -> modals |

### 4.4 Keyboard Behavior

| Key | Context | Action |
|---|---|---|
| `Tab` | Everywhere | Standard forward tab order |
| `Shift+Tab` | Everywhere | Reverse tab order |
| `Escape` | Modal overlay | Close modal, return focus |
| `Escape` | Dropdown menu | Close dropdown, return focus to trigger |
| `Escape` | Sidebar (mobile) | Close sidebar, remove overlay |
| `Enter` | Buttons | Activate button action |
| `Enter` | Modal confirm btn | Activate confirm |
| `Space` | Radio labels | Select radio (native) |

### 4.5 Reduced Motion

Already handled via `@media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; } }`. No changes needed.

---

## 5. Accessibility Checklist (AC#14)

| Criterion | Implementation |
|---|---|
| **Labels** | Every `<input>`, `<select>`, `<textarea>` has associated `<label for="id">`. Required fields get `[required]` attribute + CSS `*` marker. |
| **Contrast >= 4.5:1** | All token pairs verified in §1.1. Body text `--neutral-900` on `--neutral-50` = 15.0:1. Primary `--green-700` on `--white` = 8.1:1. Danger `--red-600` on `--white` = 4.8:1. |
| **Focus-visible** | Global rule: `.btn:focus-visible, .modal-close:focus-visible, .toast-close:focus-visible, .profile-edit-btn:focus-visible { outline: 2px solid var(--green-500); outline-offset: 2px }`. Expand to all interactive elements. |
| **ARIA roles** | Modals: `role="dialog" aria-modal="true" aria-labelledby` (already present on pendingModal, resetModal, studentDetailModal, developerModal). Add `role="alertdialog"` to confirm/reset dialogs. Toast container: `aria-live="polite" aria-atomic="false"` (present). |
| **Semantic HTML** | Use `<nav>` for sidebar nav (add if missing). `<main>` wrapping `.main-content`. `<header>` for `.main-header` and `.student-header`. `<aside>` for sidebar (present). `<form>` wrapping all form groups (present). |
| **Non-color indicators** | Status indicators use icon + text, not color alone. Rater voted/missed: icon (check/x) + text. Closed groups: badge with lock icon + "CLOSED" text. |
| **Keyboard operability** | All interactive elements reachable via Tab. No keyboard traps. Modal focus trap. |
| **Screen reader** | `.no-data` has visible text. Icon-only buttons need `aria-label` (e.g., `.modal-close` gets `aria-label="Close dialog"`). |

---

## 6. Consistency Audit Targets

| Issue | Location | Standardized Replacement |
|---|---|---|
| **33 inline `style=` attributes** in index.html | Lines 46,58,73,82,103,187,208,217,227,229-231,234,239,241-243,250,269,293,325-329,331,351-352,354,369,386,394,403 | Replace with CSS classes: `.u-hidden` for `display:none`, `.u-text-upper` for `text-transform:uppercase`, `.u-full` for `width:100%`, `.modal-header--danger` for red header, `.btn--neutral` for gray cancel, `.btn--danger-gradient` for red confirm, `.toolbar-actions` for flex containers, `.modal-actions--end` for flex-end, `.section-number-input` for width:100px |
| **Mixed button gradients** | `.btn-success`, `.btn-danger`, `.btn-rate`, `.btn-rate-card`, `.btn-submit` all use gradient but with different syntax | Standardize: all use `linear-gradient(135deg, primary-start, primary-end)`. No hardcoded hex in gradient calls — reference tokens. |
| **Hardcoded colors** in index.html styles | `#dc2626`, `#b91c1c`, `#333`, `#e2e8f0`, `rgba(255,255,255,0.6)` in inline styles (lines 229-243) | Move to CSS classes using existing tokens: `--red-600`, `--red-500`, `--neutral-700`, `--neutral-200` |
| **Font-family references** | `--font-display` (Bebas Neue) used for card headers, section titles, modal titles, group names, profile names, auth title, total score | Demote: keep for large display headings (auth title, sidebar h2, section title, student title, modal h3, group card name, profile name-display, total-score). Remove from smaller contexts: card header h3 -> switch to `--font-body` with `font-weight: 800; font-size: 16px; letter-spacing: 1px` |
| **Inconsistent button sizing** | Criteria/section "Add"/"Save" buttons use inline `style="padding:4px 10px;font-size:11px;"` | Create `.btn-sm` class: `padding: 4px 10px; font-size: 11px; min-height: 28px` |
| **Reset modal header gradient** | Hardcoded `linear-gradient(135deg,#dc2626,#b91c1c)` in inline style | Create `.modal-header--danger { background: linear-gradient(135deg, var(--red-600), #b91c1c) }` |
| **Cancel button in reset modal** | Hardcoded `background:#e2e8f0;color:#333` in inline style | Create `.btn--neutral { background: var(--neutral-200); color: var(--neutral-700) }` |
| **Confirm button in reset modal** | Hardcoded gradient + white color in inline style | Use `.btn-danger` class already defined |
| **Modal overlay z-index** | Standard modals: 2000. UI dialogs: 2500. Toasts: 4000. Dev FAB: 1500. Sidebar: 100. | Document z-index scale: sidebar=100, sidebar-overlay=99, header=50, FAB=1500, modal=2000, dialog=2500, toast=4000. Keep as-is, add comments. |
| **Profile edit btn** | Missing `aria-label` for screen readers on `.profile-edit-btn` (already has on `#usernameRow` and `#passwordRow` buttons, but style not consistent) | Ensure all `.profile-edit-btn` elements have `aria-label` attribute in HTML |
| **Touch targets at 480px** | Currently patched with separate rules per button type | Consolidate into single `.u-touch-target` at <=480: `min-height: 44px; padding: 10px 16px` — or use existing consolidated rule already at line 2472 |

---

## 7. New CSS Classes Summary

| Class | Purpose |
|---|---|
| `.u-hidden` | `display: none !important` — replaces all inline `style="display:none;"` |
| `.u-text-upper` | `text-transform: uppercase` — replaces inline style |
| `.u-full` | `width: 100%` — replaces inline width |
| `.u-flex-end` | `display: flex; justify-content: flex-end; gap: 10px` — replaces inline layout |
| `.btn-sm` | Small button variant — replaces inline padding/font overrides |
| `.btn--neutral` | Gray cancel button — replaces inline hardcoded colors |
| `.modal-header--danger` | Red gradient header — replaces inline style |
| `.modal-actions--end` | Flex-end action row — replaces inline layout |
| `.section-number-input` | `width: 100%; max-width: 100px` — replaces inline width on number input |
| `.form-group.has-error` | Error state on form group |
| `.form-error` | Error message text |
| `.form-group.has-success` | Success state |
| `.btn-loading` | Loading state with spinner |
| `.skeleton` | Skeleton loading placeholder |
| `[required]` | CSS `::after` asterisk marker |

---

## 8. New Keyframes Required

| Name | Definition |
|---|---|
| `@keyframes spin` | `to { transform: rotate(360deg) }` — button loading spinner |
| `@keyframes scaleOut` | `from { opacity: 1; transform: scale(1) } to { opacity: 0; transform: scale(0.94) }` — modal exit |

---

## 9. Z-Index Scale (Documented)

| Layer | z-index |
|---|---|
| Sidebar overlay | 99 |
| Sidebar | 100 |
| Main header | 50 |
| Student header | 50 |
| Dev FAB | 1500 |
| Modal overlay | 2000 |
| UI Dialog overlay | 2500 |
| Toast container | 4000 |
| Auth container | 1000 |

---

## 10. Verification Checklist

- [ ] All 33 inline `style=` attributes replaced with CSS classes
- [ ] All new CSS classes added to styles.css with clear section comments
- [ ] Cache-bust: `styles.css?v=10`, `script.js?v=30`. `firebase-init.js` (keep `?v=2`) and `firestore-api.js` (keep `?v=6`) are out of scope — untouched.
- [ ] No `Bebs Neue` in button text, form labels, or small UI text
- [ ] `.btn-loading` + `@keyframes spin` works on all button variants
- [ ] Modal focus trap: Tab cycles within, Escape closes, focus returns to trigger
- [ ] `.no-data` empty states visible when tables are empty
- [ ] Toast stacking works (multiple toasts stack vertically)
- [ ] All touch targets >= 44px at <=480px breakpoint (incl. 320px floor)
- [ ] `prefers-reduced-motion` disables all animations
- [ ] All ARIA attributes present: `aria-modal`, `aria-labelledby`, `aria-invalid`, `aria-describedby`, `aria-busy`, `aria-label` on icon buttons
- [ ] No horizontal overflow at any breakpoint (320px, 375px, 480px, 768px, 1024px, 1280px)
- [ ] Sidebar drawer works at <=768px with overlay
- [ ] Rubric table card layout works at <=768px
