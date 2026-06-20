# Visual identity — launch verification (2026-06-20)

Built app launched via Playwright (`_electron`, `.build/electron/Intuition.exe`,
`VSCODE_DEV=1`), fresh profiles, opening `sample.ts`. DOM probed + screenshotted.

## Dark (default theme — applied out of the box)
- `workbench` classes include `vs-dark` + `…intuition-dark-color-theme-json`.
- `--intuition-iris` = `#ee45e0`, `--intuition-cyan` = `#34e7ff`.
- Title-bar streak `::after` renders the iris→violet→cyan gradient; `pointer-events: none`.
- `.titlebar-drag-region` present (drag unaffected by the streak).
- Course mark glyph: `color: transparent` + gradient `background-image` (gradient-filled, not blanked).
- Editor font = `IBM Plex Mono` (then mono fallbacks).
- Syntax: violet keywords, cyan functions, light-violet types, lime strings, muted-italic comments.

See `intuition-dark.png`.

## Light (`.monaco-workbench.vs` override live)
- `workbench` classes include `vs` + `…intuition-light-color-theme-json`.
- `--intuition-iris` = `#c81fd1`, `--intuition-cyan` = `#0a93c2` (light token set applied).
- Streak + course mark recolor to the light spectrum; iris accents on selected card + primary button.

See `intuition-light.png`.

## Notes
- The light run's editor-font probe read the **Course tab** (focused in that launch), not Monaco —
  `editor.fontFamily` is a global, theme-independent default (proven `IBM Plex Mono` in dark), so it
  applies identically in light.
- **Reduced motion:** the `@media (prefers-reduced-motion: reduce)` guard is present on all three
  animated rules (streak, course mark, `.intuition-text-spectrum`); verified by code, not runtime-emulated.
