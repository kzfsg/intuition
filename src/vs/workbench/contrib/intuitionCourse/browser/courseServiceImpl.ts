/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ICourse, ICourseLesson, LessonState } from '../common/course.js';
import { ICourseProgress, ICourseProvider, ICourseService } from '../common/courseService.js';

export class CourseService extends Disposable implements ICourseService {

	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeCourse = this._register(new Emitter<void>());
	readonly onDidChangeCourse = this._onDidChangeCourse.event;

	private readonly _onDidChangeProgress = this._register(new Emitter<void>());
	readonly onDidChangeProgress = this._onDidChangeProgress.event;

	private provider: ICourseProvider | undefined;
	private course: Promise<ICourse | undefined> | undefined;
	private lessonOrder: readonly ICourseLesson[] = [];
	private completed = new Set<string>();
	private storageKey: string | undefined;

	constructor(
		@IStorageService private readonly storageService: IStorageService
	) {
		super();
	}

	registerProvider(provider: ICourseProvider): IDisposable {
		if (this.provider) {
			throw new Error('Intuition Course: a course provider is already registered');
		}
		this.provider = provider;
		this.invalidate();
		return toDisposable(() => {
			if (this.provider === provider) {
				this.provider = undefined;
				this.invalidate();
			}
		});
	}

	private invalidate(): void {
		this.course = undefined;
		this.lessonOrder = [];
		this.completed = new Set();
		this.storageKey = undefined;
		this._onDidChangeCourse.fire();
	}

	getCourse(): Promise<ICourse | undefined> {
		if (!this.course) {
			const provider = this.provider;
			this.course = provider
				? provider.provideCourse().then(course => {
					// A provider change while resolving voids this result
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
		return this.course;
	}

	private loadProgress(): void {
		this.completed = new Set();
		if (this.storageKey) {
			const raw = this.storageService.get(this.storageKey, StorageScope.WORKSPACE);
			if (raw) {
				try {
					const ids: string[] = JSON.parse(raw);
					const known = new Set(this.lessonOrder.map(l => l.id));
					ids.filter(id => known.has(id)).forEach(id => this.completed.add(id));
				} catch {
					// malformed progress is dropped, never fatal
				}
			}
		}
	}

	private saveProgress(): void {
		if (this.storageKey) {
			if (this.completed.size) {
				this.storageService.store(this.storageKey, JSON.stringify([...this.completed]), StorageScope.WORKSPACE, StorageTarget.MACHINE);
			} else {
				this.storageService.remove(this.storageKey, StorageScope.WORKSPACE);
			}
		}
	}

	getLesson(lessonId: string): ICourseLesson | undefined {
		return this.lessonOrder.find(l => l.id === lessonId);
	}

	getLessonState(lessonId: string): LessonState {
		if (this.completed.has(lessonId)) {
			return LessonState.Done;
		}
		const incomplete = this.lessonOrder.filter(l => !this.completed.has(l.id));
		if (incomplete[0]?.id === lessonId) {
			return LessonState.Active;
		}
		if (incomplete[1]?.id === lessonId) {
			return LessonState.Next;
		}
		return LessonState.Locked;
	}

	getProgress(): ICourseProgress {
		return { done: this.completed.size, total: this.lessonOrder.length };
	}

	completeLesson(lessonId: string): void {
		if (this.lessonOrder.some(l => l.id === lessonId) && !this.completed.has(lessonId)) {
			this.completed.add(lessonId);
			this.saveProgress();
			this._onDidChangeProgress.fire();
		}
	}

	resetProgress(): void {
		if (this.completed.size) {
			this.completed.clear();
			this.saveProgress();
			this._onDidChangeProgress.fire();
		}
	}
}
