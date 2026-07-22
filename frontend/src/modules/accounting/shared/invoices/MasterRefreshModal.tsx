import { useEffect, useMemo, useState } from 'react'
import { ErpButton } from '@/components/erp/ErpButton'
import { isApiMode } from '@/config/apiConfig'
import {
  applySalesInvoiceRefreshFromMaster,
  previewSalesInvoiceRefreshFromMaster,
} from '@/services/api/receivablesApi'
import {
  applyVendorInvoiceRefreshFromMaster,
  previewVendorInvoiceRefreshFromMaster,
} from '@/services/api/payablesApi'
import { useMasterStore } from '@/store/masterStore'
import { notify } from '@/store/toastStore'
import { INVOICE_VARIANT_LABELS, type InvoiceShellVariant } from './invoiceVariant'
import type { PartySnapshotFields } from './PartyMasterCard'

interface DiffRow {
  label: string
  from: string
  to: string
}

/** Human labels for the snapshot fields returned by the refresh preview APIs. */
const FIELD_LABELS: Record<string, string> = {
  customerCodeSnapshot: 'Code',
  customerNameSnapshot: 'Name',
  customerGstinSnapshot: 'GSTIN',
  customerPanSnapshot: 'PAN',
  customerStateCodeSnapshot: 'State code',
  customerBillingAddressSnapshot: 'Billing address',
  customerShippingAddressSnapshot: 'Shipping address',
  paymentTermsDays: 'Payment terms (days)',
  vendorCodeSnapshot: 'Code',
  vendorNameSnapshot: 'Name',
  vendorGstinSnapshot: 'GSTIN',
  vendorPanSnapshot: 'PAN',
  vendorStateCodeSnapshot: 'State code',
  vendorAddressSnapshot: 'Address',
  paymentTermsDaysSnapshot: 'Payment terms (days)',
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'object') {
    const parts = Object.values(value as Record<string, unknown>)
      .filter((v) => v !== null && v !== undefined && v !== '')
      .map(String)
    return parts.length > 0 ? parts.join(', ') : '—'
  }
  return String(value)
}

/**
 * DRAFT-only "Refresh from Master" preview + apply.
 *
 * API mode: server-side preview + apply via
 * `…/accounting/receivables/invoices/:id/refresh-from-master[/preview]` and
 * `…/accounting/payables/vendor-invoices/:id/refresh-from-master[/preview]`.
 * Demo mode: client-side diff against the master store (snapshots recompute on
 * draft save). Failures surface a clear message — never a silent mock fallback.
 */
