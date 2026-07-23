import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Database,
  Factory,
  FileText,
  Handshake,
  Hash,
  Layers,
  LayoutDashboard,
  Package,
  QrCode,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  Target,
  TrendingUp,
  Truck,
  Users,
  Warehouse,
  Wrench,
  X,
  FileCheck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { searchablePages } from '../../config/navigation'
import { useUIStore } from '../../store/uiStore'
import { useMrpStore } from '../../store/mrpStore'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { useMasterStore } from '../../store/masterStore'
import { useBomStore } from '../../store/bomStore'
import { useInvoiceStore } from '../../store/invoiceStore'
import { useQrStore } from '../../store/qrStore'
import { useSerialStore } from '../../store/serialStore'
import { useEcoStore } from '../../store/ecoStore'
import { useWorkCenterStore } from '../../store/workCenterStore'
import { useRoutingStore } from '../../store/routingStore'
import { useCrmMasterStore } from '../../store/crmMasterStore'
import { useCrmStore } from '../../store/crmStore'
import { useCodeSeriesStore } from '../../store/codeSeriesStore'
import { buildGlobalSearchIndex, searchGlobalIndex, type GlobalSearchHit } from '../../utils/globalSearchIndex'
import { resolveCompany360Path } from '../../config/entity360Routes'
import { cn } from '../../utils/cn'
import { useCrmGlobalSearch } from '../../hooks/useCrmGlobalSearch'
import { canCrmPermission } from '../../utils/permissions/crm'

const PAGE_ICON_BY_PATH = Object.fromEntries(searchablePages.map((page) => [page.path, page])) as Record<
  string,
  (typeof searchablePages)[number]
>

const CRM_QUICK_ACTIONS = [
  { id: 'new-lead', label: 'New Lead', sublabel: 'Create a CRM lead', href: '/crm/leads/new', icon: Target },
  { id: 'new-opp', label: 'New Opportunity', sublabel: 'Start a pipeline opportunity', href: '/crm/opportunities/new', icon: Handshake },
  { id: 'new-quo', label: 'New Quotation', sublabel: 'Build a CRM quotation', href: '/crm/quotations/new', icon: FileText },
  { id: 'crm-forecast', label: 'Sales Forecast', sublabel: 'Weighted pipeline forecast', href: '/crm/forecast', icon: TrendingUp },
] as const

function iconForHit(hit: GlobalSearchHit): LucideIcon {
  if (hit.group === 'page') {
    const page = PAGE_ICON_BY_PATH[hit.href]
    if (page?.workspace) return LayoutDashboard
    return page?.icon ?? FileText
  }

  switch (hit.type) {
    case 'SO':
      return ShoppingCart
    case 'PO':
    case 'Vendor':
    case 'Transporter':
    case 'JWO':
    case 'Challan':
      return Truck
    case 'WO':
    case 'WO 360':
    case 'Job Card':
      return Wrench
    case 'Item':
    case 'BOM':
    case 'BOM 360':
    case 'Product':
      return Package
    case 'Company':
    case 'Company 360':
    case 'Company Contact':
    case 'CRM Contact':
      return Users
    case 'Warehouse':
      return Warehouse
    case 'UOM':
      return Database
    case 'Category':
      return Layers
    case 'Work Center':
      return Factory
    case 'Routing':
      return Settings
    case 'CRM Master':
    case 'Commercial Term':
      return Settings
    case 'Invoice':
      return Receipt
    case 'GRN':
      return FileCheck
    case 'QR':
      return QrCode
    case 'Serial':
      return Hash
    case 'ECO':
      return FileText
    default:
      return FileText
  }
}

export function GlobalSearch() {
  const open = useUIStore((s) => s.searchOpen)
  const setOpen = useUIStore((s) => s.setSearchOpen)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  if (!open) return null
  return <GlobalSearchPanel />
}

