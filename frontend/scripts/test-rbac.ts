/**
 * RBAC tests — npm run test:rbac
 */
const mem = new Map<string, string>()
;(globalThis as typeof globalThis & { localStorage: Storage }).localStorage = {
  get length() { return mem.size },
  clear() { mem.clear() },
  getItem(k: string) { return mem.get(k) ?? null },
  setItem(k: string, v: string) { mem.set(k, v) },
  removeItem(k: string) { mem.delete(k) },
  key() { return null },
}

const {
  setSessionUserForTests,
  resetSessionUserForTests,
  canPermission,
  canRoute,
  assertPermission,
  getPermissionDenialReason,
} = await import('../src/utils/permissions')
const { usePurchaseStore } = await import('../src/store/purchaseStore')
const { useEcoStore } = await import('../src/store/ecoStore')
const { useQualityStore } = await import('../src/store/qualityStore')
const { useDispatchStore } = await import('../src/store/dispatchStore')
const { useInvoiceStore } = await import('../src/store/invoiceStore')
const { useApprovalStore } = await import('../src/store/approvalStore')
const { resolveRoutePermission } = await import('../src/config/permissionMatrix')

let passed = 0
let failed = 0

function check(n: number, label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++
    console.log(`  ✓ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed++
    console.log(`  ✗ ${n}. ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function reset() {
  resetSessionUserForTests()
  useApprovalStore.getState().resetRulesToDefault()
  useApprovalStore.setState({ requests: [] })
}

console.log('\nRBAC Tests\n')
reset()

// 1. Purchase User cannot approve PO
setSessionUserForTests({ role: 'purchase_user' })
check(1, 'Purchase User cannot approve PO', !canPermission('purchase', 'approve'))
check(2, 'Purchase User assertPermission blocks approve', !assertPermission('purchase', 'approve').ok)

// 3. Purchase Head can approve PO below limit (permission level)
setSessionUserForTests({ role: 'purchase_head' })
check(3, 'Purchase Head has purchase.approve', canPermission('purchase', 'approve'))

// 4. Director has high-level approve
setSessionUserForTests({ role: 'director' })
check(4, 'Director has purchase.approve', canPermission('purchase', 'approve'))

// 5. Store User can post inventory (issue) but not approve PO
setSessionUserForTests({ role: 'store_user' })
check(5, 'Store User can post inventory', canPermission('inventory', 'post'))
check(6, 'Store User cannot approve PO', !canPermission('purchase', 'approve'))

// 7. Quality Inspector cannot close NCR
setSessionUserForTests({ role: 'quality_inspector' })
check(7, 'Quality Inspector cannot close NCR', !canPermission('quality', 'close'))

// 8. Shop Floor cannot close WO (production.close)
setSessionUserForTests({ role: 'shop_floor' })
check(8, 'Shop Floor cannot close WO', !canPermission('production', 'close'))

// 9. Dispatch User cannot override
setSessionUserForTests({ role: 'dispatch_user' })
check(9, 'Dispatch User cannot override', !canPermission('dispatch', 'override'))

// 10. Accounts User cannot cancel invoice
setSessionUserForTests({ role: 'accounts_user' })
check(10, 'Accounts User cannot cancel invoice', !canPermission('accounts', 'cancel'))

// 11. Engineering Head can release ECO
setSessionUserForTests({ role: 'engineering_head' })
check(11, 'Engineering Head can release ECO', canPermission('engineering', 'release'))

// 12. Unauthorized route — shop floor blocked from settings
setSessionUserForTests({ role: 'shop_floor' })
check(12, 'Unauthorized route blocked (/settings)', !canRoute('/settings/roles'))
check(13, 'Route permission resolved for settings', resolveRoutePermission('/settings/roles') === 'settings.view')

// 14. Permission denial reason is descriptive
check(
  14,
  'Denial reason mentions role and permission',
  getPermissionDenialReason('settings', 'view').includes('settings') &&
    getPermissionDenialReason('settings', 'view').includes('Shop Floor'),
)

// 15. Admin has all permissions
setSessionUserForTests({ role: 'admin' })
check(15, 'Admin can access settings', canRoute('/settings/roles'))
check(16, 'Admin can approve purchase', canPermission('purchase', 'approve'))

console.log(`\nRBAC: ${passed}/${passed + failed} passed${failed ? `, ${failed} failed` : ''}\n`)
process.exit(failed ? 1 : 0)
