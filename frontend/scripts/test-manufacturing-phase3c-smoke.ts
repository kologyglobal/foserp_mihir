/**
 * Manufacturing Phase 3C (production materials — Inventory + Purchase integration) smoke test.
 * Run: npm run test:manufacturing-phase3c
 */
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

let passed = 0
let failed = 0

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function fileExists(relPath: string): boolean {
  return existsSync(path.join(ROOT, relPath))
}

function read(relPath: string): string {
  return readFileSync(path.join(ROOT, relPath), 'utf8')
}

console.log('\n── Manufacturing production (Phase 3C) smoke ──\n')

console.log('Backend module:')
check('material routes file exists', fileExists('../backend/src/modules/manufacturing/materials/material.routes.ts'))
check('material service file exists', fileExists('../backend/src/modules/manufacturing/materials/material.service.ts'))
check('phase 3c backend test exists', fileExists('../backend/tests/manufacturing-phase3c.test.ts'))
check('phase 3c migration exists', fileExists('../backend/prisma/migrations/20260720190000_manufacturing_phase3c_materials/migration.sql'))

console.log('\nTypes & API service:')
const typesSrc = read('src/types/manufacturingProduction.ts')
check('ProductionOrderMaterial type exported', typesSrc.includes('export interface ProductionOrderMaterial'))
check('MaterialsReadiness type exported', typesSrc.includes('export interface MaterialsReadiness'))
check('ACTIVE material control status', typesSrc.includes("'ACTIVE'"))

const apiSrc = read('src/services/api/manufacturingApi.ts')
const expectedApiExports = [
  'listWorkOrderMaterials',
  'getWorkOrderMaterialsReadiness',
  'syncWorkOrderMaterialRequirements',
  'reserveWorkOrderMaterials',
  'issueWorkOrderMaterial',
  'returnWorkOrderMaterial',
  'createWorkOrderShortageRequisition',
]
for (const fn of expectedApiExports) {
  check(`API client exports ${fn}`, apiSrc.includes(`export async function ${fn}(`))
}

console.log('\nWork order detail UI:')
const woDetailSrc = read('src/modules/manufacturing/work-orders/ApiWorkOrderDetailPage.tsx')
check('materials tab loads readiness', woDetailSrc.includes('getWorkOrderMaterialsReadiness'))
check('reserve action wired', woDetailSrc.includes('reserveWorkOrderMaterials'))
check('issue action wired', woDetailSrc.includes('issueWorkOrderMaterial'))
check('shortage PR action wired', woDetailSrc.includes('createWorkOrderShortageRequisition'))

console.log('\nPermissions:')
const permissionsSrc = read('src/utils/permissions/manufacturing.ts')
check('canViewMaterials on WO permissions', permissionsSrc.includes('canViewMaterials'))
check('canIssueMaterials on WO permissions', permissionsSrc.includes('canIssueMaterials'))

console.log('\nDocs:')
check('phase 3c readme exists', fileExists('../docs/manufacturing/PRODUCTION_PHASE3C_README.md'))

console.log(`\nResult: ${passed} passed, ${failed} failed\n`)
process.exit(failed > 0 ? 1 : 0)
