/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/intuitionLayout.css';
import { IStorageService, StorageScope, StorageTarget } from '../../../platform/storage/common/storage.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../common/contributions.js';
import { INTUITION_LAYOUT_SEED_MARKER_KEY, INTUITION_PINNED_VIEWLETS_SEED, PINNED_VIEWLETS_STORAGE_KEY } from '../../common/intuition/intuitionLayoutSeed.js';

/**
 * Applies Intuition's Cursor-style activity-bar seed once per profile, BEFORE
 * the sidebar renders (BlockRestore). A failure here must never break startup:
 * worst case the profile keeps stock VS Code pinning.
 */
export class IntuitionLayoutSeedContribution implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.intuitionLayoutSeed';

	constructor(@IStorageService storageService: IStorageService) {
		try {
			if (storageService.get(INTUITION_LAYOUT_SEED_MARKER_KEY, StorageScope.PROFILE)) {
				return;
			}
			storageService.store(PINNED_VIEWLETS_STORAGE_KEY, JSON.stringify(INTUITION_PINNED_VIEWLETS_SEED), StorageScope.PROFILE, StorageTarget.USER);
			storageService.store(INTUITION_LAYOUT_SEED_MARKER_KEY, true, StorageScope.PROFILE, StorageTarget.USER);
		} catch (error) {
			console.error('Intuition layout seed failed', error);
		}
	}
}

registerWorkbenchContribution2(IntuitionLayoutSeedContribution.ID, IntuitionLayoutSeedContribution, WorkbenchPhase.BlockRestore);
