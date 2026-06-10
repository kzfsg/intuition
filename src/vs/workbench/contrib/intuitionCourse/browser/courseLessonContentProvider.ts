/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { ILanguageService } from '../../../../editor/common/languages/language.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModelContentProvider, ITextModelService } from '../../../../editor/common/services/resolverService.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { COURSE_LESSON_SCHEME } from '../common/course.js';
import { ICourseService } from '../common/courseService.js';

/**
 * Backs `intuition-course:/<courseId>/<lessonId>.md` virtual documents with
 * the lesson's markdown. Models are ephemeral; nothing is ever written back.
 */
export class CourseLessonContentProvider extends Disposable implements ITextModelContentProvider, IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.intuitionCourseLessonContentProvider';

	constructor(
		@ITextModelService textModelService: ITextModelService,
		@IModelService private readonly modelService: IModelService,
		@ILanguageService private readonly languageService: ILanguageService,
		@ICourseService private readonly courseService: ICourseService,
	) {
		super();
		this._register(textModelService.registerTextModelContentProvider(COURSE_LESSON_SCHEME, this));
	}

	static toLessonResource(courseId: string, lessonId: string): URI {
		return URI.from({ scheme: COURSE_LESSON_SCHEME, path: `/${courseId}/${lessonId}.md` });
	}

	async provideTextContent(resource: URI): Promise<ITextModel | null> {
		const existing = this.modelService.getModel(resource);
		if (existing) {
			return existing;
		}
		const lessonId = resource.path.split('/').at(-1)?.replace(/\.md$/, '');
		if (!lessonId) {
			return null;
		}
		await this.courseService.getCourse();
		const lesson = this.courseService.getLesson(lessonId);
		if (!lesson) {
			return null;
		}
		return this.modelService.createModel(lesson.content, this.languageService.createById('markdown'), resource);
	}
}
