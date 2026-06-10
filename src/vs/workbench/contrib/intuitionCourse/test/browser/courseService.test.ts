/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestStorageService } from '../../../../test/common/workbenchTestServices.js';
import { CourseService } from '../../browser/courseServiceImpl.js';
import { ICourse, LessonState } from '../../common/course.js';
import { ICourseProvider } from '../../common/courseService.js';

const testCourse: ICourse = {
	id: 'test-course',
	title: 'test course',
	modules: [
		{
			id: 'm1', title: 'module one', lessons: [
				{ id: 'l1', title: 'first', content: '# one' },
				{ id: 'l2', title: 'second', content: '# two' },
			]
		},
		{
			id: 'm2', title: 'module two', lessons: [
				{ id: 'l3', title: 'third', content: '# three' },
			]
		}
	]
};

class TestProvider implements ICourseProvider {
	async provideCourse(): Promise<ICourse> {
		return testCourse;
	}
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
});
