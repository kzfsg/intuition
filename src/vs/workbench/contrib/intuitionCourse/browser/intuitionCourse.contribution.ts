/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize, localize2 } from '../../../../nls.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { Extensions as ViewContainerExtensions, IViewContainersRegistry, IViewsRegistry, ViewContainerLocation } from '../../../common/views.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { COURSE_CONTAINER_ID, COURSE_VIEW_ID, OPEN_COURSE_COMMAND_ID, OPEN_LESSON_COMMAND_ID, RESET_PROGRESS_COMMAND_ID } from '../common/course.js';
import { ICourseService } from '../common/courseService.js';
import { CourseEditor } from './courseEditor.js';
import { CourseEditorInput, CourseEditorInputSerializer, ICourseEditorOptions } from './courseEditorInput.js';
import { CoursePane } from './coursePane.js';
import { CourseService } from './courseServiceImpl.js';
import { MockCourseProvider } from './mockCourseProvider.js';

// --- service

registerSingleton(ICourseService, CourseService, InstantiationType.Delayed);

// --- view container & view

const courseViewIcon = registerIcon('intuition-course-view-icon', Codicon.mortarBoard, localize('courseViewIcon', 'View icon of the Intuition course view.'));

const viewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: COURSE_CONTAINER_ID,
	title: localize2('course', "Course"),
	icon: courseViewIcon,
	order: 2,
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [COURSE_CONTAINER_ID, { mergeViewWithContainerWhenSingleView: true }]),
	storageId: 'workbench.intuitionCourse.state',
}, ViewContainerLocation.Sidebar);

Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry).registerViews([{
	id: COURSE_VIEW_ID,
	name: localize2('course', "Course"),
	containerIcon: courseViewIcon,
	ctorDescriptor: new SyncDescriptor(CoursePane),
	canToggleVisibility: false,
	canMoveView: true,
	openCommandActionDescriptor: {
		id: 'workbench.actions.view.intuitionCourse',
		order: 2,
	},
}], viewContainer);

// --- course page editor

Registry.as<IEditorPaneRegistry>(EditorExtensions.EditorPane).registerEditorPane(
	EditorPaneDescriptor.create(
		CourseEditor,
		CourseEditor.ID,
		localize('course', "Course")
	),
	[
		new SyncDescriptor(CourseEditorInput)
	]
);

Registry.as<IEditorFactoryRegistry>(EditorExtensions.EditorFactory).registerEditorSerializer(CourseEditorInput.ID, CourseEditorInputSerializer);

// --- the v1 course provider

class CourseProviderContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.intuitionCourseProvider';

	constructor(@ICourseService courseService: ICourseService) {
		super();
		this._register(courseService.registerProvider(new MockCourseProvider()));
	}
}

registerWorkbenchContribution2(CourseProviderContribution.ID, CourseProviderContribution, WorkbenchPhase.AfterRestored);

// --- commands

registerAction2(class OpenCourseAction extends Action2 {
	constructor() {
		super({
			id: OPEN_COURSE_COMMAND_ID,
			title: localize2('course.open', "Open Course Page"),
			category: localize2('intuition', "Intuition"),
			icon: Codicon.book,
			f1: true,
			menu: {
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.equals('view', COURSE_VIEW_ID),
				group: 'navigation',
				order: 1,
			},
		});
	}

	override async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IEditorService).openEditor(new CourseEditorInput({}), { pinned: false });
	}
});

registerAction2(class OpenLessonAction extends Action2 {
	constructor() {
		super({
			id: OPEN_LESSON_COMMAND_ID,
			title: localize2('course.openLesson', "Open Course Lesson"),
			category: localize2('intuition', "Intuition"),
		});
	}

	override async run(accessor: ServicesAccessor, lessonId: string): Promise<void> {
		const options: ICourseEditorOptions = { selectedLessonId: lessonId, pinned: false };
		await accessor.get(IEditorService).openEditor(new CourseEditorInput(options), options);
	}
});

registerAction2(class ResetCourseProgressAction extends Action2 {
	constructor() {
		super({
			id: RESET_PROGRESS_COMMAND_ID,
			title: localize2('course.resetProgress', "Reset Course Progress"),
			category: localize2('intuition', "Intuition"),
			icon: Codicon.discard,
			f1: true,
			menu: {
				id: MenuId.ViewTitle,
				when: ContextKeyExpr.equals('view', COURSE_VIEW_ID),
				group: 'navigation',
				order: 2,
			},
		});
	}

	override run(accessor: ServicesAccessor): void {
		accessor.get(ICourseService).resetProgress();
	}
});
