/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';

/**
 * Best-effort short HEAD commit of a workspace root, read straight from
 * .git — no dependency on the git extension. Any failure returns undefined
 * (not a git repo, packed refs, detached worktree layouts, …).
 */
export async function readHeadCommit(fileService: IFileService, root: URI): Promise<string | undefined> {
	try {
		const head = (await fileService.readFile(URI.joinPath(root, '.git', 'HEAD'))).value.toString().trim();
		if (!head.startsWith('ref:')) {
			return head.slice(0, 7);
		}
		const ref = head.slice(4).trim();
		const commit = (await fileService.readFile(URI.joinPath(root, '.git', ...ref.split('/')))).value.toString().trim();
		return commit.slice(0, 7) || undefined;
	} catch {
		return undefined;
	}
}
