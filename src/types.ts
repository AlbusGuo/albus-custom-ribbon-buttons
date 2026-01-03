import { TFile } from 'obsidian';

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
}

/**
 * 内置按钮配置
 */
export interface BuiltInButton {
	/** 按钮ID */
	id: string;
	/** 提示文字 */
	tooltip: string;
	/** 图标名称 */
	icon: string;
	/** 点击回调 */
	onClick: () => void;
	/** 是否支持拖拽 */
	draggable: boolean;
}

/**
 * 拖拽状态
 */
export interface DragState {
	/** 是否正在拖拽 */
	isDragging: boolean;
	/** 拖拽源按钮ID */
	dragSource: string | null;
}