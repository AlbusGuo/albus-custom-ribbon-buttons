import { App, TFile, setIcon } from 'obsidian';
import { CustomButton, ButtonItem, DividerItem } from '../types';
import { CustomIconManager } from './customIconManager';

/**
 * 内置按钮配置
 */
interface BuiltInButton {
	id: string;
	tooltip: string;
	icon: string;
	onClick: () => void;
	draggable: boolean;
}

/**
 * 拖拽状态
 */
interface DragState {
	isDragging: boolean;
	dragSource: string | null;
}

/**
 * 按钮管理器类
 * 负责管理所有按钮的创建、销毁和交互
 */
export class ButtonManager {
	private ribbonMap = new Map<string, HTMLElement>();
	private dragState: DragState = {
		isDragging: false,
		dragSource: null
	};
	// 跟踪每个按钮的图标切换状态：true表示显示切换图标，false表示显示主图标
	private toggleStates = new Map<string, boolean>();
	// 存储按钮配置
	private buttonConfigs = new Map<string, CustomButton>();
	// 自定义图标管理器
	private customIconManager: CustomIconManager;

	constructor(
		private app: App,
		private onSettingsChange: () => void,
		private onReorderButtons: (sourceIndex: number, targetIndex: number) => void
	) {
		this.customIconManager = CustomIconManager.getInstance();
	}

	/**
	 * 初始化所有按钮
	 */
	initVaultButtons(buttonItems: ButtonItem[], hideBuiltInButtons: boolean = true) {
		// 获取 ribbon 容器引用，用于批量 DOM 更新
		// @ts-ignore
		const leftRibbon = this.app.workspace.leftRibbon;
		const ribbonActionsEl = (leftRibbon as any)?.ribbonActionsEl as HTMLElement | undefined;

		// 在创建按钮前暂时隐藏容器，防止逐个插入导致多次布局重排
		if (ribbonActionsEl) {
			ribbonActionsEl.style.display = 'none';
		}

		this.clearAllButtons();
		this.initButtonItems(buttonItems);
		if (hideBuiltInButtons) {
			this.initBuiltInButtons();
		}

		// 恢复显示 — 浏览器只做一次布局计算，完全消除中间状态
		if (ribbonActionsEl) {
			ribbonActionsEl.style.display = '';
		}
	}

	/**
	 * 清除所有按钮
	 */
	private clearAllButtons() {
		this.ribbonMap.forEach((value) => {
			if (value && value.parentElement) {
				value.remove();
			}
		});
		this.ribbonMap.clear();
		this.toggleStates.clear();
		this.buttonConfigs.clear();
	}

	/**
	 * 初始化按钮项（包含按钮和分割线）
	 */
	private initButtonItems(buttonItems: ButtonItem[]) {
		buttonItems.forEach((item, index) => {
			if (item.type === 'divider') {
				this.createDivider(item as DividerItem, index);
			} else {
				this.createCustomButton(item as CustomButton, index);
			}
		});
	}

	/**
	 * 初始化内置按钮
	 */
	private initBuiltInButtons() {
		const builtInButtons: BuiltInButton[] = [
			{
				id: 'vault',
				tooltip: '切换库',
				icon: 'vault',
				onClick: () => this.showVaultChooser(),
				draggable: false
			},
			{
				id: 'help',
				tooltip: '帮助',
				icon: 'help',
				onClick: () => this.showHelp(),
				draggable: false
			},
			{
				id: 'settings',
				tooltip: '设置',
				icon: 'lucide-settings',
				onClick: () => this.showSettings(),
				draggable: false
			}
		];

		builtInButtons.forEach((button) => {
			this.createRibbonButton(button.id, button.tooltip, button.icon, button.onClick, button.draggable);
		});
	}

	/**
	 * 创建自定义按钮
	 */
	createCustomButton(button: CustomButton, index: number) {
		const buttonId = `custom-${index}`;
		
		// 存储按钮配置
		this.buttonConfigs.set(buttonId, button);
		
		// 从settings恢复图标状态，默认为false（显示主图标）
		const savedState = button.iconState || false;
		this.toggleStates.set(buttonId, savedState);
		
		// 根据保存的状态选择初始图标
		const initialIcon = savedState ? (button.toggleIcon || button.icon) : button.icon;
		
		const onClick = () => {
			// 先切换图标
			this.toggleButtonIcon(buttonId);
			
			// 然后执行按钮的功能
			this.handleButtonClick(button);
		};

		return this.createRibbonButton(buttonId, button.tooltip, initialIcon, onClick, true, index);
	}

