# BurnRate (燃耗统计)

[English](#usage) | [中文说明](#中文说明) | [使用指南 (GUIDE)](./GUIDE.md)

Generate a GitHub profile SVG card from the ccusage family of local JSON exports.
从 ccusage 系列本地 JSON 导出数据生成 GitHub 个人主页 SVG 统计卡片。

---

## Usage

Run the local exporter from this repository:

```bash
bun run export:ccusage
```

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

### 使用方法

1. **导出数据**:
   ```bash
   bun run export:ccusage
   ```
   这会从你本地安装的 `ccusage` 工具中收集统计信息并存入 `data/` 目录。

2. **生成卡片**:
   ```bash
   bun run generate:card
   ```
   这会根据导出的数据生成 `assets/ccusage-card.svg` 文件。

3. **详细配置**:
   请参考 [使用指南 (GUIDE.md)](./GUIDE.md) 查看环境变量和进阶用法。

### 引用方式

将生成的卡片嵌入你的 GitHub Profile：

```markdown
![ccusage stats](https://raw.githubusercontent.com/<你的用户名>/BurnRate/main/assets/ccusage-card.svg)
```

## Options / 选项

Set environment variables before running the exporter:
在运行导出脚本前设置环境变量：

```bash
CCUSAGE_SINCE=20260401 CCUSAGE_TIMEZONE=UTC bun run export:ccusage
```

- `CCUSAGE_SINCE`: optional start date (e.g. `20260401`) / 可选开始日期
- `CCUSAGE_UNTIL`: optional end date (e.g. `20260426`) / 可选结束日期
- `CCUSAGE_TIMEZONE`: optional timezone / 可选时区
- `CCUSAGE_COMMIT=0`: export without committing / 导出但不提交
- `CCUSAGE_PUSH=0`: commit without pushing / 提交但不推送
