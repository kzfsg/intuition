# Course Tab v1 — UI Shell ("your codebase, as a course") — Design

**Date:** 2026-06-10
**Status:** Approved scope (user decisions: UI shell + mock data first; LLM generation is BYOK, later)
**Repo:** Intuition (VS Code fork), branch `course-tab-shell`
**Reference:** `design/intuition-welcome.html` (course panel mock), session log `docs/sessions/2026-06-10-rebrand-build-layout-session.md`

## Problem

Intuition's product — a curriculum generated from the user's real codebase, kept in
sync by the Staleness Oracle — has no surface in the IDE. Everything to date is
rebrand + layout. v1 makes the Course tab exist: the view container, the lesson
list, lesson reading, and the quiz interaction, driven by a hand-written
curriculum, with the generation seam (`ICourseProvider`) designed for the future
BYOK (user's Anthropic key) pipeline.

## Goals

- A **Course** view container in the activity bar (mortar-board icon) showing:
  course title, progress bar, module's lessons with status (done / now / next /
  locked), and a "check your understanding" quiz block for the active lesson.
- Clicking a lesson opens its content as a **readonly markdown document**
  (virtual, `intuition-course:` scheme).
- Answering the active lesson's quiz correctly marks it done and advances; the
  next lesson unlocks. Progress survives restarts (workspace-scoped storage).
- All course data flows through `ICourseProvider.provideCourse()`. v1 ships one
  provider: a built-in mock curriculum that teaches *this codebase's own
  architecture* (dogfooding; the lessons reference real files).

## Non-goals (v1)

- No LLM calls, no API-key settings, no tree-sitter indexing, no knowledge
  graph, no Staleness Oracle. The provider interface is the only concession to
  that future.
- No webviews; native workbench DOM only.
- No custom welcome/get-started integration.

## Fork-strategy compliance

- All code in one Intuition-owned directory:
  `src/vs/workbench/contrib/intuitionCourse/` — never conflicts on upstream sync.
- Exactly **one** upstream-file edit: the import line in
  `src/vs/workbench/workbench.common.main.ts` (same pattern as
  `intuitionDefaults.contribution.ts`).

## Design

### Layout

```
intuitionCourse/
  common/
    course.ts                    // types: ICourse, ICourseModule, ICourseLesson, ICourseQuiz; LessonState
    courseService.ts             // ICourseService interface + decorator; ICourseProvider interface
  browser/
    courseServiceImpl.ts         // CourseService: provider registry, progress in IStorageService (WORKSPACE scope)
    mockCourseProvider.ts        // hand-written course about the Intuition workbench itself
    coursePane.ts                // ViewPane: header, progress, lessons, quiz (DOM, themable)
    courseLessonContentProvider.ts // ITextModelContentProvider for intuition-course: scheme
    intuitionCourse.contribution.ts // container+view registration, commands, service singleton
    media/coursePane.css
  test/browser/
    courseService.test.ts
```

### Data model

`ICourse { id, title, modules: ICourseModule[] }`;
`ICourseModule { id, title, lessons: ICourseLesson[] }`;
`ICourseLesson { id, title, content (markdown), quiz?: ICourseQuiz }`;
`ICourseQuiz { question, options: string[], correctIndex }`.

Lesson **state is derived**, not stored per-lesson: the service persists a set of
completed lesson ids; the first incomplete lesson is `active`, the one after is
`next`, the rest are `locked`. Done-ness is the only mutable fact — keeps
storage and migration trivial.

### Service

`ICourseService` (singleton, `InstantiationType.Delayed`):
- `getCourse(): Promise<ICourse | undefined>` — asks the registered provider once, caches.
- `getLessonState(lessonId)` / `isComplete(lessonId)`.
- `completeLesson(lessonId)` / `resetProgress()`.
- `onDidChangeProgress`, `onDidChangeCourse` events.
- `registerProvider(provider)` — v1 contribution registers the mock; the future
  BYOK generator registers here too.

Progress key: `intuition.course.progress.<courseId>` in `StorageScope.WORKSPACE`,
`StorageTarget.MACHINE`.

### View

`CoursePane extends ViewPane` rendering with `dom.ts` helpers and standard color
tokens (`progressBar.background`, `descriptionForeground`, list hover tokens) so
both Intuition themes work without new colors. Buttons get real `aria-label`s;
quiz options are buttons, keyboard-operable. Re-renders on service events; no
incremental DOM diffing in v1 (course is small).

Commands:
- `intuition.course.openLesson` — opens `intuition-course:/<courseId>/<lessonId>.md`
  via `ITextModelService`, readonly, language `markdown`.
- `intuition.course.resetProgress` — view title menu.

### Drift alarm

`courseService.test.ts` covers: completion → derived states, persistence
round-trip, quiz-correct → complete + advance, provider caching. Standard
`ensureNoDisposablesAreLeakedInTestSuite` discipline.

## Risks

| Risk | Mitigation |
|---|---|
| Activity bar is `top` (our default); icon crowding | One icon; verified visually at launch |
| `mergeViewWithContainerWhenSingleView` quirks | Same options markers/explorer use; manual check |
| Upstream sync moves ViewPane API | All usage in one dir; typecheck catches it |