export function MasterRefreshModal({
  open,
  onClose,
  variant,
  documentId,
  partyId,
  snapshot,
  onApplied,
}: {
  open: boolean
  onClose: () => void
  variant: InvoiceShellVariant
  documentId: string
  partyId: string
  snapshot: PartySnapshotFields
  /** Called after a successful server-side apply so the parent can reload. */
  onApplied?: () => void
}) {
  const customers = useMasterStore((s) => s.customers)
  const vendors = useMasterStore((s) => s.vendors)
  const [applying, setApplying] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [serverRows, setServerRows] = useState<DiffRow[] | null>(null)
  const labels = INVOICE_VARIANT_LABELS[variant]
  const apiMode = isApiMode()

  // API mode: server-side preview (source of truth for the diff).
  useEffect(() => {
    if (!open || !apiMode) return
    let cancelled = false
    setPreviewLoading(true)
    setPreviewError(null)
    setServerRows(null)
    const load = async () => {
      try {
        const res =
          variant === 'crm'
            ? await previewSalesInvoiceRefreshFromMaster(documentId)
            : await previewVendorInvoiceRefreshFromMaster(documentId)
        if (cancelled) return
        const preview = res.data
        setServerRows(
          preview.changedFields.map((field) => ({
            label: FIELD_LABELS[field] ?? field,
            from: formatValue(preview.current[field]),
            to: formatValue(preview.proposed[field]),
          })),
        )
      } catch (e) {
        if (!cancelled) {
          setPreviewError(
            e instanceof Error
              ? e.message
              : 'Refresh preview is unavailable — the draft keeps its current snapshot.',
          )
        }
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, apiMode, variant, documentId])

  // Demo mode: client-side diff against the master store.
  const demoRows = useMemo<DiffRow[] | null>(() => {
    const live =
      variant === 'crm'
        ? (() => {
            const c = customers.find((x) => x.id === partyId)
            return c ? { name: c.customerName, code: c.customerCode, gstin: c.gstin || null, pan: c.pan ?? null } : null
          })()
        : (() => {
            const v = vendors.find((x) => x.id === partyId)
            return v ? { name: v.vendorName, code: v.vendorCode, gstin: v.gstin || null, pan: v.pan ?? null } : null
          })()
    if (!live) return null
    const fields: DiffRow[] = []
    const push = (label: string, from?: string | null, to?: string | null) => {
      if ((from || '—') !== (to || '—')) fields.push({ label, from: from || '—', to: to || '—' })
    }
    push('Name', snapshot.name, live.name)
    push('Code', snapshot.code, live.code)
    push('GSTIN', snapshot.gstin, live.gstin)
    push('PAN', snapshot.pan, live.pan)
    return fields
  }, [variant, partyId, customers, vendors, snapshot])

  if (!open) return null

  const rows = apiMode ? serverRows : demoRows
  const masterMissing = apiMode ? false : demoRows === null

  const apply = async () => {
    if (!apiMode) {
      notify.info('Demo mode — party snapshots recompute when you save the draft.')
      onClose()
      return
    }
    setApplying(true)
    try {
      if (variant === 'crm') {
        await applySalesInvoiceRefreshFromMaster(documentId)
      } else {
        await applyVendorInvoiceRefreshFromMaster(documentId)
      }
      notify.success('Party snapshot refreshed from master')
      onApplied?.()
      onClose()
    } catch (e) {
      notify.error(
        e instanceof Error
          ? e.message
          : 'Refresh from Master failed — the draft keeps its current snapshot. Re-saving the draft also refreshes party details.',
      )
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg rounded border border-erp-border bg-white p-4">
        <h3 className="text-[14px] font-semibold">Refresh {labels.party.toLowerCase()} from {labels.masterName}</h3>
        {previewLoading ? (
          <p className="mt-2 text-[12px] text-erp-muted">Loading refresh preview…</p>
        ) : previewError ? (
          <p className="mt-2 text-[12px] text-amber-800">{previewError}</p>
        ) : masterMissing ? (
          <p className="mt-2 text-[12px] text-amber-800">
            The linked master record is no longer available — this document keeps its historical snapshot.
          </p>
        ) : !rows || rows.length === 0 ? (
          <p className="mt-2 text-[12px] text-erp-muted">
            The document snapshot already matches the current master. Nothing to refresh.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[12px] text-erp-muted">
              The following fields will be updated on this draft from the current master record:
            </p>
            <table className="mt-2 w-full text-left text-[12px]">
              <thead>
                <tr className="border-b border-erp-border text-erp-muted">
                  <th className="py-1.5 pr-2">Field</th>
                  <th className="py-1.5 pr-2">Document snapshot</th>
                  <th className="py-1.5">Master value</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-b border-erp-border/60">
                    <td className="py-1.5 pr-2 font-medium">{r.label}</td>
                    <td className="py-1.5 pr-2 text-erp-muted">{r.from}</td>
                    <td className="py-1.5 text-emerald-700">{r.to}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        <p className="mt-2 text-[11px] text-erp-muted">
          Available on Draft documents only. Posted documents always render their posted snapshot.
        </p>
        <div className="mt-3 flex justify-end gap-2">
          <ErpButton variant="secondary" onClick={onClose} disabled={applying}>
            Close
          </ErpButton>
          {!previewLoading && !previewError && rows && rows.length > 0 && (
            <ErpButton variant="primary" onClick={() => void apply()} disabled={applying}>
              {applying ? 'Refreshing…' : 'Apply refresh'}
            </ErpButton>
          )}
        </div>
      </div>
    </div>
  )
}
