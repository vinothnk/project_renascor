@echo off
cd /d "%~dp0"
"C:\Users\wooo_\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" "node_modules\next\dist\bin\next" dev --hostname 127.0.0.1 --port 3000 > ".next-dev.log" 2> ".next-dev.err"
