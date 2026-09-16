# Auth Inline Error Spacing — Visual Contract

**Status:** Ready for implementation
**Parent Plan:** `docs/plans/auth-inline-errors.md` (commit fca6b40)
**Scope:** `assets/css/styles.css` — auth card block only (lines 183–298)
**Type:** Follow-up polish — no code edits here; implementor applies in `.css` only

---

## 1. Problem Statement

Screenshot confirms three spacing defects in auth forms (signup shown):

1. **Error-to-next-label jam** — "Full name is required" overlaps the `USERNAME *` label below it. Root cause: `.auth-card .form-error` uses `position: absolute; top: 100%`, removing it from document flow. The parent `.form-group`'s `margin-bottom: 16px` doesn't expand to accommodate the error text height.

2. **Stacked error clutter** — When multiple fields error simultaneously, error text lines stack tightly against each other's labels with no visual breathing room.

3. **Last-error-to-button jam** — "Password is required" sits immediately above the green submit button. The button's `margin-top: 8px` is measured from the form-group's non-error box height, not the error text's bottom edge.

---

## 2. Root Cause (CSS)

| Selector | Current Value | Issue |
|---|---|---|
| `.auth-card .form-error` | `position: absolute; top: 100%; left: 0; margin-top: 4px;` | Error is out of flow — no space reserved in parent |
| `.auth-card .form-group` | `margin-bottom: 16px;` | Fixed — doesn't grow when error appears |
| `.auth-card .btn` | `margin-top: 8px;` | Fixed — too tight when last field has error |

---

## 3. Design Decisions

### 3.1 Flow Layout (Replace Absolute)

**Decision:** Switch `.auth-card .form-error` from `position: absolute` to `position: static` (in-flow).

**Rationale:** In-flow errors naturally push subsequent elements down, eliminating overlap. This is the standard pattern used by the global `.form-error` (lines 2092–2098) already. The auth-specific override was likely a copy-paste artifact.

### 3.2 Error-Conditional Form-Group Spacing

**Decision:** Use `.has-error` state to increase `.form-group` bottom margin, reserving space for the error text.

**Token mapping:**

| State | `margin-bottom` | Rationale |
|---|---|---|
| Normal (no error) | `16px` (`--space-7`) | Baseline — unchanged |
| `.has-error` | `22px` (custom) | Error line height (~14px) + 8px breathing room below |

This ensures the error text and the next field's label never collide.

### 3.3 Error Text Typography

**Decision:** Retain current `font-size: 11px; color: var(--red-600); font-weight: 600;` but add `line-height: 1.4` for consistent vertical rhythm.

| Property | Value | Rationale |
|---|---|---|
| `font-size` | `11px` | Matches existing — compact for card context |
| `font-weight` | `600` | Bold enough to read, not shouting |
| `color` | `var(--red-600)` | `#dc2626` — 4.8:1 contrast on white (AA pass) |
| `line-height` | `1.4` | Prevents descenders clipping at tight sizes |
| `margin-top` | `4px` | Gap between input bottom-border and error text top |

### 3.4 Last-Error-to-Button Gap

**Decision:** Target the button's top margin when the immediately preceding form-group has `.has-error`.

**Approach:** Since `.btn` is a sibling of `.form-group` (not a child), use the form-group's expanded bottom margin. With the error-conditional margin at `22px`, the button inherits that gap. Additionally, increase the base `.auth-card .btn` `margin-top` from `8px` to `12px` for comfortable breathing even in the no-error case.

| Selector | `margin-top` | Rationale |
|---|---|---|
| `.auth-card .btn` (base) | `12px` (`--space-5`) | Comfortable default gap |
| `.auth-card .form-group.has-error` (last before btn) | `22px` | Error text + 8px clear before button |

Net visual result: minimum `22px` between error text bottom and button top edge.

### 3.5 Stacked Errors Consistency

**Decision:** When multiple `.has-error` form-groups are stacked, the `22px` margin-bottom on each ensures uniform spacing: `[error text] → 22px gap → [next label] → 6px → [input] → [error text] → 22px gap → ...`.

No special `:has()` or `+` sibling selector needed — the per-group margin handles it.

---

## 4. Vertical Rhythm Tokens (Auth Card)

All values reference the existing spacing scale where possible:

| Token | Value | CSS Variable | Use |
|---|---|---|---|
| `form-gap` | `16px` | `--space-7` | `.form-group` base `margin-bottom` |
| `form-gap-error` | `22px` | custom (no new token needed) | `.form-group.has-error` `margin-bottom` |
| `error-gap-top` | `4px` | — | `.form-error` `margin-top` (below input) |
| `error-line-height` | `1.4` | — | `.form-error` `line-height` |
| `btn-gap` | `12px` | `--space-5` | `.auth-card .btn` `margin-top` (base) |
| `label-gap` | `6px` | — | `.auth-card label` `margin-bottom` (unchanged) |

**Vertical rhythm diagram (no error):**
```
[Input]  ← 13px padding
[6px label gap]
[LABEL]
[16px form-group gap]
[Input]
...
[12px btn gap]
[BUTTON]
```

