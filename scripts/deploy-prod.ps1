$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$EnvFile = if ($env:ENV_FILE) { $env:ENV_FILE } else { ".env.production" }

if (-not (Test-Path $EnvFile)) {
  if (Test-Path ".env.production.example") {
    Copy-Item ".env.production.example" $EnvFile
    Write-Host "Created $EnvFile from .env.production.example — edit secrets, then re-run."
    exit 1
  }
  Write-Error "Missing $EnvFile"
}

docker compose --env-file $EnvFile up --build -d

$HttpPort = if ($env:HTTP_PORT) { $env:HTTP_PORT } else { "80" }
Write-Host "Deployed. Health: curl -s http://localhost:$HttpPort/api/v1/health"
