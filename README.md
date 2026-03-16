# AmbientCard

> Ambient vocabulary cards for desktop. Let words linger at the edge of your attention.

[![GitHub stars](https://img.shields.io/github/stars/cihebi2/AmbientCard?style=social)](https://github.com/cihebi2/AmbientCard/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/cihebi2/AmbientCard?style=social)](https://github.com/cihebi2/AmbientCard/network)
[![Version](https://img.shields.io/badge/version-0.1.0-orange)](https://github.com/cihebi2/AmbientCard/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[![Star History Chart](https://api.star-history.com/svg?repos=cihebi2/AmbientCard&type=Date)](https://star-history.com/#cihebi2/AmbientCard&Date)

[English](#ambientcard) | [中文](./README.zh.md)

---

## AmbientCard

**AmbientCard** is a Windows desktop application for ambient, peripheral vocabulary learning. Instead of intrusive popups or heavy learning platforms, it displays translucent word cards at the edge of your screen—gentle, persistent, and always there when your attention drifts.

### Philosophy

- **Not a notification** – No sounds, no bouncing icons, no urgency
- **Not a platform** – No courses, no progress bars, no pressure
- **Just ambient** – Words that exist quietly in your environment, ready when you glance

> 💡 *The best time to learn a word is when you're not trying to.*

### Current Focus: Vocabulary

This project is currently **focused exclusively on vocabulary learning**. We believe in doing one thing well before expanding.

| Status | Knowledge Type | Description |
|--------|---------------|-------------|
| ✅ **Active** | **Vocabulary** | English words with definitions, phonetics, and notes |
| 📝 Planned | Code Snippets | Quick syntax references |
| 📝 Planned | Formulas | Math & physics constants |
| 📝 Planned | History | Key dates and events |
| 📝 Planned | Phrases | Multi-language expressions |

### Features

- 🪟 **Translucent overlay cards** that float on your desktop
- 📍 **Position presets**: top-right / center-right / bottom-right, or drag manually
- ⏱️ **Adjustable cycle**: 10s–3min per card
- 🌓 **Opacity control**: 25%–100%
- 🔌 **System tray resident** with autostart option
- 📚 **Built-in starter library** + CSV/TSV import + ECDICT integration
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

### CSV Format

Import your own word lists:

```csv
word,phonetic,meaning,note
serendipity,/ˌserənˈdɪpəti/,意外发现珍奇事物的运气,The word itself is a serendipity
eloquent,/ˈeləkwənt/,雄辩的；有说服力的,Think of Martin Luther King
```

---

## Why "Ambient"?

Ambient learning happens in the **periphery of attention**. You don't schedule it. You don't force it. You just let words exist in your environment, and your brain does the rest.

Studies show that repeated passive exposure aids retention. AmbientCard provides that repetition without the friction.

---

<p align="center">
  <i>Let knowledge linger, not interrupt.</i>
</p>

<p align="center">
  <a href="https://github.com/cihebi2/AmbientCard">⭐ Star us on GitHub</a>
</p>
