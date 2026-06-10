# Course Home + Level Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Course tab opens on a curriculum home — level toggle (Language/Framework/Codebase), chapter cards with lessons — backed by a three-curricula mock catalog; one index produces all levels, each with isolated progress.

**Architecture:** `ICourseCatalog` (one `ICourse` per level) replaces the single course as the provider's product; the service resolves the *active level's* course and persists the level per workspace. `CourseEditor`'s Ready state splits into `home`/`lesson` view modes. Mock curricula move to a dedicated `mockCurricula.ts`.

**Tech Stack:** VS Code workbench, `IStorageService` (WORKSPACE), Playwright `_electron`.

**Spec:** `docs/superpowers/specs/2026-06-10-course-home-levels-design.md`

**Build env:** same as `2026-06-10-course-lifecycle-start-screen.md` (PATH export, `compile-check-ts-native`, `transpile-client`, `test-node -- --run`, hygiene checks STAGED copies, dev Electron first arg = repo root).

---

### Task 1: Catalog model + service (TDD)

**Files:**
- Modify: `src/vs/workbench/contrib/intuitionCourse/common/course.ts`
- Modify: `src/vs/workbench/contrib/intuitionCourse/common/courseService.ts`
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/courseServiceImpl.ts`
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/mockCourseProvider.ts` (rename method only; full catalog in Task 2)
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/courseEditor.ts` (footer reads catalog hash)
- Test: `src/vs/workbench/contrib/intuitionCourse/test/browser/courseService.test.ts`

- [ ] **Step 1: Model.** In `course.ts`: remove `indexedCommit` from `ICourse`, add `readonly description?: string` to it, and add after `ICourse`:

```typescript
export interface ICourseCatalog {
	/** Short commit hash the catalog was indexed at; undefined outside a git repo. */
	readonly indexedCommit?: string;
	/** One course per level (a level may be absent). Lesson ids are catalog-unique. */
	readonly courses: readonly ICourse[];
}
```

- [ ] **Step 2: Protocol + service interface.** In `courseService.ts`: `ICourseProvider.provideCourse` becomes `provideCatalog(): Promise<ICourseCatalog | undefined>` (doc: "Resolves the catalog of per-level course outlines; undefined unless Ready."). `ICourseService` gains:

```typescript
	/** Resolves (and caches) the per-level catalog from the registered provider. */
	getCatalog(): Promise<ICourseCatalog | undefined>;
	/** The level whose course getCourse() resolves. Persisted per workspace; default Codebase. */
	getActiveLevel(): CourseLevel;
	setActiveLevel(level: CourseLevel): void;
