#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const TOOL_DEFS = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    aliases: ['claude', 'claude-code', 'ccusage'],
    color: '#6E56CF',
  },
  {
    id: 'codex',
    name: 'Codex',
    aliases: ['codex', 'ccusage-codex'],
    color: '#10A37F',
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    aliases: ['opencode', 'open-code', 'ccusage-opencode'],
    color: '#F97316',
  },
  {
    id: 'pi',
    name: 'Pi',
    aliases: ['pi', 'pi-agent', 'ccusage-pi'],
    color: '#0EA5E9',
  },
  {
    id: 'amp',
    name: 'Amp',
    aliases: ['amp', 'ccusage-amp'],
    color: '#EC4899',
  },
];

const TOOL_BY_ALIAS = new Map();
for (const tool of TOOL_DEFS) {
  TOOL_BY_ALIAS.set(tool.id, tool);
  for (const alias of tool.aliases) {
    TOOL_BY_ALIAS.set(normalizeId(alias), tool);
  }
}

const DEFAULT_DATA_DIR = 'data';
const DEFAULT_OUT_DIR = 'assets';

function parseArgs(argv) {
  const args = {
    dataDir: DEFAULT_DATA_DIR,
    outDir: DEFAULT_OUT_DIR,
    svg: 'ccusage-card.svg',
    summary: 'ccusage-summary.json',
    title: 'ccusage Burn Rate',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if (arg === '--data-dir' && next) {
      args.dataDir = next;
      index += 1;
    } else if (arg === '--out-dir' && next) {
      args.outDir = next;
      index += 1;
    } else if (arg === '--svg' && next) {
      args.svg = next;
      index += 1;
    } else if (arg === '--summary' && next) {
      args.summary = next;
      index += 1;
    } else if (arg === '--title' && next) {
      args.title = next;
      index += 1;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  args.dataDir = path.resolve(args.dataDir);
  args.outDir = path.resolve(args.outDir);
  args.svgPath = path.join(args.outDir, args.svg);
  args.summaryPath = path.join(args.outDir, args.summary);

  return args;
}

function printHelp() {
  console.log(`
Usage: node scripts/generate-ccusage-card.mjs [options]

Options:
  --data-dir <dir>   Directory containing ccusage JSON exports. Default: data
  --out-dir <dir>    Directory for generated assets. Default: assets
  --svg <file>       SVG filename. Default: ccusage-card.svg
  --summary <file>   Summary JSON filename. Default: ccusage-summary.json
  --title <text>     Card title. Default: ccusage Burn Rate
`);
}

async function readJsonFiles(dir) {
  const files = [];

  async function walk(currentDir) {
    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.json') && !entry.name.startsWith('.')) {
        files.push(fullPath);
      }
    }
  }

  await walk(dir);
  files.sort();
  return files;
}

async function loadInputs(dataDir) {
  const files = await readJsonFiles(dataDir);
  const inputs = [];
  const warnings = [];

  for (const file of files) {
    try {
      const raw = await fs.readFile(file, 'utf8');
      inputs.push({
        file,
        json: JSON.parse(raw),
      });
    } catch (error) {
      warnings.push({
        file: path.relative(process.cwd(), file),
        reason: 'invalid_json',
        message: error.message,
      });
    }
  }

  return { inputs, warnings };
}

