# AmbientCard · 知栖

> Ambient knowledge cards for desktop. 让知识像环境光一样自然环绕。

[English](#english) | [中文](#中文)

---

<a name="english"></a>
## English

**AmbientCard** is a Windows desktop application for ambient, peripheral learning. Instead of intrusive popups or heavy learning platforms, it displays translucent knowledge cards at the edge of your screen—gentle, persistent, and always there when your attention drifts.

### Philosophy

- **Not a notification** – No sounds, no bouncing icons, no urgency
- **Not a platform** – No courses, no progress bars, no pressure
- **Just ambient** – Knowledge that exists quietly in your environment, ready when you glance

### Current Features

- 🪟 **Translucent overlay cards** that float on your desktop
- 📍 **Position presets**: top-right / center-right / bottom-right, or drag manually
- ⏱️ **Adjustable cycle**: 10s–3min per card
- 🌓 **Opacity control**: 25%–100%
- 🔌 **System tray resident** with autostart option
- 📚 **Built-in starter library** + CSV/TSV import
- 🔄 **Spaced repetition** with three simple ratings: *Again* / *Hard* / *Good*
- 📊 **Local-only storage** – your data stays on your machine

### Tech Stack

- Tauri 2 + Rust (backend)
- React 19 + TypeScript 5.9 (frontend)
- Tailwind CSS 4 (styling)
- Vite 7 (build)

### Development

```bash
pnpm install
pnpm tauri dev
```

### Build

```bash
pnpm build
pnpm tauri build
```

---

<a name="中文"></a>
## 中文

**知栖**（AmbientCard）是一款 Windows 桌面环境化学习工具。它不是弹窗通知，也不是沉重的学习平台，而是在桌面边缘显示半透明的知识卡片——温和、持久、当你的注意力漂移时，它总在那里。

### 理念

- **不是通知** —— 没有声音，没有跳动图标，没有紧迫感
- **不是平台** —— 没有课程，没有进度条，没有压力
- **只是环境** —— 知识安静地存在于你的环境中，当你瞥见时，它就在那里

### 当前功能

- 🪟 **半透明悬浮卡片**，浮于桌面之上
- 📍 **位置预设**：右上 / 右中 / 右下，或直接拖拽
- ⏱️ **可调轮播间隔**：10秒–3分钟
- 🌓 **透明度控制**：25%–100%
- 🔌 **系统托盘常驻**，支持开机自启
- 📚 **内置起步词库** + CSV/TSV 导入
- 🔄 **间隔重复算法**，三档评分：*忘了* / *模糊* / *认识*
- 📊 **纯本地存储** —— 你的数据只存在于你的机器

### 未来方向

从单词出发，扩展到更多知识类型：

- **知栖·码** —— 代码片段、算法、正则表达式
- **知栖·式** —— 数学公式、物理常数
- **知栖·史** —— 历史事件、人物、年份
- **知栖·语** —— 多语言实用句子
- **知栖·令** —— 命令行备忘、快捷键

任何值得反复瞥见的知识，都可以栖息在你的桌面边缘。

---

## Screenshots

*（设置界面预览）*

*（桌面卡片预览）*

---

## License

MIT License — feel free to use, modify, and share.

---

<p align="center">
  <i>Let knowledge linger, not interrupt.</i><br>
  <i>让知识逗留，而非打断。</i>
</p>
