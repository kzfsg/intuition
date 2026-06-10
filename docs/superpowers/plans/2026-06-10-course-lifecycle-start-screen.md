# Course Lifecycle + Start Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** User-initiated course generation: start screen (consent + level picker) → simulated indexing with staged progress → course outline with lazy lesson bodies, cached per workspace with a re-index path.

**Architecture:** `ICourseProvider` grows a generation state machine (`notStarted | indexing | ready | error`) plus lazy `provideLessonContent`; `CourseService` forwards state, caches the generated course in workspace storage (cache ⇒ Ready without touching the provider), and exposes `reindex()`. `CourseEditor` renders one of four lifecycle screens by state. `MockCourseProvider` simulates the pipeline on timers so everything is real-app verifiable without keys.

**Tech Stack:** VS Code workbench (services/editor panes), `IStorageService` (WORKSPACE scope), `ISearchService` + `QueryBuilder` for the file count, Playwright `_electron` for verification.

**Spec:** `docs/superpowers/specs/2026-06-10-course-lifecycle-start-screen-design.md`

**Build environment (this machine):** `export PATH="$PATH:/c/Windows/System32:/c/Windows"` before npm in bash. Typecheck `npm run compile-check-ts-native`; transpile `npm run transpile-client`; unit tests `npm run test-node -- --run out/<path>.test.js` (`--grep` does not filter). Hygiene checks the STAGED copy — re-`git add` after fixing a failed commit. Dev Electron: first arg = repo root.

---

### Task 1: Protocol v2 + service (model layer, TDD)

**Files:**
- Modify: `src/vs/workbench/contrib/intuitionCourse/common/course.ts`
- Modify: `src/vs/workbench/contrib/intuitionCourse/common/courseService.ts`
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/courseServiceImpl.ts`
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/mockCourseProvider.ts` (v2 protocol)
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/courseEditor.ts` (one-line compile fix only)
- Test: `src/vs/workbench/contrib/intuitionCourse/test/browser/courseService.test.ts`

- [ ] **Step 1: Extend the data model.** In `common/course.ts`, after `RESET_PROGRESS_COMMAND_ID` add:

```typescript
export const REINDEX_COMMAND_ID = 'intuition.course.reindex';

/**
 * Which knowledge layer is the learner's frontier ("one novel layer at a
 * time"): the course assumes everything below it and teaches at it.
 */
export const enum CourseLevel {
	Language = 'language',
	Framework = 'framework',
	Codebase = 'codebase',
}
```

Change `ICourseLesson.content` to optional with doc:

```typescript
	/** Lesson body, markdown. Undefined in an outline: resolved lazily via the provider. */
	readonly content?: string;
```

Extend `ICourse`:

```typescript
export interface ICourse {
	readonly id: string;
	readonly title: string;
	readonly level: CourseLevel;
	/** Short commit hash the course was indexed at; undefined outside a git repo. */
	readonly indexedCommit?: string;
	readonly modules: readonly ICourseModule[];
}
```

- [ ] **Step 2: Protocol v2.** Replace `ICourseProvider` in `common/courseService.ts` and extend `ICourseService` (new imports: `CourseLevel` from `./course.js`):

```typescript
export const enum CourseGenerationState {
	NotStarted = 'notStarted',
	Indexing = 'indexing',
	Ready = 'ready',
	Error = 'error',
}

export interface ICourseGenerationProgress {
	/** Human-readable stage, e.g. "Tracing flows…". */
	readonly stage: string;
	/** 0..100 when determinate. */
	readonly percent?: number;
}

export interface ICourseGenerationOptions {
	readonly level: CourseLevel;
}

/**
 * The generation seam. v1 registers a simulated provider; the BYOK pipeline
 * (sub-project B) registers here with no changes to the service or the view.
 */
export interface ICourseProvider {
	readonly onDidChangeGenerationState: Event<void>;
	getGenerationState(): CourseGenerationState;
	/** Only meaningful while Indexing. */
	getGenerationProgress(): ICourseGenerationProgress | undefined;
	/** Only meaningful while Error. */
	getGenerationError(): string | undefined;
	/** NotStarted/Error -> Indexing. */
	startGeneration(options: ICourseGenerationOptions): void;
	/** Indexing -> NotStarted. */
	cancelGeneration(): void;
	/** Ready/Error -> NotStarted (re-index). */
	reset(): void;
	/** Resolves the course outline; undefined unless Ready. */
	provideCourse(): Promise<ICourse | undefined>;
	/** Resolves a lazy lesson body (markdown). */
	provideLessonContent(lessonId: string): Promise<string>;
}
```

Add to `ICourseService` (below `getCourse()`):

```typescript
	/** Cached course present => Ready regardless of the provider. */
	getGenerationState(): CourseGenerationState;
	getGenerationProgress(): ICourseGenerationProgress | undefined;
	getGenerationError(): string | undefined;
	startGeneration(options: ICourseGenerationOptions): void;
	cancelGeneration(): void;
	/** Clears the workspace course cache and resets the provider to NotStarted. */
	reindex(): void;
	/** Lesson body: eager content, memoized lazy resolution otherwise. */
	getLessonContent(lessonId: string): Promise<string>;
