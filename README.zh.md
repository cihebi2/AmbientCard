# AmbientCard · 知栖

> 面向 Windows 桌面的环境式知识卡片工具。让单词停留在视线边缘，而不是打断你的工作流。

[![GitHub stars](https://img.shields.io/github/stars/cihebi2/AmbientCard?style=social)](https://github.com/cihebi2/AmbientCard/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/cihebi2/AmbientCard?style=social)](https://github.com/cihebi2/AmbientCard/network)
[![Version](https://img.shields.io/badge/version-0.2.0-orange)](https://github.com/cihebi2/AmbientCard/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](./README.md) | [中文](./README.zh.md)

---

## 这是什么

AmbientCard 是一个基于 Tauri 构建的 Windows 桌面应用。它会在桌面边缘显示小尺寸、半透明的学习卡片，用更轻的方式帮你做持续记忆强化。

它不是：

- 不是密集弹窗提醒
- 不是重型学习平台
- 不是强制专注软件

它更像是：

- 一张安静待在桌面上的知识卡
- 一种不打断工作的复习方式
- 一套可以逐步扩展的“桌面闪现记忆”载体

当前产品重点仍然是英语单词，但整体模型已经在往“通用知识卡片”方向演进。

## 发布说明

### v0.2.0

这一版把 AmbientCard 从演示原型推进到了可用版。

- 桌面卡片收敛为更紧凑的小尺寸形态
- 支持左键直接拖动卡片
- 支持右键卡片直接打开设置
- 设置窗口改成更接近原生软件的自定义标题栏样式
- 加入 `忘了` / `模糊` / `认识` 三档复习反馈
- 支持 CSV / TSV 导入词库
- 支持一键导入 ECDICT mini 词库
- 支持 `always` / `recall` / `test` 三种释义显示模式
- 透明度、显示间隔、显示位置、启动行为可以实时同步
- 托盘和设置窗口重开逻辑比前一版更稳定

### 版本策略

- 当前公开版本：`v0.2.0`
- 后续如无额外说明，统一从 `v0.2.1` 开始继续发布

## 当前功能

- 半透明桌面悬浮卡片
- 右上 / 右中 / 右下预设位置
- 支持手动拖动定位
- 卡片显示间隔可调
- 卡片透明度可调
- 本地化的轻量间隔复习
- 自定义词库导入
- 托盘常驻
- 开机启动设置
- 纯本地存储

## 技术栈

- Tauri 2
- Rust
- React 19
- TypeScript 5.9
- Tailwind CSS 4
- Vite 7

## 开发

```bash
pnpm install
pnpm tauri dev
```

## 构建

```bash
pnpm build
pnpm tauri build
```

## 词库导入格式

```csv
word,phonetic,meaning,note
serendipity,/ˌserənˈdɪpəti/,意外发现珍贵事物的运气,这个词本身就很有“幸运感”
eloquent,/ˈeləkwənt/,有说服力的；善于表达的,可以联想到一段有力量的演讲
```

## 后续方向

AmbientCard 不会只停留在“背单词卡片”。

后续可以扩展的卡片类型包括：

- 短语卡片
- 公式卡片
- 代码片段卡片
- 历史知识卡片
- 某个垂直领域的记忆卡片

---

<p align="center">
  <i>让知识停留，而不是打断。</i>
</p>
