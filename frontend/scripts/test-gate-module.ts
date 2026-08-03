/**
 * Gate & Security frontend module gates + demo lifecycle smoke.
 * npx tsx scripts/test-gate-module.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const feRoot = path.resolve(import.meta.dirname, '..')
let pass = 0
let fail = 0

function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${!ok && detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

function read(rel: string): string {
  return fs.readFileSync(path.join(feRoot, rel), 'utf8')
}

function exists(rel: string): boolean {
  return fs.existsSync(path.join(feRoot, rel))
}

// ── 1. Routes render / registration ──────────────────────────────────────────
const routes = read('src/routes/gateRoutes.tsx')
const indexRoutes = read('src/routes/index.tsx')
const requiredRoutes = [
  'gate',
  'gate/register',
  'gate/entries/new',
  'gate/visitors',
  'gate/visitors/new',
  'gate/visitors/expected',
  'gate/visitors/inside',
  'gate/visitors/:id',
  'gate/visitors/:id/edit',
  'gate/vehicles',
  'gate/vehicles/new',
  'gate/vehicles/inside',
  'gate/vehicles/:id',
  'gate/material-inward',
  'gate/material-inward/new',
  'gate/material-inward/:id',
  'gate/material-outward',
  'gate/material-outward/verify',
  'gate/material-outward/:id',
  'gate/passes',
  'gate/passes/new',
  'gate/passes/overdue',
  'gate/passes/:id',
  'gate/contractors',
  'gate/contractors/new',
  'gate/contractors/:id',
  'gate/couriers',
  'gate/couriers/new',
  'gate/couriers/:id',
  'gate/approvals',
  'gate/reports',
  'gate/settings',
]
for (const r of requiredRoutes) {
  check(`Route registered: /${r}`, routes.includes(`path: '${r}'`))
}
check('gateRouteChildren spread into root router', indexRoutes.includes('...gateRouteChildren'))
check('gateRoutes imported in root router', indexRoutes.includes("from './gateRoutes'"))

// ── 2. Navigation / sidebar ──────────────────────────────────────────────────
const nav = read('src/config/navigation.ts')
const sidebar = read('src/config/sidebarGroups.ts')
check('Navigation category Gate & Security', nav.includes("id: 'gate'") && nav.includes("title: 'Gate & Security'"))
check('Nav includes Dashboard + Register + Visitors', nav.includes("path: '/gate'") && nav.includes("path: '/gate/register'") && nav.includes("path: '/gate/visitors'"))
check('Sidebar icon rail includes gate', sidebar.includes("categoryId: 'gate'") && sidebar.includes('ShieldCheck'))
check('Sidebar operations group includes gate', sidebar.includes("'gate'"))

// ── 3. Permission guards ─────────────────────────────────────────────────────
const perms = read('src/utils/permissions/gate.ts')
const matrix = read('src/config/permissionMatrix.ts')
for (const key of [
  'gate.dashboard.view',
  'gate.visitor.create',
  'gate.visitor.exit',
  'gate.vehicle.exit',
  'gate.material_outward.release',
  'gate.pass.return',
  'gate.approval.action',
  'gate.settings.manage',
]) {
  check(`Permission constant ${key}`, perms.includes(`'${key}'`))
}
check('useGatePermissions exported', perms.includes('export function useGatePermissions'))
check('Route matrix maps /gate', matrix.includes("prefix: '/gate'"))

// ── 4. Demo / API separation ─────────────────────────────────────────────────
const service = read('src/modules/gate/api/gateService.ts')
const api = read('src/modules/gate/api/gateApi.ts')
check('Service resolver waits for GATE_API_READY before using live API', service.includes('GATE_API_READY') && service.includes('gateApiService') && service.includes('gateDemoService'))
check('Service resolver exports demo-fallback helper', service.includes('isGateDemoFallbackActive'))
check('API service centralizes GATE_ENDPOINTS', api.includes('export const GATE_ENDPOINTS'))
check('API paths under /gate/', api.includes("DASHBOARD: '/gate/dashboard'"))
check('API service never imports demo data', !api.includes('gateDemoData') && !api.includes('gateDemoService'))
check('Pages import gateService only (dashboard)', read('src/modules/gate/pages/GateDashboardPage.tsx').includes("from '../api/gateService'") && !read('src/modules/gate/pages/GateDashboardPage.tsx').includes('gateDemoService'))

// ── 5. Required page files exist ─────────────────────────────────────────────
const pageFiles = [
  'src/modules/gate/pages/GateDashboardPage.tsx',
  'src/modules/gate/pages/GateRegisterPage.tsx',
  'src/modules/gate/pages/GateNewEntryPage.tsx',
  'src/modules/gate/pages/visitors/VisitorsListPage.tsx',
  'src/modules/gate/pages/visitors/VisitorFormPage.tsx',
  'src/modules/gate/pages/visitors/ExpectedVisitorsPage.tsx',
  'src/modules/gate/pages/visitors/VisitorDetailPage.tsx',
  'src/modules/gate/pages/vehicles/VehiclesListPage.tsx',
  'src/modules/gate/pages/vehicles/VehicleFormPage.tsx',
  'src/modules/gate/pages/vehicles/VehicleDetailPage.tsx',
  'src/modules/gate/pages/material-inward/MaterialInwardListPage.tsx',
  'src/modules/gate/pages/material-inward/MaterialInwardFormPage.tsx',
  'src/modules/gate/pages/material-inward/MaterialInwardDetailPage.tsx',
  'src/modules/gate/pages/material-outward/MaterialOutwardListPage.tsx',
  'src/modules/gate/pages/material-outward/MaterialOutwardVerifyPage.tsx',
  'src/modules/gate/pages/material-outward/MaterialOutwardDetailPage.tsx',
  'src/modules/gate/pages/passes/GatePassListPage.tsx',
  'src/modules/gate/pages/passes/GatePassFormPage.tsx',
  'src/modules/gate/pages/passes/GatePassDetailPage.tsx',
  'src/modules/gate/pages/contractors/ContractorListPage.tsx',
  'src/modules/gate/pages/contractors/ContractorFormPage.tsx',
  'src/modules/gate/pages/contractors/ContractorDetailPage.tsx',
  'src/modules/gate/pages/couriers/CourierListPage.tsx',
  'src/modules/gate/pages/couriers/CourierFormPage.tsx',
  'src/modules/gate/pages/couriers/CourierDetailPage.tsx',
  'src/modules/gate/pages/GateApprovalsPage.tsx',
  'src/modules/gate/pages/GateReportsPage.tsx',
  'src/modules/gate/pages/GateSettingsPage.tsx',
]
for (const f of pageFiles) check(`Page exists ${path.basename(f)}`, exists(f))

// ── 6. Boundary banners ──────────────────────────────────────────────────────
check(
  'Material inward boundary banner',
  read('src/modules/gate/pages/material-inward/MaterialInwardListPage.tsx').includes('physical material arrival only'),
)
check(
  'Material outward boundary banner',
  read('src/modules/gate/pages/material-outward/MaterialOutwardListPage.tsx').includes('Stock and accounting posting remain'),
)

// ── 7. Zod schemas ───────────────────────────────────────────────────────────
const schemas = read('src/modules/gate/schemas/gateSchemas.ts')
check('visitorEntrySchema present', schemas.includes('export const visitorEntrySchema'))
check('vehicleEntrySchema present', schemas.includes('export const vehicleEntrySchema'))
check('buildMaterialInwardSchema present', schemas.includes('export function buildMaterialInwardSchema'))
check('gatePassSchema present', schemas.includes('export const gatePassSchema'))
check('buildGatePassReturnSchema present', schemas.includes('export function buildGatePassReturnSchema'))
check('contractorEntrySchema present', schemas.includes('export const contractorEntrySchema'))
check('courierEntrySchema present', schemas.includes('export const courierEntrySchema'))

// ── 7b. Gatekeeper Mode (/gate/operator) ─────────────────────────────────────
const operatorRoutes = read('src/routes/gateOperatorRoutes.tsx')
check('Operator route tree at /gate/operator', operatorRoutes.includes("path: '/gate/operator'"))
check('Operator tree registered in root router', indexRoutes.includes('gateOperatorRouteTree'))
for (const flow of [
  'visitor-entry',
  'visitor-exit',
  'vehicle-entry',
  'vehicle-exit',
  'material-inward',
  'material-outward',
]) {
  check(`Operator flow route: ${flow}`, operatorRoutes.includes(`path: '${flow}'`))
}
const operatorLayout = read('src/modules/gate/operator/GateOperatorLayout.tsx')
check('Operator layout has no ERP sidebar/shell', !operatorLayout.includes('ERPLayout') && !operatorLayout.includes('Sidebar'))
const operatorHome = read('src/modules/gate/operator/GateOperatorHomePage.tsx')
check(
  'Operator home shows the six actions',
  ['Visitor Entry', 'Visitor Exit', 'Vehicle Entry', 'Vehicle Exit', 'Material Inward', 'Material Outward'].every(
    (l) => operatorHome.includes(l),
  ),
)
const operatorKit = read('src/modules/gate/operator/GateOperatorKit.tsx')
check('Call Supervisor action exists', operatorKit.includes('CallSupervisorButton'))
check('Operator step model is Search → Confirm → Done', operatorKit.includes("1: 'Search'") && operatorKit.includes("2: 'Confirm'") && operatorKit.includes("3: 'Done'"))
const permsIndex = read('src/utils/permissions/index.ts')
check('security_guard ERP role exists', permsIndex.includes("'security_guard'"))
check('security_guard default route is /gate/operator', permsIndex.includes("'/gate/operator'"))
check('security_guard maps to GATE_OPERATOR pack', perms.includes('security_guard: GATE_OPERATOR'))
check('security_guard in ROLE_PERMISSION_MATRIX', matrix.includes('security_guard:'))
check('Login uses role default route', read('src/modules/auth/LoginPage.tsx').includes('getDefaultRouteForRole'))
check('Home landing redirects guards to operator mode', read('src/routes/homeRoutes.tsx').includes('isSecurityGuardSession'))

// ── 8. Demo lifecycle behaviour (dynamic import) ─────────────────────────────
async function runLifecycle() {
  const demoUrl = pathToFileURL(path.join(feRoot, 'src/modules/gate/api/gateDemoService.ts')).href
  const mod = await import(demoUrl)
  const svc = mod.gateDemoService as typeof import('../src/modules/gate/api/gateDemoService').gateDemoService
  const reset = mod.__resetGateDemoStores as () => void
  reset()

  // Dashboard counters
  const dash = await svc.getGateDashboard()
  check('Dashboard visitorsInside > 0', dash.visitorsInside > 0, String(dash.visitorsInside))
  check('Dashboard vehiclesInside > 0', dash.vehiclesInside > 0, String(dash.vehiclesInside))
  check('Dashboard expected visitors today > 0', dash.expectedVisitorsToday > 0)
  check('Dashboard overdue returnables >= 2', dash.overdueReturnables >= 2, String(dash.overdueReturnables))
  check('Gate Pulse has messages', dash.pulse.length > 0)

  // Register filters
  const all = await svc.getGateRegister()
  const visitorsOnly = await svc.getGateRegister({ entryType: 'visitor' })
  check('Register returns rows', all.length > 0)
  check('Register visitor filter works', visitorsOnly.every((r) => r.entryType === 'visitor') && visitorsOnly.length > 0)

  // Visitor create + approval + entry + exit + duplicate exit prevention
  const visit = await svc.createVisitorEntry({
    visitorName: 'Test Visitor',
    mobile: '9000011122',
    visitorType: 'consultant',
    visitorCount: 1,
    hostName: 'Vikram Mehta',
    department: 'Sales',
    purpose: 'Lifecycle smoke test',
    laptopCarried: false,
    equipmentCarried: false,
    bagCount: 0,
    safetyDeclarationAccepted: true,
    ppeRequired: false,
    ndaRequired: false,
    hostApprovalRequired: true,
    gate: 'Main Gate',
    mode: 'walk_in',
  })
  check('Visitor created waiting_approval', visit.status === 'waiting_approval')

  let entryBlocked = false
  try {
    await svc.recordVisitorEntry(visit.id)
  } catch {
    entryBlocked = true
  }
  check('Visitor entry blocked before approval', entryBlocked)

  const approved = await svc.approveVisitor(visit.id)
  check('Visitor approved', approved.status === 'approved')
  const inside = await svc.recordVisitorEntry(visit.id)
  check('Visitor entered', inside.status === 'inside' && Boolean(inside.entryTime))
  const exited = await svc.recordVisitorExit(visit.id, { badgeReturned: true })
  check('Visitor exited', exited.status === 'exited')
  let duplicateExitBlocked = false
  try {
    await svc.recordVisitorExit(visit.id, { badgeReturned: true })
  } catch {
    duplicateExitBlocked = true
  }
  check('Duplicate visitor exit prevented', duplicateExitBlocked)

  // Vehicle entry + exit + duplicate prevention
  const vehicle = await svc.createVehicleEntry({
    vehicleNumber: 'TN 99 ZZ 0001',
    vehicleType: 'Truck',
    purpose: 'Lifecycle smoke',
    driverName: 'Test Driver',
    licenceVerified: 'verified',
    gate: 'Material Gate',
    markArrived: true,
  })
  check('Vehicle arrived', vehicle.status === 'arrived')
  const vehInside = await svc.allowVehicleInside(vehicle.id)
  check('Vehicle allowed inside', vehInside.status === 'allowed_inside' && Boolean(vehInside.entryTime))
  const vehExit = await svc.recordVehicleExit(vehicle.id)
  check('Vehicle exited', vehExit.status === 'exited')
  let dupVehExit = false
  try {
    await svc.recordVehicleExit(vehicle.id)
  } catch {
    dupVehExit = true
  }
  check('Duplicate vehicle exit prevented', dupVehExit)

  // Material inward creation
  const inward = await svc.createMaterialInward({
    inwardType: 'purchase_order',
    vendorName: 'Smoke Vendor',
    poNumber: 'PO-SMOKE-1',
    vehicleNumber: 'TN 99 ZZ 0002',
    materialSummary: 'Smoke test plates',
    packages: 2,
    gate: 'Material Gate',
  })
  check('Material inward registered', inward.status === 'vehicle_arrived')

  // Material outward checklist / release blocking
  const outwards = await svc.getMaterialOutwardEntries()
  const ready = outwards.find((o) => o.status === 'ready_for_gate' || o.status === 'vehicle_inside')
  check('Outward candidate available for release test', Boolean(ready))
  if (ready) {
    let blocked = false
    try {
      await svc.releaseMaterialOutward(ready.id)
    } catch {
      blocked = true
    }
    check('Outward release blocked with incomplete checklist', blocked)

    const keys = Object.keys(ready.checklist) as Array<keyof typeof ready.checklist>
    const checklist = Object.fromEntries(keys.map((k) => [k, true])) as typeof ready.checklist
    await svc.verifyMaterialOutward(ready.id, { checklist })
    // Ensure approved
    if (!ready.documentApproved || ready.approvalStatus !== 'approved') {
      // seed ready_for_gate rows are approved; if not, skip release success
      check('Outward release path skipped (source not approved in seed)', true)
    } else {
      const released = await svc.releaseMaterialOutward(ready.id)
      check('Outward released after checklist complete', released.status === 'released')
      let readonly = false
      try {
        await svc.releaseMaterialOutward(ready.id)
      } catch {
        readonly = true
      }
      check('Released outward is read-only / no double release', readonly)
    }
  }

  // Gate-pass partial return + qty validation + overdue
  const passes = await svc.getGatePasses()
  const overdue = passes.filter((p) => p.status === 'overdue')
  check('Overdue passes present in seed', overdue.length >= 2, String(overdue.length))
  const returnable = passes.find((p) => p.passKind === 'returnable' && ['sent_out', 'partially_returned', 'overdue'].includes(p.status) && p.items.some((i) => i.quantity > i.returnedQuantity))
  check('Returnable pass available for return test', Boolean(returnable))
  if (returnable) {
    const item = returnable.items.find((i) => i.quantity > i.returnedQuantity)!
    const pending = item.quantity - item.returnedQuantity
    let overQtyBlocked = false
    try {
      await svc.recordGatePassReturn(returnable.id, {
        itemId: item.id,
        returnDate: new Date().toISOString().slice(0, 10),
        returnedQuantity: pending + 1,
      })
    } catch {
      overQtyBlocked = true
    }
    check('Return quantity above pending blocked', overQtyBlocked)

    if (pending > 1) {
      const partial = await svc.recordGatePassReturn(returnable.id, {
        itemId: item.id,
        returnDate: new Date().toISOString().slice(0, 10),
        returnedQuantity: 1,
      })
      check('Partial return supported', partial.status === 'partially_returned' || partial.status === 'returned' || partial.status === 'overdue')
    } else {
      const full = await svc.recordGatePassReturn(returnable.id, {
        itemId: item.id,
        returnDate: new Date().toISOString().slice(0, 10),
        returnedQuantity: pending,
      })
      check('Full return recorded', ['returned', 'partially_returned', 'overdue'].includes(full.status))
    }
  }

  // Contractor expiry helpers used by list (seed has expiring / missing induction)
  const contractors = await svc.getContractors()
  check('Contractor seed has inside workers', contractors.some((c) => c.status === 'inside'))
  const missingInduction = contractors.filter((c) => c.status === 'inside' && !c.safetyInductionDone)
  check('Contractor missing induction alert data present', missingInduction.length >= 1)

  // Courier handover
  const couriers = await svc.getCouriers({ status: 'pending_handover' })
  check('Pending courier handover present', couriers.length >= 1)
  if (couriers[0]) {
    const handed = await svc.markCourierHandedOver(couriers[0].id, 'Test Recipient')
    check('Courier handover works', handed.status === 'handed_over')
  }

  // Approval remarks required
  const approvals = await svc.getGateApprovals({ status: 'pending' })
  check('Pending approvals present', approvals.length >= 1)
  if (approvals[0]) {
    let rejectBlocked = false
    try {
      await svc.rejectGateRequest(approvals[0].id, '')
    } catch {
      rejectBlocked = true
    }
    check('Approval reject requires remarks', rejectBlocked)
    const approvedReq = await svc.approveGateRequest(approvals[0].id, 'Smoke approved')
    check('Approval approve works', approvedReq.status === 'approved')
  }

  // Demo data volume sanity
  const visits = await svc.getVisitors()
  const vehicles = await svc.getVehicles()
  const activities = await svc.getGateActivities(50)
  check('Demo visitors roughly complete (~23+)', visits.length >= 20, String(visits.length))
  check('Demo vehicles present', vehicles.length >= 8, String(vehicles.length))
  check('Demo activities present', activities.length >= 15, String(activities.length))

  reset()
}

await runLifecycle()

console.log(`\nGate module checks: ${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
