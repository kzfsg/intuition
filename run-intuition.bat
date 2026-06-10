@echo off
REM ---------------------------------------------------------------------------
REM  Launch the local dev build of Intuition (the VS Code fork).
REM  Double-click this file, or run it from a terminal in the repo root.
REM  Prereq: the build is already done (native modules + `out/` + .build/electron).
REM ---------------------------------------------------------------------------
cd /d "%~dp0"

set VSCODE_DEV=1
set NODE_ENV=development
set VSCODE_CLI=1
set VSCODE_SKIP_PRELAUNCH=1
set ELECTRON_ENABLE_LOGGING=1

echo Launching Intuition...
".build\electron\Intuition.exe" . --disable-extension=vscode.vscode-api-tests %*