**Vertical rhythm diagram (with error):**
```
[Input]  ← 13px padding
[4px error gap]
[ERROR TEXT — 11px, line-height 1.4 ≈ 15.4px]
[22px form-group gap (error-conditional)]
[LABEL — next field]
[6px label gap]
[Input]
...
[12px btn gap]
[BUTTON]
```

---

## 5. CSS Changes Required (Scope: styles.css lines 183–298)

### 5.1 `.auth-card .form-error` (currently line 190)

**Remove:**
```css
position: absolute;
top: 100%;
left: 0;
```

**Add:**
```css
line-height: 1.4;
```

**Keep unchanged:**
```css
margin-top: 4px;
font-size: 11px;
color: var(--red-600);
display: block;
```

### 5.2 `.auth-card .form-group` (currently line 183)

**Keep unchanged:**
```css
margin-bottom: 16px;
position: relative;
```

### 5.3 Add new rule `.auth-card .form-group.has-error`

**New:**
```css
.auth-card .form-group.has-error {
  margin-bottom: 22px;
  border-color: var(--red-600);   /* already exists on line 188 — merge */
}
```

### 5.4 `.auth-card .btn` (currently line 279)

**Change:**
```css
margin-top: 8px;   →   margin-top: 12px;
```

### 5.5 No other selectors touched

The global `.form-error` (line 2092) and `.form-group.has-error .form-error` (line 2099) remain untouched — they serve dashboard forms and have their own flow-based pattern already.

---

## 6. Responsive Considerations

### 6.1 Breakpoint `@media (max-width: 480px)`

No auth-specific changes needed. The error conditional `margin-bottom: 22px` scales well on mobile. The `auth-card` already gets `max-height: calc(100vh - 32px); overflow-y: auto;` at this breakpoint (line 3059–3062), so vertically expanded error states scroll naturally within the card.

### 6.2 Breakpoint `@media (max-width: 375px)`

Auth card padding reduces to `20px 14px` (line 3075). Error text remains readable at `11px` — no adjustment needed. The card's `overflow-y: auto` inherited from the 480px rule handles any overflow.

### 6.3 Short Viewports (< 600px height)

The `max-height: calc(100vh - 32px)` on `.auth-card` at ≤480px ensures the card scrolls when errors push content past the viewport. No additional handling required.

---

## 7. Accessibility Notes

### 7.1 ARIA Attributes (Already Correct)

Per the parent plan (commit fca6b40), inline errors already use:
- `aria-invalid="true"` on errored `<input>`
- `aria-describedby="err_<fieldId>"` pointing to the error `<span>`
- Error `<span>` has `id="err_<fieldId>"` and class `.form-error`

**No ARIA changes needed.** Switching from absolute to in-flow does not affect ARIA semantics.

### 7.2 Screen Reader Impact

In-flow error text is naturally part of the DOM order. Screen readers encounter it in the correct sequence: `[label] → [input] → [error text]`. This is actually *better* than absolute positioning, which can sometimes cause the error to be announced out of visual order in certain AT combinations.

### 7.3 Focus Management

No changes. Error display is passive (no focus shift). The existing `bindInlineErrorClearing()` handles clear-on-input.

### 7.4 Color Contrast

`--red-600` (#dc2626) on `--white` = 4.8:1 ratio. Passes WCAG AA (4.5:1 minimum for normal text). The `font-weight: 600` further improves legibility.

### 7.5 Reduced Motion

Error appearance is not animated (no `transition` on `.form-error`). Compliant with `prefers-reduced-motion: reduce`. If a fade-in is ever added, it should respect this media query.

---

## 8. Verification Checklist

| # | Check | Pass Criteria |
|---|---|---|
| V1 | Single error — no overlap | Error text sits below input border with 4px gap; next label sits below error text with 22px gap |
| V2 | Three errors stacked | Consistent 22px gap between each error-to-next-label; no overlap anywhere |
| V3 | Last error + button | Minimum 22px between "Password is required" text bottom and LOGIN/SIGN UP button top |
| V4 | No errors — baseline | Form looks identical to pre-patch; 16px gaps between groups, 12px before button |
| V5 | Mobile ≤480px | Errors readable, card scrolls if needed, no horizontal overflow |
| V6 | Mobile ≤375px | Same as V5 at tighter padding |
| V7 | Screen reader (VoiceOver/NVDA) | Error announced after input, in correct tab order |
| V8 | `prefers-reduced-motion` | No animation on error appearance (current state — no change) |
| V9 | Clear-on-type | Type in errored field → error disappears, spacing collapses back to 16px smoothly |

---

## 9. Files Touched

| File | Change | Lines |
|---|---|---|
| `assets/css/styles.css` | Remove absolute from `.auth-card .form-error`, add `line-height`, add `.has-error` margin override, bump `.btn` margin-top | ~183–198, ~279–284 |

**Total delta:** ~8–12 lines modified/added. No new files.

---

## 10. Handoff

| Field | Value |
|---|---|
| **Status** | Ready for implementation |
| **Scope** | CSS only — `assets/css/styles.css` auth block |
| **Dependencies** | Parent plan (auth-inline-errors) already committed at fca6b40 |
| **Risk** | Low — CSS-only, no logic, no ARIA changes |
| **Estimated effort** | 10 minutes |
| **Recommended next action** | Implementor applies 5.1–5.4 changes, runs V1–V9 verification |
