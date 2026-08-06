# One-shot stage PR approve debugger (remote MySQL — no Hostinger SSH).
#
# Usage (set password once per session — do NOT commit passwords):
#   cd backend
#   $env:DB_PASS = 'your-stage-mysql-password'
#   .\scripts\stage-pr-approve-debug.ps1
#
# Optional:
#   .\scripts\stage-pr-approve-debug.ps1 -PrId '4df7a5be-0ef5-4c85-86ec-8e8f51d5a4ba' -SkipMigrate
#   .\scripts\stage-pr-approve-debug.ps1 -DbHost srv1491.hstgr.io -DbUser u233611619_erpuser_jul

param(
  [string]$PrId = $(if ($env:PR_ID) { $env:PR_ID } else { '4df7a5be-0ef5-4c85-86ec-8e8f51d5a4ba' }),
  [string]$TenantSlug = $(if ($env:TENANT_SLUG) { $env:TENANT_SLUG } else { 'vasant-trailers' }),
  [string]$DbHost = $(if ($env:DB_HOST) { $env:DB_HOST } else { 'srv1491.hstgr.io' }),
  [string]$DbPort = $(if ($env:DB_PORT) { $env:DB_PORT } else { '3306' }),
  [string]$DbName = $(if ($env:DB_NAME) { $env:DB_NAME } else { 'u233611619_foserp' }),
  [string]$DbUser = $(if ($env:DB_USER) { $env:DB_USER } else { 'u233611619_erpuser_jul' }),
  [string]$DbPass = $env:DB_PASS,
  [switch]$SkipMigrate,
  [ValidateSet('All', 'Migrate', 'Audit', 'Probe')]
  [string]$Action = 'All'
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'stage-remote-db.ps1')

Set-StageRemoteDbEnv -DbHost $DbHost -DbPort $DbPort -DbName $DbName -DbUser $DbUser -DbPass $DbPass

switch ($Action) {
  'Migrate' { Invoke-StageMigrateDeployLoop }
  'Audit'   { Invoke-StagePrApproveSchemaAudit -PrId $PrId }
  'Probe'   { Invoke-StagePrApproveProbe -PrId $PrId -TenantSlug $TenantSlug }
  default   { Invoke-StagePrApproveDebug -PrId $PrId -TenantSlug $TenantSlug -SkipMigrate:$SkipMigrate }
}
