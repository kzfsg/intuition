# Intuition Visual Identity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Intuition fork a complete, owned visual identity faithful to the landing page — Intuition Dark + Light themes, bundled Inter + IBM Plex Mono, the iris·violet·cyan shimmer line + word gradient (mark & line only), and IBM Plex Mono as the default editor font.

**Architecture:** A built-in theme extension (`extensions/theme-intuition/`) supplies the flat token colors VS Code's native chrome understands. A globally-loaded `intuitionBrand.css` supplies what a theme JSON cannot: bundled `@font-face` fonts, `--intuition-*` CSS tokens, and the animated gradient utilities (title-bar streak, the course mark). All token values trace to one TS source (`intuitionTokens.ts`). Defaults are wired through the existing `intuitionDefaults` overlay. One new upstream import line; everything else is new or already-owned files.

**Tech Stack:** TypeScript, VS Code workbench contributions, color-theme JSON, CSS custom properties + `@font-face`, the repo's `mocha`-style node tests and Playwright e2e (per `docs/.../intuition-build-env`).

**Reference spec:** `docs/superpowers/specs/2026-06-20-visual-identity-design.md`

**Build/verify environment (read `memory/intuition-build-env.md`):**
- Typecheck (always runnable): `npm run compile-check-ts-native`
- Unit tests need compiled `out/` (transpile) + Node 24:
  - Transpile: `npm run transpile-client`
  - Run one file: `npm run test-node -- --run out/vs/workbench/test/common/intuition/<file>.test.js`
- Playwright e2e launches `.build/electron/Intuition.exe` (see spec/memory for the full recipe).

---

### Task 1: Palette source of truth + invariants test

One TS module holds every brand color; a test pins its shape so later drift is caught.

**Files:**
- Create: `src/vs/workbench/common/intuition/intuitionTokens.ts`
- Test: `src/vs/workbench/test/common/intuition/intuitionTokens.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/vs/workbench/test/common/intuition/intuitionTokens.test.ts`:

