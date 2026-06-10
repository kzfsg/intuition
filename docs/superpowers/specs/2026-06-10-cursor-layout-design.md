# Cursor-style layout: icon row defaults + title-bar Course button

**Date:** 2026-06-10
**Status:** Approved
**Reference:** `references/cursor-layout.png` (Cursor's actual layout)
**Builds on:** `2026-06-10-barebones-layout-design.md` (already ships `workbench.activityBar.location: 'top'` and `window.commandCenter: false` as Intuition defaults)

## Goal

Match Cursor's chrome as closely as the platform allows:

- Top of the sidebar: a centered horizontal row of five items — Explorer, Search,
  Source Control, Extensions, and an overflow dropdown holding everything else.
- Title bar right: a labeled **Course** button (mortar-board icon + "Course" text)
  next to the layout control, settings gear, and accounts icons — replacing the
  Course entry in the activity bar.
- No Course view container in the sidebar. The full-page Course editor and its
  commands keep working unchanged.

The activity-bar-on-top and plain-title-center pieces already exist via
`intuitionDefaults.contribution.ts` and are not part of this change.

## Decisions made

| Decision | Choice |
|---|---|
| Scope | Baked-in product default (code change), user-overridable |
| Course button style | Icon + "Course" label |
| Course sidebar entry | Removed entirely |
| Default pinning mechanism | Seed pinned-state storage once per profile (no upstream edits) |
| Migration | Seed applies once to existing profiles too (marker-key guard) |

## Design

### 1. Icon row defaults — `src/vs/workbench/browser/intuition/intuitionLayoutSeed.contribution.ts` (new)

An eager `IWorkbenchContribution` registered at `WorkbenchPhase.BlockRestore`
(before the sidebar renders) that seeds activity-bar state once per profile:

- Marker key `intuition.layoutSeed.v1` in `StorageScope.PROFILE`. If the
  marker exists, do nothing. Otherwise write the seed and set the marker — so
  the seed applies
  once to fresh installs *and* once to profiles that predate this change
  (overwriting any manual arrangement, once).
- Seed value for `workbench.activity.pinnedViewlets2` (PROFILE scope):
  - **Pinned, in order:** `workbench.view.explorer`, `workbench.view.search`,
    `workbench.view.scm`, `workbench.view.extensions`
  - **Unpinned:** the known bundled sidebar containers — `workbench.view.debug`
    (Run & Debug), `workbench.view.remote` (Remote Explorer),
    `workbench.view.extension.test` (Testing).
- Unpinned containers stay reachable through the composite bar's overflow
  dropdown ("⋯") at the end of the row — the Cursor chevron. 4 icons + the
  dropdown = the five centered items.
- **Implementation deviation:** upstream's overflow dropdown only lists
  *pinned* items that don't fit the width; unpinned containers were reachable
  only via right-click. To deliver the dropdown, an opt-in
  `showHiddenItemsInOverflow` flag was added to `compositeBar.ts` /
  `paneCompositeBar.ts` and enabled only by the sidebar's top bar in
  `sidebarPart.ts` (the classic vertical activity bar keeps stock behavior).
  Three files, ~10 lines, each marked with an `Intuition:` comment for
  upstream-sync time.
- Limitation (accepted): containers added by future upstream syncs auto-pin
  until a user unpins them or the seed version is bumped (`v2` marker).

### 2. Centered icon row — `src/vs/workbench/browser/intuition/media/intuitionLayout.css` (new)

Imported by the contribution above. One rule centering the horizontal
composite bar inside the sidebar title area
(`.monaco-workbench .part.sidebar > .title .composite-bar` flex centering).
Inert if the user moves the activity bar back to the side (the selector only
matches the horizontal layout).

### 3. Title-bar Course button — same new contribution file

- An `Action2` reusing the existing `OPEN_COURSE_COMMAND_ID`, appended to
  **`MenuId.TitleBar`**, `group: 'navigation'`, placing it on the right side
  of the custom title bar next to the layout control / gear / accounts (which
  already migrate there when the activity bar is on top).
- A custom action view item registered through `IActionViewItemService` (the
  chat title-bar button's mechanism) rendering the mortar-board icon plus a
  "Course" text label — the "Upgrade to Pro" slot in the reference image.

### 4. Course contribution slim-down — `intuitionCourse.contribution.ts`

- **Delete:** the view-container and view registration, `CoursePane` (file +
  its `coursePane.css`), and the two `MenuId.ViewTitle` menu entries that
  lived on the pane (`Open Course Page`, `Reset Progress`).
- **Keep:** `CourseEditor` + `CourseEditorInput` + serializer, `ICourseService`
  + implementation, `MockCourseProvider`, and all three commands
  (`OPEN_COURSE_COMMAND_ID`, `OPEN_LESSON_COMMAND_ID`,
  `RESET_PROGRESS_COMMAND_ID`).
- `Reset Course Progress` already has `f1: true`; its dead view-title `when`
  clause goes away with the pane. `Open Course Page` keeps `f1: true`.
- Constants `COURSE_CONTAINER_ID` / `COURSE_VIEW_ID` are removed if nothing
  else references them.

## Error handling

- The seed contribution wraps its storage write in a try/catch; a failure
  leaves stock VS Code behavior (all icons pinned) rather than breaking startup.
- The title-bar button renders only in the custom title bar (native title bar
  users still have the command palette entry).

## Testing

- Existing `courseService.test.ts` unit tests are unaffected (service layer
  untouched).
- A unit test for the seed's pinned-state JSON shape (pure function producing
  the seed value).
- Manual verification via the Playwright drive used previously:
  1. Fresh launch — screenshot: four centered icons + "⋯" atop the sidebar, no
     Course icon, labeled Course button in the title bar right.
  2. Click the Course button — the full-page Course editor opens.
  3. Relaunch with the same user-data dir — seed does not re-apply (marker).
