/**
 * Render performance guard — npm run test:performance
 * Verifies memoized store getters return stable references across repeated calls.
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() {
    return mem.size
  },
  clear() {
    mem.clear()
  },
  getItem(k: string) {
    return mem.get(k) ?? null
  },
  setItem(k: string, v: string) {
    mem.set(k, v)
  },
  removeItem(k: string) {
    mem.delete(k)
  },
  key() {
    return null
  },
}

const { clearMemoizedGetterCache } = await import('../src/store/selectors/memoizedGetters')
const { useCrmMasterStore } = await import('../src/store/crmMasterStore')
const { useApprovalStore } = await import('../src/store/approvalStore')
const { useSerialStore } = await import('../src/store/serialStore')
const { computeSidebarCategoryCounts } = await import('../src/store/selectors/sidebarCounts.selectors')
const { useWorkOrderStore } = await import('../src/store/workOrderStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useMrpStore } = await import('../src/store/mrpStore')
const { useCrmStore } = await import('../src/store/crmStore')
const { usePurchaseStore } = await import('../src/store/purchaseStore')

let pass = 0
let fail = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\nRender Performance Guard\n')

clearMemoizedGetterCache()

const crmState = useCrmMasterStore.getState()
const kindList1 = crmState.getByKind('lead-stages', true)
const kindList2 = crmState.getByKind('lead-stages', true)
check('1. getByKind returns stable reference', kindList1 === kindList2, `${kindList1.length} entries`)

const approvalState = useApprovalStore.getState()
const req1 = approvalState.listRequests()
const req2 = approvalState.listRequests()
check('2. listRequests returns stable reference', req1 === req2)

const serialState = useSerialStore.getState()
const ser1 = serialState.listSerials()
const ser2 = serialState.listSerials()
check('3. listSerials returns stable reference', ser1 === ser2)

const sources = {
  workOrders: useWorkOrderStore.getState().workOrders,
  inspections: useQualityStore.getState().inspections,
  dispatches: useDispatchStore.getState().dispatches,
  approvalRequests: useApprovalStore.getState().requests,
  purchaseOrders: usePurchaseStore.getState().purchaseOrders,
  salesOrders: useMrpStore.getState().salesOrders,
  opportunities: useCrmStore.getState().opportunities,
  followUps: useCrmStore.getState().followUps,
  quotationDocuments: useCrmStore.getState().quotationDocuments,
}
const counts1 = computeSidebarCategoryCounts(sources)
const counts2 = computeSidebarCategoryCounts(sources)
check('4. Sidebar count derivation is pure', JSON.stringify(counts1) === JSON.stringify(counts2))

const t0 = performance.now()
for (let i = 0; i < 500; i++) {
  crmState.getByKind('opportunity-stages', true)
  approvalState.listRequests()
  serialState.listSerials()
}
const elapsed = performance.now() - t0
check('5. 500 memoized getter calls < 50ms', elapsed < 50, `${elapsed.toFixed(1)}ms`)

console.log(`\nPerformance guard: ${pass}/${pass + fail} passed\n`)
process.exit(fail > 0 ? 1 : 0)
