/**
 * Operational reports smoke tests
 * npx tsx scripts/test-operational-reports.ts
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

const { seedStockMovements, seedReservations } = await import('../src/data/inventory/seed')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const { OPERATIONAL_REPORTS } = await import('../src/types/reports')
const {
  getStockAgingReport,
  getNegativeStockReport,
  getSlowMovingReport,
  getWoStatusReport,
  getWipAgingReport,
  getReworkTrendReport,
  getOpenSalesOrdersReport,
  getDeliveryCommitmentsReport,
  getOpenPoReport,
  getDelayedPoReport,
  getNcrAgeingReport,
  getPendingDispatchReport,
  getPodPendingReport,
} = await import('../src/utils/operationalReports')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

useInventoryStore.setState({ stockMovements: [...seedStockMovements], reservations: [...seedReservations] })

check('27 operational reports defined (incl. CRM)', OPERATIONAL_REPORTS.length === 27)
check('9 CRM reports registered', OPERATIONAL_REPORTS.filter((r) => r.module === 'crm').length === 9)
check('Stock aging returns array', Array.isArray(getStockAgingReport()))
check('Negative stock returns array', Array.isArray(getNegativeStockReport()))
check('Slow moving returns array', Array.isArray(getSlowMovingReport()))
check('WO status returns array', Array.isArray(getWoStatusReport()))
check('WIP aging returns array', Array.isArray(getWipAgingReport()))
check('Rework trend 6 periods', getReworkTrendReport().length === 6)
check('Open sales orders', Array.isArray(getOpenSalesOrdersReport()))
check('Delivery commitments', Array.isArray(getDeliveryCommitmentsReport()))
check('Open PO report', Array.isArray(getOpenPoReport()))
check('Delayed PO report', Array.isArray(getDelayedPoReport()))
check('NCR ageing', Array.isArray(getNcrAgeingReport()))
check('Pending dispatch', Array.isArray(getPendingDispatchReport()))
check('POD pending', Array.isArray(getPodPendingReport()))

console.log(`\nOperational reports: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
