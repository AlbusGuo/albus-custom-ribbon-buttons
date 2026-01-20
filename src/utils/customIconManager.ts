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
			
			// 设置容器样式以居中图标
			containerEl.style.display = 'flex';
			containerEl.style.alignItems = 'center';
			containerEl.style.justifyContent = 'center';
			
			containerEl.innerHTML = content;
			
			// 确保SVG元素有正确的尺寸 - 与内置图标一致
			const svgEl = containerEl.querySelector('svg');
			if (svgEl) {
				// 设置固定尺寸，与 Obsidian 内置图标保持一致
				svgEl.style.width = '16px';
				svgEl.style.height = '16px';
				svgEl.style.display = 'block';
				
				if (!svgEl.hasAttribute('viewBox')) {
					// 如果没有viewBox，尝试从width/height推断
					const width = svgEl.getAttribute('width');
					const height = svgEl.getAttribute('height');
					if (width && height) {
						svgEl.setAttribute('viewBox', `0 0 ${width} ${height}`);
					} else {
						// 默认viewBox
						svgEl.setAttribute('viewBox', '0 0 24 24');
					}
				}
			}
			
			return true;
		} catch (error) {
			console.error(`渲染自定义图标失败: ${iconId}`, error);
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
