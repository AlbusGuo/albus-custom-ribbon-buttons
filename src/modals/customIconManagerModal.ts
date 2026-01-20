import { App, Modal, setIcon } from 'obsidian';
import { CustomIcon } from '../types';
import { CustomIconManager } from '../utils/customIconManager';
import { CustomIconUploadModal } from './customIconUploadModal';

/**
 * 自定义图标管理模态框
 * 显示所有自定义图标，支持添加和删除
 */
export class CustomIconManagerModal extends Modal {
	private customIconManager: CustomIconManager;
	private onUpdate: () => void;
	private onAddIcons: (icons: CustomIcon[]) => Promise<void>;
	private onDeleteIcon: (iconId: string) => Promise<void>;
	private onSelectIcon: (iconId: string) => void;
	private contentContainer: HTMLElement;

	constructor(
		app: App,
		onSelectIcon: (iconId: string) => void,
		onAddIcons: (icons: CustomIcon[]) => Promise<void>,
		onDeleteIcon: (iconId: string) => Promise<void>,
		onUpdate: () => void
	) {
		super(app);
		this.customIconManager = CustomIconManager.getInstance();
		this.onSelectIcon = onSelectIcon;
		this.onAddIcons = onAddIcons;
		this.onDeleteIcon = onDeleteIcon;
		this.onUpdate = onUpdate;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('custom-icon-manager-modal');

		contentEl.createEl('h2', { text: '自定义图标管理' });

		// 内容容器
		this.contentContainer = contentEl.createDiv('custom-icon-manager-content');
		this.renderContent();
	}

	private renderContent() {
		this.contentContainer.empty();

		// 添加图标选项（第一项）
		const addOptionEl = this.contentContainer.createDiv('custom-icon-manager-item custom-icon-add-option');
		addOptionEl.addClass('mod-complex');
		
		const addTextEl = addOptionEl.createDiv();
		addTextEl.setText('添加新图标');
		
		const addIconEl = addOptionEl.createDiv();
		setIcon(addIconEl, 'plus-circle');

		addOptionEl.addEventListener('click', () => {
			this.openUploadModal();
		});

		// 显示所有自定义图标
		const customIcons = this.customIconManager.getAllIcons();
		
		if (customIcons.length === 0) {
			const emptyState = this.contentContainer.createDiv('custom-icon-empty-state');
			emptyState.setText('还没有添加任何自定义图标');
		} else {
			customIcons.forEach(icon => {
				this.renderIconItem(icon);
			});
		}
	}

	private renderIconItem(icon: CustomIcon) {
		const itemEl = this.contentContainer.createDiv('custom-icon-manager-item');
		itemEl.addClass('mod-complex');

		// 图标名称
		const nameEl = itemEl.createDiv('custom-icon-manager-name');
		nameEl.setText(icon.id);

		// 右侧容器
		const rightEl = itemEl.createDiv('custom-icon-manager-right');

		// 图标预览
		const iconPreviewEl = rightEl.createDiv('custom-icon-manager-preview');
		this.customIconManager.renderIcon(icon.id, iconPreviewEl);

		// 删除按钮
		const deleteBtn = rightEl.createEl('button', {
			cls: 'custom-icon-delete-btn clickable-icon',
			attr: { 'aria-label': '删除图标' }
		});
		setIcon(deleteBtn, 'trash-2');

		deleteBtn.addEventListener('click', async (e) => {
			e.stopPropagation();
			await this.handleDelete(icon.id);
		});

		// 点击选择图标
		itemEl.addEventListener('click', () => {
			this.onSelectIcon(`custom:${icon.id}`);
			this.close();
		});
	}

	private openUploadModal() {
		new CustomIconUploadModal(this.app, async (icons: CustomIcon[]) => {
			await this.onAddIcons(icons);
			this.onUpdate();
			// 刷新列表
			this.renderContent();
		}).open();
	}

	private async handleDelete(iconId: string) {
		await this.onDeleteIcon(iconId);
		this.onUpdate();
		// 刷新列表
		this.renderContent();
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
