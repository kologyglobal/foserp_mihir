/**
 * CRM form alignment static gate — npm run test:crm-form-alignment
 * Keeps Lead→SO create/edit pages on shared save chrome + erp-input patterns.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

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

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

console.log('\nCRM Form Alignment Gate\n')

const grid = read('src/components/erp/card-form/ErpFormGrid.tsx')
check('ErpFormGrid exports columns 1–3', /columns === 3/.test(grid) && /erp-form-grid--cols-3/.test(grid))
check('ErpFormGrid uses erp-form-grid class', grid.includes("'erp-form-grid'"))

const css = read('src/styles/dynamics-components.css')
check('CSS defines erp-form-grid--cols-3', css.includes('.erp-form-grid--cols-3'))
check('CSS defines erp-input', /\.erp-input\b/.test(css))

const pages: { name: string; file: string; expect: RegExp[] }[] = [
  {
    name: 'Lead form',
    file: 'src/modules/crm/CrmLeadFormPage.tsx',
    expect: [/erp-input/, /FormActionBar|ErpStickySaveBar|formSaveActions/, /CrmCardFormShell/],
  },
  {
    name: 'Contact form',
    file: 'src/modules/crm/CrmContactFormPage.tsx',
    expect: [/erp-input/, /ErpStickySaveBar/, /CrmCardFormShell/],
  },
  {
    name: 'Opportunity form',
    file: 'src/modules/crm/OpportunityNewPage.tsx',
    expect: [/erp-input/, /ErpStickySaveBar/, /CrmCardFormShell|ENTERPRISE_FORM_CLASS/],
  },
  {
    name: 'Sales order create',
    file: 'src/modules/sales/SalesOrderCreatePage.tsx',
    expect: [/ErpFormGrid|erp-form-grid|erp-input/],
  },
]

for (const page of pages) {
  const src = read(page.file)
  for (const re of page.expect) {
    check(`${page.name} matches ${re}`, re.test(src))
  }
}

const contact = read('src/modules/crm/CrmContactFormPage.tsx')
const hasHeaderSave = /formSaveActions\s*=\s*\{/.test(contact)
const hasFooterSave = /ErpStickySaveBar/.test(contact)
check(
  'Contact Save chrome is single-surface (footer only)',
  hasFooterSave && !hasHeaderSave,
  hasHeaderSave && hasFooterSave ? 'both header+footer' : hasFooterSave ? 'footer' : 'none',
)

const shell = read('src/components/crm/CrmDrawerShell.tsx')
check('Quick-create drawers use CrmDrawerShell portal', shell.includes('createPortal'))

console.log(`\nCRM form alignment: ${pass}/${pass + fail} passed\n`)
process.exit(fail > 0 ? 1 : 0)
