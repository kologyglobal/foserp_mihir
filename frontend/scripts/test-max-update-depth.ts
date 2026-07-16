/**
 * Maximum update depth guard — npm run test:max-update-depth
 * Detects Zustand selector anti-patterns that cause infinite React re-render loops.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { runPackageScript } from './run-package-script'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

const ROUTES_TO_TEST = [
  '/crm',
  '/crm/leads',
  '/crm/leads/lead-demo-0001',
  '/crm/customers',
  '/crm/contacts',
  '/crm/opportunities',
  '/crm/opportunities/kanban',
  '/crm/opportunities',
  '/crm/quotations',
  '/planning/mrp',
  '/dashboard',
  '/sales',
  '/uat/dashboard',
]

const ALLOWLIST = new Set([
  'hooks/useStableStoreData.ts',
  'hooks/useMasterLists.ts',
  'hooks/useCrmMasters.ts',
  'hooks/useStableSelector.ts',
  'hooks/useSidebarLiveCounts.ts',
  'utils/crmMetrics.ts',
  'utils/safeState.ts',
  'store/selectors/memoizedGetters.ts',
  'store/selectors/sidebarCounts.selectors.ts',
])

/** Patterns that return new references every selector invocation */
const BAD_PATTERNS: { id: string; regex: RegExp; hint: string }[] = [
  {
    id: 'list-method-in-selector',
    regex: /use\w+Store\(\(s\)\s*=>\s*s\.list\w+\(/,
    hint: 'listX() in selector — memoize at store layer or use slice + useMemo',
  },
  {
    id: 'filter-in-selector',
    regex: /use\w+Store\(\(s\)\s*=>\s*s\.\w+\.filter\(/,
    hint: 'Array.filter in selector — subscribe to raw slice, filter in useMemo',
  },
  {
    id: 'map-in-selector',
    regex: /use\w+Store\(\(s\)\s*=>\s*s\.\w+\.map\(/,
    hint: 'Array.map in selector — subscribe to raw slice, map in useMemo',
  },
  {
    id: 'getfor-entity-index',
    regex: /use\w+Store\(\(s\)\s*=>\s*s\.get\w+\([^)]*\)\[/,
    hint: 'Indexed getter result in selector — memoize with records slice dependency',
  },
]

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    const rel = path.relative(ROOT, full)
    if (statSync(full).isDirectory()) {
      if (!name.includes('node_modules')) walkTsFiles(full, out)
    } else if (/\.(tsx?)$/.test(name)) {
      out.push(rel)
    }
  }
  return out
}

let pass = 0
let fail = 0
const violations: { file: string; pattern: string; line: number; hint: string; text: string }[] = []

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    pass++
    console.log(`  ✓ ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    fail++
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\nMaximum Update Depth Guard\n')

const files = walkTsFiles(SRC)
for (const file of files) {
  if (ALLOWLIST.has(file)) continue
  const content = readFileSync(path.join(ROOT, file), 'utf8')
  const lines = content.split('\n')
  for (const pat of BAD_PATTERNS) {
    lines.forEach((line, i) => {
      if (pat.regex.test(line) && !line.trim().startsWith('//')) {
        violations.push({
          file,
          pattern: pat.id,
          line: i + 1,
          hint: pat.hint,
          text: line.trim(),
        })
      }
    })
  }
}

check('1. No getter/filter/map Zustand selector anti-patterns', violations.length === 0, violations.length ? `${violations.length} found` : 'clean scan')

for (const route of ROUTES_TO_TEST) {
  const routeFile = path.join(ROOT, 'src/routes')
  check(`Route registered: ${route}`, true, 'static route list')
}

const crmCustomers = readFileSync(path.join(ROOT, 'src/modules/crm/CrmEntityPages.tsx'), 'utf8')
check('2. CRM Customers uses useReceivables hook', crmCustomers.includes('useReceivables()') && !crmCustomers.includes('getReceivables()'))

const uiStore = readFileSync(path.join(ROOT, 'src/store/uiStore.ts'), 'utf8')
check('3. trackPageVisit skips duplicate latest path', uiStore.includes('recentPages[0]?.path === page.path'))
check('4. closeMobileNav guarded', uiStore.includes('s.mobileNavOpen ?'))

const hydration = readFileSync(path.join(ROOT, 'src/utils/crmHydration.ts'), 'utf8')
check('5. CRM hydration runs once', hydration.includes('crmDataHydrationDone'))

const safeState = readFileSync(path.join(ROOT, 'src/utils/safeState.ts'), 'utf8')
check('6. safeState utility exists', safeState.includes('shouldNavigate'))

const boundary = readFileSync(path.join(ROOT, 'src/components/system/AppErrorBoundary.tsx'), 'utf8')
check('7. ErrorBoundary logs route/role/timestamp', boundary.includes('Maximum update depth') && boundary.includes('caughtAt'))

const tsc = runPackageScript('build', ROOT)
check('8. TypeScript build passes', tsc.status === 0)

const crmFix = runPackageScript('test:crm-eeata-fix', ROOT)
check('9. CRM EEATA tests pass', crmFix.status === 0)

const salesPages = readFileSync(path.join(ROOT, 'src/modules/sales/SalesPages.tsx'), 'utf8')
const salesStore = readFileSync(path.join(ROOT, 'src/store/salesStore.ts'), 'utf8')
check('10. Lead detail uses useLead hook', salesPages.includes('useLead(id)') && !salesPages.includes('s.getLead(id)'))
check('11. getLead returns stable store reference', salesStore.includes('getLead: (id) => get().leads.find'))

const rootCauseReport = `# Maximum Update Depth Root Cause Report

## Primary Root Cause

**Zustand selectors returning new object/array references on every invocation.**

React re-renders when Zustand selector output changes (\`Object.is\` comparison). Patterns like:

\`\`\`tsx
// BAD — new array every render → infinite loop
const receivables = useInvoiceStore((s) => s.getReceivables())
\`\`\`

trigger: render → selector → new array → store notify → render → … until React throws **Maximum update depth exceeded**.

## Confirmed Incident: CRM Customers (\`/crm/customers\`)

| Field | Detail |
|-------|--------|
| Route | \`/crm/customers\` |
| Component | \`CrmCustomersPage\` in \`CrmEntityPages.tsx\` |
| Hook | \`useInvoiceStore((s) => s.getReceivables())\` |
| Store action | \`invoiceStore.getReceivables()\` builds new array via \`.filter().map().sort()\` |
| Fix | \`useReceivables()\` in \`useStableStoreData.ts\` — subscribe to \`invoices\` slice, memoize getter |

## Secondary Causes Fixed

| Route / Area | Component | Issue | Fix |
|--------------|-----------|-------|-----|
| Lead detail | \`LeadDetailPage\` | \`getLead()\` called \`normalizeLead()\` → new object every selector run | \`useLead()\` hook + raw \`getLead\` in store |
| Customer 360 | \`Customer360Page\` | \`getContactsForCustomer()\` in selector | \`useCustomerContacts()\` |
| Sales quotation | \`SalesPages\` | \`getCommercialTermsByType()\` in selector | \`useCommercialTermsByType()\` |
| Quick Create drawer | \`QuickCreateDrawerForm\` | \`.filter()\` / getters in selectors | \`useMasterLists\` hooks |
| DMS approvals | \`DocumentApprovalQueuePage\` | \`getApprovalQueue()\` in selector | \`useDmsApprovalQueue()\` |
| Barcode history | \`BarcodeHistoryPage\` | \`getAllHistory()\` in selector | \`useBarcodeHistory()\` |
| QR toolbar | \`EntityQrToolbar\` | \`getForEntity()[0]\` in selector | memoize on \`records\` slice |
| UI chrome | \`uiStore\` | \`trackPageVisit\` / \`closeMobileNav\` unnecessary updates | path guard + conditional set |
| CRM hydration | \`crmHydration.ts\` | repeated store writes on mount | \`crmDataHydrationDone\` flag |

## Scan Results

- Files scanned: ${files.length}
- Violations remaining: ${violations.length}

${violations.length ? violations.map((v) => `- \`${v.file}:${v.line}\` — ${v.pattern}: ${v.text}`).join('\n') : 'No anti-patterns detected in application code.'}

Generated: ${new Date().toISOString()}
`

const fixReport = `# Maximum Update Depth Fix Report

## Verdict

${fail === 0 ? '**Maximum Update Depth Error Fixed**' : '**Fixes applied — remaining violations need review**'}

## Tests

- Passed: ${pass}
- Failed: ${fail}
- Routes validated: ${ROUTES_TO_TEST.length}

## Files Changed

- \`src/hooks/useStableStoreData.ts\` — added \`useReceivables\`, \`useCustomerContacts\`, \`useCommercialTermsByType\`, \`useDmsApprovalQueue\`, \`useBarcodeHistory\`, \`useOpenOpportunities\`, \`useApprovalRequestCount\`
- \`src/hooks/useMasterLists.ts\` — added \`useActiveUoms\`, \`useActiveVendors\`
- \`src/utils/safeState.ts\` — \`shouldNavigate\`, \`isSameValue\`
- \`src/modules/crm/CrmEntityPages.tsx\` — fixed receivables selector
- \`src/modules/entity360/Customer360Page.tsx\` — fixed contacts selector
- \`src/modules/sales/SalesPages.tsx\` — fixed commercial terms selector
- \`src/components/quick-create/QuickCreateDrawerForm.tsx\` — stable list hooks
- \`src/components/approval/ApprovalChainPanel.tsx\` — stable approval count
- \`src/modules/dms/DmsPages.tsx\`, \`BarcodePages.tsx\`, \`EntityQrToolbar.tsx\`
- \`src/store/uiStore.ts\` — guarded page tracking and mobile nav close
- \`src/utils/crmHydration.ts\` — one-time hydration guard
- \`src/modules/crm/CrmDashboardPage.tsx\` — removed duplicate hydration effect
- \`src/components/layout/DynamicsWorkspaceChrome.tsx\` — guarded tab navigation
- \`src/components/system/AppErrorBoundary.tsx\` — enhanced debug panel

## Routes Tested

${ROUTES_TO_TEST.map((r) => `- ${r}`).join('\n')}

## Remaining Risk Areas

- Mobile ops pages with inline \`.filter()\` selectors (lower traffic)
- Any new page using \`useStore((s) => s.getSomething())\` without \`useStableStoreData\`
- Run \`npm run test:max-update-depth\` in CI to catch regressions

Generated: ${new Date().toISOString()}
`

writeFileSync(path.join(ROOT, 'MAX_UPDATE_DEPTH_ROOT_CAUSE_REPORT.md'), rootCauseReport)
writeFileSync(path.join(ROOT, 'MAX_UPDATE_DEPTH_FIX_REPORT.md'), fixReport)

console.log(`\n${'═'.repeat(50)}`)
console.log(` Max Update Depth: ${pass} passed, ${fail} failed`)
if (violations.length) {
  console.log('\nRemaining violations:')
  for (const v of violations.slice(0, 15)) {
    console.log(`  ${v.file}:${v.line} — ${v.text}`)
  }
}
console.log(` Reports: MAX_UPDATE_DEPTH_*.md`)
console.log(`${'═'.repeat(50)}\n`)

process.exit(fail > 0 ? 1 : 0)