	/**
	 * 创建分割线
	 */
	private createDivider(divider: DividerItem, index: number) {
		try {
			// @ts-ignore
			const leftRibbon = this.app.workspace.leftRibbon;
			
			// 创建分割线元素
			const dividerEl = document.createElement('div');
			dividerEl.className = 'custom-ribbon-divider';
			
			// 存储数组索引信息
			dividerEl.dataset.arrayIndex = index.toString();
			
			// 添加拖拽功能
			this.makeDividerDraggable(dividerEl, divider.id, index);
			
			// 添加到缎带
			const ribbonContainer = leftRibbon as any;
			if (ribbonContainer.ribbonActionsEl) {
				ribbonContainer.ribbonActionsEl.appendChild(dividerEl);
			} else if (ribbonContainer.ribbonSettingEl) {
				ribbonContainer.ribbonSettingEl.appendChild(dividerEl);
			} else {
				// 尝试找到正确的容器
				const container = (ribbonContainer as any).children?.[0] || ribbonContainer;
				container.appendChild(dividerEl);
			}
			this.ribbonMap.set(divider.id, dividerEl);
			
			return dividerEl;
		} catch {
			const fallbackEl = document.createElement('div');
			fallbackEl.classList.add('custom-ribbon-hidden');
			return fallbackEl;
		}
	}

	/**
	 * 处理按钮点击事件
	 */
	private handleButtonClick(button: CustomButton) {
		switch (button.type) {
			case 'command':
				if (button.command) {
					this.executeCommand(button.command);
				}
				break;
			case 'file':
				if (button.file) {
					this.openFile(button.file);
				}
				break;
			case 'url':
				if (button.url) {
					window.open(button.url, '_blank');
				}
				break;
		}
	}

	/**
	 * 切换按钮图标
	 */
	private toggleButtonIcon(buttonId: string) {
		const buttonEl = this.ribbonMap.get(buttonId);
		const buttonConfig = this.buttonConfigs.get(buttonId);
		
		if (!buttonEl || !buttonConfig) return;

		// 获取当前切换状态
		const currentState = this.toggleStates.get(buttonId) || false;
		// 切换状态
		const newState = !currentState;
		this.toggleStates.set(buttonId, newState);
		
		// 保存状态到按钮配置
		buttonConfig.iconState = newState;
		// 触发设置保存
		this.onSettingsChange();

		// 根据新状态选择图标
		const newIcon = newState ? (buttonConfig.toggleIcon || buttonConfig.icon) : buttonConfig.icon;

		// 直接查找并更新 SVG 元素
		const svgEl = buttonEl.querySelector('svg');
		if (svgEl) {
			// 移除旧的 SVG
			svgEl.remove();
		}
		
		// 使用辅助方法设置图标（支持自定义图标）
		this.setButtonIcon(buttonEl, newIcon);
	}

	/**
	 * 设置按钮图标（支持自定义图标）
	 */
	private setButtonIcon(buttonEl: HTMLElement, iconName: string) {
		// 清空现有图标
		const existingSvg = buttonEl.querySelector('svg');
		if (existingSvg) {
			existingSvg.remove();
		}
		
		// 检查是否是自定义图标
		if (iconName && iconName.startsWith('custom:')) {
			const customIconId = iconName.substring(7);
			const rendered = this.customIconManager.renderIcon(customIconId, buttonEl);
			if (!rendered) {
				// 如果渲染失败，使用默认图标
				setIcon(buttonEl, 'help-circle');
			}
		} else {
			// 使用内置图标
			setIcon(buttonEl, iconName);
		}
	}

	/**
	 * 打开文件
	 */
	private openFile(filePath: string) {
		const file = this.app.vault.getAbstractFileByPath(filePath);
		if (file && file instanceof TFile) {
			const leaf = this.app.workspace.getLeaf('tab');
			leaf.openFile(file);
		}
	}

