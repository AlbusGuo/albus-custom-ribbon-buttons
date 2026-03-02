/**
 * 自定义按钮类型
 */
export type ButtonType = 'command' | 'file' | 'url';

/**
 * 分割线配置
 */
export interface DividerItem {
	/** 类型标识 */
	type: 'divider';
	/** 分割线ID */
	id: string;
}

/**
 * 自定义按钮配置
 */
export interface CustomButton {
	/** 图标名称 */
	icon: string;
	/** 切换后的图标名称 */
	toggleIcon: string;
	/** 提示文字 */
	tooltip: string;
	/** 按钮类型 */
	type: ButtonType;
	/** 命令ID */
	command: string;
	/** 文件路径 */
	file: string;
	/** 网址 */
	url: string;
	/** 图标显示状态：true表示显示切换图标，false或undefined表示显示主图标 */
	iconState?: boolean;
}

/**
 * 按钮项类型（按钮或分割线）
 */
export type ButtonItem = CustomButton | DividerItem;

/**
 * 插件设置接口
 */
export interface RibbonVaultButtonsSettings {
	/** 按钮项列表（包含按钮和分割线） */
	buttonItems: ButtonItem[];
	/** 是否隐藏内置按钮 */
	hideBuiltInButtons: boolean;
	/** 是否隐藏默认功能区 */
	hideDefaultActions: boolean;
	/** 自定义图标库 */
	customIcons: CustomIcon[];
}

/**
 * 自定义图标
 */
export interface CustomIcon {
	/** 图标ID */
	id: string;
	/** SVG内容 */
	content: string;
}