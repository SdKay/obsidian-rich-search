const HEX = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** A `#rrggbb` colour from `#rgb` or `#rrggbb` input in any case; anything else gives `fallback`. */
export function normalizeColor(value: unknown, fallback: string): string {
	if (typeof value !== 'string' || !HEX.test(value)) return fallback;
	const hex = value.slice(1).toLowerCase();
	return `#${hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex}`;
}

function luminance(hex: string): number {
	const channel = (i: number): number => {
		const v = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
		return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
	};
	return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
}

/** Black or white, whichever reads better on `background` (WCAG contrast). Black for anything unreadable as a colour. */
export function readableTextColor(background: string): '#000000' | '#ffffff' {
	const bg = normalizeColor(background, '');
	if (bg === '') return '#000000';
	const l = luminance(bg);
	const withBlack = (l + 0.05) / 0.05;
	const withWhite = 1.05 / (l + 0.05);
	return withBlack >= withWhite ? '#000000' : '#ffffff';
}

export const MATCH_VARIABLES = ['--rs-match-bg', '--rs-match-fg'] as const;

/** The CSS variables the match colour is published as (contract 5.9): the colour, and the text colour that reads on it. */
export function matchVariables(color: string): Record<(typeof MATCH_VARIABLES)[number], string> {
	return { '--rs-match-bg': color, '--rs-match-fg': readableTextColor(color) };
}
