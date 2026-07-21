/**
 * Fixed Assets Phase 1–3 — static verification (routes, dual-mode service, permissions).
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
  console.log(' Fixed Assets Phase 1–3 verification')
  console.log('═══════════════════════════════════════\n')

  const routesSrc = read('src/routes/accountingRoutes.tsx')
  check('Overview route', routesSrc.includes("path: 'accounting/fixed-assets'"))
  check('Register route', routesSrc.includes('fixed-assets/register'))
  check('Categories route', routesSrc.includes('fixed-assets/categories'))
  check('Depreciation route', routesSrc.includes('fixed-assets/depreciation'))
  check('Asset card route', routesSrc.includes('fixed-assets/register/:id'))
  check('Transfers route', routesSrc.includes('fixed-assets/transfers'))
  check('Disposal route', routesSrc.includes('fixed-assets/disposal'))

  const serviceSrc = read('src/services/accounting/fixedAssetsService.ts')
  check('Service dual-mode isApiMode', serviceSrc.includes('isApiMode()'))
  check('Service fetchFixedAssetsOverview', serviceSrc.includes('fetchFixedAssetsOverview'))
  check('Service fetchFixedAssetCategories', serviceSrc.includes('fetchFixedAssetCategories'))
  check('Service fetchFixedAssets', serviceSrc.includes('fetchFixedAssets'))
  check('Service capitalizeFixedAsset', serviceSrc.includes('capitalizeFixedAsset'))
  check('Service previewDepreciationRun', serviceSrc.includes('previewDepreciationRun'))
  check('Service createDepreciationRun', serviceSrc.includes('createDepreciationRun'))
  check('Service fetchFixedAssetTransfers', serviceSrc.includes('fetchFixedAssetTransfers'))
  check('Service createFixedAssetTransfer', serviceSrc.includes('createFixedAssetTransfer'))
  check('Service completeFixedAssetTransfer', serviceSrc.includes('completeFixedAssetTransfer'))
  check('Service disposeCostAmount support', serviceSrc.includes('disposeCostAmount'))
  check('Demo seed kept for non-API', serviceSrc.includes('seedFixedAssets'))

  const apiSrc = read('src/services/api/fixedAssetsApi.ts')
  check('API overview path', apiSrc.includes('/overview'))
  check('API categories path', apiSrc.includes('/categories'))
  check('API assets path', apiSrc.includes('/assets'))
  check('API capitalize path', apiSrc.includes('/capitalize'))
  check('API depreciation preview path', apiSrc.includes('/depreciation-runs/preview'))
  check('API depreciation runs path', apiSrc.includes('/depreciation-runs'))
  check('API transfers path', apiSrc.includes('/transfers'))
  check('API dispose path', apiSrc.includes('/dispose'))
  check('API dispose preview path', apiSrc.includes('/dispose/preview'))
  check('API disposeCostAmount field', apiSrc.includes('disposeCostAmount'))

  const composerSrc = read('src/services/accounting/fixedAssetsApiComposer.ts')
  check('Composer resolveDefaultLegalEntity', composerSrc.includes('resolveDefaultLegalEntity'))

  const permsSrc = read('src/utils/permissions/fixedAssets.ts')
  check('Permissions map finance.fa.view', permsSrc.includes('finance.fa.view'))
  check('Permissions map finance.fa.capitalize', permsSrc.includes('finance.fa.capitalize'))
  check('Permissions map finance.fa.depreciate', permsSrc.includes('finance.fa.depreciate'))
  check('Permissions map finance.fa.dispose', permsSrc.includes('finance.fa.dispose'))
  check('Permissions map finance.fa.transfer', permsSrc.includes('finance.fa.transfer'))
  check('Permissions API mode flag', permsSrc.includes('isApiMode: true'))

  const disposalPage = read('src/modules/accounting/AssetDisposalPage.tsx')
  check('Disposal page API postDisposal', disposalPage.includes('postDisposal'))
  check('Disposal page isApiMode', disposalPage.includes('isApiMode()'))
  check('Disposal page partial cost field', disposalPage.includes('disposeCostAmount'))

  const transfersPage = read('src/modules/accounting/AssetTransfersPage.tsx')
  check('Transfers page createTransfer', transfersPage.includes('createTransfer'))
  check('Transfers page completeTransfer', transfersPage.includes('completeTransfer'))
  check('Transfers page isApiMode', transfersPage.includes('isApiMode()'))

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
