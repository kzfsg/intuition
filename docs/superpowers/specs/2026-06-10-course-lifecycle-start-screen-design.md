# Course lifecycle + start screen (sub-project A)

**Date:** 2026-06-10
**Status:** Approved
**Builds on:** `2026-06-10-course-tab-shell-design.md` (course tab v1), the full-page Course editor (`courseEditor.ts`)
**Followed by:** sub-project B — BYOK + the real Level-3 indexer (separate spec; B also owns the repo-index data structure, which is deliberately NOT designed here)

## Goal

Course generation becomes a user-initiated, observable lifecycle. Clicking the
Course button on a repo with no generated course lands on a **start screen**
(consent + level picker + Start). Starting plays an **indexing** progress
phase, then the course outline appears with **lazily loaded lesson bodies**.
The generated course is **cached per workspace** and stamped with the commit
it was indexed at; a **re-index** affordance returns to the start screen.

Everything in A is driven by a **simulated provider** (the existing mock
curriculum behind fake staged progress), so the whole lifecycle is buildable
and Playwright-verifiable now, with no API keys. Sub-project B replaces the
simulation behind the same protocol with zero UI changes.

## Pedagogical context (from the design discussion)

- Levels = which knowledge layer is the learner's frontier: `language` (L1),
  `framework` (L2), `codebase` (L3). Principle: **one novel layer at a time**.
- v1 nails **Level 3 (codebase)**: L1/L2 appear in the picker greyed out
  ("coming soon") so the framework's shape is visible from day one.
- Explicit click-to-index matters: BYOK means indexing sends the user's code
  to their model on their dime. The click is consent.

## Design

### 1. Data model (`common/course.ts`)

```ts
export const enum CourseLevel {
	Language = 'language',   // L1: doesn't know the language
	Framework = 'framework', // L2: knows the language, not the framework
	Codebase = 'codebase',   // L3: knows both, learning this repo
}
```

- `ICourse` gains `readonly level: CourseLevel` and
  `readonly indexedCommit?: string` (short hash; undefined when the workspace
  is not a git repo).
- `ICourseLesson.content` becomes **optional**: an outline-only lesson has
  `content: undefined` and is resolved on demand (see protocol). Quizzes stay
  eager (they are small and the editor's nav needs them).

### 2. Provider protocol v2 (`common/courseService.ts`)

```ts
export const enum CourseGenerationState {
	NotStarted = 'notStarted',
	Indexing = 'indexing',
	Ready = 'ready',
	Error = 'error',
}

export interface ICourseGenerationProgress {
	/** Human-readable stage, e.g. "Tracing flows…". Stages narrate the pipeline. */
	readonly stage: string;
	/** 0..100 when determinate; undefined renders an indeterminate bar. */
	readonly percent?: number;
}

export interface ICourseGenerationOptions {
	readonly level: CourseLevel;
}

export interface ICourseProvider {
	readonly onDidChangeGenerationState: Event<void>;
	getGenerationState(): CourseGenerationState;
	getGenerationProgress(): ICourseGenerationProgress | undefined; // only while Indexing
	getGenerationError(): string | undefined;                       // only while Error
	startGeneration(options: ICourseGenerationOptions): void;       // NotStarted/Error -> Indexing
	cancelGeneration(): void;                                       // Indexing -> NotStarted
	reset(): void;                                                  // Ready/Error -> NotStarted (re-index)
	/** Resolves the course outline; undefined unless state is Ready. */
	provideCourse(): Promise<ICourse | undefined>;
	/** Resolves a lazy lesson body (markdown). Called at most once per lesson per session. */
	provideLessonContent(lessonId: string): Promise<string>;
}
```

### 3. Service (`courseServiceImpl.ts`)

- Forwards the provider's state/progress/error and re-fires
  `onDidChangeCourse` on state changes; exposes `startGeneration`,
  `cancelGeneration`, `getGenerationState/Progress/Error` on `ICourseService`.
- `getLessonContent(lessonId)`: returns `lesson.content` if present, else
  resolves via `provider.provideLessonContent` and memoizes the result. No
  event needed — the editor awaits the returned promise directly.
- **State precedence:** a cached course means Ready, regardless of the
  provider; otherwise the provider's state is reported as-is.
- **Course cache:** when the provider transitions to Ready and the course
  resolves, the service stores the full course JSON (including any resolved
  lesson bodies at save time) under `intuition.course.cache` in
  `StorageScope.WORKSPACE`. On startup, a cached course makes the service
  report Ready and serve the cached course **without touching the provider**.
  Lazy bodies missing from the cache still resolve through the provider and
  are re-persisted.
- **Re-index:** new command `intuition.course.reindex` ("Re-index Course",
  f1) clears the cache, calls `provider.reset()`, and fires change so open
  editors fall back to the start screen. Lesson progress is kept (it keys
  off `course.id`; a regenerated course with the same id resumes, a new id
  starts fresh).
- Existing progress (completed lessons) keys off `course.id` and is untouched.

### 4. Start screen + lifecycle UI (`courseEditor.ts` + CSS)

The editor renders by generation state:

- **NotStarted:** centered start screen —
  - Title ("Learn this codebase") + consent copy: workspace folder name, "
    Intuition will scan this repository and use your configured model to
    build a course about this codebase." (In A the simulated provider is
    local-only; the copy is written for the real pipeline.)
  - Scope line: "~N source files" counted once via `ISearchService`
    (respecting `files.exclude` / `search.exclude`), shown as soon as the
    count resolves.
  - Level picker: three cards. `Codebase` selectable + selected by default;
    `Language` and `Framework` rendered disabled with a "coming soon" tag.
  - **Start button** → `startGeneration({ level })`.
