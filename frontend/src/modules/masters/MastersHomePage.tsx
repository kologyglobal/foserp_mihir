import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  Building2,
  Clock,
  Database,
  Download,
  Hash,
  Package,
  Pin,
  Plus,
  Settings2,
  ShoppingCart,
  Truck,
  Upload,
  Users,
} from 'lucide-react'
import { SearchInput } from '../../components/ui/SearchInput'
import { OperationalPageShell } from '../../components/design-system/OperationalPageShell'
import { ErpCommandBar } from '../../components/erp/ErpCommandBar'
import {
  ALL_MASTER_SETUP_LINKS,
  MASTERS_SETUP_GROUPS,
  type MasterGroupAccent,
  type MasterSetupGroup,
  type MasterSetupLink,
} from '../../config/mastersSetupCatalog'
import { useCodeSeriesStore } from '../../store/codeSeriesStore'
import { useMasterStore } from '../../store/masterStore'
import { useCrmMasterStore } from '../../store/crmMasterStore'
import { useCrmStore } from '../../store/crmStore'
import { useBomStore } from '../../store/bomStore'
import { useWorkCenterStore } from '../../store/workCenterStore'
import { useRoutingStore } from '../../store/routingStore'
import { useSerialStore } from '../../store/serialStore'
import { usePurchaseMasterStore } from '../../store/purchaseMasterStore'
import { useUIStore } from '../../store/uiStore'
import { notify } from '../../store/toastStore'
import {
  buildMasterRecentModified,
  masterSummaryMetrics,
  readPinnedMasters,
  togglePinnedMaster,
} from '../../utils/masterDashboard'
import {
  MASTER_INDEX_CATEGORY_ALL,
  MASTER_INDEX_CATEGORY_PINNED,
  buildMasterIndexRows,
  filterMasterIndexRows,
  type MasterIndexRow,
  groupMasterIndexRows,
  type MasterIndexCategoryFilter,
} from '../../utils/masterIndexSearch'
import {
  MastersIndexChip,
  MastersIndexGroupedSections,
  MastersIndexSidebar,
  MastersIndexTable,
  MastersIndexViewToggle,
  type MastersIndexViewMode,
} from '../../components/masters/MastersIndexHub'
import { resolveMasterLinkIcon } from '../../utils/masterLinkIcons'
import { cn } from '../../utils/cn'

const ACCENT_CSS_VAR: Record<MasterGroupAccent, string> = {
  blue: 'masters-index-dot-blue',
  green: 'masters-index-dot-green',
  amber: 'masters-index-dot-amber',
  cyan: 'masters-index-dot-cyan',
  indigo: 'masters-index-dot-indigo',
  purple: 'masters-index-dot-purple',
  rose: 'masters-index-dot-rose',
  slate: 'masters-index-dot-slate',
}

