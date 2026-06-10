/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * One-shot activity-bar layout seed (see
 * docs/superpowers/specs/2026-06-10-cursor-layout-design.md).
 *
 * Cursor's sidebar header shows four icons — files, search, source control,
 * extensions — with everything else behind the overflow dropdown. VS Code
 * auto-pins every view container, so on first run per profile Intuition seeds
 * the pinned-viewlets storage with this list instead. It is a DEFAULT, not a
 * lock: users can re-pin anything afterwards and the seed never re-applies
 * (guarded by the marker key below; bump its version to re-seed).
 */

/** Storage key the workbench reads pinned activity-bar items from (PROFILE scope). */
export const PINNED_VIEWLETS_STORAGE_KEY = 'workbench.activity.pinnedViewlets2';

/** Marker key recording that the seed has been applied to this profile. */
export const INTUITION_LAYOUT_SEED_MARKER_KEY = 'intuition.layoutSeed.v1';

/** Matches the `IPinnedViewContainer` shape in `paneCompositeBar.ts`. */
export interface IIntuitionPinnedViewlet {
	readonly id: string;
	readonly pinned: boolean;
	readonly order: number;
	readonly visible: boolean;
}

export const INTUITION_PINNED_VIEWLETS_SEED: readonly IIntuitionPinnedViewlet[] = Object.freeze([
	// Cursor's four: files, search, git, extensions.
	{ id: 'workbench.view.explorer', pinned: true, order: 0, visible: true },
	{ id: 'workbench.view.search', pinned: true, order: 1, visible: true },
	{ id: 'workbench.view.scm', pinned: true, order: 2, visible: true },
	{ id: 'workbench.view.extensions', pinned: true, order: 3, visible: true },
	// Bundled containers demoted to the overflow dropdown.
	{ id: 'workbench.view.debug', pinned: false, order: 4, visible: false },
	{ id: 'workbench.view.remote', pinned: false, order: 5, visible: false },
	{ id: 'workbench.view.extension.test', pinned: false, order: 6, visible: false },
]);
