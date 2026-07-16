/**
 * Master Code Series — npm run test:master-code-series
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

const {
  reserveCode,
  confirmCode,
  releaseReservedCode,
  previewNextCode,
} = await import('../src/services/codeSeriesService')
const { useCodeSeriesStore } = await import('../src/store/codeSeriesStore')
const { setSessionUserForTests } = await import('../src/utils/permissions')
const { canCodeSeriesPermission } = await import('../src/utils/codeSeriesPermissions')
const { validateMasterCodeBeforeSave } = await import('../src/utils/masterCodeValidation')
const { MASTER_CODE_SERIES_FORMS, MASTER_ENTITY_CODE_MAP } = await import('../src/config/masterCodeSeriesConfig')

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

function grepMasterForms() {
  return MASTER_CODE_SERIES_FORMS.every(({ formPath }) => {
    const content = read(formPath)
    return content.includes('MasterCodeField') || content.includes('useMasterCodeSeries')
  })
}

console.log('\nMaster Code Series Tests\n')

setSessionUserForTests({ name: 'Admin User', role: 'admin' })

const pkg = read('package.json')
check('npm script test:master-code-series', pkg.includes('"test:master-code-series"'))

const hook = read('src/hooks/useMasterCodeSeries.ts')
const field = read('src/components/masters/MasterCodeField.tsx')
const validation = read('src/utils/masterCodeValidation.ts')

check('useMasterCodeSeries hook exists', hook.includes('reserveCode') && hook.includes('releaseReservedCode'))
check('MasterCodeField component exists', field.includes('MASTER_CODE_HELPER_TEXT'))
check('validateMasterCodeBeforeSave exported', validation.includes('export function validateMasterCodeBeforeSave'))

for (const [key, entityType] of Object.entries(MASTER_ENTITY_CODE_MAP)) {
  const store = useCodeSeriesStore.getState()
  const hasSeries = store.series.some((s) => s.entityType === entityType && s.isActive)
  check(`Seed series for ${key}`, hasSeries, entityType)
}

const customerReserved = reserveCode('customer')
check('Auto-generate customer code on reserve', /^CUST-\d{4}$/.test(customerReserved), customerReserved)

const vendorPreview = previewNextCode('vendor')
check('Preview vendor code', vendorPreview.startsWith('VEND-'), vendorPreview)

check('Master forms use centralized code series', grepMasterForms())
check('No CUST-0001 fallback in customer utils', !read('src/components/masters/CustomerFormSections.tsx').includes('CUST-0001'))
check('No VEND-0001 fallback in vendor utils', !read('src/utils/vendorDefaults.ts').includes('VEND-0001'))

const dupValidation = validateMasterCodeBeforeSave('customer', customerReserved, {
  reservedCode: customerReserved,
  checkDuplicate: () => false,
})
check('Validate reserved code before save', dupValidation.ok)

confirmCode('customer', customerReserved)
check('Confirm code on save', useCodeSeriesStore.getState().isCodeUsed('customer', customerReserved))

const released = reserveCode('item')
releaseReservedCode('item', released)
const releasedRow = useCodeSeriesStore.getState().reservations.find((r) => r.code === released)
check('Release reserved on cancel', releasedRow?.status === 'released')

setSessionUserForTests({ name: 'Operator', role: 'production_head' })
check('Manual override blocked without permission', !canCodeSeriesPermission('codeSeries.manualNumber'))

setSessionUserForTests({ name: 'Admin User', role: 'admin' })
check('Manual override allowed with permission', canCodeSeriesPermission('codeSeries.manualNumber'))

const missingSeries = validateMasterCodeBeforeSave('capa' as never, 'CAPA-0001', {})
check('Missing series shows proper error', !missingSeries.ok && (missingSeries.message?.includes('not configured') ?? false))

const srcScan = [
  'src/modules/masters',
  'src/modules/crm',
  'src/components/masters',
  'src/utils/vendorDefaults.ts',
  'src/utils/itemMasterDefaults.ts',
].flatMap((p) => {
  try {
    return [read(p)]
  } catch {
    return []
  }
}).join('\n')

check('No Math.random() in master code utils', !read('src/utils/vendorDefaults.ts').includes('Math.random()'))
check('No Date.now() code gen in vendorDefaults', !read('src/utils/vendorDefaults.ts').includes('Date.now()'))

console.log(`\n${'─'.repeat(40)}`)
console.log(`Passed: ${pass}  Failed: ${fail}`)
console.log(fail === 0 ? '\n✅ Master code series tests passed\n' : '\n❌ Master code series tests failed\n')
process.exit(fail === 0 ? 0 : 1)
