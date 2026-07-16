/**
 * Stock count service smoke test (Phase 5).
 * Run: npx tsx frontend/scripts/test-stock-count.ts
 */

import { seedStockMovements, seedReservations } from '../src/data/inventory/seed'

const { useMasterStore } = await import('../src/store/masterStore')
const { useInventoryStore } = await import('../src/store/inventoryStore')
const {
  getStockCounts,
  getStockCountById,
  createStockCountSnapshot,
  saveStockCount,
  submitStockCount,
  requestRecountDemo,
  approveStockVarianceDemo,
  getStockAdjustmentPreview,
  postStockCountAdjustmentDemo,
  resetStockCountServiceForTests,
  StockCountServiceError,
} = await import('../src/services/inventory')

let passed = 0
let failed = 0

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    passed++
    console.log(`PASS: ${name}`)
  } else {
    failed++
    console.error(`FAIL: ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

// Bootstrap demo stores
useMasterStore.getState()
useInventoryStore.setState({
  stockMovements: seedStockMovements,
  reservations: seedReservations,
})

resetStockCountServiceForTests()

const wh = useMasterStore.getState().warehouses.find((w) => w.isActive)
check('Active warehouse exists', Boolean(wh))
if (!wh) process.exit(1)

const seedRows = await getStockCounts()
check('Seed stock counts loaded', seedRows.length >= 5, `got ${seedRows.length}`)

const draft = seedRows.find((r) => r.status === 'draft')
if (draft) {
  const detail = await getStockCountById(draft.id)
  check('getStockCountById returns draft', detail?.status === 'draft')
}

const item = useMasterStore.getState().items.find((i) => i.isStockable && i.isActive)
check('Stockable item exists', Boolean(item))

if (item && wh) {
  const created = await createStockCountSnapshot({
    countType: 'item',
    warehouseId: wh.id,
    itemId: item.id,
    countDate: new Date().toISOString().slice(0, 10),
    assignedTeam: ['Test User'],
    blindCount: true,
  })
  check('createStockCountSnapshot succeeds', created.status === 'counting')
  check('Snapshot audit entry exists', created.auditHistory.some((a) => a.action === 'Snapshot Created'))

  const onHand = useInventoryStore.getState().getOnHand(item.id, wh.id)
  const countedQty = onHand + 2
  const saved = await saveStockCount(created.id, [
    { lineId: created.lines[0].id, countedQty, reason: 'Test variance reason' },
  ])
  check('saveStockCount updates line', saved.lines[0].countedQty === countedQty)

  try {
    await submitStockCount(created.id)
    check('submitStockCount succeeds', true)
  } catch (e) {
    check('submitStockCount succeeds', false, e instanceof StockCountServiceError ? e.message : String(e))
  }

  const afterSubmit = await getStockCountById(created.id)
  check('Status after submit is review or recount', Boolean(afterSubmit && ['under_review', 'recount_required', 'approved'].includes(afterSubmit.status)))

  if (afterSubmit && afterSubmit.status === 'under_review') {
    await approveStockVarianceDemo(afterSubmit.id)
    const approved = await getStockCountById(afterSubmit.id)
    check('approveStockVarianceDemo', approved?.status === 'approved')
    const preview = await getStockAdjustmentPreview(afterSubmit.id)
    check('getStockAdjustmentPreview', preview.demoOnly === true)
    const posted = await postStockCountAdjustmentDemo(afterSubmit.id)
    check('postStockCountAdjustmentDemo marks posted', posted.status === 'posted')
    try {
      await saveStockCount(posted.id, [{ lineId: posted.lines[0].id, countedQty: 1 }])
      check('Posted count is read-only', false)
    } catch (e) {
      check('Posted count is read-only', e instanceof StockCountServiceError && e.code === 'READ_ONLY')
    }
  }
}

const recountRow = seedRows.find((r) => r.status === 'recount_required')
if (recountRow) {
  const updated = await requestRecountDemo(recountRow.id)
  check('requestRecountDemo', updated.status === 'recount_required')
}

console.log(`\nStock count tests: ${passed} passed, ${failed} failed`)
process.exit(failed > 0 ? 1 : 0)