function normalizeId(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/@ccusage\//g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function inferTool(file, json) {
  const candidates = [
    json?.tool,
    json?.toolId,
    json?.name,
    json?.package,
    path.basename(file, '.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = normalizeId(candidate);
    if (TOOL_BY_ALIAS.has(normalized)) {
      return TOOL_BY_ALIAS.get(normalized);
    }
    // Check if it starts with any known tool ID/alias (for multi-machine support)
    for (const [alias, tool] of TOOL_BY_ALIAS.entries()) {
      if (normalized.startsWith(alias + '-')) {
        return tool;
      }
    }
  }

  const fallbackId = normalizeId(path.basename(file, '.json')) || 'unknown';
  return {
    id: fallbackId,
    name: titleCase(fallbackId),
    aliases: [fallbackId],
    color: '#64748B',
  };
}

function titleCase(value) {
  return String(value)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function unwrapReport(json) {
  if (!json || typeof json !== 'object') {
    return null;
  }

  if (json.ok === false) {
    return null;
  }

  return json.report || json.payload || json.result || json;
}

function collectRows(report) {
  if (!report || typeof report !== 'object') {
    return [];
  }

  const rows = [];

  if (Array.isArray(report.daily)) {
    rows.push(...report.daily);
  }

  if (Array.isArray(report.data)) {
    rows.push(...report.data);
  }

  if (Array.isArray(report.rows)) {
    rows.push(...report.rows);
  }

  if (Array.isArray(report.sessions)) {
    rows.push(...report.sessions);
  }

  if (Array.isArray(report.blocks)) {
    rows.push(...report.blocks);
  }

  if (report.projects && typeof report.projects === 'object') {
    for (const [project, projectRows] of Object.entries(report.projects)) {
      if (Array.isArray(projectRows)) {
        rows.push(...projectRows.map((row) => ({ ...row, project })));
      }
    }
  }

  if (report.byDate && typeof report.byDate === 'object') {
    for (const [date, value] of Object.entries(report.byDate)) {
      if (value && typeof value === 'object') {
        rows.push({ date, ...value });
      }
    }
  }

  return rows.filter((row) => row && typeof row === 'object');
}

function numberFrom(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const cleaned = value.replace(/[$,\s]/g, '');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function pickNumber(source, keys) {
  if (!source || typeof source !== 'object') {
    return 0;
  }

  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return numberFrom(source[key]);
    }
  }

  return 0;
}

function extractDate(row) {
  const raw =
    row.date ||
    row.day ||
    row.createdAt ||
    row.timestamp ||
    row.lastActivity ||
    row.startedAt ||
    row.month;

  if (!raw) {
    return null;
  }

  const value = String(raw);
  const dateMatch = value.match(/\d{4}-\d{2}-\d{2}/);
  if (dateMatch) {
    return dateMatch[0];
  }

  const monthMatch = value.match(/^(\d{4}-\d{2})$/);
  if (monthMatch) {
    return `${monthMatch[1]}-01`;
  }

  try {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  } catch (e) {}

  return null;
}

function extractCost(row) {
  const direct = pickNumber(row, [
    'costUSD',
    'costUsd',
    'cost_usd',
    'totalCost',
    'totalCostUSD',
    'totalCostUsd',
    'total_cost_usd',
    'cost',
    'amountUSD',
    'spendUSD',
  ]);

  if (direct > 0) {
    return direct;
  }

  return pickNumber(row?.totals, [
    'costUSD',
    'costUsd',
    'totalCost',
    'totalCostUSD',
    'totalCostUsd',
  ]);
}

function extractCredits(row) {
  return pickNumber(row, [
    'credits',
    'credit',
    'creditsUsed',
    'totalCredits',
    'totalCredit',
    'ampCredits',
  ]);
}

function extractTokens(row) {
  const direct = pickNumber(row, ['totalTokens', 'tokens', 'tokenCount']);
  if (direct > 0) {
    return direct;
  }

  const totalFromTotals = pickNumber(row?.totals, ['totalTokens', 'tokens', 'tokenCount']);
  if (totalFromTotals > 0) {
    return totalFromTotals;
  }

  return [
    'inputTokens',
    'outputTokens',
    'cacheCreationTokens',
    'cacheReadTokens',
    'totalInputTokens',
    'totalOutputTokens',
    'totalCacheCreationTokens',
    'totalCacheReadTokens',
  ].reduce((sum, key) => sum + pickNumber(row, [key]), 0);
}

function addToMap(map, key, defaults) {
  if (!map.has(key)) {
    map.set(key, defaults());
  }
  return map.get(key);
}

function aggregate(inputs, warnings) {
  const tools = new Map();
  const byDate = new Map();
  const skippedFiles = [];

  for (const tool of TOOL_DEFS) {
    tools.set(tool.id, {
      id: tool.id,
      name: tool.name,
      color: tool.color,
      costUSD: 0,
      credits: 0,
      tokens: 0,
      dates: 0,
      files: [],
    });
  }

  for (const input of inputs) {
    const tool = inferTool(input.file, input.json);
    if (!tools.has(tool.id)) {
      tools.set(tool.id, {
        id: tool.id,
        name: tool.name,
        color: tool.color,
        costUSD: 0,
        credits: 0,
        tokens: 0,
        dates: 0,
        files: [],
      });
    }

    const toolTotal = tools.get(tool.id);
    const relativeFile = path.relative(process.cwd(), input.file);
    toolTotal.files.push(relativeFile);

    const report = unwrapReport(input.json);
    const rows = collectRows(report);

    if (rows.length === 0) {
      skippedFiles.push({
        file: relativeFile,
        tool: tool.id,
        reason: input.json?.ok === false ? input.json.reason || 'export_failed' : 'no_daily_rows',
      });
      continue;
    }

    const datesForTool = new Set();

    for (const row of rows) {
      const date = extractDate(row);
      if (!date) {
        continue;
      }

      const costUSD = extractCost(row);
      const credits = extractCredits(row);
      const tokens = extractTokens(row);

      const day = addToMap(byDate, date, () => ({
        date,
        costUSD: 0,
        credits: 0,
        tokens: 0,
        tools: {},
      }));

      if (!day.tools[tool.id]) {
        day.tools[tool.id] = {
          name: tool.name,
          costUSD: 0,
          credits: 0,
          tokens: 0,
          models: {},
        };
      }

      day.costUSD += costUSD;
      day.credits += credits;
      day.tokens += tokens;
      day.tools[tool.id].costUSD += costUSD;
      day.tools[tool.id].credits += credits;
      day.tools[tool.id].tokens += tokens;

      // Extract model data
      const models = [];
      if (Array.isArray(row.modelBreakdowns)) {
        models.push(...row.modelBreakdowns.map(m => ({ name: m.modelName, costUSD: extractCost(m), tokens: extractTokens(m) })));
      } else if (row.models && typeof row.models === 'object') {
        const modelEntries = Object.entries(row.models);
        const totalModelTokens = modelEntries.reduce((sum, [_, m]) => sum + extractTokens(m), 0) || 1;
        for (const [name, m] of modelEntries) {
          let mCost = extractCost(m);
          if (mCost === 0 && costUSD > 0) {
            mCost = costUSD * (extractTokens(m) / totalModelTokens);
          }
          models.push({ name, costUSD: mCost, tokens: extractTokens(m) });
        }
      } else if (Array.isArray(row.modelsUsed) && row.modelsUsed.length > 0) {
        // Fallback if we only have names but no per-model breakdown in the row
        const share = 1 / row.modelsUsed.length;
        for (const name of row.modelsUsed) {
          models.push({ name, costUSD: costUSD * share, tokens: tokens * share });
        }
      }

      for (const m of models) {
        if (!day.tools[tool.id].models[m.name]) {
          day.tools[tool.id].models[m.name] = { costUSD: 0, tokens: 0 };
        }
        day.tools[tool.id].models[m.name].costUSD += m.costUSD;
        day.tools[tool.id].models[m.name].tokens += m.tokens;
      }

      toolTotal.costUSD += costUSD;
      toolTotal.credits += credits;
      toolTotal.tokens += tokens;
      datesForTool.add(date);
    }

    toolTotal.dates += datesForTool.size;
  }

  let runningCost = 0;
  let runningTokens = 0;
  let runningCredits = 0;
  const toolRunningTokens = new Map();

  const daily = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => {
      runningCost += day.costUSD;
      runningTokens += day.tokens;
      runningCredits += day.credits;

      const cumulativeTools = {};
      for (const tool of TOOL_DEFS) {
        const dayTokens = day.tools[tool.id]?.tokens || 0;
        const prev = toolRunningTokens.get(tool.id) || 0;
        const total = prev + dayTokens;
        toolRunningTokens.set(tool.id, total);
        cumulativeTools[tool.id] = Math.round(total);
      }

      return {
        ...day,
        costUSD: round(day.costUSD),
        credits: round(day.credits),
        tokens: Math.round(day.tokens),
        cumulativeCostUSD: round(runningCost),
        cumulativeTokens: Math.round(runningTokens),
        cumulativeCredits: Math.round(runningCredits),
        cumulativeTools,
      };
    });

  const toolSummaries = [...tools.values()].map((tool) => {
    // Collect models across all days for this tool
    const modelsMap = new Map();
    for (const day of daily) {
      const toolData = day.tools[tool.id];
      if (toolData && toolData.models) {
        for (const [name, m] of Object.entries(toolData.models)) {
          if (!modelsMap.has(name)) {
            modelsMap.set(name, { name, costUSD: 0, tokens: 0 });
          }
          const mTotal = modelsMap.get(name);
          mTotal.costUSD += m.costUSD;
          mTotal.tokens += m.tokens;
        }
      }
    }

    return {
      ...tool,
      costUSD: round(tool.costUSD),
      credits: round(tool.credits),
      tokens: Math.round(tool.tokens),
      models: [...modelsMap.values()]
        .sort((a, b) => b.costUSD - a.costUSD || b.tokens - a.tokens)
        .map(m => ({ ...m, costUSD: round(m.costUSD), tokens: Math.round(m.tokens) })),
    };
  });

  const totals = {
    costUSD: round(toolSummaries.reduce((sum, tool) => sum + tool.costUSD, 0)),
    credits: round(toolSummaries.reduce((sum, tool) => sum + tool.credits, 0)),
    tokens: Math.round(toolSummaries.reduce((sum, tool) => sum + tool.tokens, 0)),
  };

  const dateRange = daily.length
    ? {
        start: daily[0].date,
        end: daily[daily.length - 1].date,
      }
    : null;

  return {
    generatedAt: new Date().toISOString(),
    dateRange,
    totals,
    tools: toolSummaries,
    daily,
    inputFiles: inputs.map((input) => path.relative(process.cwd(), input.file)),
    skippedFiles,
    warnings,
  };
}

