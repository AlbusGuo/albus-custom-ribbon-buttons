import { App, SuggestModal, setIcon, getIconIds } from 'obsidian';
import { CustomIconManager } from '../utils/customIconManager';

interface IconSuggestionItem {
	value: string;
	label: string;
}

/**
 * 图标选择器模态框
 */
export class IconSuggestModal extends SuggestModal<IconSuggestionItem> {
	private icons: IconSuggestionItem[];
	private onChoose: (iconName: string) => void;
	private customIconManager: CustomIconManager;
	private masked: boolean;

	constructor(app: App, icons: string[], masked: boolean, onChoose: (iconName: string) => void) {
		super(app);
		this.onChoose = onChoose;
		this.customIconManager = CustomIconManager.getInstance();
		this.masked = masked;
		this.icons = icons.map((icon) => ({
			value: icon,
			label: this.customIconManager.isCustomIcon(icon) ? this.customIconManager.getDisplayName(icon) : icon
		}));
		
		this.setPlaceholder('搜索图标名称...');
	}

	static async create(app: App, iconFolder: string, masked: boolean, onChoose: (iconName: string) => void): Promise<IconSuggestModal> {
		const customIconManager = CustomIconManager.getInstance(app);
		const customIcons = await customIconManager.getIconsFromFolder(iconFolder);
		return new IconSuggestModal(app, [...customIcons, ...getIconIds()], masked, onChoose);
	}

	getSuggestions(query: string): IconSuggestionItem[] {
		const lowerQuery = query.toLowerCase();

		if (!lowerQuery) {
			return this.icons;
		}

		const splitQueries = lowerQuery.trim().split(' ').filter(Boolean);
		return this.icons.filter((icon) => splitQueries.every((keyword) => icon.label.toLowerCase().includes(keyword)));
	}

	renderSuggestion(icon: IconSuggestionItem, el: HTMLElement): void {
		el.classList.add('mod-complex');
		el.createEl('div', { text: icon.label });

		const previewEl = el.createEl('div');
		if (this.customIconManager.isCustomIcon(icon.value)) {
			void this.customIconManager.renderIcon(icon.value, previewEl, this.masked).then((rendered) => {
				if (!rendered) {
					setIcon(previewEl, 'help-circle');
				}
			});
		} else {
			setIcon(previewEl, icon.value);
		}
	}

	onChooseSuggestion(icon: IconSuggestionItem, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(icon.value);
	}
}
