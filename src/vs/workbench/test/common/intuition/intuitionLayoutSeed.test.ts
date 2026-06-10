/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { INTUITION_LAYOUT_SEED_MARKER_KEY, INTUITION_PINNED_VIEWLETS_SEED, PINNED_VIEWLETS_STORAGE_KEY } from '../../../common/intuition/intuitionLayoutSeed.js';

suite('Intuition Layout Seed', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('storage key and marker key are the expected literals', () => {
		assert.strictEqual(PINNED_VIEWLETS_STORAGE_KEY, 'workbench.activity.pinnedViewlets2');
		assert.strictEqual(INTUITION_LAYOUT_SEED_MARKER_KEY, 'intuition.layoutSeed.v1');
	});

	test('pins exactly explorer, search, scm, extensions in Cursor order', () => {
		const pinned = INTUITION_PINNED_VIEWLETS_SEED.filter(v => v.pinned);
		assert.deepStrictEqual(pinned.map(v => v.id), [
			'workbench.view.explorer',
			'workbench.view.search',
			'workbench.view.scm',
			'workbench.view.extensions',
		]);
	});

	test('known bundled containers are present but unpinned', () => {
		const unpinned = INTUITION_PINNED_VIEWLETS_SEED.filter(v => !v.pinned).map(v => v.id);
		for (const id of ['workbench.view.debug', 'workbench.view.remote', 'workbench.view.extension.test']) {
			assert.ok(unpinned.includes(id), `expected '${id}' to be seeded unpinned`);
		}
	});

	test('seed entries have the IPinnedViewContainer shape and strictly increasing order', () => {
		let lastOrder = -1;
		for (const entry of INTUITION_PINNED_VIEWLETS_SEED) {
			assert.strictEqual(typeof entry.id, 'string');
			assert.strictEqual(typeof entry.pinned, 'boolean');
			assert.strictEqual(typeof entry.visible, 'boolean');
			assert.strictEqual(typeof entry.order, 'number');
			assert.ok(entry.order > lastOrder, 'order values must be strictly increasing');
			lastOrder = entry.order;
		}
	});

	test('seed round-trips through JSON (what gets written to storage)', () => {
		const json = JSON.stringify(INTUITION_PINNED_VIEWLETS_SEED);
		assert.deepStrictEqual(JSON.parse(json), INTUITION_PINNED_VIEWLETS_SEED);
	});
});