```

- [ ] **Step 3: Write the failing tests.** Replace `TestProvider` in `courseService.test.ts` with a controllable v2 fake and add a new suite. Full additions (existing tests stay; they now construct `TestProvider` the same way — it keeps `provideCourse` semantics by starting in Ready when given a course):

```typescript
import { Emitter } from '../../../../../base/common/event.js';
import { CourseGenerationState, ICourseGenerationOptions, ICourseGenerationProgress, ICourseProvider } from '../../common/courseService.js';
import { CourseLevel, ICourse, LessonState } from '../../common/course.js';

class TestProvider implements ICourseProvider {
	private readonly _onDidChangeGenerationState = new Emitter<void>();
	readonly onDidChangeGenerationState = this._onDidChangeGenerationState.event;

	state = CourseGenerationState.Ready; // legacy tests: course immediately available
	progress: ICourseGenerationProgress | undefined;
	error: string | undefined;
	contentRequests: string[] = [];

	constructor(private course: ICourse | undefined = testCourse) { }

	getGenerationState() { return this.state; }
	getGenerationProgress() { return this.progress; }
	getGenerationError() { return this.error; }
	startGeneration(_options: ICourseGenerationOptions) { this.setState(CourseGenerationState.Indexing); }
	cancelGeneration() { this.setState(CourseGenerationState.NotStarted); }
	reset() { this.setState(CourseGenerationState.NotStarted); }
	async provideCourse() { return this.state === CourseGenerationState.Ready ? this.course : undefined; }
	async provideLessonContent(lessonId: string) { this.contentRequests.push(lessonId); return `lazy:${lessonId}`; }
	setState(state: CourseGenerationState) { this.state = state; this._onDidChangeGenerationState.fire(); }
}
```

`testCourse` gains the new required field: `level: CourseLevel.Codebase,` (after `title`), and lesson `l3` becomes lazy: `{ id: 'l3', title: 'third' }` (no `content`). New tests appended to the suite:

```typescript
	test('generation state forwards from the provider; no provider means NotStarted', () => {
		const { service } = createService();
		assert.strictEqual(service.getGenerationState(), CourseGenerationState.NotStarted);
		const provider = new TestProvider();
		provider.state = CourseGenerationState.NotStarted;
		store.add(service.registerProvider(provider));
		assert.strictEqual(service.getGenerationState(), CourseGenerationState.NotStarted);
		service.startGeneration({ level: CourseLevel.Codebase });
		assert.strictEqual(service.getGenerationState(), CourseGenerationState.Indexing);
	});

	test('state changes fire onDidChangeCourse', () => {
		const { service } = createService();
		const provider = new TestProvider();
		provider.state = CourseGenerationState.NotStarted;
		store.add(service.registerProvider(provider));
		let fired = 0;
		store.add(service.onDidChangeCourse(() => fired++));
		provider.setState(CourseGenerationState.Indexing);
		provider.setState(CourseGenerationState.Ready);
		assert.ok(fired >= 2);
	});

	test('reaching Ready caches the course; a fresh service serves it without a ready provider', async () => {
		const storageService = new TestStorageService();
		const { service } = createService(storageService);
		store.add(service.registerProvider(new TestProvider()));
		assert.strictEqual((await service.getCourse())?.id, 'test-course');

		const second = store.add(new CourseService(storageService));
		const coldProvider = new TestProvider(undefined);
		coldProvider.state = CourseGenerationState.NotStarted;
		store.add(second.registerProvider(coldProvider));
		assert.strictEqual(second.getGenerationState(), CourseGenerationState.Ready);
		assert.strictEqual((await second.getCourse())?.id, 'test-course');
	});

	test('getLessonContent: eager content served directly, lazy resolved once and memoized', async () => {
		const { service } = createService();
		const provider = new TestProvider();
		store.add(service.registerProvider(provider));
		await service.getCourse();
		assert.strictEqual(await service.getLessonContent('l1'), '# one');
		assert.strictEqual(await service.getLessonContent('l3'), 'lazy:l3');
		assert.strictEqual(await service.getLessonContent('l3'), 'lazy:l3');
		assert.deepStrictEqual(provider.contentRequests, ['l3']);
	});

	test('resolved lazy content is persisted into the cache', async () => {
		const storageService = new TestStorageService();
		const { service } = createService(storageService);
		store.add(service.registerProvider(new TestProvider()));
		await service.getCourse();
		await service.getLessonContent('l3');

		const second = store.add(new CourseService(storageService));
		const coldProvider = new TestProvider(undefined);
		coldProvider.state = CourseGenerationState.NotStarted;
		store.add(second.registerProvider(coldProvider));
		assert.strictEqual(await second.getLessonContent('l3'), 'lazy:l3');
		assert.deepStrictEqual(coldProvider.contentRequests, []);
	});

	test('reindex clears the cache, resets the provider, and fires change', async () => {
		const { service } = createService();
		const provider = new TestProvider();
		store.add(service.registerProvider(provider));
		await service.getCourse();
		let fired = 0;
		store.add(service.onDidChangeCourse(() => fired++));
		service.reindex();
		assert.strictEqual(provider.state, CourseGenerationState.NotStarted);
		assert.strictEqual(service.getGenerationState(), CourseGenerationState.NotStarted);
		assert.strictEqual(await service.getCourse(), undefined);
		assert.ok(fired >= 1);
	});

	test('malformed cache JSON is dropped, not fatal', async () => {
		const storageService = new TestStorageService();
		storageService.store('intuition.course.cache', '{nope', StorageScope.WORKSPACE, StorageTarget.MACHINE);
		const { service } = createService(storageService);
		const provider = new TestProvider();
		provider.state = CourseGenerationState.NotStarted;
		store.add(service.registerProvider(provider));
		assert.strictEqual(service.getGenerationState(), CourseGenerationState.NotStarted);
	});
