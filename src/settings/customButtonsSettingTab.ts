import { App, Plugin, PluginSettingTab, Setting, SettingGroup, setIcon, setTooltip } from 'obsidian';
import { ButtonItem, CustomButton, DividerItem, RibbonVaultButtonsSettings } from '../types';
import { createCustomButton, createDivider } from '../settings';
import { ButtonEditorPopover } from '../modals/buttonEditorPopover';
import { CustomIconManager } from '../utils/customIconManager';
import { FolderSuggester } from '../utils/folderSuggester';

type SettingsTabKey = RibbonVaultButtonsSettings['settingsTab'];
type ButtonArea = Exclude<SettingsTabKey, 'general'>;

interface RibbonVaultButtonsPlugin extends Plugin {
	settings: RibbonVaultButtonsSettings;
	saveSettings(): Promise<void>;
	initVaultButtons(): void;
	buttonManager: {
		applyStyleSettings(hideBuiltInButtons?: boolean): void;
		applyDefaultActionsStyle(hideDefaultActions?: boolean): void;
	};
	customIconManager: CustomIconManager;
}

export class CustomButtonsSettingTab extends PluginSettingTab {
	plugin: RibbonVaultButtonsPlugin;
	private draggedIndex: number | null = null;
	private draggedArea: ButtonArea | null = null;

	icon: string = 'panel-left';

	constructor(app: App, plugin: RibbonVaultButtonsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();
		containerEl.addClass('basic-vault-button-setting-ui');

		const tabsEl = containerEl.createDiv({ cls: 'basic-vault-settings-tabs' });
		const contentEl = containerEl.createDiv({ cls: 'basic-vault-settings-content' });

		this.createTabButton(tabsEl, 'general', '通用');
		this.createTabButton(tabsEl, 'left-ribbon', '左侧边栏');
		this.createTabButton(tabsEl, 'page-header', '页首');

		this.renderActiveTab(contentEl);
	}

	private createTabButton(parentEl: HTMLElement, tab: SettingsTabKey, label: string) {
		const buttonEl = parentEl.createDiv({
			cls: `basic-vault-settings-tab${this.plugin.settings.settingsTab === tab ? ' is-active' : ''}`,
			text: label,
		});

		buttonEl.addEventListener('click', () => {
			if (this.plugin.settings.settingsTab === tab) {
				return;
			}

			void this.switchTab(tab);
		});
	}

	private async switchTab(tab: SettingsTabKey) {
		this.plugin.settings.settingsTab = tab;
		await this.plugin.saveSettings();
		this.display();
	}

	private renderActiveTab(contentEl: HTMLElement) {
		switch (this.plugin.settings.settingsTab) {
			case 'general':
				this.renderGeneralTab(contentEl);
				return;
			case 'left-ribbon':
				this.renderButtonsTab(contentEl, 'left-ribbon');
				return;
			case 'page-header':
				this.renderButtonsTab(contentEl, 'page-header');
				return;
		}
	}

	private renderGeneralTab(contentEl: HTMLElement) {
		this.createGlobalSettings(contentEl);
	}

	private renderButtonsTab(contentEl: HTMLElement, area: ButtonArea) {
		const groupEl = contentEl.createDiv({ cls: 'setting-group basic-vault-button-group' });
		const listContainer = groupEl.createDiv({ cls: 'basic-vault-button-list-container' });
		const items = this.getItems(area);

		if (items.length === 0) {
			this.createEmptyState(listContainer, area);
		} else {
			this.createButtonsList(listContainer, area);
		}

		this.createAddButtons(groupEl, area);
	}

