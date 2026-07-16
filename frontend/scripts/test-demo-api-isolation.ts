/**
 * API mode demo isolation gate — npm run test:demo-api-isolation
 * Ensures src/services/ does not import demo seeds or factory bootstrap data.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SERVICES = path.join(ROOT, 'src', 'services')

interface Violation {
  file: string
  line: number
  importLine: string
  reason: string
}

const violations: Violation[] = []
const checks: Array<{ name: string; ok: boolean; detail?: string }> = []

function rel(p: string): string {
  return path.relative(ROOT, p).replace(/\\/g, '/')
}

function walkTsFiles(dir: string): string[] {
  const out: string[] = []
  if (!existsSync(dir)) return out
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...walkTsFiles(full))
      continue
    }
    if (entry.endsWith('.ts') || entry.endsWith('.tsx')) out.push(full)
  }
  return out
}

const forbiddenPatterns: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /['"]@\/data\/[^'"]*\/seed['"]/i, reason: 'imports data seed module' },
  { pattern: /['"][^'"]*\/data\/[^'"]*\/seed['"]/i, reason: 'imports data seed module' },
  { pattern: /['"][^'"]*\/data\/[^'"]*Seed['"]/, reason: 'imports data Seed module' },
  { pattern: /['"]@\/demo\/seeds/, reason: 'imports demo/seeds' },
  { pattern: /['"][^'"]*\/demo\/seeds/, reason: 'imports demo/seeds' },
  { pattern: /['"]@\/demo\/loadDemoData/, reason: 'imports demo/loadDemoData' },
  { pattern: /['"][^'"]*\/demo\/loadDemoData/, reason: 'imports demo/loadDemoData' },
  { pattern: /['"]@\/demo\/factories/, reason: 'imports demo/factories' },
  { pattern: /['"][^'"]*\/demo\/factories/, reason: 'imports demo/factories' },
]

function scanServicesForForbiddenImports() {
  const files = walkTsFiles(SERVICES)
  for (const file of files) {
    const content = readFileSync(file, 'utf8')
    const lines = content.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (!/^\s*(import|export)\b/.test(line) && !/import\s*\(/.test(line)) continue
      for (const { pattern, reason } of forbiddenPatterns) {
        if (pattern.test(line)) {
          violations.push({
            file: rel(file),
            line: i + 1,
            importLine: line.trim(),
            reason,
          })
        }
      }
    }
  }
}

function checkFileContains(relPath: string, pattern: RegExp, label: string) {
  const full = path.join(ROOT, relPath)
  const ok = existsSync(full) && pattern.test(readFileSync(full, 'utf8'))
  checks.push({ name: label, ok, detail: ok ? undefined : relPath })
  return ok
}

scanServicesForForbiddenImports()

checkFileContains(
  'src/services/bridges/crmMasterApiBridge.ts',
  /\bisApiMode\s*\(/,
  'crmMasterApiBridge gates on isApiMode()',
)
checkFileContains(
  'src/hooks/useCrmApiSync.ts',
  /if\s*\(\s*!isApiMode\s*\(\s*\)\s*\)/,
  'useCrmApiSync gates on isApiMode()',
)
checkFileContains(
  'src/hooks/useMasterApiSync.ts',
  /if\s*\(\s*!isApiMode\s*\(\s*\)\s*\)/,
  'useMasterApiSync gates on isApiMode()',
)

console.log('\n=== Demo / API Isolation Gate ===\n')

if (violations.length === 0) {
  console.log('✓ No forbidden demo/seed imports in src/services/')
} else {
  console.log(`✗ ${violations.length} forbidden import(s) in src/services/:\n`)
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line} — ${v.reason}`)
    console.log(`    ${v.importLine}`)
  }
}

console.log('')
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗'} ${c.name}${c.detail ? ` — ${c.detail}` : ''}`)
}

const failedChecks = checks.filter((c) => !c.ok)
if (violations.length > 0 || failedChecks.length > 0) {
  console.error('\nDemo API isolation gate FAILED')
  process.exit(1)
}

console.log('\nDemo API isolation gate PASSED')
