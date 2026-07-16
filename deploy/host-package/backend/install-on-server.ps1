# Run ON the Linux/Windows host after upload (not for cross-OS node_modules copy)
Set-Location $PSScriptRoot
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
Write-Host "Edit .env with MySQL + JWT secrets"
npm ci
npx prisma generate
npx tsx scripts/prisma-cli.ts migrate deploy
Write-Host "Optional: npm run db:seed"
Write-Host "Start: npm run start"
