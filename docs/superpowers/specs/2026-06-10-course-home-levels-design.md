# Course home: level toggle + curriculum overview (mock data)

**Date:** 2026-06-10
**Status:** Approved
**Builds on:** `2026-06-10-course-lifecycle-start-screen-design.md` (sub-project A)
**Scope note:** mock data only — the real indexer (sub-project B) later returns the same catalog shape.

## Goal

The Course tab opens on a **home view**: a level toggle (Language / Framework /
Codebase), and for the active level a beginner-friendly curriculum overview —
title, description, progress, and numbered chapter cards listing their
lessons. Clicking a lesson enters the existing rail+body lesson view; a
"← Course home" link returns. One index produces outlines for **all three
levels**; switching levels is instant and each level keeps its own progress.

## Design

### 1. Data model (`common/course.ts`)

```ts
export interface ICourseCatalog {
	/** Short commit hash the catalog was indexed at; undefined outside a git repo. */
	readonly indexedCommit?: string;
	/** One course per level (a level may be absent). */
	readonly courses: readonly ICourse[];
}
```

- `ICourse`: `indexedCommit` moves up to the catalog and is removed here;
  gains `readonly description?: string` (one-liner under the home title).
- Lesson ids are globally unique across the catalog (mock uses `lang-…`,
  `fw-…` prefixes; existing codebase lesson ids stay).

### 2. Protocol (`common/courseService.ts`)

- `ICourseProvider.provideCourse()` → **`provideCatalog(): Promise<ICourseCatalog | undefined>`**
  (undefined unless Ready). `provideLessonContent(lessonId)` unchanged —
  ids are catalog-unique.
- `ICourseService` changes:
  - `getCatalog(): Promise<ICourseCatalog | undefined>` (new)
  - `getCourse()` now resolves the **active level's** course from the catalog.
  - `getActiveLevel(): CourseLevel` / `setActiveLevel(level: CourseLevel): void`
    — persisted per workspace (`intuition.course.activeLevel`, WORKSPACE
    scope), default `Codebase`; setter fires `onDidChangeCourse`.
  - Lesson-keyed methods (`getLesson`, `getLessonState`, `getProgress`,
    `completeLesson`, `getLessonContent`) operate on the active level's
    course. Progress keys off `course.id`, so levels are isolated for free.

### 3. Service (`courseServiceImpl.ts`)

- Cache (`intuition.course.cache`, WORKSPACE) now stores the catalog JSON
  with resolved lazy bodies merged in. **Shape guard:** parsed JSON without a
  `courses` array is discarded (silently invalidates sub-project A's
  single-course cache format in dev profiles).
- `setActiveLevel`: stores the level, re-derives lesson order + progress for
  that course, fires `onDidChangeCourse`. Falls back to the first course in
  the catalog if the active level has none.
- `reindex()` also clears the stored active level.

### 4. Course home (`courseEditor.ts` + CSS)

Ready state gets a `viewMode: 'home' | 'lesson'` (default `home`):

- **Home:** level toggle pills (all three enabled; active one highlighted);
  course title + `description`; "N of M lessons complete" + progress bar;
  one card per module: "Chapter {n} · {title}" header, lessons listed with
  the existing state icons; the Active lesson row shows a "Continue" pill;
  Locked rows are dimmed and disabled. Clicking an unlocked lesson sets
  `selectedLessonId` and switches to `lesson` mode. The indexed-commit /
  Re-index footer renders at the bottom of home (moved from the lesson rail).
- **Lesson:** the existing rail+body view, plus a "← Course home" button at
  the top of the rail switching back to `home`.
- Deep links: `setInput`/`setOptions` with `selectedLessonId` open straight
  into `lesson` mode (OPEN_LESSON command behavior unchanged).
- **Start screen:** all three level cards become selectable (no more "coming
  soon"); copy notes "All levels are generated — you can switch anytime."
  The chosen card sets the initial active level via `setActiveLevel` after
  `startGeneration`.

### 5. Mock data (`browser/mockCurricula.ts`, new)

Exports `mockCatalogCourses: readonly ICourse[]` — three curricula:

- **Codebase:** the existing "the intuition workbench" course, unchanged
  (moved out of `mockCourseProvider.ts`), plus a `description`.
- **Language:** "TypeScript, from zero" — taught through this repo's own
  code. 3 chapters (values & types; functions & control flow; reading real
  code) × ~3 lessons, real titles, 1–2 paragraph stub bodies labeled as
  sample lessons. One quiz to demo the mechanics.
- **Framework:** "the workbench framework" — 3 chapters (the editor shell;
  services as a framework; contributions & extension points) × ~3 lessons,
  same stub style.

`MockCourseProvider.provideCatalog()` returns all three (outline-stripped,
bodies via `provideLessonContent`), stamped with the best-effort HEAD hash.

## Error handling

- Catalog with no course for the active level → service falls back to the
  first available course; home highlights that course's level.
- Old-format/malformed cache → discarded (NotStarted), never fatal.

## Testing

- Unit: catalog resolution, active-level switching (event fired, course
  swapped), per-level progress isolation, cache shape guard rejects the old
  single-course format, lazy content across levels.
- Playwright: index → home shows Codebase; toggle to Language and Framework
  (screenshot each — distinct curricula, independent progress); click a
  lesson → lesson view with back link; "← Course home" returns; relaunch
  lands on home from cache with the last active level.
