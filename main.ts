import { Plugin } from 'obsidian';
import { RibbonVaultButtonsSettings } from './src/types';
import { DEFAULT_SETTINGS, validateAndCleanSettings } from './src/settings';
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
	/** 当前正在执行的保存操作 */
	private _savePromise: Promise<void> | null = null;
	/** 是否有等待中的保存请求 */
	private _savePending = false;
	/** 上一次成功写入磁盘的数据快照（JSON 字符串），用于备份 */
	private _lastSavedData: string | null = null;

	async onload() {
		// 确保初始化期间功能区不可见（配合 CSS 中 crb-ready 规则）
		document.body.classList.remove('crb-ready');

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

		// 初始化完成，一次性显示功能区最终状态
		document.body.classList.add('crb-ready');
		
		// 添加设置选项卡
		this.addSettingTab(new CustomButtonsSettingTab(this.app, this));
	}

	onunload() {
		if (this.buttonManager) {
			this.buttonManager.destroy();
		}
		document.body.classList.remove('crb-ready');
	}

	/** 备份文件路径 */
	private get backupPath(): string {
		return `${this.manifest.dir}/data.backup.json`;
	}

	/**
	 * 加载设置
	 * 对 data.json 损坏场景做防御处理：先尝试主文件，失败后从备份恢复
	 */
	async loadSettings() {
		let data: any = null;
		try {
			data = await this.loadData();
		} catch {
			// data.json 损坏或为空 — 尝试从备份恢复
			data = await this.loadBackup();
		}

		// 防御：确保 data 是普通对象
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			data = null;
		}

		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		this.settings = validateAndCleanSettings(this.settings);
		
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

		// 记录初始已知有效数据，供后续备份使用
		this._lastSavedData = JSON.stringify(this.settings);
	}

	/**
	 * 从备份文件恢复设置数据
	 * 若恢复成功，同步修复 data.json
	 */
	private async loadBackup(): Promise<any> {
		try {
			const raw = await this.app.vault.adapter.read(this.backupPath);
			const data = JSON.parse(raw);
			if (data && typeof data === 'object' && !Array.isArray(data)) {
				// 备份有效，同步修复 data.json
				await this.saveData(data);
				return data;
			}
		} catch {
			// 备份也不可用
		}
		return null;
	}

	/**
	 * 保存设置（串行化）
	 * 确保同一时刻只有一次写入操作，快速连续的调用会被合并为一次写入，
	 * 避免并发 saveData 导致 data.json 被截断损坏。
	 * 每次写入成功后异步更新备份文件，用于下次加载时的故障恢复。
	 */
	async saveSettings() {
		this.settings = validateAndCleanSettings(this.settings);

		// 如果已有写入正在进行，标记待写入并立即返回
		if (this._savePromise) {
			this._savePending = true;
			return;
		}

		this._savePromise = this.saveData(this.settings);
		try {
			await this._savePromise;
			// 写入成功 — 异步更新备份（不阻塞主流程）
			const dataStr = JSON.stringify(this.settings);
			this._lastSavedData = dataStr;
			this.app.vault.adapter.write(this.backupPath, dataStr).catch(() => {});
		} finally {
			this._savePromise = null;
		}

		// 写入完成后如果有新的待写入请求，再执行一次（使用最新内存数据）
		if (this._savePending) {
			this._savePending = false;
			await this.saveSettings();
		}
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
	private async handleSettingsChange() {
		await this.saveSettings();
		this.initVaultButtons();
	}

	/**
	 * 重新排序按钮项
	 */
	async reorderButtons(sourceIndex: number, targetIndex: number) {
		if (sourceIndex === targetIndex) return;
		
		// 重新排序数组
		const [movedItem] = this.settings.buttonItems.splice(sourceIndex, 1);
		this.settings.buttonItems.splice(targetIndex, 0, movedItem);
		
		// 保存设置并重新初始化按钮
		await this.saveSettings();
		this.initVaultButtons();
	}
}
