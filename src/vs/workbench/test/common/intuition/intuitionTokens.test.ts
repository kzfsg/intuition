/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { INTUITION_PALETTE, INTUITION_SPECTRUM } from '../../../common/intuition/intuitionTokens.js';

suite('Intuition Tokens', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	const HEX = /^#[0-9a-f]{6}$/i;
	const REQUIRED_KEYS = ['background', 'raised', 'surface', 'foreground', 'muted', 'mutedForeground', 'border', 'iris', 'violet', 'cyan', 'lime'] as const;

	for (const kind of ['dark', 'light'] as const) {
		test(`${kind} palette defines every token as a 6-digit hex`, () => {
			const palette = INTUITION_PALETTE[kind];
			for (const key of REQUIRED_KEYS) {
				assert.ok(HEX.test(palette[key]), `${kind}.${key} = '${palette[key]}' is not a #rrggbb hex`);
			}
		});
		test(`${kind} spectrum is iris/violet/cyan in order`, () => {
			assert.deepStrictEqual(INTUITION_SPECTRUM[kind], [INTUITION_PALETTE[kind].iris, INTUITION_PALETTE[kind].violet, INTUITION_PALETTE[kind].cyan]);
		});
	}

	test('dark and light are distinct themes (iris differs)', () => {
		assert.notStrictEqual(INTUITION_PALETTE.dark.iris, INTUITION_PALETTE.light.iris);
	});
});
