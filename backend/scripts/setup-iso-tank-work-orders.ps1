# Creates manufacturing setup (routing + profile) for the imported 26KL ISO Tank BOM
# (BOM-000 / item 001) and then creates 5 manual work orders. Idempotent — safe to re-run.
$ErrorActionPreference = 'Stop'
$base = 'http://localhost:5000/api/v1'
$slug = 'vasant-trailers'

$loginBody = @{ tenantSlug = $slug; email = 'super@fos-erp.com'; password = 'Super@123' } | ConvertTo-Json
$login = Invoke-RestMethod -Method Post -Uri "$base/auth/login" -ContentType 'application/json' -Body $loginBody
$h = @{ Authorization = "Bearer $($login.data.accessToken)" }

function Post($path, $obj) {
  Invoke-RestMethod -Method Post -Uri "$base/t/$slug/$path" -Headers $h -ContentType 'application/json' -Body ($obj | ConvertTo-Json -Depth 6)
}
function Get-Api($path) {
  Invoke-RestMethod -Uri "$base/t/$slug/$path" -Headers $h
}

# ── 1. FG item ────────────────────────────────────────────────────────────
$items = Get-Api 'masters/items?limit=100&itemType=finished_good'
$fg = @($items.data) | Where-Object { $_.code -eq '001' }
if (-not $fg) { throw 'FG item 001 not found' }
Write-Host "FG item : $($fg.code) — $($fg.name)"

# ── 2. Active BOM version of BOM-000 ─────────────────────────────────────
$boms = Get-Api 'manufacturing/boms?limit=100'
$bom = @($boms.data) | Where-Object { $_.code -eq 'BOM-000' }
if (-not $bom) { throw 'BOM-000 not found' }
$bomVer = @($bom.versions) | Where-Object { $_.status -eq 'ACTIVE' } | Select-Object -First 1
if (-not $bomVer) { throw 'No ACTIVE version on BOM-000' }
Write-Host "BOM     : $($bom.code) version $($bomVer.versionNumber) / $($bomVer.revisionCode) ($($bomVer.status))"

# ── 3. Work centre ────────────────────────────────────────────────────────
$wcs = Get-Api 'manufacturing/work-centres?limit=100'
$wc = @($wcs.data) | Where-Object { $_.code -eq 'WC-TANK-ASSY' }
if (-not $wc) {
  $wc = (Post 'manufacturing/work-centres' @{
    code = 'WC-TANK-ASSY'; name = 'Tank Fabrication & Assembly Bay'
    description = 'Main bay for ISO tank container fabrication, assembly and testing'
    capacityPerShift = 8
  }).data
  Write-Host "Created work centre WC-TANK-ASSY"
} else { Write-Host "Work centre WC-TANK-ASSY exists" }

# ── 4. Routing + version + stages + operations ───────────────────────────
$routings = Get-Api 'manufacturing/routings?limit=100'
$routing = @($routings.data) | Where-Object { $_.code -eq 'RT-ISO-26KL' }
if (-not $routing) {
  $routing = (Post 'manufacturing/routings' @{
    code = 'RT-ISO-26KL'; name = '26 KL ISO Tank Container Routing'
    productItemId = $fg.id
    description = 'Shell fabrication, frame fabrication, assembly, testing and finishing for 26KL ISO tank'
  }).data
  Write-Host "Created routing RT-ISO-26KL"
} else { Write-Host "Routing RT-ISO-26KL exists" }

