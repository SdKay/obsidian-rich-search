import { Modal, type App } from 'obsidian';
import { fmt, t } from './i18n';
import type { ReplacePlan } from './replaceplan';

const NAMES_SHOWN = 8;

/**
 * Asks before replace-all. Built on `Modal`, not `ConfirmationModal`, which only exists from Obsidian 1.13 while the plugin
 * supports 1.8.7. Resolves true only when the user confirms; closing the box or cancelling resolves false.
 */
export function confirmReplaceAll(app: App, plan: ReplacePlan, from: string, to: string): Promise<boolean> {
	return new Promise((resolve) => {
		let answered = false;
		const modal = new Modal(app);
		const answer = (value: boolean): void => {
			if (answered) return;
			answered = true;
			resolve(value);
			modal.close();
		};
		modal.titleEl.setText(t('replaceAllTitle'));
		const body = modal.contentEl;
		body.createEl('p', { text: fmt('replaceAllSummary', { matches: plan.matchCount, files: plan.fileCount, lines: plan.lineCount }) });
		const change = body.createEl('p', { cls: 'rs-replace-change' });
		change.createSpan({ cls: 'rs-mark rs-mark-old', text: from });
		change.appendText(' → ');
		change.createSpan({ cls: 'rs-mark rs-mark-new', text: to });
		const list = body.createEl('ul', { cls: 'rs-replace-files' });
		for (const file of plan.files.slice(0, NAMES_SHOWN)) list.createEl('li', { text: file.path });
		if (plan.files.length > NAMES_SHOWN) list.createEl('li', { text: fmt('replaceAllMore', { count: plan.files.length - NAMES_SHOWN }) });
		if (plan.notReplaceable > 0) body.createEl('p', { cls: 'rs-replace-skipped', text: fmt('replaceAllSkipped', { count: plan.notReplaceable }) });
		body.createEl('p', { cls: 'mod-warning', text: t('replaceAllNoUndo') });
		const buttons = body.createDiv({ cls: 'modal-button-container' });
		const confirm = buttons.createEl('button', { cls: 'mod-warning', text: t('replaceAllConfirm') });
		const cancel = buttons.createEl('button', { text: t('replaceAllCancel') });
		confirm.addEventListener('click', () => answer(true));
		cancel.addEventListener('click', () => answer(false));
		// Closing with Escape or the cross counts as cancelling.
		modal.onClose = () => { answer(false); };
		modal.open();
		cancel.focus();
	});
}
