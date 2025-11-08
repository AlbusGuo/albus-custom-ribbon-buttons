import { App, FuzzySuggestModal, setIcon, FuzzyMatch, getIconIds } from 'obsidian';

/**
 * 图标信息接口
 */
interface IconInfo {
	name: string;
	displayName: string;
}

/**
 * 图标建议模态框
 */
export class IconSuggestModal extends FuzzySuggestModal<IconInfo> {
	private onChoose: (iconName: string) => void;

	constructor(app: App, onChoose: (iconName: string) => void) {
		super(app);
		this.onChoose = onChoose;
		this.setPlaceholder('搜索图标名称...');
	}

	getItems(): IconInfo[] {
		// 使用 Obsidian 内置 API 获取所有可用图标
		const iconIds = getIconIds();
		return iconIds.map(name => ({
			name,
			displayName: this.formatIconName(name)
		}));
	}

	getItemText(icon: IconInfo): string {
		return icon.displayName;
	}

	/**
	 * 格式化图标名称，将连字符替换为空格并首字母大写
	 */
	private formatIconName(name: string): string {
		return name
			.split('-')
			.map(word => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' ');
	}

	/**
	 * 渲染单个图标项，包含图标预览
	 */
	renderSuggestion(match: FuzzyMatch<IconInfo>, el: HTMLElement): void {
		const icon = match.item;
		const container = el.createDiv({ cls: 'icon-suggest-item' });
		
		// 图标预览
		const iconContainer = container.createDiv({ cls: 'icon-suggest-icon' });
		try {
			setIcon(iconContainer, icon.name);
		} catch (error) {
			// 如果图标不存在，显示占位符
			iconContainer.setText('?');
		}
		
		// 文本容器（包含名称和ID，水平布局）
		const textContainer = container.createDiv({ cls: 'icon-suggest-text' });
		
		// 图标显示名称（左侧）
		textContainer.createDiv({ 
			cls: 'icon-suggest-name',
			text: icon.displayName 
		});
		
		// 图标ID（右侧）
		textContainer.createDiv({ 
			cls: 'icon-suggest-id',
			text: icon.name 
		});
	}

	onChooseItem(icon: IconInfo, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(icon.name);
	}
}
