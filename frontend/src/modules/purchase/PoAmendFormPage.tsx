import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ClipboardList, History, Package, Save, X } from 'lucide-react'
import {
  ErpCardSection,
  ErpFieldRow,
  ErpStickySaveBar,
  type ErpCardFormStatusItem,
} from '../../components/erp/card-form'
import { ErpCardCommandBar } from '../../components/erp/card-form/ErpCardCommandBar'
import { ErpButton, ErpButtonGroup } from '../../components/erp/ErpButton'
import { Input, Textarea } from '../../components/forms/Inputs'
import { Toast } from '../../components/ui/Toast'
import { usePurchaseStore } from '../../store/purchaseStore'
import { useMasterStore } from '../../store/masterStore'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { poIsAmendable, type PurchaseOrderLine } from '../../types/purchase'
import { PurchaseCardFormShell } from '@/components/purchase/PurchaseCardFormShell'
import {
  PurchaseDataTable,
  PurchaseTableToolbar,
  purchaseStatusTone,
} from '@/components/purchase/purchaseCardFormShared'
import {
  PurchaseEnterpriseFactBox,
  PurchaseFormSectionNav,
  purchaseSectionId,
  purchaseStatusStripToDocumentStrip,
} from '@/components/purchase/PurchaseEnterpriseFormKit'

interface AmendLineRow {
  id: string
  itemCode: string
  itemName: string
  warehouseCode: string
  receivedQty: number
  qty: string
  rate: string
  requiredDate: string
}

