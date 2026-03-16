# 知栖 · AmbientCard

> 桌面环境化单词卡片。让单词在注意力的边缘自然逗留。

[![GitHub stars](https://img.shields.io/github/stars/cihebi2/AmbientCard?style=social)](https://github.com/cihebi2/AmbientCard/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/cihebi2/AmbientCard?style=social)](https://github.com/cihebi2/AmbientCard/network)
[![Version](https://img.shields.io/badge/version-0.1.0-orange)](https://github.com/cihebi2/AmbientCard/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[![Star History Chart](https://api.star-history.com/svg?repos=cihebi2/AmbientCard&type=Date)](https://star-history.com/#cihebi2/AmbientCard&Date)

[English](./README.md) | [中文](#知栖)

---

## 知栖

**知栖**（AmbientCard）是一款 Windows 桌面环境化单词学习工具。它不是弹窗通知，也不是沉重的学习平台，而是在桌面边缘显示半透明的单词卡片——温和、持久、当你的注意力漂移时，它总在那里。

### 理念

- **不是通知** —— 没有声音，没有跳动图标，没有紧迫感
- **不是平台** —— 没有课程，没有进度条，没有压力
- **只是环境** —— 单词安静地存在于你的环境中，当你瞥见时，它就在那里

> 💡 *学习单词的最佳时机，是你没有在刻意学习的时候。*

### 当前专注：单词学习

本项目目前**专注于单词学习**。我们相信先把一件事做好，再考虑扩展。

| 状态 | 知识类型 | 说明 |
|------|---------|------|
| ✅ **进行中** | **单词** | 英文单词，含释义、音标、笔记 |
| 📝 计划中 | 代码片段 | 常用语法速查 |
| 📝 计划中 | 公式 | 数学物理常数 |
| 📝 计划中 | 历史 | 关键日期与事件 |
| 📝 计划中 | 短语 | 多语言表达 |

### 功能

- 🪟 **半透明悬浮卡片**，浮于桌面之上
- 📍 **位置预设**：右上 / 右中 / 右下，或直接拖拽
- ⏱️ **可调轮播间隔**：10秒–3分钟
- 🌓 **透明度控制**：25%–100%
- 🔌 **系统托盘常驻**，支持开机自启
- 📚 **内置起步词库** + CSV/TSV 导入 + ECDICT 开源词典
- 🔄 **间隔重复算法**，三档评分：*忘了* / *模糊* / *认识*
- 📊 **纯本地存储** —— 你的数据只存在于你的机器

### 技术栈

- Tauri 2 + Rust（后端）
- React 19 + TypeScript 5.9（前端）
- Tailwind CSS 4（样式）
- Vite 7（构建）

### 开发

```bash
pnpm install
pnpm tauri dev
```

### 构建

```bash
pnpm build
pnpm tauri build
```

### CSV 格式

导入你自己的单词表：

```csv
word,phonetic,meaning,note
serendipity,/ˌserənˈdɪpəti/,意外发现珍奇事物的运气,这个词本身就是一次意外发现
eloquent,/ˈeləkwənt/,雄辩的；有说服力的,想想马丁·路德·金
```

---

## 为什么叫"知栖"？

**知** —— 知识、知晓  
**栖** —— 栖息、逗留

知栖，意为**知识栖息之地**。我们不追求灌输，而是让知识像小鸟一样，安静地栖息在你的桌面角落，等待被你瞥见的那一刻。

---

<p align="center">
  <i>让知识逗留，而非打断。</i>
</p>

<p align="center">
  <a href="https://github.com/cihebi2/AmbientCard">⭐ 在 GitHub 上给我们点星</a>
</p>
