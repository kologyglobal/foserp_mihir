import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runFormActionSingleFlight } from '../src/components/erp/formActionSingleFlight'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let passed = 0

function read(relativePath: string) {
  return readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function check(label: string, condition: boolean) {
  if (!condition) throw new Error(`FAIL: ${label}`)
  passed += 1
  console.log(`✓ ${label}`)
}

const routeSource = read('src/routes/purchaseRoutes.tsx')
check('canonical GRN list route is /purchase/grn', /path:\s*'grn',\s*element:\s*<GrnListPage/.test(routeSource))
check('GRN create route is registered', /path:\s*'grn\/new',\s*element:\s*<GrnEditorPage/.test(routeSource))
check('GRN edit route is registered', /path:\s*'grn\/:id\/edit',\s*element:\s*<GrnEditorPage/.test(routeSource))

const editors = [
  ['Purchase Requisition', 'src/modules/purchase/PurchaseRequisitionEditorPage.tsx', 'requisition'],
  ['RFQ', 'src/modules/purchase/RfqEditorPage.tsx', 'rfq'],
  ['Vendor Quotation', 'src/modules/purchase/VendorQuotationEditorPage.tsx', 'vendorQuotation'],
  ['Purchase Order', 'src/modules/purchase/PurchaseOrderEditorPage.tsx', 'purchaseOrder'],
  ['GRN', 'src/modules/purchase/GrnEditorPage.tsx', 'grn'],
  ['Purchase Return', 'src/modules/purchase/PurchaseReturnEditorPage.tsx', 'purchaseReturn'],
  ['Purchase Invoice', 'src/modules/purchase/PurchaseInvoiceEditorPage.tsx', 'purchaseInvoice'],
] as const

for (const [name, file, routeKey] of editors) {
  const source = read(file)
  const footerStart = source.indexOf('footer={')
  const footerEnd = source.indexOf('onSaveShortcut', footerStart)
  const footer = source.slice(footerStart, footerEnd > footerStart ? footerEnd : footerStart + 1_500)
  check(`${name}: shared FormActionBar reused`, footer.includes('<FormActionBar'))
  check(`${name}: footer order is Cancel then Save`, footer.includes('cancelFirst'))
  check(`${name}: footer has no Save Draft label`, !footer.includes('Save Draft'))
  check(`${name}: footer has no lifecycle Submit action`, !/\bSubmit\b|Send for Approval|Verify/.test(footer))
  check(`${name}: Cancel uses explicit route map`, footer.includes(`PURCHASE_FORM_ROUTES.${routeKey}.list`))
  check(
    `${name}: Save success uses explicit route map`,
    source.includes(`navigate(PURCHASE_FORM_ROUTES.${routeKey}.list, { replace: true })`),
  )
  check(`${name}: unsaved state is passed to shared confirmation`, footer.includes('dirty={dirty}'))
  check(`${name}: Save is wired directly for single-flight protection`, footer.includes('onSave={saveDraft}'))
}

const routeMap = read('src/modules/purchase/purchaseFormRoutes.ts')
for (const [, , routeKey] of editors) {
  check(`route map includes ${routeKey}`, routeMap.includes(`${routeKey}: {`))
}

const grn = read('src/modules/purchase/GrnEditorPage.tsx')
check('GRN Save uses the real create API', grn.includes('await createGRNFromPo(input)'))
check('GRN Edit Save uses the real update API', grn.includes('await updateGRN(recordId, input)'))
check('GRN editor does not import lifecycle submit API', !grn.includes('submitGRN,'))
check('GRN save failure remains on form and displays backend error', /PurchaseServiceError \? err\.message : 'Save failed'/.test(grn))

const shared = read('src/components/erp/FormActionBar.tsx')
check('shared Cancel uses standard system confirmation', shared.includes('systemConfirm({'))
check('shared footer has responsive full-width mobile action group', shared.includes('w-full sm:w-auto'))
check('shared footer prevents button overlap on mobile', shared.includes('flex-1 sm:flex-none'))

let calls = 0
let release!: () => void
const pending = new Promise<void>((resolve) => {
  release = resolve
})
const gate = { locked: false }
const action = async () => {
  calls += 1
  await pending
}
const first = runFormActionSingleFlight(gate, action)
const second = runFormActionSingleFlight(gate, action)
await Promise.resolve()
check('double click invokes Save only once', calls === 1)
release()
await Promise.all([first, second])

check(
  'PR lifecycle Submit remains on view page',
  read('src/modules/purchase/PurchaseRequisitionDomainDetailPage.tsx').includes("id: 'submit'"),
)
check(
  'PO lifecycle Submit remains on view page',
  read('src/modules/purchase/PurchaseOrderDetailPage.tsx').includes("id: 'submit'"),
)
check(
  'GRN lifecycle Submit remains on view page',
  read('src/modules/purchase/GrnDetailPage.tsx').includes("id: 'submit'"),
)
check(
  'Vendor Quotation lifecycle Submit remains on view page',
  read('src/modules/purchase/VendorQuotationDetailPage.tsx').includes("id: 'submit'"),
)
check(
  'Purchase Return lifecycle Submit remains on view page',
  read('src/modules/purchase/PurchaseReturnDetailPage.tsx').includes("label: 'Submit for Approval'"),
)
check(
  'Purchase Invoice lifecycle Submit remains on view page',
  read('src/modules/purchase/PurchaseInvoiceDetailPage.tsx').includes("label: 'Send for Approval'"),
)

console.log(`\nPurchase form footer checks passed: ${passed}`)
