/** What the popup needs from the view: the entries as menu lines (newest first), and what to do with a click. */
export interface HistoryPopupSource {
	/** The remembered searches, newest first. `position` is the place in the stored list. */
	entries(): { position: number; label: string }[];
	apply(position: number): void;
	forget(position: number): void;
	forgetAll(): void;
	labels: { empty: string; clear: string; remove: string };
}

/**
 * A list under the history button: each remembered search, a cross after it that forgets just that one, and a row
 * that forgets them all. Choosing a search closes the list; the cross does not, so several can be removed in a row.
 * Returns a function that closes it.
 */
export function openHistoryPopup(anchor: HTMLElement, source: HistoryPopupSource): () => void {
	const doc = anchor.ownerDocument;
	const popup = doc.body.createDiv({ cls: 'rs-history-popup' });
	let closed = false;

	const close = (): void => {
		if (closed) return;
		closed = true;
		doc.removeEventListener('mousedown', outside, true);
		doc.removeEventListener('keydown', escape, true);
		popup.remove();
	};
	const outside = (event: MouseEvent): void => {
		if (!(event.target instanceof Node) || popup.contains(event.target) || anchor.contains(event.target)) return;
		close();
	};
	const escape = (event: KeyboardEvent): void => {
		if (event.key !== 'Escape') return;
		event.stopPropagation();
		close();
	};

	const render = (): void => {
		popup.empty();
		const entries = source.entries();
		if (entries.length === 0) {
			popup.createDiv({ cls: 'rs-history-empty', text: source.labels.empty });
			return;
		}
		for (const { position, label } of entries) {
			const row = popup.createDiv({ cls: 'rs-history-row' });
			const text = row.createSpan({ cls: 'rs-history-text', text: label, attr: { title: label } });
			const cross = row.createSpan({ cls: 'rs-history-x', text: '×', attr: { role: 'button', 'aria-label': source.labels.remove } });
			text.addEventListener('click', () => { close(); source.apply(position); });
			cross.addEventListener('click', () => {
				source.forget(position);
				render();
			});
		}
		const clear = popup.createDiv({ cls: 'rs-history-row rs-history-clear', text: source.labels.clear });
		clear.addEventListener('click', () => { source.forgetAll(); render(); });
	};

	const box = anchor.getBoundingClientRect();
	popup.setCssProps({ top: `${box.bottom + 2}px`, right: `${Math.max(4, doc.documentElement.clientWidth - box.right)}px` });
	render();
	doc.addEventListener('mousedown', outside, true);
	doc.addEventListener('keydown', escape, true);
	return close;
}
