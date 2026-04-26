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
        };
      }

      day.costUSD += costUSD;
      day.credits += credits;
      day.tokens += tokens;
      day.tools[tool.id].costUSD += costUSD;
      day.tools[tool.id].credits += credits;
      day.tools[tool.id].tokens += tokens;

      toolTotal.costUSD += costUSD;
      toolTotal.credits += credits;
      toolTotal.tokens += tokens;
      datesForTool.add(date);
    }

    toolTotal.dates += datesForTool.size;
  }

  const daily = [...byDate.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      ...day,
      costUSD: round(day.costUSD),
      credits: round(day.credits),
      tokens: Math.round(day.tokens),
    }));

  const toolSummaries = [...tools.values()].map((tool) => ({
    ...tool,
    costUSD: round(tool.costUSD),
    credits: round(tool.credits),
    tokens: Math.round(tool.tokens),
  }));

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
  const width = 900;
  const height = 500;
  const margin = 36;
  const barX = margin;
  const barY = 176;
  const barWidth = width - margin * 2;
  const barHeight = 18;
  const shareBasis = summary.totals.costUSD > 0 ? 'costUSD' : 'tokens';
  const shareTotal = summary.totals[shareBasis] || 0;
  const tools = [...summary.tools].sort((a, b) => (b[shareBasis] || 0) - (a[shareBasis] || 0));
  const nonZeroTools = tools.filter((tool) => (tool.costUSD || tool.tokens || tool.credits) > 0);
  const rows = nonZeroTools.length > 0 ? nonZeroTools : tools;

  const rangeText = summary.dateRange
    ? `${summary.dateRange.start} to ${summary.dateRange.end}`
    : 'No exported usage data yet';
  const updated = new Date(summary.generatedAt).toISOString().replace('T', ' ').slice(0, 16);
  const shareLabel = shareBasis === 'costUSD' ? 'Cost share' : 'Token share';
  const subtitle = `${rangeText} / updated ${updated} UTC`;

  let currentX = barX;
  const segments = [];
  for (const tool of tools) {
    const value = shareTotal > 0 ? tool[shareBasis] || 0 : 0;
    const segmentWidth = shareTotal > 0 ? (value / shareTotal) * barWidth : 0;
    if (segmentWidth < 1) {
      continue;
    }

    segments.push(
      `<rect x="${currentX.toFixed(2)}" y="${barY}" width="${segmentWidth.toFixed(2)}" height="${barHeight}" rx="9" fill="${tool.color}"/>`,
    );
    currentX += segmentWidth;
  }

  const rowMarkup =
    nonZeroTools.length === 0
      ? ''
      : rows
          .slice(0, 5)
          .map((tool, index) => {
            const y = 236 + index * 34;
            const percent = shareTotal > 0 ? ((tool[shareBasis] || 0) / shareTotal) * 100 : 0;
            return `
        <g transform="translate(${margin}, ${y})">
          <circle cx="8" cy="8" r="6" fill="${tool.color}"/>
          <text x="24" y="13" class="tool">${xml(tool.name)}</text>
          <text x="250" y="13" class="metric">${formatPercent(percent)}</text>
          <text x="390" y="13" class="metric">${xml(formatUsd(tool.costUSD))}</text>
          <text x="535" y="13" class="muted">${xml(formatCompact(tool.tokens))} tokens</text>
          <text x="710" y="13" class="muted">${xml(formatCompact(tool.credits))} credits</text>
        </g>`;
          })
          .join('');

  const sparkline = renderSparkline(summary.daily, {
    x: margin,
    y: 440,
    width: width - margin * 2,
    height: 28,
    basis: shareBasis,
  });

  const emptyState =
    nonZeroTools.length === 0
      ? `<text x="${margin}" y="252" class="empty">Run scripts/export-ccusage-data.sh to export local usage JSON into data/.</text>`
      : '';

  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="title desc">
  <title id="title">${xml(title)}</title>
  <desc id="desc">Cost and usage summary generated from ccusage JSON exports.</desc>
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#F8FAFC"/>
      <stop offset="1" stop-color="#EEF2FF"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#0F172A" flood-opacity="0.10"/>
    </filter>
  </defs>
  <style>
    .title { font: 700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #0F172A; }
    .subtitle { font: 500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #64748B; }
    .label { font: 700 12px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: 0.08em; text-transform: uppercase; fill: #64748B; }
    .total { font: 800 42px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #0F172A; }
    .stat { font: 700 21px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #111827; }
    .muted { font: 500 13px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #64748B; }
    .tool { font: 700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #1E293B; }
    .metric { font: 700 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #0F172A; }
    .empty { font: 600 15px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; fill: #64748B; }
  </style>
  <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="22" fill="url(#bg)" filter="url(#shadow)"/>
  <rect x="10.5" y="10.5" width="${width - 21}" height="${height - 21}" rx="21.5" stroke="#CBD5E1"/>
  <text x="${margin}" y="58" class="title">${xml(title)}</text>
  <text x="${margin}" y="82" class="subtitle">${xml(subtitle)}</text>

  <text x="${margin}" y="126" class="label">Total cost</text>
  <text x="${margin}" y="162" class="total">${xml(formatUsd(summary.totals.costUSD))}</text>
  <text x="380" y="126" class="label">Total tokens</text>
  <text x="380" y="158" class="stat">${xml(formatNumber(summary.totals.tokens))}</text>
  <text x="620" y="126" class="label">Credits</text>
  <text x="620" y="158" class="stat">${xml(formatNumber(summary.totals.credits))}</text>

  <rect x="${barX}" y="${barY}" width="${barWidth}" height="${barHeight}" rx="9" fill="#E2E8F0"/>
  ${segments.join('\n  ')}
  <text x="${margin}" y="218" class="label">${xml(shareLabel)}</text>
  <text x="426" y="218" class="label">Cost</text>
  <text x="571" y="218" class="label">Tokens</text>
  <text x="746" y="218" class="label">Credits</text>
  ${emptyState}
  ${rowMarkup}
  ${sparkline}
</svg>
`;
}

function renderSparkline(daily, options) {
  const { x, y, width, height, basis } = options;
  const values = daily.slice(-30).map((day) => Number(day[basis]) || 0);

  if (values.length < 2 || Math.max(...values) <= 0) {
    return `<line x1="${x}" y1="${y + height}" x2="${x + width}" y2="${y + height}" stroke="#CBD5E1" stroke-width="2"/><text x="${x}" y="${y - 8}" class="label">Recent trend</text>`;
  }

  const max = Math.max(...values);
  const step = width / (values.length - 1);
  const points = values
    .map((value, index) => {
      const px = x + index * step;
      const py = y + height - (value / max) * height;
      return `${px.toFixed(2)},${py.toFixed(2)}`;
    })
    .join(' ');

  return `
    <text x="${x}" y="${y - 8}" class="label">Recent trend</text>
    <polyline points="${points}" fill="none" stroke="#334155" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    <line x1="${x}" y1="${y + height}" x2="${x + width}" y2="${y + height}" stroke="#CBD5E1" stroke-width="2"/>`;
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
