# AmbientCard

> Ambient knowledge cards for Windows desktop. Let words stay in sight without interrupting your work.

[![GitHub stars](https://img.shields.io/github/stars/cihebi2/AmbientCard?style=social)](https://github.com/cihebi2/AmbientCard/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/cihebi2/AmbientCard?style=social)](https://github.com/cihebi2/AmbientCard/network)
[![Version](https://img.shields.io/badge/version-0.2.0-orange)](https://github.com/cihebi2/AmbientCard/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[English](./README.md) | [中文](./README.zh.md)

---

## What It Is

AmbientCard is a Windows desktop app built with Tauri that shows small translucent learning cards on your desktop. It is designed for low-friction memory reinforcement:

- not a popup storm
- not a full learning platform
- not a forced-focus app
- just lightweight cards that stay near the edge of attention

The current product focus is English vocabulary, but the card model is intentionally moving toward broader knowledge-card use cases.

## Release Notes

### v0.2.0

This release turns AmbientCard from a prototype into a usable desktop vocabulary tool.

- compact desktop card layout with direct drag support
- right-click card to open settings
- improved settings window with native-style custom title bar
- built-in review actions: `Again` / `Hard` / `Good`
- support for CSV/TSV import and one-click ECDICT mini import
- reveal modes for memory rhythm: `always` / `recall` / `test`
- opacity, interval, position, and launch behavior can sync live
- tray behavior and settings-window reopening logic are more stable

### Versioning Policy

- current public release: `v0.2.0`
- unless otherwise specified, the next release line starts from `v0.2.1`

## Core Features

- translucent desktop overlay card
- manual drag or preset positions: top-right / center-right / bottom-right
- adjustable display interval
- adjustable opacity
- local spaced-repetition review state
- custom vocabulary import
- system tray resident behavior
- optional launch-on-startup setting
- local-only storage

## Tech Stack

- Tauri 2
- Rust
- React 19
- TypeScript 5.9
- Tailwind CSS 4
- Vite 7

## Development

```bash
pnpm install
pnpm tauri dev
```

## Build

```bash
pnpm build
pnpm tauri build
```

## CSV Format

```csv
word,phonetic,meaning,note
serendipity,/ˌserənˈdɪpəti/,the occurrence of finding valuable things by chance,The word itself feels lucky
eloquent,/ˈeləkwənt/,fluent and persuasive in speaking or writing,Think of a powerful speech
```

## Roadmap Direction

AmbientCard starts with vocabulary, but the product direction is broader than words alone. Future card types may include:

- phrases
- formulas
- code snippets
- historical facts
- domain-specific flash knowledge

---

<p align="center">
  <i>Let knowledge linger, not interrupt.</i>
</p>
