/**
 * Store: material issue/return, stock inquiry, stock count + scan helpers.
 * Structural only (no live backend required).
 * Run via: npm run test:unit
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function src(rel: string) {
  return join(root, rel)
}

function mustExist(...rels: string[]) {
  for (const r of rels) assert.ok(existsSync(src(r)), `missing ${r}`)
}

mustExist(
  'src/features/store/api.ts',
  'src/features/store/hooks.ts',
  'src/features/store/ScanField.tsx',
  'src/features/store/BarcodeCameraModal.tsx',
  'app/(app)/store/material-issue/index.tsx',
  'app/(app)/store/material-return/index.tsx',
  'app/(app)/store/stock/index.tsx',
  'app/(app)/store/stock-count/index.tsx',
  'app/(app)/store/stock-count/[id].tsx',
  'app/(app)/store/transfer/index.tsx',
  'app/(app)/store/transfer/new.tsx',
  'app/(app)/store/transfer/[id].tsx',
)

const api = readFileSync(src('src/features/store/api.ts'), 'utf8')
assert.match(api, /manufacturing\.materials\.issue/)
assert.match(api, /manufacturing\.materials\.return/)
assert.match(api, /createIssueIdempotencyKey/)
assert.match(api, /createReturnIdempotencyKey/)
assert.match(api, /materials\/issue/)
assert.match(api, /materials\/return/)
assert.match(api, /inventory\/balances/)
assert.match(api, /inventory\/stock-counts/)
assert.match(api, /inventory\/transfers/)
assert.match(api, /advanceTransferTowardDispatch/)
assert.match(api, /createTransferDispatchKey/)
assert.match(api, /retries:\s*0/)
assert.match(api, /extractWorkOrderScan/)
assert.match(api, /normalizeScan/)
assert.ok(!api.includes('AsyncStorage'))

const scan = readFileSync(src('src/features/store/ScanField.tsx'), 'utf8')
assert.match(scan, /onSubmitEditing/)
assert.match(scan, /barcode-outline/)
assert.match(scan, /BarcodeCameraModal/)
assert.match(scan, /camera-outline/)

const cam = readFileSync(src('src/features/store/BarcodeCameraModal.tsx'), 'utf8')
assert.match(cam, /expo-camera/)
assert.match(cam, /CameraView/)
assert.match(cam, /onBarcodeScanned/)
assert.match(cam, /useCameraPermissions/)

const pkg = readFileSync(src('package.json'), 'utf8')
assert.match(pkg, /"expo-camera"/)

const appConfig = readFileSync(src('app.config.ts'), 'utf8')
assert.match(appConfig, /expo-camera/)
assert.match(appConfig, /barcodeScannerEnabled/)

for (const [file, needles] of [
  [
    'app/(app)/store/material-issue/index.tsx',
    ['issueWorkOrderMaterial', 'ScanField', 'idempotencyRef', 'canIssue'],
  ],
  [
    'app/(app)/store/material-return/index.tsx',
    ['returnWorkOrderMaterial', 'ScanField', 'netIssued', 'canReturn'],
  ],
  ['app/(app)/store/stock/index.tsx', ['useStockSearch', 'ScanField', 'canView']],
  [
    'app/(app)/store/stock-count/index.tsx',
    ['useStockCountsList', 'createStockCount', 'canCounts'],
  ],
  [
    'app/(app)/store/stock-count/[id].tsx',
    ['enterStockCounts', 'snapshotStockCount', 'useStockCountDetail'],
  ],
  [
    'app/(app)/store/transfer/index.tsx',
    ['useTransfersList', 'canCreate', 'canView'],
  ],
  [
    'app/(app)/store/transfer/new.tsx',
    ['createTransfer', 'advanceTransferTowardDispatch', 'ScanField'],
  ],
  [
    'app/(app)/store/transfer/[id].tsx',
    ['receiveTransfer', 'advanceTransferTowardDispatch', 'canReceive'],
  ],
] as const) {
  const body = readFileSync(src(file), 'utf8')
  assert.ok(!body.includes('ComingSoonScreen'), `${file} still stub`)
  for (const n of needles) assert.match(body, new RegExp(n))
}

const catalog = readFileSync(src('src/auth/navigationCatalog.ts'), 'utf8')
assert.match(catalog, /material-return/)
assert.match(catalog, /manufacturing\.materials\.return/)
assert.match(catalog, /stock-count/)
assert.match(catalog, /inventory\.stock_count/)
assert.match(catalog, /store\/transfer/)
assert.match(catalog, /inventory\.transfers/)

console.log('Store storefront ops structural checks: PASS')
