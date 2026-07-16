import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DetailLayout, DetailSection, DetailGrid, DetailField } from '../../../components/masters/MasterLayouts'
import { ActiveBadge, TypeBadge } from '../../../components/ui/StatusBadge'
import { Button } from '../../../components/ui/Button'
import { Input, Select } from '../../../components/forms/Inputs'
import { Toast } from '../../../components/ui/Toast'
import { useMasterStore } from '../../../store/masterStore'
import { useProductMasterStore } from '../../../store/productMasterStore'
import { useInventoryStore } from '../../../store/inventoryStore'
import { useBomStore } from '../../../store/bomStore'
import { useRoutingStore } from '../../../store/routingStore'
import { useWorkCenterStore } from '../../../store/workCenterStore'
import { getReleasedRoutingForProduct } from '../../../utils/routing'
import { formatCurrency, formatNumber } from '../../../utils/formatters/currency'
import { formatDate } from '../../../utils/dates/format'
import { productStatusColor } from '../../../utils/productMaster'
import {
  ATTACHMENT_CATEGORY_LABELS,
  PRODUCT_FAMILY_LABELS,
  PRODUCT_STATUS_FLOW,
  PRODUCT_STATUS_LABELS,
  type ProductAttachmentCategory,
} from '../../../types/productMaster'
import { useProductBomHeaders } from '../../../hooks/useStableStoreData'
import { ApprovalChainPanel } from '../../../components/approval/ApprovalChainPanel'
import { cn } from '../../../utils/cn'

const TABS = ['overview', 'revisions', 'bom', 'routing', 'costing', 'quality', 'documents', 'history'] as const
type Tab = (typeof TABS)[number]

const TAB_LABELS: Record<Tab, string> = {
  overview: 'Overview',
  revisions: 'Revisions',
  bom: 'BOM',
  routing: 'Routing',
  costing: 'Costing',
  quality: 'Quality',
  documents: 'Documents',
  history: 'History',
}