function round(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function formatUsd(value) {
  return `$${round(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-US');
}

function formatCompact(value) {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(Number(value) || 0);
}

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return '0.0%';
  }

  return `${value.toFixed(1)}%`;
}

function xml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function renderCard(summary, title) {
  const width = 1000;
  const height = 760;
  const margin = 40;
  // Pivot to tokens as primary basis
  const shareBasis = 'tokens';
  const tools = [...summary.tools].sort((a, b) => (b[shareBasis] || 0) - (a[shareBasis] || 0));
  const nonZeroTools = tools.filter((tool) => (tool.costUSD || tool.tokens || tool.credits) > 0);
  
  const updated = new Date(summary.generatedAt).toISOString().replace('T', ' ').slice(0, 16);
  const subtitle = `AI Engineering & Intelligence Volume Statistics / Updated ${updated} UTC`;

  // Highlights
  const totalDays = summary.daily.length;
  const topModel = tools[0]?.models[0]?.name || 'N/A';

  // Chart data
  const chartHeight = 220;
  const chartY = 500;
  const sparkline = renderLineChart(summary.daily, {
    x: margin,
    y: chartY,
    width: width - margin * 2 - 50, // Reduced space to align better with right margin
    height: chartHeight,
    basis: shareBasis,
    tools: summary.tools
  });

  const toolStats = nonZeroTools.slice(0, 4).map((tool, index) => {
    const x = margin + (index % 2) * 460;
    const y = 280 + Math.floor(index / 2) * 100;
    return `
      <g transform="translate(${x}, ${y})">
        <rect width="440" height="90" rx="16" fill="white" stroke="#F1F5F9" stroke-width="2"/>
        <circle cx="24" cy="24" r="8" fill="${tool.color}"/>
        <text x="44" y="29" class="tool-name">${xml(tool.name)}</text>
        <text x="24" y="55" class="tool-metric">${xml(formatCompact(tool.tokens))} tokens</text>
        <text x="24" y="78" class="tool-muted">spent ${xml(formatUsd(tool.costUSD))}</text>
        <g transform="translate(240, 20)">
          ${tool.models.slice(0, 3).map((m, i) => `
            <text x="0" y="${i * 20}" class="model-item">${xml(m.name.length > 20 ? m.name.slice(0, 17) + '...' : m.name)}</text>
            <text x="160" y="${i * 20}" class="model-item" text-anchor="end">${xml(formatCompact(m.tokens))}</text>
          `).join('')}
        </g>
      </g>
    `;
  }).join('');

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#F8FAFC"/>
      <stop offset="1" stop-color="#F1F5F9"/>
    </linearGradient>
    <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="12" flood-color="#000" flood-opacity="0.05"/>
    </filter>
    <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
      <stop stop-color="#10B981" stop-opacity="0.2"/>
      <stop offset="1" stop-color="#10B981" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <style>
    .title { font: 800 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; fill: #0F172A; }
    .subtitle { font: 600 14px -apple-system, sans-serif; fill: #64748B; letter-spacing: 0.02em; }
    .label { font: 700 11px -apple-system, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; fill: #94A3B8; }
    .total-val { font: 800 52px -apple-system, sans-serif; fill: #0F172A; }
    .stat-val { font: 700 24px -apple-system, sans-serif; fill: #1E293B; }
    .tool-name { font: 700 18px -apple-system, sans-serif; fill: #0F172A; }
    .tool-metric { font: 800 22px -apple-system, sans-serif; fill: #0F172A; }
    .tool-muted { font: 500 14px -apple-system, sans-serif; fill: #64748B; }
    .model-item { font: 600 12px -apple-system, sans-serif; fill: #475569; }
    .chart-label { font: 600 11px -apple-system, sans-serif; fill: #94A3B8; }
    .badge { font: 700 10px -apple-system, sans-serif; fill: #10B981; }
  </style>

  <rect width="${width}" height="${height}" rx="32" fill="url(#bg)"/>
  
  <text x="${margin}" y="75" class="title">${xml(title.replace('ccusage ', ''))}</text>
  <text x="${margin}" y="105" class="subtitle">${xml(subtitle)}</text>

  <!-- Key Metrics Row -->
  <g transform="translate(${margin}, 150)">
    <g>
      <text y="0" class="label">Total Intelligence Volume</text>
      <text y="50" class="total-val">${xml(formatCompact(summary.totals.tokens))} Tokens</text>
    </g>
    <g transform="translate(420, 0)">
      <text y="0" class="label">Historical Cost</text>
      <text y="42" class="stat-val">${xml(formatUsd(summary.totals.costUSD))}</text>
      <text y="62" class="tool-muted">Across ${totalDays} active production days</text>
    </g>
    <g transform="translate(700, 0)">
      <text y="0" class="label">Main Architecture</text>
      <text y="42" class="stat-val" fill="#10B981">${xml(topModel)}</text>
      <text y="62" class="tool-muted">Dominant LLM backend</text>
    </g>
  </g>

  <g transform="translate(${margin}, 260)">
    <text y="0" class="label">Tooling &amp; Model Efficiency Breakdown</text>
  </g>
  ${toolStats}

  <g transform="translate(${margin}, ${chartY - 30})">
    <text y="0" class="label">Intelligence Throughput &amp; Growth Curve (Tokens)</text>
    <g transform="translate(${width - margin * 2}, 0)" text-anchor="end">
      <text x="0" y="0" class="badge">● CUMULATIVE VOLUME</text>
      <text x="-150" y="0" class="badge" fill="#94A3B8">■ DAILY THROUGHPUT</text>
    </g>
  </g>
  ${sparkline}
</svg>`;
}

function renderLineChart(daily, options) {
  const { x, y, width, height, basis, tools } = options;
  if (daily.length < 2) return '';

  const maxDaily = Math.max(...daily.map(d => d[basis]), 1);
  const maxCumul = Math.max(...daily.map(d => d.cumulativeTokens), 1);
  const stepX = width / (daily.length - 1);

  // Y-axis grid for Cumulative
  const grid = [0, 0.25, 0.5, 0.75, 1].map(p => {
    const gy = y + height - p * height;
    const val = formatCompact(p * maxCumul);
    return `<line x1="${x}" y1="${gy}" x2="${x + width}" y2="${gy}" stroke="#E2E8F0" stroke-width="1"/><text x="${x + width + 5}" y="${gy + 4}" class="chart-label">${val}</text>`;
  }).join('');

  // Date labels
  const labels = daily.map((d, i) => {
    if (i === 0 || i === daily.length - 1 || i % Math.max(1, Math.floor(daily.length / 8)) === 0) {
      return `<text x="${x + i * stepX}" y="${y + height + 24}" text-anchor="middle" class="chart-label">${d.date.slice(5)}</text>`;
    }
    return '';
  }).join('');

  // Daily total usage (bars)
  const bars = daily.map((d, i) => {
    const barH = (d[basis] / maxDaily) * (height * 0.4); 
    return `<rect x="${x + i * stepX - 2}" y="${y + height - barH}" width="4" height="${barH}" fill="#94A3B8" rx="2"/>`;
  }).join('');

  // Per-tool cumulative lines
  const toolPaths = tools.filter(t => t.tokens > 0).map(tool => {
    const points = daily.map((d, i) => ({
      x: x + i * stepX,
      y: y + height - (d.cumulativeTools[tool.id] / maxCumul) * height
    }));

    let pathD = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      pathD += ` C ${cp1x},${p0.y} ${cp1x},${p1.y} ${p1.x},${p1.y}`;
    }

    return `<path d="${pathD}" stroke="${tool.color}" stroke-width="1.5" stroke-opacity="0.6" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4 2"/>`;
  }).join('');

  // Grand total cumulative Line
  const totalPoints = daily.map((d, i) => ({
    x: x + i * stepX,
    y: y + height - (d.cumulativeTokens / maxCumul) * height
  }));

  let totalPathD = `M ${totalPoints[0].x},${totalPoints[0].y}`;
  for (let i = 0; i < totalPoints.length - 1; i++) {
    const p0 = totalPoints[i];
    const p1 = totalPoints[i + 1];
    const cp1x = p0.x + (p1.x - p0.x) / 2;
    totalPathD += ` C ${cp1x},${p0.y} ${cp1x},${p1.y} ${p1.x},${p1.y}`;
  }

  const areaD = `${totalPathD} L ${totalPoints[totalPoints.length - 1].x},${y + height} L ${totalPoints[0].x},${y + height} Z`;

  return `
    <g>
      ${grid}
      ${labels}
      <g opacity="0.6">${bars}</g>
      <path d="${areaD}" fill="url(#lineGrad)"/>
      ${toolPaths}
      <path d="${totalPathD}" stroke="#10B981" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      ${totalPoints.map((p, i) => i === totalPoints.length - 1 ? `<circle cx="${p.x}" cy="${p.y}" r="6" fill="#10B981" stroke="white" stroke-width="3"/>` : '').join('')}
    </g>
  `;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { inputs, warnings } = await loadInputs(args.dataDir);
  const summary = aggregate(inputs, warnings);
  const svg = renderCard(summary, args.title);

  await fs.mkdir(args.outDir, { recursive: true });
  await fs.writeFile(args.summaryPath, `${JSON.stringify(summary, null, 2)}\n`);
  await fs.writeFile(args.svgPath, svg);

  console.log(`Read ${inputs.length} JSON file(s) from ${path.relative(process.cwd(), args.dataDir) || '.'}`);
  console.log(`Wrote ${path.relative(process.cwd(), args.summaryPath)}`);
  console.log(`Wrote ${path.relative(process.cwd(), args.svgPath)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
