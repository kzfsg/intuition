/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IConfigurationRegistry, Extensions as ConfigurationExtensions } from '../../../../platform/configuration/common/configurationRegistry.js';
import { intuitionDefaultOverrides } from '../../../common/intuition/intuitionDefaults.contribution.js';
// Load the platform-level contribution that registers 'update.showReleaseNotes',
// so the schema-existence assertion below can see it.
import '../../../../platform/update/common/update.config.contribution.js';

suite('Intuition Default Overrides', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const registry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);

	test('every Intuition override is registered as a configuration default', () => {
		const overrides = registry.getConfigurationDefaultsOverrides();
		for (const [key, expected] of Object.entries(intuitionDefaultOverrides)) {
			const actual = overrides.get(key);
			assert.ok(actual !== undefined, `Intuition default for '${key}' is not registered`);
			assert.strictEqual(actual.value, expected, `Intuition default for '${key}' has wrong value`);
		}
	});

	test('overridden keys still exist in the configuration schema (upstream drift alarm)', () => {
		// Keys whose registering modules are loaded in this test environment. The other
		// keys register in heavy browser-layer modules we cannot load here and get NO
		// schema-existence check — registering a default for a renamed key succeeds
		// silently, so renames of those keys are only caught manually at upstream-sync
		// time (see follow-up #4 in docs/superpowers/plans/2026-06-10-barebones-layout.md).
		const schemaCheckedKeys = ['update.showReleaseNotes'];
		const properties = registry.getConfigurationProperties();
		for (const key of schemaCheckedKeys) {
			assert.ok(properties[key], `Setting '${key}' no longer exists upstream — fix intuitionDefaults.contribution.ts`);
		}
	});
});
