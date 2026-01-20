# Custom Ribbon Buttons - Obsidian 插件

![Obsidian Plugin](https://img.shields.io/badge/Obsidian-Plugin-blue?logo=obsidian)
![Version](https://img.shields.io/badge/Version-0.1.0-green)
![GitHub all releases](https://img.shields.io/github/downloads/AlbusGuo/albus-ribbon-vault-buttons/total)

一个重新设计 Obsidian 底部侧边栏按钮布局的插件，支持添加自定义功能按钮，让您的侧边栏更加个性化和实用。

## ✨ 特性功能

### 🔄 重新设计的按钮布局
- 将内置按钮重新排列到侧边栏底部
- 包含：切换深色/浅色模式、切换库、帮助、设置按钮
- 简洁统一的视觉设计

### 🎨 强大的自定义按钮系统
- **多种按钮类型**：
  - 📝 执行命令 - 运行任何 Obsidian 命令
  - 📄 打开文件 - 快速访问常用文件
  - 🌐 打开网址 - 一键跳转到外部链接
  
- **可视化图标选择器**：
  - 🎯 Lucide 图标实时预览
  - 📁 **自定义图标** - 支持从SVG文件导入自定义图标

- **灵活的配置**：
  - 个性化提示文字
  - 拖拽式排序
  - 紧凑的网格布局


## 📥 安装方法

1. 从 Releases 页面下载最新版本
2. 将文件解压到您的 vault 插件文件夹：`<vault>/.obsidian/plugins/albus-ribbon-vault-buttons/`
3. 重新加载 Obsidian
4. 在社区插件中启用插件

## 🚀 使用方法

### 添加自定义按钮

1. **打开设置界面**：
   - 进入 Obsidian 设置
   - 找到「Ribbon Vault Buttons」选项
   - 点击「添加新按钮」

2. **配置按钮**：
   
   **图标选择** 🎨
   - 点击图标按钮
   - 在弹出的选择器中浏览或搜索图标
   - 点击选择心仪的图标
   - 💡 **新功能**：列表最上方点击 "自定义图标" 可上传自己的SVG图标文件
     - 支持批量上传SVG文件
     - 支持移除已选文件
     - 详见 [自定义图标功能说明](CUSTOM_ICONS.md)
   
   **基本信息** 📝
   - 按钮名称：鼠标悬停时显示的提示文字
   - 例如："打开日记"、"项目看板"等
   
   **按钮类型** 🔧
   - **执行命令**：点击搜索框选择任意 Obsidian 命令
   - **打开文件**：点击搜索框选择库中的文件
   - **打开网址**：输入完整的 URL 地址

3. **调整顺序**：
   - 新按钮会添加到列表末尾
   - 在侧边栏中直接拖拽按钮即可重新排序
   - 内置按钮不支持拖拽

## 🎯 配置示例

### 快速访问日记
```
图标: 📅 (calendar)
名称: 今日日记
类型: 执行命令
命令: daily-notes:open-today-note
```

### 打开项目看板
```
图标: layout-dashboard
名称: 项目看板
类型: 打开文件
文件: Projects/Kanban.md
```

### 外部文档链接
```
图标: external-link
名称: 项目文档
类型: 打开网址
网址: https://your-project-docs.com
```

### 快捷搜索
```
图标: search
名称: 全局搜索
类型: 执行命令
命令: global-search:open
```


## 🐛 故障排除

### 常见问题

**按钮不显示**
- 确保图标被 obsidian 支持

**命令不执行**
- 确认命令可执行

**文件打不开**
- 确认文件路径正确且文件存在
- 检查文件是否被移动或重命名

### 获取帮助
- 查看控制台错误信息（Ctrl+Shift+I / Cmd+Option+I）
- 检查插件版本是否为最新
- 提交 Issue 时请附上错误截图和日志


## 🤝 贡献与反馈

欢迎提交 Issue 和 Pull Request！



## 🙏 致谢

感谢 Obsidian 社区的支持和反馈！
