/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ICourse } from '../common/course.js';
import { ICourseProvider } from '../common/courseService.js';

/**
 * v1 placeholder provider: a hand-written course that teaches this very
 * codebase. It exists to drive the Course view with realistic data until the
 * BYOK generation pipeline replaces it; the lessons reference real files so
 * the tab is genuinely useful to Intuition contributors in the meantime.
 */
export class MockCourseProvider implements ICourseProvider {

	async provideCourse(): Promise<ICourse> {
		return mockCourse;
	}
}

const mockCourse: ICourse = {
	id: 'intuition-workbench-101',
	title: 'the intuition workbench',
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
