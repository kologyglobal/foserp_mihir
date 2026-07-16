/**
 * UI consistency gate — npm run test:ui
 */
import { runPackageScript } from './run-package-script'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const suites = [
  'test:design-system',
  'test:ui-ux-audit',
  'test:dynamics-theme',
  'test:saas-ui',
  'test:modern-erp-ui',
  'test:form-action-usability',
] as const

let failed = 0

console.log('\nUI Consistency Gate\n')

for (const script of suites) {
  const result = runPackageScript(script, ROOT)
  const ok = result.status === 0
  if (!ok) failed++
  console.log(`${ok ? '✓' : '✗'} ${script}`)
}

console.log(`\nUI gate: ${suites.length - failed}/${suites.length} passed\n`)
process.exit(failed > 0 ? 1 : 0)
