/**
 * Turns many requests into one run per turn of `schedule` (an animation frame in the app). Scrolling asks
 * for a repaint on every update, and one repaint per frame is all the screen can show. A request made
 * while the task runs is kept for the next turn, so it is never lost.
 */
export function coalesce(task: () => void, schedule: (run: () => void) => void): () => void {
	let queued = false;
	return () => {
		if (queued) return;
		queued = true;
		schedule(() => {
			// Cleared first, so a request made inside the task, or one after it throws, is still honoured.
			queued = false;
			task();
		});
	};
}