	private createGlobalSettings(containerEl: HTMLElement) {
		const settingsGroup = new SettingGroup(containerEl);

		settingsGroup.addSetting((setting) => {
			setting
				.setName('调整内置按钮到左侧功能区')
				.setDesc('开启后将 Obsidian 原生的库切换、设置、帮助等按钮布局调整到左侧功能区')
				.addToggle((toggle) => toggle
					.setValue(this.plugin.settings.hideBuiltInButtons)
					.onChange(async (value) => {
						this.plugin.settings.hideBuiltInButtons = value;
						await this.plugin.saveSettings();
						this.plugin.buttonManager.applyStyleSettings(value);
						this.plugin.initVaultButtons();
					}));
		});

		settingsGroup.addSetting((setting) => {
			setting
				.setName('隐藏默认功能区')
				.setDesc('开启后将隐藏 Obsidian 的默认功能区')
				.addToggle((toggle) => toggle
					.setValue(this.plugin.settings.hideDefaultActions)
					.onChange(async (value) => {
						this.plugin.settings.hideDefaultActions = value;
						await this.plugin.saveSettings();
						this.plugin.buttonManager.applyDefaultActionsStyle(value);
					}));
		});

		settingsGroup.addSetting((setting) => {
			setting
				.setName('自定义图标文件夹')
				.setDesc('自定义图标目录')
				.addText((text) => {
					text
						.setPlaceholder('例如：Assets/Icons')
						.setValue(this.plugin.settings.iconFolder)
						.onChange(async (value) => {
							this.plugin.settings.iconFolder = value.trim();
							await this.plugin.saveSettings();
						});

					new FolderSuggester(this.app, text.inputEl);
				});
		});

		settingsGroup.addSetting((setting) => {
			setting
				.setName('图标遮罩')
				.setDesc('开启后将自定义 SVG 图标强制渲染为 Obsidian 默认图标颜色, 关闭后保留原始颜色')
				.addToggle((toggle) => toggle
					.setValue(this.plugin.settings.iconMask)
					.onChange(async (value) => {
						this.plugin.settings.iconMask = value;
						await this.plugin.saveSettings();
						this.plugin.initVaultButtons();
						this.display();
					}));
		});
	}

	private createEmptyState(parentEl: HTMLElement, area: ButtonArea) {
		const emptyState = parentEl.createDiv({ cls: 'basic-vault-button-empty' });
		emptyState.createEl('p', {
			text: area === 'left-ribbon' ? '还没有添加左侧边栏按钮' : '还没有添加页首按钮'
		});
		emptyState.createEl('p', {
			text: area === 'left-ribbon' ? '点击下方按钮开始创建左侧边栏按钮或分割线' : '点击下方按钮开始创建页首按钮',
			cls: 'setting-item-description'
		});
	}

	private createButtonsList(parentEl: HTMLElement, area: ButtonArea) {
		const buttonsContainer = parentEl.createDiv({ cls: 'basic-vault-button-list' });

		this.getItems(area).forEach((item, index) => {
			if (item.type === 'divider') {
				this.createDividerSetting(buttonsContainer, item, index, 'left-ribbon');
				return;
			}

			this.createButtonSetting(buttonsContainer, item, index, area);
		});
	}

	private createAddButtons(containerEl: HTMLElement, area: ButtonArea) {
		const addButtonsContainer = containerEl.createDiv({ cls: 'basic-vault-button-add-container' });

		const addButton = addButtonsContainer.createEl('button', {
			text: area === 'left-ribbon' ? '添加新按钮' : '添加页首按钮',
			cls: 'basic-vault-button-add-btn'
		});
		addButton.addEventListener('click', (event) => {
			this.addCustomButton(area, event.currentTarget as HTMLElement);
		});

		if (area === 'left-ribbon') {
			const addDividerButton = addButtonsContainer.createEl('button', {
				text: '添加分割线',
				cls: 'basic-vault-button-add-btn'
			});
			addDividerButton.addEventListener('click', () => {
				void this.addDivider(area);
			});
		}
	}

	private async addCustomButton(area: ButtonArea, anchorEl: HTMLElement) {
		const newButton = createCustomButton();
		this.getItems(area).push(newButton);
		await this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();

		const index = this.getItems(area).length - 1;
		const rowSelector = `.basic-vault-button-list .setting-item[data-area="${area}"][data-index="${index}"]`;
		const rowEl = this.containerEl.querySelector<HTMLElement>(rowSelector) ?? anchorEl;
		this.openButtonEditor(area, index, rowEl, true);
	}

