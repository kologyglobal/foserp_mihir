/**
 * Phase 15 — Purchase frontend automated checks (validation + static source).
 * Avoids heavy @/ path imports from purchaseService / permissions barrels.
 * Run: npx tsx scripts/test-purchase-phase15.ts
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

let pass = 0
let fail = 0
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`)
  if (ok) pass++
  else fail++
}

const { validatePurchaseRequisitionForm } = await import('../src/utils/purchaseRequisitionValidation')
const {
  mapPurchaseErrorMessage,
  isTechnicalPurchaseMessage,
} = await import('../src/utils/purchase/purchaseErrorMessages')

console.log('\nPhase 15 — Purchase frontend tests\n')

const emptyHeader = {
  documentDate: '',
  department: '',
  locationId: '',
  locationCode: '',
  locationName: '',
  locationState: '',
  locationCity: '',
  requesterId: '',
  requesterCode: '',
  requesterName: '',
  expectedDeliveryDate: '',
  priority: 'normal' as const,
  requisitionType: 'standard' as const,
  source: 'manual' as const,
  costCentre: '',
  project: '',
  productionOrderNo: '',
  maintenanceOrderNo: '',
  referenceNumber: '',
  purpose: '',
  remarks: '',
  rfqRequired: true,
}

const validHeader = {
  ...emptyHeader,
  documentDate: '2026-07-01',
  department: 'Production',
  locationId: 'loc-1',
  requesterId: 'u-1',
  expectedDeliveryDate: '2026-07-10',
  rfqRequired: false,
}

{
  const r = validatePurchaseRequisitionForm(emptyHeader, [])
  check(
    'PR form required fields',
    r.errors.some((e) => e.includes('Department')) &&
      r.errors.some((e) => e.includes('Requested By')) &&
      r.errors.some((e) => e.includes('Requisition date')) &&
      r.errors.some((e) => e.includes('Required date')) &&
      r.errors.some((e) => e.includes('Add at least one item')),
  )
}

{
  const src = read('src/modules/purchase/PurchaseRequisitionEditorPage.tsx')
  check('RFQ Required helper text', src.includes('RFQ is required to create PO'))
  check('Direct Planning helper text', src.includes('Create Direct PO'))
}

{
  const r = validatePurchaseRequisitionForm(validHeader, [
    {
      key: '1',
      id: 'l1',
      lineNo: 1,
      category: '',
      itemId: '',
      itemCode: '',
      itemName: '',
      description: '',
      quantity: 0,
      uom: '',
      estimatedRate: 0,
      amount: 0,
      requiredDate: '',
      warehouseId: '',
      preferredVendorId: '',
      remarks: '',
      actionMessage: false,
    } as never,
  ])
  check(
    'Item-row validation',
    r.errors.some((e) => e.includes('Add at least one item')) ||
      r.errors.some((e) => e.includes('Quantity')) ||
      r.errors.some((e) => e.includes('UOM')) ||
      r.errors.some((e) => e.includes('Item')),
  )
}

{
  const src = read('src/modules/purchase/PurchasePlanningSheetPage.tsx')
  check('Planning Sheet filters', src.includes('filterRows') && src.includes('useCrmFilterDrawer'))
  check('Eligible row selection', src.includes('canSelectPlanningRowForPo'))
  check('Disabled rows', src.includes('disabled:') && src.includes('terminal'))
  check('Bulk buyer assignment', src.includes('bulkAssignPurchasePlanningBuyer'))
  check(
    'Vendor selection',
    src.includes('bulkSelectPurchasePlanningVendor') || src.includes('preferredVendor'),
  )
  check('Quantity recalculation', src.includes('recalculatePurchasePlanningRows'))
  check(
    'Create PO modal vendor grouping',
    src.includes('Create PO') || src.includes('createPurchaseOrdersFromPlanningSelection'),
  )
  check('Loading state', src.includes('setLoading') && src.includes('loading'))
  check(
    'Empty state',
    src.includes('empty') || src.includes('No planning') || src.includes('filtered.length === 0'),
  )
  check('Error state', src.includes('setError') && src.includes('error'))
  check(
    'Permission-based actions',
    src.includes('canCreatePoFromPlanning') || src.includes('You do not have permission'),
  )
}

{
  const svc = read('src/services/purchase/purchaseService.ts')
  check(
    'Eligible vs disabled planning helpers',
    svc.includes('export function canSelectPlanningRowForPo') &&
      svc.includes("row.status === 'approved'") &&
      svc.includes("'po_created'"),
  )
  check(
    'Create PO readiness helper',
    svc.includes('export function canCreatePoFromPlanningRow') &&
      svc.includes('netPurchaseQuantity > 0') &&
      svc.includes('expectedRate > 0'),
  )
}

{
  check(
    'API error handling maps codes',
    mapPurchaseErrorMessage('PPS_RFQ_REQUIRED') ===
      'RFQ-required PR items cannot be processed from Planning.',
  )
  check(
    'API error handling hides technical noise',
    isTechnicalPurchaseMessage('Prisma foreign key constraint') &&
      mapPurchaseErrorMessage(undefined, 'PrismaClientKnownRequestError').includes(
        'Something went wrong',
      ),
  )
}

{
  const permSrc = read('src/utils/permissions/purchase.ts')
  check(
    'Permission catalogs include planning create_po',
    permSrc.includes('purchase.planning.create_po') && permSrc.includes('canCreatePoFromPlanning'),
  )
}

console.log(`\nResult: ${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exit(1)
