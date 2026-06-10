/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { URI } from '../../../../base/common/uri.js';
import { localize } from '../../../../nls.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { EditorInputCapabilities, IEditorSerializer, IUntypedEditorInput } from '../../../common/editor.js';
import { EditorInput } from '../../../common/editor/editorInput.js';
import { COURSE_PAGE_SCHEME } from '../common/course.js';

export interface ICourseEditorOptions extends IEditorOptions {
	/** Lesson to show when the page opens. Defaults to the active lesson. */
	readonly selectedLessonId?: string;
}

/**
 * Input for the full-page Course editor. The page is a singleton, like the
 * Welcome page: opening it again reveals the existing tab. The only state it
 * carries is which lesson is shown, so a window reload restores the page at
 * the same place.
 */
export class CourseEditorInput extends EditorInput {

	static readonly ID = 'workbench.editors.intuitionCourseInput';
	static readonly RESOURCE = URI.from({ scheme: COURSE_PAGE_SCHEME, authority: 'course-page' });

	selectedLessonId: string | undefined;

	constructor(options: ICourseEditorOptions) {
		super();
		this.selectedLessonId = options.selectedLessonId;
	}

	override get typeId(): string {
		return CourseEditorInput.ID;
	}

	override get editorId(): string {
		return CourseEditorInput.ID;
	}

	override get capabilities(): EditorInputCapabilities {
		return EditorInputCapabilities.Singleton | EditorInputCapabilities.Readonly;
	}

	get resource(): URI {
		return CourseEditorInput.RESOURCE;
	}

	override getName(): string {
		return localize('course.pageName', "Course");
	}

	override getIcon(): ThemeIcon {
		return Codicon.mortarBoard;
	}

	override matches(other: EditorInput | IUntypedEditorInput): boolean {
		return super.matches(other) || other instanceof CourseEditorInput;
	}
}

export class CourseEditorInputSerializer implements IEditorSerializer {

	canSerialize(): boolean {
		return true;
	}

	serialize(input: CourseEditorInput): string {
		return JSON.stringify({ selectedLessonId: input.selectedLessonId });
	}

	deserialize(instantiationService: IInstantiationService, serialized: string): CourseEditorInput {
		try {
			const { selectedLessonId } = JSON.parse(serialized);
			return new CourseEditorInput({ selectedLessonId });
		} catch {
			return new CourseEditorInput({});
		}
	}
}
