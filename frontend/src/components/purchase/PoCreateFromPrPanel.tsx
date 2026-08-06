import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ClipboardList, Save, X } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import { ErpCardSection, ErpFieldRow } from '@/components/erp/card-form'
import { ErpSmartSelect } from '@/components/erp/ErpSmartSelect'
import { Input } from '@/components/forms/Inputs'
import { FormActionBar } from '@/components/erp/FormActionBar'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseDataTable,
  PurchaseTableToolbar,
  purchaseReadonlyValue,
} from '@/components/purchase/purchaseCardFormShared'
import { VendorLookupSelect } from '@/components/lookups/VendorLookupSelect'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  createPurchaseOrderFromPr,
  getPurchaseRequisitionById,
  getPurchaseRequisitions,
  getVendors,
  PurchaseServiceError,
} from '@/services/purchase'
import type { PurchaseRequisition, PurchaseRequisitionLine, Vendor } from '@/types/purchaseDomain'
import { formatNumber } from '@/utils/formatters/currency'
import { formatDate } from '@/utils/dates/format'
import { notify } from '@/store/toastStore'
import { purchaseUserMessage } from '@/utils/purchase/purchaseErrorMessages'

/** Remaining orderable qty on a PR line (supports partial PO conversion). */
export function prLineRemainingQty(line: PurchaseRequisitionLine): number {
  if (typeof line.remainingQuantity === 'number' && Number.isFinite(line.remainingQuantity)) {
    return Math.max(0, line.remainingQuantity)
  }
  const ordered = Number(line.orderedQuantity ?? 0)
  return Math.max(0, Number(line.quantity) - ordered)
}

export function isOpenPrLineForPo(line: PurchaseRequisitionLine): boolean {
  return prLineRemainingQty(line) > 0
}

type Props = {
  initialPrId?: string
  initialVendorId?: string
  onCancel?: () => void
}

/**
 * Create PO from approved PR with multi-select lines + optional partial qty.
 * Used by `/purchase/orders/new?mode=pr` (and `?prId=` deep links).
 */
