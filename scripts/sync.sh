#!/usr/bin/env bash
set -euo pipefail

# BurnRate Sync Script
# This script automates:
# 1. Exporting usage data
# 2. Generating the SVG card
# 3. Committing and Pushing to GitHub (with smart conflict resolution)

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "🚀 Starting BurnRate sync process..."

# 1. Export Data
echo "📥 Exporting latest usage data..."
# We disable the internal push of the export script because we handle it here
CCUSAGE_PUSH=0 bun run export:data

# 2. Generate Card
echo "🎨 Generating statistics card..."
bun run generate:card

# 3. Smart Git Sync
echo "🔄 Synchronizing with GitHub..."

# Check if there are any changes
if [[ -z "$(git status --porcelain)" ]]; then
    echo "✅ No changes detected. Workspace is up to date."
    exit 0
fi

# Add all changes
git add .

# Create a local commit
# We use || true in case there are no changes to commit (though porcelain check should cover it)
git commit -m "chore: update ccusage data and card (automated sync)" || echo "⚠️ Nothing to commit."

# Pull from remote with rebase and automatic conflict resolution for assets
# -X theirs tells git to favor our local version (the one just generated) for any conflicts
echo "📡 Pulling remote updates..."
git pull origin main --rebase -X theirs

# Final Push
echo "⬆️ Pushing to GitHub..."
git push origin main

echo "✨ Sync complete! Your stats are now live."
