import { App, Modal } from 'obsidian';

interface EditorModalOptions {
	modalClass: string;
	contentClass?: string;
	onOpen: (contentEl: HTMLElement) => void;
	onClose?: () => void;
}

export class EditorModal extends Modal {
	private readonly options: EditorModalOptions;

	constructor(app: App, options: EditorModalOptions) {
		super(app);
		this.options = options;
	}

	onOpen(): void {
		this.modalEl.addClass(this.options.modalClass);
		if (this.options.contentClass) {
			this.contentEl.addClass(this.options.contentClass);
		}

		this.contentEl.empty();
		this.options.onOpen(this.contentEl);
	}

	onClose(): void {
		this.contentEl.empty();
		this.modalEl.removeClass(this.options.modalClass);
		if (this.options.contentClass) {
			this.contentEl.removeClass(this.options.contentClass);
		}

		this.options.onClose?.();
	}
}