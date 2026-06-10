/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Intuition Course — data model.
 *
 * A course is a curriculum over a codebase: modules of lessons, each lesson a
 * markdown document with an optional comprehension quiz. In v1 the course is
 * hand-written ({@link ../browser/mockCourseProvider.ts}); later it is
 * generated from the user's repository (see
 * docs/superpowers/specs/2026-06-10-course-tab-shell-design.md).
 */

/** URI scheme for virtual lesson documents: `intuition-course:/<courseId>/<lessonId>.md` */
export const COURSE_LESSON_SCHEME = 'intuition-course';

export const COURSE_CONTAINER_ID = 'workbench.viewContainer.intuitionCourse';
export const COURSE_VIEW_ID = 'workbench.view.intuitionCourse';
export const OPEN_LESSON_COMMAND_ID = 'intuition.course.openLesson';
export const RESET_PROGRESS_COMMAND_ID = 'intuition.course.resetProgress';

export interface ICourseQuiz {
	readonly question: string;
	readonly options: readonly string[];
	readonly correctIndex: number;
}

export interface ICourseLesson {
	readonly id: string;
	readonly title: string;
	/** Lesson body, markdown. */
	readonly content: string;
	readonly quiz?: ICourseQuiz;
}

export interface ICourseModule {
	readonly id: string;
	readonly title: string;
	readonly lessons: readonly ICourseLesson[];
}

export interface ICourse {
	readonly id: string;
	readonly title: string;
	readonly modules: readonly ICourseModule[];
}

/**
 * Lesson state is derived, never stored: completion is the only persisted
 * fact. The first incomplete lesson (in course order) is Active, the one
 * after it is Next, all later incomplete lessons are Locked.
 */
export const enum LessonState {
	Done = 'done',
	Active = 'active',
	Next = 'next',
	Locked = 'locked'
}
