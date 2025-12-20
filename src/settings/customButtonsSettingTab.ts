import { App, PluginSettingTab, Setting, Plugin, setIcon } from 'obsidian';
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

	constructor(app: App, plugin: RibbonVaultButtonsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		this.createGlobalSettings(containerEl);

		if (this.plugin.settings.buttonItems.length === 0) {
			this.createEmptyState(containerEl);
		} else {
			this.createButtonsList(containerEl);
		}

		this.createAddButtons(containerEl);
	}

	

	/**
	 * 创建全局设置
	 */
	private createGlobalSettings(containerEl: HTMLElement) {
		new Setting(containerEl)
			.setName('调整内置按钮到左侧功能区')
			.setDesc('开启后将 Obsidian 原生的库切换、设置、帮助等按钮布局调整到左侧功能区')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideBuiltInButtons)
				.onChange(async (value) => {
					this.plugin.settings.hideBuiltInButtons = value;
					await this.plugin.saveSettings();
					// 重新应用样式设置
					this.plugin.buttonManager.applyStyleSettings(value);
					// 重新初始化按钮以显示/隐藏我们的替代按钮
					this.plugin.initVaultButtons();
				}));

		new Setting(containerEl)
			.setName('隐藏默认功能区')
			.setDesc('开启后将隐藏 Obsidian 的默认功能区')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.hideDefaultActions)
				.onChange(async (value) => {
					this.plugin.settings.hideDefaultActions = value;
					await this.plugin.saveSettings();
					// 应用或移除默认功能区隐藏样式
					this.plugin.buttonManager.applyDefaultActionsStyle(value);
				}));
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
		// 创建容器用于应用紧凑样式
		const buttonsContainer = containerEl.createDiv('basic-vault-button-container');

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

		// 添加图标选择器
		this.addIconPicker(setting, button);
		
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
			.addSearch(search => {
				search.setValue(this.getValueForType(button));
				search.setPlaceholder(this.getPlaceholderForType(button.type));
				
				// 根据类型设置不同的输入验证
				if (button.type === 'url') {
					search.inputEl.type = 'url';
				}
				
				// 为命令类型添加选择器
				if (button.type === 'command') {
					const modal = new CommandSuggestModal(this.app, (command) => {
						button.command = command.id;
						search.setValue(command.id);
						this.plugin.saveSettings();
					});
					
					search.inputEl.addEventListener('click', () => {
						modal.open();
					});
				}
				
				// 为文件类型添加选择器
				if (button.type === 'file') {
					const modal = new FileSuggestModal(this.app, (file) => {
						button.file = file.path;
						search.setValue(file.path);
						this.plugin.saveSettings();
					});
					
					search.inputEl.addEventListener('click', () => {
						modal.open();
					});
				}
				
				search.onChange(value => {
					this.setValueForType(button, value);
					this.plugin.saveSettings();
				});
			})
			.addExtraButton(extraButton => extraButton
				.setIcon('trash')
				.setTooltip('删除按钮')
				.onClick(() => this.removeButtonItem(index)));
	}

	/**
	 * 添加图标选择器
	 */
	private addIconPicker(setting: Setting, button: CustomButton) {
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
		updateIconDisplay(button.icon);

		// 点击打开图标选择模态框
		iconButton.addEventListener('click', () => {
			const modal = new IconSuggestModal(this.app, async (selectedIcon: string) => {
				button.icon = selectedIcon;
				updateIconDisplay(selectedIcon);
				await this.plugin.saveSettings();
				this.plugin.initVaultButtons();
			});
			modal.open();
		});

		// 添加工具提示
		iconButton.title = `当前图标: ${button.icon || 'help-circle'}`;
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
	}

	
}