import { MATCH_VARIABLES, matchVariables } from './color';

/** Sets the match colour on a document's body, where every plugin's marks read it. */
export function setMatchColor(docs: Iterable<Document>, color: string): void {
	const variables = matchVariables(color);
	for (const doc of new Set(docs)) {
		for (const name of MATCH_VARIABLES) doc.body.style.setProperty(name, variables[name]);
	}
}

/** Takes the colour back off. */
export function clearMatchColor(docs: Iterable<Document>): void {
	for (const doc of new Set(docs)) {
		for (const name of MATCH_VARIABLES) doc.body.style.removeProperty(name);
	}
}
