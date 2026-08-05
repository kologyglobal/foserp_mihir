/**
 * Single source of truth for operational + CRM mobile navigation.
 * Visibility: tenant module enabled AND user permissions (fail-closed when profile missing).
 */
import { can, canAll, canAny } from '@/auth/permissions'
import { isModuleEnabled } from '@/auth/modules'
import type { ModuleStatus } from '@/types/api'

export type NavigationSection = 'home' | 'work' | 'approvals' | 'more'

export interface MobileNavigationEntry {
  id: string
  label: string
  description?: string
  href: string
  module: string
  /** User needs at least one of these (exact permission strings). */
  anyOf?: string[]
  /** User needs every permission listed. */
  allOf?: string[]
  section: NavigationSection
  /** Ionicon name used by more/home tiles. */
  icon?: string
  /** Lower = higher priority for home tiles and default landing. */
  priority?: number
  /** When true entry never renders (diagnostics reserved). */
  hidden?: boolean
  /** Module grouping for More screen. */
  group?: 'crm' | 'purchase' | 'quality' | 'store' | 'gate' | 'other'
}

export type NavigationAuthContext = {
  modules?: ModuleStatus[]
  /**
   * Permission strings for the user. `null` / `undefined` = fail closed.
   * Pass explicit `[]` when profile loaded with no grants.
   */
  permissions?: string[] | null
}

/**
 * Prefer this over ad-hoc filters on Home / Work / More / Approvals.
 * Fail closed when permissions are not provided.
 */
export function canAccessNavigationEntry(
  entry: MobileNavigationEntry,
  authContext?: NavigationAuthContext,
): boolean {
  if (entry.hidden) return false

  const permissions = authContext?.permissions
  if (permissions == null) return false

  if (!isModuleEnabled(entry.module, authContext?.modules)) return false

  if (entry.allOf && entry.allOf.length > 0 && !canAll(entry.allOf, permissions)) {
    return false
  }

  if (entry.anyOf && entry.anyOf.length > 0 && !canAny(entry.anyOf, permissions)) {
    return false
  }

  // No permission keys supplied → require authenticated profile only (settings-style).
  // Operational entries should always declare anyOf/allOf.
  return true
}

export function listAccessibleNavigation(
  section?: NavigationSection,
  authContext?: NavigationAuthContext,
): MobileNavigationEntry[] {
  return NAVIGATION_CATALOG.filter((e) => {
    if (section && e.section !== section) return false
    return canAccessNavigationEntry(e, authContext)
  }).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
}

/** Home tiles: entries tagged home, plus high-priority operational dests still accessible. */
export function listHomeNavigation(authContext?: NavigationAuthContext): MobileNavigationEntry[] {
  return NAVIGATION_CATALOG.filter(
    (e) => e.section === 'home' && canAccessNavigationEntry(e, authContext),
  ).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
}

export function listMoreNavigation(authContext?: NavigationAuthContext): MobileNavigationEntry[] {
  return NAVIGATION_CATALOG.filter(
    (e) => e.section === 'more' && canAccessNavigationEntry(e, authContext),
  ).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
}

export function listWorkNavigation(authContext?: NavigationAuthContext): MobileNavigationEntry[] {
  return NAVIGATION_CATALOG.filter(
    (e) => e.section === 'work' && canAccessNavigationEntry(e, authContext),
  ).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
}

export function listApprovalsNavigation(authContext?: NavigationAuthContext): MobileNavigationEntry[] {
  return NAVIGATION_CATALOG.filter(
    (e) => e.section === 'approvals' && canAccessNavigationEntry(e, authContext),
  ).sort((a, b) => (a.priority ?? 100) - (b.priority ?? 100))
}

/**
 * Default post-login destination (Phase 15).
 * Prefer first single-focus operational entry when user has only one "primary" dest;
 * otherwise shared Home. Priority order among operational hubs is encoded in `priority`.
 */
