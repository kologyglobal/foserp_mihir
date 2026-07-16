/**
 * React render stability audit — npm run test:render
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

const ALLOWLIST = new Set([
  'src/hooks/useStableStoreData.ts',
  'src/hooks/useMasterLists.ts',
  'src/hooks/useCrmMasters.ts',
  'src/hooks/useStableSelector.ts',
  'src/hooks/useSidebarLiveCounts.ts',
  'src/utils/crmMetrics.ts',
  'src/utils/safeState.ts',
  'src/store/selectors/memoizedGetters.ts',
  'src/store/selectors/sidebarCounts.selectors.ts',
  // Migration backlog — use useApprovalRequestsPreview() from useStableStoreData
  'src/modules/approval/ApprovalPages.tsx',
])

/** Patterns that allocate new references every selector run — cause infinite loops */
const CRITICAL_PATTERNS: { id: string; regex: RegExp }[] = [
  { id: 'filter-in-selector', regex: /use\w+Store\(\(s\)\s*=>\s*s\.\w+\.filter\(/ },
  { id: 'map-in-selector', regex: /use\w+Store\(\(s\)\s*=>\s*s\.\w+\.map\(/ },
  { id: 'sort-in-selector', regex: /use\w+Store\(\(s\)\s*=>\s*s\.\w+\.sort\(/ },
  { id: 'slice-after-call', regex: /use\w+Store\(\(s\)\s*=>\s*s\.\w+\([^)]*\)\)\.(slice|filter|map|sort)\(/ },
  { id: 'spread-in-selector', regex: /use\w+Store\(\(s\)\s*=>\s*\(\{[^}]+\.\.\./ },
  { id: 'unmemoized-getbykind', regex: /useCrmMasterStore\(\(s\)\s*=>\s*s\.getByKind\(/ },
]

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      if (!name.includes('node_modules')) walkTsFiles(full, out)
    } else if (/\.(tsx?)$/.test(name)) {
      out.push(path.relative(ROOT, full))
    }
  }
  return out
}

let pass = 0
let fail = 0
const violations: { file: string; pattern: string; line: number; text: string }[] = []

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\nReact Render Stability Audit\n')

const files = walkTsFiles(SRC)
for (const file of files) {
  if (ALLOWLIST.has(file)) continue
  const lines = readFileSync(path.join(ROOT, file), 'utf8').split('\n')
  for (const pat of CRITICAL_PATTERNS) {
    lines.forEach((line, i) => {
      if (pat.regex.test(line) && !line.trim().startsWith('//')) {
        violations.push({ file, pattern: pat.id, line: i + 1, text: line.trim() })
      }
    })
  }
}

check('1. No critical selector anti-patterns', violations.length === 0, violations.length ? `${violations.length} violations` : `${files.length} files`)

const architectureChecks: [string, string, RegExp][] = [
  ['2. Memoized getter utility', 'src/store/selectors/memoizedGetters.ts', /memoizedOnSource/],
  ['3. CRM master getByKind memoized', 'src/store/crmMasterStore.ts', /memoizedOnSource/],
  ['4. Approval listRequests memoized', 'src/store/approvalStore.ts', /memoizedOnSource/],
  ['5. Serial listSerials memoized', 'src/store/serialStore.ts', /memoizedOnSource/],
  ['6. GlobalSearch lazy-mounts panel', 'src/components/design-system/GlobalSearch.tsx', /GlobalSearchPanel/],
  ['7. Sidebar reactive badges', 'src/components/layout/Sidebar.tsx', /useSidebarLiveCounts/],
  ['8. CRM bootstrap idempotent', 'src/demo/factories/crmEcosystemBootstrap.ts', /bootstrapStarted/],
  ['9. useCrmMasters entries slice', 'src/hooks/useCrmMasters.ts', /s\.entries/],
  ['10. Entity selector hooks', 'src/hooks/useStableStoreData.ts', /useQuotationDocument/],
]

for (const [label, file, pattern] of architectureChecks) {
  check(label, pattern.test(readFileSync(path.join(ROOT, file), 'utf8')))
}

if (violations.length) {
  console.log('\nCritical violations:')
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line} [${v.pattern}] ${v.text}`)
  }
}

console.log(`\nRender audit: ${pass}/${pass + fail} passed\n`)
process.exit(fail > 0 ? 1 : 0)
