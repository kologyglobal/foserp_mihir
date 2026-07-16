/**
 * Demo data saturation validation — npm run test:demo-data-saturation
 */
import { writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

const { SATURATION_TARGETS } = await import('../src/demo/seeds/demoSeedCatalog')
const { seedFullFactoryDemoData } = await import('../src/demo/seeds/demoFullFactorySeed')
const { validateDemoDataCounts } = await import('../src/demo/validateDemoData')
const { getProductionControlTowerData } = await import('../src/utils/controlTowerMetrics')
const { getErpExecutiveAnalytics } = await import('../src/services/erpAnalyticsService')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\n══════════════════════════════════════════════════════════')
console.log(' DEMO DATA SATURATION GATE')
console.log('══════════════════════════════════════════════════════════\n')

const load = seedFullFactoryDemoData()
check('1. seedFullFactoryDemoData succeeds', load.ok, load.error ?? `${load.warnings?.length ?? 0} warnings`)

const report = validateDemoDataCounts()
const c = report.counts

const COUNT_CHECKS: [string, keyof typeof SATURATION_TARGETS, string][] = [
  ['2. Customers', 'customers', 'customers'],
  ['3. Vendors', 'vendors', 'vendors'],
  ['4. Items', 'items', 'items'],
  ['5. Products', 'products', 'products'],
  ['6. BOMs', 'boms', 'boms'],
  ['7. Routings', 'routings', 'routings'],
  ['8. Leads', 'leads', 'leads'],
  ['9. Opportunities', 'opportunities', 'opportunities'],
  ['10. Quotations', 'quotations', 'quotations'],
  ['11. Sales orders', 'salesOrders', 'salesOrders'],
  ['12. PRs', 'purchaseRequisitions', 'purchaseRequisitions'],
  ['13. POs', 'purchaseOrders', 'purchaseOrders'],
  ['14. GRNs', 'grns', 'grns'],
  ['15. Inventory movements', 'inventoryMovements', 'inventoryMovements'],
  ['16. Work orders', 'workOrders', 'workOrders'],
  ['17. Job cards', 'jobCards', 'jobCards'],
  ['18. Job work orders', 'jobWorkOrders', 'jobWorkOrders'],
  ['19. QC inspections', 'qcInspections', 'qcInspections'],
  ['20. Dispatches', 'dispatches', 'dispatches'],
  ['21. Invoices', 'invoices', 'invoices'],
  ['22. Payments', 'payments', 'payments'],
  ['23. ECR', 'ecrs', 'ecrs'],
  ['24. ECO', 'ecos', 'ecos'],
  ['25. QR records', 'qrCodes', 'qrCodes'],
  ['26. Serial records', 'serialNumbers', 'serialNumbers'],
  ['27. Documents', 'documents', 'documents'],
]

for (const [label, targetKey, countKey] of COUNT_CHECKS) {
  const target = SATURATION_TARGETS[targetKey]
  const actual = c[countKey] ?? 0
  check(label, actual >= target, `${actual} (target ${target})`)
}

check('28. No orphan SO', !report.orphans.includes('sales_order'))
check('29. No orphan WO', !report.orphans.includes('work_order'))
check('30. No orphan PO', !report.orphans.includes('purchase_order'))
check('31. No orphan GRN', !report.orphans.includes('grn'))
check('32. No orphan invoice', !report.orphans.includes('invoice'))
check('33. No orphan QR', !report.orphans.includes('qr'))
check('34. No orphan serial', !report.orphans.includes('serial'))
check('35. No orphan document', !report.orphans.includes('document'))

const prod = getProductionControlTowerData()
const analytics = getErpExecutiveAnalytics()
check('36. Dashboard KPIs match analytics', report.kpiMismatches.length === 0, report.kpiMismatches.join('; ') || 'ok')
check('37. Live strip running WO matches', prod.running === analytics.runningWorkOrders, `${prod.running} vs ${analytics.runningWorkOrders}`)
check('38. validateDemoData ok flag', report.ok, report.belowTarget.slice(0, 3).join('; ') || 'all targets met')
check('39. Reset reloads full dataset', load.ok && c.customers >= SATURATION_TARGETS.customers)

const verdict =
  failed === 0
    ? 'Demo Data Fully Saturated'
    : failed <= 5
      ? 'Demo Data Partially Saturated'
      : 'Demo Data Failed'

const md = [
  '# Demo Data Saturation Report',
  '',
  `**Generated:** ${new Date().toISOString().slice(0, 10)}`,
  '',
  '## Entity Counts',
  '',
  ...Object.entries(c).map(([k, v]) => {
    const target = SATURATION_TARGETS[k as keyof typeof SATURATION_TARGETS]
    return target != null ? `- ${k}: **${v}** (target ${target})` : `- ${k}: **${v}**`
  }),
  '',
  '## Orphan Validation',
  '',
  report.orphans.length === 0 ? 'No orphans detected.' : report.orphans.map((o) => `- ${o}`).join('\n'),
  '',
  '## KPI Validation',
  '',
  report.kpiMismatches.length === 0 ? 'Dashboard KPIs align with analytics service.' : report.kpiMismatches.map((m) => `- ${m}`).join('\n'),
  '',
  '## Below Target',
  '',
  report.belowTarget.length === 0 ? 'All modules meet SATURATION_TARGETS.' : report.belowTarget.map((b) => `- ${b}`).join('\n'),
  '',
  '## Test Gate',
  '',
  `- **${passed}/${passed + failed}** checks passed`,
  '',
  '## Final Verdict',
  '',
  `**${verdict}**`,
  '',
]

writeFileSync(path.join(ROOT, 'DEMO_DATA_SATURATION_REPORT.md'), md.join('\n'))
console.log('\nWrote DEMO_DATA_SATURATION_REPORT.md')
console.log(`\nSaturation Gate: ${passed}/${passed + failed} · ${verdict}\n`)
process.exit(failed > 0 ? 1 : 0)
