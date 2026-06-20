/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * THE single source of truth for Intuition's brand colors. The theme JSONs
 * (extensions/theme-intuition) and intuitionBrand.css mirror these values by
 * hand — keep all three in sync. Values are from the landing page's
 * app/globals.css (see docs/superpowers/specs/2026-06-20-visual-identity-design.md).
 */
export interface IntuitionThemeTokens {
	readonly background: string;
	readonly raised: string;
	readonly surface: string;
	readonly foreground: string;
	readonly muted: string;
	readonly mutedForeground: string;
	readonly border: string;
	readonly iris: string;
	readonly violet: string;
	readonly cyan: string;
	readonly lime: string;
}

export const INTUITION_PALETTE: { readonly dark: IntuitionThemeTokens; readonly light: IntuitionThemeTokens } = {
	dark: {
		background: '#0a0a0b', raised: '#0c0c0e', surface: '#121214',
		foreground: '#f6f6f7', muted: '#161618', mutedForeground: '#8a8a92', border: '#242427',
		iris: '#ee45e0', violet: '#9a6bff', cyan: '#34e7ff', lime: '#b6ff3d',
	},
	light: {
		background: '#fbfbfb', raised: '#f3f3f4', surface: '#ffffff',
		foreground: '#0a0a0a', muted: '#f3f3f4', mutedForeground: '#6e6e73', border: '#e6e6e8',
		iris: '#c81fd1', violet: '#6d3cff', cyan: '#0a93c2', lime: '#6f9e00',
	},
};

/** Spectrum stops (iris→violet→cyan) for the shimmer line / word gradient. */
export const INTUITION_SPECTRUM = {
	dark: [INTUITION_PALETTE.dark.iris, INTUITION_PALETTE.dark.violet, INTUITION_PALETTE.dark.cyan],
	light: [INTUITION_PALETTE.light.iris, INTUITION_PALETTE.light.violet, INTUITION_PALETTE.light.cyan],
} as const;
