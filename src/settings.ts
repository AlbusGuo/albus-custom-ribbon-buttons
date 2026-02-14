import { RibbonVaultButtonsSettings, CustomButton, DividerItem } from './types';

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: RibbonVaultButtonsSettings = {
	buttonItems: [],
	hideBuiltInButtons: true,
	hideDefaultActions: false,
	customIcons: []
};

/**
 * 创建新的自定义按钮
 */
export function createCustomButton(): CustomButton {
	return {
		icon: 'lucide-plus',
		toggleIcon: 'lucide-plus',
		tooltip: '新按钮',
		type: 'command',
		command: 'app:open', // 使用一个默认的有效命令
		file: '',
		url: ''
	};
}

/**
 * 创建新的分割线
 */
export function createDivider(): DividerItem {
	return {
		type: 'divider',
		id: `divider-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
	};
}

/**
 * 验证自定义按钮配置
 */
export function validateCustomButton(button: CustomButton): boolean {
	if (!button.icon || !button.tooltip) {
		return false;
	}
	
	switch (button.type) {
		case 'command':
			return !!button.command;
		case 'file':
			return !!button.file;
		case 'url':
			return !!button.url && isValidUrl(button.url);
		default:
			return false;
	}
}

/**
 * 验证URL格式
 */
function isValidUrl(url: string): boolean {
	try {
		new URL(url);
		return true;
	} catch {
		return false;
	}
}

/**
 * 验证SVG内容
 */
function isValidSvg(content: string): boolean {
	// 简单检查：包含<svg>标签且长度合理
	return content.includes('<svg') && content.includes('</svg>') && content.length > 10;
}

/**
 * 验证和清理设置
 */
export function validateAndCleanSettings(settings: RibbonVaultButtonsSettings): RibbonVaultButtonsSettings {
	const cleaned = { ...settings };

	// 验证buttonItems
	cleaned.buttonItems = settings.buttonItems.filter(item => {
		if (item.type === 'divider') {
			return item.id && typeof item.id === 'string';
		} else {
			return validateCustomButton(item as CustomButton);
		}
	});

	// 验证customIcons
	cleaned.customIcons = settings.customIcons.filter(icon =>
		icon.id && typeof icon.id === 'string' &&
		icon.content && typeof icon.content === 'string' &&
		isValidSvg(icon.content)
	);

	// 确保其他字段是boolean
	cleaned.hideBuiltInButtons = typeof settings.hideBuiltInButtons === 'boolean' ? settings.hideBuiltInButtons : DEFAULT_SETTINGS.hideBuiltInButtons;
	cleaned.hideDefaultActions = typeof settings.hideDefaultActions === 'boolean' ? settings.hideDefaultActions : DEFAULT_SETTINGS.hideDefaultActions;

	return cleaned;
}