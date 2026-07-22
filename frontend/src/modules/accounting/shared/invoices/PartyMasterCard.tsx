import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ExternalLink, RefreshCw, UserPlus } from 'lucide-react'
import { useMasterStore } from '@/store/masterStore'
import { canQuickCreateEntity } from '@/utils/quickCreatePermissions'
import {
  INVOICE_VARIANT_LABELS,
  partyMasterCreateRoute,
  partyMasterRoute,
  type InvoiceShellVariant,
} from './invoiceVariant'

export interface PartySnapshotFields {
  name?: string | null
  code?: string | null
  gstin?: string | null
  pan?: string | null
  stateCode?: string | null
}

/**
 * Party (customer/vendor) card shared by SI/VI forms + detail pages.
 * Shows the live master record with drill-down; on documents it can also
 * surface the persisted snapshot and a DRAFT-only Refresh-from-Master action.
 * Falls back to "Historical party snapshot" when the master no longer exists.
 */
export function PartyMasterCard({
  variant,
  partyId,
  snapshot,
  onRefreshFromMaster,
  showQuickCreate,
}: {
  variant: InvoiceShellVariant
  partyId: string
  /** Snapshot persisted on the document (detail pages). */
  snapshot?: PartySnapshotFields
  /** Provided only when the document is editable (DRAFT) — renders the refresh action. */
  onRefreshFromMaster?: () => void
  /** Renders a permission-gated link to the full master create form. */
  showQuickCreate?: boolean
}) {
  const customers = useMasterStore((s) => s.customers)
  const vendors = useMasterStore((s) => s.vendors)
  const labels = INVOICE_VARIANT_LABELS[variant]

  const master = useMemo(() => {
    if (!partyId) return null
    if (variant === 'crm') {
      const c = customers.find((x) => x.id === partyId)
      if (!c) return null
      return {
        code: c.customerCode,
        name: c.customerName,
        gstin: c.gstin || null,
        pan: c.pan ?? null,
        location: [c.city, c.state].filter(Boolean).join(', ') || null,
        terms: c.creditDays ? `${c.creditDays} days credit` : null,
        isActive: c.isActive,
      }
    }
    const v = vendors.find((x) => x.id === partyId)
    if (!v) return null
    return {
      code: v.vendorCode,
      name: v.vendorName,
      gstin: v.gstin || null,
      pan: v.pan ?? null,
      location: [v.city, v.state].filter(Boolean).join(', ') || null,
      terms: v.paymentTermsDays != null ? `${v.paymentTermsDays} days payment terms` : null,
      isActive: v.isActive,
    }
  }, [variant, partyId, customers, vendors])

  const canCreate = canQuickCreateEntity(variant === 'crm' ? 'customer' : 'vendor')

  if (!partyId) {
    if (!showQuickCreate || !canCreate) return null
    return (
      <div className="mt-2 rounded border border-dashed border-erp-border bg-erp-surface-alt px-3 py-2 text-[12px] text-erp-muted">
        {labels.party} not found?{' '}
        <Link to={partyMasterCreateRoute(variant)} className="text-erp-accent hover:underline">
          <UserPlus className="mr-0.5 inline h-3 w-3" aria-hidden />
          Create {labels.masterName}
        </Link>{' '}
        and return here.
      </div>
    )
  }

  if (!master) {
    // Master missing / deactivated — posted documents keep rendering their snapshot.
    return (
      <div className="mt-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
        <p className="font-semibold">Historical {labels.party.toLowerCase()} snapshot</p>
        <p className="mt-0.5">
          {snapshot?.code ? `${snapshot.code} — ` : ''}
          {snapshot?.name ?? 'This party is no longer available in the master.'}
        </p>
        {snapshot?.gstin && <p className="mt-0.5">GSTIN: {snapshot.gstin}</p>}
      </div>
    )
  }

  return (
    <div className="mt-2 rounded border border-erp-border bg-erp-surface-alt px-3 py-2 text-[12px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-erp-text">
          {master.code} — {master.name}
          {!master.isActive && <span className="ml-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] text-rose-700">Inactive</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {onRefreshFromMaster && (
            <button
              type="button"
              className="inline-flex items-center gap-1 text-erp-accent hover:underline"
              onClick={onRefreshFromMaster}
            >
              <RefreshCw className="h-3 w-3" aria-hidden />
              Refresh from Master
            </button>
          )}
          <Link
            to={partyMasterRoute(variant, partyId)}
            className="inline-flex items-center gap-1 text-erp-accent hover:underline"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            Open {labels.masterName}
          </Link>
        </div>
      </div>
      <dl className="mt-1.5 grid gap-1 text-erp-muted sm:grid-cols-2 lg:grid-cols-4">
        <div>
          GSTIN: <span className="text-erp-text">{master.gstin ?? '—'}</span>
        </div>
        <div>
          PAN: <span className="text-erp-text">{master.pan ?? '—'}</span>
        </div>
        <div>
          Location: <span className="text-erp-text">{master.location ?? '—'}</span>
        </div>
        <div>
          Terms: <span className="text-erp-text">{master.terms ?? '—'}</span>
        </div>
      </dl>
      {snapshot?.name && snapshot.name !== master.name && (
        <p className="mt-1.5 text-[11px] text-amber-700">
          Document snapshot “{snapshot.name}” differs from the current master
          {onRefreshFromMaster ? ' — use Refresh from Master to update this draft.' : '.'}
        </p>
      )}
      {showQuickCreate && canCreate && (
        <p className="mt-1.5 text-[11px] text-erp-muted">
          Wrong {labels.party.toLowerCase()}?{' '}
          <Link to={partyMasterCreateRoute(variant)} className="text-erp-accent hover:underline">
            Create a new {labels.masterName}
          </Link>
        </p>
      )}
    </div>
  )
}
