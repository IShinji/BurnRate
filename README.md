# BurnRate (燃耗统计)

[English](#usage) | [中文说明](#中文说明) | [使用指南 (GUIDE)](./GUIDE.md)

Generate a GitHub profile SVG card from the ccusage family of local JSON exports.
从 ccusage 系列本地 JSON 导出数据生成 GitHub 个人主页 SVG 统计卡片。

---

### 🚀 One-Step Sync (Recommended)

Run everything (export, generate, and push) with a single command:

```bash
bun run sync
```

### Manual Steps

The exporter calls these commands and writes one JSON file per tool into `data/`:

```bash
bunx ccusage@latest daily --json
bunx @ccusage/codex@latest daily --json
bunx @ccusage/opencode@latest daily --json
bunx @ccusage/pi@latest daily --json
bunx @ccusage/amp@latest daily --json
```

Generate the card locally:

```bash
bun run generate:card
```

---

## 中文说明

### 🚀 一键同步（推荐）

使用一个命令完成所有操作（导出、生成并推送）：

```bash
bun run sync
```

### 分步手动操作

2. **生成卡片**:
   ```bash
   bun run generate:card
   ```
   这会根据导出的数据生成 `assets/ccusage-card.svg` 文件。

### 🔍 Analyzing Usage / 消耗分析

View a detailed report of your highest usage days and sessions:
查看你的消耗大户报告（单日或单次对话）：

```bash
bun run analyze
```

3. **详细配置**:
   请参考 [使用指南 (GUIDE.md)](./GUIDE.md) 查看环境变量和进阶用法。

```markdown
![ccusage stats](https://raw.githubusercontent.com/<你的用户名>/BurnRate/main/assets/ccusage-card.svg)
```

### ✨ Modern Analytics Features / 现代分析特性

- **Dynamic Precision**: Automatic precision scaling for Billion-scale data (e.g., `1.503B`).
- **Local Today Delta**: Real-time daily growth display based on your local timezone.
- **动态精度**: 针对 B 级数据自动调整小数点（如 `1.503B`），确保百万级更新可见。
- **本地增量**: 基于用户本地时区的每日增长实时展示（`+XX today`）。

## Options / 选项

Set environment variables before running the exporter:
在运行导出脚本前设置环境变量：

```bash
CCUSAGE_SINCE=20260401 CCUSAGE_TIMEZONE=UTC bun run sync
```

- `CCUSAGE_SINCE`: optional start date (e.g. `20260401`) / 可选开始日期
- `CCUSAGE_UNTIL`: optional end date (e.g. `20260426`) / 可选结束日期
- `CCUSAGE_TIMEZONE`: optional timezone / 可选时区
- `CCUSAGE_COMMIT=0`: export without committing / 导出但不提交
- `CCUSAGE_PUSH=0`: commit without pushing / 提交但不推送
