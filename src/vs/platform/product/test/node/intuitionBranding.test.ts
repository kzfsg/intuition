/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

/**
 * Branding invariants for the Intuition fork. These guard the rebrand from
 * regressing back toward the upstream "Code - OSS" / "GitHub Copilot" identity.
 * They read the on-disk source of truth (product.json, theme metadata) so they
 * stay valid regardless of how product configuration is loaded at runtime.
 */
suite('Intuition Branding', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	function findRepoRoot(): string {
		// Normalise to forward slashes so we can walk up without the 'path' module
		// (not permitted by the import rules for this layer).
		let dir = fileURLToPath(import.meta.url).replace(/\\/g, '/');
		dir = dir.substring(0, dir.lastIndexOf('/'));
		for (let i = 0; i < 12; i++) {
			if (fs.existsSync(`${dir}/product.json`)) {
				return dir;
			}
			const idx = dir.lastIndexOf('/');
			if (idx <= 0) {
				break;
			}
			dir = dir.substring(0, idx);
		}
		throw new Error('Could not locate repo root (product.json) from test location');
	}

	function readJson(relPath: string): any {
		return JSON.parse(fs.readFileSync(`${findRepoRoot()}/${relPath}`, 'utf8'));
	}

	test('product identity is rebranded to Intuition', () => {
		const product = readJson('product.json');
		assert.strictEqual(product.nameShort, 'Intuition');
		assert.strictEqual(product.nameLong, 'Intuition');
		assert.strictEqual(product.applicationName, 'intuition');
		assert.strictEqual(product.dataFolderName, '.intuition');
		assert.strictEqual(product.urlProtocol, 'intuition');
	});

	test('no legacy Code - OSS identity remains in core product fields', () => {
		const product = readJson('product.json');
		const fields = ['nameShort', 'nameLong', 'applicationName', 'dataFolderName', 'win32DirName', 'win32RegValueName', 'win32AppUserModelId'];
		for (const field of fields) {
			assert.ok(
				!/code\s*-?\s*oss/i.test(String(product[field])),
				`product.${field} still references Code - OSS: "${product[field]}"`
			);
		}
	});

	test('default chat agent wiring is preserved (functional, must not be rebranded)', () => {
		const product = readJson('product.json');
		// The fork still integrates with the real GitHub Copilot extension under the hood;
		// rebranding these IDs would break the integration.
		assert.strictEqual(product.defaultChatAgent.extensionId, 'GitHub.copilot');
		assert.strictEqual(product.defaultChatAgent.chatExtensionId, 'GitHub.copilot-chat');
	});

	test('default color themes are branded "Intuition"', () => {
		const nls = readJson('extensions/theme-defaults/package.nls.json');
		assert.strictEqual(nls.dark2026ThemeLabel, 'Intuition Dark');
		assert.strictEqual(nls.light2026ThemeLabel, 'Intuition Light');

		const darkTheme = readJson('extensions/theme-defaults/themes/2026-dark.json');
		assert.strictEqual(darkTheme.name, 'Intuition Dark');
	});
});
