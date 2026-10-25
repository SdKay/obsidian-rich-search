import { describe, it, expect } from 'vitest';
import { matchVariables, normalizeColor, readableTextColor } from '../src/color';

describe('normalizeColor', () => {
	const fallback = '#ccff00';

	it('keeps a six-digit hex colour, lower-cased', () => {
		expect(normalizeColor('#FFAA00', fallback)).toBe('#ffaa00');
		expect(normalizeColor('#ffaa00', fallback)).toBe('#ffaa00');
	});

	it('expands a three-digit hex colour', () => {
		expect(normalizeColor('#fa0', fallback)).toBe('#ffaa00');
		expect(normalizeColor('#ABC', fallback)).toBe('#aabbcc');
	});

	it('falls back for anything else', () => {
		for (const bad of ['', 'red', 'ffaa00', '#ffaa0', '#ffaa000', '#gggggg', 'rgb(1,2,3)', '#ffaa00; color: red', ' #ffaa00', undefined, null, 5, {}]) {
			expect(normalizeColor(bad, fallback)).toBe(fallback);
		}
	});

	it('does not accept an alpha channel, which the colour picker never produces', () => {
		expect(normalizeColor('#ffaa00ff', fallback)).toBe(fallback);
		expect(normalizeColor('#fa0f', fallback)).toBe(fallback);
	});
});

describe('readableTextColor', () => {
	it('uses black on light and bright colours, including the neon default', () => {
		for (const bg of ['#ffffff', '#ffff00', '#ccff00', '#ffaa00', '#00ff00', '#9be9ff']) expect(readableTextColor(bg)).toBe('#000000');
	});

	it('uses white on dark colours', () => {
		for (const bg of ['#000000', '#0000ff', '#330066', '#800000', '#222222']) expect(readableTextColor(bg)).toBe('#ffffff');
	});

	it('copes with a three-digit colour', () => {
		expect(readableTextColor('#fff')).toBe('#000000');
		expect(readableTextColor('#000')).toBe('#ffffff');
	});

	it('picks the side with the better contrast around the middle grey', () => {
		expect(readableTextColor('#757575')).toBe('#ffffff');
		expect(readableTextColor('#777777')).toBe('#000000');
	});

	it('returns black for something that is not a colour, so text stays readable on the default light mark', () => {
		expect(readableTextColor('nonsense')).toBe('#000000');
	});
});

describe('matchVariables', () => {
	it('gives the background and the text colour that reads on it, under the names the other plugins read', () => {
		expect(matchVariables('#ccff00')).toEqual({ '--rs-match-bg': '#ccff00', '--rs-match-fg': '#000000' });
		expect(matchVariables('#102030')).toEqual({ '--rs-match-bg': '#102030', '--rs-match-fg': '#ffffff' });
	});
});
