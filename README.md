# BurnRate

Generate a GitHub profile SVG card from the ccusage family of local JSON exports.

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

If a tool has no local data or fails temporarily, the exporter writes a small placeholder JSON so the card generator can continue.

## Options

Set environment variables before running the exporter:

```bash
CCUSAGE_SINCE=20260401 CCUSAGE_TIMEZONE=UTC bun run export:ccusage
```

Available variables:

- `CCUSAGE_REPORT`: report command, defaults to `daily`
- `CCUSAGE_SINCE`: optional start date, such as `20260401`
- `CCUSAGE_UNTIL`: optional end date, such as `20260426`
- `CCUSAGE_TIMEZONE`: optional timezone passed to supported CLIs
- `CCUSAGE_LOCALE`: optional locale passed to supported CLIs
- `CCUSAGE_MODE`: optional cost mode passed to supported CLIs
- `CCUSAGE_EXTRA_ARGS`: extra CLI flags
- `CCUSAGE_COMMIT=0`: export without committing `data/`
- `CCUSAGE_PUSH=0`: commit without pushing

Generate the card locally:

```bash
bun run generate:card
```

The GitHub Action regenerates and commits:

- `assets/ccusage-summary.json`
- `assets/ccusage-card.svg`

Embed the card in a GitHub profile README:

```markdown
![ccusage stats](https://raw.githubusercontent.com/<owner>/<repo>/<branch>/assets/ccusage-card.svg)
```
