# Intuition Visual Identity — Design System — Design

**Date:** 2026-06-20
**Status:** Approved scope (brainstorm session 2026-06-20)
**Repo:** Intuition (VS Code fork), branch `course-tab-shell` (new work branches from here)
**References:**
- Landing page (brand source of truth): `../../../../infinitas-landing-page/`
  — `app/globals.css` (tokens + gradient utilities), `lib/shader-palette.ts`,
  `components/shader-canvas.tsx`, `DESIGN_SPEC.md`.
- Live site: https://infinitas-landing-page.vercel.app/
- Defaults overlay pattern: `2026-06-10-barebones-layout-design.md`.
- Companion mockups: `.superpowers/brainstorm/1609-1781936274/content/`.

## Context — this is sub-project 1 of a program

"Redesign the whole UI from the ground up" is a **program**, not one spec. It
decomposes into: **(1) visual identity / design system** (this spec),
**(2) the teaching re-layout** — companion rail by default + an expandable
"full-learn" mode (its own spec), **(3) the code-led knowledge graph** (already
parked as future work in `2026-06-10-course-tab-shell-design.md`), and
**(4) other surfaces** (welcome, settings, status bar). We do the visual
identity **first** because it pulls every other surface; the teaching re-layout
then lands on a settled look.

This is a **tier-2 re-layout** effort overall (keep VS Code's engine; reshape
surfaces and identity) — never a from-scratch workbench rewrite, which would
fight the pinned-fork strategy.

## Goal

A single, owned design system for the Intuition fork, faithful to the landing
page: neutral-grayscale base, a rare iris·violet·cyan spectrum accent, the
animated "shimmer" line + word gradient, Inter + IBM Plex Mono type, in **dark
and light** (equal priority). Delivered as (a) an Intuition color theme, (b) a
bundled-font + brand-CSS layer, and (c) default-settings wiring — all in
Intuition-owned locations with a tiny upstream merge surface.

## Locked decisions (from the brainstorm)

