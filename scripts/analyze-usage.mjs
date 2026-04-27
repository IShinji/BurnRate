#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';

async function readJsonFiles(dir) {
  const files = await fs.readdir(dir);
  return files.filter(f => f.endsWith('.json') && !f.startsWith('.')).map(f => path.join(dir, f));
}

async function main() {
  const dataDir = path.resolve('data');
  const files = await readJsonFiles(dataDir);
  
  const allSessions = [];
  const allDays = [];

  for (const file of files) {
    try {
      const data = JSON.parse(await fs.readFile(file, 'utf8'));
      if (data.sessions) {
        allSessions.push(...data.sessions.map(s => ({ ...s, tool: data.tool || path.basename(file) })));
      }
      if (data.daily) {
        allDays.push(...data.daily.map(d => ({ ...d, tool: data.tool || path.basename(file) })));
      }
    } catch (e) {}
  }

  console.log('# 🧠 BurnRate 消耗大户报表 (Intelligence Highs Report)\n');

  if (allSessions.length > 0) {
    console.log('## 🏆 历史单次对话 Top 5 (Highest Usage Sessions)');
    const topSessions = allSessions
      .sort((a, b) => (b.totalTokens || 0) - (a.totalTokens || 0))
      .slice(0, 5);

    topSessions.forEach((s, i) => {
      console.log(`${i + 1}. **${(s.totalTokens || 0).toLocaleString()} tokens**`);
      console.log(`   - 会话 ID: \`${s.sessionId}\``);
      console.log(`   - 工具: ${s.tool}`);
      console.log(`   - 最后活动: ${s.lastActivity || '未知'}`);
      console.log(`   - 预估成本: $${(s.totalCost || 0).toFixed(2)}`);
      console.log('');
    });
  } else {
    console.log('ℹ️ 未发现会话级别数据，请运行 `CCUSAGE_REPORT=session bun run sync` 导出。\n');
  }

  if (allDays.length > 0) {
    console.log('## 📅 历史单日消耗 Top 5 (Highest Usage Days)');
    // Group days by date across different tools/machines
    const dailyMap = new Map();
    allDays.forEach(d => {
      const existing = dailyMap.get(d.date) || { tokens: 0, cost: 0, tools: new Set() };
      existing.tokens += (d.totalTokens || 0);
      existing.cost += (d.totalCost || 0);
      existing.tools.add(d.tool);
      dailyMap.set(d.date, existing);
    });

    const topDays = [...dailyMap.entries()]
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, 5);

    topDays.forEach((d, i) => {
      console.log(`${i + 1}. **${d.date}**: ${d.tokens.toLocaleString()} tokens ($${d.cost.toFixed(2)})`);
      console.log(`   - 涉及工具: ${[...d.tools].join(', ')}`);
    });
  }

  console.log('\n---');
  console.log(`*生成的报表基于 data/ 目录下的 ${files.length} 个 JSON 文件*`);
}

main().catch(console.error);
