import { Plugin } from 'obsidian';
import { RibbonVaultButtonsSettings } from './src/types';
import { DEFAULT_SETTINGS } from './src/settings';
import { ButtonManager } from './src/utils/buttonManager';
import { CustomButtonsSettingTab } from './src/settings/customButtonsSettingTab';
import { CustomIconManager } from './src/utils/customIconManager';

/**
 * Ribbon Vault Buttons 插件主类
 * 为 Obsidian 添加自定义底部侧边栏按钮功能
 */
export default class RibbonVaultButtonsPlugin extends Plugin {
	settings: RibbonVaultButtonsSettings;
	buttonManager: ButtonManager;
	customIconManager: CustomIconManager;

	async onload() {
		await this.loadSettings();
		
		// 初始化自定义图标管理器
		this.customIconManager = CustomIconManager.getInstance();
		this.customIconManager.loadIcons(this.settings.customIcons);
		
		// 初始化按钮管理器
		this.buttonManager = new ButtonManager(
			this.app, 
			this.handleSettingsChange.bind(this),
			this.reorderButtons.bind(this)
		);
		
		// 应用样式和初始化按钮
		this.buttonManager.applyStyleSettings(this.settings.hideBuiltInButtons);
		this.buttonManager.applyDefaultActionsStyle(this.settings.hideDefaultActions);
		this.initVaultButtons();
		
		// 添加设置选项卡
		this.addSettingTab(new CustomButtonsSettingTab(this.app, this));
	}

	onunload() {
		if (this.buttonManager) {
			this.buttonManager.destroy();
		}
	}

	/**
	 * 加载设置
	 */
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		
		// 兼容性处理：为没有 toggleIcon 的旧按钮添加默认值
		this.settings.buttonItems.forEach((item) => {
			if (item.type !== 'divider' && !(item as any).toggleIcon) {
				(item as any).toggleIcon = (item as any).icon;
			}
		});
		
		// 兼容性处理：为旧设置添加 customIcons 字段
		if (!this.settings.customIcons) {
			this.settings.customIcons = [];
		}
	}

	/**
	 * 保存设置
	 */
	async saveSettings() {
		await this.saveData(this.settings);
	}

	/**
	 * 初始化所有按钮
	 */
	initVaultButtons() {
		if (this.buttonManager) {
			this.buttonManager.initVaultButtons(this.settings.buttonItems, this.settings.hideBuiltInButtons);
		}
	}

	/**
	 * 处理设置变化
	 */
	private handleSettingsChange() {
		// 重新排序按钮的逻辑可以在这里实现
		// 目前先保存设置并重新初始化
		this.saveSettings();
		this.initVaultButtons();
	}

	/**
	 * 重新排序按钮项
	 */
	reorderButtons(sourceIndex: number, targetIndex: number) {
		if (sourceIndex === targetIndex) return;
		
		// 重新排序数组
		const [movedItem] = this.settings.buttonItems.splice(sourceIndex, 1);
		this.settings.buttonItems.splice(targetIndex, 0, movedItem);
		
		// 保存设置并重新初始化按钮
		this.saveSettings();
		this.initVaultButtons();
	}
}
