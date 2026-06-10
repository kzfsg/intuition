/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { StorageScope, StorageTarget } from '../../../../../platform/storage/common/storage.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { CourseService } from '../../browser/courseServiceImpl.js';
import { CourseLevel, ICourse, LessonState } from '../../common/course.js';
import { CourseGenerationState, ICourseGenerationOptions, ICourseGenerationProgress, ICourseProvider } from '../../common/courseService.js';

const testCourse: ICourse = {
	id: 'test-course',
	title: 'test course',
	level: CourseLevel.Codebase,
	modules: [
		{
			id: 'm1', title: 'module one', lessons: [
				{ id: 'l1', title: 'first', content: '# one' },
				{ id: 'l2', title: 'second', content: '# two' },
			]
		},
		{
			id: 'm2', title: 'module two', lessons: [
				{ id: 'l3', title: 'third' }, // outline-only: body resolves lazily
			]
		}
	]
};

class TestProvider implements ICourseProvider {
	private readonly _onDidChangeGenerationState = new Emitter<void>();
	readonly onDidChangeGenerationState = this._onDidChangeGenerationState.event;

	state = CourseGenerationState.Ready; // legacy tests: course immediately available
	progress: ICourseGenerationProgress | undefined;
	error: string | undefined;
	contentRequests: string[] = [];

	constructor(private course: ICourse | undefined = testCourse) { }

	getGenerationState() { return this.state; }
	getGenerationProgress() { return this.progress; }
	getGenerationError() { return this.error; }
	startGeneration(_options: ICourseGenerationOptions) { this.setState(CourseGenerationState.Indexing); }
	cancelGeneration() { this.setState(CourseGenerationState.NotStarted); }
	reset() { this.setState(CourseGenerationState.NotStarted); }
	async provideCourse() { return this.state === CourseGenerationState.Ready ? this.course : undefined; }
	async provideLessonContent(lessonId: string) { this.contentRequests.push(lessonId); return `lazy:${lessonId}`; }
	setState(state: CourseGenerationState) { this.state = state; this._onDidChangeGenerationState.fire(); }
}

