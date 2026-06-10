# Barebones Default Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Cursor-faithful barebones layout defaults via one Intuition-owned file, and exclude four legacy built-in extensions from packaged builds.

**Architecture:** A single module in an Intuition-owned directory registers setting-default overrides through the configuration registry at module load (before workbench layout reads settings). A unit test pins every override and acts as the drift alarm for future upstream syncs. Three build-list edits exclude grunt/gulp/jake/php-language-features.

**Tech Stack:** VS Code fork (TypeScript), configuration registry (`registerDefaultConfigurations`), mocha tdd unit tests, gulp/esbuild build.

**Spec:** `docs/superpowers/specs/2026-06-10-barebones-layout-design.md`

---

## Environment notes (read first — this machine is quirky)

- Work in repo root `C:\Users\zheng feng\Documents\GitHub\intuition`, branch `rebrand-intuition`.
- Shell is Git Bash. **Append** (never prepend) Windows dirs to PATH or `bash` resolves to broken WSL:
  `export PATH="$PATH:/c/Windows/System32:/c/Windows"`
- Default `node` is v24.15.0 (required). Typecheck: `npm run compile-check-ts-native` (~1 min, exit 0 = good).
- The husky pre-commit hook runs hygiene incl. `code-import-patterns`. If it rejects an import, the error names the allowed patterns — fix the import, never `--no-verify`.
- Unit tests on node require transpiled `out/`: run `npm run transpile-client` (~20 s) before `test-node`.
- One deviation from the spec, decided here: the defaults file lives in `src/vs/workbench/common/` (not `browser/`). Registration has zero DOM/browser dependency, and the common layer lets the unit test run under `test-node` (the node runner only globs `test/{common,node}` buckets). Same import wiring, same timing.

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/vs/workbench/common/intuition/intuitionDefaults.contribution.ts` | Create | The one Intuition defaults overlay: exported overrides map + registry call |
| `src/vs/workbench/workbench.common.main.ts` | Modify (1 import line) | Loads the overlay at startup |
| `src/vs/workbench/test/common/intuition/intuitionDefaults.test.ts` | Create | Drift-alarm unit test |
| `build/lib/extensions.ts` (~line 310, `excludedExtensions`) | Modify | Excludes the 4 extensions from **packaged builds** |
| `build/gulpfile.extensions.ts` (compilations list) | Modify | Skips compiling them |
| `build/npm/dirs.ts` | Modify | Skips installing their deps |

---

### Task 1: Verify-first checks (read-only, no commit)

The spec mandates verifying four things before relying on them. Record findings; they gate later steps.

**Files (read only):**
- `product.json`
- `src/vs/platform/configuration/common/configurationRegistry.ts`
- `extensions/grunt/package.json`, `extensions/gulp/package.json`, `extensions/jake/package.json`, `extensions/php-language-features/package.json`

- [ ] **Step 1: Confirm surveys are inert without touching the feedback switch**

Run: `grep -nE "npsSurveyUrl|surveys|languageSurvey" product.json`
Expected: no matches → NPS/language surveys never fire (they require these product.json fields). Therefore do **not** add `telemetry.feedback.enabled` to the defaults map — this preserves Help → Report Issue.
If matches DO appear: stop, report to the human — a narrower switch must be designed.

- [ ] **Step 2: Confirm the registry API shapes used by the code below**

Run: `grep -nE "registerDefaultConfigurations|getConfigurationDefaultsOverrides|interface IConfigurationDefaults" src/vs/platform/configuration/common/configurationRegistry.ts | head -20`
Expected: `registerDefaultConfigurations(defaultConfigurations: IConfigurationDefaults[])` exists; an accessor for registered default overrides exists (named `getConfigurationDefaultsOverrides` or similar returning a Map keyed by setting id). If the accessor name differs from what Task 3's test code uses, adjust the test code to the real name. Also note whether `IConfigurationDefaults` has an optional `source` field — the implementation omits it either way.

- [ ] **Step 3: Confirm the two pre-verified setting keys still exist**

Run: `grep -n "chat.growthNotification.enabled" src/vs/workbench/contrib/chat/common/constants.ts && grep -n "update.showReleaseNotes" src/vs/platform/update/common/update.config.contribution.ts`
Expected: one hit each (spec review found them at constants.ts:71 and update.config.contribution.ts:74).

- [ ] **Step 4: Record the exact package names for the four excluded extensions**

Run: `for e in grunt gulp jake php-language-features; do node -e "console.log(require('./extensions/$e/package.json').name)"; done`
Expected: `grunt`, `gulp`, `jake`, `php-language-features`. The `excludedExtensions` entries in Task 4 must use these exact names (adjust if they differ).

---

### Task 2: Write the failing drift-alarm test

**Files:**
- Create: `src/vs/workbench/test/common/intuition/intuitionDefaults.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { intuitionDefaultOverrides } from '../../../common/intuition/intuitionDefaults.contribution.js';
// Load the platform-level contribution that registers 'update.showReleaseNotes',
// so the schema-existence assertion below can see it.
import '../../../../platform/update/common/update.config.contribution.js';

