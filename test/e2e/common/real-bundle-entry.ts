// What the e2e pages can reach as window.RichSearchReal. Export the real modules a test needs;
// add to this list rather than copying logic into a test page.
export { matchLine } from '../../../src/match';
export { boxRange, clearBox } from '../../../src/activebox';
export { paintPage } from '../../../src/table-highlight';
export { scrollToTableHit } from '../../../src/table-highlight';
export { openHistoryPopup } from '../../../src/history-popup';
export { setMatchColor, clearMatchColor } from '../../../src/matchcolor';