export function PoAmendFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const po = usePurchaseStore((s) => (id ? s.getPo(id) : undefined))
  const amendPo = usePurchaseStore((s) => s.amendPo)
  const getItem = useMasterStore((s) => s.getItem)
  const getWarehouse = useMasterStore((s) => s.getWarehouse)
  const getVendor = useMasterStore((s) => s.getVendor)

  const [activeSection, setActiveSection] = useState('lines')
  const [reason, setReason] = useState('')
  const [lines, setLines] = useState<AmendLineRow[]>(() => {
    if (!po) return []
    return po.lines.map((l) => ({
      id: l.id,
      itemCode: getItem(l.itemId)?.itemCode ?? l.itemId,
      itemName: getItem(l.itemId)?.itemName ?? '',
      warehouseCode: getWarehouse(l.warehouseId)?.warehouseCode ?? l.warehouseId,
      receivedQty: l.receivedQty,
      qty: String(l.qty),
      rate: String(l.rate),
      requiredDate: l.requiredDate,
    }))
  })
  const [toast, setToast] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!po) {
    return (
      <div className="erp-page p-12 text-center text-erp-muted">
        PO not found. <Link to="/purchase/orders">Back to orders</Link>
      </div>
    )
  }

  if (!poIsAmendable(po)) {
    return (
      <div className="erp-page p-12 text-center text-erp-muted">
        This PO cannot be amended.
        <div className="mt-2">
          <Link to={`/purchase/orders/${po.id}`}>Back to {po.poNo}</Link>
        </div>
      </div>
    )
  }

  const nextRev = po.revisionNo + 1
  const vendor = getVendor(po.vendorId)
  const newValue = lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0)

  function updateLine(lineId: string, patch: Partial<Pick<AmendLineRow, 'qty' | 'rate' | 'requiredDate'>>) {
    setLines((prev) => prev.map((row) => (row.id === lineId ? { ...row, ...patch } : row)))
  }

  function persist() {
    if (!reason.trim()) {
      setToast('Amendment reason is required')
      return
    }
    setSubmitting(true)
    const amendedLines: PurchaseOrderLine[] = po!.lines.map((existing) => {
      const row = lines.find((l) => l.id === existing.id)!
      return {
        ...existing,
        qty: Number(row.qty) || 0,
        rate: Number(row.rate) || 0,
        requiredDate: row.requiredDate,
      }
    })
    const result = amendPo(po!.id, amendedLines, reason)
    setSubmitting(false)
    if (result.ok) navigate(`/purchase/orders/${po!.id}`)
    else setToast(result.error ?? 'Amendment failed')
  }

  const statusStrip: ErpCardFormStatusItem[] = [
    { label: 'PO No', value: po.poNo, tone: 'neutral' },
    { label: 'Vendor', value: vendor?.vendorName ?? '—', tone: 'neutral' },
    { label: 'Current Rev', value: String(po.revisionNo), tone: 'info' },
    { label: 'New Rev', value: String(nextRev), tone: 'warning' },
    { label: 'Lines', value: String(lines.length), tone: 'neutral' },
    { label: 'New Value', value: formatCurrency(newValue), tone: 'success' },
  ]

  const commandBar = (
    <ErpCardCommandBar
      inline
      homeActions={[
        { id: 'save', label: `Save Rev ${nextRev}`, icon: Save, onClick: persist, primary: true, disabled: submitting },
        { id: 'cancel', label: 'Cancel', icon: X, onClick: () => navigate(`/purchase/orders/${po.id}`) },
      ]}
    />
  )

  const footer = (
    <ErpStickySaveBar
      sticky={false}
      hint="Ctrl+S Save · Esc Cancel"
      actions={(
        <ErpButtonGroup>
          <ErpButton type="button" variant="ghost" icon={ArrowLeft} onClick={() => navigate(`/purchase/orders/${po.id}`)}>
            Cancel
          </ErpButton>
          <ErpButton type="button" variant="primary" icon={Save} onClick={persist} disabled={submitting}>
            Save as Rev {nextRev}
          </ErpButton>
        </ErpButtonGroup>
      )}
    />
  )

  const factBox = (
    <PurchaseEnterpriseFactBox
      title="Amendment insight"
      metrics={[
        { label: 'From Rev', value: String(po.revisionNo), accent: 'violet' },
        { label: 'To Rev', value: String(nextRev), accent: 'amber', highlight: true },
        { label: 'New Value', value: formatCurrency(newValue), accent: 'green' },
        { label: 'Prior Revs', value: String(po.revisions.length), accent: 'blue' },
      ]}
      summary={[
        { label: 'PO', value: po.poNo },
        { label: 'Vendor', value: vendor?.vendorName ?? '—' },
        { label: 'Current Rev', value: po.revisionNo },
        { label: 'New Rev', value: nextRev, highlight: true },
        { label: 'Lines', value: lines.length },
        { label: 'New Value', value: formatCurrency(newValue), highlight: true },
      ]}
      actions={[
        { id: 'save', label: `Save Rev ${nextRev}`, icon: Save, primary: true, onClick: persist, disabled: submitting },
      ]}
    >
      <p className="text-xs text-erp-muted leading-relaxed px-1 pt-2">
        Adjust qty and rate only. Received qty is the minimum order qty per line. Reason is required for audit.
      </p>
    </PurchaseEnterpriseFactBox>
  )

  const sectionNav = (
    <PurchaseFormSectionNav
      sections={[
        { id: 'reason', label: 'Amendment', icon: ClipboardList, done: Boolean(reason.trim()) },
        { id: 'lines', label: 'Lines', icon: Package, done: lines.length > 0 },
        { id: 'history', label: 'History', icon: History },
      ]}
      activeId={activeSection}
      onSelect={setActiveSection}
    />
  )

  const tabContent: Record<string, ReactNode> = {
    reason: (
      <ErpCardSection title="Amendment reason" subtitle="Required for audit trail" accent="amber" icon={ClipboardList}>
        <ErpFieldRow label="Reason" colSpan={2} horizontal={false}>
          <Textarea
            className="erp-input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            placeholder="Qty reduction, rate negotiation, delivery reschedule…"
            required
          />
        </ErpFieldRow>
      </ErpCardSection>
    ),
    lines: (
      <ErpCardSection title="Line amendments" subtitle="Adjust quantities, rates, and required dates" accent="blue" icon={Package} className="col-span-2">
        <div className="col-span-2">
          <PurchaseTableToolbar>
            <span>
              <strong className="text-erp-text">{lines.length}</strong> lines · New value{' '}
              <strong className="text-erp-text">{formatCurrency(newValue)}</strong>
            </span>
          </PurchaseTableToolbar>
          <PurchaseDataTable>
            <thead>
              <tr>
                <th>Item</th>
                <th>Warehouse</th>
                <th className="num">Received</th>
                <th className="num">New Qty</th>
                <th className="num">New Rate</th>
                <th>Required</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const orig = po.lines.find((l) => l.id === line.id)!
                const qtyChanged = Number(line.qty) !== orig.qty
                const rateChanged = Number(line.rate) !== orig.rate
                return (
                  <tr key={line.id}>
                    <td>
                      <span className="font-mono font-semibold">{line.itemCode}</span>
                      <span className="ml-1 text-erp-muted">{line.itemName}</span>
                    </td>
                    <td>{line.warehouseCode}</td>
                    <td className="num">{formatNumber(line.receivedQty)}</td>
                    <td>
                      <Input
                        type="number"
                        min={line.receivedQty || 0.001}
                        className="erp-input text-right"
                        value={line.qty}
                        onChange={(e) => updateLine(line.id, { qty: e.target.value })}
                      />
                      {qtyChanged ? <div className="text-[10px] text-erp-muted">was {formatNumber(orig.qty)}</div> : null}
                    </td>
                    <td>
                      <Input
                        type="number"
                        min={0}
                        className="erp-input text-right"
                        value={line.rate}
                        onChange={(e) => updateLine(line.id, { rate: e.target.value })}
                      />
                      {rateChanged ? <div className="text-[10px] text-erp-muted">was {formatCurrency(orig.rate)}</div> : null}
                    </td>
                    <td>
                      <Input type="date" className="erp-input" value={line.requiredDate} onChange={(e) => updateLine(line.id, { requiredDate: e.target.value })} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </PurchaseDataTable>
        </div>
      </ErpCardSection>
    ),
    history: (
      <ErpCardSection title="Revision history" subtitle="Prior amendments on this PO" accent="slate" icon={History} className="col-span-2">
        <div className="col-span-2">
          <PurchaseDataTable>
            <thead>
              <tr>
                <th>Revision</th>
                <th>Amended By</th>
                <th>Date</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {po.revisions.map((rev) => (
                <tr key={rev.revisionNo}>
                  <td>Rev {rev.revisionNo}</td>
                  <td>{rev.amendedByName}</td>
                  <td>{formatDate(rev.amendedAt)}</td>
                  <td>{rev.reason}</td>
                </tr>
              ))}
              {po.revisions.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-4 text-center text-erp-muted">
                    No prior revisions
                  </td>
                </tr>
              )}
            </tbody>
          </PurchaseDataTable>
        </div>
      </ErpCardSection>
    ),
  }

  return (
    <>
      <Toast message={toast} />
      <PurchaseCardFormShell
        title="Amend Purchase Order"
        description={`Create revision ${nextRev} — adjust lines and record amendment reason`}
        recordNo={`${po.poNo} · Rev ${po.revisionNo} → ${nextRev}`}
        status={po.status}
        statusTone={purchaseStatusTone(po.status)}
        owner={po.createdByName}
        createdDate={formatDate(po.createdAt)}
        createdBy={po.createdByName}
        modifiedDate={po.modifiedAt ? formatDate(po.modifiedAt) : undefined}
        modifiedBy={po.modifiedByName ?? undefined}
        favoritePath={`/purchase/orders/${po.id}/amend`}
        breadcrumbs={[
          { label: 'Orders', to: '/purchase/orders' },
          { label: po.poNo, to: `/purchase/orders/${po.id}` },
          { label: 'Amend' },
        ]}
        commandBar={commandBar}
        documentStrip={purchaseStatusStripToDocumentStrip(statusStrip)}
        onSubmit={(e) => { e.preventDefault(); persist() }}
        onSaveShortcut={persist}
        factBox={factBox}
        footer={footer}
        collapsibleFactBox
        stickyFooter={false}
      >
        {sectionNav}
        <div id={purchaseSectionId('reason')}>{tabContent.reason}</div>
        <div id={purchaseSectionId('lines')}>{tabContent.lines}</div>
        <div id={purchaseSectionId('history')}>{tabContent.history}</div>
      </PurchaseCardFormShell>
    </>
  )
}
