/**
 * Phase 8C Wave 1 gates — mock leakage (8B-R-010) + inventory SPA gate (8B-R-015).
 * Static verification that API mode cannot reach demo/mock surfaces.
 * npx tsx scripts/test-phase8c-wave1-gates.ts
 */
import fs from 'node:fs'
import path from 'node:path'

const feRoot = path.resolve(import.meta.dirname, '..')
const repoRoot = path.resolve(feRoot, '..')
let pass = 0
let fail = 0

function check(label: string, ok: boolean) {
  console.log(`${ok ? '✓' : '✗'} ${label}`)
  ok ? pass++ : fail++
}

function read(rel: string, root = feRoot): string {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

// ── Central mock chrome gates ────────────────────────────────────────────────
const liveMock = read('src/hooks/useLiveActivityMock.ts')
check('useLiveActivityMock imports isApiMode', liveMock.includes("from '../config/apiConfig'"))
check('useLiveActivityMock disabled in API mode', liveMock.includes('enabled && !isApiMode()'))
check('useLiveActivityMock returns empty when inactive', liveMock.includes('return active ? events : []'))

const pulse = read('src/hooks/useLiveFactoryPulse.ts')
check('useLiveFactoryPulse gates on isApiMode', pulse.includes('const demoMode = !isApiMode()'))
check('useLiveFactoryPulse skips demo notifications in API mode', pulse.includes('demoMode ? getErpNotifications() : []'))
check('useLiveFactoryPulse skips demo store events in API mode', pulse.includes('demoMode ? storeLinkedEvents() : []'))
check('useLiveFactoryPulse live flag reflects mode', pulse.includes('live: demoMode'))

// ── Shared demo-only gate component ─────────────────────────────────────────
const gate = read('src/components/system/DemoOnlyRouteGate.tsx')
check('DemoOnlyRouteGate exports ApiModeDemoGatePage', gate.includes('export function ApiModeDemoGatePage'))
check('DemoOnlyRouteGate exports demoOnlyRoute helper', gate.includes('export function demoOnlyRoute'))
check('demoOnlyRoute switches on isApiMode', gate.includes('isApiMode() ? <ApiModeDemoGatePage'))

// ── Inventory SPA gate (8B-R-015) + Inventory 3A live overrides ─────────────
const inv = read('src/routes/inventoryRoutes.tsx')
check('inventoryRoutes imports ApiModeDemoGatePage', inv.includes('ApiModeDemoGatePage'))
check(
  'inventoryRoutes gates non-3A routes in API mode (live overrides only)',
  inv.includes("apiInventoryRouteOverrides[route.path ?? ''] ?? inventoryApiModeGate"),
)
check('inventoryRoutes serves live stock balances in API mode', inv.includes("'inventory/stock': <ApiStockBalancesPage />"))
check('inventoryRoutes serves live stock ledger in API mode', inv.includes("'inventory/ledger': <ApiStockLedgerPage />"))
check('inventoryRoutes serves live reservations in API mode', inv.includes("'inventory/reservations': <ApiReservationsPage />"))
check(
  'inventoryRoutes serves supported document registers in API mode',
  inv.includes("'inventory/movements/transfers': <ApiInventoryDocumentsPage kind=\"transfers\" />") &&
    inv.includes("'inventory/movements/adjustments': <ApiInventoryDocumentsPage kind=\"adjustments\" />") &&
    inv.includes("'inventory/stock-count': <ApiInventoryDocumentsPage kind=\"stock-counts\" />") &&
    !inv.includes("'inventory/movements/receipts': <ApiInventoryDocumentsPage"),
)
check('inventoryRoutes keeps demo mode intact', inv.includes(': demoInventoryRouteChildren'))

// ── Manufacturing routes ────────────────────────────────────────────────────
const mfg = read('src/routes/manufacturingRoutes.tsx')
check('WO edit dual-routed (no demo form in API mode)', mfg.includes('isApiMode() ? <ApiModeWorkOrderEditRedirect /> : <WorkOrderFormPage />'))
check('Legacy BOM redirects to setup in API mode', mfg.includes('<Navigate to="/manufacturing/setup/boms" replace /> : <BomRegisterPage />'))
check('Legacy routing redirects to setup in API mode', mfg.includes('<Navigate to="/manufacturing/setup/routings" replace /> : <RouteRegisterPage />'))
// Production Plans are dual-mode since the 2026-07-22 FE wiring (live facade).
check('Production plan mounted dual-mode', mfg.includes("{ path: 'manufacturing/production-plan', element: <ProductionPlanPage /> }"))
// Manufacturing Settings is dual-mode (Wave 1 deferred-features roadmap) — live /manufacturing/settings API.
check('Manufacturing settings mounted dual-mode', mfg.includes("{ path: 'manufacturing/settings', element: <ManufacturingSettingsPage /> }") && !mfg.includes('demoOnlyRoute(<ManufacturingSettingsPage />'))

// ── Quality routes ──────────────────────────────────────────────────────────
const quality = read('src/routes/qualityRoutes.tsx')
check('Quality rework gated', quality.includes('demoOnlyRoute(<ReworkWorkbenchPage />'))
check('Quality NCR register gated', quality.includes('demoOnlyRoute(<NcrRegisterPage />'))
check('Quality NCR detail gated', quality.includes('demoOnlyRoute(<NcrDetailPage />'))
check('Quality reports gated', quality.includes('demoOnlyRoute(<QualityReportsPage />'))
check('Quality queue stays dual-routed', quality.includes('isApiMode() ? <ApiQcQueuePage /> : <QcQueuePage />'))

// ── Accounting routes ───────────────────────────────────────────────────────
const acct = read('src/routes/accountingRoutes.tsx')
// Receivables is the live AR namespace now — Money In aliases redirect into it in API mode.
check('Money In aliases redirect to Receivables in API mode', acct.includes('isApiMode() ? <MoneyInAliasRedirect /> : demoElement'))
check('Receivables dashboard mounted live', acct.includes("{ path: 'accounting/receivables', element: <ReceivablesDashboardPage /> }"))
check('Legacy AP redirects to Money Out in API mode', acct.includes('<Navigate to="/accounting/money-out" replace /> : element'))
check('Legacy AP routes wrapped', acct.includes('legacyApRoute(<PayablesDashboardPage />)'))
check('Bank accounts use live treasury API in API mode', acct.includes('isApiMode() ? <ApiBankAccountsPage /> : <BankAccountsPage />'))
check('Bank account detail uses live treasury API in API mode', acct.includes('isApiMode() ? <ApiBankAccountDetailPage /> : <BankAccountCardPage />'))
check('Cash accounts use live treasury API in API mode', acct.includes('isApiMode() ? <ApiCashAccountsPage /> : <CashAccountsPage />'))
check('Cash account detail uses live treasury API in API mode', acct.includes('isApiMode() ? <ApiCashAccountDetailPage /> : <CashAccountCardPage />'))
check('Bank/cash transactions use live treasury API in API mode', acct.includes('isApiMode() ? <ApiTreasuryTransactionsPage /> : <BankCashTransactionsPage />'))
check('Bank deposits use live treasury workflows in API mode', acct.includes('isApiMode() ? <ApiBankDepositsPage /> : <BankDepositsPage />'))
check('Bank & Cash setup uses live finance settings in API mode', acct.includes('isApiMode() ? <ApiBankCashSetupPage /> : <BankCashSetupPage />'))
check('Seed financial reports gated', acct.includes('demoOnlyRoute(<FinancialReportsDashboardPage />, FINANCIAL_REPORTS_DEMO_GATE)'))
check('Seed trial balance gated', acct.includes('demoOnlyRoute(<TrialBalancePage />, FINANCIAL_REPORTS_DEMO_GATE)'))
check('Mfg accounting gate retained', acct.includes('withManufacturingAccountingApiGate('))

// ── Production / MRP / legacy WO routes ─────────────────────────────────────
const prod = read('src/routes/productionRoutes.tsx')
check('MRP dashboard gated', prod.includes('demoOnlyRoute(<MRPDashboardPage />, MRP_DEMO_GATE)'))
check('MRP planner gated', prod.includes('demoOnlyRoute(<MrpPlannerWorkbenchPage />, MRP_DEMO_GATE)'))
check('Legacy WO detail redirects in API mode', prod.includes('isApiMode() ? <ApiModeLegacyWorkOrderRedirect /> : <WorkOrderDetailPage />'))
check('Legacy WO 360 redirects in API mode', prod.includes('isApiMode() ? <ApiModeLegacyWorkOrderRedirect /> : <WorkOrder360Page />'))
check('Demo scan actions gated', prod.includes('demoOnlyRoute(<ScanOperationStartPage />, SCAN_DEMO_GATE)'))
check('Legacy job-work detail redirects in API mode', prod.includes('isApiMode() ? <ApiModeLegacyJobWorkRedirect /> : <JobWorkOrderDetailPage />'))

// ── Dispatch / invoices / costing ───────────────────────────────────────────
const dispatch = read('src/routes/dispatchFinanceRoutes.tsx')
check('Dispatch register stays dual-routed', dispatch.includes('isApiMode() ? <ApiOutboundDispatchRegisterPage /> : <DispatchDashboardPage />'))
// Dispatch plan redirects to the live requirements workbench in API mode (7C1 wiring).
check('Demo dispatch plan redirects to workbench in API mode', dispatch.includes('<Navigate to="/dispatch/workbench" replace /> : <DispatchPlanPage />'))
check('Demo invoices workspace gated', dispatch.includes('demoOnlyRoute(<FinanceWorkspacePage />, INVOICE_DEMO_GATE)'))
check('Demo costing dashboard gated', dispatch.includes('demoOnlyRoute(<CostingDashboardPage />'))

// ── App shell honesty (error state + demo indicator) ────────────────────────
const shell = read('src/components/layout/AppShell.tsx')
check('AppShell shows API sync error state', shell.includes("apiSyncStatus === 'error'"))
check('AppShell shows global demo-mode indicator', shell.includes('Demo mode — sample data'))
check('Demo indicator hidden in API mode', shell.includes('{!isApiMode() && ('))

// ── Bootstrap isolation retained ────────────────────────────────────────────
const bootstrap = read('src/bootstrap/appBootstrap.ts')
check('Bootstrap skips demo seeds in API mode', bootstrap.includes("if (isApiMode()) {\n    return { mode: 'api' }"))

// ── Not-found route retained ────────────────────────────────────────────────
const routesIndex = read('src/routes/index.tsx')
check('Catch-all not-found route registered', routesIndex.includes("path: '*'") && routesIndex.includes('PageNotFoundPage'))

// ── SPA rewrite configuration (8B-R-015) ────────────────────────────────────
const nginx = read('nginx.conf')
check('nginx proxies /api/ to backend', nginx.includes('location /api/') && nginx.includes('proxy_pass'))
check('nginx SPA fallback to index.html', nginx.includes('try_files $uri $uri/ /index.html'))

const htaccess = read('backend/.htaccess', repoRoot)
check('.htaccess leaves /api to Node', htaccess.includes('RewriteRule ^api(?:/|$) - [L]'))
check('.htaccess SPA fallback to public/index.html', htaccess.includes('RewriteRule ^ public/index.html [L]'))

const backendApp = read('backend/src/app.ts', repoRoot)
check('Backend returns JSON 404 for unknown API routes', backendApp.includes("sendError(res, 404, `API route not found"))
check('Backend SPA fallback excludes /api', backendApp.includes('app.get(/^(?!\\/api(?:\\/|$)).*/'))

const spaVerify = fs.existsSync(path.join(repoRoot, 'scripts/verify-spa-routing.mjs'))
check('SPA routing verification script exists', spaVerify)

console.log(`\n${pass} passed, ${fail} failed`)
if (fail > 0) process.exit(1)
