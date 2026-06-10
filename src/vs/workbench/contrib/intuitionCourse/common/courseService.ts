/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { CourseLevel, ICourse, ICourseCatalog, ICourseLesson, LessonState } from './course.js';

export const ICourseService = createDecorator<ICourseService>('intuitionCourseService');

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
	/** Resolves the catalog of per-level course outlines; undefined unless Ready. */
	provideCatalog(): Promise<ICourseCatalog | undefined>;
	/** Resolves a lazy lesson body (markdown). */
	provideLessonContent(lessonId: string): Promise<string>;
}

export interface ICourseProgress {
	readonly done: number;
	readonly total: number;
}

export interface ICourseService {
	readonly _serviceBrand: undefined;

	/** Fires when the resolved course itself changes (provider registered/unregistered). */
	readonly onDidChangeCourse: Event<void>;
	/** Fires when lesson completion changes. */
	readonly onDidChangeProgress: Event<void>;

	registerProvider(provider: ICourseProvider): IDisposable;

	/** Resolves (and caches) the per-level catalog from the registered provider. */
	getCatalog(): Promise<ICourseCatalog | undefined>;

	/** Resolves the active level's course from the catalog. */
	getCourse(): Promise<ICourse | undefined>;

	/** The level whose course getCourse() resolves. Persisted per workspace; default Codebase. */
	getActiveLevel(): CourseLevel;
	setActiveLevel(level: CourseLevel): void;

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

	/** Derived state for a lesson of the resolved course. */
	getLessonState(lessonId: string): LessonState;
	getLesson(lessonId: string): ICourseLesson | undefined;
	getProgress(): ICourseProgress;

	completeLesson(lessonId: string): void;
	resetProgress(): void;
}