	/**
	 * 创建缎带按钮
	 */
	private createRibbonButton(
		id: string,
		tooltip: string,
		icon: string,
		onClick: () => void,
		draggable = false,
		arrayIndex = -1
	): HTMLElement {
		try {
			// @ts-ignore
			const leftRibbon = this.app.workspace.leftRibbon;
			
			// 对于自定义图标，先创建一个占位图标
			let displayIcon = icon;
			if (icon && icon.startsWith('custom:')) {
				displayIcon = 'help-circle'; // 占位符
			}
			
			// @ts-ignore
			const button = leftRibbon.makeRibbonItemButton(displayIcon, tooltip, (e: MouseEvent) => {
				e.stopPropagation();
				onClick();
			});

			// 如果是自定义图标，替换为实际的自定义图标
			if (icon && icon.startsWith('custom:')) {
				this.setButtonIcon(button, icon);
			}

			// 存储数组索引信息
			if (arrayIndex >= 0) {
				button.dataset.arrayIndex = arrayIndex.toString();
			}

			if (draggable) {
				this.makeButtonDraggable(button, id);
			}

			this.ribbonMap.set(id, button);
			// 添加到缎带
			const ribbonContainer = leftRibbon as any;
			if (ribbonContainer.ribbonActionsEl) {
				ribbonContainer.ribbonActionsEl.appendChild(button);
			} else if (ribbonContainer.ribbonSettingEl) {
				ribbonContainer.ribbonSettingEl.appendChild(button);
			} else {
				// 尝试找到正确的容器
				const container = (ribbonContainer as any).children?.[0] || ribbonContainer;
				container.appendChild(button);
			}
			return button;
		} catch {
			const fallbackButton = document.createElement('div');
			fallbackButton.classList.add('custom-ribbon-hidden');
			return fallbackButton;
		}
	}

	/**
	 * 使按钮可拖拽
	 */
	private makeButtonDraggable(button: HTMLElement, buttonId: string) {
		button.setAttribute('draggable', 'true');
		button.classList.add('custom-ribbon-button');

		button.addEventListener('dragstart', (e) => {
			this.dragState.isDragging = true;
			this.dragState.dragSource = buttonId;
			button.classList.add('dragging');
			e.dataTransfer!.effectAllowed = 'move';
			e.dataTransfer!.setData('text/plain', buttonId);
		});

		button.addEventListener('dragend', (e) => {
			this.dragState.isDragging = false;
			this.dragState.dragSource = null;
			button.classList.remove('dragging');
			document.querySelectorAll('.custom-ribbon-button.drag-over').forEach(el => {
				(el as HTMLElement).classList.remove('drag-over');
			});
		});

		button.addEventListener('dragover', (e) => {
			if (this.dragState.isDragging && this.dragState.dragSource !== buttonId) {
				e.preventDefault();
				e.dataTransfer!.dropEffect = 'move';
				button.classList.add('drag-over');
			}
		});

		button.addEventListener('dragenter', (e) => {
			if (this.dragState.isDragging && this.dragState.dragSource !== buttonId) {
				e.preventDefault();
				button.classList.add('drag-over');
			}
		});

		button.addEventListener('dragleave', (e) => {
			button.classList.remove('drag-over');
		});

		button.addEventListener('drop', (e) => {
			e.preventDefault();
			button.classList.remove('drag-over');

			if (this.dragState.isDragging && this.dragState.dragSource && this.dragState.dragSource !== buttonId) {
				this.handleReorderButtons(this.dragState.dragSource, buttonId);
			}
		});
	}

	/**
	 * 处理按钮重新排序
	 */
	private handleReorderButtons(sourceId: string, targetId: string) {
		// 通过存储的索引信息找到实际的数组索引
		const sourceElement = this.ribbonMap.get(sourceId);
		const targetElement = this.ribbonMap.get(targetId);
		
		if (!sourceElement || !targetElement) return;
		
		const sourceIndex = parseInt(sourceElement.dataset.arrayIndex || '-1');
		const targetIndex = parseInt(targetElement.dataset.arrayIndex || '-1');
		
		if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

		// 调用外部回调来处理数组重新排序
		this.onReorderButtons(sourceIndex, targetIndex);
	}