```ts
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { INTUITION_PALETTE, INTUITION_SPECTRUM } from '../../../common/intuition/intuitionTokens.js';

suite('Intuition Tokens', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const HEX = /^#[0-9a-f]{6}$/i;
	const REQUIRED_KEYS = ['background', 'raised', 'surface', 'foreground', 'muted', 'mutedForeground', 'border', 'iris', 'violet', 'cyan', 'lime'] as const;

	for (const kind of ['dark', 'light'] as const) {
		test(`${kind} palette defines every token as a 6-digit hex`, () => {
			const palette = INTUITION_PALETTE[kind];
			for (const key of REQUIRED_KEYS) {
				assert.ok(HEX.test(palette[key]), `${kind}.${key} = '${palette[key]}' is not a #rrggbb hex`);
			}
		});
		test(`${kind} spectrum is iris/violet/cyan in order`, () => {
			assert.deepStrictEqual(INTUITION_SPECTRUM[kind], [INTUITION_PALETTE[kind].iris, INTUITION_PALETTE[kind].violet, INTUITION_PALETTE[kind].cyan]);
		});
	}

	test('dark and light are distinct themes (iris differs)', () => {
		assert.notStrictEqual(INTUITION_PALETTE.dark.iris, INTUITION_PALETTE.light.iris);
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run transpile-client && npm run test-node -- --run out/vs/workbench/test/common/intuition/intuitionTokens.test.js`
Expected: FAIL — cannot find module `intuitionTokens.js`.

- [ ] **Step 3: Write the source module**

Create `src/vs/workbench/common/intuition/intuitionTokens.ts`:

```ts
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * THE single source of truth for Intuition's brand colors. The theme JSONs
 * (extensions/theme-intuition) and intuitionBrand.css mirror these values by
 * hand — keep all three in sync. Values are from the landing page's
 * app/globals.css (see docs/superpowers/specs/2026-06-20-visual-identity-design.md).
 */
export interface IntuitionThemeTokens {
	readonly background: string;
	readonly raised: string;
	readonly surface: string;
	readonly foreground: string;
	readonly muted: string;
	readonly mutedForeground: string;
	readonly border: string;
	readonly iris: string;
	readonly violet: string;
	readonly cyan: string;
	readonly lime: string;
}

export const INTUITION_PALETTE: { readonly dark: IntuitionThemeTokens; readonly light: IntuitionThemeTokens } = {
	dark: {
		background: '#0a0a0b', raised: '#0c0c0e', surface: '#121214',
		foreground: '#f6f6f7', muted: '#161618', mutedForeground: '#8a8a92', border: '#242427',
		iris: '#ee45e0', violet: '#9a6bff', cyan: '#34e7ff', lime: '#b6ff3d',
	},
	light: {
		background: '#fbfbfb', raised: '#f3f3f4', surface: '#ffffff',
		foreground: '#0a0a0a', muted: '#f3f3f4', mutedForeground: '#6e6e73', border: '#e6e6e8',
		iris: '#c81fd1', violet: '#6d3cff', cyan: '#0a93c2', lime: '#6f9e00',
	},
};

/** Spectrum stops (iris→violet→cyan) for the shimmer line / word gradient. */
export const INTUITION_SPECTRUM = {
	dark: [INTUITION_PALETTE.dark.iris, INTUITION_PALETTE.dark.violet, INTUITION_PALETTE.dark.cyan],
	light: [INTUITION_PALETTE.light.iris, INTUITION_PALETTE.light.violet, INTUITION_PALETTE.light.cyan],
} as const;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run transpile-client && npm run test-node -- --run out/vs/workbench/test/common/intuition/intuitionTokens.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run compile-check-ts-native
git add src/vs/workbench/common/intuition/intuitionTokens.ts src/vs/workbench/test/common/intuition/intuitionTokens.test.ts
git commit -m "feat(brand): intuition palette source of truth + invariants test"
```

---

### Task 2: Theme extension scaffold + Intuition Dark

A built-in theme extension. Any directory under `extensions/` is bundled as built-in automatically — no registration list to edit.

**Files:**
- Create: `extensions/theme-intuition/package.json`
- Create: `extensions/theme-intuition/themes/intuition-dark-color-theme.json`

- [ ] **Step 1: Create the extension manifest**

Create `extensions/theme-intuition/package.json`:

```json
{
  "name": "theme-intuition",
  "displayName": "Intuition Theme",
  "description": "Intuition's signature dark and light themes.",
  "version": "1.0.0",
  "publisher": "intuition",
  "license": "MIT",
  "engines": { "vscode": "*" },
  "categories": ["Themes"],
  "contributes": {
    "themes": [
      {
        "id": "Intuition Dark",
        "label": "Intuition Dark",
        "uiTheme": "vs-dark",
        "path": "./themes/intuition-dark-color-theme.json"
      },
      {
        "id": "Intuition Light",
        "label": "Intuition Light",
        "uiTheme": "vs",
        "path": "./themes/intuition-light-color-theme.json"
      }
    ]
  },
  "repository": { "type": "git", "url": "https://github.com/kzfsg/intuition.git" }
}
```

- [ ] **Step 2: Create the dark theme**

Create `extensions/theme-intuition/themes/intuition-dark-color-theme.json`:

```json
{
  "name": "Intuition Dark",
  "type": "dark",
  "colors": {
    "focusBorder": "#ee45e0",
    "foreground": "#f6f6f7",
    "descriptionForeground": "#8a8a92",
    "errorForeground": "#ff5c6c",
    "widget.shadow": "#00000066",
    "selection.background": "#ee45e055",
    "editor.background": "#0a0a0b",
    "editor.foreground": "#f6f6f7",
    "editorLineNumber.foreground": "#3a3a40",
    "editorLineNumber.activeForeground": "#8a8a92",
    "editorCursor.foreground": "#ee45e0",
    "editor.selectionBackground": "#ee45e033",
    "editor.selectionHighlightBackground": "#34e7ff22",
    "editor.lineHighlightBackground": "#ffffff08",
    "editor.findMatchBackground": "#ee45e055",
    "editor.findMatchHighlightBackground": "#34e7ff33",
    "editorWhitespace.foreground": "#ffffff14",
    "editorIndentGuide.background1": "#ffffff10",
    "editorIndentGuide.activeBackground1": "#ffffff2a",
    "editorBracketMatch.background": "#9a6bff22",
    "editorBracketMatch.border": "#9a6bff66",
    "editorWidget.background": "#121214",
    "editorWidget.border": "#242427",
    "editorGroupHeader.tabsBackground": "#0c0c0e",
    "editorGroupHeader.tabsBorder": "#242427",
    "titleBar.activeBackground": "#0c0c0e",
    "titleBar.activeForeground": "#f6f6f7",
    "titleBar.inactiveBackground": "#0c0c0e",
    "titleBar.inactiveForeground": "#8a8a92",
    "titleBar.border": "#242427",
    "activityBar.background": "#0c0c0e",
    "activityBar.foreground": "#f6f6f7",
    "activityBar.inactiveForeground": "#8a8a92",
    "activityBar.border": "#242427",
    "activityBar.activeBorder": "#ee45e0",
    "activityBarBadge.background": "#ee45e0",
    "activityBarBadge.foreground": "#0a0a0b",
    "sideBar.background": "#0c0c0e",
    "sideBar.foreground": "#cfcfd4",
    "sideBar.border": "#242427",
    "sideBarSectionHeader.background": "#0c0c0e",
    "sideBarSectionHeader.foreground": "#8a8a92",
    "sideBarTitle.foreground": "#8a8a92",
    "list.activeSelectionBackground": "#ffffff14",
    "list.activeSelectionForeground": "#ffffff",
    "list.inactiveSelectionBackground": "#ffffff0d",
    "list.hoverBackground": "#ffffff0a",
    "list.highlightForeground": "#34e7ff",
    "list.focusOutline": "#ee45e0",
    "tab.activeBackground": "#0a0a0b",
    "tab.activeForeground": "#f6f6f7",
    "tab.inactiveBackground": "#0c0c0e",
    "tab.inactiveForeground": "#8a8a92",
    "tab.border": "#242427",
    "tab.activeBorderTop": "#ee45e0",
    "statusBar.background": "#0c0c0e",
    "statusBar.foreground": "#8a8a92",
    "statusBar.border": "#242427",
    "statusBar.noFolderBackground": "#0c0c0e",
    "statusBarItem.remoteBackground": "#ee45e0",
    "statusBarItem.remoteForeground": "#0a0a0b",
    "panel.background": "#0a0a0b",
    "panel.border": "#242427",
    "panelTitle.activeForeground": "#f6f6f7",
    "panelTitle.inactiveForeground": "#8a8a92",
    "panelTitle.activeBorder": "#ee45e0",
    "button.background": "#ee45e0",
    "button.foreground": "#0a0a0b",
    "button.hoverBackground": "#f368e6",
    "button.secondaryBackground": "#242427",
    "button.secondaryForeground": "#f6f6f7",
    "input.background": "#121214",
    "input.foreground": "#f6f6f7",
    "input.border": "#242427",
    "input.placeholderForeground": "#8a8a92",
    "inputOption.activeBorder": "#ee45e0",
    "dropdown.background": "#121214",
    "dropdown.border": "#242427",
    "badge.background": "#ee45e0",
    "badge.foreground": "#0a0a0b",
    "progressBar.background": "#ee45e0",
    "scrollbarSlider.background": "#ffffff14",
    "scrollbarSlider.hoverBackground": "#ffffff22",
    "scrollbarSlider.activeBackground": "#ffffff33",
    "menu.background": "#121214",
    "menu.foreground": "#f6f6f7",
    "menu.selectionBackground": "#ffffff14",
    "quickInput.background": "#121214",
    "quickInputList.focusBackground": "#ffffff14",
    "pickerGroup.foreground": "#8a8a92",
    "pickerGroup.border": "#242427",
    "textLink.foreground": "#9a6bff",
    "textLink.activeForeground": "#b48bff",
    "terminal.foreground": "#f6f6f7",
    "terminalCursor.foreground": "#ee45e0",
    "terminal.ansiBlue": "#34e7ff",
    "terminal.ansiBrightBlue": "#34e7ff",
    "terminal.ansiMagenta": "#ee45e0",
    "terminal.ansiBrightMagenta": "#9a6bff",
    "terminal.ansiGreen": "#b6ff3d",
    "terminal.ansiCyan": "#34e7ff"
  },
  "tokenColors": [
    { "scope": ["comment", "punctuation.definition.comment"], "settings": { "foreground": "#5b5b63", "fontStyle": "italic" } },
    { "scope": ["string", "string.quoted", "constant.other.symbol"], "settings": { "foreground": "#b6ff3d" } },
    { "scope": ["constant.numeric", "constant.language", "constant.character"], "settings": { "foreground": "#34e7ff" } },
    { "scope": ["keyword", "storage", "storage.type", "keyword.control"], "settings": { "foreground": "#9a6bff" } },
    { "scope": ["entity.name.function", "support.function", "meta.function-call"], "settings": { "foreground": "#34e7ff" } },
    { "scope": ["entity.name.type", "entity.name.class", "support.type", "support.class"], "settings": { "foreground": "#c9a6ff" } },
    { "scope": ["variable", "meta.definition.variable.name", "support.variable"], "settings": { "foreground": "#f6f6f7" } },
    { "scope": ["punctuation", "meta.brace", "keyword.operator"], "settings": { "foreground": "#8a8a92" } },
    { "scope": ["entity.name.tag"], "settings": { "foreground": "#ee45e0" } },
    { "scope": ["entity.other.attribute-name"], "settings": { "foreground": "#b6ff3d" } }
  ]
}
```

- [ ] **Step 3: Verify it loads (manual / Playwright)**

Launch the app (per `memory/intuition-build-env.md`). Open the Command Palette → "Preferences: Color Theme" → confirm **Intuition Dark** appears and applies (magenta cursor, neutral chrome).
Expected: theme listed and selectable.

- [ ] **Step 4: Commit**

```bash
git add extensions/theme-intuition/package.json extensions/theme-intuition/themes/intuition-dark-color-theme.json
git commit -m "feat(brand): Intuition Dark theme extension"
```

---

### Task 3: Intuition Light

Mirror of dark using the light token set (`uiTheme: vs` is already declared in Task 2's manifest).

**Files:**
- Create: `extensions/theme-intuition/themes/intuition-light-color-theme.json`

- [ ] **Step 1: Create the light theme**

Create `extensions/theme-intuition/themes/intuition-light-color-theme.json`:

```json
{
  "name": "Intuition Light",
  "type": "light",
  "colors": {
    "focusBorder": "#c81fd1",
    "foreground": "#0a0a0a",
    "descriptionForeground": "#6e6e73",
    "errorForeground": "#d83a4a",
    "widget.shadow": "#00000017",
    "selection.background": "#c81fd140",
    "editor.background": "#fbfbfb",
    "editor.foreground": "#0a0a0a",
    "editorLineNumber.foreground": "#bcbcc2",
    "editorLineNumber.activeForeground": "#6e6e73",
    "editorCursor.foreground": "#c81fd1",
    "editor.selectionBackground": "#c81fd122",
    "editor.selectionHighlightBackground": "#0a93c21f",
    "editor.lineHighlightBackground": "#0000000a",
    "editor.findMatchBackground": "#c81fd140",
    "editor.findMatchHighlightBackground": "#0a93c233",
    "editorWhitespace.foreground": "#0000000f",
    "editorIndentGuide.background1": "#00000010",
    "editorIndentGuide.activeBackground1": "#00000028",
    "editorBracketMatch.background": "#6d3cff1f",
    "editorBracketMatch.border": "#6d3cff66",
    "editorWidget.background": "#ffffff",
    "editorWidget.border": "#e6e6e8",
    "editorGroupHeader.tabsBackground": "#f3f3f4",
    "editorGroupHeader.tabsBorder": "#e6e6e8",
    "titleBar.activeBackground": "#f3f3f4",
    "titleBar.activeForeground": "#0a0a0a",
    "titleBar.inactiveBackground": "#f3f3f4",
    "titleBar.inactiveForeground": "#6e6e73",
    "titleBar.border": "#e6e6e8",
    "activityBar.background": "#f3f3f4",
    "activityBar.foreground": "#0a0a0a",
    "activityBar.inactiveForeground": "#6e6e73",
    "activityBar.border": "#e6e6e8",
    "activityBar.activeBorder": "#c81fd1",
    "activityBarBadge.background": "#c81fd1",
    "activityBarBadge.foreground": "#ffffff",
    "sideBar.background": "#f3f3f4",
    "sideBar.foreground": "#3a3a40",
    "sideBar.border": "#e6e6e8",
    "sideBarSectionHeader.background": "#f3f3f4",
    "sideBarSectionHeader.foreground": "#6e6e73",
    "sideBarTitle.foreground": "#6e6e73",
    "list.activeSelectionBackground": "#00000010",
    "list.activeSelectionForeground": "#0a0a0a",
    "list.inactiveSelectionBackground": "#0000000a",
    "list.hoverBackground": "#00000008",
    "list.highlightForeground": "#0a93c2",
    "list.focusOutline": "#c81fd1",
    "tab.activeBackground": "#fbfbfb",
    "tab.activeForeground": "#0a0a0a",
    "tab.inactiveBackground": "#f3f3f4",
    "tab.inactiveForeground": "#6e6e73",
    "tab.border": "#e6e6e8",
    "tab.activeBorderTop": "#c81fd1",
    "statusBar.background": "#f3f3f4",
    "statusBar.foreground": "#6e6e73",
    "statusBar.border": "#e6e6e8",
    "statusBar.noFolderBackground": "#f3f3f4",
    "statusBarItem.remoteBackground": "#c81fd1",
    "statusBarItem.remoteForeground": "#ffffff",
    "panel.background": "#fbfbfb",
    "panel.border": "#e6e6e8",
    "panelTitle.activeForeground": "#0a0a0a",
    "panelTitle.inactiveForeground": "#6e6e73",
    "panelTitle.activeBorder": "#c81fd1",
    "button.background": "#c81fd1",
    "button.foreground": "#ffffff",
    "button.hoverBackground": "#b01bb8",
    "button.secondaryBackground": "#e6e6e8",
    "button.secondaryForeground": "#0a0a0a",
    "input.background": "#ffffff",
    "input.foreground": "#0a0a0a",
    "input.border": "#e6e6e8",
    "input.placeholderForeground": "#6e6e73",
    "inputOption.activeBorder": "#c81fd1",
    "dropdown.background": "#ffffff",
    "dropdown.border": "#e6e6e8",
    "badge.background": "#c81fd1",
    "badge.foreground": "#ffffff",
    "progressBar.background": "#c81fd1",
    "scrollbarSlider.background": "#00000014",
    "scrollbarSlider.hoverBackground": "#00000022",
    "scrollbarSlider.activeBackground": "#00000033",
    "menu.background": "#ffffff",
    "menu.foreground": "#0a0a0a",
    "menu.selectionBackground": "#00000010",
    "quickInput.background": "#ffffff",
    "quickInputList.focusBackground": "#00000010",
    "pickerGroup.foreground": "#6e6e73",
    "pickerGroup.border": "#e6e6e8",
    "textLink.foreground": "#6d3cff",
    "textLink.activeForeground": "#5024e0",
    "terminal.foreground": "#0a0a0a",
    "terminalCursor.foreground": "#c81fd1",
    "terminal.ansiBlue": "#0a93c2",
    "terminal.ansiBrightBlue": "#0a93c2",
    "terminal.ansiMagenta": "#c81fd1",
    "terminal.ansiBrightMagenta": "#6d3cff",
    "terminal.ansiGreen": "#6f9e00",
    "terminal.ansiCyan": "#0a93c2"
  },
  "tokenColors": [
    { "scope": ["comment", "punctuation.definition.comment"], "settings": { "foreground": "#8a8a92", "fontStyle": "italic" } },
    { "scope": ["string", "string.quoted", "constant.other.symbol"], "settings": { "foreground": "#5a7d00" } },
    { "scope": ["constant.numeric", "constant.language", "constant.character"], "settings": { "foreground": "#0a93c2" } },
    { "scope": ["keyword", "storage", "storage.type", "keyword.control"], "settings": { "foreground": "#6d3cff" } },
    { "scope": ["entity.name.function", "support.function", "meta.function-call"], "settings": { "foreground": "#0a93c2" } },
    { "scope": ["entity.name.type", "entity.name.class", "support.type", "support.class"], "settings": { "foreground": "#6d3cff" } },
    { "scope": ["variable", "meta.definition.variable.name", "support.variable"], "settings": { "foreground": "#0a0a0a" } },
    { "scope": ["punctuation", "meta.brace", "keyword.operator"], "settings": { "foreground": "#6e6e73" } },
    { "scope": ["entity.name.tag"], "settings": { "foreground": "#c81fd1" } },
    { "scope": ["entity.other.attribute-name"], "settings": { "foreground": "#5a7d00" } }
  ]
}
```

- [ ] **Step 2: Verify both themes load**

Launch; Command Palette → "Preferences: Color Theme" → confirm **Intuition Light** appears and applies (light paper, magenta accents).
Expected: both Intuition themes selectable and visually correct.

- [ ] **Step 3: Commit**

```bash
git add extensions/theme-intuition/themes/intuition-light-color-theme.json
git commit -m "feat(brand): Intuition Light theme"
```

---

### Task 4: Wire default settings (theme + editor font)

Make Intuition Dark the default theme, set the preferred dark/light pair, and default the editor font to IBM Plex Mono. The existing `intuitionDefaults.test.ts` auto-verifies every key in the overrides object; add explicit assertions for the new ones.

**Files:**
- Modify: `src/vs/workbench/common/intuition/intuitionDefaults.contribution.ts`
- Test: `src/vs/workbench/test/common/intuition/intuitionDefaults.test.ts`

- [ ] **Step 1: Add the failing assertion**

In `intuitionDefaults.test.ts`, inside the `suite(...)`, add a new test after the existing ones:

```ts
	test('brand defaults (theme + editor font) are present', () => {
		assert.strictEqual(intuitionDefaultOverrides['workbench.colorTheme'], 'Intuition Dark');
		assert.strictEqual(intuitionDefaultOverrides['workbench.preferredDarkColorTheme'], 'Intuition Dark');
		assert.strictEqual(intuitionDefaultOverrides['workbench.preferredLightColorTheme'], 'Intuition Light');
		assert.ok(String(intuitionDefaultOverrides['editor.fontFamily']).includes('IBM Plex Mono'));
	});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run transpile-client && npm run test-node -- --run out/vs/workbench/test/common/intuition/intuitionDefaults.test.js`
Expected: FAIL — keys are `undefined`.

- [ ] **Step 3: Add the defaults**

In `intuitionDefaults.contribution.ts`, add to the frozen `intuitionDefaultOverrides` object (a new section before the closing brace):

```ts
	// --- Brand: Intuition identity ---
	'workbench.colorTheme': 'Intuition Dark',
	'workbench.preferredDarkColorTheme': 'Intuition Dark',
	'workbench.preferredLightColorTheme': 'Intuition Light',
	'editor.fontFamily': "'IBM Plex Mono', Menlo, Monaco, 'Courier New', monospace",
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run transpile-client && npm run test-node -- --run out/vs/workbench/test/common/intuition/intuitionDefaults.test.js`
Expected: PASS (existing tests + the new one).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run compile-check-ts-native
git add src/vs/workbench/common/intuition/intuitionDefaults.contribution.ts src/vs/workbench/test/common/intuition/intuitionDefaults.test.ts
git commit -m "feat(brand): default to Intuition theme + IBM Plex Mono editor font"
```

---

### Task 5: Bundle fonts + brand CSS + load it globally

Bundle Inter + IBM Plex Mono, expose `--intuition-*` tokens and the gradient utilities, and load the stylesheet for the whole workbench via a contribution + one upstream import.

**Files:**
- Create: `src/vs/workbench/browser/intuition/media/fonts/inter-latin-wght-normal.woff2` (downloaded)
- Create: `src/vs/workbench/browser/intuition/media/fonts/ibm-plex-mono-latin-400-normal.woff2` (downloaded)
- Create: `src/vs/workbench/browser/intuition/media/fonts/ibm-plex-mono-latin-500-normal.woff2` (downloaded)
- Create: `src/vs/workbench/browser/intuition/media/intuitionBrand.css`
- Create: `src/vs/workbench/browser/intuition/intuitionBrand.contribution.ts`
- Modify: `src/vs/workbench/workbench.common.main.ts` (one import line)

- [ ] **Step 1: Download the fonts**

```bash
mkdir -p "src/vs/workbench/browser/intuition/media/fonts"
curl -L -o "src/vs/workbench/browser/intuition/media/fonts/inter-latin-wght-normal.woff2" "https://cdn.jsdelivr.net/npm/@fontsource-variable/inter@5/files/inter-latin-wght-normal.woff2"
curl -L -o "src/vs/workbench/browser/intuition/media/fonts/ibm-plex-mono-latin-400-normal.woff2" "https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5/files/ibm-plex-mono-latin-400-normal.woff2"
curl -L -o "src/vs/workbench/browser/intuition/media/fonts/ibm-plex-mono-latin-500-normal.woff2" "https://cdn.jsdelivr.net/npm/@fontsource/ibm-plex-mono@5/files/ibm-plex-mono-latin-500-normal.woff2"
```

Verify each file is a real woff2 (a few hundred KB, not an HTML error page):
Run: `ls -l src/vs/workbench/browser/intuition/media/fonts/`
Expected: three `.woff2` files, each > 20 KB.

- [ ] **Step 2: Write the brand stylesheet**

Create `src/vs/workbench/browser/intuition/media/intuitionBrand.css`:

```css
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* Bundled brand fonts. Values mirror src/.../common/intuition/intuitionTokens.ts. */
@font-face {
	font-family: 'Inter';
	font-style: normal;
	font-weight: 200 600;
	font-display: swap;
	src: url('./fonts/inter-latin-wght-normal.woff2') format('woff2');
}
@font-face {
	font-family: 'IBM Plex Mono';
	font-style: normal;
	font-weight: 400;
	font-display: swap;
	src: url('./fonts/ibm-plex-mono-latin-400-normal.woff2') format('woff2');
}
@font-face {
	font-family: 'IBM Plex Mono';
	font-style: normal;
	font-weight: 500;
	font-display: swap;
	src: url('./fonts/ibm-plex-mono-latin-500-normal.woff2') format('woff2');
}

/* Brand tokens + the spectrum sweeps. Dark is the default; light overrides under .vs. */
.monaco-workbench {
	--intuition-iris: #ee45e0;
	--intuition-violet: #9a6bff;
	--intuition-cyan: #34e7ff;
	--intuition-lime: #b6ff3d;
	--intuition-spectrum: linear-gradient(100deg, var(--intuition-iris) 0%, var(--intuition-violet) 25%, var(--intuition-cyan) 50%, var(--intuition-violet) 75%, var(--intuition-iris) 100%);
	--intuition-streak: linear-gradient(90deg, transparent 0%, var(--intuition-iris) 10%, var(--intuition-violet) 30%, var(--intuition-cyan) 50%, var(--intuition-violet) 70%, var(--intuition-iris) 90%, transparent 100%);
}
.monaco-workbench.vs {
	--intuition-iris: #c81fd1;
	--intuition-violet: #6d3cff;
	--intuition-cyan: #0a93c2;
	--intuition-lime: #6f9e00;
}

@keyframes intuition-shimmer {
	from { background-position: 0% center; }
	to { background-position: 200% center; }
}

/* Word gradient — marquee brand moments only (e.g. a welcome/full-learn headline). */
.monaco-workbench .intuition-text-spectrum {
	background-image: var(--intuition-spectrum);
	background-size: 200% auto;
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
	animation: intuition-shimmer 7s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
	.monaco-workbench .intuition-text-spectrum { animation: none; }
}
```

- [ ] **Step 3: Write the contribution that loads the CSS**

Create `src/vs/workbench/browser/intuition/intuitionBrand.contribution.ts`:

```ts
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Side-effect import: bundles the brand fonts, tokens, and gradient utilities
// into the workbench. No runtime logic — the stylesheet is the contribution.
import './media/intuitionBrand.css';
```

- [ ] **Step 4: Register the import upstream**

In `src/vs/workbench/workbench.common.main.ts`, directly after the existing line
`import './browser/intuition/intuitionLayoutSeed.contribution.js';` (around line 206), add:

```ts
import './browser/intuition/intuitionBrand.contribution.js';
```

- [ ] **Step 5: Typecheck, launch, verify fonts/tokens load**

Run: `npm run compile-check-ts-native`
Expected: clean.

Launch the app. Open DevTools console and run:
```js
getComputedStyle(document.querySelector('.monaco-workbench')).getPropertyValue('--intuition-iris')
```
Expected: `#ee45e0` (dark) or `#c81fd1` (light). Confirm the editor renders in IBM Plex Mono (Task 4's default).

- [ ] **Step 6: Commit**

```bash
git add src/vs/workbench/browser/intuition/media/fonts src/vs/workbench/browser/intuition/media/intuitionBrand.css src/vs/workbench/browser/intuition/intuitionBrand.contribution.ts src/vs/workbench/workbench.common.main.ts
git commit -m "feat(brand): bundle Inter + IBM Plex Mono, intuition tokens + gradient utilities"
```

---

### Task 6: The title-bar streak + the course mark gradient

Apply the two in-chrome spectrum placements (the locked "mark & line only" budget): a 1px shimmer line on the title bar's top edge, and the spectrum clipped to the Course button's mortar-board glyph. Both are pure CSS — no DOM hooks.

**Files:**
- Modify: `src/vs/workbench/browser/intuition/media/intuitionBrand.css`
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/media/courseTitleBar.css`
- Modify (if needed): `src/vs/workbench/contrib/intuitionCourse/browser/media/courseEditor.css`

- [ ] **Step 1: Add the title-bar streak to the brand CSS**

Append to `src/vs/workbench/browser/intuition/media/intuitionBrand.css`:

```css
/* The signature 1px iridescent line on the title bar's top edge (".nav-streak"). */
.monaco-workbench .part.titlebar { position: relative; }
.monaco-workbench .part.titlebar::after {
	content: '';
	position: absolute;
	left: 0;
	right: 0;
	top: 0;
	height: 1px;
	pointer-events: none;
	background-image: var(--intuition-streak);
	background-size: 200% 100%;
	opacity: 0.9;
	animation: intuition-shimmer 7s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
	.monaco-workbench .part.titlebar::after { animation: none; }
}
```

- [ ] **Step 2: Gradient-fill the Course mortar-board glyph**

Append to `src/vs/workbench/contrib/intuitionCourse/browser/media/courseTitleBar.css`:

```css
/* The active teaching mark carries the spectrum (mark & line only budget). */
.monaco-workbench .intuition-course-titlebar-icon::before {
	background-image: var(--intuition-spectrum);
	background-size: 200% auto;
	-webkit-background-clip: text;
	background-clip: text;
	color: transparent;
	animation: intuition-shimmer 7s linear infinite;
}
@media (prefers-reduced-motion: reduce) {
	.monaco-workbench .intuition-course-titlebar-icon::before { animation: none; }
}
```

- [ ] **Step 3: Normalize any hardcoded brand hex in the course editor CSS**

Find hardcoded brand colors that should follow the theme:
Run: `grep -niE '#(ee45e0|c81fd1|9a6bff|6d3cff|34e7ff|0a93c2|b6ff3d|6f9e00)' src/vs/workbench/contrib/intuitionCourse/browser/media/courseEditor.css`

For each hit, replace the literal hex with the matching token: iris→`var(--intuition-iris)`, violet→`var(--intuition-violet)`, cyan→`var(--intuition-cyan)`, lime→`var(--intuition-lime)`. If the command prints nothing, this step is a no-op — skip it.

- [ ] **Step 4: Typecheck, launch, verify**

Run: `npm run compile-check-ts-native`
Expected: clean (CSS-only changes; this just confirms nothing else broke).

Launch the app. Verify: a faint shimmering iris→violet→cyan line along the very top of the title bar, and the "Course" mortar-board icon rendered in the gradient (not flat). Toggle to Intuition Light — both recolor to the light spectrum.

- [ ] **Step 5: Commit**

```bash
git add src/vs/workbench/browser/intuition/media/intuitionBrand.css src/vs/workbench/contrib/intuitionCourse/browser/media/courseTitleBar.css src/vs/workbench/contrib/intuitionCourse/browser/media/courseEditor.css
git commit -m "feat(brand): title-bar spectrum streak + gradient course mark"
```

---

### Task 7: Visual verification (dark + light) + reduced motion

A final verification pass with screenshots, per the Playwright recipe in `memory/intuition-build-env.md`.

**Files:** none (verification only).

- [ ] **Step 1: Launch and screenshot dark**

Launch `.build/electron/Intuition.exe` (full recipe in the build-env memory). With Intuition Dark active, open a code file + the Course page. Screenshot.
Expected: neutral dark chrome; magenta accents (cursor, active tab top border, progress); shimmer line on the title bar; gradient Course mark; editor in IBM Plex Mono.

- [ ] **Step 2: Switch to light and screenshot**

Command Palette → "Preferences: Color Theme" → Intuition Light. Screenshot.
Expected: neutral light paper; `#c81fd1` accents; line + mark recolored; no purple-tinted chrome.

- [ ] **Step 3: Reduced-motion check**

Relaunch with OS "reduce motion" on (or emulate via DevTools: Rendering → "Emulate CSS prefers-reduced-motion: reduce"). 
Expected: the streak + mark show a static gradient, no shimmer animation.

- [ ] **Step 4: Final commit (screenshots/docs, if any captured)**

```bash
git add -A
git commit -m "docs(brand): visual identity verification screenshots" || echo "nothing to commit"
```

---

## Notes & follow-ups (not blocking)

- **Cross-file value sync is documented, not auto-tested.** `intuitionTokens.ts` is the human source of truth; the theme JSONs and `intuitionBrand.css` mirror it by hand. An automated test asserting the theme JSON / CSS values equal `INTUITION_PALETTE` was deliberately deferred (reaching `extensions/` + reading CSS from a node test is fragile here). Follow-up: add a build-time check if drift becomes a problem.
- **Chrome UI font (Inter):** the bundled `@font-face` makes Inter available, but VS Code's chrome font is largely platform-driven. Inter is for Intuition-owned brand surfaces (welcome/full-learn, a later sub-project); a global chrome swap is out of scope.
- **Plasma shader + `.page-shimmer`** remain deferred to the welcome/full-learn surfaces (separate sub-project).
- **Editor font flash:** custom `@font-face` editor fonts can flash before load on first paint; acceptable, revisit only if noticeable.
```