1. **Both themes, equal priority** — dark and light shipped/polished together.
   Dark remains the conceptual primary (it's the landing default).
2. **IBM Plex Mono is the default editor font** (`editor.fontFamily`), a
   default not a lock — users override freely.
3. **Maximum gradient restraint — "mark & line only."** In IDE chrome the
   spectrum appears *only* on: the title-bar top **streak line**, the Intuition
   **mark**, and the **active teaching/course icon**. The clipped-word gradient
   (`.text-spectrum`) is reserved for **marquee brand moments** (welcome/start
   headline, full-learn mode title) — it does **not** decorate lesson chrome or
   ordinary headings.

## The design language

### Color tokens (exact, from `globals.css`)

Two complete sets. Hue lives only in the accent group; backgrounds, borders, and
muted surfaces carry **no tint** (the spec's "everything is purple" fix).

| Token | Dark | Light |
|---|---|---|
| `background` | `#0a0a0b` | `#fbfbfb` |
| `surface` / `card` | `#121214` | `#ffffff` |
| raised chrome (sidebars/bars) | `#0c0c0e` | `#f3f3f4` |
| `foreground` | `#f6f6f7` | `#0a0a0a` |
| `muted` | `#161618` | `#f3f3f4` |
| `muted-foreground` | `#8a8a92` | `#6e6e73` |
| `border` | `#242427` | `#e6e6e8` |
| `iris` (signature accent) | `#ee45e0` | `#c81fd1` |
| `iris-foreground` | `#0a0a0b` | `#ffffff` |
| `violet` | `#9a6bff` | `#6d3cff` |
| `cyan` | `#34e7ff` | `#0a93c2` |
| `lime` | `#b6ff3d` | `#6f9e00` |
| `glow` | `color-mix(iris 34%)` | `color-mix(iris 20%)` |
| `grid-line` | `foreground 6%` | `foreground 5%` |

- **`iris` is the single flat accent** in the theme: focus border, primary
  button, progress bar, active-selection tint, badges, the caret.
- **violet / cyan / lime are functional, not decorative**: syntax highlighting
  (keywords = violet, functions = cyan, strings = lime, comments = muted-fg) and
  course-state semantics (active/next), never chrome decoration.

### Typography

- **Inter** — UI/brand. Display headings at ExtraLight (200) / Light (300),
  **lowercase**, tight tracking (-0.03em headings, -0.045em hero). Body/labels
  at Regular (400) / Medium (500). Global letter-spacing -0.011em.
- **IBM Plex Mono** — code, eyebrows, labels, small print. Always lowercase,
  tracking-tight.
- **Default `editor.fontFamily` = IBM Plex Mono** (overridable).
- **Both families are bundled** as `@font-face` (woff2) in Intuition-owned media
  — never assumed system-installed. Inter applies to Intuition-owned brand
  surfaces and (best-effort) workbench chrome; IBM Plex Mono backs the editor.

### The signature gradient (port verbatim from `globals.css`)

The single animation `@keyframes shimmer-text` (background-position 0%→200%) over
a **palindromic iris→violet→cyan→violet→iris** sweep, 7s linear. Utilities:

- **`.nav-streak`** — 1px top-edge line: `linear-gradient(90deg, transparent,
  iris 10%, violet 30%, cyan 50%, violet 70%, iris 90%, transparent)`,
  `background-size:200% 100%`, opacity .95. → Intuition **title-bar streak**.
- **`.text-spectrum`** — clipped to text: `linear-gradient(100deg, iris 0%,
  violet 25%, cyan 50%, violet 75%, iris 100%)`, `background-clip:text`. →
  **marquee brand moments only**.
- **`.grad-glyph`** — a `linear-gradient(135deg, iris, violet, cyan)` masked by
  an icon silhouette. → the **mark** and the **active teaching icon**.
- **`.rule-spectrum`** — optional hairline divider (opacity .45), used sparingly.

All honor `prefers-reduced-motion` (freeze to a static frame) and pause when the
window is hidden.

### The plasma shader (optional / stretch)

The WebGL domain-warped fbm plasma (`shader-canvas.tsx`, palette in
`shader-palette.ts`: violet `(0.6,0.42,1.0)`, iris `(1.0,0.27,0.9)`, cyan
`(0.2,0.91,1.0)`, intensity 1.0 dark / 0.6 light). **Out of scope for the core
system**; earmarked as a backdrop for the future welcome/full-learn surfaces,
**always masked + dimmed + veiled into neutral**. Listed here only so the token
palette stays compatible with it.

### Restraint budget (the prime directive)

Neutral grayscale is the aesthetic; the spectrum is "a glow you catch out of the
corner of your eye." If a surface reads as "branded purple," strip an accent.
The locked "mark & line only" rule is the in-chrome expression of this.

## Architecture in the fork

**Single source of truth for token values:** `intuitionBrand.css`
(Intuition-owned media) declares the palette as CSS custom properties
(`--intuition-iris`, …) for both themes and hosts the `@font-face` + gradient
utilities. The color theme JSON mirrors the same hex values; a drift test keeps
them in sync.

File plan (all additive / Intuition-owned):

```
extensions/theme-intuition/                 NEW — built-in theme extension
  package.json                              contributes "Intuition Dark" + "Intuition Light"
  themes/intuition-dark-color-theme.json    full workbench + token color map (iris accent)
  themes/intuition-light-color-theme.json   mirror
  fonts/                                     Inter + IBM Plex Mono woff2 (or shared from media)

src/vs/workbench/browser/intuition/media/
  intuitionBrand.css                        NEW — @font-face, --intuition-* tokens,
                                            .nav-streak/.text-spectrum/.grad-glyph/.rule-spectrum
  (intuitionLayout.css)                     existing — unchanged

src/vs/workbench/browser/intuition/
  intuitionBrand.contribution.ts            NEW — loads brand CSS; adds the title-bar streak element

src/vs/workbench/common/intuition/
  intuitionDefaults.contribution.ts         EDIT — add colorTheme + editor.fontFamily defaults

src/vs/workbench/contrib/intuitionCourse/browser/media/
  courseEditor.css, courseTitleBar.css      EDIT — normalize hardcoded colors to --intuition-* tokens
```

**Defaults overlay additions** (in the existing frozen overrides object):

```ts
'workbench.colorTheme': 'Intuition Dark',
'workbench.preferredDarkColorTheme': 'Intuition Dark',
'workbench.preferredLightColorTheme': 'Intuition Light',
'editor.fontFamily': "'IBM Plex Mono', ui-monospace, 'SF Mono', Menlo, monospace",
```

**Why a theme extension, not core color registration:** matches upstream's
built-in theme pattern (`extensions/theme-*`), is fully additive (a new dir,
excluded from nothing), and survives sync. The flat token theme covers all
native chrome; the gradient/line/mark — which a color-theme JSON cannot express
— live in `intuitionBrand.css` on Intuition-owned DOM.

**Fork-strategy compliance:** one upstream edit max (the brand-CSS contribution
import in `workbench.common.main.ts`, same pattern as `intuitionDefaults`);
everything else is new owned files or edits to already-owned files. Bundled
fonts increase package size (accepted).

## Non-goals

- The teaching re-layout (companion rail, full-learn mode) — **separate spec**.
- The code-led knowledge graph / tree-sitter indexer — already future work.
- Redesigning the full codicon set — stock codicons, recolored by the theme;
  only the **brand mark + teaching icon** are custom.
- A guaranteed global chrome UI font swap — VS Code's chrome font is largely
  platform-driven; Inter is applied to owned surfaces and best-effort elsewhere.
- `.page-shimmer` full-page overlay and the plasma shader (deferred).
- Any landing-page / marketing changes.

## Error handling & edge cases

- Missing color IDs in the theme fall back to VS Code defaults (ugly, not
  broken) — planning enumerates the full workbench color set to avoid gaps.
- If a bundled font fails to load, `editor.fontFamily` falls through its
  fallback stack; brand surfaces fall back to `system-ui`.
- `prefers-reduced-motion` → all shimmer animations render one static frame.
- High-contrast themes: Intuition themes are normal dark/light; HC users keep
  VS Code's HC themes (we don't override their preference).

## Risks

| Risk | Mitigation |
|---|---|
| Custom editor font may not render/measure cleanly | Verify IBM Plex Mono in the editor early (Playwright screenshot); keep a mono fallback stack |
| Chrome UI font (Inter) override is non-standard | Scope Inter to owned surfaces; treat global chrome as best-effort, not a blocker |
| Animated gradient = continuous repaint | Limit to a 1px line + small mark; pause when hidden; honor reduced-motion |
| Light-mode spectrum too loud on `#fbfbfb` | Use the light token set (`iris #c81fd1`), keep "mark & line only", lower any plasma intensity to 0.6 |
| Theme JSON ↔ CSS token drift | Single documented value table + a drift test asserting equality |
| Upstream sync moves color IDs / ViewPane | All custom code in owned dirs; typecheck + theme-load check catch breaks |

## Testing

- **Typecheck:** `npm run compile-check-ts-native` after edits.
- **Drift test** (`src/vs/workbench/test/common/intuition/…`): `intuitionDefaults`
  includes `workbench.colorTheme` + `editor.fontFamily`; the `--intuition-*`
  token values equal the theme JSON values.
- **Playwright** (per build-env recipe): launch, screenshot **dark and light** —
  verify neutral chrome, the title-bar streak shimmer, the active course icon
  carrying the gradient, the editor rendering in IBM Plex Mono, and one
  marquee `.text-spectrum` moment.
- **Reduced motion:** with the flag set, confirm no shimmer animation.
```
