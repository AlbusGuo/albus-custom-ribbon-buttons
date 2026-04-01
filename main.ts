import { Plugin } from 'obsidian';
import { LegacyCustomIcon, RibbonVaultButtonsSettings } from './src/types';
import { DEFAULT_SETTINGS, isValidSvgContent, validateAndCleanSettings } from './src/settings';
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

	async onload() {
		// 确保初始化期间功能区不可见（配合 CSS 中 crb-ready 规则）
		document.body.classList.remove('crb-ready');
		this.customIconManager = CustomIconManager.getInstance(this.app);

		await this.loadSettings();
		await this.customIconManager.preloadIcons(this.collectReferencedCustomIcons());
		
		// 初始化按钮管理器
		this.buttonManager = new ButtonManager(
			this.app, 
			this.handleSettingsChange.bind(this),
			this.reorderButtons.bind(this),
			() => this.settings.iconMask
		);
		
		// 应用样式和初始化按钮
		this.buttonManager.applyStyleSettings(this.settings.hideBuiltInButtons);
		this.buttonManager.applyDefaultActionsStyle(this.settings.hideDefaultActions);
		this.initVaultButtons();

		// 初始化完成，一次性显示功能区最终状态
		document.body.classList.add('crb-ready');
		
		// 添加设置选项卡
		this.addSettingTab(new CustomButtonsSettingTab(this.app, this));

		this.registerEvent(this.app.workspace.on('layout-change', () => {
			this.initVaultButtons();
		}));

		this.app.workspace.onLayoutReady(() => {
			window.setTimeout(() => this.initVaultButtons(), 100);
		});
	}

	onunload() {
		if (this.buttonManager) {
			this.buttonManager.destroy();
		}
		document.body.classList.remove('crb-ready');
	}

	/** 主设置文件路径 */
	private get dataPath(): string {
		return `${this.manifest.dir}/data.json`;
	}

	/** 备份文件路径 */
	private get backupPath(): string {
		return `${this.manifest.dir}/data.backup.json`;
	}

	private async readStoredSettings(): Promise<any> {
		const exists = await this.app.vault.adapter.exists(this.dataPath);
		if (exists) {
			const raw = await this.app.vault.adapter.read(this.dataPath);
			return JSON.parse(raw);
		}

		try {
			return await this.loadData();
		} catch {
			return null;
		}
	}

	private async writeStoredSettings(data: RibbonVaultButtonsSettings): Promise<void> {
		const serialized = JSON.stringify(data, null, '\t');
		await this.app.vault.adapter.write(this.dataPath, serialized);
	}

	/**
	 * 加载设置
	 * 对 data.json 损坏场景做防御处理：先尝试主文件，失败后从备份恢复
	 */
	async loadSettings() {
		let data: any = null;
		try {
			data = await this.readStoredSettings();
		} catch {
			// data.json 损坏或为空 — 尝试从备份恢复
			data = await this.loadBackup();
		}

		// 防御：确保 data 是普通对象
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			data = null;
		}

		const { migratedData, didMigrateLegacyIcons } = await this.migrateLegacyCustomIcons(data);
		data = migratedData;

		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		this.settings = validateAndCleanSettings(this.settings);

		if (didMigrateLegacyIcons) {
			await this.saveSettings();
		}
	}

	/** 旧版内联图标迁移目录 */
	private get customIconDirPath(): string {
		return `${this.manifest.dir}/custom-icons`;
	}

	/**
	 * 将旧版内联 SVG 图标迁移为文件引用，避免继续把图标数据写入 data.json
	 */
	private async migrateLegacyCustomIcons(data: any): Promise<{ migratedData: any; didMigrateLegacyIcons: boolean }> {
		if (!data || typeof data !== 'object' || Array.isArray(data)) {
			return { migratedData: data, didMigrateLegacyIcons: false };
		}

		const legacyIcons = Array.isArray(data.customIcons) ? data.customIcons as LegacyCustomIcon[] : [];
		if (legacyIcons.length === 0) {
			if ('customIcons' in data) {
				delete data.customIcons;
				return { migratedData: data, didMigrateLegacyIcons: true };
			}

			return { migratedData: data, didMigrateLegacyIcons: false };
		}

		await this.ensureDirectory(this.customIconDirPath);
		const migratedRefs = new Map<string, string>();
		const usedPaths = new Set<string>();

		for (let index = 0; index < legacyIcons.length; index++) {
			const icon = legacyIcons[index];
			if (!icon?.id || !icon?.content || !isValidSvgContent(icon.content)) {
				continue;
			}

			const baseName = this.sanitizeFileName(icon.id) || `icon-${index + 1}`;
			let filePath = `${this.customIconDirPath}/${baseName}.svg`;
			let suffix = 1;

			while (usedPaths.has(filePath)) {
				filePath = `${this.customIconDirPath}/${baseName}-${suffix}.svg`;
				suffix++;
			}

			usedPaths.add(filePath);
			await this.app.vault.adapter.write(filePath, icon.content);
			migratedRefs.set(icon.id, this.customIconManager.createIconReference(filePath));
		}

		if (Array.isArray(data.buttonItems)) {
			for (const item of data.buttonItems) {
				if (!item || item.type === 'divider') {
					continue;
				}

				item.icon = this.replaceLegacyIconReference(item.icon, migratedRefs);
				item.toggleIcon = this.replaceLegacyIconReference(item.toggleIcon, migratedRefs);
			}
		}

		delete data.customIcons;
		return { migratedData: data, didMigrateLegacyIcons: true };
	}

	private replaceLegacyIconReference(iconName: string, migratedRefs: Map<string, string>): string {
		if (!iconName || !iconName.startsWith('custom:')) {
			return iconName;
		}

		const legacyId = iconName.slice(7);
		return migratedRefs.get(legacyId) || 'help-circle';
	}

	private sanitizeFileName(name: string): string {
		return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '-').trim();
	}

	private async ensureDirectory(dirPath: string) {
		try {
			const exists = await this.app.vault.adapter.exists(dirPath);
			if (!exists) {
				await this.app.vault.adapter.mkdir(dirPath);
			}
		} catch {
			// 目录已存在或创建失败时交由后续写入处理
		}
	}

	private collectReferencedCustomIcons(): string[] {
		const iconNames: string[] = [];
		for (const item of this.settings.leftRibbonItems) {
			if (item.type === 'divider') {
				continue;
			}

			iconNames.push(item.icon, item.toggleIcon || item.icon);
		}

		for (const item of this.settings.pageHeaderItems) {
			iconNames.push(item.icon, item.toggleIcon || item.icon);
		}

		return iconNames;
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
				await this.writeStoredSettings(validateAndCleanSettings(Object.assign({}, DEFAULT_SETTINGS, data)));
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

		this._savePromise = this.writeStoredSettings(this.settings);
		try {
			await this._savePromise;
			// 写入成功 — 异步更新备份（不阻塞主流程）
			const dataStr = JSON.stringify(this.settings, null, '\t');
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
			this.buttonManager.initVaultButtons(
				this.settings.leftRibbonItems,
				this.settings.pageHeaderItems,
				this.settings.hideBuiltInButtons
			);
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
		const [movedItem] = this.settings.leftRibbonItems.splice(sourceIndex, 1);
		this.settings.leftRibbonItems.splice(targetIndex, 0, movedItem);
		
		// 保存设置并重新初始化按钮
		await this.saveSettings();
		this.initVaultButtons();
	}
}
