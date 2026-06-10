#!/usr/bin/env bash
# ---------------------------------------------------------------------------
#  Launch the local dev build of Intuition (the VS Code fork) on macOS/Linux.
#  Run from anywhere:  ./run-intuition.sh [folder-to-open] [code.sh args...]
#
#  Companion to run-intuition.bat (Windows). Unlike the .bat, this wraps
#  scripts/code.sh, which compiles out/ and downloads Electron if missing —
#  so a fresh clone works too (first run is slow).
#
#  Recompile after source changes:  npm run compile   (or `npm run watch`)
# ---------------------------------------------------------------------------
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"

# Use the repo's pinned Node (.nvmrc → 24.15.0) when nvm is available.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ -s "$NVM_DIR/nvm.sh" ]; then
	# nvm is a shell function; sourcing is required before `nvm use`.
	. "$NVM_DIR/nvm.sh"
	nvm use >/dev/null
fi

WANT="$(cat .nvmrc)"
HAVE="$(node --version 2>/dev/null || echo none)"
if [ "v$WANT" != "$HAVE" ]; then
	echo "warning: repo wants Node v$WANT but 'node' is $HAVE (install via: nvm install $WANT)" >&2
fi

echo "Launching Intuition..."
exec ./scripts/code.sh "$@"
