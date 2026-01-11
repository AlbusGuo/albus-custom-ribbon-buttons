import { App, PluginSettingTab, Setting, Plugin, setIcon, SettingGroup } from 'obsidian';
import { CustomButton, ButtonItem, DividerItem } from '../types';
import { createCustomButton, createDivider } from '../settings';
import { FileSuggestModal } from '../modals/fileSuggestModal';
import { CommandSuggestModal } from '../modals/commandSuggestModal';
import { IconSuggestModal } from '../modals/iconSuggestModal';

// 前向声明主类
interface RibbonVaultButtonsPlugin extends Plugin {
	settings: { buttonItems: ButtonItem[]; hideBuiltInButtons: boolean; hideDefaultActions: boolean };
	saveSettings(): Promise<void>;
	initVaultButtons(): void;
	buttonManager: any;
}

/**
 * 自定义按钮设置选项卡
 */
export class CustomButtonsSettingTab extends PluginSettingTab {
	plugin: RibbonVaultButtonsPlugin;
	private draggedIndex: number | null = null;

	icon: string = 'panel-left';

	constructor(app: App, plugin: RibbonVaultButtonsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// 创建全局设置分组
		this.createGlobalSettings(containerEl);

		// 创建按钮列表标题
		containerEl.createEl('h3', { text: '自定义按钮列表' });

		if (this.plugin.settings.buttonItems.length === 0) {
			this.createEmptyState(containerEl);
		} else {
			this.createButtonsList(containerEl);
		}

		this.createAddButtons(containerEl);
	}

	

