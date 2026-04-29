import { Plugin } from 'obsidian';
import { LegacyCustomIcon, RibbonVaultButtonsSettings, ButtonItem, CustomButton } from './src/types';
import { DEFAULT_SETTINGS, isValidSvgContent, validateAndCleanSettings } from './src/settings';
import { ButtonManager } from './src/utils/buttonManager';
import { CustomButtonsSettingTab } from './src/settings/customButtonsSettingTab';
import { CustomIconManager } from './src/utils/customIconManager';

/**
 * 判断值是否为普通对象（非 null、非数组）
 * 参考 custom-about-blank 的 isPlainObject 实现
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return Object.prototype.toString.call(value) === '[object Object]';
}

/**
 * Ribbon Vault Buttons 插件主类
 * 为 Obsidian 添加自定义底部侧边栏按钮功能
 */
export default class RibbonVaultButtonsPlugin extends Plugin {
	settings: RibbonVaultButtonsSettings;
	buttonManager: ButtonManager;
	customIconManager: CustomIconManager;

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

	// =========================================================================
	// 数据持久化（参考 custom-about-blank 的白名单策略）
	// =========================================================================

	/**
	 * 清理并规范化设置对象形状
	 * 
	 * 采用白名单策略：始终从 DEFAULT_SETTINGS 的深拷贝出发，
	 * 仅复制输入中已知且类型正确的字段，避免任何脏数据进入 settings。
	 * 此方法在加载和保存时均被调用，确保 settings 始终具有合法的形状。
	 */
	private sanitizeSettingsShape(raw: unknown): RibbonVaultButtonsSettings {
		const defaults = structuredClone(DEFAULT_SETTINGS);

		if (!isPlainObject(raw)) {
			return defaults;
		}

		const data = raw as Record<string, unknown>;

		// 白名单：只复制 DEFAULT_SETTINGS 中定义的 key，且严格校验类型
		const sanitized: RibbonVaultButtonsSettings = {
			leftRibbonItems: Array.isArray(data.leftRibbonItems)
				? data.leftRibbonItems as ButtonItem[]
				: defaults.leftRibbonItems,
			pageHeaderItems: Array.isArray(data.pageHeaderItems)
				? data.pageHeaderItems as CustomButton[]
				: defaults.pageHeaderItems,
			iconFolder: typeof data.iconFolder === 'string' ? data.iconFolder : defaults.iconFolder,
			iconMask: typeof data.iconMask === 'boolean' ? data.iconMask : defaults.iconMask,
			hideBuiltInButtons: typeof data.hideBuiltInButtons === 'boolean'
				? data.hideBuiltInButtons
				: defaults.hideBuiltInButtons,
			hideDefaultActions: typeof data.hideDefaultActions === 'boolean'
				? data.hideDefaultActions
				: defaults.hideDefaultActions,
			settingsTab:
				data.settingsTab === 'general' ||
				data.settingsTab === 'left-ribbon' ||
				data.settingsTab === 'page-header'
					? (data.settingsTab as RibbonVaultButtonsSettings['settingsTab'])
					: defaults.settingsTab,
		};

		// 按钮级别的深度清理（图标名、命令、文件、URL 等字段）
		return validateAndCleanSettings(sanitized);
	}

	/**
	 * 加载设置
	 * 
	 * 对齐 custom-about-blank 的简洁模式：
	 * loadData → sanitizeSettingsShape 白名单清理 → 完成。
	 * 如果 data.json 损坏导致 loadData 失败，sanitizeSettingsShape 自动返回默认设置。
	 */
	async loadSettings() {
		let rawData: unknown = null;

		try {
			rawData = await this.loadData();
		} catch {
			// loadData() 内部 JSON.parse 失败（文件为空或截断），rawData 保持 null
		}

		// 处理旧版内联自定义图标迁移（仅在数据为有效对象时执行）
		if (isPlainObject(rawData)) {
			const { migratedData, didMigrateLegacyIcons } = await this.migrateLegacyCustomIcons(rawData);
			this.settings = this.sanitizeSettingsShape(migratedData);
			if (didMigrateLegacyIcons) {
				await this.saveData(this.settings);
			}
			return;
		}

		// 数据无效：sanitizeSettingsShape 返回默认设置
		this.settings = this.sanitizeSettingsShape(rawData);
	}

	/**
	 * 保存设置
	 * 
	 * 保存前始终通过 sanitizeSettingsShape 清理数据形状，
	 * 确保写入磁盘的数据永远合法。
	 * 对齐 custom-about-blank 的简洁模式：清理 → 写入，无额外队列。
	 */
	async saveSettings() {
		this.settings = this.sanitizeSettingsShape(this.settings);
		await this.saveData(this.settings);
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
