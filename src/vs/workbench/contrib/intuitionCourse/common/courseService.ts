/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ICourse, ICourseLesson, LessonState } from './course.js';

export const ICourseService = createDecorator<ICourseService>('intuitionCourseService');

/**
 * The generation seam. v1 registers a single mock provider; the future BYOK
 * pipeline (user's Anthropic key → curriculum from the open repository)
 * registers here too, with no changes to the service or the view.
 */
export interface ICourseProvider {
	provideCourse(): Promise<ICourse | undefined>;
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

	/** Resolves (and caches) the course from the registered provider. */
	getCourse(): Promise<ICourse | undefined>;

	/** Derived state for a lesson of the resolved course. */
	getLessonState(lessonId: string): LessonState;
	getLesson(lessonId: string): ICourseLesson | undefined;
	getProgress(): ICourseProgress;

	completeLesson(lessonId: string): void;
	resetProgress(): void;
}