	/**
	 * 创建全局设置 - 使用 SettingGroup (Note Toolbar 风格)
	 */
	private createGlobalSettings(containerEl: HTMLElement) {
		// 使用 SettingGroup 创建设置组（完全按照 Note Toolbar）
		const settingsGroup = new SettingGroup(containerEl);

		settingsGroup.addSetting((setting) => {
			setting
				.setName('调整内置按钮到左侧功能区')
				.setDesc('开启后将 Obsidian 原生的库切换、设置、帮助等按钮布局调整到左侧功能区')
				.addToggle(toggle => toggle
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
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings.hideDefaultActions)
					.onChange(async (value) => {
						this.plugin.settings.hideDefaultActions = value;
						await this.plugin.saveSettings();
						this.plugin.buttonManager.applyDefaultActionsStyle(value);
					}));
		});
	}

	/**
	 * 创建空状态提示
	 */
	private createEmptyState(containerEl: HTMLElement) {
		const emptyState = containerEl.createDiv('basic-vault-button-empty');
		emptyState.createEl('p', { text: '还没有添加任何自定义按钮' });
		emptyState.createEl('p', {
			text: '点击下方的"添加新按钮"开始创建',
			cls: 'setting-item-description'
		});
	}

	/**
	 * 创建按钮列表
	 */
	private createButtonsList(containerEl: HTMLElement) {
		// 创建按钮列表容器，应用 Note Toolbar 风格
		const buttonsContainer = containerEl.createDiv('basic-vault-button-list');

		this.plugin.settings.buttonItems.forEach((item, index) => {
			if (item.type === 'divider') {
				this.createDividerSetting(buttonsContainer, item as DividerItem, index);
			} else {
				this.createButtonSetting(buttonsContainer, item as CustomButton, index);
			}
		});
	}

	/**
	 * 创建添加按钮组
	 */
	private createAddButtons(containerEl: HTMLElement) {
		const addButtonsContainer = containerEl.createDiv('basic-vault-button-add-container');
		
		const addButton = addButtonsContainer.createEl('button', {
			text: '添加新按钮',
			cls: 'basic-vault-button-add-btn'
		});
		addButton.addEventListener('click', () => {
			this.addCustomButton();
		});
		
		const addDividerButton = addButtonsContainer.createEl('button', {
			text: '添加分割线',
			cls: 'basic-vault-button-add-btn'
		});
		addDividerButton.addEventListener('click', () => {
			this.addDivider();
		});
	}

	/**
	 * 添加自定义按钮
	 */
	private addCustomButton() {
		const newButton = createCustomButton();
		// 添加到列表末尾，而不是开头
		this.plugin.settings.buttonItems.push(newButton);
		this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();
	}

	/**
	 * 添加分割线
	 */
	private addDivider() {
		const newDivider = createDivider();
		// 添加到列表末尾，而不是开头
		this.plugin.settings.buttonItems.push(newDivider);
		this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();
	}

	/**
	 * 删除按钮项
	 */
	private removeButtonItem(index: number) {
		this.plugin.settings.buttonItems.splice(index, 1);
		this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();
	}

	/**
	 * 创建单个按钮的设置项
	 */
	private createButtonSetting(containerEl: HTMLElement, button: CustomButton, index: number) {
		// 创建单行设置项，包含所有配置
		const setting = new Setting(containerEl)
			.setName('按钮')
			.addText(text => text
				.setPlaceholder('按钮名称')
				.setValue(button.tooltip)
				.onChange(async (value) => {
					button.tooltip = value;
					await this.plugin.saveSettings();
					this.plugin.initVaultButtons();
				}));

		// 添加拖拽功能
		this.makeDraggable(setting.settingEl, index);

		// 添加主图标选择器
		this.addIconPicker(setting, button, false);
		
		// 添加切换图标选择器
		this.addIconPicker(setting, button, true);
		
		setting.addDropdown(dropdown => dropdown
			.addOption('command', '命令')
			.addOption('file', '文件')
			.addOption('url', '网址')
			.setValue(button.type)
			.onChange(async (value) => {
				button.type = value as 'command' | 'file' | 'url';
				await this.plugin.saveSettings();
				this.display();
			}))
			.addText(text => {
				text.setValue(this.getValueForType(button));
				text.setPlaceholder(this.getPlaceholderForType(button.type));
				
				// 所有输入框都使用text类型确保样式一致
				text.inputEl.type = 'text';
				
				// 为命令类型添加选择器
				if (button.type === 'command') {
					const modal = new CommandSuggestModal(this.app, (command) => {
						button.command = command.id;
						text.setValue(command.id);
						this.plugin.saveSettings();
					});
					
					text.inputEl.addEventListener('click', () => {
						modal.open();
					});
				}
				
				// 为文件类型添加选择器
				if (button.type === 'file') {
					const modal = new FileSuggestModal(this.app, (file) => {
						button.file = file.path;
						text.setValue(file.path);
						this.plugin.saveSettings();
					});
					
					text.inputEl.addEventListener('click', () => {
						modal.open();
					});
				}
				
				text.onChange(value => {
					this.setValueForType(button, value);
					this.plugin.saveSettings();
				});
			})
			.addExtraButton(extraButton => extraButton
				.setIcon('trash')
				.setTooltip('删除按钮')
				.onClick(() => this.removeButtonItem(index)));

		// 在最右侧添加拖拽手柄
		this.addDragHandle(setting, index);
	}

	/**
	 * 添加图标选择器
	 */
	private addIconPicker(setting: Setting, button: CustomButton, isToggleIcon: boolean = false) {
		// 创建图标选择按钮
		const iconButton = setting.controlEl.createEl('button', {
			cls: 'icon-picker-button-compact'
		});

		// 创建图标预览容器
		const iconPreview = iconButton.createDiv({ cls: 'icon-picker-preview-compact' });
		
		// 更新图标预览的函数
		const updateIconDisplay = (iconName: string) => {
			iconPreview.empty();
			try {
				setIcon(iconPreview, iconName || 'help-circle');
			} catch (error) {
				iconPreview.setText('?');
			}
		};

		// 初始化图标显示
		const currentIcon = isToggleIcon ? button.toggleIcon : button.icon;
		updateIconDisplay(currentIcon);

		// 点击打开图标选择模态框
		iconButton.addEventListener('click', () => {
			const modal = new IconSuggestModal(this.app, async (selectedIcon: string) => {
				if (isToggleIcon) {
					button.toggleIcon = selectedIcon;
				} else {
					button.icon = selectedIcon;
				}
				updateIconDisplay(selectedIcon);
				await this.plugin.saveSettings();
				this.plugin.initVaultButtons();
			});
			modal.open();
		});

		// 添加工具提示
		const iconType = isToggleIcon ? '切换图标' : '主图标';
		const currentIconName = isToggleIcon ? (button.toggleIcon || 'help-circle') : (button.icon || 'help-circle');
		iconButton.title = `${iconType}: ${currentIconName}`;
	}

	/**
	 * 根据按钮类型获取占位符文本
	 */
	private getPlaceholderForType(type: string): string {
		switch (type) {
			case 'command':
				return '命令ID';
			case 'file':
				return '文件路径';
			case 'url':
				return '网址';
			default:
				return '值';
		}
	}

	/**
	 * 根据按钮类型获取当前值
	 */
	private getValueForType(button: CustomButton): string {
		switch (button.type) {
			case 'command':
				return button.command;
			case 'file':
				return button.file;
			case 'url':
				return button.url;
			default:
				return '';
		}
	}

	/**
	 * 根据按钮类型设置值
	 */
	private setValueForType(button: CustomButton, value: string): void {
		switch (button.type) {
			case 'command':
				button.command = value;
				break;
			case 'file':
				button.file = value;
				break;
			case 'url':
				button.url = value;
				break;
		}
	}

	/**
	 * 创建分割线设置项
	 */
	private createDividerSetting(containerEl: HTMLElement, divider: DividerItem, index: number) {
		const setting = new Setting(containerEl)
			.setName('分割线')
			.addExtraButton(extraButton => extraButton
				.setIcon('trash')
				.setTooltip('删除分割线')
				.onClick(() => this.removeButtonItem(index)));

		// 添加拖拽功能
		this.makeDraggable(setting.settingEl, index);

		// 在最右侧添加拖拽手柄
		this.addDragHandle(setting, index);
	}

	/**
	 * 添加拖拽手柄
	 */
	private addDragHandle(setting: Setting, index: number) {
		const dragHandle = setting.controlEl.createDiv({
			cls: 'drag-handle',
			attr: { 'aria-label': '拖拽排序' }
		});
		setIcon(dragHandle, 'grip-vertical');
		
		// 只允许拖拽手柄触发拖拽
		dragHandle.addEventListener('mousedown', (e) => {
			const settingEl = setting.settingEl;
			settingEl.setAttribute('draggable', 'true');
		});
		
		dragHandle.addEventListener('mouseup', (e) => {
			const settingEl = setting.settingEl;
			settingEl.setAttribute('draggable', 'false');
		});
	}

	/**
	 * 使设置项可拖拽
	 */
	private makeDraggable(element: HTMLElement, index: number) {
		// 默认不可拖拽，只有通过拖拽手柄才能拖拽
		element.setAttribute('draggable', 'false');
		element.classList.add('draggable-setting');
		element.dataset.index = index.toString();

		element.addEventListener('dragstart', (e) => {
			this.draggedIndex = index;
			element.classList.add('dragging');
			if (e.dataTransfer) {
				e.dataTransfer.effectAllowed = 'move';
				e.dataTransfer.setData('text/plain', index.toString());
			}
		});

		element.addEventListener('dragend', () => {
			this.draggedIndex = null;
			element.classList.remove('dragging');
			document.querySelectorAll('.draggable-setting.drag-over').forEach(el => {
				el.classList.remove('drag-over');
			});
		});

		element.addEventListener('dragover', (e) => {
			if (this.draggedIndex !== null && this.draggedIndex !== index) {
				e.preventDefault();
				if (e.dataTransfer) {
					e.dataTransfer.dropEffect = 'move';
				}
				element.classList.add('drag-over');
			}
		});

		element.addEventListener('dragenter', (e) => {
			if (this.draggedIndex !== null && this.draggedIndex !== index) {
				e.preventDefault();
				element.classList.add('drag-over');
			}
		});

		element.addEventListener('dragleave', (e) => {
			// 只在离开整个元素时移除样式
			if (e.currentTarget === e.target || !element.contains(e.relatedTarget as Node)) {
				element.classList.remove('drag-over');
			}
		});

		element.addEventListener('drop', (e) => {
			e.preventDefault();
			element.classList.remove('drag-over');

			if (this.draggedIndex !== null && this.draggedIndex !== index) {
				this.reorderItems(this.draggedIndex, index);
			}
		});
	}

	/**
	 * 重新排序项目
	 */
	private reorderItems(fromIndex: number, toIndex: number) {
		const items = this.plugin.settings.buttonItems;
		const [movedItem] = items.splice(fromIndex, 1);
		items.splice(toIndex, 0, movedItem);
		this.plugin.saveSettings();
		this.plugin.initVaultButtons();
		this.display();
	}

	
}