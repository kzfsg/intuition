/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CourseLevel, ICourse } from '../common/course.js';

/**
 * Hand-written mock curricula, one course per {@link CourseLevel}. The
 * Codebase course is fully written and teaches this very repository; the
 * Language and Framework courses are meaningful outlines with stub bodies
 * that demonstrate the pedagogy until the generation pipeline (sub-project B)
 * produces real ones.
 */

function stub(title: string, topic: string): string {
	return `# ${title}

${topic}

*This is a sample lesson. The generated course will teach this concept through real code from your repository.*
`;
}

const languageCourse: ICourse = {
	id: 'intuition-language-101',
	title: 'TypeScript, from zero',
	level: CourseLevel.Language,
	description: 'The language itself, taught through this repository\'s own code — no toy examples.',
	modules: [
		{
			id: 'lang-values-types',
			title: 'values & types',
			lessons: [
				{
					id: 'lang-values', title: 'values, constants & types',
					content: stub('Values, constants & types', 'How `const` and `let` declare values, and how TypeScript attaches a type to every one of them — inferred or written out.'),
					quiz: {
						question: 'Which keyword declares a value that cannot be reassigned?',
						options: ['let', 'const', 'var'],
						correctIndex: 1
					}
				},
				{ id: 'lang-interfaces', title: 'describing shapes with interfaces', content: stub('Describing shapes with interfaces', 'An `interface` names the shape of an object so functions can promise what they accept and return.') },
				{ id: 'lang-enums', title: 'enums & literal types', content: stub('Enums & literal types', 'When a value can only be one of a few things, enums and literal unions let the compiler enforce it.') },
			]
		},
		{
			id: 'lang-functions-flow',
			title: 'functions & control flow',
			lessons: [
				{ id: 'lang-functions', title: 'functions, arrows & this', content: stub('Functions, arrows & this', 'Function declarations versus arrow functions, and why `this` behaves differently between them.') },
				{ id: 'lang-async', title: 'promises & async/await', content: stub('Promises & async/await', 'How asynchronous work is represented as a Promise, and how `async`/`await` makes it read like straight-line code.') },
				{ id: 'lang-narrowing', title: 'narrowing & guards', content: stub('Narrowing & guards', 'How `if` checks, `typeof`, and `instanceof` convince the compiler a value is safe to use.') },
			]
		},
		{
			id: 'lang-reading',
			title: 'reading real code',
			lessons: [
				{ id: 'lang-reading-file', title: 'reading a real file top to bottom', content: stub('Reading a real file top to bottom', 'Imports, declarations, and exports: the anatomy of a real source file in this repository.') },
				{ id: 'lang-generics', title: 'generics in the wild', content: stub('Generics in the wild', 'What `Map<string, number>` and `Promise<ICourse>` mean, and how to read angle brackets without fear.') },
				{ id: 'lang-modules', title: 'imports, exports & modules', content: stub('Imports, exports & modules', 'How files share code with each other, and how to follow an import to its definition.') },
			]
		}
	]
};

const frameworkCourse: ICourse = {
	id: 'intuition-framework-101',
	title: 'the workbench framework',
	level: CourseLevel.Framework,
	description: 'The framework this app is built on: how a VS Code-style workbench boots, lays out, and extends.',
	modules: [
		{
			id: 'fw-shell',
			title: 'the editor shell',
			lessons: [
				{ id: 'fw-layout', title: 'parts: how the window is laid out', content: stub('Parts: how the window is laid out', 'The title bar, sidebar, editor area, panel, and status bar are each a "part" composed by the workbench layout.') },
				{ id: 'fw-editors', title: 'editors & editor inputs', content: stub('Editors & editor inputs', 'An editor pane renders an editor input — the page you are reading is exactly that pair.') },
				{ id: 'fw-views', title: 'views, view containers & the sidebar', content: stub('Views, view containers & the sidebar', 'How sidebar icons map to view containers, and views slot into them.') },
			]
		},
		{
			id: 'fw-services',
			title: 'services as a framework',
			lessons: [
				{ id: 'fw-services-everywhere', title: 'everything is a service', content: stub('Everything is a service', 'The dependency-injection backbone: interfaces, decorators, and registered implementations.') },
				{ id: 'fw-lifecycle', title: 'startup phases & lazy creation', content: stub('Startup phases & lazy creation', 'Why nothing is constructed until needed, and what the workbench lifecycle phases mean.') },
				{ id: 'fw-storage', title: 'state: storage scopes & targets', content: stub('State: storage scopes & targets', 'Application, profile, and workspace scope — where settings and state actually live.') },
			]
		},
		{
			id: 'fw-extension-points',
			title: 'contributions & extension points',
			lessons: [
				{ id: 'fw-contrib', title: 'workbench contributions', content: stub('Workbench contributions', 'Features register themselves at module load; the core never calls them by name.') },
				{ id: 'fw-actions', title: 'actions, menus & the command palette', content: stub('Actions, menus & the command palette', 'One Action2 registration can surface a command in the palette, a menu, and a keybinding at once.') },
				{ id: 'fw-themes', title: 'theming & product identity', content: stub('Theming & product identity', 'Color tokens, icon themes, and product.json: how a fork becomes its own product.') },
			]
		}
	]
};

const codebaseCourse: ICourse = {
	id: 'intuition-workbench-101',
	title: 'the intuition workbench',
	level: CourseLevel.Codebase,
	description: 'How this very repository is put together — services, contributions, and the course system itself.',
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

export const mockCatalogCourses: readonly ICourse[] = [languageCourse, frameworkCourse, codebaseCourse];