- **Indexing:** stage narration (the provider's `stage` strings as a list,
  current one highlighted), progress bar (determinate when `percent`
  given), Cancel link → `cancelGeneration()` → back to NotStarted.
- **Error:** message + Retry button (`startGeneration` again).
- **Ready:** the existing course page, plus:
  - lazy bodies: opening a lesson whose `content` is unresolved shows a
    loading skeleton in the content pane until `getLessonContent` resolves;
  - a footer line "indexed at `<shortHash>`" with a "Re-index" link invoking
    `intuition.course.reindex`. When the current HEAD differs from
    `indexedCommit`, append "(repository has changed since)".

HEAD lookup: via `IWorkspaceContextService` + the git extension is overkill —
A reads `.git/HEAD`/ref through `IFileService` best-effort; failures mean the
hash/staleness line is simply omitted. (B may improve this.)

### 5. Simulated provider (`mockCourseProvider.ts`)

Implements protocol v2 and **stays after B ships** as the dev/fallback provider:

- `startGeneration` plays staged progress on timers (~4s total):
  "Mapping folders…" → "Finding entry points…" → "Reading the dialect…" →
  "Tracing flows…" → Ready. Cancel aborts the timers.
- Serves the existing mock curriculum, re-stamped
  `{ level: options.level, indexedCommit: <best-effort HEAD> }`, with lesson
  `content` stripped from the outline and served via
  `provideLessonContent` with ~600ms simulated latency per body.

### 6. Out of scope (sub-project B)

Model calls, key/model settings, cost estimation, anchor validation, the
repo-index data structure (user is designing this separately), real flow
tracing, L1/L2 curricula.

## Error handling

- Cache read failures are dropped (malformed JSON → behave as NotStarted).
- Provider exceptions during `startGeneration`/`provideLessonContent` put the
  editor in the Error state with the message; Retry restarts.
- A workspace without a folder (empty window) renders the start screen with
  the Start button disabled and a hint to open a folder.

## Testing

- Unit (extend `courseService.test.ts` + new suite): state forwarding,
  cache write-on-ready / serve-from-cache-without-provider, re-index clears
  cache, lazy content resolution + memo, progress persistence unaffected.
- Playwright end-to-end (screenshots committed): fresh workspace → start
  screen (level picker, file count) → Start → indexing stages visible →
  outline appears → open lesson (skeleton → body) → relaunch same
  user-data dir + workspace → lands on Ready from cache (no re-index) →
  Re-index → back to start screen.
