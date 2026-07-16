/**
 * ERP Card Form System gate — npm run test:erp-card-form-system
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CARD = path.join(ROOT, 'src/components/erp/card-form')

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

console.log('\nERP Card Form System Validation\n')

const components = [
  'ErpCardFormPage.tsx',
  'ErpCardCommandBar.tsx',
  'ErpCardTabs.tsx',
  'ErpCardSection.tsx',
  'ErpFieldRow.tsx',
  'ErpFieldLabel.tsx',
  'ErpFieldControl.tsx',
  'ErpSubpageGrid.tsx',
  'ErpFactBoxPanel.tsx',
  'ErpStickySaveBar.tsx',
  'ErpFormStatusStrip.tsx',
  'ErpFormValidationSummary.tsx',
  'useErpCardFormKeyboard.ts',
  'tabPresets.ts',
  'types.ts',
  'index.ts',
]

for (const f of components) {
  check(`card-form/${f}`, existsSync(path.join(CARD, f)))
}

const index = read('src/components/erp/card-form/index.ts')
check('Exports ErpCardFormPage', index.includes('ErpCardFormPage'))
check('Exports ErpStickySaveBar', index.includes('ErpStickySaveBar'))
check('Exports ErpSubpageGrid', index.includes('ErpSubpageGrid'))
check('Exports tab presets', read('src/components/erp/card-form/tabPresets.ts').includes('ERP_CARD_FORM_TABS_CRM'))

const erpIndex = read('src/components/erp/index.ts')
check('ERP barrel re-exports card-form', erpIndex.includes('./card-form'))

const css = read('src/styles/dynamics-components.css')
check('Card form CSS tokens', css.includes('.erp-card-form-page'))
check('Dense field row CSS', css.includes('.erp-field-row--horizontal'))
check('Subpage grid CSS', css.includes('.erp-subpage-grid'))
check('FactBox panel CSS', css.includes('.erp-factbox-panel'))

const keyboard = read('src/components/erp/card-form/useErpCardFormKeyboard.ts')
check('Ctrl+S shortcut', keyboard.includes("e.key === 's'"))
check('Ctrl+Enter save close', keyboard.includes("e.key === 'Enter'"))
check('Alt+N add line', keyboard.includes("e.key.toLowerCase() === 'n'"))

const sticky = read('src/components/erp/card-form/ErpStickySaveBar.tsx')
check('Navy primary Save button', sticky.includes("variant=\"primary\"") && sticky.includes('Save'))

const lead = read('src/modules/crm/CrmLeadFormPage.tsx')
check('CRM Lead uses card form tabs', lead.includes('ErpCardTabs') && lead.includes('ERP_CARD_FORM_TABS_CRM'))
check('CRM Lead sticky save bar', lead.includes('ErpStickySaveBar'))

const opp = read('src/modules/crm/OpportunityEditPage.tsx')
check('Opportunity uses CrmCardFormShell', opp.includes('CrmCardFormShell'))
check('Opportunity FactBox', opp.includes('ErpFactBoxPanel'))

const oppNew = read('src/modules/crm/OpportunityNewPage.tsx')
check('Opportunity new page route module', oppNew.includes('OpportunityNewPage') && oppNew.includes('CrmCardFormShell'))
check('Opportunity new item line grid', oppNew.includes('ErpLineItemsGrid') && oppNew.includes('Product / Item Lines'))
check('Opportunity new CRM route', read('src/routes/crmRoutes.tsx').includes("path: 'opportunities/new'"))

const quoNew = read('src/modules/crm/CrmQuotationNewPage.tsx')
check('Quotation new uses CrmCardFormShell', quoNew.includes('CrmCardFormShell') && quoNew.includes('CrmQuotationNewPage'))
check('Quotation new section navigation', quoNew.includes('sectionNavItems'))

const company = read('src/modules/masters/customer/CustomerPages.tsx')
check('Company master status strip', company.includes('ErpFormStatusStrip'))
check('Company master sticky bar', company.includes('ErpStickySaveBar'))

const masters = read('src/modules/crm/masters/CrmMasterPages.tsx')
check('CRM masters card sections', masters.includes('ErpCardSection'))
check('CRM masters tabs', masters.includes('ERP_CARD_FORM_TABS_MASTER'))

const pkg = read('package.json')
check('npm script test:erp-card-form-system', pkg.includes('test:erp-card-form-system'))

const ci = read('scripts/run-ci.ts')
check('Wired into test:ci', ci.includes('test:erp-card-form-system'))

const uat = read('scripts/test-uat.ts')
check('Wired into test:uat', uat.includes('test:erp-card-form-system'))

const eeta = read('scripts/test-eeta-100.ts')
check('Wired into test:eeta-100', eeta.includes('test:erp-card-form-system'))

const fsuat = read('scripts/test-full-system-uat.ts')
check('Wired into test:full-system-uat', fsuat.includes('test:erp-card-form-system'))

console.log(`\nERP Card Form System: ${pass}/${pass + fail} passed\n`)
process.exit(fail > 0 ? 1 : 0)
