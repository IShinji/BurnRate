#!/usr/bin/env bash
set -uo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${CCUSAGE_DATA_DIR:-"$ROOT_DIR/data"}"
REPORT="${CCUSAGE_REPORT:-daily}"
COMMIT_DATA="${CCUSAGE_COMMIT:-1}"
PUSH_DATA="${CCUSAGE_PUSH:-1}"
COMMIT_MESSAGE="${CCUSAGE_COMMIT_MESSAGE:-chore: update ccusage data}"
REMOTE="${CCUSAGE_REMOTE:-origin}"
PUSH_REF="${CCUSAGE_PUSH_REF:-HEAD}"

TOOLS=(
  "claude-code|ccusage@latest|Claude Code"
  "codex|@ccusage/codex@latest|Codex"
  "opencode|@ccusage/opencode@latest|OpenCode"
  "pi|@ccusage/pi@latest|Pi"
  "amp|@ccusage/amp@latest|Amp"
)

log() {
  printf '%s\n' "$*"
}

warn() {
  printf 'warning: %s\n' "$*" >&2
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'error: %s is required\n' "$1" >&2
    exit 1
  fi
}

validate_json() {
  node -e "JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8'))" "$1" >/dev/null 2>&1
}

write_placeholder() {
  local outfile="$1"
  local id="$2"
  local package="$3"
  local label="$4"
  local exit_code="$5"
  local reason="$6"
  local stderr_file="${7:-}"

  node - "$outfile" "$id" "$package" "$label" "$exit_code" "$reason" "$stderr_file" <<'NODE'
const fs = require('node:fs');

const [outfile, id, packageName, label, exitCode, reason, stderrFile] = process.argv.slice(2);
let stderr = '';

if (stderrFile && fs.existsSync(stderrFile)) {
  stderr = fs.readFileSync(stderrFile, 'utf8').trim();
}

const payload = {
  tool: id,
  package: packageName,
  label,
  generatedAt: new Date().toISOString(),
  ok: false,
  reason,
  exitCode: Number(exitCode) || 0,
  stderr: stderr.slice(0, 8000),
  data: [],
};

fs.writeFileSync(outfile, `${JSON.stringify(payload, null, 2)}\n`);
NODE
}

build_common_args() {
  COMMON_ARGS=("$REPORT" "--json")

  if [[ -n "${CCUSAGE_SINCE:-}" ]]; then
    COMMON_ARGS+=("--since" "$CCUSAGE_SINCE")
  fi

  if [[ -n "${CCUSAGE_UNTIL:-}" ]]; then
    COMMON_ARGS+=("--until" "$CCUSAGE_UNTIL")
  fi

  if [[ -n "${CCUSAGE_TIMEZONE:-}" ]]; then
    COMMON_ARGS+=("--timezone" "$CCUSAGE_TIMEZONE")
  fi

  if [[ -n "${CCUSAGE_LOCALE:-}" ]]; then
    COMMON_ARGS+=("--locale" "$CCUSAGE_LOCALE")
  fi

  if [[ -n "${CCUSAGE_MODE:-}" ]]; then
    COMMON_ARGS+=("--mode" "$CCUSAGE_MODE")
  fi

  EXTRA_ARGS=()
  if [[ -n "${CCUSAGE_EXTRA_ARGS:-}" ]]; then
    read -r -a EXTRA_ARGS <<< "$CCUSAGE_EXTRA_ARGS"
  fi
}

export_tool() {
  local spec="$1"
  local id package label
  IFS='|' read -r id package label <<< "$spec"

  local outfile="$DATA_DIR/$id.json"
  local tmpfile errfile exit_code
  tmpfile="$(mktemp "$DATA_DIR/.$id.XXXXXX.json")"
  errfile="$(mktemp "$DATA_DIR/.$id.XXXXXX.err")"

  local cmd=(bunx "$package" "${COMMON_ARGS[@]}" "${EXTRA_ARGS[@]}")
  log "Exporting $label with: ${cmd[*]}"

  if "${cmd[@]}" >"$tmpfile" 2>"$errfile"; then
    if [[ ! -s "$tmpfile" ]]; then
      warn "$label produced empty output; writing a placeholder."
      write_placeholder "$outfile" "$id" "$package" "$label" "0" "empty_output" "$errfile"
    elif validate_json "$tmpfile"; then
      mv "$tmpfile" "$outfile"
      log "Saved $outfile"
    else
      warn "$label did not produce valid JSON; writing a placeholder."
      write_placeholder "$outfile" "$id" "$package" "$label" "0" "invalid_json" "$errfile"
    fi
  else
    exit_code=$?
    warn "$label export failed with exit code $exit_code; writing a placeholder."
    write_placeholder "$outfile" "$id" "$package" "$label" "$exit_code" "command_failed" "$errfile"
  fi

  rm -f "$tmpfile" "$errfile"
}

commit_and_push() {
  if [[ "$COMMIT_DATA" != "1" ]]; then
    log "Skipping commit because CCUSAGE_COMMIT=$COMMIT_DATA."
    return 0
  fi

  if ! git -C "$ROOT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    warn "Skipping commit and push because $ROOT_DIR is not a git work tree."
    return 0
  fi

  git -C "$ROOT_DIR" add -- data

  if git -C "$ROOT_DIR" diff --cached --quiet -- data; then
    log "No data changes to commit."
    return 0
  fi

  git -C "$ROOT_DIR" commit -m "$COMMIT_MESSAGE"

  if [[ "$PUSH_DATA" != "1" ]]; then
    log "Skipping push because CCUSAGE_PUSH=$PUSH_DATA."
    return 0
  fi

  if git -C "$ROOT_DIR" remote get-url "$REMOTE" >/dev/null 2>&1; then
    git -C "$ROOT_DIR" push "$REMOTE" "$PUSH_REF"
  else
    warn "Skipping push because git remote '$REMOTE' is not configured."
  fi
}

main() {
  require_command bunx
  require_command node

  mkdir -p "$DATA_DIR"
  build_common_args

  for tool in "${TOOLS[@]}"; do
    export_tool "$tool"
  done

  commit_and_push
}

main "$@"
