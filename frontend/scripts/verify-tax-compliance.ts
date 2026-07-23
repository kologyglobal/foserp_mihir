/**
 * GST / Tax Compliance Phase 1 — static verification (routes, extract dual-mode, permissions).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail?: string) {
  if (ok) {
    passed += 1
    console.log(`✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    console.log(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function read(rel: string) {
  return readFileSync(path.join(ROOT, rel), 'utf8')
}

async function main() {
  console.log('═══════════════════════════════════════')
  console.log(' Tax Compliance Phase 1–2 verification')
  console.log('═══════════════════════════════════════\n')

  const routesSrc = read('src/routes/accountingRoutes.tsx')
  check('Overview route', routesSrc.includes("path: 'accounting/tax-compliance'"))
  check('Outward supplies route', routesSrc.includes('outward-supplies'))
  check('Inward supplies route', routesSrc.includes('inward-supplies'))
  check('GSTR-1 route', routesSrc.includes('gstr-1'))

  const serviceSrc = read('src/services/accounting/taxComplianceService.ts')
  check('Service dual-mode isApiMode', serviceSrc.includes('isApiMode()'))
  check('Service fetchOutwardSupplies', serviceSrc.includes('fetchOutwardSupplies'))
  check('Service fetchInwardSupplies', serviceSrc.includes('fetchInwardSupplies'))
  check('Service fetchGstComplianceSummary', serviceSrc.includes('fetchGstComplianceSummary'))
  check('Service fetchEInvoices dual-mode', serviceSrc.includes('fetchEInvoices'))
  check('Service fetchEWayBills dual-mode', serviceSrc.includes('fetchEWayBills'))
  check('Service generateEInvoice', serviceSrc.includes('generateEInvoiceApi') || serviceSrc.includes('generateEInvoice('))
  check('Demo seed kept for non-API', serviceSrc.includes('OUTWARD_SUPPLIES_SEED'))

  const apiSrc = read('src/services/api/taxComplianceApi.ts')
  check('API outward path', apiSrc.includes('/outward-supplies'))
  check('API inward path', apiSrc.includes('/inward-supplies'))
  check('API summary path', apiSrc.includes('/summary'))
  check('API e-invoices path', apiSrc.includes('/e-invoices'))
  check('API e-way-bills path', apiSrc.includes('/e-way-bills'))

  const composerSrc = read('src/services/accounting/taxComplianceApiComposer.ts')
  check('Composer periodKeyToDateRange', composerSrc.includes('periodKeyToDateRange'))
  check('Composer resolveDefaultLegalEntity', composerSrc.includes('resolveDefaultLegalEntity'))

  const permsSrc = read('src/utils/permissions/taxCompliance.ts')
  check('Permissions map finance.tax.view', permsSrc.includes('finance.tax.view'))
  check('Permissions map finance.tax.extract', permsSrc.includes('finance.tax.extract'))
  check('Permissions map einvoice.manage', permsSrc.includes('finance.tax.einvoice.manage'))
  check('Permissions map eway.manage', permsSrc.includes('finance.tax.eway.manage'))
  check('Permissions API mode flag', permsSrc.includes('isApiMode: true'))

  const bannerSrc = read('src/components/accounting/tax-compliance/TaxCompliancePreviewBanner.tsx')
  check('Banner extract-live variant', bannerSrc.includes('extract-live'))
  check('Banner filing-demo variant', bannerSrc.includes('filing-demo'))
  check('Banner mentions simulated NIC', bannerSrc.includes('SIMULATED'))

  const shellSrc = read('src/components/accounting/tax-compliance/TaxComplianceShell.tsx')
  check('Shell banner variant routing', shellSrc.includes('bannerVariantForPath'))
  check('Shell e-invoices extract-live path', shellSrc.includes('e-invoices'))
  check('Shell e-way extract-live path', shellSrc.includes('e-way-bills'))

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