```

(Imports for the last test: `StorageScope, StorageTarget` from `'../../../../../platform/storage/common/storage.js'`.)

- [ ] **Step 4: Run tests — expect compile/behavior failures.**

`npm run transpile-client && npm run test-node -- --run out/vs/workbench/contrib/intuitionCourse/test/browser/courseService.test.js` → FAIL (new members missing).

- [ ] **Step 5: Implement the service.** In `courseServiceImpl.ts`: new imports `CourseGenerationState, ICourseGenerationOptions, ICourseGenerationProgress` from `../common/courseService.js`. New fields + members:

```typescript
	private static readonly CACHE_KEY = 'intuition.course.cache';

	private providerListener: IDisposable | undefined;
	private contentMemo = new Map<string, string>();
	/** undefined = not read yet; null = read, absent. */
	private cachedCourse: ICourse | null | undefined = undefined;
```

`registerProvider` additionally subscribes (and the returned disposable also disposes the listener):

```typescript
		this.providerListener = provider.onDidChangeGenerationState(() => {
			this.course = undefined;
			if (provider.getGenerationState() === CourseGenerationState.Ready) {
				this.getCourse().then(course => {
					if (course && this.provider === provider) {
						this.saveCache(course);
					}
				});
			}
			this._onDidChangeCourse.fire();
		});
