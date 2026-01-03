import { App, SuggestModal, setIcon, getIconIds } from 'obsidian';

/**
 * 图标选择器模态框
 */
export class IconSuggestModal extends SuggestModal<string> {
	private icons: string[];
	private onChoose: (iconName: string) => void;

	constructor(app: App, onChoose: (iconName: string) => void) {
		super(app);
		this.onChoose = onChoose;
		this.icons = getIconIds();
		this.setPlaceholder('搜索图标名称...');
	}

	getSuggestions(query: string): string[] {
		const lowerQuery = query.toLowerCase();
		return this.icons.filter(icon => 
			icon.toLowerCase().includes(lowerQuery)
		);
	}

	renderSuggestion(icon: string, el: HTMLElement): void {
		el.classList.add('mod-complex');
		el.createEl('div', { text: icon });
		setIcon(el.createEl('div'), icon);
	}

	onChooseSuggestion(icon: string, evt: MouseEvent | KeyboardEvent): void {
		this.onChoose(icon);
	}
}