$vers = Get-Api "manufacturing/routings/$($routing.id)/versions?limit=50"
$ver = @($vers.data) | Where-Object { $_.status -eq 'ACTIVE' } | Select-Object -First 1
if (-not $ver) {
  $ver = @($vers.data) | Where-Object { $_.status -eq 'DRAFT' } | Select-Object -First 1
  if (-not $ver) {
    $ver = (Post "manufacturing/routings/$($routing.id)/versions" @{
      revisionCode = 'A'; effectiveFrom = (Get-Date -Format 'yyyy-MM-dd')
      revisionNotes = 'Initial routing for imported 26KL ISO tank BOM'
    }).data
    Write-Host "Created routing version A (DRAFT)"
  }

  # Stage groups
  $sgFab = (Post "manufacturing/routing-versions/$($ver.id)/stage-groups" @{
    code = 'SG-FAB'; name = 'Shell & Frame Fabrication'; displayOrder = 1
    defaultWorkCentreId = $wc.id
  }).data
  $sgAssy = (Post "manufacturing/routing-versions/$($ver.id)/stage-groups" @{
    code = 'SG-ASSY'; name = 'Assembly & Welding'; displayOrder = 2
    defaultWorkCentreId = $wc.id
  }).data
  $sgTest = (Post "manufacturing/routing-versions/$($ver.id)/stage-groups" @{
    code = 'SG-TEST'; name = 'Testing & Finishing'; displayOrder = 3
    defaultWorkCentreId = $wc.id; qualityRequired = $true
  }).data
  Write-Host "Created 3 stage groups"

  # Operations
  $ops = @(
    @{ stageGroupId = $sgFab.id;  code = 'OP-10'; name = 'Shell rolling & long-seam welding'; sequence = 10; setupTimeMinutes = 60;  runTimeValue = 480; runTimeBasis = 'PER_UNIT' },
    @{ stageGroupId = $sgFab.id;  code = 'OP-20'; name = 'ISO frame fabrication';             sequence = 20; setupTimeMinutes = 45;  runTimeValue = 360; runTimeBasis = 'PER_UNIT' },
    @{ stageGroupId = $sgAssy.id; code = 'OP-30'; name = 'Tank-to-frame assembly';            sequence = 30; setupTimeMinutes = 30;  runTimeValue = 300; runTimeBasis = 'PER_UNIT' },
    @{ stageGroupId = $sgAssy.id; code = 'OP-40'; name = 'Piping, valves & fittings';         sequence = 40; setupTimeMinutes = 30;  runTimeValue = 240; runTimeBasis = 'PER_UNIT' },
    @{ stageGroupId = $sgTest.id; code = 'OP-50'; name = 'Hydro & pneumatic testing';         sequence = 50; setupTimeMinutes = 60;  runTimeValue = 180; runTimeBasis = 'PER_UNIT'; qualityRequired = $true },
    @{ stageGroupId = $sgTest.id; code = 'OP-60'; name = 'Painting & final inspection';       sequence = 60; setupTimeMinutes = 30;  runTimeValue = 240; runTimeBasis = 'PER_UNIT'; outputType = 'FINISHED_GOOD'; outputItemId = $fg.id }
  )
  foreach ($op in $ops) {
    $op.workCentreId = $wc.id
    Post "manufacturing/routing-versions/$($ver.id)/operations" $op | Out-Null
  }
  Write-Host "Created $($ops.Count) operations"

  $ver = (Post "manufacturing/routing-versions/$($ver.id)/activate" @{}).data
  Write-Host "Routing version activated: $($ver.status)"
} else { Write-Host "Routing version already ACTIVE" }

# ── 5. Manufacturing profile ─────────────────────────────────────────────
$profiles = Get-Api "manufacturing/profiles?limit=100&productItemId=$($fg.id)"
$profile = @($profiles.data) | Where-Object { $_.isActive } | Select-Object -First 1
if (-not $profile) {
  $profile = (Post 'manufacturing/profiles' @{
    code = 'PROF-ISO-26KL'; name = '26 KL ISO Tank Container Profile'
    productItemId = $fg.id
    productionType = 'ASSEMBLY'
    executionMode = 'SIMPLE'
    defaultBomVersionId = $bomVer.id
    defaultRoutingVersionId = $ver.id
    planningMethod = 'MANUAL'
    materialConsumptionMethod = 'ACTUAL'
    directProductionOrderAllowed = $true
    isActive = $true
  }).data
  Write-Host "Created manufacturing profile PROF-ISO-26KL"
} else { Write-Host "Active profile exists: $($profile.code)" }

# ── 6. Work orders ───────────────────────────────────────────────────────
$today = Get-Date
$orders = @(
  @{ qty = 1; prio = 'URGENT'; days = 20; job = 'JOB-ISO-26KL-001'; notes = 'Rush order - export shipment, Mundra port cutoff' },
  @{ qty = 2; prio = 'HIGH';   days = 35; job = 'JOB-ISO-26KL-002'; notes = 'Repeat customer order - 2 units 26KL ISO tank' },
  @{ qty = 3; prio = 'MEDIUM'; days = 50; job = 'JOB-ISO-26KL-003'; notes = 'Fleet order batch 1 of 2' },
  @{ qty = 2; prio = 'MEDIUM'; days = 65; job = 'JOB-ISO-26KL-004'; notes = 'Fleet order batch 2 of 2' },
  @{ qty = 1; prio = 'LOW';    days = 80; job = 'JOB-ISO-26KL-005'; notes = 'Stock build - demo/inventory unit' }
)
$created = @()
foreach ($o in $orders) {
  $r = Post 'manufacturing/work-orders' @{
    productItemId          = $fg.id
    plannedQuantity        = $o.qty
    requiredCompletionDate = $today.AddDays($o.days).ToString('yyyy-MM-dd')
    plannedStartDate       = $today.AddDays(3).ToString('yyyy-MM-dd')
    priority               = $o.prio
    jobNumber              = $o.job
    notes                  = $o.notes
    idempotencyKey         = "wo-bom000-$($o.job.ToLowerInvariant())"
  }
  $created += [pscustomobject]@{
    orderNumber = $r.data.orderNumber
    status      = $r.data.status
    qty         = $r.data.plannedQuantity
    priority    = $r.data.priority
    job         = $r.data.jobNumber
    due         = ($r.data.requiredCompletionDate -split 'T')[0]
  }
}
$created | Format-Table -AutoSize | Out-String -Width 200 | Write-Host
Write-Host "Created/verified $($created.Count) work orders for BOM-000"