export function ProductDetailPage() {
  const { id } = useParams()
  const product = useMasterStore((s) => (id ? s.getProduct(id) : undefined))
  const getUomName = useMasterStore((s) => s.getUomName)
  const fgItem = useMasterStore((s) => (product ? s.getItem(product.fgItemId) : undefined))
  const advanceStatus = useProductMasterStore((s) => s.advanceProductStatus)
  const releaseProduct = useProductMasterStore((s) => s.releaseProduct)
  const createRevision = useProductMasterStore((s) => s.createProductRevision)
  const deriveCosts = useProductMasterStore((s) => s.deriveProductCosts)
  const approveOverride = useProductMasterStore((s) => s.approveCostOverride)
  const addAttachment = useProductMasterStore((s) => s.addProductAttachment)
  const syncLinks = useProductMasterStore((s) => s.syncManufacturingLinks)
  const validateRelease = useProductMasterStore((s) => s.validateProductRelease)

  const releasedBom = useBomStore((s) => (id ? s.getReleasedBomForProduct(id!) : undefined))
  const allBoms = useProductBomHeaders(id)
  const routingHeaders = useRoutingStore((s) => s.routingHeaders)
  const workCenters = useWorkCenterStore((s) => s.workCenters)
  const getOnHand = useInventoryStore((s) => s.getOnHand)

  const [tab, setTab] = useState<Tab>('overview')
  const [toast, setToast] = useState<string | null>(null)
  const [revNo, setRevNo] = useState('')
  const [revReason, setRevReason] = useState('')
  const [attachName, setAttachName] = useState('')
  const [attachCategory, setAttachCategory] = useState<ProductAttachmentCategory>('drawing')

  const releasedRouting = useMemo(
    () => (id ? getReleasedRoutingForProduct(routingHeaders, id) : undefined),
    [routingHeaders, id],
  )
  const productRoutings = useMemo(() => routingHeaders.filter((r) => r.productId === id), [routingHeaders, id])

  if (!product || !id) return <p className="text-slate-500">Product not found.</p>

  const nextStatuses = PRODUCT_STATUS_FLOW[product.status] ?? []
  const releaseCheck = validateRelease(id)
  const fgOnHand = fgItem ? getOnHand(fgItem.id, 'wh-fg-yard') : 0

  function act(label: string, r: { ok: boolean; error?: string }) {
    setToast(r.ok ? label : r.error ?? 'Failed')
  }

  return (
    <DetailLayout
      backTo="/masters/products"
      backLabel="Back to Products"
      title={product.productName}
      subtitle={`${product.productCode} · ${product.productRevision}`}
      editTo={`/masters/products/${product.id}/edit`}
      badges={
        <>
          <TypeBadge value={product.productFamily} color="green" />
          <TypeBadge value={product.status} color={productStatusColor(product.status)} />
          <ActiveBadge isActive={product.isActive} />
        </>
      }
    >
      <div className="mb-4 flex flex-wrap gap-1 border-b border-erp-border pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              'rounded-sm px-3 py-1.5 text-[13px] font-medium transition-colors',
              tab === t ? 'bg-erp-primary text-white' : 'text-erp-muted hover:bg-erp-surface-alt',
            )}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <DetailSection title="Product Identity">
            <DetailGrid>
              <DetailField label="Code" value={<span className="font-mono">{product.productCode}</span>} />
              <DetailField label="Family" value={PRODUCT_FAMILY_LABELS[product.productFamily]} />
              <DetailField label="Type" value={<TypeBadge value={product.productType} color="green" />} />
              <DetailField label="Capacity" value={product.capacity} />
              <DetailField label="UOM" value={getUomName(product.baseUomId)} />
              <DetailField label="FG Item" value={fgItem ? <Link to={`/masters/items/${fgItem.id}`} className="font-mono text-erp-primary hover:underline">{fgItem.itemCode}</Link> : '—'} />
              <DetailField label="FG On Hand" value={formatNumber(fgOnHand)} />
              <DetailField label="Lifecycle Status" value={<TypeBadge value={product.status} color={productStatusColor(product.status)} />} />
            </DetailGrid>
          </DetailSection>
          <DetailSection title="Engineering Control">
            <DetailGrid>
              <DetailField label="Product Rev" value={<span className="font-mono">{product.productRevision}</span>} />
              <DetailField label="Drawing Rev" value={product.drawingRevision} />
              <DetailField label="BOM Rev" value={product.bomRevision} />
              <DetailField label="Routing Rev" value={product.routingRevision} />
              <DetailField label="Engineering Owner" value={product.engineeringOwner} />
              <DetailField label="Effective From" value={formatDate(product.effectiveFrom)} />
              <DetailField label="Effective To" value={product.effectiveTo ? formatDate(product.effectiveTo) : '—'} />
              <DetailField label="Revision Reason" value={product.revisionReason} />
            </DetailGrid>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-erp-border pt-4">
              {nextStatuses.map((st) => (
                <Button key={st} size="sm" onClick={() => act(`Moved to ${PRODUCT_STATUS_LABELS[st]}`, advanceStatus(id, st))}>
                  → {PRODUCT_STATUS_LABELS[st]}
                </Button>
              ))}
              {product.status === 'approved' && (
                <Button size="sm" variant="primary" disabled={!releaseCheck.ok} title={releaseCheck.error} onClick={() => act('Product released', releaseProduct(id))}>
                  Release to Manufacturing
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => act('Links synced', syncLinks(id))}>Sync BOM/Routing</Button>
            </div>
            {!releaseCheck.ok && product.status === 'approved' && (
              <p className="mt-2 text-xs text-erp-warning">{releaseCheck.error}</p>
            )}
          </DetailSection>
          <DetailSection title="Sales Control">
            <DetailGrid>
              <DetailField label="Sales Category" value={product.sales.salesCategory} />
              <DetailField label="Warranty" value={`${product.sales.defaultWarrantyMonths} months`} />
              <DetailField label="Tax Category" value={product.sales.taxCategory} />
              <DetailField label="List Price" value={formatCurrency(product.standardPrice)} />
            </DetailGrid>
          </DetailSection>
          <DetailSection title="Specifications">
            <p className="text-sm text-erp-text">{product.specifications || '—'}</p>
          </DetailSection>
        </>
      )}

      {tab === 'revisions' && (
        <DetailSection title="Revision History">
          <table className="erp-table mb-4 w-full">
            <thead><tr><th>Rev</th><th>Drawing</th><th>BOM</th><th>Routing</th><th>From</th><th>To</th><th>Owner</th><th>Locked</th></tr></thead>
            <tbody>
              <tr className="font-medium">
                <td>{product.productRevision} (current)</td>
                <td>{product.drawingRevision}</td>
                <td>{product.bomRevision}</td>
                <td>{product.routingRevision}</td>
                <td>{formatDate(product.effectiveFrom)}</td>
                <td>—</td>
                <td>{product.engineeringOwner}</td>
                <td>{product.status === 'obsolete' ? 'Yes' : 'No'}</td>
              </tr>
              {product.revisions.map((r) => (
                <tr key={r.id} className={r.locked ? 'text-erp-muted' : ''}>
                  <td>{r.revisionNo}</td>
                  <td>{r.drawingRevision}</td>
                  <td>{r.bomRevision}</td>
                  <td>{r.routingRevision}</td>
                  <td>{formatDate(r.effectiveFrom)}</td>
                  <td>{r.effectiveTo ? formatDate(r.effectiveTo) : '—'}</td>
                  <td>{r.engineeringOwner}</td>
                  <td>{r.locked ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {product.status !== 'obsolete' && (
            <div className="flex flex-wrap items-end gap-2 border-t border-erp-border pt-4">
              <label className="text-sm">New Rev<input className="erp-input mt-1 block w-28" value={revNo} onChange={(e) => setRevNo(e.target.value)} placeholder="Rev-4" /></label>
              <label className="text-sm">Reason<input className="erp-input mt-1 block w-64" value={revReason} onChange={(e) => setRevReason(e.target.value)} /></label>
              <Button size="sm" onClick={() => act('Revision created', createRevision(id, { revisionNo: revNo, revisionReason: revReason || 'Engineering change' }))}>Create Revision</Button>
            </div>
          )}
        </DetailSection>
      )}

      {tab === 'bom' && (
        <DetailSection title="Bill of Materials">
          <DetailField label="Released BOM" value={
            releasedBom ? <Link to={`/masters/bom/${releasedBom.id}`} className="font-mono text-erp-primary hover:underline">{releasedBom.bomNo} · {releasedBom.revision}</Link> : <span className="text-erp-warning">None — release blocked</span>
          } />
          <table className="erp-table mt-4 w-full">
            <thead><tr><th>BOM No</th><th>Revision</th><th>Status</th><th>Effective</th></tr></thead>
            <tbody>
              {allBoms.map((b) => (
                <tr key={b.id}><td><Link to={`/masters/bom/${b.id}`} className="text-erp-primary hover:underline">{b.bomNo}</Link></td><td>{b.revision}</td><td>{b.status}</td><td>{formatDate(b.effectiveFrom)}</td></tr>
              ))}
            </tbody>
          </table>
        </DetailSection>
      )}

      {tab === 'routing' && (
        <DetailSection title="Routing">
          <DetailGrid>
            <DetailField label="Released Routing" value={
              releasedRouting ? <Link to={`/masters/routing/${releasedRouting.id}`} className="font-mono text-erp-primary hover:underline">{releasedRouting.routingNo} · {releasedRouting.revision}</Link> : <span className="text-erp-warning">None — production blocked</span>
            } />
            <DetailField label="Std Labor Hours" value={product.manufacturing.standardLaborHours} />
            <DetailField label="Std Production Days" value={product.manufacturing.standardProductionDays} />
            <DetailField label="Lead Time" value={`${product.standardLeadDays} days`} />
            <DetailField label="Default Work Centers" value={
              product.manufacturing.defaultWorkCenterIds.length
                ? product.manufacturing.defaultWorkCenterIds.map((wcId) => workCenters.find((w) => w.id === wcId)?.workCenterCode ?? wcId).join(', ')
                : '—'
            } />
          </DetailGrid>
          <table className="erp-table mt-4 w-full">
            <thead><tr><th>Routing</th><th>Rev</th><th>Status</th><th>Hours</th></tr></thead>
            <tbody>
              {productRoutings.map((r) => (
                <tr key={r.id}><td><Link to={`/masters/routing/${r.id}`} className="text-erp-primary hover:underline">{r.routingNo}</Link></td><td>{r.revision}</td><td>{r.status}</td><td>{r.totalStdHours}</td></tr>
              ))}
            </tbody>
          </table>
        </DetailSection>
      )}

      {tab === 'costing' && (
        <DetailSection title="Standard Cost">
          <DetailGrid>
            <DetailField label="Material" value={formatCurrency(product.standardCost.materialCost)} />
            <DetailField label="Labor" value={formatCurrency(product.standardCost.laborCost)} />
            <DetailField label="Machine" value={formatCurrency(product.standardCost.machineCost)} />
            <DetailField label="Overhead" value={formatCurrency(product.standardCost.overheadCost)} />
            <DetailField label="Total Standard Cost" value={<span className="font-semibold">{formatCurrency(product.standardCost.totalCost)}</span>} />
            <DetailField label="List Price" value={formatCurrency(product.standardPrice)} />
            <DetailField label="Override" value={product.standardCost.costOverride ? 'Yes (pending approval)' : 'No'} />
            <DetailField label="Derived At" value={product.standardCost.derivedAt ? formatDate(product.standardCost.derivedAt.slice(0, 10)) : '—'} />
          </DetailGrid>
          <div className="mt-4 flex gap-2 border-t border-erp-border pt-4">
            <Button size="sm" onClick={() => act('Costs derived', deriveCosts(id))}>Derive from BOM + Routing</Button>
            {product.standardCost.costOverride && !product.standardCost.overrideApprovedBy && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  const r = approveOverride(id) as { ok: boolean; error?: string; pendingNextApprover?: string }
                  if (!r.ok) act(r.error ?? 'Failed', r)
                  else if (r.pendingNextApprover) act(`Step approved — pending ${r.pendingNextApprover}`, r)
                  else act('Override approved', r)
                }}
              >
                Approve Override
              </Button>
            )}
          </div>
          {product.standardCost.costOverride && !product.standardCost.overrideApprovedBy && id && (
            <div className="mt-4">
              <ApprovalChainPanel documentType="cost_override" entityId={id} />
            </div>
          )}
        </DetailSection>
      )}

      {tab === 'quality' && (
        <DetailSection title="Quality Control">
          <DetailGrid>
            <DetailField label="QC Plan" value={product.quality.qcPlanName || '—'} />
            <DetailField label="Final Inspection Plan" value={product.quality.finalInspectionPlanName || '—'} />
            <DetailField label="Test Certificate Template" value={product.quality.testCertificateTemplate} />
            <DetailField label="Customer Approval Required" value={product.quality.customerApprovalRequired ? 'Yes' : 'No'} />
          </DetailGrid>
        </DetailSection>
      )}

      {tab === 'documents' && (
        <DetailSection title="Attachments">
          <table className="erp-table mb-4 w-full">
            <thead><tr><th>Name</th><th>Category</th><th>Uploaded</th><th>By</th></tr></thead>
            <tbody>
              {product.attachments.map((a) => (
                <tr key={a.id}><td>{a.name}</td><td>{ATTACHMENT_CATEGORY_LABELS[a.category]}</td><td>{formatDate(a.uploadedAt.slice(0, 10))}</td><td>{a.uploadedByName}</td></tr>
              ))}
              {product.attachments.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-erp-muted">No documents attached</td></tr>}
            </tbody>
          </table>
          <div className="flex flex-wrap items-end gap-2">
            <Input className="w-48" placeholder="filename.pdf" value={attachName} onChange={(e) => setAttachName(e.target.value)} />
            <Select wrapClassName="w-44" value={attachCategory} onChange={(e) => setAttachCategory(e.target.value as ProductAttachmentCategory)}>
              {Object.entries(ATTACHMENT_CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
            <Button size="sm" onClick={() => {
              act('Attachment added', addAttachment(id, attachName || 'document.pdf', attachCategory))
              setAttachName('')
            }}>Add Document</Button>
          </div>
        </DetailSection>
      )}

      {tab === 'history' && (
        <DetailSection title="Change Log">
          <table className="erp-table w-full">
            <thead><tr><th>Date</th><th>Field</th><th>Old</th><th>New</th><th>User</th><th>Reason</th></tr></thead>
            <tbody>
              {product.changeLog.map((c) => (
                <tr key={c.id}><td>{formatDate(c.changedAt.slice(0, 10))}</td><td>{c.field}</td><td className="max-w-[120px] truncate">{c.oldValue}</td><td className="max-w-[120px] truncate">{c.newValue}</td><td>{c.changedByName}</td><td>{c.reason}</td></tr>
              ))}
              {product.changeLog.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-erp-muted">No changes recorded</td></tr>}
            </tbody>
          </table>
        </DetailSection>
      )}

      {toast && <Toast message={toast} />}
    </DetailLayout>
  )
}
