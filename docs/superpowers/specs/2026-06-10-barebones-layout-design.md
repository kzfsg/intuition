# Barebones Default Layout ("Cursor-faithful") — Design

**Date:** 2026-06-10
**Status:** Approved by user (pending spec review)
**Repo:** Intuition (VS Code fork), branch `rebrand-intuition`

## Problem

Intuition ships with VS Code's default layout and first-run surfaces: welcome page, onboarding wizard, tips, upsell notifications, and surveys. Our users — coders choosing between VS Code, Cursor, and Intuition — expect a clean, minimal IDE like Cursor (reference: `references/Cursor Layout.png`). The clutter dilutes the product and buries our future Course tab.

## Goals

- Default layout matches Cursor: activity icons in a horizontal row atop the sidebar, plain window title, chat in the right sidebar, terminal hidden until opened, clean empty editor on startup.
- No first-run bloat: no welcome page, onboarding wizard, watermark tips, chat tips, upsell notifications, auto-opened release notes, or surveys.
- Every change is a *default*. Users can re-enable anything through normal settings.

## Non-goals

- Changing the coding experience: editor tabs, minimap, breadcrumbs, IntelliSense, debugging, search, git, and terminal behavior all stay stock.
- Deleting upstream code. (See "Fork strategy" below.)
- Building the Course tab or custom welcome (separate project).

## Fork strategy (decided)

Pinned upstream with slow, deliberate syncs (~every 6–12 months, driven by Electron/security needs). Therefore:

- **Disable, don't delete.** Bloat is turned off via setting defaults in one Intuition-owned file, not removed from the codebase. Scattered deletions in high-churn upstream areas (welcome, chat, layout) would make every sync painful for a small team.
- **All new product code lives in Intuition-owned directories**, which never conflict on merge.
- Built-in extensions are the one exception: we exclude four legacy ones at build time (a list edit, trivially re-applied after a sync).

## Design

### 1. One owned defaults file

New file: `src/vs/workbench/browser/intuition/intuitionDefaults.contribution.ts`

- Registers all setting-default overrides through the configuration registry (`registerDefaultConfigurations`), the same mechanism extensions use. The Settings UI shows each value as a default; users override normally.
- Registration runs at **module load**, not in a lifecycle-phase contribution. The layout engine reads these settings during workbench startup; a phased contribution registers too late.
- Wired in by one import line in `src/vs/workbench/workbench.common.main.ts`.
- File header documents the fork strategy so future contributors understand why this file exists.

Total upstream diff: one new directory, four line/list edits.

### 2. Defaults map

```jsonc
// Layout — Cursor-faithful
"workbench.activityBar.location": "top",   // horizontal icons atop sidebar
"window.commandCenter": false,             // plain window title
"workbench.startupEditor": "none",         // clean empty editor

// Bloat off (all user-re-enableable)
"workbench.welcomePage.experimentalOnboarding": false,
"workbench.tips.enabled": false,           // editor watermark
"chat.tips.enabled": false,
"chat.growthNotification.enabled": false,  // upsell session items
"update.showReleaseNotes": false
```

Note: `chat.growthNotification.enabled` already defaults to `false` upstream but carries an `experiment` block that can flip it remotely; pinning it explicitly is deliberate, not redundant — do not drop it from the defaults map.

Deliberately **not** set:

| Setting | Why untouched |
|---|---|
| `workbench.statusBar.visible` | Cursor keeps a thin status bar; so do we |
| `workbench.secondarySideBar.defaultVisibility` | Upstream default (`visibleInWorkspace`) already matches Cursor: chat open in workspaces |
| Editor tabs, minimap, breadcrumbs | Coding experience stays stock |
| `workbench.layoutControl.enabled` | Layout toggles visible in reference screenshot |

### 3. Built-in extension exclusion

Exclude `grunt`, `gulp`, `jake`, and `php-language-features` via three list edits, each controlling a different stage:

- `build/lib/extensions.ts` (`excludedExtensions` array, ~line 310) — **this is what excludes them from packaged builds.** Packaging globs `extensions/*/package.json` and filters against this list; it never consults the compilations list.
- `build/gulpfile.extensions.ts` (compilations list) — skips compiling them (build-time savings only).
- `build/npm/dirs.ts` (install list) — their dependencies never install.

PHP *syntax highlighting* lives in the separate `php` grammar extension and is kept. All four remain installable from Open VSX.

Known caveat: in dev-from-source runs the four directories remain on disk as inert, uncompiled folders. Cosmetic only.

### 4. Verify-first items (resolved during implementation, not assumed)

1. **Surveys.** NPS and language surveys require survey URLs in `product.json`, which we do not ship — they are likely already inert. If so, leave `telemetry.feedback.enabled` alone, preserving **Help → Report Issue**. Only if surveys still fire do we hunt a narrower switch.
2. **Agents Window.** It ships its own layout overrides (status bar and command center off). Confirm our global defaults do not fight them.
3. **Exact setting keys.** Confirm `chat.growthNotification.enabled` and `update.showReleaseNotes` against the configuration registry before relying on them. (Spec review verified both at `src/vs/workbench/contrib/chat/common/constants.ts:71` and `src/vs/platform/update/common/update.config.contribution.ts:74`; re-confirm at implementation time.)

### 5. Testing

- **Unit test** (`intuitionDefaults.test.ts`): asserts every override is registered with our value, and that each key exists in the configuration registry's schema. If a future upstream sync renames a setting, the test fails loudly instead of the default silently no-opping. This is the drift alarm that makes the pinned-upstream strategy safe.
  - Implementation note: the configuration registry is a shared platform singleton, but a key only appears in it once its registering module loads. The test must import the contribution modules that register the asserted keys (e.g. `update.showReleaseNotes` registers in `src/vs/platform/update/common/update.config.contribution.ts`, not the workbench), or scope the schema-existence assertion to keys whose modules the test loads.
- **Manual launch check** (fresh user-data dir): activity icons on top; no welcome tab; no command center; chat visible on the right in a workspace; terminal hidden; status bar present; Agents Window unaffected; Help → Report Issue works.
- Existing gates: `tsgo` typecheck and the hygiene pre-commit hook.

## Error handling

Registration is synchronous and total; there is no async failure path. The one real failure mode — upstream renames a setting key during a sync — is covered by the schema-existence assertion in the unit test.

## Risks

| Risk | Mitigation |
|---|---|
| Upstream renames an overridden setting at sync time | Unit test asserts each key exists in the registry schema |
| Defaults fight Agents Window overrides | Verify-first item 2; manual check before merge |
| Disabling feedback kills issue reporter | Verify-first item 1; prefer not touching the feedback switch |
| New-to-IDE users can't find hidden views | Chose "Cursor-faithful" over "even leaner": activity icons stay visible, status bar kept |
