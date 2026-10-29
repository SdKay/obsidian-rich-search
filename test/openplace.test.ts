import { describe, it, expect } from 'vitest';
import { planPlace } from '../src/openplace';

const base = { openIn: 'main', panelInPopout: false, popoutHasNote: false, newTab: false } as const;

describe('planPlace', () => {
	it('leaves a panel in the main window to Obsidian, which reuses a note there', () => {
		expect(planPlace(base)).toBe('default');
		expect(planPlace({ ...base, openIn: 'panel' })).toBe('default');
	});

	it('sends a panel in a pop-out window to the main window when the setting says main', () => {
		expect(planPlace({ ...base, panelInPopout: true })).toBe('mainRecent');
	});

	it('shows the note beside a pop-out panel when the setting says panel, and splits only when there is no note there yet', () => {
		expect(planPlace({ ...base, openIn: 'panel', panelInPopout: true, popoutHasNote: true })).toBe('reusePopout');
		expect(planPlace({ ...base, openIn: 'panel', panelInPopout: true, popoutHasNote: false })).toBe('splitPopout');
	});

	it('keeps Ctrl/Cmd click as a request for a new tab wherever the panel is', () => {
		expect(planPlace({ ...base, panelInPopout: true, newTab: true })).toBe('default');
		expect(planPlace({ ...base, openIn: 'panel', panelInPopout: true, newTab: true })).toBe('default');
	});
});
