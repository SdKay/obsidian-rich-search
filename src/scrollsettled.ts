/** A line this far down or more is off the first screen, so the page visibly jumps to it. */
const FAR_LINE = 30;

export function shouldHideWhileScrolling(line: number): boolean {
	return line >= FAR_LINE;
}

/**
 * Whether the page has scrolled to the hit and may be shown. Reading view lays its sections out first and scrolls
 * after, so until the page has left the top the reader would see the start of the note. A scroll that never comes
 * (the note changed, an error) is given up on at `limit`, so the page is never left hidden.
 */
export function scrollSettled(state: { scrollTop: number; waited: number; limit: number }): boolean {
	return state.scrollTop > 0 || state.waited >= state.limit;
}
