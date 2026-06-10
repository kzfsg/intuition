/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { disposableTimeout } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { CourseLevel, ICourse } from '../common/course.js';
import { CourseGenerationState, ICourseGenerationOptions, ICourseGenerationProgress, ICourseProvider } from '../common/courseService.js';

/**
 * Simulated generation pipeline over a hand-written course that teaches this
 * very codebase: plays staged "indexing" progress on timers, then serves the
 * curriculum as an outline with lazily resolved lesson bodies. Stays after
 * the BYOK pipeline (sub-project B) ships, as the dev/fallback provider that
 * exercises every lifecycle state without a key.
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

const mockCourse: ICourse = {
	id: 'intuition-workbench-101',
	title: 'the intuition workbench',
	level: CourseLevel.Codebase,
	modules: [{
		id: 'workbench-architecture',
		title: 'workbench architecture',
		lessons: [
			{
				id: 'services-di',
				title: 'services & dependency injection',
				content: `# Services & dependency injection

Almost everything in this codebase is a **service**: an interface, a decorator, and one or more implementations.

A service is declared with \`createDecorator\` in a \`common/\` file:

\`\`\`ts
export const ICourseService = createDecorator<ICourseService>('intuitionCourseService');
\`\`\`

Consumers never construct services. They ask for them in the constructor, and the instantiation service injects them:

\`\`\`ts
constructor(
	@IStorageService private readonly storageService: IStorageService
) { }
\`\`\`

An implementation is bound with \`registerSingleton(ICourseService, CourseService, InstantiationType.Delayed)\` — *Delayed* means it is not created until someone first asks for it.

**Read in this repo:**
- \`src/vs/platform/instantiation/common/instantiation.ts\` — \`createDecorator\`
- \`src/vs/workbench/contrib/intuitionCourse/common/courseService.ts\` — a small, real example
`,
				quiz: {
					question: 'Which function declares a new service identifier?',
					options: ['registerSingleton', 'createDecorator', 'invokeFunction'],
					correctIndex: 1
				}
			},
			{
				id: 'contributions',
				title: 'contributions: how features plug in',
				content: `# Contributions: how features plug in

Features do not get called by the core — they **register themselves** when their module loads.

A feature area lives in \`src/vs/workbench/contrib/<name>/\` and exposes a single \`*.contribution.ts\` file whose top-level code registers everything: views, commands, settings, services.

The workbench pulls a contribution in with **one import line** in \`src/vs/workbench/workbench.common.main.ts\`. Delete the line and the feature vanishes; nothing else references it.

This is why the Intuition fork strategy works: our product code (like this Course tab) is one owned directory plus one import line — an almost-zero merge surface against upstream.

**Read in this repo:**
- \`src/vs/workbench/workbench.common.main.ts\` — the import manifest
- \`src/vs/workbench/contrib/intuitionCourse/browser/intuitionCourse.contribution.ts\` — the file that registered the view you are reading this in
`,
				quiz: {
					question: 'How does the workbench learn that a contrib feature exists?',
					options: ['a JSON manifest', 'reflection over the contrib folder', 'an import line runs its registration code'],
					correctIndex: 2
				}
			},
			{
				id: 'views-containers',
				title: 'views & view containers',
				content: `# Views & view containers

The sidebar, panel, and auxiliary bar are all populated by the same mechanism:

1. Register a **view container** (\`IViewContainersRegistry.registerViewContainer\`) with an id, title, icon, and a location — \`ViewContainerLocation.Sidebar\`, \`.Panel\`, or \`.AuxiliaryBar\`.
2. Register **views** into it (\`IViewsRegistry.registerViews\`), each with a \`ctorDescriptor\` pointing at a \`ViewPane\` subclass.
3. The \`ViewPane\` renders its DOM in \`renderBody(container)\`.

Users can drag any view anywhere; the registry location is only the default. State (sizes, visibility, order) is persisted per container under its \`storageId\`.

**Read in this repo:**
- \`src/vs/workbench/contrib/markers/browser/markers.contribution.ts\` — a compact, complete example
- \`src/vs/workbench/contrib/intuitionCourse/browser/coursePane.ts\` — the pane rendering this course
`,
				quiz: {
					question: 'Where does a ViewPane build its DOM?',
					options: ['renderBody(container)', 'its constructor', 'layout(width, height)'],
					correctIndex: 0
				}
			},
			{
				id: 'intuition-overlay',
				title: 'the intuition overlay',
				content: `# The Intuition overlay

Intuition pins upstream VS Code and syncs rarely, so the fork's opinions are concentrated where merges cannot hurt:

- **Setting defaults** live in one file, \`src/vs/workbench/common/intuition/intuitionDefaults.contribution.ts\`, registered through \`registerDefaultConfigurations\` with \`preventExperimentOverride: true\`. Every value is a default, not a lock — users can override all of them.
- **Product code** (like this Course tab) lives in Intuition-owned directories under \`contrib/\`.
- **Nothing upstream is deleted.** Bloat is disabled via defaults; four legacy built-in extensions are excluded by build lists.

A drift-alarm unit test asserts every overridden setting key still exists in the configuration registry, so an upstream rename fails loudly at sync time instead of silently no-opping.

**Read in this repo:**
- \`docs/superpowers/specs/2026-06-10-barebones-layout-design.md\` — the fork strategy, with reasoning
- \`src/vs/workbench/common/intuition/intuitionDefaults.contribution.ts\`
`,
				quiz: {
					question: 'How does Intuition turn off upstream bloat?',
					options: ['deletes the code', 'registers setting defaults in one owned file', 'patches each feature in place'],
					correctIndex: 1
				}
			}
		]
	}]
};