function MasterTile({
  link,
  count,
  accent,
  pinned,
  onTogglePin,
}: {
  link: MasterSetupLink
  count?: number
  accent: MasterGroupAccent
  pinned?: boolean
  onTogglePin?: () => void
}) {
  const Icon = resolveMasterLinkIcon(link)
  const accentClass = ACCENT_CSS_VAR[accent]

  return (
    <div className={cn('masters-index-tile', accentClass)}>
      {onTogglePin ? (
        <button
          type="button"
          className={cn('masters-index-tile-pin', pinned && 'masters-index-tile-pin-active')}
          aria-label={pinned ? 'Unpin master' : 'Pin master'}
          onClick={(e) => {
            e.preventDefault()
            onTogglePin()
          }}
        >
          <Pin className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
      <Link to={link.path} className="masters-index-tile-link">
        <div className="masters-index-tile-body">
          <span className="masters-index-tile-icon">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
          <div className="masters-index-tile-content">
            <div className="masters-index-tile-title">
              <span>{link.label}</span>
              {typeof count === 'number' ? (
                <span className="masters-index-tile-count">{count.toLocaleString()}</span>
              ) : null}
            </div>
            {link.description ? (
              <p className="masters-index-tile-desc">{link.description}</p>
            ) : null}
          </div>
        </div>
        <span className="masters-index-tile-cta">
          Open register
          <ArrowRight className="h-3 w-3" aria-hidden />
        </span>
      </Link>
    </div>
  )
}

function CategoryTileGrid({
  group,
  counts,
  pinnedPaths,
  onTogglePin,
}: {
  group: MasterSetupGroup
  counts: Record<string, number>
  pinnedPaths: string[]
  onTogglePin: (path: string) => void
}) {
  const accentClass = ACCENT_CSS_VAR[group.accent]
  const GroupIcon = group.icon

  const subsections = useMemo(() => {
    const map = new Map<string, MasterSetupLink[]>()
    for (const link of group.links) {
      const key = link.subsection ?? ''
      const list = map.get(key) ?? []
      list.push(link)
      map.set(key, list)
    }
    return [...map.entries()]
  }, [group.links])

  const showSubsections = subsections.length > 1 || Boolean(subsections[0]?.[0])

  const tileGrid = (links: MasterSetupLink[]) => (
    <div className="masters-index-tile-grid">
      {links.map((link) => (
        <MasterTile
          key={link.path}
          link={link}
          count={link.countKey ? counts[link.countKey] : undefined}
          accent={group.accent}
          pinned={pinnedPaths.includes(link.path)}
          onTogglePin={() => onTogglePin(link.path)}
        />
      ))}
    </div>
  )

  return (
    <section id={`masters-cat-${group.id}`} className={cn('masters-index-category-section', accentClass)}>
      <div className="masters-index-category-header">
        <div className="flex min-w-0 items-start gap-3">
          <span className="masters-index-category-header-icon">
            <GroupIcon className="h-4 w-4" aria-hidden />
          </span>
          <div className="masters-index-category-header-copy">
            <h2>{group.title}</h2>
            <p>{group.description}</p>
          </div>
        </div>
        <span className="masters-index-category-badge">
          {group.links.length} master{group.links.length === 1 ? '' : 's'}
        </span>
      </div>
      {showSubsections ? (
        <div className="space-y-8">
          {subsections.map(([subsection, links]) => (
            <div key={subsection || 'default'}>
              {subsection ? (
                <h3 className="masters-index-subsection-title">{subsection}</h3>
              ) : null}
              {tileGrid(links)}
            </div>
          ))}
        </div>
      ) : (
        tileGrid(group.links)
      )}
    </section>
  )
}

const QUICK_CARDS = [
  { href: '/masters/companies', label: 'Companies', key: 'customers' as const, icon: Building2, accent: 'masters-index-quick-card--green' },
  { href: '/masters/items', label: 'Items', key: 'items' as const, icon: Package, accent: 'masters-index-quick-card--slate' },
  { href: '/masters/vendors', label: 'Vendors', key: 'vendors' as const, icon: Truck, accent: 'masters-index-quick-card--amber' },
  { label: 'Purchase', categoryId: 'purchase' as const, icon: ShoppingCart, accent: 'masters-index-quick-card--amber' },
  { href: '/masters/users', label: 'User Management', key: 'users' as const, icon: Users, accent: 'masters-index-quick-card--indigo' },
  { href: '/masters/code-series', label: 'Code series', countKey: 'codeSeries', icon: Hash, accent: '' },
  { href: '/masters/hsn', label: 'Tax masters', key: 'taxMasters' as const, icon: Hash, accent: 'masters-index-quick-card--cyan' },
] as const

export function MastersHomePage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<MasterIndexCategoryFilter>(MASTER_INDEX_CATEGORY_ALL)
  const [viewMode, setViewMode] = useState<MastersIndexViewMode>('index')
  const [pinnedPaths, setPinnedPaths] = useState<string[]>(() => readPinnedMasters())
  const recentPages = useUIStore((s) => s.recentPages)

  const uoms = useMasterStore((s) => s.uoms)
  const categories = useMasterStore((s) => s.categories)
  const items = useMasterStore((s) => s.items)
  const customers = useMasterStore((s) => s.customers)
  const vendors = useMasterStore((s) => s.vendors)
  const warehouses = useMasterStore((s) => s.warehouses)
  const locations = useMasterStore((s) => s.locations)
  const products = useMasterStore((s) => s.products)
  const bomHeaders = useBomStore((s) => s.bomHeaders)
  const workCenters = useWorkCenterStore((s) => s.workCenters)
  const routingHeaders = useRoutingStore((s) => s.routingHeaders)
  const serialCount = useSerialStore((s) => s.serials.length)
  const hsnMasters = useMasterStore((s) => s.hsnMasters)
  const gstGroups = useMasterStore((s) => s.gstGroups)
  const gstRates = useMasterStore((s) => s.gstRates)
  const paymentMethods = useMasterStore((s) => s.paymentMethods)
  const orderAddresses = useMasterStore((s) => s.vendorOrderAddresses)
  const bankAccounts = useMasterStore((s) => s.bankAccounts)
  const banks = useMasterStore((s) => s.banks)
  const codeSeries = useCodeSeriesStore((s) => s.series)
  const geoCountries = useMasterStore((s) => s.geoCountries)
  const geoStates = useMasterStore((s) => s.geoStates)
  const geoCities = useMasterStore((s) => s.geoCities)
  const crmEntries = useCrmMasterStore((s) => s.entries)
  const purchaseMasterEntries = usePurchaseMasterStore((s) => s.entries)
  const crmContacts = useCrmStore((s) => s.contacts)
  const quotationTemplates = useCrmStore((s) => s.quotationTemplates)

  const userCount = useMemo(
    () => crmEntries.filter((e) => e.kind === 'owners' && e.status === 'active').length,
    [crmEntries],
  )

  const counts: Record<string, number> = useMemo(() => {
    const crmByKind: Record<string, number> = {}
    for (const entry of crmEntries) {
      if (entry.status === 'active') {
        const key = `crm-${entry.kind}`
        crmByKind[key] = (crmByKind[key] ?? 0) + 1
      }
    }
    const purchaseByKind: Record<string, number> = {}
    for (const entry of purchaseMasterEntries) {
      if (entry.status === 'active') {
        const key = `purchase-${entry.kind}`
        purchaseByKind[key] = (purchaseByKind[key] ?? 0) + 1
      }
    }
    return {
      uoms: uoms.length,
      categories: categories.length,
      items: items.length,
      customers: customers.length,
      vendors: vendors.length,
      contacts: crmContacts.length,
      paymentMethods: paymentMethods.length,
      paymentTerms: crmByKind['crm-payment-terms'] ?? 0,
      orderAddresses: orderAddresses.length,
      bankAccounts: bankAccounts.length,
      banks: banks.length,
      codeSeries: codeSeries.length,
      warehouses: warehouses.length,
      locations: locations.length,
      products: products.length,
      boms: bomHeaders.length,
      workCenters: workCenters.length,
      routings: routingHeaders.length,
      serials: serialCount,
      hsn: hsnMasters.length,
      gstGroups: gstGroups.length,
      gstRates: gstRates.length,
      geoCountries: geoCountries.length,
      geoStates: geoStates.length,
      geoCities: geoCities.length,
      territories: crmByKind['crm-territories'] ?? 0,
      industries: crmByKind['crm-industries'] ?? 0,
      productInterests: crmByKind['crm-product-interests'] ?? 0,
      users: userCount,
      'crm-owners': userCount,
      crmMasters: crmEntries.filter((e) => e.status === 'active').length,
      'crm-companies': customers.length,
      'crm-contacts': crmContacts.length,
      'crm-quotation-templates': quotationTemplates.length,
      ...crmByKind,
      ...purchaseByKind,
    }
  }, [
    uoms, categories, items, customers, vendors, crmContacts, quotationTemplates, warehouses, locations, products,
    bomHeaders, workCenters, routingHeaders, serialCount, hsnMasters, gstGroups, gstRates,
    paymentMethods, orderAddresses, bankAccounts, banks, codeSeries, geoCountries, geoStates, geoCities,
    crmEntries, purchaseMasterEntries, userCount,
  ])

  const summary = useMemo(
    () =>
      masterSummaryMetrics({
        customers,
        vendors,
        items,
        users: userCount,
        hsn: hsnMasters.length,
        gstGroups: gstGroups.length,
        gstRates: gstRates.length,
        workCenters,
        bomHeaders,
        routingHeaders,
      }),
    [customers, vendors, items, userCount, hsnMasters, gstGroups, gstRates, workCenters, bomHeaders, routingHeaders],
  )

  const allIndexRows = useMemo(() => buildMasterIndexRows(counts), [counts])
  const filteredRows = useMemo(
    () => filterMasterIndexRows(allIndexRows, search, category, pinnedPaths),
    [allIndexRows, search, category, pinnedPaths],
  )
  const groupedRows = useMemo(() => groupMasterIndexRows(filteredRows), [filteredRows])

  const subsectionSections = useMemo(() => {
    if (
      search ||
      category === MASTER_INDEX_CATEGORY_ALL ||
      category === MASTER_INDEX_CATEGORY_PINNED ||
      filteredRows.length === 0
    ) {
      return null
    }
    const hasSubsections = filteredRows.some((r) => r.subsection)
    if (!hasSubsections) return null

    const map = new Map<string, MasterIndexRow[]>()
    for (const row of filteredRows) {
      const key = row.subsection ?? 'Registers'
      const list = map.get(key) ?? []
      list.push(row)
      map.set(key, list)
    }
    return [...map.entries()].map(([subsection, rows]) => ({
      groupId: `${category}-${subsection}`,
      groupTitle: subsection,
      rows,
    }))
  }, [filteredRows, search, category])

  const filteredGroups = useMemo(() => {
    if (category === MASTER_INDEX_CATEGORY_ALL && !search) return MASTERS_SETUP_GROUPS
    const ids = new Set(filteredRows.map((r) => r.groupId))
    return MASTERS_SETUP_GROUPS.map((g) => ({
      ...g,
      links: g.links.filter((l) => filteredRows.some((r) => r.path === l.path)),
    })).filter((g) => g.links.length > 0 && ids.has(g.id))
  }, [filteredRows, search, category])

  const recentModified = useMemo(
    () => buildMasterRecentModified({ customers, vendors, items, crmEntries, bomHeaders }).slice(0, 4),
    [customers, vendors, items, crmEntries, bomHeaders],
  )

  const recentMasterPages = useMemo(
    () =>
      recentPages
        .filter((p) => p.path.startsWith('/masters') && p.path !== '/masters')
        .slice(0, 4),
    [recentPages],
  )

  const pinnedLinks = useMemo(
    () => pinnedPaths.map((path) => ALL_MASTER_SETUP_LINKS.find((l) => l.path === path)).filter(Boolean) as MasterSetupLink[],
    [pinnedPaths],
  )

  function handleTogglePin(path: string) {
    setPinnedPaths(togglePinnedMaster(path))
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        const input = document.querySelector<HTMLInputElement>('.masters-index-search-row input[type="search"]')
        input?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const showGroupedIndex = !search && category === MASTER_INDEX_CATEGORY_ALL && viewMode === 'index'
  const activeCategoryLabel =
    category === MASTER_INDEX_CATEGORY_ALL
      ? 'All registers'
      : category === MASTER_INDEX_CATEGORY_PINNED
        ? 'Pinned'
        : MASTERS_SETUP_GROUPS.find((g) => g.id === category)?.title ?? category

  function quickCardValue(card: (typeof QUICK_CARDS)[number]) {
    if ('countKey' in card && card.countKey) return counts[card.countKey] ?? 0
    if ('key' in card && card.key) return summary[card.key] ?? 0
    if ('categoryId' in card && card.categoryId === 'purchase') {
      return MASTERS_SETUP_GROUPS.find((g) => g.id === 'purchase')?.links.length ?? 0
    }
    return 0
  }

  return (
    <OperationalPageShell
      title="Master Data"
      description="Find any register — search by name, category, or path"
      layout="enterprise"
      variant="dynamics"
      badge="Master Data"
      favoritePath="/masters"
      showDescription={false}
      commandBar={(
        <ErpCommandBar
          inline
          sticky={false}
          primaryAction={{ id: 'quick-create', label: 'New Item', icon: Plus, onClick: () => navigate('/masters/items/new') }}
          secondaryActions={[
            { id: 'code-series', label: 'Code Series', icon: Hash, onClick: () => navigate('/masters/code-series') },
            { id: 'import', label: 'Import', icon: Upload, onClick: () => notify.info('Open a master register and use Import on its list page.') },
            { id: 'export', label: 'Export', icon: Download, onClick: () => notify.info('Open a master register and use Export on its list page.') },
          ]}
        />
      )}
    >
      <div className="masters-index-page">
        <div className="masters-index-hero">
          <div className="masters-index-hero-card">
            <div className="masters-index-hero-head">
              <span className="masters-index-hero-icon" aria-hidden>
                <Database className="h-6 w-6" />
              </span>
              <div className="masters-index-hero-copy">
                <h1 className="masters-index-hero-title">Master register index</h1>
                <p className="masters-index-hero-sub">
                  Search, browse by category, or pin your most-used registers for quick access.
                </p>
              </div>
              <div className="masters-index-hero-stats">
                <div className="masters-index-hero-stat">
                  <span className="masters-index-hero-stat-value">{ALL_MASTER_SETUP_LINKS.length}</span>
                  <span className="masters-index-hero-stat-label">Registers</span>
                </div>
                <div className="masters-index-hero-stat">
                  <span className="masters-index-hero-stat-value">{summary.customers.toLocaleString()}</span>
                  <span className="masters-index-hero-stat-label">Customers</span>
                </div>
                <div className="masters-index-hero-stat">
                  <span className="masters-index-hero-stat-value">{summary.items.toLocaleString()}</span>
                  <span className="masters-index-hero-stat-label">Items</span>
                </div>
              </div>
            </div>
            <div className="masters-index-search-row">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search masters — customer, item, HSN, vendor, code series…"
                size="lg"
                className="w-full"
                aria-label="Search master registers"
                autoFocus
              />
              <MastersIndexViewToggle mode={viewMode} onChange={setViewMode} />
            </div>
            <p className="masters-index-search-hint">
              {filteredRows.length} of {allIndexRows.length} registers
              {search ? ` matching “${search}”` : ''}
              {' · '}
              Press <kbd>/</kbd> to focus search
            </p>
          </div>
        </div>

        <div className="masters-index-quick">
          {QUICK_CARDS.map((card) => {
            const Icon = card.icon
            const body = (
              <>
                <div className="masters-index-quick-top">
                  <span className="masters-index-quick-label">{card.label}</span>
                  <span className="masters-index-quick-icon">
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </div>
                <span className="masters-index-quick-value">{quickCardValue(card).toLocaleString()}</span>
              </>
            )
            if ('categoryId' in card) {
              return (
                <button
                  key={card.label}
                  type="button"
                  className={cn('masters-index-quick-card text-left', card.accent)}
                  onClick={() => setCategory(card.categoryId)}
                >
                  {body}
                </button>
              )
            }
            return (
              <Link
                key={card.href}
                to={card.href}
                className={cn('masters-index-quick-card', card.accent)}
              >
                {body}
              </Link>
            )
          })}
        </div>

        {!search && (recentModified.length > 0 || recentMasterPages.length > 0 || pinnedLinks.length > 0) ? (
          <div className="masters-index-recent">
            {pinnedLinks.length > 0 ? (
              <div className="masters-index-recent-panel">
                <p className="masters-index-recent-title">
                  <Pin className="h-3 w-3" aria-hidden />
                  Pinned
                </p>
                <div className="masters-index-recent-chips">
                  {pinnedLinks.slice(0, 6).map((l) => (
                    <MastersIndexChip key={l.path} label={l.label} href={l.path} />
                  ))}
                </div>
              </div>
            ) : null}
            {recentMasterPages.length > 0 ? (
              <div className="masters-index-recent-panel">
                <p className="masters-index-recent-title">
                  <Clock className="h-3 w-3" aria-hidden />
                  Recently opened
                </p>
                <div className="masters-index-recent-chips">
                  {recentMasterPages.map((p) => (
                    <MastersIndexChip key={p.path} label={p.label} href={p.path} />
                  ))}
                </div>
              </div>
            ) : null}
            {recentModified.length > 0 ? (
              <div className="masters-index-recent-panel">
                <p className="masters-index-recent-title">
                  <Clock className="h-3 w-3" aria-hidden />
                  Recently modified
                </p>
                <div className="masters-index-recent-chips">
                  {recentModified.map((r) => (
                    <MastersIndexChip key={r.id} label={r.label} href={r.href} sublabel={r.sublabel} />
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="masters-index-layout">
          <MastersIndexSidebar
            groups={MASTERS_SETUP_GROUPS}
            rows={allIndexRows}
            pinnedPaths={pinnedPaths}
            activeCategory={category}
            onCategoryChange={setCategory}
          />

          <div className="masters-index-main">
            <div className="masters-index-toolbar">
              <p className="masters-index-result-meta">
                Showing <strong>{filteredRows.length}</strong> in <strong>{activeCategoryLabel}</strong>
              </p>
            </div>

            {viewMode === 'index' ? (
              showGroupedIndex ? (
                <MastersIndexGroupedSections
                  sections={groupedRows}
                  pinnedPaths={pinnedPaths}
                  onTogglePin={handleTogglePin}
                />
              ) : subsectionSections ? (
                <MastersIndexGroupedSections
                  sections={subsectionSections}
                  pinnedPaths={pinnedPaths}
                  onTogglePin={handleTogglePin}
                />
              ) : (
                <MastersIndexTable
                  rows={filteredRows}
                  pinnedPaths={pinnedPaths}
                  onTogglePin={handleTogglePin}
                />
              )
            ) : (
              <div className="space-y-10">
                {filteredGroups.map((group) => (
                  <CategoryTileGrid
                    key={group.id}
                    group={group}
                    counts={counts}
                    pinnedPaths={pinnedPaths}
                    onTogglePin={handleTogglePin}
                  />
                ))}
              </div>
            )}

            {filteredRows.length === 0 && viewMode === 'grid' ? (
              <div className="masters-index-empty mt-4">
                <p>No masters match your search or filter.</p>
                <button
                  type="button"
                  className="text-sm font-semibold text-erp-primary hover:underline"
                  onClick={() => {
                    setSearch('')
                    setCategory(MASTER_INDEX_CATEGORY_ALL)
                  }}
                >
                  Clear filters
                </button>
              </div>
            ) : null}

            {!search && category === MASTER_INDEX_CATEGORY_ALL ? (
              <section className="masters-index-setup-tip">
                <div className="masters-index-setup-tip-inner">
                  <span className="masters-index-setup-tip-icon">
                    <Settings2 className="h-4 w-4" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-sm font-semibold text-erp-text">Recommended setup order</h2>
                    <p className="mt-1 text-[13px] leading-relaxed text-erp-muted">
                      Administration → Inventory &amp; Tax → Customer &amp; Vendor → Manufacturing (BOM, routing, work centers).
                      Use <Link to="/masters/code-series" className="font-medium text-erp-primary hover:underline">Code Series</Link> before creating new master records.
                      Purchase documents also depend on registers under{' '}
                      <button type="button" className="font-medium text-erp-primary hover:underline" onClick={() => setCategory('purchase')}>
                        Purchase
                      </button>
                      .
                    </p>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </OperationalPageShell>
  )
}
