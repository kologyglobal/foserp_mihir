/**
 * Navigation catalogue access rules (no device required).
 * Run: npx tsx scripts/verify-navigation-catalog.ts
 */
import assert from 'node:assert/strict'
import {
  canAccessNavigationEntry,
  NAVIGATION_CATALOG,
  listHomeNavigation,
  listMoreNavigation,
  listWorkNavigation,
  listApprovalsNavigation,
  resolveDefaultLandingHref,
  type MobileNavigationEntry,
  type NavigationAuthContext,
} from '../src/auth/navigationCatalog.ts'

const modulesAll = [
  { key: 'crm', name: 'CRM', enabled: true },
  { key: 'purchase', name: 'Purchase', enabled: true },
  { key: 'quality', name: 'Quality', enabled: true },
  { key: 'inventory', name: 'Inventory', enabled: true },
  { key: 'manufacturing', name: 'Manufacturing', enabled: true },
  { key: 'gate', name: 'Gate', enabled: true },
  { key: 'masters', name: 'Masters', enabled: true },
]

function ctx(permissions: string[] | null, mods = modulesAll): NavigationAuthContext {
  return { permissions, modules: mods }
}

const gateHome = NAVIGATION_CATALOG.find((e) => e.id === 'gate-home')!
const purchaseAppr = NAVIGATION_CATALOG.find((e) => e.id === 'purchase-approvals')!
const qcQueue = NAVIGATION_CATALOG.find((e) => e.id === 'quality-queue')!
const storeIssue = NAVIGATION_CATALOG.find((e) => e.id === 'store-issue')!
const crmLeads = NAVIGATION_CATALOG.find((e) => e.id === 'crm-leads')!
const profileEntry = NAVIGATION_CATALOG.find((e) => e.id === 'profile')!

// Fail closed when permissions missing
assert.equal(canAccessNavigationEntry(gateHome, { permissions: null, modules: modulesAll }), false)
assert.equal(canAccessNavigationEntry(gateHome, undefined), false)
assert.equal(canAccessNavigationEntry(profileEntry, { permissions: null }), false)

// Module disabled
assert.equal(
  canAccessNavigationEntry(
    purchaseAppr,
    ctx(
      ['purchase.po.approve'],
      modulesAll.map((m) => (m.key === 'purchase' ? { ...m, enabled: false } : m)),
    ),
  ),
  false,
)

// Permission missing
assert.equal(canAccessNavigationEntry(purchaseAppr, ctx(['crm.lead.view'])), false)

// Module on + permission on
assert.equal(canAccessNavigationEntry(purchaseAppr, ctx(['purchase.pr.view'])), true)

// anyOf (quality view gates)
assert.equal(canAccessNavigationEntry(qcQueue, ctx(['quality.view'])), true)
assert.equal(canAccessNavigationEntry(qcQueue, ctx(['manufacturing.quality.view'])), true)
assert.equal(canAccessNavigationEntry(qcQueue, ctx(['crm.lead.view'])), false)

// allOf entry (synthetic)
const allOfEntry: MobileNavigationEntry = {
  id: 'test-allof',
  label: 'AllOf',
  href: '/x',
  module: 'purchase',
  allOf: ['purchase.po.view', 'purchase.po.approve'],
  section: 'more',
}
assert.equal(canAccessNavigationEntry(allOfEntry, ctx(['purchase.po.view'])), false)
assert.equal(
  canAccessNavigationEntry(allOfEntry, ctx(['purchase.po.view', 'purchase.po.approve'])),
  true,
)

// tenant.manage wildcard
assert.equal(canAccessNavigationEntry(storeIssue, ctx(['tenant.manage'])), true)

// Profile (no anyOf) — any loaded permission list including empty
assert.equal(canAccessNavigationEntry(profileEntry, ctx([])), true)

// Role names must not affect access (only permission codes)
assert.equal(canAccessNavigationEntry(gateHome, ctx(['ROLE_GATE_GUARD' as string])), false)

// Scenarios
const purchaseBuyer = ctx(['purchase.po.view', 'purchase.pr.approve', 'purchase.grn.view'])
const gateOnly = ctx(['gate.vehicle.view', 'gate.vehicle.entry', 'gate.vehicle.exit'])
const qcOnly = ctx(['quality.view', 'quality.submit'])
const storeOnly = ctx(['manufacturing.materials.issue', 'manufacturing.materials.return'])
const crmOnly = ctx(['crm.lead.view', 'crm.follow_up.view'])
const supervisor = ctx([
  'purchase.po.approve',
  'quality.view',
  'manufacturing.materials.issue',
  'gate.vehicle.view',
  'crm.lead.view',
])

assert.ok(listHomeNavigation(purchaseBuyer).some((e) => e.group === 'purchase'))
assert.ok(!listHomeNavigation(purchaseBuyer).some((e) => e.group === 'gate'))
assert.ok(listWorkNavigation(purchaseBuyer).some((e) => e.id === 'purchase-grn' || e.id === 'purchase-approvals-work'))
assert.ok(listApprovalsNavigation(purchaseBuyer).some((e) => e.id === 'purchase-approvals'))

assert.ok(listHomeNavigation(gateOnly).some((e) => e.group === 'gate'))
assert.ok(!listHomeNavigation(gateOnly).some((e) => e.group === 'purchase'))

assert.ok(listHomeNavigation(qcOnly).some((e) => e.group === 'quality'))
assert.ok(!listHomeNavigation(qcOnly).some((e) => e.id === 'purchase-orders' || e.group === 'purchase'))

assert.ok(listMoreNavigation(storeOnly).some((e) => e.id === 'store-issue-more' || e.id === 'store-issue'))
assert.ok(!listMoreNavigation(storeOnly).some((e) => e.group === 'purchase'))

assert.ok(canAccessNavigationEntry(crmLeads, crmOnly))
assert.ok(!listHomeNavigation(crmOnly).some((e) => e.group === 'gate'))
assert.ok(listWorkNavigation(crmOnly).some((e) => e.group === 'crm'))

assert.ok(listHomeNavigation(supervisor).length >= 3)

// Empty profile permissions fail closed for anyOf entries
assert.equal(canAccessNavigationEntry(gateHome, ctx([])), false)

// Admin multi-module
const admin = ctx(['tenant.manage'])
const adminHome = listHomeNavigation(admin)
assert.ok(adminHome.some((e) => e.group === 'gate'))
assert.ok(adminHome.some((e) => e.group === 'purchase'))
assert.ok(adminHome.some((e) => e.group === 'quality'))

// Landing always shared home shell in Phase 1 multi-tile cases
assert.equal(resolveDefaultLandingHref(admin), '/(app)/(tabs)')
assert.equal(resolveDefaultLandingHref(ctx(null)), '/(app)/(tabs)')

// Catalogue integrity
const ids = new Set(NAVIGATION_CATALOG.map((e) => e.id))
assert.equal(ids.size, NAVIGATION_CATALOG.length, 'duplicate nav ids')
for (const e of NAVIGATION_CATALOG) {
  assert.ok(e.href.startsWith('/'), `href ${e.id}`)
  assert.ok(e.module, `module ${e.id}`)
  // Operational entries (non profile/settings) declare anyOf
  if (e.group && e.group !== 'other') {
    assert.ok(
      (e.anyOf && e.anyOf.length > 0) || (e.allOf && e.allOf.length > 0),
      `operational entry ${e.id} needs anyOf/allOf`,
    )
  }
}

console.log('Navigation catalogue checks: PASS')
