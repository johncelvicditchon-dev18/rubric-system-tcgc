# Reporting Rubrics System (TCGC)

Instructor-managed rubric scoring with student self/peer rating for classroom presentations.

## Features

- **Role-based auth** -- Instructor accounts with pending-approval workflow; students log in by section + rater name (no password).
- **Instructor dashboard** -- Student ratings table with search, rater list, group results with member management, rubric criteria management (add/edit/delete/reorder), sections management, account profile editing, pending-account approval, danger-zone reset.
- **Student rating flow** -- Group grid selection, rubric radio-grid scoring (1-4 per criterion), submit with confirmation; locked groups display read-only mode.
- **PDF exports** -- Print and download PDF for student ratings and rater lists via jsPDF.
- **Professional UI system** -- Toast notifications, custom alert/confirm/loading dialogs, inline field validation, button loading states, empty states, loading spinners.
- **Fully responsive** -- Tested at 320/375/480/768/900/1024/1200/1280/1440/1920 px; sidebar drawer on mobile, stacked cards, horizontal-scroll tables.
- **Accessibility** -- ARIA roles/labels on modals, `aria-invalid`/`aria-describedby` on validated fields, `aria-busy` on loading buttons, `focus-visible` outlines, `prefers-reduced-motion` support, keyboard focus traps in modals, Escape to dismiss.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS single-page application (no build step, no framework) |
| Database | Firebase Cloud Firestore |
| Security | `firestore.rules` (deploy to Firebase) |
| PDF | jsPDF 4.2.1 (CDN) |
| Icons | Font Awesome 6.5.1 (CDN) |
| Fonts | Google Fonts -- Inter (body) + Bebas Neue (display) |
| Hosting | Firebase Hosting / Vercel static deploy |

## Getting Started

```bash
# Clone
git clone https://github.com/johncelvicditchon-dev18/rubric-system-tcgc.git
cd rubric-system-tcgc

# Option A -- open directly
# Just open index.html in a browser (may need a local server for Firestore)

# Option B -- local static server
npx serve .
# or
npx http-server .
```

**Firebase configuration** lives in `assets/js/firebase-init.js`. Replace the placeholder values with your own Firebase project credentials before running.

**Firestore rules** in `firestore.rules` must be deployed to your Firebase project for the security rules to take effect:

```bash
firebase deploy --only firestore:rules
```

**Vercel deploy** -- Connect the GitHub repo to Vercel as a static site. No build command needed; output directory is the repo root.

## Project Structure

```
index.html                         # Single HTML entry point (all views)
assets/
  css/
    styles.css                     # Design tokens, components, responsive (2916 lines)
  js/
    firebase-init.js               # Firebase config + initialization (11 lines)
    firestore-api.js               # Data layer -- Firestore CRUD via Api.* (631 lines)
    script.js                      # UI logic, presentational flows (2476 lines)
  images/                          # Logo, developer avatar
firestore.rules                     # Firestore security rules
docs/
  plans/                           # Implementation plans (ui-ux-overhaul, responsive-ui, etc.)
  design/                          # Design contracts (ui-ux-overhaul-contract.md)
```

## UI/UX Design System

The recent overhaul established a token-based design system across `styles.css` and `script.js`, keeping all business logic untouched.

**Key conventions:**

| Convention | Detail |
|-----------|--------|
| **Design tokens** | All colors, spacing, radii, shadows, typography defined as CSS custom properties in `:root` (e.g., `--green-700`, `--space-5`, `--radius-md`, `--shadow-lg`). Use `var(--token)` everywhere -- no hardcoded values. |
| **Button system** | Base `.btn` class + modifiers: `.btn-success`, `.btn-danger`, `.btn-rate`, `.btn-back`, `.btn-cancel`, etc. `.btn-loading` adds a CSS spinner and sets `aria-busy="true"`. 44 px min touch target. |
| **Inline validation** | `setFieldError(input, message)` adds `.has-error`, `aria-invalid="true"`, and `aria-describedby` pointing to a `.form-error` span. `clearFieldError(input)` removes them on input. No native `:invalid` reliance. |
| **Toasts** | `showToast(message, type, duration)` -- types: success/error/warning/info/loading. Stacks up to 5, auto-dismiss with progress bar, pause on hover. No native `alert()`. |
| **Dialogs** | `showAlertDialog({title, message, type})`, `showConfirmDialog({title, message, type, danger})`, `showLoadingDialog(message)` -- all return Promises, use focus trap + Escape to dismiss. No native `confirm()`. |
| **Modal overlays** | `openModalOverlay(el, focusSelector)` / `closeModalOverlay(el)` -- manages `display:flex`, focus trap, exit animation (`closing` class), respects `prefers-reduced-motion`. |
| **Reduced motion** | `@media (prefers-reduced-motion: reduce)` at end of `styles.css` kills all animations/transitions; JS checks `window.matchMedia('(prefers-reduced-motion: reduce)')` before animation delays. |
| **Cache-bust** | Asset URLs use `?v=N` convention. Current versions: `styles.css?v=10`, `script.js?v=30`. Bump on every deploy-affecting change. |

## Roles & Usage Flows

- **Instructor login/signup** -- Sign up with full name + username + password; account enters pending status. An approved instructor approves it from Account > Pending Accounts. Approved instructors log in with username + password.
- **Student login** -- Select section from dropdown, enter rater name (e.g., `DELA CRUZ, JUAN C.`). No password required. Students see only their section's groups.
- **Rating flow** -- Students select a group from the grid, rate each rubric criterion via radio buttons (1-4), see running total, submit. Locked groups show read-only view of previous rating.
- **PDF exports** -- Instructors can print or download PDF for Student Ratings and Rater List views (requires jsPDF loaded from CDN).

## Development Notes

- **Keep layers separated** -- `script.js` handles UI/presentational logic; `firestore-api.js` handles all Firestore data operations via the `Api.*` interface. Do not mix business logic into presentational functions.
- **Do not change `firestore-api.js` or `firestore.rules` casually** -- These affect data contracts and security. Coordinate changes with the data/API layer owner.
- **Responsive verification** -- After any CSS change, verify layout at: 320 px, 480 px, 768 px, 1024 px, 1280 px, and 1440 px. Check sidebar drawer, table scroll, form stacking, modal sizing, and touch targets (min 44 px).
- **Accessibility audit** -- Ensure all interactive elements have visible `focus-visible` outlines, all modals have proper ARIA attributes, and all form errors use the `setFieldError`/`clearFieldError` pattern.
