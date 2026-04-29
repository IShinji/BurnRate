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

生成后的卡片将展示总消耗量、工具/模型细分、以及趋势增长曲线。

## 🎨 UI 与数值特性

为了应对日益增长的数据量（尤其是进入 Billion 级别后），卡片具备以下特性：

- **动态精度 (Dynamic Precision)**：
  - 当数据 >= **1B** 时，自动保留 **3 位小数**（如 `1.503B`），确保 1M 级别的更新也能体现在总数上。
  - 当数据 >= **1M** 时，保留 **2 位小数**（如 `267.60M`）。
- **本地今日增量 (Local Today Delta)**：
  - 在总量下方会显示 `+XX today` 或 `+XX latest`。
  - **Today** 标识：根据你运行脚本时的**本地系统时间**判断。如果当天有更新，则显示今日增量。
  - **Latest** 标识：如果今日尚未产生数据，则显示最后一次统计到的增量，确保视觉反馈不为空。

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

### 🔍 查看单次对话或计费窗口消耗

默认情况下，`BurnRate` 生成的是每日汇总图表。如果你想查看更细粒度的消耗（如单次对话会话或 5 小时计费窗口），可以切换 `CCUSAGE_REPORT` 模式：

- **查看对话会话**：`CCUSAGE_REPORT=session bun run sync`
- **查看计费窗口**：`CCUSAGE_REPORT=blocks bun run sync`

*注意：切换模式后，卡片图表仍会按日期汇总显示，但底层 `data/` 中的 JSON 将包含单次会话的详细 Token 消耗、模型分布和成本。*

## 💡 提示词效率与燃耗分析 (Burn Rate Analysis)

通过 `BurnRate` 追踪你的 Token 使用量，不仅是为了看花了多少钱，更是为了评估你的**提示词效率**。

### 订阅制下的“白嫖”策略

在 Claude Pro 或 IDE 订阅模式下，单次对话的 Token 消耗通常不是直接计费项。你可以利用这一点来实现“高密度提示词”：

- **强约束提示词**：在 System Prompt 或首条消息中加入极其详尽的代码规约和架构要求。虽然这会瞬间消耗数千 Token，但在订阅制下，这比多次往返纠错要划算得多。
- **单次对话质量**：观察卡片中的 `Burn Rate`。如果你的 Token 消耗很高但对话次数很少，说明你正在高效利用 Context 窗口，通过强约束减少了无效的往返沟通。
- **API vs 订阅**：对于 API 用户，建议精简提示词以节省成本；对于订阅用户，建议“加满”约束，让 AI 每一轮输出都达到极致。

### 长计划执行 (Long-running Plans) 与配额策略

当你设定一个非常长的自动化执行计划时，你会发现：
- **额度检查滞后**：订阅制系统通常在“用户发送消息”时检查配额。这意味着一旦长计划开始运行，即使中途 Token 消耗超标，AI 往往也能继续完成当前任务，直到这一轮对话彻底结束。
- **最大化单次对话价值**：通过一次性布置多步骤任务（而不是分步询问），你实际上是在利用单次配额执行了高密度的计算量。
- **注意 Context 瓶颈**：这种策略的上限是模型的 **上下文窗口 (Context Window)**。如果计划过长导致 Token 彻底耗尽，模型可能会出现“失忆”或报错，建议在卡片中观察 `Burn Rate` 的斜率来判断任务复杂度。

### ⏳ 速率限制 (Rate Limit) 与 5 小时锁定期

如果你在一次对话中使用了 7M Tokens 并触发了“5 小时后重试”的限制，恭喜你：

- **压榨极致**：你已经成功触发了订阅制的“隐性资源边界”。在 ChatGPT Plus 中，这通常意味着你单次会话的 **计算密度 (Compute Density)** 或 **上下文填充度** 超过了系统分配给单用户的瞬时配额。
- **价值分析**：按 API 价格计算，7M Tokens 的输入成本（以 GPT-4o 为例）约为 $35。如果你能通过一次对话完成这样的工作量，你已经瞬间赚回了将近两倍的月度订阅费。
- **应对策略**：
    1. **分片执行**：将超大型任务（如全库重构）拆分为多个独立的对话会话。
    2. **清理上下文**：如果对话过长，及时的“新建对话”可以清空之前的 Context 冗余，降低每一轮的 Token 消耗，从而延长被限流前的使用时长。
    3. **利用多模型备选**：当 GPT 锁定 5 小时时，可以通过 `BurnRate` 观察你的 Claude 或其他模型是否有剩余配额，实现“多云负载均衡”。

利用 `BurnRate` 观察你的使用模式，找到最适合你的生产力平衡点。
