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

/** URI scheme of the Course page editor input resource. */
export const COURSE_PAGE_SCHEME = 'intuition-course';

export const COURSE_EDITOR_ID = 'workbench.editor.intuitionCourse';
export const OPEN_COURSE_COMMAND_ID = 'intuition.course.open';
export const OPEN_LESSON_COMMAND_ID = 'intuition.course.openLesson';
export const RESET_PROGRESS_COMMAND_ID = 'intuition.course.resetProgress';
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

export interface ICourseQuiz {
	readonly question: string;
	readonly options: readonly string[];
	readonly correctIndex: number;
}

export interface ICourseLesson {
	readonly id: string;
	readonly title: string;
	/** Lesson body, markdown. Undefined in an outline: resolved lazily via the provider. */
	readonly content?: string;
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
	readonly level: CourseLevel;
	/** Short commit hash the course was indexed at; undefined outside a git repo. */
	readonly indexedCommit?: string;
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