suite('Intuition Course Service', () => {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function createService(storageService = new TestStorageService()): { service: CourseService; storageService: TestStorageService } {
		store.add(storageService);
		const service = store.add(new CourseService(storageService));
		return { service, storageService };
	}

	test('without a provider there is no course', async () => {
		const { service } = createService();
		assert.strictEqual(await service.getCourse(), undefined);
		assert.deepStrictEqual(service.getProgress(), { done: 0, total: 0 });
	});

	test('registering a provider fires onDidChangeCourse and resolves the course', async () => {
		const { service } = createService();
		let fired = 0;
		store.add(service.onDidChangeCourse(() => fired++));
		store.add(service.registerProvider(new TestProvider()));
		assert.strictEqual(fired, 1);
		const course = await service.getCourse();
		assert.strictEqual(course?.id, 'test-course');
	});

	test('lesson states derive from completion in course order, across modules', async () => {
		const { service } = createService();
		store.add(service.registerProvider(new TestProvider()));
		await service.getCourse();

		assert.strictEqual(service.getLessonState('l1'), LessonState.Active);
		assert.strictEqual(service.getLessonState('l2'), LessonState.Next);
		assert.strictEqual(service.getLessonState('l3'), LessonState.Locked);

		service.completeLesson('l1');
		assert.strictEqual(service.getLessonState('l1'), LessonState.Done);
		assert.strictEqual(service.getLessonState('l2'), LessonState.Active);
		assert.strictEqual(service.getLessonState('l3'), LessonState.Next);
		assert.deepStrictEqual(service.getProgress(), { done: 1, total: 3 });
	});

	test('completing a lesson fires onDidChangeProgress once, unknown/duplicate lessons never', async () => {
		const { service } = createService();
		store.add(service.registerProvider(new TestProvider()));
		await service.getCourse();

		let fired = 0;
		store.add(service.onDidChangeProgress(() => fired++));
		service.completeLesson('l1');
		service.completeLesson('l1'); // duplicate
		service.completeLesson('nope'); // unknown
		assert.strictEqual(fired, 1);
	});

	test('progress persists across service instances sharing storage', async () => {
		const storageService = new TestStorageService();
		const { service } = createService(storageService);
		store.add(service.registerProvider(new TestProvider()));
		await service.getCourse();
		service.completeLesson('l1');

		const second = store.add(new CourseService(storageService));
		store.add(second.registerProvider(new TestProvider()));
		await second.getCourse();
		assert.strictEqual(second.getLessonState('l1'), LessonState.Done);
		assert.strictEqual(second.getLessonState('l2'), LessonState.Active);
	});

	test('resetProgress clears completion and storage', async () => {
		const { service } = createService();
		store.add(service.registerProvider(new TestProvider()));
		await service.getCourse();
		service.completeLesson('l1');
		service.completeLesson('l2');

		service.resetProgress();
		assert.deepStrictEqual(service.getProgress(), { done: 0, total: 3 });
		assert.strictEqual(service.getLessonState('l1'), LessonState.Active);
	});

	test('getLesson finds lessons in any module', async () => {
		const { service } = createService();
		store.add(service.registerProvider(new TestProvider()));
		await service.getCourse();
		assert.strictEqual(service.getLesson('l3')?.title, 'third');
		assert.strictEqual(service.getLesson('nope'), undefined);
	});

	// --- generation lifecycle (sub-project A)

	test('generation state forwards from the provider; no provider means NotStarted', () => {
		const { service } = createService();
		assert.strictEqual(service.getGenerationState(), CourseGenerationState.NotStarted);
		const provider = new TestProvider();
		provider.state = CourseGenerationState.NotStarted;
		store.add(service.registerProvider(provider));
		assert.strictEqual(service.getGenerationState(), CourseGenerationState.NotStarted);
		service.startGeneration({ level: CourseLevel.Codebase });
		assert.strictEqual(service.getGenerationState(), CourseGenerationState.Indexing);
	});

	test('state changes fire onDidChangeCourse', () => {
		const { service } = createService();
		const provider = new TestProvider();
		provider.state = CourseGenerationState.NotStarted;
		store.add(service.registerProvider(provider));
		let fired = 0;
		store.add(service.onDidChangeCourse(() => fired++));
		provider.setState(CourseGenerationState.Indexing);
		provider.setState(CourseGenerationState.Ready);
		assert.ok(fired >= 2);
	});

	test('reaching Ready caches the course; a fresh service serves it without a ready provider', async () => {
		const storageService = new TestStorageService();
		const { service } = createService(storageService);
		store.add(service.registerProvider(new TestProvider()));
		assert.strictEqual((await service.getCourse())?.id, 'test-course');

		const second = store.add(new CourseService(storageService));
		const coldProvider = new TestProvider(undefined);
		coldProvider.state = CourseGenerationState.NotStarted;
		store.add(second.registerProvider(coldProvider));
		assert.strictEqual(second.getGenerationState(), CourseGenerationState.Ready);
		assert.strictEqual((await second.getCourse())?.id, 'test-course');
	});

	test('getLessonContent: eager content served directly, lazy resolved once and memoized', async () => {
		const { service } = createService();
		const provider = new TestProvider();
		store.add(service.registerProvider(provider));
		await service.getCourse();
		assert.strictEqual(await service.getLessonContent('l1'), '# one');
		assert.strictEqual(await service.getLessonContent('l3'), 'lazy:l3');
		assert.strictEqual(await service.getLessonContent('l3'), 'lazy:l3');
		assert.deepStrictEqual(provider.contentRequests, ['l3']);
	});

	test('resolved lazy content is persisted into the cache', async () => {
		const storageService = new TestStorageService();
		const { service } = createService(storageService);
		store.add(service.registerProvider(new TestProvider()));
		await service.getCourse();
		await service.getLessonContent('l3');

		const second = store.add(new CourseService(storageService));
		const coldProvider = new TestProvider(undefined);
		coldProvider.state = CourseGenerationState.NotStarted;
		store.add(second.registerProvider(coldProvider));
		assert.strictEqual(await second.getLessonContent('l3'), 'lazy:l3');
		assert.deepStrictEqual(coldProvider.contentRequests, []);
	});

	test('reindex clears the cache, resets the provider, and fires change', async () => {
		const { service } = createService();
		const provider = new TestProvider();
		store.add(service.registerProvider(provider));
		await service.getCourse();
		let fired = 0;
		store.add(service.onDidChangeCourse(() => fired++));
		service.reindex();
		assert.strictEqual(provider.state, CourseGenerationState.NotStarted);
		assert.strictEqual(service.getGenerationState(), CourseGenerationState.NotStarted);
		assert.strictEqual(await service.getCourse(), undefined);
		assert.ok(fired >= 1);
	});

	test('malformed cache JSON is dropped, not fatal', async () => {
		const storageService = new TestStorageService();
		storageService.store('intuition.course.cache', '{nope', StorageScope.WORKSPACE, StorageTarget.MACHINE);
		const { service } = createService(storageService);
		const provider = new TestProvider();
		provider.state = CourseGenerationState.NotStarted;
		store.add(service.registerProvider(provider));
		assert.strictEqual(service.getGenerationState(), CourseGenerationState.NotStarted);
	});
});