	private async addDivider(area: Extract<ButtonArea, 'left-ribbon'>) {
		this.plugin.settings.leftRibbonItems.push(createDivider());
		await this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();
	}

	private async removeButtonItem(area: ButtonArea, index: number) {
		this.getItems(area).splice(index, 1);
		await this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();
	}

	private createButtonSetting(containerEl: HTMLElement, button: CustomButton, index: number, area: ButtonArea) {
		const setting = new Setting(containerEl)
			.setName(button.tooltip.trim() || '未命名按钮');

		setting.settingEl.addClass('basic-vault-button-setting');
		setting.settingEl.dataset.index = index.toString();
		setting.settingEl.dataset.area = area;
		setting.setDesc(this.getButtonSummary(button));
		this.decorateButtonName(setting, button);

		this.makeDraggable(setting.settingEl, index, area);

		setting
			.addExtraButton((extraButton) => extraButton
				.setIcon('pencil')
				.setTooltip('编辑按钮')
				.onClick(() => {
					this.openButtonEditor(area, index, setting.settingEl);
				}))
			.addExtraButton((extraButton) => extraButton
				.setIcon('trash')
				.setTooltip('删除按钮')
				.onClick(() => this.removeButtonItem(area, index)));

		this.addDragHandle(setting, index, area);
	}

	private openButtonEditor(area: ButtonArea, index: number, anchorEl: HTMLElement, refreshOnClose: boolean = true) {
		const item = this.getItems(area)[index];
		if (!item || item.type === 'divider') {
			return;
		}

		new ButtonEditorPopover(this.app, item, {
			anchorEl,
			title: '编辑按钮',
			iconFolder: this.plugin.settings.iconFolder,
			iconMask: this.plugin.settings.iconMask,
			onChange: async (savedButton) => {
				this.getItems(area)[index] = savedButton;
				await this.plugin.saveSettings();
				this.plugin.initVaultButtons();
			},
			onClose: () => {
				if (refreshOnClose) {
					this.display();
				}
			}
		}).open();
	}

