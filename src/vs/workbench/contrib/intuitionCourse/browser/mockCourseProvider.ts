/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { disposableTimeout } from '../../../../base/common/async.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { ICourseCatalog } from '../common/course.js';
import { readHeadCommit } from '../common/courseGitHead.js';
import { mockCatalogCourses } from './mockCurricula.js';
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
	private readonly timers = this._register(new DisposableStore());

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
	) {
		super();
	}

	getGenerationState(): CourseGenerationState { return this.state; }
	getGenerationProgress(): ICourseGenerationProgress | undefined { return this.progress; }
	getGenerationError(): string | undefined { return undefined; }

	startGeneration(_options: ICourseGenerationOptions): void {
		if (this.state === CourseGenerationState.Indexing) {
			return;
		}
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

	async provideCatalog(): Promise<ICourseCatalog | undefined> {
		if (this.state !== CourseGenerationState.Ready) {
			return undefined;
		}
		const root = this.contextService.getWorkspace().folders[0]?.uri;
		const indexedCommit = root ? await readHeadCommit(this.fileService, root) : undefined;
		// outlines only: bodies resolve through provideLessonContent
		return {
			indexedCommit,
			courses: mockCatalogCourses.map(course => ({
				...course,
				modules: course.modules.map(m => ({ ...m, lessons: m.lessons.map(({ content: _content, ...rest }) => rest) })),
			})),
		};
	}

	provideLessonContent(lessonId: string): Promise<string> {
		const content = mockCatalogCourses.flatMap(c => c.modules).flatMap(m => m.lessons).find(l => l.id === lessonId)?.content;
		return new Promise(resolve => this.timers.add(disposableTimeout(() => resolve(content ?? ''), MockCourseProvider.LESSON_MILLIS)));
	}
}
