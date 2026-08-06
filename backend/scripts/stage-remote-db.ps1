# Shared helpers - connect to Hostinger MySQL remotely (no SSH).
# Do NOT commit passwords. Set DB_PASS in your shell or pass -DbPass.
#
# Example:
#   . .\scripts\stage-remote-db.ps1
#   Set-StageRemoteDbEnv -DbPass 'your-password'
#   Invoke-StageMigrateDeployLoop
#   Invoke-StagePrApproveDebug -PrId '4df7a5be-0ef5-4c85-86ec-8e8f51d5a4ba'

$ErrorActionPreference = 'Stop'

function Set-StageRemoteDbEnv {
  param(
    [string]$DbHost = $(if ($env:DB_HOST) { $env:DB_HOST } else { 'srv1491.hstgr.io' }),
    [string]$DbPort = $(if ($env:DB_PORT) { $env:DB_PORT } else { '3306' }),
    [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { 'u233611619_foserp' }),
    [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { 'u233611619_erpuser_jul' }),
    [Parameter(Mandatory = $false)]
    [string]$DbPass = $env:DB_PASS
  )

  if (-not $DbPass) {
    throw 'DbPass is required. Set $env:DB_PASS or pass -DbPass. Do not commit passwords to git.'
  }

  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  $env:DB_HOST = $DbHost
  $env:DB_PORT = $DbPort
  $env:DB_NAME = $DbName
  $env:DB_USER = $DbUser
  $env:DB_PASS = $DbPass

  Write-Host ("Stage DB env -> {0}@{1}:{2}/{3}" -f $DbUser, $DbHost, $DbPort, $DbName) -ForegroundColor DarkGray
}

function Invoke-StageNpx {
  param([Parameter(Mandatory)][string[]]$Args)
  Push-Location (Join-Path $PSScriptRoot '..')
  try {
    & npx @Args
    if ($LASTEXITCODE -ne 0) { throw ("Command failed (exit {0}): npx {1}" -f $LASTEXITCODE, ($Args -join ' ')) }
  } finally {
    Pop-Location
  }
}

function Invoke-StagePrisma {
  param([Parameter(Mandatory)][string[]]$PrismaArgs)
  Invoke-StageNpx -Args @('tsx', 'scripts/prisma-cli.ts') + $PrismaArgs
}

function Get-MigrationNameFromDeployOutput {
  param([string]$Output)
  if ($Output -match 'Migration name: ([0-9A-Za-z_]+)') {
    return $Matches[1]
  }
  if ($Output -match 'The `(\d{14}[^`\r\n]+)` migration') {
    return $Matches[1]
  }
  return $null
}

function Invoke-StageMigrateDeployLoop {
  # Runs prisma migrate deploy in a loop; auto-resolves duplicate-column migrations (1060/1050).
  $iteration = 0
  while ($true) {
    $iteration++
    Write-Host ""
    Write-Host ("=== migrate deploy (pass {0}) ===" -f $iteration) -ForegroundColor Cyan
    Push-Location (Join-Path $PSScriptRoot '..')
    try {
      $out = & npx tsx scripts/prisma-cli.ts migrate deploy 2>&1 | Out-String
    } finally {
      Pop-Location
    }
    Write-Host $out

    if ($out -match 'No pending migrations|Database schema is up to date|All migrations have been successfully applied') {
      Write-Host 'DONE - migrations complete.' -ForegroundColor Green
      break
    }

    $name = Get-MigrationNameFromDeployOutput -Output $out

    if ($name -and ($out -match '1060|1050|Duplicate column|already exists')) {
      Write-Host ("Auto-resolving duplicate migration: {0}" -f $name) -ForegroundColor Yellow
      Invoke-StagePrisma -PrismaArgs @('migrate', 'resolve', '--applied', $name)
      continue
    }

    Write-Host ("STOP - needs manual fix (not a simple duplicate). Last migration: {0}" -f $name) -ForegroundColor Red
    break
  }

  Write-Host ""
  Write-Host '=== migrate status ===' -ForegroundColor Cyan
  Invoke-StagePrisma -PrismaArgs @('migrate', 'status')
}

function Invoke-StagePrApproveSchemaAudit {
  param([string]$PrId = $(if ($env:PR_ID) { $env:PR_ID } else { '4df7a5be-0ef5-4c85-86ec-8e8f51d5a4ba' }))
  $env:PR_ID = $PrId
  Write-Host ""
  Write-Host '=== PR approve schema audit ===' -ForegroundColor Cyan
  Invoke-StageNpx -Args @('tsx', 'scripts/audit-pr-approve-schema.ts')
}

function Invoke-StagePrApproveProbe {
  param(
    [string]$PrId = $(if ($env:PR_ID) { $env:PR_ID } else { '4df7a5be-0ef5-4c85-86ec-8e8f51d5a4ba' }),
    [string]$TenantSlug = $(if ($env:TENANT_SLUG) { $env:TENANT_SLUG } else { 'vasant-trailers' })
  )
  $env:PR_ID = $PrId
  $env:TENANT_SLUG = $TenantSlug
  Write-Host ""
  Write-Host '=== PR approve Prisma probe ===' -ForegroundColor Cyan
  Invoke-StageNpx -Args @('tsx', 'scripts/probe-pr-approve-live.ts')
}

function Invoke-StagePrApproveDebug {
  param(
    [string]$PrId = $(if ($env:PR_ID) { $env:PR_ID } else { '4df7a5be-0ef5-4c85-86ec-8e8f51d5a4ba' }),
    [string]$TenantSlug = $(if ($env:TENANT_SLUG) { $env:TENANT_SLUG } else { 'vasant-trailers' }),
    [switch]$SkipMigrate
  )
  Write-Host '=== Stage PR approve debug (remote DB, no SSH) ===' -ForegroundColor Magenta
  Write-Host ("PR_ID={0} TENANT_SLUG={1}" -f $PrId, $TenantSlug)

  if (-not $SkipMigrate) {
    Invoke-StageMigrateDeployLoop
  } else {
    Write-Host 'Skipping migrate deploy (-SkipMigrate)' -ForegroundColor DarkYellow
  }

  Invoke-StagePrApproveSchemaAudit -PrId $PrId
  Invoke-StagePrApproveProbe -PrId $PrId -TenantSlug $TenantSlug

  Write-Host ""
  Write-Host 'Next if probe OK but API still 500:' -ForegroundColor Yellow
  Write-Host '  1. Run scripts/live-fix-pr-approve-500.sql in phpMyAdmin if audit failed'
  Write-Host '  2. Hostinger hPanel -> Stop -> Start Node app (prisma generate on boot)'
  Write-Host '  3. Retry POST .../purchase/requisitions/{id}/approve'
}
