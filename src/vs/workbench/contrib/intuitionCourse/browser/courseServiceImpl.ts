/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../../base/common/event.js';
import { Disposable, IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { CourseLevel, ICourse, ICourseCatalog, ICourseLesson, LessonState } from '../common/course.js';
import { CourseGenerationState, ICourseGenerationOptions, ICourseGenerationProgress, ICourseProgress, ICourseProvider, ICourseService } from '../common/courseService.js';

export class CourseService extends Disposable implements ICourseService {

	declare readonly _serviceBrand: undefined;

	private static readonly CACHE_KEY = 'intuition.course.cache';
	private static readonly LEVEL_KEY = 'intuition.course.activeLevel';

	private readonly _onDidChangeCourse = this._register(new Emitter<void>());
	readonly onDidChangeCourse = this._onDidChangeCourse.event;

	private readonly _onDidChangeProgress = this._register(new Emitter<void>());
	readonly onDidChangeProgress = this._onDidChangeProgress.event;

	private provider: ICourseProvider | undefined;
	private providerListener: IDisposable | undefined;
	private catalog: Promise<ICourseCatalog | undefined> | undefined;
	private course: Promise<ICourse | undefined> | undefined;
	private lessonOrder: readonly ICourseLesson[] = [];
	private completed = new Set<string>();
	private storageKey: string | undefined;
	private contentMemo = new Map<string, string>();
	/** undefined = not read yet; null = read, absent. */
	private cachedCatalog: ICourseCatalog | null | undefined = undefined;

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
			this.catalog = undefined;
			this.course = undefined;
			if (provider.getGenerationState() === CourseGenerationState.Ready) {
				this.getCatalog(); // resolves and persists the cache
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
		this.catalog = undefined;
		this.course = undefined;
		this.lessonOrder = [];
		this.completed = new Set();
		this.storageKey = undefined;
		this.contentMemo.clear();
		this._onDidChangeCourse.fire();
	}

	getCatalog(): Promise<ICourseCatalog | undefined> {
		if (!this.catalog) {
			const cached = this.readCachedCatalog();
			const provider = this.provider;
			if (cached) {
				this.catalog = Promise.resolve(cached);
			} else {
				this.catalog = provider
					? provider.provideCatalog().then(catalog => {
						// A provider change while resolving voids this result
						if (this.provider !== provider) {
							return undefined;
						}
						if (catalog) {
							this.saveCache(catalog);
						}
						return catalog;
					})
					: Promise.resolve(undefined);
			}
		}
		return this.catalog;
	}

	getCourse(): Promise<ICourse | undefined> {
		if (!this.course) {
			this.course = this.getCatalog().then(catalog => {
				if (!catalog || !catalog.courses.length) {
					return undefined;
				}
				const active = this.getActiveLevel();
				const course = catalog.courses.find(c => c.level === active) ?? catalog.courses[0];
				this.lessonOrder = course.modules.flatMap(m => m.lessons);
				this.storageKey = `intuition.course.progress.${course.id}`;
				this.loadProgress();
				return course;
			});
		}
		return this.course;
	}

	getActiveLevel(): CourseLevel {
		const raw = this.storageService.get(CourseService.LEVEL_KEY, StorageScope.WORKSPACE);
		if (raw === CourseLevel.Language || raw === CourseLevel.Framework || raw === CourseLevel.Codebase) {
			return raw;
		}
		return CourseLevel.Codebase;
	}

	setActiveLevel(level: CourseLevel): void {
		if (level === this.getActiveLevel()) {
			return;
		}
		this.storageService.store(CourseService.LEVEL_KEY, level, StorageScope.WORKSPACE, StorageTarget.MACHINE);
		this.course = undefined;
		this.lessonOrder = [];
		this._onDidChangeCourse.fire();
	}

	// --- generation lifecycle

	private readCachedCatalog(): ICourseCatalog | undefined {
		if (this.cachedCatalog === undefined) {
			this.cachedCatalog = null;
			const raw = this.storageService.get(CourseService.CACHE_KEY, StorageScope.WORKSPACE);
			if (raw) {
				try {
					const parsed = JSON.parse(raw);
					// shape guard: also discards the pre-catalog single-course format
					if (parsed && Array.isArray(parsed.courses)) {
						this.cachedCatalog = parsed;
					}
				} catch {
					// malformed cache is dropped, never fatal
				}
			}
		}
		return this.cachedCatalog ?? undefined;
	}

	private saveCache(catalog: ICourseCatalog): void {
		const merged: ICourseCatalog = {
			...catalog,
			courses: catalog.courses.map(course => ({
				...course,
				modules: course.modules.map(m => ({
					...m,
					lessons: m.lessons.map(l => l.content === undefined && this.contentMemo.has(l.id) ? { ...l, content: this.contentMemo.get(l.id) } : l),
				})),
			})),
		};
		this.storageService.store(CourseService.CACHE_KEY, JSON.stringify(merged), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		this.cachedCatalog = merged;
	}

	getGenerationState(): CourseGenerationState {
		if (this.readCachedCatalog()) {
			return CourseGenerationState.Ready;
		}
		return this.provider?.getGenerationState() ?? CourseGenerationState.NotStarted;
	}

	getGenerationProgress(): ICourseGenerationProgress | undefined {
		return this.readCachedCatalog() ? undefined : this.provider?.getGenerationProgress();
	}

	getGenerationError(): string | undefined {
		return this.readCachedCatalog() ? undefined : this.provider?.getGenerationError();
	}

	startGeneration(options: ICourseGenerationOptions): void {
		this.provider?.startGeneration(options);
	}

	cancelGeneration(): void {
		this.provider?.cancelGeneration();
	}

	reindex(): void {
		this.storageService.remove(CourseService.CACHE_KEY, StorageScope.WORKSPACE);
		this.storageService.remove(CourseService.LEVEL_KEY, StorageScope.WORKSPACE);
		this.cachedCatalog = undefined;
		this.contentMemo.clear();
		this.catalog = undefined;
		this.course = undefined;
		this.lessonOrder = [];
		this.provider?.reset();
		this._onDidChangeCourse.fire();
	}

	async getLessonContent(lessonId: string): Promise<string> {
		const catalog = await this.getCatalog(); // ensure the (possibly cached) catalog is resolved
		const lesson = catalog?.courses.flatMap(c => c.modules).flatMap(m => m.lessons).find(l => l.id === lessonId);
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
		if (catalog) {
			this.saveCache(catalog);
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
