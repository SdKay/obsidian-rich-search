// Stands in for the `obsidian` module in e2e pages. Keep it FAITHFUL wherever event timing,
// layout or Component lifecycle matters: a shim that is more forgiving than Obsidian hides real
// bugs (e.g. Obsidian's Menu keeps ONE onHide callback, a later call replaces the earlier one;
// a shim that kept both let a stuck-editor bug pass). When a test passes here and fails in
// Obsidian, fix the shim first, then the test.
//
// Add only what a test needs. Anything missing throws on import, which is the point.
export class Notice {
	static shown: string[] = [];
	constructor(message: string) { Notice.shown.push(message); }
}