```

(in the `toDisposable` cleanup add `this.providerListener?.dispose(); this.providerListener = undefined;`)

Cache helpers + new API:

```typescript
	private readCachedCourse(): ICourse | undefined {
		if (this.cachedCourse === undefined) {
			this.cachedCourse = null;
			const raw = this.storageService.get(CourseService.CACHE_KEY, StorageScope.WORKSPACE);
			if (raw) {
				try {
					this.cachedCourse = JSON.parse(raw);
				} catch {
					// malformed cache is dropped, never fatal
				}
			}
		}
		return this.cachedCourse ?? undefined;
	}

	private saveCache(course: ICourse): void {
		const merged: ICourse = {
			...course,
			modules: course.modules.map(m => ({
				...m,
				lessons: m.lessons.map(l => l.content === undefined && this.contentMemo.has(l.id) ? { ...l, content: this.contentMemo.get(l.id) } : l),
			})),
		};
		this.storageService.store(CourseService.CACHE_KEY, JSON.stringify(merged), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		this.cachedCourse = merged;
	}

	getGenerationState(): CourseGenerationState {
		if (this.readCachedCourse()) {
			return CourseGenerationState.Ready;
		}
		return this.provider?.getGenerationState() ?? CourseGenerationState.NotStarted;
	}

	getGenerationProgress(): ICourseGenerationProgress | undefined {
		return this.readCachedCourse() ? undefined : this.provider?.getGenerationProgress();
	}

	getGenerationError(): string | undefined {
		return this.readCachedCourse() ? undefined : this.provider?.getGenerationError();
	}

	startGeneration(options: ICourseGenerationOptions): void {
		this.provider?.startGeneration(options);
	}

	cancelGeneration(): void {
		this.provider?.cancelGeneration();
	}

	reindex(): void {
		this.storageService.remove(CourseService.CACHE_KEY, StorageScope.WORKSPACE);
		this.cachedCourse = undefined;
		this.contentMemo.clear();
		this.course = undefined;
		this.lessonOrder = [];
		this.provider?.reset();
		this._onDidChangeCourse.fire();
	}

	async getLessonContent(lessonId: string): Promise<string> {
		const lesson = this.getLesson(lessonId);
		if (lesson?.content !== undefined) {
			return lesson.content;
		}
		const memo = this.contentMemo.get(lessonId);
		if (memo !== undefined) {
			return memo;
		}
		if (!this.provider) {
			throw new Error('Intuition Course: no provider to resolve lesson content');
		}
		const content = await this.provider.provideLessonContent(lessonId);
		this.contentMemo.set(lessonId, content);
		const course = await this.getCourse();
		if (course) {
			this.saveCache(course);
		}
		return content;
	}
```

`getCourse()` gains cache precedence — replace the body's provider branch:

```typescript
	getCourse(): Promise<ICourse | undefined> {
		if (!this.course) {
			const cached = this.readCachedCourse();
			const provider = this.provider;
			if (cached) {
				this.lessonOrder = cached.modules.flatMap(m => m.lessons);
				this.storageKey = `intuition.course.progress.${cached.id}`;
				this.loadProgress();
				this.course = Promise.resolve(cached);
			} else {
				this.course = provider
					? provider.provideCourse().then(course => {
						if (this.provider !== provider) {
							return undefined;
						}
						if (course) {
							this.lessonOrder = course.modules.flatMap(m => m.lessons);
							this.storageKey = `intuition.course.progress.${course.id}`;
							this.loadProgress();
						}
						return course;
					})
					: Promise.resolve(undefined);
			}
		}
		return this.course;
	}
```

`invalidate()` additionally: `this.contentMemo.clear();` (keep `cachedCourse` — the cache outlives provider churn).

- [ ] **Step 6: Mock provider v2 (minimal for tests; the staged simulation is tuned in Task 2).** Rewrite `mockCourseProvider.ts`:

```typescript
import { disposableTimeout } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { CourseLevel, ICourse } from '../common/course.js';
import { CourseGenerationState, ICourseGenerationOptions, ICourseGenerationProgress, ICourseProvider } from '../common/courseService.js';

/**
 * Simulated generation pipeline: plays staged "indexing" progress on timers,
 * then serves the hand-written curriculum as an outline with lazily resolved
 * lesson bodies. Stays after the BYOK pipeline ships, as the dev/fallback
 * provider that exercises every lifecycle state without a key.
 */
export class MockCourseProvider extends Disposable implements ICourseProvider {

	private static readonly STAGES = ['Mapping folders…', 'Finding entry points…', 'Reading the dialect…', 'Tracing flows…'];
	private static readonly STAGE_MILLIS = 1000;
	private static readonly LESSON_MILLIS = 600;

	private readonly _onDidChangeGenerationState = this._register(new Emitter<void>());
	readonly onDidChangeGenerationState = this._onDidChangeGenerationState.event;

	private state = CourseGenerationState.NotStarted;
	private progress: ICourseGenerationProgress | undefined;
	private level = CourseLevel.Codebase;
	private readonly timers = this._register(new DisposableStore());

	getGenerationState(): CourseGenerationState { return this.state; }
	getGenerationProgress(): ICourseGenerationProgress | undefined { return this.progress; }
	getGenerationError(): string | undefined { return undefined; }

	startGeneration(options: ICourseGenerationOptions): void {
		if (this.state === CourseGenerationState.Indexing) {
			return;
		}
		this.level = options.level;
		this.state = CourseGenerationState.Indexing;
		this.playStage(0);
		this._onDidChangeGenerationState.fire();
	}

	private playStage(index: number): void {
		if (index >= MockCourseProvider.STAGES.length) {
			this.progress = undefined;
			this.state = CourseGenerationState.Ready;
			this._onDidChangeGenerationState.fire();
			return;
		}
		this.progress = { stage: MockCourseProvider.STAGES[index], percent: Math.round(100 * index / MockCourseProvider.STAGES.length) };
		this._onDidChangeGenerationState.fire();
		this.timers.add(disposableTimeout(() => this.playStage(index + 1), MockCourseProvider.STAGE_MILLIS));
	}

	cancelGeneration(): void { this.toNotStarted(); }
	reset(): void { this.toNotStarted(); }

	private toNotStarted(): void {
		this.timers.clear();
		this.state = CourseGenerationState.NotStarted;
		this.progress = undefined;
		this._onDidChangeGenerationState.fire();
	}

	async provideCourse(): Promise<ICourse | undefined> {
		if (this.state !== CourseGenerationState.Ready) {
			return undefined;
		}
		// outline only: bodies resolve through provideLessonContent
		return {
			...mockCourse,
			level: this.level,
			modules: mockCourse.modules.map(m => ({ ...m, lessons: m.lessons.map(({ content: _content, ...rest }) => rest) })),
		};
	}

	provideLessonContent(lessonId: string): Promise<string> {
		const content = mockCourse.modules.flatMap(m => m.lessons).find(l => l.id === lessonId)?.content;
		return new Promise(resolve => this.timers.add(disposableTimeout(() => resolve(content ?? ''), MockCourseProvider.LESSON_MILLIS)));
	}
}
```

`mockCourse` literal: add `level: CourseLevel.Codebase,` after `title` (bodies stay in the literal — they feed `provideLessonContent`). In `intuitionCourse.contribution.ts`, `CourseProviderContribution` becomes `this._register(courseService.registerProvider(this._register(new MockCourseProvider())));`.

- [ ] **Step 7: Compile fix in the editor (full lazy UX lands in Task 3).** In `courseEditor.ts` `renderLesson`, change the markdown line to tolerate outline lessons:

```typescript
		const rendered = this.markdownRendererService.render(new MarkdownString(lesson.content ?? ''));
```

- [ ] **Step 8: Tests green + typecheck.**

`npm run transpile-client && npm run test-node -- --run out/vs/workbench/contrib/intuitionCourse/test/browser/courseService.test.js` → all passing (7 legacy + 7 new + error suite). `npm run compile-check-ts-native` → clean.

- [ ] **Step 9: Commit.** `git add -A src/vs/workbench/contrib/intuitionCourse && git commit -m "feat(course): generation lifecycle protocol, course cache, lazy lesson bodies"`

---

### Task 2: Lifecycle screens in the editor (start / indexing / error)

**Files:**
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/courseEditor.ts`
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/media/courseEditor.css`

- [ ] **Step 1: New editor dependencies.** Constructor adds:

```typescript
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@ISearchService private readonly searchService: ISearchService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
```

Imports: `IWorkspaceContextService` from `'../../../../platform/workspace/common/workspace.js'`; `ISearchService` from `'../../../services/search/common/search.js'`; `IInstantiationService` from `'../../../../platform/instantiation/common/instantiation.js'`; `QueryBuilder` from `'../../../services/search/common/queryBuilder.js'`; `CourseGenerationState` from `'../common/courseService.js'`; `CourseLevel` from `'../common/course.js'`; `CancellationToken` already imported.

New fields: `private selectedLevel: CourseLevel = CourseLevel.Codebase;` and `private fileCount: number | undefined;`.

- [ ] **Step 2: Branch `render()` on state.** At the top of `render()` after the clears, replace the `if (!this.course)` block with:

```typescript
		const state = this.courseService.getGenerationState();
		if (state !== CourseGenerationState.Ready || !this.course) {
			this.container?.classList.add('lifecycle');
			switch (state) {
				case CourseGenerationState.Indexing:
					this.renderIndexing(this.contentElement);
					return;
				case CourseGenerationState.Error:
					this.renderError(this.contentElement);
					return;
				default:
					this.renderStartScreen(this.contentElement);
					return;
			}
		}
		this.container?.classList.remove('lifecycle');
```

(`.lifecycle` lets CSS hide the empty nav rail and center the content pane.)

- [ ] **Step 3: The three screens.** Add methods:

```typescript
	// --- lifecycle screens

	private renderStartScreen(parent: HTMLElement): void {
		const screen = dom.append(parent, $('.course-start'));
		dom.append(screen, $(`.course-start-icon${ThemeIcon.asCSSSelector(Codicon.mortarBoard)}`));
		dom.append(screen, $('.course-start-title', undefined, localize('courseStart.title', "Learn this codebase")));

		const folder = this.contextService.getWorkspace().folders[0];
		dom.append(screen, $('.course-start-copy', undefined, folder
			? localize('courseStart.copy', "Intuition will scan {0} and use your configured model to build a course about this codebase.", folder.name)
			: localize('courseStart.noFolder', "Open a folder to turn it into a course.")));

		const scope = dom.append(screen, $('.course-start-scope'));
		this.updateScopeLine(scope);

		const levels = dom.append(screen, $('.course-start-levels'));
		this.renderLevelCard(levels, CourseLevel.Language, localize('courseStart.l1', "Language"), localize('courseStart.l1Desc', "New to the language itself"), false);
		this.renderLevelCard(levels, CourseLevel.Framework, localize('courseStart.l2', "Framework"), localize('courseStart.l2Desc', "Knows the language, not the framework"), false);
		this.renderLevelCard(levels, CourseLevel.Codebase, localize('courseStart.l3', "Codebase"), localize('courseStart.l3Desc', "Knows both — learning this repo's systems"), true);

		const start = dom.append(screen, $('button.course-start-button', undefined, localize('courseStart.start', "Start indexing")));
		if (!folder) {
			start.disabled = true;
		} else {
			this.renderDisposables.add(dom.addDisposableListener(start, dom.EventType.CLICK, () => {
				this.courseService.startGeneration({ level: this.selectedLevel });
			}));
		}
	}

	private renderLevelCard(parent: HTMLElement, level: CourseLevel, title: string, description: string, enabled: boolean): void {
		const card = dom.append(parent, $<HTMLButtonElement>('button.course-start-level'));
		card.classList.toggle('selected', enabled && this.selectedLevel === level);
		dom.append(card, $('.course-start-level-title', undefined, title));
		dom.append(card, $('.course-start-level-desc', undefined, description));
		if (!enabled) {
			card.disabled = true;
			dom.append(card, $('.course-start-level-soon', undefined, localize('courseStart.soon', "coming soon")));
		} else {
			this.renderDisposables.add(dom.addDisposableListener(card, dom.EventType.CLICK, () => {
				this.selectedLevel = level;
				this.render();
			}));
		}
	}

	private async updateScopeLine(scope: HTMLElement): Promise<void> {
		const folders = this.contextService.getWorkspace().folders;
		if (!folders.length) {
			return;
		}
		if (this.fileCount === undefined) {
			try {
				const queryBuilder = this.instantiationService.createInstance(QueryBuilder);
				const query = queryBuilder.file(folders, { maxResults: 10000 });
				const result = await this.searchService.fileSearch(query, CancellationToken.None);
				this.fileCount = result.results.length;
			} catch {
				return; // no scope line is fine
			}
		}
		if (scope.isConnected) {
			scope.textContent = localize('courseStart.scope', "~{0} source files", this.fileCount);
		}
	}

	private renderIndexing(parent: HTMLElement): void {
		const screen = dom.append(parent, $('.course-indexing'));
		dom.append(screen, $('.course-start-title', undefined, localize('courseIndexing.title', "Building your course…")));

		const progress = this.courseService.getGenerationProgress();
		const stages = dom.append(screen, $('.course-indexing-stages'));
		dom.append(stages, $('.course-indexing-stage.current', undefined, progress?.stage ?? localize('courseIndexing.preparing', "Preparing…")));

		const bar = dom.append(screen, $('.course-page-progress'));
		const fill = dom.append(bar, $('.course-page-progress-fill'));
		fill.style.width = `${progress?.percent ?? 5}%`;

		const cancel = dom.append(screen, $('button.course-indexing-cancel', undefined, localize('courseIndexing.cancel', "Cancel")));
		this.renderDisposables.add(dom.addDisposableListener(cancel, dom.EventType.CLICK, () => {
			this.courseService.cancelGeneration();
		}));
	}

	private renderError(parent: HTMLElement): void {
		const screen = dom.append(parent, $('.course-error'));
		dom.append(screen, $('.course-start-title', undefined, localize('courseError.title', "Course generation failed")));
		dom.append(screen, $('.course-start-copy', undefined, this.courseService.getGenerationError() ?? localize('courseError.unknown', "Unknown error.")));
		const retry = dom.append(screen, $('button.course-start-button', undefined, localize('courseError.retry', "Retry")));
		this.renderDisposables.add(dom.addDisposableListener(retry, dom.EventType.CLICK, () => {
			this.courseService.startGeneration({ level: this.selectedLevel });
		}));
	}
```

- [ ] **Step 4: CSS.** Append to `media/courseEditor.css` (follows the file's existing variable usage):

```css
/* --- generation lifecycle screens --- */

.intuition-course-editor.lifecycle .course-page-nav {
	display: none;
}

.intuition-course-editor.lifecycle .course-page-content {
	display: flex;
	align-items: center;
	justify-content: center;
}

.course-start,
.course-indexing,
.course-error {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 12px;
	max-width: 520px;
	text-align: center;
}

.course-start-icon {
	font-size: 48px !important;
	color: var(--vscode-textLink-foreground);
}

.course-start-title {
	font-size: 24px;
	font-weight: 600;
}

.course-start-copy,
.course-start-scope {
	color: var(--vscode-descriptionForeground);
}

.course-start-levels {
	display: flex;
	gap: 10px;
	margin-top: 8px;
}

.course-start-level {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 12px;
	border: 1px solid var(--vscode-widget-border, transparent);
	border-radius: 6px;
	background: var(--vscode-editorWidget-background);
	color: inherit;
	cursor: pointer;
	text-align: left;
}

.course-start-level.selected {
	border-color: var(--vscode-focusBorder);
	outline: 1px solid var(--vscode-focusBorder);
}

.course-start-level:disabled {
	opacity: 0.5;
	cursor: default;
}

.course-start-level-title {
	font-weight: 600;
}

.course-start-level-desc,
.course-start-level-soon {
	font-size: 12px;
	color: var(--vscode-descriptionForeground);
}

.course-start-level-soon {
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

.course-start-button,
.course-indexing-cancel {
	margin-top: 8px;
	padding: 6px 16px;
	border: none;
	border-radius: 4px;
	background: var(--vscode-button-background);
	color: var(--vscode-button-foreground);
	cursor: pointer;
}

.course-start-button:disabled {
	opacity: 0.5;
	cursor: default;
}

.course-indexing-cancel {
	background: var(--vscode-button-secondaryBackground);
	color: var(--vscode-button-secondaryForeground);
}

.course-indexing .course-page-progress {
	width: 320px;
}

.course-indexing-stage.current {
	font-weight: 600;
}
```

- [ ] **Step 5: Typecheck + commit.** `npm run compile-check-ts-native` clean, then `git add -A src/vs/workbench/contrib/intuitionCourse && git commit -m "feat(course): start screen, indexing progress, and error screens"`

---

### Task 3: Lazy lesson skeleton + staleness footer + re-index command

**Files:**
- Create: `src/vs/workbench/contrib/intuitionCourse/common/courseGitHead.ts`
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/courseEditor.ts`
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/media/courseEditor.css`
- Modify: `src/vs/workbench/contrib/intuitionCourse/browser/intuitionCourse.contribution.ts`

- [ ] **Step 1: HEAD helper.** New file `common/courseGitHead.ts`:

```typescript
/*--------------------------------------------------------------------------------------------- 
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';

/**
 * Best-effort short HEAD commit of a workspace root, read straight from
 * .git — no dependency on the git extension. Any failure returns undefined
 * (not a git repo, packed refs, detached worktree layouts, …).
 */
export async function readHeadCommit(fileService: IFileService, root: URI): Promise<string | undefined> {
	try {
		const head = (await fileService.readFile(URI.joinPath(root, '.git', 'HEAD'))).value.toString().trim();
		if (!head.startsWith('ref:')) {
			return head.slice(0, 7);
		}
		const ref = head.slice(4).trim();
		const commit = (await fileService.readFile(URI.joinPath(root, '.git', ...ref.split('/')))).value.toString().trim();
		return commit.slice(0, 7) || undefined;
	} catch {
		return undefined;
	}
}
```

- [ ] **Step 2: Stamp the mock course.** `MockCourseProvider` constructor gains services and `provideCourse` stamps the hash:

```typescript
	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
	) {
		super();
	}
```

In `provideCourse`, before the return: 

```typescript
		const root = this.contextService.getWorkspace().folders[0]?.uri;
		const indexedCommit = root ? await readHeadCommit(this.fileService, root) : undefined;
```

and include `indexedCommit,` in the returned object. In the contribution, the provider is now created via DI: `this._register(courseService.registerProvider(this._register(instantiationService.createInstance(MockCourseProvider))));` — `CourseProviderContribution`'s constructor gains `@IInstantiationService instantiationService: IInstantiationService`.

- [ ] **Step 3: Lazy lesson body in the editor.** In `renderLesson`, replace the markdown block with a skeleton-then-resolve flow:

```typescript
		const markdown = dom.append(lessonEl, $('.course-page-markdown'));
		if (lesson.content !== undefined) {
			const rendered = this.markdownRendererService.render(new MarkdownString(lesson.content));
			this.renderDisposables.add(rendered);
			markdown.appendChild(rendered.element);
		} else {
			markdown.classList.add('loading');
			for (let i = 0; i < 4; i++) {
				dom.append(markdown, $('.course-page-skeleton-line'));
			}
			this.courseService.getLessonContent(lesson.id).then(content => {
				if (!markdown.isConnected) {
					return; // re-rendered meanwhile
				}
				markdown.classList.remove('loading');
				dom.clearNode(markdown);
				const rendered = this.markdownRendererService.render(new MarkdownString(content));
				this.renderDisposables.add(rendered);
				markdown.appendChild(rendered.element);
			}, () => {
				if (markdown.isConnected) {
					markdown.classList.remove('loading');
					dom.clearNode(markdown);
					dom.append(markdown, $('.course-page-hint', undefined, localize('coursePage.contentError', "Couldn't load this lesson. Re-open it to retry.")));
				}
			});
		}
```

- [ ] **Step 4: Footer with indexed commit + re-index.** At the end of `renderNav` (after the modules loop):

```typescript
		const footer = dom.append(parent, $('.course-page-nav-footer'));
		if (course.indexedCommit) {
			const stamp = dom.append(footer, $('span.course-page-indexed', undefined,
				localize('coursePage.indexedAt', "indexed at {0}", course.indexedCommit)));
			this.decorateStaleness(stamp, course.indexedCommit);
		}
		const reindex = dom.append(footer, $('button.course-page-reindex', undefined, localize('coursePage.reindex', "Re-index")));
		this.renderDisposables.add(dom.addDisposableListener(reindex, dom.EventType.CLICK, () => {
			this.courseService.reindex();
		}));
```

with the staleness decorator (new import `readHeadCommit` from `'../common/courseGitHead.js'`, `IFileService` from `'../../../../platform/files/common/files.js'` injected as `@IFileService private readonly fileService: IFileService`):

```typescript
	private async decorateStaleness(stamp: HTMLElement, indexedCommit: string): Promise<void> {
		const root = this.contextService.getWorkspace().folders[0]?.uri;
		const head = root ? await readHeadCommit(this.fileService, root) : undefined;
		if (head && head !== indexedCommit && stamp.isConnected) {
			stamp.textContent += ' ' + localize('coursePage.stale', "(repository has changed since)");
			stamp.classList.add('stale');
		}
	}
```

- [ ] **Step 5: Re-index command.** In `intuitionCourse.contribution.ts` (import `REINDEX_COMMAND_ID`):

```typescript
registerAction2(class ReindexCourseAction extends Action2 {
	constructor() {
		super({
			id: REINDEX_COMMAND_ID,
			title: localize2('course.reindex', "Re-index Course"),
			category: localize2('intuition', "Intuition"),
			f1: true,
		});
	}

	override run(accessor: ServicesAccessor): void {
		accessor.get(ICourseService).reindex();
	}
});
```

- [ ] **Step 6: CSS.** Append to `courseEditor.css`:

```css
/* --- lazy body skeleton + nav footer --- */

.course-page-skeleton-line {
	height: 14px;
	margin: 10px 0;
	border-radius: 4px;
	background: var(--vscode-editorWidget-background);
	animation: course-skeleton-pulse 1.2s ease-in-out infinite;
}

.course-page-skeleton-line:nth-child(2) { width: 92%; }
.course-page-skeleton-line:nth-child(3) { width: 84%; }
.course-page-skeleton-line:nth-child(4) { width: 60%; }

@keyframes course-skeleton-pulse {
	50% { opacity: 0.45; }
}

.course-page-nav-footer {
	margin-top: auto;
	padding-top: 16px;
	display: flex;
	flex-direction: column;
	gap: 4px;
	font-size: 11px;
	color: var(--vscode-descriptionForeground);
}

.course-page-indexed.stale {
	color: var(--vscode-editorWarning-foreground, inherit);
}

.course-page-reindex {
	align-self: flex-start;
	padding: 0;
	border: none;
	background: none;
	color: var(--vscode-textLink-foreground);
	cursor: pointer;
}
```

(If `.course-page-nav` is not already `display: flex; flex-direction: column`, add that so `margin-top: auto` pins the footer.)

- [ ] **Step 7: Tests + typecheck + commit.**

`npm run transpile-client && npm run test-node -- --run out/vs/workbench/contrib/intuitionCourse/test/browser/courseService.test.js` green; `npm run compile-check-ts-native` clean.
`git add -A src/vs/workbench/contrib/intuitionCourse && git commit -m "feat(course): lazy lesson skeletons, indexed-commit footer, re-index command"`

---

### Task 4: End-to-end verification (Playwright)

**Files:**
- Create (temp, delete after): `.verify-course.cjs`
- Create: `screenshots/2026-06-10-course-lifecycle/`

- [ ] **Step 1: Rebuild.** `npm run transpile-client`

- [ ] **Step 2: Driver.** Same launch skeleton as `docs/superpowers/plans/2026-06-10-cursor-layout.md` Task 6 (repo root first arg, temp workspace + user-data). Flow, asserting via console output:

1. Launch; wait `.monaco-workbench`; run "Open Course Page" via the title-bar button (`.intuition-course-titlebar-item`).
2. Wait `.course-start`; assert level cards: `$$eval('.course-start-level', ...)` → 3 cards, exactly one enabled+selected; screenshot `01-start-screen.png`.
3. Click `.course-start-button`; wait `.course-indexing`; screenshot `02-indexing.png`.
4. Wait `.course-page-nav` (≤15s); screenshot `03-outline-ready.png`.
5. Click the second lesson in the rail (`.course-page-lesson.next` is locked-gated — click the active one's quiz path instead: assert `.course-page-skeleton-line` appears for the initially selected lesson, then wait for `.course-page-markdown h1`); screenshot `04-lesson-loaded.png`.
6. Assert footer: `.course-page-indexed` text matches `/indexed at [0-9a-f]{7}/`.
7. Close app; relaunch with the SAME user-data dir and workspace; open Course Page; assert it lands directly on `.course-page-nav` (no `.course-start`); screenshot `05-ready-from-cache.png`.
8. Click `.course-page-reindex`; wait `.course-start`; screenshot `06-after-reindex.png`. Close.

- [ ] **Step 3: Run + look at every screenshot with the Read tool.** Centering/copy/cards must look right; a blank pane is a failure. Fix, retranspile, re-run until clean.

- [ ] **Step 4: Clean up + commit.** `rm .verify-course.cjs && git add screenshots/2026-06-10-course-lifecycle && git commit -m "docs(course): lifecycle verification screenshots"`

---

### Task 5: Final gate

- [ ] **Step 1:** `npm run compile-check-ts-native` clean; `npm run test-node -- --run out/vs/workbench/contrib/intuitionCourse/test/browser/courseService.test.js --run out/vs/workbench/test/common/intuition/intuitionLayoutSeed.test.js --run out/vs/workbench/test/common/intuition/intuitionDefaults.test.js` all green; `git status --short` clean.
- [ ] **Step 2:** Re-read the spec §1–§6; confirm each design point maps to a commit. The spec's Testing section items must all have run.
