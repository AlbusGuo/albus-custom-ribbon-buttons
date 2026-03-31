import { RibbonVaultButtonsSettings, CustomButton, DividerItem, ButtonItem } from './types';

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: RibbonVaultButtonsSettings = {
	leftRibbonItems: [],
	pageHeaderItems: [],
	iconFolder: '',
	iconMask: false,
	hideBuiltInButtons: true,
	hideDefaultActions: false,
	settingsTab: 'general'
};

function normalizeIconName(iconName: string): string {
	if (typeof iconName !== 'string' || iconName.length === 0) {
		return 'help-circle';
	}

	return iconName.startsWith('lucide-') ? iconName.slice(7) : iconName;
}

/**
 * 创建新的自定义按钮
 */
export function createCustomButton(): CustomButton {
	return {
		icon: 'plus',
		toggleIcon: 'plus',
		tooltip: '新按钮',
		type: 'command',
		command: '',
		file: '',
		url: '',
		commands: []
	};
}

/**
 * 创建新的分割线
 */
export function createDivider(): DividerItem {
	return {
		type: 'divider',
		id: `divider-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
	};
}

/**
 * 验证SVG内容
 */
export function isValidSvgContent(content: string): boolean {
	// 简单检查：包含<svg>标签且长度合理
	return content.includes('<svg') && content.includes('</svg>') && content.length > 10;
}

/**
 * 验证和清理设置
 */
export function validateAndCleanSettings(settings: RibbonVaultButtonsSettings): RibbonVaultButtonsSettings {
	const legacyItems = Array.isArray((settings as unknown as { buttonItems?: ButtonItem[] }).buttonItems)
		? (settings as unknown as { buttonItems: ButtonItem[] }).buttonItems
		: [];

	const leftRibbonItems = Array.isArray(settings.leftRibbonItems)
		? settings.leftRibbonItems
		: legacyItems;

	const cleaned: RibbonVaultButtonsSettings = {
		leftRibbonItems,
		pageHeaderItems: Array.isArray(settings.pageHeaderItems) ? settings.pageHeaderItems : DEFAULT_SETTINGS.pageHeaderItems,
		iconFolder: typeof settings.iconFolder === 'string' ? settings.iconFolder : DEFAULT_SETTINGS.iconFolder,
		iconMask: typeof settings.iconMask === 'boolean' ? settings.iconMask : DEFAULT_SETTINGS.iconMask,
		hideBuiltInButtons: typeof settings.hideBuiltInButtons === 'boolean' ? settings.hideBuiltInButtons : DEFAULT_SETTINGS.hideBuiltInButtons,
		hideDefaultActions: typeof settings.hideDefaultActions === 'boolean' ? settings.hideDefaultActions : DEFAULT_SETTINGS.hideDefaultActions,
		settingsTab: settings.settingsTab === 'left-ribbon' || settings.settingsTab === 'page-header' || settings.settingsTab === 'general'
			? settings.settingsTab
			: DEFAULT_SETTINGS.settingsTab
	};

	const normalizeButton = (item: CustomButton): CustomButton => ({
		...item,
		icon: normalizeIconName(item.icon),
		toggleIcon: normalizeIconName(item.toggleIcon || item.icon),
		command: typeof item.command === 'string' ? item.command : '',
		file: typeof item.file === 'string' ? item.file : '',
		url: typeof item.url === 'string' ? item.url : '',
		commands: Array.isArray(item.commands)
			? item.commands.filter((commandId) => typeof commandId === 'string')
			: []
	});

	cleaned.leftRibbonItems = cleaned.leftRibbonItems.map((item) => {
		if (item.type === 'divider') {
			return item;
		}

		return normalizeButton(item as CustomButton);
	});

	cleaned.pageHeaderItems = cleaned.pageHeaderItems
		.filter((item): item is CustomButton => !!item && (item as ButtonItem).type !== 'divider')
		.map((item) => normalizeButton(item));

	return cleaned;
}