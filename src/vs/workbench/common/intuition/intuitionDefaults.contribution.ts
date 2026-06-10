/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../platform/configuration/common/configurationRegistry.js';
import { Registry } from '../../../platform/registry/common/platform.js';

/**
 * Intuition's default-settings overlay.
 *
 * STRATEGY (see docs/superpowers/specs/2026-06-10-barebones-layout-design.md):
 * this fork pins upstream VS Code and syncs rarely, so all of Intuition's
 * layout/bloat opinions live HERE as setting DEFAULTS — one owned file with a
 * tiny merge surface — instead of edits or deletions scattered through
 * upstream code. Every value below is a default, not a lock: users can
 * override any of them in their settings.
 *
 * Layout target: Cursor-faithful (references/cursor-layout.png) — activity
 * icons in a horizontal row atop the sidebar, plain window title, clean empty
 * editor on startup, chat in the right sidebar (already the upstream
 * default), thin status bar kept, terminal hidden until opened.
 *
 * These defaults are registered with `preventExperimentOverride: true` so that
 * remote experiments cannot flip them after the product ships.
 */
export const intuitionDefaultOverrides = Object.freeze<Record<string, unknown>>({

	// --- Layout: Cursor-faithful ---
	'workbench.activityBar.location': 'top',
	'window.commandCenter': false,
	'workbench.startupEditor': 'none',

	// --- First-run / ambient bloat off (all user-re-enableable) ---
	'workbench.welcomePage.experimentalOnboarding': false,
	'workbench.tips.enabled': false,
	'chat.tips.enabled': false,
	// Already false upstream, but carries an `experiment` block that can flip
	// it remotely; pinning it here is deliberate.
	'chat.growthNotification.enabled': false,
	'update.showReleaseNotes': false,
});

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration)
	.registerDefaultConfigurations([{
		overrides: { ...intuitionDefaultOverrides },
		source: 'intuitionDefaults',
		preventExperimentOverride: true
	}]);
