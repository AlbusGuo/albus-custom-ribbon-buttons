import { App, SuggestModal, setIcon, getIconIds } from 'obsidian';
import { CustomIconManager } from '../utils/customIconManager';
import { CustomIcon } from '../types';

/**
 * 图标选择器模态框
 */
export class IconSuggestModal extends SuggestModal<string> {
	private icons: string[];
	private onChoose: (iconName: string) => void;
	private customIconManager: CustomIconManager;
	private readonly CUSTOM_ICON_OPTION = '__custom_icon_upload__';
	private onAddCustomIcon?: (icons: CustomIcon[]) => Promise<void>;
	private onDeleteCustomIcon?: (iconId: string) => Promise<void>;

	constructor(
		app: App, 
		onChoose: (iconName: string) => void,
		onAddCustomIcon?: (icons: CustomIcon[]) => Promise<void>,
		onDeleteCustomIcon?: (iconId: string) => Promise<void>
	) {
		super(app);
		this.onChoose = onChoose;
		this.onAddCustomIcon = onAddCustomIcon;
		this.onDeleteCustomIcon = onDeleteCustomIcon;
		this.customIconManager = CustomIconManager.getInstance();
		
		// 获取所有图标ID（内置 + 自定义）
		const builtInIcons = getIconIds();
		const customIcons = this.customIconManager.getAllIconIds();
		
		// 将自定义图标添加前缀以区分
		const customIconsWithPrefix = customIcons.map(id => `custom:${id}`);
		
		// 组合图标列表：自定义图标选项 + 自定义图标 + 内置图标
		this.icons = [this.CUSTOM_ICON_OPTION, ...customIconsWithPrefix, ...builtInIcons];
		
		this.setPlaceholder('搜索图标名称...');
	}

	getSuggestions(query: string): string[] {
		const lowerQuery = query.toLowerCase();
		
		// 如果没有查询，返回所有图标（自定义图标选项始终在最前）
		if (!lowerQuery) {
			return this.icons;
		}
		
		// 过滤图标，但自定义图标选项始终显示在顶部（如果匹配）
		const filtered = this.icons.filter(icon => {
			if (icon === this.CUSTOM_ICON_OPTION) {
				return '自定义图标'.includes(lowerQuery) || 'custom'.includes(lowerQuery);
			}
			return icon.toLowerCase().includes(lowerQuery);
		});
		
		return filtered;
	}

	renderSuggestion(icon: string, el: HTMLElement): void {
		el.classList.add('mod-complex');
		
		if (icon === this.CUSTOM_ICON_OPTION) {
			// 特殊渲染：自定义图标上传选项 - 完全与内置图标相同的结构
			el.createEl('div', { text: '自定义图标' });
			setIcon(el.createEl('div'), 'plus-circle');
		} else if (icon.startsWith('custom:')) {
			// 渲染自定义图标
			const iconId = icon.substring(7); // 移除 'custom:' 前缀
			el.createEl('div', { text: iconId + ' (自定义)' });
			const iconDiv = el.createEl('div');
			const rendered = this.customIconManager.renderIcon(iconId, iconDiv);
			if (!rendered) {
				setIcon(iconDiv, 'help-circle');
			}
		} else {
			// 渲染内置图标
			el.createEl('div', { text: icon });
			setIcon(el.createEl('div'), icon);
		}
	}

	onChooseSuggestion(icon: string, evt: MouseEvent | KeyboardEvent): void {
		if (icon === this.CUSTOM_ICON_OPTION) {
			// 打开自定义图标管理模态框
			this.close();
			
			if (!this.onAddCustomIcon) {
				console.warn('未提供自定义图标保存回调');
				return;
			}
			
			// 延迟打开，避免模态框冲突
			setTimeout(() => {
				import('./customIconManagerModal').then(({ CustomIconManagerModal }) => {
					new CustomIconManagerModal(
						this.app,
						(selectedIcon: string) => {
							// 选择自定义图标回调
							this.onChoose(`custom:${selectedIcon}`);
						},
						this.onAddCustomIcon || (async () => {
							console.warn('未提供添加图标回调');
						}),
						this.onDeleteCustomIcon || (async (id: string) => {
							// 如果没有提供删除回调，只从管理器中删除
							this.customIconManager.removeIcon(id);
						}),
						() => {
							// 更新回调 - 重新加载图标列表
							const builtInIcons = getIconIds();
							const customIcons = this.customIconManager.getAllIconIds();
							const customIconsWithPrefix = customIcons.map(id => `custom:${id}`);
							this.icons = [this.CUSTOM_ICON_OPTION, ...customIconsWithPrefix, ...builtInIcons];
						}
					).open();
				});
			}, 100);
		} else if (icon.startsWith('custom:')) {
			// 选择自定义图标
			const iconId = icon.substring(7);
			this.onChoose(`custom:${iconId}`);
		} else {
			// 选择内置图标
			this.onChoose(icon);
		}
	}
}
