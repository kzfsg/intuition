/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/courseTitleBar.css';
import { $, append } from '../../../../base/browser/dom.js';
import { BaseActionViewItem, IBaseActionViewItemOptions } from '../../../../base/browser/ui/actionbar/actionViewItems.js';
import { getDefaultHoverDelegate } from '../../../../base/browser/ui/hover/hoverDelegateFactory.js';
import { IAction } from '../../../../base/common/actions.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize, localize2 } from '../../../../nls.js';
import { IActionViewItemService } from '../../../../platform/actions/browser/actionViewItemService.js';
import { Action2, MenuId, MenuRegistry, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IInstantiationService, ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { EditorPaneDescriptor, IEditorPaneRegistry } from '../../../browser/editor.js';
import { TitleBarLeadingActionsGroup } from '../../../browser/parts/titlebar/titlebarActions.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { EditorExtensions, IEditorFactoryRegistry } from '../../../common/editor.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { OPEN_COURSE_COMMAND_ID, OPEN_LESSON_COMMAND_ID, RESET_PROGRESS_COMMAND_ID } from '../common/course.js';
import { ICourseService } from '../common/courseService.js';
import { CourseEditor } from './courseEditor.js';
import { CourseEditorInput, CourseEditorInputSerializer, ICourseEditorOptions } from './courseEditorInput.js';
import { CourseService } from './courseServiceImpl.js';
import { MockCourseProvider } from './mockCourseProvider.js';

// --- service

registerSingleton(ICourseService, CourseService, InstantiationType.Delayed);

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
		this._register(courseService.registerProvider(this._register(new MockCourseProvider())));
	}
}

registerWorkbenchContribution2(CourseProviderContribution.ID, CourseProviderContribution, WorkbenchPhase.AfterRestored);

// --- title bar Course button (Cursor's "Upgrade to Pro" slot)

MenuRegistry.appendMenuItem(MenuId.TitleBar, {
	command: {
		id: OPEN_COURSE_COMMAND_ID,
		title: localize2('course.titleBar', "Course"),
		icon: Codicon.mortarBoard,
	},
	group: TitleBarLeadingActionsGroup,
	order: 0,
});

/** Renders the title-bar Course entry as an always-visible icon + label button. */
class CourseTitleBarWidget extends BaseActionViewItem {

	constructor(
		action: IAction,
		options: IBaseActionViewItemOptions | undefined,
		@IHoverService private readonly hoverService: IHoverService,
	) {
		super(undefined, action, options);
	}

	override render(container: HTMLElement): void {
		super.render(container);

		container.classList.add('intuition-course-titlebar-item');
		container.setAttribute('role', 'button');

		const hoverText = localize('course.titleBarHover', "Open Course Page");
		container.setAttribute('aria-label', hoverText);
		this._register(this.hoverService.setupManagedHover(getDefaultHoverDelegate('element'), container, hoverText));

		const icon = append(container, $('span.intuition-course-titlebar-icon'));
		icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.mortarBoard));
		icon.setAttribute('aria-hidden', 'true');

		const label = append(container, $('span.intuition-course-titlebar-label'));
		label.textContent = localize('course.titleBarLabel', "Course");
	}
}

class CourseTitleBarContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.intuitionCourseTitleBar';

	constructor(
		@IActionViewItemService actionViewItemService: IActionViewItemService,
		@IInstantiationService instantiationService: IInstantiationService,
	) {
		super();
		this._register(actionViewItemService.register(MenuId.TitleBar, OPEN_COURSE_COMMAND_ID, (action, options) => {
			return instantiationService.createInstance(CourseTitleBarWidget, action, options);
		}, undefined));
	}
}

registerWorkbenchContribution2(CourseTitleBarContribution.ID, CourseTitleBarContribution, WorkbenchPhase.BlockRestore);

// --- commands

registerAction2(class OpenCourseAction extends Action2 {
	constructor() {
		super({
			id: OPEN_COURSE_COMMAND_ID,
			title: localize2('course.open', "Open Course Page"),
			category: localize2('intuition', "Intuition"),
			icon: Codicon.book,
			f1: true,
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
		});
	}

	override run(accessor: ServicesAccessor): void {
		accessor.get(ICourseService).resetProgress();
	}
});