function GlobalSearchPanel() {
  const setOpen = useUIStore((s) => s.setSearchOpen)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [query, setQuery] = useState('')

  const salesOrders = useMrpStore((s) => s.salesOrders)
  const purchaseOrders = usePurchaseStore((s) => s.purchaseOrders)
  const workOrders = useWorkOrderStore((s) => s.workOrders)
  const jobCards = useWorkOrderStore((s) => s.jobCards)
  const subcontractShipments = useWorkOrderStore((s) => s.subcontractShipments)
  const uoms = useMasterStore((s) => s.uoms)
  const categories = useMasterStore((s) => s.categories)
  const items = useMasterStore((s) => s.items)
  const customers = useMasterStore((s) => s.customers)
  const vendors = useMasterStore((s) => s.vendors)
  const warehouses = useMasterStore((s) => s.warehouses)
  const locations = useMasterStore((s) => s.locations)
  const products = useMasterStore((s) => s.products)
  const customerContacts = useMasterStore((s) => s.customerContacts)
  const transporters = useMasterStore((s) => s.transporters)
  const hsnMasters = useMasterStore((s) => s.hsnMasters)
  const gstGroups = useMasterStore((s) => s.gstGroups)
  const gstRates = useMasterStore((s) => s.gstRates)
  const bomHeaders = useBomStore((s) => s.bomHeaders)
  const workCenters = useWorkCenterStore((s) => s.workCenters)
  const routingHeaders = useRoutingStore((s) => s.routingHeaders)
  const crmMasterEntries = useCrmMasterStore((s) => s.entries)
  const crmContacts = useCrmStore((s) => s.contacts)
  const invoices = useInvoiceStore((s) => s.invoices)
  const grns = usePurchaseStore((s) => s.grns)
  const qrRecords = useQrStore((s) => s.records)
  const serials = useSerialStore((s) => s.serials)
  const ecos = useEcoStore((s) => s.ecos)
  const codeSeries = useCodeSeriesStore((s) => s.series)

  const searchIndex = useMemo(
    () =>
      buildGlobalSearchIndex({
        masters: {
          uoms,
          categories,
          items,
          customers,
          vendors,
          warehouses,
          locations,
          products,
          customerContacts,
          transporters,
          hsnMasters,
          gstGroups,
          gstRates,
          bomHeaders,
          workCenters,
          routingHeaders,
          crmMasterEntries,
          crmContacts,
          codeSeries,
        },
        transactions: {
          salesOrders,
          purchaseOrders,
          workOrders,
          jobCards,
          subcontractShipments,
          invoices,
          grns,
          qrRecords,
          serials,
          ecos,
        },
      }, pathname),
    [
      uoms,
      categories,
      items,
      customers,
      vendors,
      warehouses,
      locations,
      products,
      customerContacts,
      transporters,
      hsnMasters,
      gstGroups,
      gstRates,
      bomHeaders,
      workCenters,
      routingHeaders,
      crmMasterEntries,
      crmContacts,
      salesOrders,
      purchaseOrders,
      workOrders,
      jobCards,
      subcontractShipments,
      invoices,
      grns,
      qrRecords,
      serials,
      ecos,
      codeSeries,
      pathname,
    ],
  )

  const results = useMemo(() => {
    return searchGlobalIndex(searchIndex, query, 20).map((hit) => ({
      ...hit,
      icon: iconForHit(hit),
    }))
  }, [searchIndex, query])

  const { results: apiCrmResults, loading: crmSearchLoading, error: crmSearchError, isApiBacked, minQueryLength } =
    useCrmGlobalSearch(query)

  const crmApiHits = useMemo(() => {
    if (!isApiBacked || !apiCrmResults || !canCrmPermission('crm.search.view')) return []
    const hits: Array<GlobalSearchHit & { icon: LucideIcon; groupLabel: string }> = []
    for (const c of apiCrmResults.companies) {
      hits.push({
        id: c.id,
        type: 'Company',
        group: 'master',
        groupLabel: 'Companies',
        label: c.name,
        sublabel: [c.companyCode, c.city, c.gstin].filter(Boolean).join(' · '),
        href: resolveCompany360Path(c.id, pathname),
        icon: Users,
      })
    }
    for (const c of apiCrmResults.contacts) {
      hits.push({
        id: c.id,
        type: 'CRM Contact',
        group: 'master',
        groupLabel: 'Contacts',
        label: `${c.firstName} ${c.lastName}`.trim(),
        sublabel: [c.contactCode, c.email, c.mobile].filter(Boolean).join(' · '),
        href: `/crm/contacts/${c.id}`,
        icon: Users,
      })
    }
    for (const l of apiCrmResults.leads) {
      hits.push({
        id: l.id,
        type: 'Lead',
        group: 'master',
        groupLabel: 'Leads',
        label: l.prospectName,
        sublabel: [l.leadCode, l.stage, l.email, l.mobile].filter(Boolean).join(' · '),
        href: `/crm/leads/${l.id}`,
        icon: Target,
      })
    }
    for (const o of apiCrmResults.opportunities) {
      hits.push({
        id: o.id,
        type: 'Opportunity',
        group: 'master',
        groupLabel: 'Opportunities',
        label: o.name,
        sublabel: [o.opportunityCode, o.status, String(o.amount)].filter(Boolean).join(' · '),
        href: `/crm/opportunities/${o.id}`,
        icon: Handshake,
      })
    }
    return hits
  }, [apiCrmResults, isApiBacked, pathname])

  const localNonCrmResults = useMemo(() => {
    if (!isApiBacked) return results
    const crmTypes = new Set(['Company', 'Company 360', 'CRM Contact', 'Lead', 'Opportunity'])
    return results.filter((r) => !crmTypes.has(r.type))
  }, [results, isApiBacked])

  const groupedCrmHits = useMemo(() => {
    const groups = new Map<string, typeof crmApiHits>()
    for (const hit of crmApiHits) {
      const list = groups.get(hit.groupLabel) ?? []
      list.push(hit)
      groups.set(hit.groupLabel, list)
    }
    return groups
  }, [crmApiHits])

  function go(href: string) {
    navigate(href)
    setOpen(false)
    setQuery('')
  }

  const pageResults = results.filter((r) => r.group === 'page')
  const recordResults = isApiBacked ? localNonCrmResults.filter((r) => r.group !== 'page') : results.filter((r) => r.group !== 'page')
  const showQuickActions = query.length < minQueryLength
  const showCrmApiResults = isApiBacked && query.trim().length >= minQueryLength && canCrmPermission('crm.search.view')
  const hasCrmApiHits = groupedCrmHits.size > 0
  const showNoMatches =
    query.trim().length >= minQueryLength &&
    !crmSearchLoading &&
    !crmSearchError &&
    !hasCrmApiHits &&
    pageResults.length === 0 &&
    recordResults.length === 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-erp-shell/40 px-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-xl overflow-hidden rounded-erp border border-erp-border bg-erp-surface shadow-erp-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-erp-border bg-gradient-to-r from-erp-surface-alt/80 to-erp-surface px-4 py-3">
          <Search className="h-5 w-5 text-erp-primary" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search masters, SO, WO, company, product, CRM, QR, serial, command…"
            className="flex-1 bg-transparent erp-type-body outline-none placeholder:text-erp-muted-subtle"
          />
          <kbd className="hidden rounded-md border border-erp-border bg-erp-surface px-1.5 py-0.5 text-[10px] font-medium text-erp-muted sm:inline">Esc</kbd>
          <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-erp-muted hover:bg-erp-surface-alt hover:text-erp-text">
            <X className="h-4 w-4" />
          </button>
        </div>
        <ul className="max-h-80 overflow-y-auto py-2">
          {showQuickActions && (
            <>
              <li className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Quick actions</li>
              {CRM_QUICK_ACTIONS.map((action) => (
                <li key={action.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-erp-primary-soft"
                    onClick={() => go(action.href)}
                  >
                    <action.icon className="h-4 w-4 shrink-0 text-erp-primary" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-[13px]">{action.label}</span>
                      <span className="ml-2 text-[11px] text-erp-muted">Action</span>
                      <p className="truncate text-[12px] text-erp-muted">{action.sublabel}</p>
                    </div>
                  </button>
                </li>
              ))}
              <li className="my-1 border-t border-erp-border" />
              <li className="px-4 pb-2 text-center text-[12px] text-erp-muted">Type 2+ characters to search · ⌘K anytime</li>
            </>
          )}
          {pageResults.length > 0 && (
            <>
              <li className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Pages</li>
              {pageResults.map((r) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-erp-primary-soft"
                    onClick={() => go(r.href)}
                  >
                    <r.icon className="h-4 w-4 shrink-0 text-erp-primary" />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-[13px]">{r.label}</span>
                      <span className="ml-2 text-[11px] text-erp-muted">{r.type}</span>
                      <p className="truncate text-[12px] text-erp-muted">{r.sublabel}</p>
                    </div>
                  </button>
                </li>
              ))}
            </>
          )}
          {showCrmApiResults && crmSearchLoading ? (
            <li className="px-4 py-6 text-center text-[13px] text-erp-muted">Searching CRM…</li>
          ) : null}
          {showCrmApiResults && crmSearchError ? (
            <li className="px-4 py-6 text-center text-[13px] text-red-600">{crmSearchError}</li>
          ) : null}
          {showCrmApiResults && !crmSearchLoading && !crmSearchError && hasCrmApiHits ? (
            <>
              {pageResults.length > 0 ? <li className="my-1 border-t border-erp-border" aria-hidden /> : null}
              {[...groupedCrmHits.entries()].flatMap(([groupLabel, hits]) => [
                <li key={`${groupLabel}-hdr`} className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-erp-muted">
                  {groupLabel}
                </li>,
                ...hits.map((r) => (
                  <li key={`crm-api-${r.type}-${r.id}`}>
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-erp-primary-soft"
                      onClick={() => go(r.href)}
                    >
                      <r.icon className="h-4 w-4 shrink-0 text-erp-primary" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[13px] font-semibold">{r.label}</span>
                        <span className="ml-2 text-[11px] text-erp-muted">{r.type}</span>
                        <p className="truncate text-[12px] text-erp-muted">{r.sublabel}</p>
                      </div>
                    </button>
                  </li>
                )),
              ])}
            </>
          ) : null}
          {recordResults.length > 0 && (
            <>
              {(pageResults.length > 0 || (showCrmApiResults && hasCrmApiHits)) && <li className="my-1 border-t border-erp-border" />}
              <li className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-erp-muted">Documents &amp; Masters</li>
              {recordResults.map((r) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-erp-primary-soft"
                    onClick={() => go(r.href)}
                  >
                    <r.icon className="h-4 w-4 shrink-0 text-erp-primary" />
                    <div className="min-w-0 flex-1">
                      <span className={cn('text-[13px] font-semibold', r.group === 'document' && 'font-mono')}>{r.label}</span>
                      <span className="ml-2 text-[11px] text-erp-muted">{r.type}</span>
                      <p className="truncate text-[12px] text-erp-muted">{r.sublabel}</p>
                    </div>
                  </button>
                </li>
              ))}
            </>
          )}
          {showNoMatches ? (
            <li className="px-4 py-6 text-center text-[13px] text-erp-muted">No matches for &quot;{query}&quot;</li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}

export function GlobalSearchTrigger({ className, variant = 'default' }: { className?: string; variant?: 'default' | 'suite' }) {
  const setOpen = useUIStore((s) => s.setSearchOpen)
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        variant === 'suite'
          ? 'd365-search-trigger flex h-8 w-full items-center gap-2 px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30'
          : 'flex h-9 w-full min-w-[200px] items-center gap-2 rounded-[4px] border border-erp-border bg-erp-surface-alt px-3 text-left transition-colors hover:border-erp-border-strong hover:bg-erp-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-erp-primary/25 lg:min-w-[280px]',
        className,
      )}
    >
      <Search className={cn('h-3.5 w-3.5 shrink-0', variant === 'suite' ? 'text-white/70' : 'h-4 w-4 text-erp-muted')} />
      <span className={cn('flex-1 truncate', variant === 'suite' ? 'text-[12px] text-white/85' : 'erp-type-caption')}>
        {variant === 'suite' ? 'Search masters, SO, WO, company, product, command…' : 'Search anything…'}
      </span>
      <kbd className={cn(
        'rounded border px-1.5 py-0.5 text-[10px] font-medium',
        variant === 'suite'
          ? 'hidden border-white/20 bg-white/10 text-white/70 xl:inline'
          : 'erp-type-micro hidden border-erp-border bg-erp-surface sm:inline',
      )}>⌘K</kbd>
    </button>
  )
}
