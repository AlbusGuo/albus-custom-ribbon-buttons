import { Plugin } from 'obsidian';
import { RibbonVaultButtonsSettings } from './src/types';
import { DEFAULT_SETTINGS } from './src/settings';
import { ButtonManager } from './src/utils/buttonManager';
import { CustomButtonsSettingTab } from './src/settings/customButtonsSettingTab';

/**
 * Ribbon Vault Buttons 插件主类
 * 为 Obsidian 添加自定义底部侧边栏按钮功能
 */
export default class RibbonVaultButtonsPlugin extends Plugin {
	settings: RibbonVaultButtonsSettings;
	buttonManager: ButtonManager;
	private styleEl: HTMLStyleElement | null = null;

	async onload() {
		await this.loadSettings();
		
		// 注入CSS样式
		this.injectStyles();
		
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
		// 移除CSS样式
		if (this.styleEl) {
			this.styleEl.remove();
			this.styleEl = null;
		}
		
		if (this.buttonManager) {
			this.buttonManager.destroy();
		}
	}

	/**
	 * 注入CSS样式
	 */
	private injectStyles() {
		// 读取CSS文件内容
		const cssContent = `
/* 主容器样式 */
.basic-vault-button-header {
  margin-bottom: 16px;
}

.basic-vault-button-header h2 {
  margin: 0;
  color: var(--text-normal);
  font-size: 18px;
  font-weight: 600;
}



/* 添加按钮容器样式 */
.basic-vault-button-add-container {
  display: flex;
  gap: 12px;
  margin: 16px 0;
}

/* 添加按钮样式 */
.basic-vault-button-add-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 6px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: background 0.2s ease;
  flex: 1;
}

.basic-vault-button-add-btn:hover {
  background: var(--interactive-accent-hover);
}





/* 空状态样式 */
.basic-vault-button-empty {
  text-align: center;
  padding: 32px 20px;
  color: var(--text-muted);
  background: var(--background-secondary);
  border-radius: 8px;
  border: 1px solid var(--background-modifier-border);
  margin: 16px 0;
}

.basic-vault-button-empty p {
  margin: 8px 0;
  font-size: 14px;
}

.basic-vault-button-empty .setting-item-description {
  font-size: 12px;
  opacity: 0.7;
}

/* 分割线 */
.basic-vault-button-divider {
  height: 1px;
  background: var(--background-modifier-border);
  margin: 12px 0;
}

/* 紧凑型设置项样式 */

/* 设置项间距优化 */
.basic-vault-button-container .setting-item {
  padding: 8px 0;
  margin-bottom: 0;
}

/* 可点击的输入框样式 */
.basic-vault-button-container .setting-item-control input[type="text"]:focus {
  cursor: pointer;
  box-shadow: 0 0 0 2px var(--interactive-accent);
}

/* 命令和文件输入框的特殊样式 */
.basic-vault-button-container .setting-item-control input[placeholder*="命令ID"],
.basic-vault-button-container .setting-item-control input[placeholder*="文件路径"] {
  cursor: pointer;
  background: var(--background-modifier-form-field);
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  padding: 4px 8px;
  transition: all 0.2s ease;
}

.basic-vault-button-container .setting-item-control input[placeholder*="命令ID"]:hover,
.basic-vault-button-container .setting-item-control input[placeholder*="文件路径"]:hover {
  border-color: var(--interactive-accent);
  background: var(--background-primary);
}

.basic-vault-button-container .setting-item-control input[placeholder*="命令ID"]:focus,
.basic-vault-button-container .setting-item-control input[placeholder*="文件路径"]:focus {
  border-color: var(--interactive-accent);
  background: var(--background-primary);
  box-shadow: 0 0 0 2px var(--interactive-accent);
}

/* 隐藏搜索输入框的放大镜图标 */
.basic-vault-button-container .setting-item-control .search-input-container::before {
  display: none !important;
}

/* 隐藏搜索输入框的清除按钮图标 */
.basic-vault-button-container .setting-item-control .search-input-container .clickable-icon {
  display: none !important;
}

/* 单行布局控件样式 */
.basic-vault-button-container .setting-item-control {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.basic-vault-button-container .setting-item-control input[type="text"],
.basic-vault-button-container .setting-item-control select {
  min-width: 120px;
  max-width: 150px;
  font-size: 12px;
  padding: 4px 6px;
}

.basic-vault-button-container .setting-item-control .dropdown {
  min-width: 80px;
  max-width: 100px;
}

/* 紧凑型图标选择器样式 */
.icon-picker-button-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: 28px;
  padding: 4px;
  border: 1px solid var(--background-modifier-border);
  border-radius: 4px;
  background: var(--background-primary);
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 14px;
}

.icon-picker-button-compact:hover {
  background: var(--background-modifier-hover);
  border-color: var(--interactive-accent);
}

.icon-picker-preview-compact {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  color: var(--text-normal);
}

.icon-picker-preview-compact svg {
  width: 16px;
  height: 16px;
}

/* 删除按钮样式 */
.basic-vault-button-container .setting-item-extra-button {
  color: var(--color-red);
  margin-left: 4px;
}

.basic-vault-button-container .setting-item-extra-button:hover {
  color: var(--color-red-dark);
}

/* 响应式调整 */
@media (max-width: 768px) {
  .basic-vault-button-container .setting-item-control {
    flex-direction: column;
    align-items: stretch;
    gap: 6px;
  }
  
  .basic-vault-button-container .setting-item-control input[type="text"],
  .basic-vault-button-container .setting-item-control select,
  .basic-vault-button-container .setting-item-control .dropdown {
    max-width: 100%;
    width: 100%;
  }
}

/* 命令搜索样式 */
.command-search-container {
  position: relative;
  width: 100%;
}

.command-search-button {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  background: var(--interactive-accent);
  color: var(--text-on-accent);
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 11px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.command-search-button:hover {
  background: var(--interactive-accent-hover);
}

.command-search-input {
  padding-right: 70px !important;
  width: 100%;
}

/* 拖拽排序样式 */
.custom-ribbon-button {
  transition: all 0.2s ease;
  position: relative;
}

.custom-ribbon-button:hover {
  background-color: var(--background-modifier-hover);
}

.custom-ribbon-button.dragging {
  opacity: 0.5;
}

.custom-ribbon-button.drag-over {
  border: 2px dashed var(--interactive-accent);
  background-color: var(--background-modifier-hover);
}

/* 分割线拖拽样式 */
.custom-ribbon-divider {
  position: relative;
  cursor: move;
  margin: 4px 0;
  flex-shrink: 0;
  width: 100%;
  height: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.custom-ribbon-divider::before {
  content: '';
  position: absolute;
  width: 100%;
  height: 1px;
  background-color: var(--divider-color);
  opacity: 0.5;
}

.custom-ribbon-divider:hover::before {
  opacity: 1;
  background-color: var(--divider-color);
}

.custom-ribbon-divider.dragging::before {
  opacity: 0.5;
  transform: scale(0.95);
}

.custom-ribbon-divider.drag-over::before {
  height: 4px;
  background-color: var(--divider-color);
  opacity: 1;
}

/* 拖拽时的视觉提示 */
.custom-ribbon-divider:hover {
  background-color: var(--background-modifier-hover);
  border-radius: 2px;
}

.custom-ribbon-divider.dragging {
  background-color: var(--background-modifier-hover);
  border-radius: 2px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .basic-vault-button-add-container {
    flex-direction: column;
  }
  
  .basic-vault-button-add-btn {
    width: 100%;
    justify-content: center;
  }
  
  .basic-vault-button-empty {
    padding: 24px 16px;
    margin: 12px 0;
  }
}
		`;

		// 创建style元素
		this.styleEl = document.createElement('style');
		this.styleEl.textContent = cssContent;
		document.head.appendChild(this.styleEl);
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
