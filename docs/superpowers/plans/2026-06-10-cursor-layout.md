# Cursor-Style Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Default Intuition's chrome to Cursor's layout — four pinned activity icons centered atop the sidebar with the rest in the overflow dropdown, and a labeled Course button in the title bar replacing the Course sidebar entry.

**Architecture:** A fork-owned common module holds the pinned-viewlets seed data (pure, unit-testable). A fork-owned browser contribution seeds `workbench.activity.pinnedViewlets2` once per profile (marker-key guarded), registers the title-bar Course button (Action2 on `MenuId.TitleBar` + custom `BaseActionViewItem` rendering icon + label via `IActionViewItemService`), and imports a CSS file that centers the horizontal composite bar. The Course sidebar container, `CoursePane`, and its CSS are deleted; the Course editor and commands stay.

**Tech Stack:** VS Code workbench contributions, `IStorageService`, `MenuRegistry`/`IActionViewItemService`, plain CSS. Verify with `compile-check-ts-native`, `test-node` (mocha), and the Playwright `_electron` driver.

**Spec:** `docs/superpowers/specs/2026-06-10-cursor-layout-design.md`

**Build environment notes (this machine):**
- Always `export PATH="$PATH:/c/Windows/System32:/c/Windows"` in bash before npm commands.
- Typecheck: `npm run compile-check-ts-native` (tsgo, fast, reliable gate).
- Transpile to `out/`: `npm run transpile-client` (esbuild, no typecheck — run the typecheck too).
- Unit tests: `npm run test-node -- --grep "<suite name>"` (needs `out/` current).
- Pre-commit hygiene hook enforces copyright headers, tabs, and import patterns. Never `--no-verify`.
- Dev launch: first Electron arg must be the repo root (app path), workspace folder second.

---

### Task 1: Seed data module (common layer) + unit test

**Files:**
- Create: `src/vs/workbench/common/intuition/intuitionLayoutSeed.ts`
- Test: `src/vs/workbench/test/common/intuition/intuitionLayoutSeed.test.ts`

- [ ] **Step 1: Write the failing test**

`src/vs/workbench/test/common/intuition/intuitionLayoutSeed.test.ts`:

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { INTUITION_LAYOUT_SEED_MARKER_KEY, INTUITION_PINNED_VIEWLETS_SEED, PINNED_VIEWLETS_STORAGE_KEY } from '../../../common/intuition/intuitionLayoutSeed.js';