	private decorateButtonName(setting: Setting, button: CustomButton) {
		setting.nameEl.empty();

		const nameWrapEl = setting.nameEl.createSpan({ cls: 'basic-vault-button-name-wrap' });
		const iconWrapEl = nameWrapEl.createSpan({
			cls: 'basic-vault-button-name-icon',
			attr: {
				role: 'button',
				tabindex: '0',
				'aria-label': '切换图标预览'
			}
		});
		const previewEl = iconWrapEl.createSpan({ cls: 'icon-picker-preview-compact' });
		nameWrapEl.createSpan({
			cls: 'basic-vault-button-name-text',
			text: button.tooltip.trim() || '未命名按钮'
		});

		let showingToggleIcon = false;
		const renderPreview = async () => {
			const iconName = showingToggleIcon ? (button.toggleIcon || button.icon) : button.icon;
			previewEl.empty();

			if (this.plugin.customIconManager.isCustomIcon(iconName)) {
				const rendered = await this.plugin.customIconManager.renderIcon(iconName, previewEl, this.plugin.settings.iconMask);
				if (!rendered) {
					previewEl.setText('?');
				}
			} else {
				try {
					setIcon(previewEl, iconName || 'help-circle');
				} catch {
					previewEl.setText('?');
				}
			}

			const iconType = showingToggleIcon ? '切换图标' : '主图标';
			setTooltip(iconWrapEl, `${iconType}: ${this.plugin.customIconManager.getDisplayName(iconName || 'help-circle')}`);
		};

		const togglePreview = () => {
			showingToggleIcon = !showingToggleIcon;
			void renderPreview();
		};

		iconWrapEl.addEventListener('click', togglePreview);
		iconWrapEl.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				togglePreview();
			}
		});

		void renderPreview();
	}

	private getButtonSummary(button: CustomButton): string {
		const target = (() => {
			switch (button.type) {
				case 'command':
					return button.command || '未设置命令';
				case 'command-group':
					return button.commands.length > 0 ? `${button.commands.length} 个命令` : '未设置命令组';
				case 'file':
					return button.file || '未设置文件';
				case 'url':
					return button.url || '未设置网址';
			}
		})();

		return `${this.getButtonTypeLabel(button.type)} · ${target}`;
	}

	private getButtonTypeLabel(type: CustomButton['type']): string {
		switch (type) {
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

	private createDividerSetting(containerEl: HTMLElement, divider: DividerItem, index: number, area: Extract<ButtonArea, 'left-ribbon'>) {
		const setting = new Setting(containerEl)
			.setName('分割线')
			.setDesc('用于分隔自定义按钮')
			.addExtraButton((extraButton) => extraButton
				.setIcon('trash')
				.setTooltip('删除分割线')
				.onClick(() => this.removeButtonItem(area, index)));

		setting.settingEl.addClass('basic-vault-button-setting');
		setting.settingEl.dataset.index = index.toString();
		setting.settingEl.dataset.area = area;

		this.makeDraggable(setting.settingEl, index, area);
		this.addDragHandle(setting, index, area);
	}

	private addDragHandle(setting: Setting, index: number, area: ButtonArea) {
		const dragHandle = setting.controlEl.createDiv({
			cls: 'drag-handle',
			attr: { 'aria-label': '拖拽排序' }
		});
		setIcon(dragHandle, 'grip-vertical');

		dragHandle.addEventListener('mousedown', () => {
			setting.settingEl.setAttribute('draggable', 'true');
			this.draggedIndex = index;
			this.draggedArea = area;
		});

		dragHandle.addEventListener('mouseup', () => {
			setting.settingEl.setAttribute('draggable', 'false');
		});
	}

	private makeDraggable(element: HTMLElement, index: number, area: ButtonArea) {
		element.setAttribute('draggable', 'false');
		element.classList.add('draggable-setting');
		element.dataset.index = index.toString();
		element.dataset.area = area;

		element.addEventListener('dragstart', (event) => {
			this.draggedIndex = index;
			this.draggedArea = area;
			element.classList.add('dragging');
			if (event.dataTransfer) {
				event.dataTransfer.effectAllowed = 'move';
				event.dataTransfer.setData('text/plain', `${area}:${index}`);
			}
		});

		element.addEventListener('dragend', () => {
			this.draggedIndex = null;
			this.draggedArea = null;
			element.classList.remove('dragging');
			document.querySelectorAll('.draggable-setting.drag-over').forEach((dragElement) => {
				dragElement.classList.remove('drag-over');
			});
		});

		element.addEventListener('dragover', (event) => {
			if (this.draggedIndex !== null && this.draggedArea === area && this.draggedIndex !== index) {
				event.preventDefault();
				if (event.dataTransfer) {
					event.dataTransfer.dropEffect = 'move';
				}
				element.classList.add('drag-over');
			}
		});

		element.addEventListener('dragenter', (event) => {
			if (this.draggedIndex !== null && this.draggedArea === area && this.draggedIndex !== index) {
				event.preventDefault();
				element.classList.add('drag-over');
			}
		});

		element.addEventListener('dragleave', (event) => {
			if (event.currentTarget === event.target || !element.contains(event.relatedTarget as Node)) {
				element.classList.remove('drag-over');
			}
		});

		element.addEventListener('drop', (event) => {
			event.preventDefault();
			element.classList.remove('drag-over');

			if (this.draggedIndex !== null && this.draggedArea === area && this.draggedIndex !== index) {
				void this.reorderItems(area, this.draggedIndex, index);
			}
		});
	}

	private async reorderItems(area: ButtonArea, fromIndex: number, toIndex: number) {
		const items = this.getItems(area);
		const [movedItem] = items.splice(fromIndex, 1);
		items.splice(toIndex, 0, movedItem as ButtonItem & CustomButton);
		await this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();
	}

	private getItems(area: ButtonArea) {
		return area === 'left-ribbon'
			? this.plugin.settings.leftRibbonItems
			: this.plugin.settings.pageHeaderItems;
	}
}