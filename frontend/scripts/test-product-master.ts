/**
 * Product master hardening tests
 * npx tsx scripts/test-product-master.ts
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

const { useMasterStore } = await import('../src/store/masterStore')
const { useProductMasterStore } = await import('../src/store/productMasterStore')
const { PRODUCT_STATUS_FLOW } = await import('../src/types/productMaster')
const {
  getProductRevisionReport,
  getObsoleteProductReport,
  getProductCostReport,
  getProductUsageReport,
  getEngineeringChangeReport,
} = await import('../src/utils/productReports')

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail?: string) {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  ok ? pass++ : fail++
}

const prod = useMasterStore.getState().getProduct('prod-45m3')!
check('Seed product has productFamily', prod.productFamily === 'bulker_trailer')
check('Seed product released', prod.status === 'released')
check('Seed has manufacturing links', prod.manufacturing.releasedBomHeaderId === 'bom-bulker-a')
check('Seed has quality plan', !!prod.quality.finalInspectionPlanName)
check('Can use released product in sales', useProductMasterStore.getState().canUseProductInSales('prod-45m3').ok)

check('Cannot skip status draft→released', !PRODUCT_STATUS_FLOW.draft.includes('released'))
check('Advance engineering_review→approved', useProductMasterStore.getState().advanceProductStatus('prod-iso', 'approved', 'Test approval').ok)

const rev = useProductMasterStore.getState().createProductRevision('prod-iso', {
  revisionNo: 'Rev-2',
  revisionReason: 'Test ECO',
})
check('Create revision', rev.ok)
const iso = useMasterStore.getState().getProduct('prod-iso')!
check('Revision locks history', iso.revisions.some((r) => r.locked))

check('Product revision report', getProductRevisionReport().length >= 3)
check('Product cost report', getProductCostReport().length >= 3)
check('Product usage report', getProductUsageReport().length >= 3)
check('Engineering change report array', Array.isArray(getEngineeringChangeReport()))
check('Obsolete report array', Array.isArray(getObsoleteProductReport()))

console.log(`\nProduct master: ${pass} passed, ${fail} failed`)
process.exit(fail > 0 ? 1 : 0)