suite('Intuition Layout Seed', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('storage key and marker key are the expected literals', () => {
		assert.strictEqual(PINNED_VIEWLETS_STORAGE_KEY, 'workbench.activity.pinnedViewlets2');
		assert.strictEqual(INTUITION_LAYOUT_SEED_MARKER_KEY, 'intuition.layoutSeed.v1');
	});

	test('pins exactly explorer, search, scm, extensions in Cursor order', () => {
		const pinned = INTUITION_PINNED_VIEWLETS_SEED.filter(v => v.pinned);
		assert.deepStrictEqual(pinned.map(v => v.id), [
			'workbench.view.explorer',
			'workbench.view.search',
			'workbench.view.scm',
			'workbench.view.extensions',
		]);
	});

	test('known bundled containers are present but unpinned', () => {
		const unpinned = INTUITION_PINNED_VIEWLETS_SEED.filter(v => !v.pinned).map(v => v.id);
		for (const id of ['workbench.view.debug', 'workbench.view.remote', 'workbench.view.extension.test']) {
			assert.ok(unpinned.includes(id), `expected '${id}' to be seeded unpinned`);
		}
	});

	test('seed entries have the IPinnedViewContainer shape and strictly increasing order', () => {
		let lastOrder = -1;
		for (const entry of INTUITION_PINNED_VIEWLETS_SEED) {
			assert.strictEqual(typeof entry.id, 'string');
			assert.strictEqual(typeof entry.pinned, 'boolean');
			assert.strictEqual(typeof entry.visible, 'boolean');
			assert.strictEqual(typeof entry.order, 'number');
			assert.ok(entry.order > lastOrder, 'order values must be strictly increasing');
			lastOrder = entry.order;
		}
	});

	test('seed round-trips through JSON (what gets written to storage)', () => {
		const json = JSON.stringify(INTUITION_PINNED_VIEWLETS_SEED);
		assert.deepStrictEqual(JSON.parse(json), INTUITION_PINNED_VIEWLETS_SEED);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
export PATH="$PATH:/c/Windows/System32:/c/Windows"
npm run transpile-client && npm run test-node -- --grep "Intuition Layout Seed"
```

Expected: FAIL (cannot resolve `intuitionLayoutSeed.js` — module does not exist yet).

- [ ] **Step 3: Write the seed module**

`src/vs/workbench/common/intuition/intuitionLayoutSeed.ts`:

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * One-shot activity-bar layout seed (see
 * docs/superpowers/specs/2026-06-10-cursor-layout-design.md).
 *
 * Cursor's sidebar header shows four icons — files, search, source control,
 * extensions — with everything else behind the overflow dropdown. VS Code
 * auto-pins every view container, so on first run per profile Intuition seeds
 * the pinned-viewlets storage with this list instead. It is a DEFAULT, not a
 * lock: users can re-pin anything afterwards and the seed never re-applies
 * (guarded by the marker key below; bump its version to re-seed).
 */

/** Storage key the workbench reads pinned activity-bar items from (PROFILE scope). */
export const PINNED_VIEWLETS_STORAGE_KEY = 'workbench.activity.pinnedViewlets2';

/** Marker key recording that the seed has been applied to this profile. */
export const INTUITION_LAYOUT_SEED_MARKER_KEY = 'intuition.layoutSeed.v1';

/** Matches the `IPinnedViewContainer` shape in `paneCompositeBar.ts`. */
export interface IIntuitionPinnedViewlet {
	readonly id: string;
	readonly pinned: boolean;
	readonly order: number;
	readonly visible: boolean;
}

export const INTUITION_PINNED_VIEWLETS_SEED: readonly IIntuitionPinnedViewlet[] = Object.freeze([
	// Cursor's four: files, search, git, extensions.
	{ id: 'workbench.view.explorer', pinned: true, order: 0, visible: true },
	{ id: 'workbench.view.search', pinned: true, order: 1, visible: true },
	{ id: 'workbench.view.scm', pinned: true, order: 2, visible: true },
	{ id: 'workbench.view.extensions', pinned: true, order: 3, visible: true },
	// Bundled containers demoted to the overflow dropdown.
	{ id: 'workbench.view.debug', pinned: false, order: 4, visible: false },
	{ id: 'workbench.view.remote', pinned: false, order: 5, visible: false },
	{ id: 'workbench.view.extension.test', pinned: false, order: 6, visible: false },
]);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run transpile-client && npm run test-node -- --grep "Intuition Layout Seed"
```

Expected: 5 passing.

- [ ] **Step 5: Typecheck and commit**

```bash
npm run compile-check-ts-native
git add src/vs/workbench/common/intuition/intuitionLayoutSeed.ts src/vs/workbench/test/common/intuition/intuitionLayoutSeed.test.ts
git commit -m "feat(layout): pinned-viewlets seed data for Cursor-style icon row"
```

---

### Task 2: Browser contribution — one-shot storage seed

**Files:**
- Create: `src/vs/workbench/browser/intuition/intuitionLayoutSeed.contribution.ts`
- Modify: `src/vs/workbench/workbench.common.main.ts` (add import next to the existing intuition imports, line ~14/203)

- [ ] **Step 1: Write the contribution**

`src/vs/workbench/browser/intuition/intuitionLayoutSeed.contribution.ts`:

```typescript
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IStorageService, StorageScope, StorageTarget } from '../../../platform/storage/common/storage.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../common/contributions.js';
import { INTUITION_LAYOUT_SEED_MARKER_KEY, INTUITION_PINNED_VIEWLETS_SEED, PINNED_VIEWLETS_STORAGE_KEY } from '../../common/intuition/intuitionLayoutSeed.js';

/**
 * Applies Intuition's Cursor-style activity-bar seed once per profile, BEFORE
 * the sidebar renders (BlockRestore). A failure here must never break startup:
 * worst case the profile keeps stock VS Code pinning.
 */
export class IntuitionLayoutSeedContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.intuitionLayoutSeed';

	constructor(@IStorageService storageService: IStorageService) {
		try {
			if (storageService.get(INTUITION_LAYOUT_SEED_MARKER_KEY, StorageScope.PROFILE)) {
				return;
			}
			storageService.store(PINNED_VIEWLETS_STORAGE_KEY, JSON.stringify(INTUITION_PINNED_VIEWLETS_SEED), StorageScope.PROFILE, StorageTarget.USER);
			storageService.store(INTUITION_LAYOUT_SEED_MARKER_KEY, true, StorageScope.PROFILE, StorageTarget.USER);
		} catch (error) {
			console.error('Intuition layout seed failed', error);
		}
	}
}

registerWorkbenchContribution2(IntuitionLayoutSeedContribution.ID, IntuitionLayoutSeedContribution, WorkbenchPhase.BlockRestore);
```

- [ ] **Step 2: Register in `workbench.common.main.ts`**

Find the existing line `import './contrib/intuitionCourse/browser/intuitionCourse.contribution.js';` (~line 203) and add directly below it:

```typescript
import './browser/intuition/intuitionLayoutSeed.contribution.js';
```

(If the hygiene hook complains about import grouping, place it instead next to the line-14 `import './common/intuition/intuitionDefaults.contribution.js';`.)

- [ ] **Step 3: Typecheck**

```bash
npm run compile-check-ts-native
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/vs/workbench/browser/intuition/intuitionLayoutSeed.contribution.ts src/vs/workbench/workbench.common.main.ts
git commit -m "feat(layout): seed Cursor-style pinned icons once per profile"
```

---

### Task 3: Centered icon row CSS

**Files:**
- Create: `src/vs/workbench/browser/intuition/media/intuitionLayout.css`
- Modify: `src/vs/workbench/browser/intuition/intuitionLayoutSeed.contribution.ts` (add CSS import)

- [ ] **Step 1: Write the CSS**

`src/vs/workbench/browser/intuition/media/intuitionLayout.css`:

```css
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/* Cursor-style: center the horizontal activity icon row in the sidebar header.
 * Selectors only match when the activity bar is on top ('.title > .composite-bar-container'
 * exists only in that layout), so side/bottom layouts are unaffected. */
.monaco-workbench .part.sidebar > .title > .composite-bar-container {
	flex: 1;
	justify-content: center;
}

.monaco-workbench .part.sidebar > .title > .composite-bar-container > .composite-bar > .monaco-action-bar .actions-container {
	justify-content: center;
}
```

- [ ] **Step 2: Import it from the contribution**

At the top of `intuitionLayoutSeed.contribution.ts`, first import line:

```typescript
import './media/intuitionLayout.css';
```

- [ ] **Step 3: Typecheck and commit**

```bash
npm run compile-check-ts-native
git add src/vs/workbench/browser/intuition/media/intuitionLayout.css src/vs/workbench/browser/intuition/intuitionLayoutSeed.contribution.ts
git commit -m "feat(layout): center the top activity icon row"
```

(Visual correctness is confirmed in Task 6; if centering needs a selector tweak, adjust this file then.)

---

### Task 4: Title-bar Course button (icon + label)

**Files:**
- Modify: `src/vs/workbench/browser/intuition/intuitionLayoutSeed.contribution.ts`
- Modify: `src/vs/workbench/browser/intuition/media/intuitionLayout.css`

The pattern is copied from `OpenWorkspaceInAgentsTitleBarWidget` in
`src/vs/workbench/contrib/chat/electron-browser/agentSessions/agentSessionsActions.ts:194`
(menu append + `IActionViewItemService` custom view item), except the label is
always visible. `TitleBarLeadingActionsGroup` (`'0_leading'`, exported from
`src/vs/workbench/browser/parts/titlebar/titlebarActions.ts`) renders the button
before the layout controls — Cursor's "Upgrade to Pro" slot.

- [ ] **Step 1: Append the menu item and register the view item**

Add to `intuitionLayoutSeed.contribution.ts` (new imports merged with existing ones):

```typescript
import { $, append } from '../../../base/browser/dom.js';
import { getDefaultHoverDelegate } from '../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { BaseActionViewItem, IBaseActionViewItemOptions } from '../../../base/browser/ui/actionbar/actionViewItems.js';
import { IAction } from '../../../base/common/actions.js';
import { Codicon } from '../../../base/common/codicons.js';
import { Disposable } from '../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../base/common/themables.js';
import { localize, localize2 } from '../../../nls.js';
import { MenuId, MenuRegistry } from '../../../platform/actions/common/actions.js';
import { IActionViewItemService } from '../../../platform/actions/browser/actionViewItemService.js';
import { IHoverService } from '../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../platform/instantiation/common/instantiation.js';
import { TitleBarLeadingActionsGroup } from '../parts/titlebar/titlebarActions.js';
import { OPEN_COURSE_COMMAND_ID } from '../../contrib/intuitionCourse/common/course.js';
```

```typescript
// --- title bar Course button (Cursor's "Upgrade to Pro" slot)

MenuRegistry.appendMenuItem(MenuId.TitleBar, {
	command: {
		id: OPEN_COURSE_COMMAND_ID,
		title: localize2('course.titleBar', "Course"),
		icon: Codicon.mortarBoard,
	},
	group: TitleBarLeadingActionsGroup,
	order: 0,
});

class CourseTitleBarWidget extends BaseActionViewItem {

	constructor(
		action: IAction,
		options: IBaseActionViewItemOptions | undefined,
		@IHoverService private readonly hoverService: IHoverService,
	) {
		super(undefined, action, options);
	}

	override render(container: HTMLElement): void {
		super.render(container);

		container.classList.add('intuition-course-titlebar-item');
		container.setAttribute('role', 'button');

		const hoverText = localize('course.titleBarHover', "Open Course Page");
		container.setAttribute('aria-label', hoverText);
		this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate('element'), container, hoverText));

		const icon = append(container, $('span.intuition-course-titlebar-icon'));
		icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.mortarBoard));
		icon.setAttribute('aria-hidden', 'true');

		const label = append(container, $('span.intuition-course-titlebar-label'));
		label.textContent = localize('course.titleBarLabel', "Course");
	}
}

class CourseTitleBarContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.intuitionCourseTitleBar';

	constructor(
		@IActionViewItemService actionViewItemService: IActionViewItemService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();
		this._register(actionViewItemService.register(MenuId.TitleBar, OPEN_COURSE_COMMAND_ID, (action, options) => {
			return instantiationService.createInstance(CourseTitleBarWidget, action, options);
		}, undefined));
	}
}

registerWorkbenchContribution2(CourseTitleBarContribution.ID, CourseTitleBarContribution, WorkbenchPhase.BlockRestore);
```

(Exact import specifiers may need path adjustments — let tsgo errors guide; do
NOT guess API names beyond what the agentSessions example uses.)

- [ ] **Step 2: Add the widget CSS**

Append to `media/intuitionLayout.css`:

```css
/* Title-bar Course button: always-visible icon + label. */
.monaco-workbench .intuition-course-titlebar-item {
	display: inline-flex;
	align-items: center;
	gap: 5px;
	height: 22px;
	padding: 0 8px;
	border-radius: 5px;
	cursor: pointer;
	color: var(--vscode-foreground);
}

.monaco-workbench .intuition-course-titlebar-item:hover,
.monaco-workbench .intuition-course-titlebar-item:focus-visible {
	background-color: var(--vscode-toolbar-hoverBackground);
	outline: none;
}

.monaco-workbench .intuition-course-titlebar-item > .intuition-course-titlebar-icon {
	font-size: 16px;
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run compile-check-ts-native
```

Expected: no errors (fix import paths if tsgo reports unresolved modules).

- [ ] **Step 4: Commit**

```bash
git add src/vs/workbench/browser/intuition/intuitionLayoutSeed.contribution.ts src/vs/workbench/browser/intuition/media/intuitionLayout.css
git commit -m "feat(course): labeled Course button in the title bar"
```

---

### Task 5: Remove the Course sidebar container

**Files:**
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/intuitionCourse.contribution.ts`
- Delete: `src/vs/workbench/contrib/intuitionCourse/browser/coursePane.ts`
- Delete: `src/vs/workbench/contrib/intuitionCourse/browser/media/coursePane.css`
- Possibly modify: `src/vs/workbench/contrib/intuitionCourse/common/course.ts` (drop dead constants)

- [ ] **Step 1: Check for other references**

```bash
grep -rn "CoursePane\|coursePane\|COURSE_VIEW_ID\|COURSE_CONTAINER_ID\|intuition-course-view-icon" src/vs --include=*.ts --include=*.css | grep -v intuitionCourse.contribution
```

Expected: hits only in `coursePane.ts` itself, `common/course.ts` (constant
definitions), and possibly tests. If anything else references them, stop and
re-assess before deleting.

- [ ] **Step 2: Edit `intuitionCourse.contribution.ts`**

Remove:
- the `registerIcon`/`courseViewIcon` block and the whole `registerViewContainer` + `registerViews` section (lines ~34-56 as of HEAD) — unless Step 1 showed `courseViewIcon` used elsewhere;
- imports that become unused: `registerIcon`, `ViewPaneContainer`, `SyncDescriptor` usage for the container (keep `SyncDescriptor` — still used by the editor pane registration), `IViewContainersRegistry`/`IViewsRegistry`/`ViewContainerLocation` imports, `ContextKeyExpr`, `MenuId`, `CoursePane` import, `COURSE_CONTAINER_ID`/`COURSE_VIEW_ID` imports;
- in `OpenCourseAction` (the `course.open` action): the whole `menu: {...}` property (its `when` referenced `COURSE_VIEW_ID`); keep `f1: true` and the icon;
- in `ResetCourseProgressAction`: the whole `menu: {...}` property; keep `f1: true`.

- [ ] **Step 3: Delete the pane files**

```bash
git rm src/vs/workbench/contrib/intuitionCourse/browser/coursePane.ts src/vs/workbench/contrib/intuitionCourse/browser/media/coursePane.css
rm -f out/vs/workbench/contrib/intuitionCourse/browser/coursePane.js out/vs/workbench/contrib/intuitionCourse/browser/media/coursePane.css
```

- [ ] **Step 4: Drop dead constants from `common/course.ts`**

If Step 1 showed `COURSE_CONTAINER_ID` / `COURSE_VIEW_ID` are now unreferenced
outside their definition, delete those two exports. Keep the command ID
constants.

- [ ] **Step 5: Typecheck and run course unit tests**

```bash
npm run compile-check-ts-native
npm run transpile-client && npm run test-node -- --grep "Course"
```

Expected: typecheck clean; existing courseService tests still pass.

- [ ] **Step 6: Commit**

```bash
git add -A src/vs/workbench/contrib/intuitionCourse
git commit -m "refactor(course): drop sidebar pane; Course lives in the title bar"
```

---

### Task 6: End-to-end verification (Playwright)

**Files:**
- Create (temp, delete after): `.verify-layout.cjs` in the repo root
- Create: `screenshots/2026-06-10-cursor-layout/` (committed verification screenshots)

- [ ] **Step 1: Rebuild `out/`**

```bash
npm run transpile-client
```

- [ ] **Step 2: Write the driver**

`.verify-layout.cjs` (same skeleton as the previous verification — dev mode:
repo root is the FIRST Electron arg, workspace second):

```javascript
const { _electron } = require('playwright');
const fs = require('fs');
const os = require('os');
const path = require('path');

(async () => {
	const outDir = path.join(__dirname, 'screenshots', '2026-06-10-cursor-layout');
	fs.mkdirSync(outDir, { recursive: true });
	const userData = fs.mkdtempSync(path.join(os.tmpdir(), 'intuition-data-'));
	const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'intuition-ws-'));

	const env = { ...process.env, VSCODE_DEV: '1', NODE_ENV: 'development', VSCODE_SKIP_PRELAUNCH: '1' };
	delete env.ELECTRON_RUN_AS_NODE;

	const launchArgs = {
		executablePath: path.join(__dirname, '.build', 'electron', 'Intuition.exe'),
		args: [
			__dirname, // dev mode: first arg is the app path (repo root)
			workspace,
			'--user-data-dir=' + userData,
			'--no-cached-data',
			'--disable-workspace-trust',
			'--skip-welcome',
			'--skip-release-notes',
			'--disable-extension=vscode.vscode-api-tests',
		],
		env,
		timeout: 60000,
	};

	// --- launch 1: fresh profile, seed applies
	let app = await _electron.launch(launchArgs);
	let page = await app.firstWindow();
	await page.waitForSelector('.monaco-workbench', { timeout: 60000 });
	await page.waitForTimeout(3000);

	// icon row: visible pinned composites in the sidebar header
	const iconIds = await page.$$eval(
		'.part.sidebar .title .composite-bar .monaco-action-bar .action-item [class*="action-label"]',
		els => els.map(e => e.getAttribute('aria-label'))
	);
	console.log('icon row aria-labels:', JSON.stringify(iconIds));

	// course button present in title bar?
	const courseBtn = await page.$('.intuition-course-titlebar-item');
	console.log('course title-bar button present:', !!courseBtn);

	await page.screenshot({ path: path.join(outDir, '01-fresh-launch.png') });

	// click it -> course editor opens
	await courseBtn.click();
	await page.waitForSelector('.course-page-content', { timeout: 15000 });
	await page.waitForTimeout(1000);
	await page.screenshot({ path: path.join(outDir, '02-course-from-titlebar.png') });
	console.log('course editor opened from title bar');

	await app.close();

	// --- launch 2: same profile, marker present -> seed must NOT re-apply
	app = await _electron.launch(launchArgs);
	page = await app.firstWindow();
	await page.waitForSelector('.monaco-workbench', { timeout: 60000 });
	await page.waitForTimeout(3000);
	await page.screenshot({ path: path.join(outDir, '03-relaunch-persisted.png') });
	console.log('relaunch OK');
	await app.close();

	console.log('VERIFY OK —', outDir);
})().catch(err => { console.error('VERIFY FAILED:', err.message); process.exit(1); });
```

- [ ] **Step 3: Run it and inspect screenshots**

```bash
export PATH="$PATH:/c/Windows/System32:/c/Windows"
node .verify-layout.cjs
```

Expected console: icon labels ≈ Explorer / Search / Source Control / Extensions
(plus the "Additional Views" overflow item), `course title-bar button present: true`,
`course editor opened from title bar`, `relaunch OK`, `VERIFY OK`.

**Read all three PNGs with the Read tool and actually look at them:**
- `01`: four icons + "⋯" centered atop the sidebar, NO Course icon anywhere in
  the sidebar, labeled "🎓 Course" button in the title bar right, gear/accounts
  also top right.
- `02`: full-page Course editor open.
- `03`: same icon arrangement persists after relaunch.

If centering is off, adjust `intuitionLayout.css` selectors, re-run
`npm run transpile-client`, and repeat. If the Course button is missing, check
the contribution loaded (look for `intuitionLayoutSeed` errors in the console
output Playwright echoes).

- [ ] **Step 4: Clean up and commit screenshots**

```bash
rm .verify-layout.cjs
git add screenshots/2026-06-10-cursor-layout
git commit -m "docs(layout): Cursor-style layout verification screenshots"
```

---

### Task 7: Final gate

- [ ] **Step 1: Full check battery**

```bash
npm run compile-check-ts-native
npm run test-node -- --grep "Intuition"
git status --short
```

Expected: typecheck clean; all Intuition suites pass (Defaults + Layout Seed +
Course); working tree clean (everything committed).

- [ ] **Step 2: Confirm spec coverage**

Re-read `docs/superpowers/specs/2026-06-10-cursor-layout-design.md` § Design
1-4 and check each against the commits. All four must be implemented; the
"Testing" section's three manual checks are covered by Task 6.
