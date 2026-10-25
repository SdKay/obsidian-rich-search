import { matchLine } from './match';
import type { QueryState } from './querystate';
import type { RichSearchHostApi } from './richSearchApi';

/**
 * What other plugins read at `app.plugins.plugins['rich-search'].api` (contract section 4). It is
 * frozen: it is handed to code we do not control, and replacing a method would change it for every plugin.
 */
export function createHostApi(query: QueryState): RichSearchHostApi {
	return Object.freeze({
		apiVersion: 1,
		matchLine,
		currentQuery: () => query.current(),
		onQueryChange: (listener) => query.onChange(listener),
		currentHit: () => query.currentHit(),
		onHitChange: (listener) => query.onHitChange(listener),
	} satisfies RichSearchHostApi);
}
