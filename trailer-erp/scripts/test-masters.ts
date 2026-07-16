/**
 * Inventory & Tax Master Setup — npm run test:masters
 */
import { readFileSync } from 'node:fs'
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

const { resetDemoBaseline } = await import('../src/demo/resetDemoBaseline')
const { useMasterStore } = await import('../src/store/masterStore')

let pass = 0
let fail = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${pass}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${fail}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

console.log('\nInventory & Tax Master Tests\n')
resetDemoBaseline()

const { readAllRouteSources } = await import('./routeSource')
const routes = readAllRouteSources(ROOT)
// Nav paths are defined in masterModuleStructure (buildMasterNavItems), not literal strings in navigation.ts
const masterStructure = read('src/config/masterModuleStructure.ts')
const itemForm = read('src/modules/masters/item/ItemPages.tsx')
const hsnForm = read('src/modules/masters/hsn/HsnPages.tsx')
const gstRateForm = read('src/modules/masters/gst-rate/GstRatePages.tsx')
const uomForm = read('src/modules/masters/uom/UomPages.tsx')
const pkg = read('package.json')

const store = useMasterStore.getState()

check('Item Master list route', routes.includes("path: 'masters/items'") && routes.includes('ItemListPage'))
check('Item Master new/edit routes', routes.includes("path: 'masters/items/new'") && routes.includes("path: 'masters/items/:id/edit'"))
check('HSN Master routes', routes.includes("path: 'masters/hsn'") && routes.includes('HsnListPage'))
check('GST Group routes', routes.includes("path: 'masters/gst-groups'") && routes.includes('GstGroupListPage'))
check('GST Rate routes', routes.includes("path: 'masters/gst-rates'") && routes.includes('GstRateListPage'))
check('UOM Master routes', routes.includes("path: 'masters/uom'") && routes.includes('UomListPage'))

check('Navigation — Item Master', masterStructure.includes("'/masters/items'"))
check('Navigation — HSN Master', masterStructure.includes("'/masters/hsn'"))
check('Navigation — GST groups', masterStructure.includes("'/masters/gst-groups'"))
check('Navigation — GST rates', masterStructure.includes("'/masters/gst-rates'"))
// Post master-module restructure: inventory + tax are separate hub groups (was "Inventory / Tax Setup")
check('Catalog — Inventory & Tax groups', masterStructure.includes("id: 'inventory'") && masterStructure.includes("id: 'tax'"))

check('HSN seed data', store.hsnMasters.length >= 5, `${store.hsnMasters.length} codes`)
check('GST Group seed', store.gstGroups.length >= 4, store.gstGroups.map((g) => g.code).join(', '))
check('GST Rate seed', store.gstRates.length >= 3)
check('UOM sample codes', store.uoms.some((u) => u.uomCode === 'NOS') && store.uoms.some((u) => u.uomCode === 'KG'))

check('Item form uses HsnMasterSelect', itemForm.includes('HsnMasterSelect'))
check('Item form uses GstGroupSelect', itemForm.includes('GstGroupSelect'))
check('Item form uses UomMasterSelect', itemForm.includes('UomMasterSelect'))
check('Item form uses ErpSmartSelect (SmartSelect)', itemForm.includes('ErpSmartSelect'))
check('HSN form uses GstGroupSelect', hsnForm.includes('GstGroupSelect'))
check('GST Rate form validation schema', gstRateForm.includes('Date To cannot be before Date From'))
check('UOM enterprise workspace', uomForm.includes('EnterpriseMasterWorkspace'))

check('Save & Close on item form', itemForm.includes('onSaveClose'))
check('Import/Export on list', itemForm.includes('Import') && itemForm.includes('Export'))
check('Sticky footer pattern', itemForm.includes('MasterStickyFooter'))

check('npm script test:masters', pkg.includes('"test:masters"'))

console.log(`\nResult: ${pass} passed, ${fail} failed\n`)
if (fail > 0) process.exit(1)
