$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
node node_modules/vite/bin/vite.js --host 0.0.0.0