	/**
	 * 使分割线可拖拽
	 */
	private makeDividerDraggable(divider: HTMLElement, dividerId: string, arrayIndex: number) {
		divider.setAttribute('draggable', 'true');
		divider.classList.add('custom-ribbon-divider');

		divider.addEventListener('dragstart', (e) => {
			this.dragState.isDragging = true;
			this.dragState.dragSource = dividerId;
			divider.classList.add('dragging');
			e.dataTransfer!.effectAllowed = 'move';
			e.dataTransfer!.setData('text/plain', dividerId);
		});

		divider.addEventListener('dragend', (e) => {
			this.dragState.isDragging = false;
			this.dragState.dragSource = null;
			divider.classList.remove('dragging');
			document.querySelectorAll('.custom-ribbon-divider.drag-over').forEach(el => {
				(el as HTMLElement).classList.remove('drag-over');
			});
		});

		divider.addEventListener('dragover', (e) => {
			if (this.dragState.isDragging && this.dragState.dragSource !== dividerId) {
				e.preventDefault();
				e.dataTransfer!.dropEffect = 'move';
				divider.classList.add('drag-over');
			}
		});

		divider.addEventListener('dragenter', (e) => {
			if (this.dragState.isDragging && this.dragState.dragSource !== dividerId) {
				e.preventDefault();
				divider.classList.add('drag-over');
			}
		});

		divider.addEventListener('dragleave', (e) => {
			divider.classList.remove('drag-over');
		});

		divider.addEventListener('drop', (e) => {
			e.preventDefault();
			divider.classList.remove('drag-over');

			if (this.dragState.isDragging && this.dragState.dragSource && this.dragState.dragSource !== dividerId) {
				this.handleReorderDividers(this.dragState.dragSource, dividerId);
			}
		});
	}

	/**
	 * 处理分割线重新排序
	 */
	private handleReorderDividers(sourceId: string, targetId: string) {
		// 通过存储的索引信息找到实际的数组索引
		const sourceElement = this.ribbonMap.get(sourceId);
		const targetElement = this.ribbonMap.get(targetId);
		
		if (!sourceElement || !targetElement) return;
		
		const sourceIndex = parseInt(sourceElement.dataset.arrayIndex || '-1');
		const targetIndex = parseInt(targetElement.dataset.arrayIndex || '-1');
		
		if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return;

		// 调用外部回调来处理数组重新排序
		this.onReorderButtons(sourceIndex, targetIndex);
	}

	/**
	 * 执行命令
	 */
	private executeCommand(commandId: string) {
		try {
			// @ts-ignore
			this.app.commands.executeCommandById(commandId);
		} catch {
			// 命令执行失败，静默失败
		}
	}

	/**
	 * 显示库选择器
	 */
	private showVaultChooser() {
		try {
			// @ts-ignore
			this.app.openVaultChooser();
		} catch {
			// 库选择器打开失败，静默失败
		}
	}

	/**
	 * 显示帮助
	 */
	private showHelp() {
		try {
			// @ts-ignore
			this.app.openHelp();
		} catch {
			// 帮助打开失败，静默失败
		}
	}

	/**
	 * 显示设置
	 */
	private showSettings() {
		try {
			// @ts-ignore
			this.app.setting.open();
		} catch {
			// 设置打开失败，静默失败
		}
	}

	/**
	 * 应用样式设置 - 通过切换 body 类来控制 CSS 可见性
	 */
	applyStyleSettings(hideBuiltInButtons: boolean = true) {
		if (hideBuiltInButtons) {
			document.body.classList.remove('crb-show-builtin');
		} else {
			document.body.classList.add('crb-show-builtin');
		}
	}

	/**
	 * 应用默认功能区样式设置 - 通过切换 body 类来控制 CSS 可见性
	 */
	applyDefaultActionsStyle(hideDefaultActions: boolean = false) {
		if (hideDefaultActions) {
			document.body.classList.add('crb-hide-default-actions');
		} else {
			document.body.classList.remove('crb-hide-default-actions');
		}
	}

	/**
	 * 清理资源
	 */
	destroy() {
		this.clearAllButtons();
		document.body.classList.remove('crb-show-builtin');
		document.body.classList.remove('crb-hide-default-actions');
	}
}