import { App, setIcon, setTooltip } from 'obsidian';
import { CustomButton } from '../types';
import { CustomIconManager } from '../utils/customIconManager';
import { CommandSuggestModal } from './commandSuggestModal';
import { FileSuggestModal } from './fileSuggestModal';
import { IconSuggestModal } from './iconSuggestModal';

interface ButtonEditorPopoverOptions {
	anchorEl: HTMLElement;
	title: string;
	iconFolder: string;
	iconMask: boolean;
	onChange: (button: CustomButton) => Promise<void>;
	onClose?: () => void;
}

export class ButtonEditorPopover {
	private readonly app: App;
	private readonly customIconManager: CustomIconManager;
	private readonly options: ButtonEditorPopoverOptions;
	private readonly draft: CustomButton;
	private readonly mountRoot: HTMLElement | null;
	private popoverEl: HTMLDivElement | null = null;
	private contentEl: HTMLDivElement | null = null;
	private cleanupCallbacks: Array<() => void> = [];
	private nameInputEl: HTMLInputElement | null = null;
	private valueInputEl: HTMLInputElement | null = null;
	private typeSelectEl: HTMLSelectElement | null = null;
	private commandGroupContainerEl: HTMLElement | null = null;
	private primaryPreviewEl: HTMLElement | null = null;
	private togglePreviewEl: HTMLElement | null = null;
	private saveChain: Promise<void> = Promise.resolve();
	private autoSaveTimer: number | null = null;
	private lastCommittedState: string;

	constructor(app: App, button: CustomButton, options: ButtonEditorPopoverOptions) {
		this.app = app;
		this.options = options;
		this.draft = structuredClone(button);
		this.lastCommittedState = JSON.stringify(this.draft);
		this.customIconManager = CustomIconManager.getInstance(app);
		this.mountRoot = this.options.anchorEl.closest('.modal-container')
			?? this.options.anchorEl.closest('.modal');
	}