```

(`getCourse()` doc updated: "Resolves the active level's course from the catalog.")

- [ ] **Step 3: Failing tests.** In `courseService.test.ts`: `TestProvider` serves a catalog of two small courses (codebase: existing `testCourse` minus `indexedCommit`; language: id `lang-course`, lessons `lang-l1` eager + `lang-l2` lazy), `provideCourse` renamed `provideCatalog` returning `{ indexedCommit: 'abc1234', courses }` when Ready. New tests:

```typescript
	test('getCourse resolves the active level (default Codebase)', async () => {
		const { service } = createService();
		store.add(service.registerProvider(new TestProvider()));
		assert.strictEqual(service.getActiveLevel(), CourseLevel.Codebase);
		assert.strictEqual((await service.getCourse())?.id, 'test-course');
	});

	test('setActiveLevel switches the course and fires onDidChangeCourse', async () => {
		const { service } = createService();
		store.add(service.registerProvider(new TestProvider()));
		await service.getCourse();
		let fired = 0;
		store.add(service.onDidChangeCourse(() => fired++));
		service.setActiveLevel(CourseLevel.Language);
		assert.strictEqual(service.getActiveLevel(), CourseLevel.Language);
		assert.strictEqual((await service.getCourse())?.id, 'lang-course');
		assert.ok(fired >= 1);
	});

	test('progress is isolated per level', async () => {
		const { service } = createService();
		store.add(service.registerProvider(new TestProvider()));
		await service.getCourse();
		service.completeLesson('l1');
		assert.deepStrictEqual(service.getProgress(), { done: 1, total: 3 });
		service.setActiveLevel(CourseLevel.Language);
		await service.getCourse();
		assert.deepStrictEqual(service.getProgress(), { done: 0, total: 2 });
		service.setActiveLevel(CourseLevel.Codebase);
		await service.getCourse();
		assert.deepStrictEqual(service.getProgress(), { done: 1, total: 3 });
	});

	test('active level persists across service instances sharing storage', async () => {
		const storageService = new TestStorageService();
		const { service } = createService(storageService);
		store.add(service.registerProvider(new TestProvider()));
		service.setActiveLevel(CourseLevel.Framework);
		const second = store.add(new CourseService(storageService));
		assert.strictEqual(second.getActiveLevel(), CourseLevel.Framework);
	});

	test('unknown active level falls back to the first course in the catalog', async () => {
		const { service } = createService();
		store.add(service.registerProvider(new TestProvider()));
		service.setActiveLevel(CourseLevel.Framework); // catalog has no framework course
		assert.strictEqual((await service.getCourse())?.id, 'test-course');
	});

	test('old single-course cache format is discarded', () => {
		const storageService = new TestStorageService();
		storageService.store('intuition.course.cache', JSON.stringify({ id: 'old', title: 'old', level: 'codebase', modules: [] }), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		const { service } = createService(storageService);
		const provider = new TestProvider();
		provider.state = CourseGenerationState.NotStarted;
		store.add(service.registerProvider(provider));
		assert.strictEqual(service.getGenerationState(), CourseGenerationState.NotStarted);
	});

	test('lazy content resolves across levels (catalog-unique ids)', async () => {
		const { service } = createService();
		const provider = new TestProvider();
		store.add(service.registerProvider(provider));
		service.setActiveLevel(CourseLevel.Language);
		assert.strictEqual(await service.getLessonContent('lang-l2'), 'lazy:lang-l2');
	});
```

Existing cache tests update to assert catalog ids; `reindex` test also asserts `getActiveLevel()` returns `CourseLevel.Codebase` after reindex.

- [ ] **Step 4: Run; expect failures.** `npm run transpile-client && npm run test-node -- --run out/vs/workbench/contrib/intuitionCourse/test/browser/courseService.test.js` → FAIL.

- [ ] **Step 5: Service implementation.** `courseServiceImpl.ts`:
  - Field renames: `cachedCourse` → `cachedCatalog: ICourseCatalog | null | undefined`; new `catalog: Promise<ICourseCatalog | undefined> | undefined`; new `LEVEL_KEY = 'intuition.course.activeLevel'`.
  - `getCatalog()`: same memoized resolve as old `getCourse` but via `provider.provideCatalog()`; on resolve, `saveCache(catalog)`. Cache read first: `readCachedCatalog()` parses and **rejects shapes without an Array `courses`**.
  - `getActiveLevel()`: storage read, validated against the three enum values, default Codebase. `setActiveLevel(level)`: store (WORKSPACE/MACHINE), reset `this.course = undefined`, fire `onDidChangeCourse`.
  - `getCourse()`: `const catalog = await this.getCatalog()` → `catalog.courses.find(c => c.level === active) ?? catalog.courses[0]` → set `lessonOrder`/`storageKey`/`loadProgress` for that course.
  - `saveCache(catalog)`: merge `contentMemo` into every course's lessons.
  - `getLessonContent`: search the **catalog** (all courses) for the lesson, not just the active course.
  - `reindex()`: also `storageService.remove(LEVEL_KEY, WORKSPACE)`.
  - Generation-state methods: read `readCachedCatalog()` for the Ready short-circuit.

- [ ] **Step 6: Mechanical updates to compile.** `mockCourseProvider.ts`: rename `provideCourse` → `provideCatalog`, returning `{ indexedCommit, courses: [outlineOf(mockCourse stamped level)] }` (full three-course catalog lands in Task 2). `courseEditor.ts`: footer/staleness — `renderNav` signature unchanged but the stamp comes from a new field `this.catalogCommit: string | undefined` set in `loadAndRender`/`setInput` via `(await this.courseService.getCatalog())?.indexedCommit`.

- [ ] **Step 7: Green + typecheck + commit.** Tests pass; `compile-check-ts-native` clean. `git add -A src/vs/workbench/contrib/intuitionCourse && git commit -m "feat(course): per-level course catalog with persisted active level"`

---

### Task 2: Mock curricula (three levels)

**Files:**
- Create: `src/vs/workbench/contrib/intuitionCourse/browser/mockCurricula.ts`
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/mockCourseProvider.ts`

- [ ] **Step 1: Move + author curricula.** `mockCurricula.ts` exports `mockCatalogCourses: readonly ICourse[]`:
  - **Codebase**: the existing `mockCourse` literal moved verbatim from `mockCourseProvider.ts`, plus `description: 'How this very repository is put together — services, contributions, and the course system itself.'`.
  - **Language** (`id: 'intuition-language-101'`, `title: 'TypeScript, from zero'`, `level: CourseLevel.Language`, `description: 'The language itself, taught through this repository\'s own code — no toy examples.'`). Chapters/lessons (all ids `lang-*`):
    1. *values & types*: `lang-values` "values, constants & types", `lang-interfaces` "describing shapes with interfaces", `lang-enums` "enums & literal types".
    2. *functions & control flow*: `lang-functions` "functions, arrows & this", `lang-async` "promises & async/await", `lang-narrowing` "narrowing & guards".
    3. *reading real code*: `lang-reading` "reading a real file top to bottom", `lang-generics` "generics in the wild", `lang-modules` "imports, exports & modules".
  - **Framework** (`id: 'intuition-framework-101'`, `title: 'the workbench framework'`, `level: CourseLevel.Framework`, `description: 'The framework this app is built on: how a VS Code-style workbench boots, lays out, and extends.'`). Chapters/lessons (ids `fw-*`):
    1. *the editor shell*: `fw-layout` "parts: how the window is laid out", `fw-editors` "editors & editor inputs", `fw-views` "views, view containers & the sidebar".
    2. *services as a framework*: `fw-services` "everything is a service", `fw-lifecycle` "startup phases & lazy creation", `fw-storage` "state: storage scopes & targets".
    3. *contributions & extension points*: `fw-contrib` "workbench contributions", `fw-actions` "actions, menus & the command palette", `fw-themes` "theming & product identity".
  - Stub body template (every Language/Framework lesson; `<Title>`/`<topic sentence>` filled per lesson with one concrete sentence about the topic):

```markdown
# <Title>

<topic sentence — one concrete statement of what this lesson covers.>

*This is a sample lesson. The generated course will teach this concept through real code from your repository.*
```

  - One quiz to demo mechanics: on `lang-values` — question "Which keyword declares a value that cannot be reassigned?", options `['let', 'const', 'var']`, correctIndex 1.

- [ ] **Step 2: Provider serves the catalog.** `mockCourseProvider.ts`: delete the moved literal; `provideCatalog` returns `{ indexedCommit, courses: mockCatalogCourses.map(outline) }` where `outline` strips `content` from every lesson (the existing map). `provideLessonContent` searches `mockCatalogCourses.flatMap(c => c.modules).flatMap(m => m.lessons)`.

- [ ] **Step 3: Verify + commit.** Tests still green; typecheck clean. `git add -A src/vs/workbench/contrib/intuitionCourse && git commit -m "feat(course): three-level mock curricula catalog"`

---

### Task 3: Home view + lesson back link + start screen unlock

**Files:**
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/courseEditor.ts`
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/media/courseEditor.css`

- [ ] **Step 1: View mode.** New field `private viewMode: 'home' | 'lesson' = 'home';`. In `setInput`/`setOptions`: a provided `selectedLessonId` sets `viewMode = 'lesson'`. In the Ready branch of `render()`: `home` → hide nav (`.lifecycle` class reused is wrong — add a distinct `.home` class on the container that hides `.course-page-nav` and lets content fill), call `renderHome(this.contentElement, this.course)`; `lesson` → existing nav+lesson path.

- [ ] **Step 2: `renderHome`.**

```typescript
	private renderHome(parent: HTMLElement, course: ICourse): void {
		const home = dom.append(parent, $('.course-home'));

		const toggle = dom.append(home, $('.course-home-levels', { role: 'tablist' }));
		const levels: [CourseLevel, string][] = [
			[CourseLevel.Language, localize('courseHome.language', "Language")],
			[CourseLevel.Framework, localize('courseHome.framework', "Framework")],
			[CourseLevel.Codebase, localize('courseHome.codebase', "Codebase")],
		];
		for (const [level, label] of levels) {
			const pill = dom.append(toggle, $<HTMLButtonElement>('button.course-home-level', { role: 'tab' }, label));
			pill.classList.toggle('active', course.level === level);
			this.renderDisposables.add(dom.addDisposableListener(pill, dom.EventType.CLICK, () => {
				this.courseService.setActiveLevel(level); // change event re-renders
			}));
		}

		dom.append(home, $('.course-home-title', undefined, course.title));
		if (course.description) {
			dom.append(home, $('.course-home-desc', undefined, course.description));
		}

		const progress = this.courseService.getProgress();
		dom.append(home, $('.course-page-meta', undefined,
			localize('coursePage.progress', "{0} of {1} lessons complete", progress.done, progress.total)));
		const bar = dom.append(home, $('.course-page-progress'));
		const fill = dom.append(bar, $('.course-page-progress-fill'));
		fill.style.width = progress.total ? `${Math.round(100 * progress.done / progress.total)}%` : '0';

		course.modules.forEach((module, i) => {
			const card = dom.append(home, $('.course-home-chapter'));
			dom.append(card, $('.course-home-chapter-title', undefined,
				localize('courseHome.chapter', "Chapter {0} · {1}", i + 1, module.title)));
			const list = dom.append(card, $('.course-page-lessons', { role: 'list' }));
			for (const lesson of module.lessons) {
				this.renderHomeLesson(list, lesson);
			}
		});

		const footer = dom.append(home, $('.course-page-nav-footer'));
		if (this.catalogCommit) {
			const stamp = dom.append(footer, $('span.course-page-indexed', undefined,
				localize('coursePage.indexedAt', "indexed at {0}", this.catalogCommit)));
			this.decorateStaleness(stamp, this.catalogCommit);
		}
		const reindex = dom.append(footer, $('button.course-page-reindex', undefined, localize('coursePage.reindex', "Re-index")));
		this.renderDisposables.add(dom.addDisposableListener(reindex, dom.EventType.CLICK, () => this.courseService.reindex()));
	}

	private renderHomeLesson(parent: HTMLElement, lesson: ICourseLesson): void {
		const state = this.courseService.getLessonState(lesson.id);
		const row = dom.append(parent, $<HTMLButtonElement>(`button.course-page-lesson.${state}`, { role: 'listitem' }));
		const icons: Record<LessonState, ThemeIcon> = {
			[LessonState.Done]: Codicon.check,
			[LessonState.Active]: Codicon.play,
			[LessonState.Next]: Codicon.arrowRight,
			[LessonState.Locked]: Codicon.lock,
		};
		dom.append(row, $(`.course-page-lesson-icon${ThemeIcon.asCSSSelector(icons[state])}`));
		dom.append(row, $('.course-page-lesson-title', undefined, lesson.title));
		if (state === LessonState.Active) {
			dom.append(row, $('.course-home-continue', undefined, localize('courseHome.continue', "Continue")));
		}
		if (state === LessonState.Locked) {
			row.disabled = true;
		} else {
			this.renderDisposables.add(dom.addDisposableListener(row, dom.EventType.CLICK, () => {
				this.selectedLessonId = lesson.id;
				this.viewMode = 'lesson';
				this.render();
			}));
		}
	}
```

(The footer moves here from `renderNav` — delete it there. Extract the icons record into a module-level constant `LESSON_STATE_ICONS` to avoid duplicating it across `renderNavLesson`/`renderHomeLesson`.)

- [ ] **Step 3: Back link in the lesson rail.** Top of `renderNav`, before the header:

```typescript
		const back = dom.append(parent, $('button.course-page-back', undefined,
			localize('coursePage.backHome', "← Course home")));
		this.renderDisposables.add(dom.addDisposableListener(back, dom.EventType.CLICK, () => {
			this.viewMode = 'home';
			this.render();
		}));
```

- [ ] **Step 4: Start screen unlock.** `renderStartScreen`: all three `renderLevelCard` calls pass `enabled: true`; selection sets `this.selectedLevel`. Copy line appended after the consent copy: `localize('courseStart.allLevels', "All levels are generated — you can switch anytime.")` as a second `.course-start-copy` div. Remove the "coming soon" tag path only if unused (keep the `enabled` param). After Start click also `this.courseService.setActiveLevel(this.selectedLevel)`.

- [ ] **Step 5: CSS.** Append:

```css
/* --- course home --- */

.intuition-course-editor.home .course-page-nav { display: none; }

.intuition-course-editor.home .course-page-content { display: block; }

.course-home {
	max-width: 720px;
	margin: 0 auto;
	padding: 32px 24px 48px;
	display: flex;
	flex-direction: column;
	gap: 12px;
}

.course-home-levels { display: flex; gap: 6px; margin-bottom: 12px; }

.course-home-level {
	padding: 4px 14px;
	border: 1px solid var(--vscode-widget-border, transparent);
	border-radius: 999px;
	background: var(--vscode-editorWidget-background);
	color: var(--vscode-descriptionForeground);
	cursor: pointer;
}

.course-home-level.active {
	background: var(--vscode-button-background);
	color: var(--vscode-button-foreground);
	border-color: transparent;
}

.course-home-title { font-size: 26px; font-weight: 600; }
.course-home-desc { color: var(--vscode-descriptionForeground); }

.course-home-chapter {
	margin-top: 12px;
	padding: 14px 16px;
	border: 1px solid var(--vscode-widget-border, transparent);
	border-radius: 8px;
	background: var(--vscode-editorWidget-background);
}

.course-home-chapter-title { font-weight: 600; margin-bottom: 8px; }

.course-home-continue {
	margin-left: auto;
	padding: 1px 10px;
	border-radius: 999px;
	background: var(--vscode-button-background);
	color: var(--vscode-button-foreground);
	font-size: 11px;
}

.course-page-back {
	align-self: flex-start;
	margin-bottom: 12px;
	padding: 0;
	border: none;
	background: none;
	color: var(--vscode-textLink-foreground);
	cursor: pointer;
}
```

- [ ] **Step 6: Verify + commit.** Typecheck clean; unit suite green. `git add -A src/vs/workbench/contrib/intuitionCourse && git commit -m "feat(course): curriculum home with level toggle; lesson view back link"`

---

### Task 4: End-to-end verification

**Files:** Create temp `.verify-home.cjs`; Create `screenshots/2026-06-10-course-home/`.

- [ ] **Step 1:** `npm run transpile-client`.
- [ ] **Step 2:** Driver (same skeleton incl. fake `.git` as `.verify-course.cjs` in the previous plan): open Course → start screen now shows 3 *enabled* cards (assert none disabled) `01-start-all-levels.png` → Start → wait home (`.course-home`) → assert pills, codebase active, chapter cards `02-home-codebase.png` → click Language pill → assert title "TypeScript, from zero" `03-home-language.png` → click Framework pill `04-home-framework.png` → click first lesson → lesson view with `.course-page-back` `05-lesson-with-back.png` → complete nothing, click back → home → relaunch same profile → lands on home with Framework still active `06-relaunch-active-level.png`.
- [ ] **Step 3:** Look at every screenshot with Read. Fix and re-run until right.
- [ ] **Step 4:** `rm .verify-home.cjs && git add screenshots/2026-06-10-course-home && git commit -m "docs(course): course home verification screenshots"`

---

### Task 5: Final gate

- [ ] `compile-check-ts-native` clean; course + intuition unit suites green; `git status --short` clean; spec §1–§5 each map to a commit.
