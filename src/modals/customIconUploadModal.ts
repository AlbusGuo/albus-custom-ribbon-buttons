import { App, Modal, Notice, Setting } from 'obsidian';
import { CustomIcon } from '../types';

/**
 * 自定义图标上传模态框
 * 支持从文件导入SVG图标
 */
export class CustomIconUploadModal extends Modal {
	private onSubmit: (icons: CustomIcon[]) => Promise<void>;
	private selectedFiles: File[] = [];
	private fileListEl: HTMLElement | null = null;

	constructor(app: App, onSubmit: (icons: CustomIcon[]) => Promise<void>) {
		super(app);
		this.onSubmit = onSubmit;
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.empty();

		contentEl.createEl('h2', { text: '添加自定义图标' });

		// 说明文字
		const desc = contentEl.createDiv('setting-item-description');
		desc.setText('选择一个或多个SVG文件作为自定义图标。文件名将作为图标ID。');
		desc.style.marginBottom = '16px';

		// 文件选择区域
		const fileSelectContainer = contentEl.createDiv('custom-icon-file-select');
		
		const selectButton = fileSelectContainer.createEl('button', {
			text: '选择SVG文件',
			cls: 'mod-cta'
		});
		
		// 创建隐藏的文件输入
		const fileInput = document.createElement('input');
		fileInput.type = 'file';
		fileInput.accept = '.svg';
		fileInput.multiple = true;
		fileInput.style.display = 'none';
		
		fileInput.addEventListener('change', (e) => {
			const target = e.target as HTMLInputElement;
			if (target.files) {
				this.selectedFiles = Array.from(target.files);
				this.updateFileList();
			}
		});
		
		selectButton.addEventListener('click', () => {
			fileInput.click();
		});
		
		fileSelectContainer.appendChild(fileInput);

		// 文件列表容器
		this.fileListEl = contentEl.createDiv('custom-icon-file-list');
		this.updateFileList();

		// 按钮容器
		const buttonContainer = contentEl.createDiv('modal-button-container');
		
		const cancelBtn = buttonContainer.createEl('button', { text: '取消' });
		cancelBtn.addEventListener('click', () => this.close());

		const submitBtn = buttonContainer.createEl('button', {
			text: '添加',
			cls: 'mod-cta'
		});
		submitBtn.addEventListener('click', () => this.handleSubmit());
	}

	private updateFileList() {
		if (!this.fileListEl) return;
		
		this.fileListEl.empty();
		
		if (this.selectedFiles.length > 0) {
			const countText = this.fileListEl.createDiv('custom-icon-file-count');
			countText.setText(`已选择 ${this.selectedFiles.length} 个文件`);
			
			const list = this.fileListEl.createDiv('custom-icon-files');
			this.selectedFiles.forEach((file, index) => {
				const fileItem = list.createDiv('custom-icon-file-item');
				
				const fileName = fileItem.createSpan('custom-icon-file-name');
				fileName.setText(file.name);
				
				const removeBtn = fileItem.createEl('button', {
					text: '×',
					cls: 'custom-icon-file-remove'
				});
				removeBtn.addEventListener('click', () => {
					this.selectedFiles.splice(index, 1);
					this.updateFileList();
				});
			});
		} else {
			const emptyText = this.fileListEl.createDiv('custom-icon-empty-state');
			emptyText.setText('尚未选择文件');
		}
	}

	private async handleSubmit() {
		try {
			if (this.selectedFiles.length === 0) {
				new Notice('请选择至少一个SVG文件');
				return;
			}

			const icons: CustomIcon[] = [];

			for (const file of this.selectedFiles) {
				const content = await file.text();
				
				// 验证SVG格式
				if (!this.validateSVG(content)) {
					new Notice(`文件 ${file.name} 不是有效的SVG文件`);
					continue;
				}

				const id = file.name.replace(/\.svg$/i, '');
				icons.push({ id, content });
			}

			if (icons.length === 0) {
				new Notice('没有有效的SVG文件');
				return;
			}

			await this.onSubmit(icons);
			new Notice(`成功添加 ${icons.length} 个自定义图标`);
			this.close();
		} catch (error) {
			console.error('添加自定义图标失败:', error);
			new Notice('添加自定义图标失败');
		}
	}

	private validateSVG(content: string): boolean {
		// 基本验证：检查是否包含 <svg 标签
		return content.trim().toLowerCase().includes('<svg');
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}