export function resolveDefaultLandingHref(authContext?: NavigationAuthContext): string {
  const home = listHomeNavigation(authContext)
  if (home.length === 0) return '/(app)/(tabs)'
  if (home.length === 1) return home[0]!.href

  // Multiple modules → shared home shell.
  const operationalGroups = new Set(home.map((h) => h.group).filter(Boolean))
  if (operationalGroups.size > 1) return '/(app)/(tabs)'

  // Only one operational family (or CRM-only) with multiple tiles — still land on Home.
  return '/(app)/(tabs)'
}

/** Convenience for hooks — reads modules + perms maps. */
export function authContextFromProfile(profile: {
  modules?: ModuleStatus[]
  permissions?: string[] | null
} | null | undefined): NavigationAuthContext {
  if (!profile) return { permissions: null }
  return {
    modules: profile.modules ?? [],
    permissions: profile.permissions ?? [],
  }
}

// ─── Catalogue ───────────────────────────────────────────────────────────────

export const NAVIGATION_CATALOG: MobileNavigationEntry[] = [
  // ── Gate (high field priority) ───────────────────────────────────────────
  {
    id: 'gate-home',
    label: 'Gate',
    description: 'Vehicles, material movement, activity',
    href: '/(app)/gate',
    module: 'gate',
    anyOf: [
      'gate.dashboard.view',
      'gate.register.view',
      'gate.vehicle.view',
      'gate.material_inward.view',
      'gate.material_outward.view',
      'gate.approval.view',
    ],
    section: 'home',
    group: 'gate',
    icon: 'car-outline',
    priority: 10,
  },
  {
    id: 'gate-pending',
    label: 'Pending vehicles',
    description: 'Vehicles awaiting action',
    href: '/(app)/gate/pending',
    module: 'gate',
    anyOf: ['gate.vehicle.view', 'gate.register.view'],
    section: 'work',
    group: 'gate',
    icon: 'time-outline',
    priority: 12,
  },
  {
    id: 'gate-in',
    label: 'Gate in',
    href: '/(app)/gate/gate-in',
    module: 'gate',
    anyOf: ['gate.vehicle.entry', 'gate.vehicle.create', 'gate.material_inward.create'],
    section: 'work',
    group: 'gate',
    icon: 'enter-outline',
    priority: 11,
  },
  {
    id: 'gate-out',
    label: 'Gate out',
    href: '/(app)/gate/gate-out',
    module: 'gate',
    anyOf: ['gate.vehicle.exit', 'gate.material_outward.release'],
    section: 'work',
    group: 'gate',
    icon: 'exit-outline',
    priority: 13,
  },
  {
    id: 'gate-vehicles',
    label: 'Vehicles',
    href: '/(app)/gate/vehicles',
    module: 'gate',
    anyOf: ['gate.vehicle.view'],
    section: 'more',
    group: 'gate',
    icon: 'bus-outline',
    priority: 14,
  },
  {
    id: 'gate-approvals',
    label: 'Gate approvals',
    href: '/(app)/gate/pending',
    module: 'gate',
    anyOf: ['gate.approval.view', 'gate.approval.action'],
    section: 'approvals',
    group: 'gate',
    icon: 'shield-checkmark-outline',
    priority: 15,
  },

  // ── Quality ──────────────────────────────────────────────────────────────
  {
    id: 'quality-home',
    label: 'Quality / QC',
    description: 'Inspection queue and decisions',
    href: '/(app)/quality',
    module: 'quality',
    anyOf: [
      'quality.view',
      'quality.incoming.view',
      'purchase.qi.view',
      'manufacturing.quality.view',
      'manufacturing.quality.inspect',
    ],
    section: 'home',
    group: 'quality',
    icon: 'checkmark-circle-outline',
    priority: 20,
  },
  {
    id: 'quality-queue',
    label: 'QC queue',
    href: '/(app)/quality/queue',
    module: 'quality',
    anyOf: [
      'quality.view',
      'manufacturing.quality.view',
      'quality.incoming.view',
      'purchase.qi.view',
    ],
    section: 'work',
    group: 'quality',
    icon: 'list-outline',
    priority: 21,
  },
  {
    id: 'quality-queue-more',
    label: 'QC queue',
    href: '/(app)/quality/queue',
    module: 'quality',
    anyOf: [
      'quality.view',
      'manufacturing.quality.view',
      'quality.incoming.view',
      'purchase.qi.view',
    ],
    section: 'more',
    group: 'quality',
    icon: 'list-outline',
    priority: 22,
  },

  // ── Store / inventory + manufacturing materials ────────────────────────────
  {
    id: 'store-home',
    label: 'Store',
    description: 'Issue, return, stock, counts',
    href: '/(app)/store',
    module: 'inventory',
    anyOf: [
      'manufacturing.materials.view',
      'manufacturing.materials.issue',
      'manufacturing.materials.return',
      'inventory.stock.view',
      'inventory.view',
      'inventory.stock_count.view',
      'manufacturing.store_workbench.view',
    ],
    section: 'home',
    group: 'store',
    icon: 'cube-outline',
    priority: 30,
  },
  {
    id: 'store-issue',
    label: 'Material issue',
    href: '/(app)/store/material-issue',
    module: 'manufacturing',
    anyOf: ['manufacturing.materials.issue'],
    section: 'work',
    group: 'store',
    icon: 'arrow-up-circle-outline',
    priority: 31,
  },
  {
    id: 'store-return',
    label: 'Material return',
    href: '/(app)/store/material-return',
    module: 'manufacturing',
    anyOf: ['manufacturing.materials.return'],
    section: 'work',
    group: 'store',
    icon: 'arrow-down-circle-outline',
    priority: 32,
  },
  {
    id: 'store-issue-more',
    label: 'Material issue',
    href: '/(app)/store/material-issue',
    module: 'manufacturing',
    anyOf: ['manufacturing.materials.issue'],
    section: 'more',
    group: 'store',
    icon: 'arrow-up-circle-outline',
    priority: 33,
  },
  {
    id: 'store-return-more',
    label: 'Material return',
    href: '/(app)/store/material-return',
    module: 'manufacturing',
    anyOf: ['manufacturing.materials.return'],
    section: 'more',
    group: 'store',
    icon: 'arrow-down-circle-outline',
    priority: 34,
  },
  {
    id: 'store-stock',
    label: 'Stock inquiry',
    href: '/(app)/store/stock',
    module: 'inventory',
    anyOf: ['inventory.stock.view', 'inventory.view'],
    section: 'more',
    group: 'store',
    icon: 'search-outline',
    priority: 35,
  },
  {
    id: 'store-count',
    label: 'Stock count',
    href: '/(app)/store/stock-count',
    module: 'inventory',
    anyOf: ['inventory.stock_count.view', 'inventory.stock_count.create', 'inventory.stock_count.count'],
    section: 'more',
    group: 'store',
    icon: 'clipboard-outline',
    priority: 36,
  },
  {
    id: 'store-transfer',
    label: 'Stock transfer',
    href: '/(app)/store/transfer',
    module: 'inventory',
    anyOf: ['inventory.transfers.view', 'inventory.transfers.create'],
    section: 'more',
    group: 'store',
    icon: 'swap-horizontal-outline',
    priority: 37,
  },

  // ── Purchase ─────────────────────────────────────────────────────────────
  {
    id: 'purchase-home',
    label: 'Purchase',
    description: 'Approvals, PR, POs, GRN, QC',
    href: '/(app)/purchase',
    module: 'purchase',
    anyOf: [
      'purchase.view',
      'purchase.pr.view',
      'purchase.po.view',
      'purchase.pr.approve',
      'purchase.po.approve',
      'purchase.grn.view',
      'purchase.grn.create',
      'purchase.qi.view',
    ],
    section: 'home',
    group: 'purchase',
    icon: 'cart-outline',
    priority: 40,
  },
  {
    id: 'purchase-approvals',
    label: 'Purchase approvals',
    href: '/(app)/purchase/approvals',
    module: 'purchase',
    anyOf: [
      'purchase.pr.approve',
      'purchase.po.approve',
      'purchase.pr.view',
      'purchase.po.view',
    ],
    section: 'approvals',
    group: 'purchase',
    icon: 'shield-checkmark-outline',
    priority: 41,
  },
  {
    id: 'purchase-approvals-work',
    label: 'Purchase approvals',
    href: '/(app)/purchase/approvals',
    module: 'purchase',
    anyOf: [
      'purchase.pr.approve',
      'purchase.po.approve',
      'purchase.pr.view',
      'purchase.po.view',
    ],
    section: 'work',
    group: 'purchase',
    icon: 'shield-checkmark-outline',
    priority: 41,
  },
  {
    id: 'purchase-requisitions',
    label: 'Purchase requisitions',
    href: '/(app)/purchase/requisitions',
    module: 'purchase',
    anyOf: ['purchase.pr.view'],
    section: 'more',
    group: 'purchase',
    icon: 'clipboard-outline',
    priority: 45,
  },
  {
    id: 'purchase-requisitions-work',
    label: 'Draft PRs to submit',
    href: '/(app)/purchase/requisitions?filter=draft',
    module: 'purchase',
    anyOf: ['purchase.pr.view', 'purchase.pr.submit'],
    section: 'work',
    group: 'purchase',
    icon: 'clipboard-outline',
    priority: 46,
  },
  {
    id: 'purchase-orders',
    label: 'Purchase orders',
    href: '/(app)/purchase/purchase-orders',
    module: 'purchase',
    anyOf: ['purchase.po.view'],
    section: 'more',
    group: 'purchase',
    icon: 'document-text-outline',
    priority: 42,
  },
  {
    id: 'purchase-grn',
    label: 'GRN receiving',
    href: '/(app)/purchase/grn',
    module: 'purchase',
    anyOf: ['purchase.grn.view', 'purchase.grn.create', 'purchase.grn.post'],
    section: 'work',
    group: 'purchase',
    icon: 'cube-outline',
    priority: 43,
  },
  {
    id: 'purchase-grn-more',
    label: 'GRN receiving',
    href: '/(app)/purchase/grn',
    module: 'purchase',
    anyOf: ['purchase.grn.view', 'purchase.grn.create'],
    section: 'more',
    group: 'purchase',
    icon: 'cube-outline',
    priority: 44,
  },
  {
    id: 'purchase-qi',
    label: 'Purchase QC handoff',
    description: 'Read-only QI from GRNs',
    href: '/(app)/purchase/quality-inspections',
    module: 'purchase',
    anyOf: ['purchase.qi.view'],
    section: 'work',
    group: 'purchase',
    icon: 'flask-outline',
    priority: 47,
  },
  {
    id: 'purchase-qi-more',
    label: 'Purchase QC handoff',
    href: '/(app)/purchase/quality-inspections',
    module: 'purchase',
    anyOf: ['purchase.qi.view'],
    section: 'more',
    group: 'purchase',
    icon: 'flask-outline',
    priority: 48,
  },
  {
    id: 'purchase-rfq',
    label: 'RFQs',
    href: '/(app)/purchase/rfq',
    module: 'purchase',
    anyOf: ['purchase.rfq.view'],
    section: 'more',
    group: 'purchase',
    icon: 'chatbubbles-outline',
    priority: 49,
  },
  {
    id: 'purchase-invoices',
    label: 'Purchase invoices',
    href: '/(app)/purchase/invoices',
    module: 'purchase',
    anyOf: ['purchase.invoice.view'],
    section: 'more',
    group: 'purchase',
    icon: 'card-outline',
    priority: 50,
  },
  {
    id: 'purchase-returns',
    label: 'Purchase returns',
    href: '/(app)/purchase/returns',
    module: 'purchase',
    anyOf: ['purchase.return.view', 'purchase.return.create'],
    section: 'more',
    group: 'purchase',
    icon: 'return-down-back-outline',
    priority: 51,
  },

  // ── CRM (preserve existing) ──────────────────────────────────────────────
  {
    id: 'crm-home-tile',
    label: 'CRM',
    description: 'Pipeline, follow-ups, customers',
    href: '/(app)/(tabs)',
    module: 'crm',
    anyOf: [
      'crm.lead.view',
      'crm.opportunity.view',
      'crm.quotation.view',
      'crm.follow_up.view',
      'crm.company.view',
      'crm.contact.view',
    ],
    section: 'home',
    group: 'crm',
    icon: 'people-outline',
    priority: 50,
  },
  {
    id: 'crm-leads',
    label: 'Leads',
    href: '/(app)/crm/leads',
    module: 'crm',
    anyOf: ['crm.lead.view'],
    section: 'more',
    group: 'crm',
    icon: 'person-outline',
    priority: 51,
  },
  {
    id: 'crm-opportunities',
    label: 'Opportunities',
    href: '/(app)/crm/opportunities',
    module: 'crm',
    anyOf: ['crm.opportunity.view'],
    section: 'more',
    group: 'crm',
    icon: 'funnel-outline',
    priority: 52,
  },
  {
    id: 'crm-quotations',
    label: 'Quotations',
    href: '/(app)/crm/quotations',
    module: 'crm',
    anyOf: ['crm.quotation.view'],
    section: 'more',
    group: 'crm',
    icon: 'document-text-outline',
    priority: 53,
  },
  {
    id: 'crm-sales-orders',
    label: 'Sales orders',
    href: '/(app)/crm/sales-orders',
    module: 'crm',
    anyOf: ['crm.sales_order.view'],
    section: 'more',
    group: 'crm',
    icon: 'cart-outline',
    priority: 54,
  },
  {
    id: 'crm-follow-ups',
    label: 'Follow-ups',
    href: '/(app)/crm/follow-ups',
    module: 'crm',
    anyOf: ['crm.follow_up.view'],
    section: 'work',
    group: 'crm',
    icon: 'alarm-outline',
    priority: 55,
  },
  {
    id: 'crm-follow-ups-more',
    label: 'Follow-ups',
    href: '/(app)/crm/follow-ups',
    module: 'crm',
    anyOf: ['crm.follow_up.view'],
    section: 'more',
    group: 'crm',
    icon: 'alarm-outline',
    priority: 56,
  },
  {
    id: 'crm-business-card',
    label: 'Scan business card',
    href: '/(app)/crm/business-card',
    module: 'crm',
    anyOf: ['crm.lead.create', 'crm.company.create', 'crm.contact.create', 'crm.lead.view'],
    section: 'more',
    group: 'crm',
    icon: 'scan-outline',
    priority: 56.5,
  },
  {
    id: 'crm-search',
    label: 'CRM search',
    href: '/(app)/crm/search',
    module: 'crm',
    anyOf: ['crm.lead.view', 'crm.company.view', 'crm.contact.view'],
    section: 'more',
    group: 'crm',
    icon: 'search-outline',
    priority: 57,
  },
  {
    id: 'crm-collection',
    label: 'Collection',
    href: '/(app)/crm/collection',
    module: 'crm',
    anyOf: ['finance.ar.view', 'tenant.manage'],
    section: 'more',
    group: 'crm',
    icon: 'cash-outline',
    priority: 58,
  },
  {
    id: 'crm-quotation-approvals',
    label: 'Quotation approvals',
    href: '/(app)/crm/quotations',
    module: 'crm',
    anyOf: ['crm.quotation.approve', 'crm.quotation.view'],
    section: 'approvals',
    group: 'crm',
    icon: 'document-text-outline',
    priority: 59,
  },

  // ── Always-on account ────────────────────────────────────────────────────
  {
    id: 'profile',
    label: 'Profile',
    href: '/(app)/profile',
    module: 'masters',
    section: 'more',
    group: 'other',
    icon: 'person-circle-outline',
    priority: 90,
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/(app)/settings',
    module: 'masters',
    section: 'more',
    group: 'other',
    icon: 'settings-outline',
    priority: 91,
  },
]

// Re-export helpers used in tests
export { can, canAny, canAll }
