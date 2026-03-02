import { CustomIcon } from '../types';

/**
 * 自定义图标管理器
 * 负责注册、获取和渲染自定义SVG图标
 */
export class CustomIconManager {
	private static instance: CustomIconManager;
	private customIcons: Map<string, string> = new Map();

	private constructor() {}

	/**
	 * 获取单例实例
	 */
	static getInstance(): CustomIconManager {
		if (!CustomIconManager.instance) {
			CustomIconManager.instance = new CustomIconManager();
		}
		return CustomIconManager.instance;
	}

	/**
	 * 加载自定义图标列表
	 */
	loadIcons(icons: CustomIcon[]): void {
		this.customIcons.clear();
		icons.forEach(icon => {
			this.customIcons.set(icon.id, icon.content);
		});
	}

	/**
	 * 添加单个自定义图标
	 */
	addIcon(id: string, content: string): void {
		this.customIcons.set(id, content);
	}

	/**
	 * 删除自定义图标
	 */
	removeIcon(id: string): void {
		this.customIcons.delete(id);
	}

	/**
	 * 检查图标是否存在
	 */
	hasIcon(id: string): boolean {
		return this.customIcons.has(id);
	}

	/**
	 * 获取图标内容
	 */
	getIconContent(id: string): string | undefined {
		return this.customIcons.get(id);
	}

	/**
	 * 获取所有自定义图标ID
	 */
	getAllIconIds(): string[] {
		return Array.from(this.customIcons.keys());
	}

	/**
	 * 获取所有自定义图标
	 */
	getAllIcons(): CustomIcon[] {
		return Array.from(this.customIcons.entries()).map(([id, content]) => ({
			id,
			content
		}));
	}

	/**
	 * 渲染自定义图标到DOM元素
	 */
	renderIcon(iconId: string, containerEl: HTMLElement): boolean {
		const content = this.customIcons.get(iconId);
		if (!content) {
			return false;
		}

		try {
			containerEl.empty();
			
			// 使用 DOMParser 安全解析 SVG，避免 innerHTML 的安全风险
			const parser = new DOMParser();
			const doc = parser.parseFromString(content, 'image/svg+xml');
			const svgEl = doc.querySelector('svg');
			
			if (!svgEl) {
				return false;
			}
			
			// 导入 SVG 节点到当前文档
			const importedSvg = document.importNode(svgEl, true) as SVGElement;
			
			// 通过 CSS 类控制尺寸，避免硬编码样式
			importedSvg.classList.add('custom-icon-svg');
			
			if (!importedSvg.hasAttribute('viewBox')) {
				// 如果没有viewBox，尝试从width/height推断
				const width = importedSvg.getAttribute('width');
				const height = importedSvg.getAttribute('height');
				if (width && height) {
					importedSvg.setAttribute('viewBox', `0 0 ${width} ${height}`);
				} else {
					// 默认viewBox
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
	 * 清除所有自定义图标
	 */
	clear(): void {
		this.customIcons.clear();
	}
}
