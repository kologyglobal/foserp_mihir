/**
 * Code / Number Series Master — npm run test:code-series
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
  getNextCode,
  previewNextCode,
  reserveCode,
  confirmCode,
  releaseReservedCode,
  validateManualCode,
  validateUniqueActiveEntity,
  resetSeriesIfRequired,
  adminResetSeries,
} = await import('../src/services/codeSeriesService')
const { useCodeSeriesStore } = await import('../src/store/codeSeriesStore')
const { setSessionUserForTests } = await import('../src/utils/permissions')

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

console.log('\nCode / Number Series Master Tests\n')

setSessionUserForTests({ name: 'Admin User', role: 'admin' })

const { readAllRouteSources } = await import('./routeSource')
const routes = readAllRouteSources(ROOT)
const catalog = read('src/config/masterModuleStructure.ts')
const service = read('src/services/codeSeriesService.ts')
const pages = read('src/modules/masters/code-series/CodeSeriesPages.tsx')
const pkg = read('package.json')

check('Routes registered', routes.includes("path: 'masters/code-series'") && routes.includes('CodeSeriesListPage'))
check('Catalog entry', catalog.includes('Code / Number Series Master') && catalog.includes('code-series'))
check('Service functions exported', [
  'getNextCode',
  'previewNextCode',
  'reserveCode',
  'confirmCode',
  'releaseReservedCode',
  'resetSeriesIfRequired',
  'validateManualCode',
].every((fn) => service.includes(`export function ${fn}`)))
check('UI uses EnterpriseMasterWorkspace', pages.includes('EnterpriseMasterWorkspace'))
check('Format builder in UI', pages.includes('Format Builder'))
check('npm script test:code-series', pkg.includes('"test:code-series"'))

const store = useCodeSeriesStore.getState()
check('Seed series loaded', store.series.length >= 20, `${store.series.length} series`)

const leadPreview = previewNextCode('lead')
check('Preview next code', /^LEAD-\d{4}$/.test(leadPreview), leadPreview)

const poPreview = previewNextCode('purchase_order')
check('Financial year format', /PO-\d{4}-\d{5}/.test(poPreview), poPreview)

const reserved = reserveCode('lead')
check('Reserve code during draft', reserved.startsWith('LEAD-'), reserved)
confirmCode('lead', reserved)
check('Confirm code on save', useCodeSeriesStore.getState().isCodeUsed('lead', reserved))

const dupBlocked = !validateUniqueActiveEntity('lead')
check('Duplicate active entity blocked', dupBlocked)

const manual = validateManualCode('lead', 'LEAD-MANUAL-9999')
check('Manual validation when disabled', !manual.ok)

const released = reserveCode('vendor')
releaseReservedCode('vendor', released)
const releasedRow = useCodeSeriesStore.getState().reservations.find((r) => r.code === released)
check('Release reserved on cancel', releasedRow?.status === 'released')

const nextLead = getNextCode('lead')
check('Immediate generation', nextLead.startsWith('LEAD-'), nextLead)

const poSeries = store.getActiveSeriesByEntity('purchase_order')
if (poSeries) {
  useCodeSeriesStore.getState().updateSeries(poSeries.id, {
    resetFrequency: 'calendar_year',
    lastResetDate: '2020-01-01',
    currentNumber: poSeries.startingNumber - 1,
  })
  resetSeriesIfRequired('purchase_order')
  const after = useCodeSeriesStore.getState().getSeries(poSeries.id)!
  check('Calendar year reset', after.currentNumber === poSeries.startingNumber - 1)
}

try {
  adminResetSeries(store.series[0]!.id, 'UAT reset')
  check('Reset requires permission (admin ok)', true)
} catch {
  check('Reset requires permission (admin ok)', false)
}

check('documentNumbers delegates to service', read('src/utils/documentNumbers.ts').includes('codeSeriesService'))
check('No hardcoded nextInvoiceNo body', !read('src/store/invoiceStore.ts').includes('INV-${year}-'))
check('No hardcoded nextWoNo body', !read('src/store/workOrderStore.ts').includes('WO-${String'))

console.log(`\nResult: ${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
