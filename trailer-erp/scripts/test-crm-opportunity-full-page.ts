/**
 * CRM Opportunity full-page tests — npm run test:crm-opportunity-full-page
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let pass = 0
let fail = 0

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function routeExists(sub: string) {
  return read('src/routes/crmRoutes.tsx').includes(sub)
}

console.log('\nCRM Opportunity Full-Page Tests\n')

const routes = read('src/routes/crmRoutes.tsx')
const newPage = read('src/modules/crm/OpportunityNewPage.tsx')
const editPage = read('src/modules/crm/OpportunityEditPage.tsx')
const page360 = read('src/modules/crm/Opportunity360Page.tsx')
const pipeline = read('src/modules/crm/OpportunityPages.tsx')
const pkg = read('package.json')

check(1, 'Route opportunities/new', routeExists('opportunities/new'))
check(2, 'Route opportunities/:id/edit', routeExists('opportunities/:id/edit'))
check(3, 'Route opportunities/:id (360)', routeExists('opportunities/:id'))
check(4, 'New page uses CrmCardFormShell', newPage.includes('CrmCardFormShell'))
check(5, 'Edit page uses CrmCardFormShell', editPage.includes('CrmCardFormShell'))
check(6, 'New page ErpCardCommandBar', newPage.includes('ErpCardCommandBar'))
check(7, 'Edit page ErpCardCommandBar', editPage.includes('ErpCardCommandBar'))
check(8, 'New page ErpStickySaveBar', newPage.includes('ErpStickySaveBar'))
check(9, 'Edit page ErpStickySaveBar', editPage.includes('ErpStickySaveBar'))
check(10, 'New page CRM breadcrumbs', newPage.includes("label: 'CRM'") && newPage.includes('Opportunities'))
check(11, 'Edit page CRM breadcrumbs', editPage.includes("label: 'CRM'"))
check(12, 'New page item line grid', newPage.includes('ErpLineItemsGrid'))
check(13, 'Edit page item line grid', editPage.includes('ErpLineItemsGrid'))
check(14, 'Save & Create Quotation on new page', newPage.includes('Save & Create Quotation'))
check(15, '360 uses CrmCardFormShell', page360.includes('CrmCardFormShell'))
check(16, '360 Items tab', page360.includes("id: 'items'"))
check(17, 'Pipeline uses ErpCommandBar', pipeline.includes('ErpCommandBar'))
check(18, 'Pipeline navigates to new page', pipeline.includes('/crm/opportunities/new'))
check(19, 'Exported OpportunityNewPage', read('src/modules/crm/index.ts').includes('OpportunityNewPage'))
check(20, 'npm script registered', pkg.includes('test:crm-opportunity-full-page'))

console.log(`\n${pass} passed, ${fail} failed\n`)
process.exit(fail > 0 ? 1 : 0)
