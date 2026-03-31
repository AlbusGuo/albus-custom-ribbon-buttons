import { App, normalizePath } from 'obsidian';
import { isValidSvgContent } from '../settings';

/**
 * 自定义图标管理器
 * 负责注册、获取和渲染自定义SVG图标
 */
export class CustomIconManager {
	static readonly FILE_PREFIX = 'custom-file:';
	private static instance: CustomIconManager;
	private app: App | null = null;
	private iconContentCache = new Map<string, string | null>();
	private pendingLoads = new Map<string, Promise<string | null>>();

	private constructor() {}

	/**
	 * 获取单例实例
	 */
	static getInstance(app?: App): CustomIconManager {
		if (!CustomIconManager.instance) {
			CustomIconManager.instance = new CustomIconManager();
		}

		if (app) {
			CustomIconManager.instance.app = app;
		}

		return CustomIconManager.instance;
	}

	/**
	 * 是否为文件自定义图标引用
	 */
	isCustomIcon(iconName: string): boolean {
		return typeof iconName === 'string' && iconName.startsWith(CustomIconManager.FILE_PREFIX);
	}

	/**
	 * 创建文件自定义图标引用
	 */
	createIconReference(filePath: string): string {
		return `${CustomIconManager.FILE_PREFIX}${normalizePath(filePath)}`;
	}

	/**
	 * 从图标引用中提取文件路径
	 */
	getFilePath(iconName: string): string | null {
		if (!this.isCustomIcon(iconName)) {
			return null;
		}

		return normalizePath(iconName.slice(CustomIconManager.FILE_PREFIX.length));
	}

	/**
	 * 获取图标显示名称
	 */
	getDisplayName(iconName: string): string {
		const filePath = this.getFilePath(iconName);
		if (!filePath) {
			return iconName;
		}

		const segments = filePath.split('/');
		return segments[segments.length - 1] || filePath;
	}

	/**
	 * 获取指定图标文件夹内的 SVG 图标引用
	 */
	async getIconsFromFolder(folderPath: string): Promise<string[]> {
		if (!folderPath || !this.app) {
			return [];
		}

		const normalizedFolderPath = normalizePath(folderPath).replace(/\/$/, '');
		try {
			const files = this.app.vault.getFiles();
			return files
				.filter((file) => {
					if (file.extension.toLowerCase() !== 'svg') {
						return false;
					}

					const normalizedFilePath = normalizePath(file.path);
					return normalizedFilePath.startsWith(`${normalizedFolderPath}/`);
				})
				.map((file) => this.createIconReference(file.path))
				.sort((left, right) => this.getDisplayName(left).localeCompare(this.getDisplayName(right), 'zh-CN'));
		} catch {
			return [];
		}
	}

	async preloadIcons(iconNames: string[]): Promise<void> {
		const uniqueIcons = Array.from(new Set(iconNames.filter((iconName) => this.isCustomIcon(iconName))));
		await Promise.all(uniqueIcons.map((iconName) => this.ensureIconContent(iconName)));
	}

	/**
	 * 从文件读取 SVG 内容
	 */
	private async readIconContent(iconName: string): Promise<string | null> {
		const filePath = this.getFilePath(iconName);
		if (!filePath || !this.app) {
			return null;
		}

		try {
			const content = await this.app.vault.adapter.read(filePath);
			return isValidSvgContent(content) ? content : null;
		} catch {
			return null;
		}
	}

	private async ensureIconContent(iconName: string): Promise<string | null> {
		if (this.iconContentCache.has(iconName)) {
			return this.iconContentCache.get(iconName) ?? null;
		}

		const pending = this.pendingLoads.get(iconName);
		if (pending) {
			return pending;
		}

		const loadPromise = this.readIconContent(iconName)
			.then((content) => {
				this.iconContentCache.set(iconName, content);
				this.pendingLoads.delete(iconName);
				return content;
			})
			.catch(() => {
				this.iconContentCache.set(iconName, null);
				this.pendingLoads.delete(iconName);
				return null;
			});

		this.pendingLoads.set(iconName, loadPromise);
		return loadPromise;
	}

	private toSvgDataUri(content: string): string {
		return `url("data:image/svg+xml;utf8,${encodeURIComponent(content)}")`;
	}

	private renderMaskedSvgContent(content: string, containerEl: HTMLElement): boolean {
		try {
			containerEl.empty();
			const maskEl = containerEl.createDiv({ cls: 'custom-icon-mask custom-icon-svg' });
			maskEl.style.setProperty('--custom-icon-image', this.toSvgDataUri(content));
			return true;
		} catch {
			return false;
		}
	}

	renderIconFromCache(iconName: string, containerEl: HTMLElement, masked = false): boolean {
		const content = this.iconContentCache.get(iconName);
		if (!content) {
			return false;
		}

		return masked
			? this.renderMaskedSvgContent(content, containerEl)
			: this.renderSvgContent(content, containerEl);
	}

	/**
	 * 渲染 SVG 内容到 DOM 元素
	 */
	private renderSvgContent(content: string, containerEl: HTMLElement): boolean {
		try {
			containerEl.empty();

			const parser = new DOMParser();
			const doc = parser.parseFromString(content, 'image/svg+xml');
			const svgEl = doc.querySelector('svg');

			if (!svgEl) {
				return false;
			}

			const importedSvg = document.importNode(svgEl, true) as SVGElement;
			importedSvg.classList.add('custom-icon-svg');

			if (!importedSvg.hasAttribute('viewBox')) {
				const width = importedSvg.getAttribute('width');
				const height = importedSvg.getAttribute('height');
				if (width && height) {
					importedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
				} else {
					importedSvg.setAttribute('viewBox', '0 0 24 24');
				}
			}

			containerEl.appendChild(importedSvg);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * 渲染自定义图标到DOM元素
	 */
	async renderIcon(iconName: string, containerEl: HTMLElement, masked = false): Promise<boolean> {
		if (this.renderIconFromCache(iconName, containerEl, masked)) {
			return true;
		}

		const content = await this.ensureIconContent(iconName);
		if (!content) {
			return false;
		}

		return masked
			? this.renderMaskedSvgContent(content, containerEl)
			: this.renderSvgContent(content, containerEl);
	}
}
