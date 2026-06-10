/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/coursePane.css';
import * as dom from '../../../../base/browser/dom.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { COURSE_VIEW_ID, ICourse, ICourseLesson, LessonState, OPEN_LESSON_COMMAND_ID } from '../common/course.js';
import { ICourseService } from '../common/courseService.js';

const $ = dom.$;

export class CoursePane extends ViewPane {

	static readonly ID = COURSE_VIEW_ID;

	private courseRoot: HTMLElement | undefined;
	private course: ICourse | undefined;
	private readonly renderDisposables = this._register(new DisposableStore());

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@ICourseService private readonly courseService: ICourseService,
		@ICommandService private readonly commandService: ICommandService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this._register(this.courseService.onDidChangeProgress(() => this.renderCourse()));
		this._register(this.courseService.onDidChangeCourse(() => this.loadAndRender()));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);
		this.courseRoot = dom.append(container, $('.intuition-course'));
		this.loadAndRender();
	}

	private async loadAndRender(): Promise<void> {
		this.course = await this.courseService.getCourse();
		this.renderCourse();
	}

	private renderCourse(): void {
		if (!this.courseRoot) {
			return;
		}
		this.renderDisposables.clear();
		dom.clearNode(this.courseRoot);

		if (!this.course) {
			dom.append(this.courseRoot, $('.course-empty', undefined,
				localize('course.empty', "No course yet. Open a project to turn it into one.")));
			return;
		}

		this.renderCourseHeader(this.courseRoot, this.course);

		for (const module of this.course.modules) {
			const moduleEl = dom.append(this.courseRoot, $('.course-module'));
			dom.append(moduleEl, $('.course-module-title', undefined, module.title));
			const list = dom.append(moduleEl, $('.course-lessons', { role: 'list' }));
			for (const lesson of module.lessons) {
				this.renderLesson(list, lesson);
			}
		}

		const active = this.activeLesson(this.course);
		if (active?.quiz) {
			this.renderQuiz(this.courseRoot, active);
		}
	}

	private activeLesson(course: ICourse): ICourseLesson | undefined {
		return course.modules.flatMap(m => m.lessons)
			.find(l => this.courseService.getLessonState(l.id) === LessonState.Active);
	}

	private renderCourseHeader(parent: HTMLElement, course: ICourse): void {
		const header = dom.append(parent, $('.course-header'));
		dom.append(header, $('.course-title', undefined, course.title));

		const progress = this.courseService.getProgress();
		dom.append(header, $('.course-meta', undefined,
			localize('course.progress', "{0} of {1} lessons complete", progress.done, progress.total)));

		const bar = dom.append(header, $('.course-progress'));
		const fill = dom.append(bar, $('.course-progress-fill'));
		fill.style.width = progress.total ? `${Math.round(100 * progress.done / progress.total)}%` : '0';
	}

	private renderLesson(parent: HTMLElement, lesson: ICourseLesson): void {
		const state = this.courseService.getLessonState(lesson.id);
		const row = dom.append(parent, $<HTMLButtonElement>(`button.course-lesson.${state}`, {
			role: 'listitem',
			'aria-label': localize('course.lessonLabel', "Lesson: {0} ({1})", lesson.title, this.stateLabel(state))
		}));

		const icons: Record<LessonState, ThemeIcon> = {
			[LessonState.Done]: Codicon.check,
			[LessonState.Active]: Codicon.play,
			[LessonState.Next]: Codicon.arrowRight,
			[LessonState.Locked]: Codicon.lock,
		};
		dom.append(row, $(`.course-lesson-icon${ThemeIcon.asCSSSelector(icons[state])}`));
		dom.append(row, $('.course-lesson-title', undefined, lesson.title));
		dom.append(row, $('.course-lesson-tag', undefined, this.stateLabel(state)));

		if (state === LessonState.Locked) {
			row.disabled = true;
		} else {
			this.renderDisposables.add(dom.addDisposableListener(row, dom.EventType.CLICK, () => {
				this.commandService.executeCommand(OPEN_LESSON_COMMAND_ID, lesson.id);
			}));
		}
	}

	private renderQuiz(parent: HTMLElement, lesson: ICourseLesson): void {
		const quiz = lesson.quiz!;
		const box = dom.append(parent, $('.course-quiz'));
		dom.append(box, $('.course-quiz-label', undefined, localize('course.quiz', "check your understanding")));
		dom.append(box, $('.course-quiz-question', undefined, quiz.question));

		const opts = dom.append(box, $('.course-quiz-options'));
		quiz.options.forEach((option, i) => {
			const btn = dom.append(opts, $('button.course-quiz-option', {
				'aria-label': localize('course.quizOption', "Answer: {0}", option)
			}));
			dom.append(btn, $('span.course-quiz-key', undefined, String.fromCharCode(97 + i)));
			dom.append(btn, $('span', undefined, option));
			this.renderDisposables.add(dom.addDisposableListener(btn, dom.EventType.CLICK, () => {
				if (i === quiz.correctIndex) {
					// completing re-renders the pane via onDidChangeProgress
					this.courseService.completeLesson(lesson.id);
				} else {
					btn.classList.add('incorrect');
				}
			}));
		});
	}

	private stateLabel(state: LessonState): string {
		switch (state) {
			case LessonState.Done: return localize('course.state.done', "done");
			case LessonState.Active: return localize('course.state.now', "now");
			case LessonState.Next: return localize('course.state.next', "next");
			case LessonState.Locked: return localize('course.state.locked', "locked");
		}
	}
}