suite('Intuition Default Overrides', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

	test('every Intuition override is registered as a configuration default', () => {
		const overrides = registry.getConfigurationDefaultsOverrides();
		for (const [key, expected] of Object.entries(intuitionDefaultOverrides)) {
			const actual = overrides.get(key);
			assert.ok(actual !== undefined, `Intuition default for '${key}' is not registered`);
			assert.strictEqual(actual.value, expected, `Intuition default for '${key}' has wrong value`);
		}
	});

	test('overridden keys still exist in the configuration schema (upstream drift alarm)', () => {
		// Keys whose registering modules are loaded in this test environment. Chat keys
		// register in heavy browser-layer modules we cannot load here; for those, the
		// override-registration assertion above is the drift alarm.
		const schemaCheckedKeys = ['update.showReleaseNotes'];
		const properties = registry.getConfigurationProperties();
		for (const key of schemaCheckedKeys) {
			assert.ok(properties[key], `Setting '${key}' no longer exists upstream — fix intuitionDefaults.contribution.ts`);
		}
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
export PATH="$PATH:/c/Windows/System32:/c/Windows"
npm run transpile-client && npm run test-node -- --run src/vs/workbench/test/common/intuition/intuitionDefaults.test.ts
```
Expected: FAIL — the transpile or loader errors with "Cannot find module .../intuitionDefaults.contribution" (the contribution does not exist yet). A transpile error naming the missing contribution IS the expected red state, not a setup problem. If instead the runner reports "0 tests", check the path filter syntax with `npm run test-node -- --help`.

- [ ] **Step 3: Commit the failing test? No.** This repo's pre-commit hook compiles cleanly only when imports resolve; commit happens after Task 3 makes it green.

---

### Task 3: Implement the defaults overlay and make the test pass

**Files:**
- Create: `src/vs/workbench/common/intuition/intuitionDefaults.contribution.ts`
- Modify: `src/vs/workbench/workbench.common.main.ts` (one import line)

- [ ] **Step 1: Create the contribution file**

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../platform/registry/common/platform.js';

/**
 * Intuition's default-settings overlay.
 *
 * STRATEGY (see docs/superpowers/specs/2026-06-10-barebones-layout-design.md):
 * this fork pins upstream VS Code and syncs rarely, so all of Intuition's
 * layout/bloat opinions live HERE as setting DEFAULTS — one owned file with a
 * tiny merge surface — instead of edits or deletions scattered through
 * upstream code. Every value below is a default, not a lock: users can
 * override any of them in their settings.
 *
 * Layout target: Cursor-faithful (references/Cursor Layout.png) — activity
 * icons in a horizontal row atop the sidebar, plain window title, clean empty
 * editor on startup, chat in the right sidebar (already the upstream
 * default), thin status bar kept, terminal hidden until opened.
 */
export const intuitionDefaultOverrides = Object.freeze<Record<string, unknown>>({

	// --- Layout: Cursor-faithful ---
	'workbench.activityBar.location': 'top',
	'window.commandCenter': false,
	'workbench.startupEditor': 'none',

	// --- First-run / ambient bloat off (all user-re-enableable) ---
	'workbench.welcomePage.experimentalOnboarding': false,
	'workbench.tips.enabled': false,
	'chat.tips.enabled': false,
	// Already false upstream, but carries an `experiment` block that can flip
	// it remotely; pinning it here is deliberate.
	'chat.growthNotification.enabled': false,
	'update.showReleaseNotes': false,
});

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerDefaultConfigurations([{ overrides: { ...intuitionDefaultOverrides } }]);
```

- [ ] **Step 2: Wire the import into `workbench.common.main.ts`**

Find the anchor: `grep -n "browser/workbench.contribution" src/vs/workbench/workbench.common.main.ts` — then add immediately after that line:

```typescript
// Intuition default-settings overlay (must load before layout reads settings)
import './common/intuition/intuitionDefaults.contribution.js';
```

- [ ] **Step 3: Typecheck**

Run: `npm run compile-check-ts-native`
Expected: exit 0, no output errors.

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm run transpile-client && npm run test-node -- --run src/vs/workbench/test/common/intuition/intuitionDefaults.test.ts
```
Expected: PASS — 2 passing tests. If the defaults-overrides accessor name from Task 1 Step 2 differed, the test was already adjusted; if `actual.value` is not the value shape, read the `IConfigurationDefaultOverrideValue` type in configurationRegistry.ts and match it.

- [ ] **Step 5: Commit**

```bash
git add src/vs/workbench/common/intuition/ src/vs/workbench/test/common/intuition/ src/vs/workbench/workbench.common.main.ts
git commit -m "feat(layout): Intuition barebones defaults overlay + drift-alarm test"
```
Expected: hygiene hook passes. If `code-import-patterns` rejects an import, the error lists allowed patterns — relocate/adjust the import accordingly and re-commit.

---

### Task 4: Exclude the four legacy built-in extensions

**Files:**
- Modify: `build/lib/extensions.ts` (the `excludedExtensions` array, ~line 310) — **this controls packaging**
- Modify: `build/gulpfile.extensions.ts` (compilations array; grunt/gulp/jake/php-language-features tsconfig lines)
- Modify: `build/npm/dirs.ts` (the four `extensions/...` entries)

- [ ] **Step 1: Add the four names to `excludedExtensions` in `build/lib/extensions.ts`**

Locate the array (`grep -n "excludedExtensions" build/lib/extensions.ts`), append entries using the exact names recorded in Task 1 Step 4, each with a comment marker:

```typescript
	// Intuition: legacy task runners / language features excluded from the product
	'grunt',
	'gulp',
	'jake',
	'php-language-features',
```

- [ ] **Step 2: Remove their tsconfig lines from the compilations array in `build/gulpfile.extensions.ts`**

Delete these four lines (locate with `grep -nE "(grunt|gulp|jake|php-language-features)/tsconfig" build/gulpfile.extensions.ts` — note: a broad grep for `gulp` also matches the gulp library imports used throughout this gulpfile; touch only the four tsconfig compilations entries):
`extensions/grunt/tsconfig.json`, `extensions/gulp/tsconfig.json`, `extensions/jake/tsconfig.json`, `extensions/php-language-features/tsconfig.json`

- [ ] **Step 3: Remove the four directories from `build/npm/dirs.ts`**

Delete the entries `'extensions/grunt'`, `'extensions/gulp'`, `'extensions/jake'`, `'extensions/php-language-features'`.

- [ ] **Step 4: Sanity-check the edits**

```bash
grep -cE "'(grunt|gulp|jake|php-language-features)'" build/lib/extensions.ts   # expect >= 4
grep -cE "(grunt|gulp|jake|php-language-features)/tsconfig" build/gulpfile.extensions.ts   # expect 0
grep -cE "extensions/(grunt|gulp|jake|php-language-features)'" build/npm/dirs.ts   # expect 0
node --experimental-strip-types -e "import('./build/npm/dirs.ts').then(m=>console.log('dirs.ts parses,', m.dirs.length, 'dirs'))"
```
Expected: counts as annotated; dirs.ts parses.

- [ ] **Step 5: Confirm the PHP grammar extension is untouched**

Run: `ls extensions/php/package.json`
Expected: exists (syntax highlighting stays).

- [ ] **Step 6: Commit**

```bash
git add build/lib/extensions.ts build/gulpfile.extensions.ts build/npm/dirs.ts
git commit -m "build: exclude legacy task-runner/php-features built-in extensions"
```

---

### Task 5: Manual launch verification (human-in-the-loop)

**Files:** none (verification only)

- [ ] **Step 1: Launch with a fresh profile**

```bash
export PATH="$PATH:/c/Windows/System32:/c/Windows"
export VSCODE_DEV=1 NODE_ENV=development VSCODE_CLI=1 VSCODE_SKIP_PRELAUNCH=1
npm run transpile-client
.build/electron/Intuition.exe . --user-data-dir="$TEMP/intuition-layout-check" --no-cached-data > "$TEMP/intuition-layout-check.log" 2>&1 &
```

- [ ] **Step 2: Visual checklist (human confirms)**

1. Activity icons appear as a **horizontal row at the top of the sidebar** (no vertical rail).
2. Window title is **plain** (no command-center search pill).
3. **No welcome tab** — startup is an empty editor; no onboarding wizard.
4. Chat panel **visible on the right** (workspace open); terminal hidden until `` Ctrl+` ``.
5. Status bar present (thin).
6. No watermark tips on the empty editor.
7. **Help → Report Issue** opens (survey/feedback machinery untouched).
8. Open the **Agents Window** (sessions) — its layout unchanged (its own status-bar/command-center overrides still win).
9. Settings UI: search `activity bar location` — shows `top` as **default** (not "modified by user").

- [ ] **Step 3: Check the log for new errors**

Run: `grep -ciE "error|failed" "$TEMP/intuition-layout-check.log"` and compare character of hits against the known-clean baseline (auth/token INFO lines are normal; no new "Cannot find module"/activation failures).

- [ ] **Step 4: Push**

```bash
git push
```
Expected: both commits on `origin/rebrand-intuition`.
