/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/courseEditor.css';
import * as dom from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { COURSE_EDITOR_ID, ICourse, ICourseLesson, LessonState } from '../common/course.js';
import { ICourseService } from '../common/courseService.js';
import { CourseEditorInput, ICourseEditorOptions } from './courseEditorInput.js';

const $ = dom.$;

/**
 * The Course page: a full editor-area experience for working through the
 * course, with a lesson rail on the left and the lesson body plus its quiz on
 * the right. The sidebar view is just an outline that opens this page.
 */
export class CourseEditor extends EditorPane {

	static readonly ID = COURSE_EDITOR_ID;

	private container: HTMLElement | undefined;
	private navElement: HTMLElement | undefined;
	private contentElement: HTMLElement | undefined;

	private course: ICourse | undefined;
	private selectedLessonId: string | undefined;

	private readonly renderDisposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@ICourseService private readonly courseService: ICourseService,
		@IMarkdownRendererService private readonly markdownRendererService: IMarkdownRendererService,
	) {
		super(CourseEditor.ID, group, telemetryService, themeService, storageService);

		this._register(this.courseService.onDidChangeProgress(() => this.render()));
		this._register(this.courseService.onDidChangeCourse(() => this.loadAndRender()));
	}

	protected override createEditor(parent: HTMLElement): void {
		this.container = dom.append(parent, $('.intuition-course-editor'));
		this.navElement = dom.append(this.container, $('.course-page-nav'));
		this.contentElement = dom.append(this.container, $('.course-page-content', { tabindex: '-1' }));
	}

	override async setInput(input: CourseEditorInput, options: ICourseEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		this.course = await this.courseService.getCourse();
		if (token.isCancellationRequested) {
			return;
		}

		this.selectedLessonId = options?.selectedLessonId ?? input.selectedLessonId;
		this.render();
	}

	override setOptions(options: ICourseEditorOptions | undefined): void {
		super.setOptions(options);
		if (options?.selectedLessonId) {
			this.selectedLessonId = options.selectedLessonId;
			this.render();
		}
	}

	override layout(dimension: dom.Dimension): void {
		this.container?.classList.toggle('narrow', dimension.width < 700);
	}

	override focus(): void {
		super.focus();
		this.contentElement?.focus();
	}

	private async loadAndRender(): Promise<void> {
		this.course = await this.courseService.getCourse();
		this.render();
	}

	/**
	 * Resolves the requested lesson against the course, falling back to the
	 * active one. The requested id itself stays untouched while the course is
	 * unavailable: the editor can restore before a provider has registered,
	 * and the selection must survive until the course arrives.
	 */
	private resolveSelection(): ICourseLesson | undefined {
		const lessons = this.allLessons();
		const requested = lessons.find(l => l.id === this.selectedLessonId && this.courseService.getLessonState(l.id) !== LessonState.Locked);
		const fallback = lessons.find(l => this.courseService.getLessonState(l.id) === LessonState.Active) ?? lessons[lessons.length - 1];
		return requested ?? fallback;
	}

	private allLessons(): readonly ICourseLesson[] {
		return this.course?.modules.flatMap(m => m.lessons) ?? [];
	}

	private render(): void {
		if (!this.navElement || !this.contentElement) {
			return;
		}
		this.renderDisposables.clear();
		dom.clearNode(this.navElement);
		dom.clearNode(this.contentElement);

		if (!this.course) {
			dom.append(this.contentElement, $('.course-page-empty', undefined,
				localize('coursePage.empty', "No course yet. Open a project to turn it into one.")));
			return;
		}

		const lesson = this.resolveSelection();
		this.selectedLessonId = lesson?.id;
		if (this.input instanceof CourseEditorInput) {
			this.input.selectedLessonId = lesson?.id;
		}

		this.renderNav(this.navElement, this.course);
		if (lesson) {
			this.renderLesson(this.contentElement, lesson);
		}
	}

	// --- left rail

	private renderNav(parent: HTMLElement, course: ICourse): void {
		const header = dom.append(parent, $('.course-page-nav-header'));
		dom.append(header, $('.course-page-title', undefined, course.title));

		const progress = this.courseService.getProgress();
		dom.append(header, $('.course-page-meta', undefined,
			localize('coursePage.progress', "{0} of {1} lessons complete", progress.done, progress.total)));
		const bar = dom.append(header, $('.course-page-progress'));
		const fill = dom.append(bar, $('.course-page-progress-fill'));
		fill.style.width = progress.total ? `${Math.round(100 * progress.done / progress.total)}%` : '0';

		for (const module of course.modules) {
			const moduleEl = dom.append(parent, $('.course-page-module'));
			dom.append(moduleEl, $('.course-page-module-title', undefined, module.title));
			const list = dom.append(moduleEl, $('.course-page-lessons', { role: 'list' }));
			for (const lesson of module.lessons) {
				this.renderNavLesson(list, lesson);
			}
		}
	}

	private renderNavLesson(parent: HTMLElement, lesson: ICourseLesson): void {
		const state = this.courseService.getLessonState(lesson.id);
		const row = dom.append(parent, $<HTMLButtonElement>(`button.course-page-lesson.${state}`, {
			role: 'listitem',
			'aria-label': localize('coursePage.lessonLabel', "Lesson: {0} ({1})", lesson.title, this.stateLabel(state)),
			'aria-current': lesson.id === this.selectedLessonId ? 'page' : 'false'
		}));
		row.classList.toggle('selected', lesson.id === this.selectedLessonId);

		const icons: Record<LessonState, ThemeIcon> = {
			[LessonState.Done]: Codicon.check,
			[LessonState.Active]: Codicon.play,
			[LessonState.Next]: Codicon.arrowRight,
			[LessonState.Locked]: Codicon.lock,
		};
		dom.append(row, $(`.course-page-lesson-icon${ThemeIcon.asCSSSelector(icons[state])}`));
		dom.append(row, $('.course-page-lesson-title', undefined, lesson.title));

		if (state === LessonState.Locked) {
			row.disabled = true;
		} else {
			this.renderDisposables.add(dom.addDisposableListener(row, dom.EventType.CLICK, () => {
				this.selectedLessonId = lesson.id;
				this.render();
			}));
		}
	}

	// --- lesson body

	private renderLesson(parent: HTMLElement, lesson: ICourseLesson): void {
		const state = this.courseService.getLessonState(lesson.id);
		const lessonEl = dom.append(parent, $('.course-page-lesson-body'));

		dom.append(lessonEl, $(`.course-page-state-tag.${state}`, undefined, this.stateLabel(state)));

		const markdown = dom.append(lessonEl, $('.course-page-markdown'));
		const rendered = this.markdownRendererService.render(new MarkdownString(lesson.content));
		this.renderDisposables.add(rendered);
		markdown.appendChild(rendered.element);

		if (state === LessonState.Active) {
			if (lesson.quiz) {
				this.renderQuiz(lessonEl, lesson);
			} else {
				this.renderCompleteButton(lessonEl, lesson);
			}
		} else if (state === LessonState.Done) {
			this.renderDoneFooter(lessonEl);
		} else {
			dom.append(lessonEl, $('.course-page-hint', undefined,
				localize('coursePage.finishCurrentFirst', "Finish the current lesson to unlock this one's quiz.")));
		}
	}

	private renderQuiz(parent: HTMLElement, lesson: ICourseLesson): void {
		const quiz = lesson.quiz!;
		const box = dom.append(parent, $('.course-page-quiz'));
		dom.append(box, $('.course-page-quiz-label', undefined, localize('coursePage.quiz', "check your understanding")));
		dom.append(box, $('.course-page-quiz-question', undefined, quiz.question));

		const opts = dom.append(box, $('.course-page-quiz-options'));
		quiz.options.forEach((option, i) => {
			const btn = dom.append(opts, $('button.course-page-quiz-option', {
				'aria-label': localize('coursePage.quizOption', "Answer: {0}", option)
			}));
			dom.append(btn, $('span.course-page-quiz-key', undefined, String.fromCharCode(97 + i)));
			dom.append(btn, $('span', undefined, option));
			this.renderDisposables.add(dom.addDisposableListener(btn, dom.EventType.CLICK, () => {
				if (i === quiz.correctIndex) {
					// completing re-renders the page via onDidChangeProgress
					this.courseService.completeLesson(lesson.id);
				} else {
					btn.classList.add('incorrect');
				}
			}));
		});
	}

	private renderCompleteButton(parent: HTMLElement, lesson: ICourseLesson): void {
		const btn = dom.append(parent, $('button.course-page-continue', undefined,
			localize('coursePage.markRead', "Mark as Read and Continue")));
		this.renderDisposables.add(dom.addDisposableListener(btn, dom.EventType.CLICK, () => {
			this.courseService.completeLesson(lesson.id);
		}));
	}

	private renderDoneFooter(parent: HTMLElement): void {
		const footer = dom.append(parent, $('.course-page-done-footer'));
		dom.append(footer, $(`.course-page-done-icon${ThemeIcon.asCSSSelector(Codicon.check)}`));

		const next = this.allLessons().find(l => this.courseService.getLessonState(l.id) === LessonState.Active);
		if (next) {
			dom.append(footer, $('span', undefined, localize('coursePage.lessonDone', "Lesson complete.")));
			const btn = dom.append(footer, $('button.course-page-continue', undefined,
				localize('coursePage.continue', "Continue: {0}", next.title)));
			this.renderDisposables.add(dom.addDisposableListener(btn, dom.EventType.CLICK, () => {
				this.selectedLessonId = next.id;
				this.render();
			}));
		} else {
			dom.append(footer, $('span', undefined, localize('coursePage.courseDone', "Course complete. Nice work!")));
		}
	}

	private stateLabel(state: LessonState): string {
		switch (state) {
			case LessonState.Done: return localize('coursePage.state.done', "done");
			case LessonState.Active: return localize('coursePage.state.now', "now");
			case LessonState.Next: return localize('coursePage.state.next', "next");
			case LessonState.Locked: return localize('coursePage.state.locked', "locked");
		}
	}
}
