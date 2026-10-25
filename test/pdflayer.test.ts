import { describe, it, expect } from 'vitest';
import { layerMayHoldOpened, piecesOfLayer, type LayerNode } from '../src/pdflayer';

const text = (t: string): LayerNode => ({ kind: 'text', text: t });
const br: LayerNode = { kind: 'break' };

describe('piecesOfLayer', () => {
	it('puts the text nodes of one line in one block, in order', () => {
		const { pieces } = piecesOfLayer([text('Both'), text(' '), text('the DCF'), br, text('next')]);
		expect(pieces).toEqual([
			{ block: 0, text: 'Both' }, { block: 0, text: ' ' }, { block: 0, text: 'the DCF' },
			{ block: 1, text: 'next' },
		]);
	});

	it('says which node each piece came from, so a range can be put back on the page', () => {
		const { nodeOf } = piecesOfLayer([text('a'), br, text('b'), text('c')]);
		expect(nodeOf).toEqual([0, 2, 3]);
	});

	it('leaves out empty text nodes and starts no block for a break with nothing before it', () => {
		const { pieces, nodeOf } = piecesOfLayer([br, text(''), text('x'), br, br, text('y')]);
		expect(pieces).toEqual([{ block: 0, text: 'x' }, { block: 1, text: 'y' }]);
		expect(nodeOf).toEqual([2, 5]);
	});

	it('is empty for a page with no text', () => {
		expect(piecesOfLayer([])).toEqual({ pieces: [], nodeOf: [] });
		expect(piecesOfLayer([br, br])).toEqual({ pieces: [], nodeOf: [] });
	});
});

describe('layerMayHoldOpened', () => {
	it('lets only the page that was opened hold the bright match, since slides repeat their titles', () => {
		expect(layerMayHoldOpened(38, 38)).toBe(true);
		expect(layerMayHoldOpened(38, 37)).toBe(false);
		expect(layerMayHoldOpened(38, 39)).toBe(false);
	});

	it('lets any page hold it when the page opened is not known, or the page of the layer cannot be read', () => {
		expect(layerMayHoldOpened(undefined, 37)).toBe(true);
		expect(layerMayHoldOpened(38, undefined)).toBe(true);
	});
});
