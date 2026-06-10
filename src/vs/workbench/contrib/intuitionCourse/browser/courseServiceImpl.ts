/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ICourse, ICourseLesson, LessonState } from '../common/course.js';
import { CourseGenerationState, ICourseGenerationOptions, ICourseGenerationProgress, ICourseProgress, ICourseProvider, ICourseService } from '../common/courseService.js';

export class CourseService extends Disposable implements ICourseService {

	declare readonly _serviceBrand: undefined;

	private static readonly CACHE_KEY = 'intuition.course.cache';

	private readonly _onDidChangeCourse = this._register(new Emitter<void>());
	readonly onDidChangeCourse = this._onDidChangeCourse.event;

	private readonly _onDidChangeProgress = this._register(new Emitter<void>());
	readonly onDidChangeProgress = this._onDidChangeProgress.event;

	private provider: ICourseProvider | undefined;
	private providerListener: IDisposable | undefined;
	private course: Promise<ICourse | undefined> | undefined;
	private lessonOrder: readonly ICourseLesson[] = [];
	private completed = new Set<string>();
	private storageKey: string | undefined;
	private contentMemo = new Map<string, string>();
	/** undefined = not read yet; null = read, absent. */
	private cachedCourse: ICourse | null | undefined = undefined;

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
		this.providerListener = provider.onDidChangeGenerationState(() => {
			this.course = undefined;
			if (provider.getGenerationState() === CourseGenerationState.Ready) {
				this.getCourse(); // resolves and persists the cache
			}
			this._onDidChangeCourse.fire();
		});
		this.invalidate();
		return toDisposable(() => {
			if (this.provider === provider) {
				this.provider = undefined;
				this.providerListener?.dispose();
				this.providerListener = undefined;
				this.invalidate();
			}
		});
	}

	private invalidate(): void {
		this.course = undefined;
		this.lessonOrder = [];
		this.completed = new Set();
		this.storageKey = undefined;
		this.contentMemo.clear();
		this._onDidChangeCourse.fire();
	}

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
						// A provider change while resolving voids this result
						if (this.provider !== provider) {
							return undefined;
						}
						if (course) {
							this.lessonOrder = course.modules.flatMap(m => m.lessons);
							this.storageKey = `intuition.course.progress.${course.id}`;
							this.loadProgress();
							this.saveCache(course);
						}
						return course;
					})
					: Promise.resolve(undefined);
			}
		}
		return this.course;
	}

	// --- generation lifecycle

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
		await this.getCourse(); // ensure the (possibly cached) course is resolved
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