	open = (): void => {
		if (this.popoverEl) {
			this.updateAnchor(this.options.anchorEl);
			return;
		}

		const mountRoot = this.mountRoot
			?? this.options.anchorEl.ownerDocument.body;

		this.popoverEl = mountRoot.createDiv({ cls: 'basic-vault-button-popover' });
		this.popoverEl.addEventListener('mousedown', (event) => {
			event.stopPropagation();
		});

		this.contentEl = this.popoverEl.createDiv({ cls: 'basic-vault-button-popover-content' });
		this.render();

		const ownerDocument = this.options.anchorEl.ownerDocument;
		const handlePointerDown = (event: MouseEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) {
				return;
			}
			if (target instanceof HTMLElement) {
				if (target.closest('.suggestion-container')) {
					return;
				}

				const modalContainer = target.closest('.modal-container, .modal');
				if (modalContainer && modalContainer !== this.mountRoot) {
					return;
				}

				if (target.closest('.prompt')) {
					return;
				}
			}

			if (
				this.popoverEl?.contains(target)
				|| this.options.anchorEl.contains(target)
			) {
				return;
			}

			this.close();
		};
		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') {
				this.close();
			}
		};
		const handleWindowChange = () => {
			this.position();
		};

		ownerDocument.addEventListener('mousedown', handlePointerDown, true);
		ownerDocument.addEventListener('keydown', handleKeyDown, true);
		window.addEventListener('resize', handleWindowChange);
		window.addEventListener('scroll', handleWindowChange, true);

		this.cleanupCallbacks.push(() => {
			ownerDocument.removeEventListener('mousedown', handlePointerDown, true);
			ownerDocument.removeEventListener('keydown', handleKeyDown, true);
			window.removeEventListener('resize', handleWindowChange);
			window.removeEventListener('scroll', handleWindowChange, true);
		});

		requestAnimationFrame(() => {
			this.position();
			this.nameInputEl?.focus();
			this.nameInputEl?.select();
		});
	};

	close = (): void => {
		if (this.autoSaveTimer !== null) {
			window.clearTimeout(this.autoSaveTimer);
			this.autoSaveTimer = null;
		}
		this.cleanupCallbacks.forEach((cleanup) => cleanup());
		this.cleanupCallbacks = [];
		this.popoverEl?.remove();
		this.popoverEl = null;
		this.contentEl = null;
		this.options.onClose?.();
	};

	updateAnchor = (anchorEl: HTMLElement): void => {
		this.options.anchorEl = anchorEl;
		this.position();
	};

	private render = (): void => {
		if (!this.contentEl) {
			return;
		}

		this.contentEl.empty();

		const headerEl = this.contentEl.createDiv({ cls: 'basic-vault-button-popover-header' });
		headerEl.createDiv({
			cls: 'basic-vault-button-popover-title',
			text: this.draft.tooltip.trim() || this.options.title,
		});

		const closeButton = headerEl.createEl('button', {
			cls: 'clickable-icon basic-vault-button-popover-close',
			attr: { type: 'button', 'aria-label': '关闭' },
		});
		setIcon(closeButton, 'x');
		closeButton.addEventListener('click', () => {
			this.close();
		});

		const nameControlEl = this.createFormRow(this.contentEl, '名称');

		this.nameInputEl = nameControlEl.createEl('input', {
			cls: 'basic-vault-button-popover-input basic-vault-button-popover-name-input',
			attr: { type: 'text', placeholder: '按钮名称' },
		});
		this.nameInputEl.value = this.draft.tooltip;
		this.nameInputEl.addEventListener('input', () => {
			this.draft.tooltip = this.nameInputEl?.value ?? '';
			this.updateTitle();
			this.scheduleCommit();
		});

		const compactRowEl = this.contentEl.createDiv({ cls: 'basic-vault-button-popover-compact-row' });
		this.createIconField(compactRowEl, '主图标', this.draft.icon, false);
		this.createIconField(compactRowEl, '切换图标', this.draft.toggleIcon, true);
		compactRowEl.createDiv({
			cls: 'basic-vault-button-popover-label',
			text: '按钮类型',
		});
		this.typeSelectEl = compactRowEl.createEl('select');
		this.typeSelectEl.addClass('dropdown');
		this.typeSelectEl.addClass('basic-vault-button-popover-native-select');
		[
			['command', '命令'],
			['command-group', '命令组'],
			['file', '文件'],
			['url', '网址'],
		].forEach(([value, label]) => {
			this.typeSelectEl?.createEl('option', { value, text: label });
		});
		this.typeSelectEl.value = this.draft.type;
		this.typeSelectEl.addEventListener('change', () => {
			this.draft.type = this.typeSelectEl?.value as CustomButton['type'];
			this.normalizeTypeSpecificValues();
			this.render();
			void this.commitChanges();
		});

		this.renderValueEditor();
	};

	private createFormRow(parentEl: HTMLElement, label: string) {
		const rowEl = parentEl.createDiv({ cls: 'basic-vault-button-popover-form-row' });
		rowEl.createDiv({
			cls: 'basic-vault-button-popover-label',
			text: label,
		});
		return rowEl.createDiv({ cls: 'basic-vault-button-popover-control' });
	}

	private createIconField(parentEl: HTMLElement, label: string, iconName: string, isToggleIcon: boolean) {
		parentEl.createDiv({ cls: 'basic-vault-button-popover-label', text: label });
		const fieldEl = parentEl.createDiv({ cls: 'basic-vault-button-popover-icon-field' });

		const iconButton = fieldEl.createEl('button', {
			cls: 'icon-picker-button-compact',
			attr: { type: 'button', 'aria-label': label },
		});
		const previewEl = iconButton.createDiv({ cls: 'icon-picker-preview-compact' });

		if (isToggleIcon) {
			this.togglePreviewEl = previewEl;
		} else {
			this.primaryPreviewEl = previewEl;
		}

		void this.updateIconPreview(iconName, previewEl);
		setTooltip(iconButton, `${label}: ${this.customIconManager.getDisplayName(iconName || 'help-circle')}`);

		iconButton.addEventListener('click', () => {
			void this.openIconPicker(isToggleIcon);
		});
	}

	private updateTitle() {
		const titleEl = this.contentEl?.querySelector<HTMLElement>('.basic-vault-button-popover-title');
		titleEl?.setText(this.draft.tooltip.trim() || this.options.title);
	}

	private renderValueEditor() {
		if (!this.contentEl) {
			return;
		}

		this.valueInputEl = null;
		this.commandGroupContainerEl = null;

		const valueControlEl = this.createFormRow(this.contentEl, this.getValueFieldName());

		if (this.draft.type === 'command-group') {
			this.commandGroupContainerEl = valueControlEl.createDiv({ cls: 'basic-vault-button-popover-command-group' });
			this.renderCommandGroupEditor();
			return;
		}

		this.valueInputEl = valueControlEl.createEl('input', {
			cls: 'basic-vault-button-popover-input basic-vault-button-popover-value-input',
			attr: { type: 'text', placeholder: this.getValuePlaceholder() },
		});
		this.valueInputEl.value = this.getCurrentValue();
		this.valueInputEl.addEventListener('input', () => {
			this.setCurrentValue(this.valueInputEl?.value ?? '');
			this.scheduleCommit();
		});

		if (this.draft.type === 'command' || this.draft.type === 'file') {
			this.valueInputEl.addClass('basic-vault-button-popover-picker-input');
			this.valueInputEl.addEventListener('click', () => {
				void this.openValuePicker();
			});
		}
	}

	private renderCommandGroupEditor() {
		if (!this.commandGroupContainerEl) {
			return;
		}

		this.commandGroupContainerEl.empty();

		const listEl = this.commandGroupContainerEl.createDiv({ cls: 'basic-vault-button-command-list' });
		if (this.draft.commands.length === 0) {
			listEl.createDiv({
				cls: 'basic-vault-button-command-empty',
				text: '还没有添加命令'
			});
		}

		this.draft.commands.forEach((commandId, index) => {
			const rowEl = listEl.createDiv({ cls: 'basic-vault-button-command-row' });
			rowEl.dataset.index = index.toString();
			rowEl.createDiv({
				cls: 'basic-vault-button-command-index',
				text: `${index + 1}`
			});

			const inputEl = rowEl.createEl('input', {
				cls: 'basic-vault-button-popover-input basic-vault-button-command-input basic-vault-button-popover-picker-input',
				attr: { type: 'text', placeholder: '命令 ID' }
			});
			inputEl.value = commandId;
			inputEl.addEventListener('input', () => {
				this.draft.commands[index] = inputEl.value;
				this.scheduleCommit();
			});
			inputEl.addEventListener('click', () => {
				void this.openCommandGroupPicker(index, inputEl);
			});

			this.createIconButton(rowEl, 'up-chevron-glyph', '上移', () => {
				if (index === 0) {
					return;
				}
				[this.draft.commands[index - 1], this.draft.commands[index]] = [this.draft.commands[index], this.draft.commands[index - 1]];
				this.renderCommandGroupEditor();
				void this.commitChanges();
			});

			this.createIconButton(rowEl, 'down-chevron-glyph', '下移', () => {
				if (index >= this.draft.commands.length - 1) {
					return;
				}
				[this.draft.commands[index + 1], this.draft.commands[index]] = [this.draft.commands[index], this.draft.commands[index + 1]];
				this.renderCommandGroupEditor();
				void this.commitChanges();
			});

			this.createIconButton(rowEl, 'trash', '删除命令', () => {
				this.draft.commands.splice(index, 1);
				this.renderCommandGroupEditor();
				void this.commitChanges();
			});
		});

		const addButton = this.commandGroupContainerEl.createEl('button', {
			cls: 'basic-vault-button-popover-text-button',
			text: '+ 添加命令',
			attr: { type: 'button' }
		});
		addButton.addEventListener('click', () => {
			this.draft.commands.push('');
			this.renderCommandGroupEditor();
			this.focusCommandInput(this.draft.commands.length - 1);
			void this.commitChanges();
		});
	}

	private focusCommandInput(index: number) {
		window.requestAnimationFrame(() => {
			const inputEl = this.commandGroupContainerEl?.querySelector<HTMLInputElement>(`.basic-vault-button-command-row[data-index="${index}"] .basic-vault-button-command-input`);
			inputEl?.focus();
			inputEl?.select();
		});
	}

	private createIconButton(parentEl: HTMLElement, icon: string, label: string, onClick: () => void) {
		const button = parentEl.createEl('button', {
			cls: 'basic-vault-button-popover-icon-button',
			attr: { type: 'button', 'aria-label': label, title: label }
		});
		setIcon(button, icon);
		button.addEventListener('click', onClick);
		return button;
	}

	private async commitChanges() {
		if (this.autoSaveTimer !== null) {
			window.clearTimeout(this.autoSaveTimer);
			this.autoSaveTimer = null;
		}
		this.draft.tooltip = this.nameInputEl?.value ?? this.draft.tooltip;
		if (this.valueInputEl) {
			this.setCurrentValue(this.valueInputEl.value);
		}
		const nextButton = structuredClone(this.draft);
		nextButton.commands = nextButton.commands.map((commandId) => commandId.trim()).filter(Boolean);
		const nextState = JSON.stringify(nextButton);
		if (nextState === this.lastCommittedState) {
			return;
		}
		this.saveChain = this.saveChain.then(async () => {
			await this.options.onChange(nextButton);
			this.lastCommittedState = nextState;
		});
		await this.saveChain;
	}

	private scheduleCommit() {
		if (this.autoSaveTimer !== null) {
			window.clearTimeout(this.autoSaveTimer);
		}

		this.autoSaveTimer = window.setTimeout(() => {
			void this.commitChanges();
		}, 180);
	}

	private normalizeTypeSpecificValues() {
		switch (this.draft.type) {
			case 'command':
				this.draft.file = '';
				this.draft.url = '';
				this.draft.commands = [];
				break;
			case 'command-group':
				this.draft.command = '';
				this.draft.file = '';
				this.draft.url = '';
				break;
			case 'file':
				this.draft.command = '';
				this.draft.url = '';
				this.draft.commands = [];
				break;
			case 'url':
				this.draft.command = '';
				this.draft.file = '';
				this.draft.commands = [];
				break;
		}
	}

	private position() {
		if (!this.popoverEl) {
			return;
		}
		if (!this.options.anchorEl.isConnected) {
			this.close();
			return;
		}

		const anchorRect = this.options.anchorEl.getBoundingClientRect();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const maxWidth = Math.min(520, viewportWidth - 24);

		this.popoverEl.style.maxWidth = `${maxWidth}px`;
		this.popoverEl.style.width = `${Math.min(Math.max(anchorRect.width + 180, 360), maxWidth)}px`;

		const popoverRect = this.popoverEl.getBoundingClientRect();
		const belowTop = anchorRect.bottom + 6;
		const canPlaceBelow = belowTop + popoverRect.height <= viewportHeight - 12;
		const top = canPlaceBelow
			? Math.min(belowTop, viewportHeight - popoverRect.height - 12)
			: Math.max(12, anchorRect.top - popoverRect.height - 6);
		const left = Math.min(
			Math.max(12, anchorRect.left),
			viewportWidth - popoverRect.width - 12,
		);

		this.popoverEl.style.top = `${top}px`;
		this.popoverEl.style.left = `${left}px`;
	}

	private getValueFieldName(): string {
		switch (this.draft.type) {
			case 'command':
				return '命令';
			case 'command-group':
				return '命令组';
			case 'file':
				return '文件';
			case 'url':
				return '网址';
		}
	}

	private getValuePlaceholder(): string {
		switch (this.draft.type) {
			case 'command':
				return '命令 ID';
			case 'command-group':
				return '命令 ID';
			case 'file':
				return '文件路径';
			case 'url':
				return '网址';
		}
	}

	private getCurrentValue(): string {
		switch (this.draft.type) {
			case 'command':
				return this.draft.command;
			case 'command-group':
				return this.draft.commands.join(', ');
			case 'file':
				return this.draft.file;
			case 'url':
				return this.draft.url;
		}
	}

	private setCurrentValue(value: string) {
		switch (this.draft.type) {
			case 'command':
				this.draft.command = value;
				break;
			case 'command-group':
				this.draft.commands = value.split(',').map((commandId) => commandId.trim()).filter(Boolean);
				break;
			case 'file':
				this.draft.file = value;
				break;
			case 'url':
				this.draft.url = value;
				break;
		}
	}

	private async openValuePicker() {
		if (this.draft.type === 'command') {
			new CommandSuggestModal(this.app, (command) => {
				this.draft.command = command.id;
				if (this.valueInputEl) {
					this.valueInputEl.value = command.id;
				}
				void this.commitChanges();
			}).open();
			return;
		}

		if (this.draft.type === 'file') {
			new FileSuggestModal(this.app, (file) => {
				this.draft.file = file.path;
				if (this.valueInputEl) {
					this.valueInputEl.value = file.path;
				}
				void this.commitChanges();
			}).open();
		}
	}

	private async openCommandGroupPicker(index: number, inputEl: HTMLInputElement) {
		new CommandSuggestModal(this.app, (command) => {
			this.draft.commands[index] = command.id;
			inputEl.value = command.id;
			void this.commitChanges();
		}).open();
	}

	private async openIconPicker(isToggleIcon: boolean) {
		const modal = await IconSuggestModal.create(
			this.app,
			this.options.iconFolder,
			this.options.iconMask,
			async (selectedIcon: string) => {
				if (isToggleIcon) {
					this.draft.toggleIcon = selectedIcon;
					if (this.togglePreviewEl) {
						await this.updateIconPreview(selectedIcon, this.togglePreviewEl);
					}
					await this.commitChanges();
					return;
				}

				this.draft.icon = selectedIcon;
				this.draft.toggleIcon = selectedIcon;
				if (this.primaryPreviewEl) {
					await this.updateIconPreview(selectedIcon, this.primaryPreviewEl);
				}
				if (this.togglePreviewEl) {
					await this.updateIconPreview(selectedIcon, this.togglePreviewEl);
				}
				await this.commitChanges();
			}
		);
		modal.open();
	}

	private async updateIconPreview(iconName: string, previewEl: HTMLElement) {
		previewEl.empty();
		if (this.customIconManager.isCustomIcon(iconName)) {
			const rendered = await this.customIconManager.renderIcon(iconName, previewEl, this.options.iconMask);
			if (!rendered) {
				previewEl.setText('?');
			}
			return;
		}

		try {
			setIcon(previewEl, iconName || 'help-circle');
		} catch {
			previewEl.setText('?');
		}
	}
}