export function PoCreateFromPrPanel({ initialPrId = '', initialVendorId = '', onCancel }: Props) {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [prRows, setPrRows] = useState<Array<{ id: string; documentNumber: string; status: string; rfqRequired?: boolean }>>([])
  const [prId, setPrId] = useState(initialPrId)
  const [pr, setPr] = useState<PurchaseRequisition | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorId, setVendorId] = useState(initialVendorId)
  /** Selected PR line ids */
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  /** Order qty override per PR line id */
  const [qtys, setQtys] = useState<Record<string, string>>({})

  const loadList = useCallback(async () => {
    setLoading(true)
    try {
      const [list, v] = await Promise.all([getPurchaseRequisitions(), getVendors()])
      setPrRows(
        list
          .filter(
            (r) =>
              r.status === 'approved' ||
              r.status === 'partially_converted' ||
              r.status === 'converted_to_rfq',
          )
          .map((r) => ({
            id: r.id,
            documentNumber: r.documentNumber,
            status: r.status,
            rfqRequired: r.rfqRequired,
          })),
      )
      setVendors(v.filter((x) => x.isActive))
    } catch (err) {
      notify.error(purchaseUserMessage(err, 'Could not load requisitions'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (!prId) {
      setPr(null)
      setSelected({})
      setQtys({})
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const full = await getPurchaseRequisitionById(prId)
        if (cancelled) return
        setPr(full)
        const open = (full?.lines ?? []).filter(isOpenPrLineForPo)
        const nextSel: Record<string, boolean> = {}
        const nextQty: Record<string, string> = {}
        for (const line of open) {
          // Pre-select all open lines when PR is first loaded / changed.
          nextSel[line.id] = true
          nextQty[line.id] = String(prLineRemainingQty(line))
        }
        setSelected(nextSel)
        setQtys(nextQty)
        const preferred =
          initialVendorId ||
          open.find((l) => l.preferredVendorId)?.preferredVendorId ||
          ''
        if (preferred) setVendorId(preferred)
      } catch (err) {
        if (!cancelled) {
          notify.error(purchaseUserMessage(err, 'Could not load purchase requisition'))
          setPr(null)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [prId, initialVendorId])

  const openLines = useMemo(
    () => (pr?.lines ?? []).filter(isOpenPrLineForPo),
    [pr],
  )

  const selectedLines = useMemo(
    () => openLines.filter((l) => selected[l.id]),
    [openLines, selected],
  )

  const prOptions = useMemo(
    () =>
      prRows
        .filter((r) => !r.rfqRequired)
        .map((r) => ({
          value: r.id,
          label: `${r.documentNumber} · ${r.status}`,
          searchText: r.documentNumber.toLowerCase(),
        })),
    [prRows],
  )

  const vendorRestrictIds = useMemo(() => {
    const ids = [
      ...new Set(
        selectedLines
          .map((l) => l.preferredVendorId)
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    return ids.length ? ids : undefined
  }, [selectedLines])

  const allSelected = openLines.length > 0 && openLines.every((l) => selected[l.id])
  const someSelected = selectedLines.length > 0

  const preferredFromSelectedLines = useMemo(
    () =>
      [
        ...new Set(
          selectedLines
            .map((l) => l.preferredVendorId?.trim())
            .filter((id): id is string => Boolean(id)),
        ),
      ],
    [selectedLines],
  )

  const resolvedVendorId =
    vendorId.trim() ||
    (preferredFromSelectedLines.length === 1 ? preferredFromSelectedLines[0]! : '')

  function toggleAll(checked: boolean) {
    const next: Record<string, boolean> = {}
    for (const l of openLines) next[l.id] = checked
    setSelected(next)
  }

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => ({ ...prev, [id]: checked }))
  }

  async function handleCreate() {
    if (!prId) {
      notify.error('Select an approved purchase requisition')
      return
    }
    if (!someSelected) {
      notify.error('Select at least one open PR line')
      return
    }
    if (pr?.rfqRequired) {
      notify.error('This requisition requires RFQ before PO. Create an RFQ instead.')
      return
    }

    const lineIds = selectedLines.map((l) => l.id)
    const orderQuantities: Record<string, number> = {}
    for (const line of selectedLines) {
      const rem = prLineRemainingQty(line)
      const raw = Number(qtys[line.id])
      const q = Number.isFinite(raw) && raw > 0 ? raw : rem
      if (q <= 0) {
        notify.error(`Invalid quantity on line ${line.lineNo}`)
        return
      }
      if (q > rem + 1e-9) {
        notify.error(`Quantity on line ${line.lineNo} exceeds remaining ${rem}`)
        return
      }
      orderQuantities[line.id] = q
    }

    // Prefer explicit pick, else single preferred vendor across selected lines.
    const preferredFromLines = preferredFromSelectedLines
    const effectiveVendorId = resolvedVendorId

    if (!effectiveVendorId) {
      notify.error(
        preferredFromLines.length > 1
          ? 'Selected lines have different preferred vendors — pick one vendor above'
          : 'Select a vendor for this purchase order',
      )
      return
    }

    setCreating(true)
    try {
      const created = await createPurchaseOrderFromPr(prId, effectiveVendorId, {
        lineIds,
        orderQuantities,
      })
      notify.success(`${created.documentNumber} created from PR`)
      navigate(`/purchase/orders/${created.id}/edit`, { replace: true })
    } catch (err) {
      notify.error(
        err instanceof PurchaseServiceError
          ? err.message
          : purchaseUserMessage(err, 'Could not create purchase order'),
      )
    } finally {
      setCreating(false)
    }
  }

  const goCancel = () => {
    if (onCancel) onCancel()
    else navigate('/purchase/orders')
  }

  if (loading) {
    return (
      <PurchaseCardFormShell
        title="New Purchase Order"
        description="From purchase requisition…"
        status="Open"
        favoritePath="/purchase/orders/new?mode=pr"
        breadcrumbs={[
          { label: 'Orders', to: '/purchase/orders' },
          { label: 'From PR' },
        ]}
        footer={null}
      >
        <LoadingState variant="form" rows={6} />
      </PurchaseCardFormShell>
    )
  }

  return (
    <PurchaseCardFormShell
      title="New Purchase Order"
      description="Select an approved PR and the lines to order now (partial conversion supported)."
      recordNo="New"
      recordTitle="From PR"
      status="Draft"
      statusTone="neutral"
      favoritePath="/purchase/orders/new?mode=pr"
      breadcrumbs={[
        { label: 'Orders', to: '/purchase/orders' },
        { label: 'From PR' },
      ]}
      stickyFooter
      footer={
        <FormActionBar
          sticky
          cancelFirst
          busy={creating}
          dirty={someSelected}
          saveLabel="Create PO"
          onCancel={goCancel}
          onSave={() => void handleCreate()}
          disabled={!prId || !someSelected || creating || !resolvedVendorId}
          disabledReason={
            !prId
              ? 'Select a purchase requisition'
              : !someSelected
                ? 'Select at least one line'
                : !resolvedVendorId
                  ? preferredFromSelectedLines.length > 1
                    ? 'Pick one vendor (lines have different preferred vendors)'
                    : 'Select a vendor'
                  : undefined
          }
        />
      }
    >
      <ErpCardSection
        title="PR selection"
        subtitle="Only approved, non-RFQ requisitions with open line quantity appear here."
        icon={ClipboardList}
        accent="blue"
        columns={2}
        defaultOpen
      >
        <ErpFieldRow label="Purchase requisition" required>
          <ErpSmartSelect
            options={prOptions}
            value={prId}
            onChange={(v) => {
              setPrId(v || '')
              setVendorId('')
            }}
            allowEmpty
            placeholder="— Select —"
            emptyMessage="No approved PRs available for direct PO"
          />
        </ErpFieldRow>
        <ErpFieldRow label="Vendor" required>
          <VendorLookupSelect
            value={vendorId}
            onChange={(sel) => setVendorId(sel?.vendorId ?? '')}
            allowEmpty
            restrictToIds={vendorRestrictIds}
            placeholder={prId ? 'Select vendor…' : 'Select PR first'}
            disabled={!prId}
          />
        </ErpFieldRow>
        {pr?.rfqRequired ? (
          <p className="col-span-2 text-sm text-amber-800">
            This PR requires the RFQ path.{' '}
            <Link to={`/purchase/rfqs/new?prId=${pr.id}`} className="font-medium text-erp-primary underline">
              Create RFQ
            </Link>
          </p>
        ) : null}
        {prId && openLines.length === 0 ? (
          <p className="col-span-2 text-sm text-erp-muted">
            No open quantity left on this PR. All lines may already be on a PO.
          </p>
        ) : null}
      </ErpCardSection>

      <ErpCardSection
        title="Lines to order"
        subtitle="Uncheck lines to leave for a later PO. Edit Order qty for partial quantities."
        icon={ClipboardList}
        accent="amber"
        defaultOpen
      >
        {pr && openLines.length > 0 ? (
          <div className="col-span-2">
            <PurchaseTableToolbar>
              <span>
                <strong>{pr.documentNumber}</strong>
                {' · '}
                {selectedLines.length} of {openLines.length} line(s) selected
              </span>
              <ErpButtonGroup>
                <ErpButton type="button" size="sm" variant="secondary" onClick={() => toggleAll(true)}>
                  Select all
                </ErpButton>
                <ErpButton type="button" size="sm" variant="ghost" onClick={() => toggleAll(false)}>
                  Clear
                </ErpButton>
              </ErpButtonGroup>
            </PurchaseTableToolbar>
            <PurchaseDataTable>
              <thead>
                <tr>
                  <th className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      aria-label="Select all open lines"
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th>#</th>
                  <th>Item</th>
                  <th>Description</th>
                  <th className="text-right">Req. qty</th>
                  <th className="text-right">Remaining</th>
                  <th className="text-right">Order qty</th>
                  <th>UOM</th>
                  <th>Required</th>
                  <th>Preferred vendor</th>
                </tr>
              </thead>
              <tbody>
                {openLines.map((line) => {
                  const rem = prLineRemainingQty(line)
                  const checked = Boolean(selected[line.id])
                  return (
                    <tr key={line.id} className={checked ? undefined : 'opacity-60'}>
                      <td>
                        <input
                          type="checkbox"
                          checked={checked}
                          aria-label={`Select line ${line.lineNo}`}
                          onChange={(e) => toggleOne(line.id, e.target.checked)}
                        />
                      </td>
                      <td className="tabular-nums">{line.lineNo}</td>
                      <td className="font-mono text-[12px]">{line.itemCode || '—'}</td>
                      <td>{line.itemName || '—'}</td>
                      <td className="text-right tabular-nums">{formatNumber(line.quantity)}</td>
                      <td className="text-right tabular-nums">{formatNumber(rem)}</td>
                      <td className="text-right">
                        <Input
                          type="number"
                          step="0.001"
                          min={0}
                          max={rem}
                          disabled={!checked}
                          className="w-24 text-right"
                          value={qtys[line.id] ?? ''}
                          onChange={(e) =>
                            setQtys((prev) => ({ ...prev, [line.id]: e.target.value }))
                          }
                          aria-label={`Order quantity line ${line.lineNo}`}
                        />
                      </td>
                      <td>{line.uom || '—'}</td>
                      <td>{line.requiredDate ? formatDate(line.requiredDate) : '—'}</td>
                      <td className="text-[12px]">
                        {line.preferredVendorName ||
                          vendors.find((v) => v.id === line.preferredVendorId)?.vendorName ||
                          '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </PurchaseDataTable>
          </div>
        ) : (
          <p className="col-span-2 text-sm text-erp-muted">
            {prId
              ? purchaseReadonlyValue('No open lines')
              : 'Select a purchase requisition to choose lines.'}
          </p>
        )}
      </ErpCardSection>

      <div className="flex flex-wrap justify-end gap-2">
        <ErpButton type="button" variant="ghost" icon={X} onClick={goCancel} disabled={creating}>
          Cancel
        </ErpButton>
        <ErpButton
          type="button"
          variant="primary"
          icon={Save}
          disabled={!prId || !someSelected || creating || Boolean(pr?.rfqRequired) || !resolvedVendorId}
          onClick={() => void handleCreate()}
        >
          {creating ? 'Creating…' : 'Create PO'}
        </ErpButton>
      </div>
    </PurchaseCardFormShell>
  )
}
