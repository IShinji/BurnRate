# BurnRate 使用指南

这是一个用于生成 GitHub Profile 统计卡片 (SVG) 的工具，专门为 `ccusage` 系列工具设计。

## 快速开始

### 🚀 一键同步（推荐）

你可以直接运行以下命令，它会自动完成 **数据导出 -> 卡片生成 -> GitHub 同步** 全过程，并自动解决可能的 Git 冲突：

```bash
bun run sync
```

### 逐步手动操作

### 1. 环境准备

确保你已经安装了 [Bun](https://bun.sh/)。

```bash
curl -fsSL https://bun.sh/install | bash
```

### 2. 导出数据

运行以下命令从本地 `ccusage` 相关工具导出数据：

```bash
bun run export:data
```

这会自动运行以下命令并将 JSON 结果存入 `data/` 目录：
- `ccusage daily --json`
- `@ccusage/codex daily --json`
- `@ccusage/opencode daily --json`
- `@ccusage/pi daily --json`
- `@ccusage/amp daily --json`

### 3. 生成卡片

运行以下命令生成 SVG 卡片：

```bash
bun run generate:card
```

生成的卡片将保存在 `assets/ccusage-card.svg`。

### 4. 在 GitHub 展示

在你的 GitHub Profile README 中添加以下代码（将 `<owner>` 替换为你的 GitHub 用户名）：

```markdown
![ccusage stats](https://raw.githubusercontent.com/<owner>/BurnRate/main/assets/ccusage-card.svg)
```

## 进阶配置

你可以通过环境变量调整导出行为：

- `CCUSAGE_SINCE`: 开始日期（如 `20260401`）
- `CCUSAGE_UNTIL`: 结束日期（如 `20260426`）
- `CCUSAGE_TIMEZONE`: 时区（默认 `UTC`）
- `CCUSAGE_LOCALE`: 语言/区域设置
- `CCUSAGE_MODE`: 成本模式

例如：
```bash
CCUSAGE_SINCE=20260401 bun run export:data
```

## 自动更新 (GitHub Actions)

该仓库包含 GitHub Actions，可以定期自动运行导出和生成流程。你只需要配置好相关的 Token（如果需要）并确保仓库有写权限。
