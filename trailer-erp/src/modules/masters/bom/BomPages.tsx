import { useMemo, useState, useRef } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Copy,
  Download,
  GitCompare,
  GitBranch,
  Plus,
} from 'lucide-react'
import { DataTable } from '../../../components/tables/DataTable'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, RowActions } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, FormLayout, FormSection } from '../../../components/masters/MasterLayouts'
import { StatusBadge, TypeBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Select, Textarea } from '../../../components/forms/Inputs'
import { Button } from '../../../components/ui/Button'
import { Badge } from '../../../components/ui/Badge'
import { BomTree } from '../../../components/bom/BomTree'
import { BomCostSummary } from '../../../components/bom/BomCostSummary'
import { BomApprovalBar } from '../../../components/bom/BomApprovalBar'
import { AddChildLineModal, EditQtyModal, RevisionCompareModal } from '../../../components/bom/BomModals'
import { useBomStore } from '../../../store/bomStore'
import { useMasterStore } from '../../../store/masterStore'
import { formatCurrency } from '../../../utils/formatters/currency'
import { compareBomRevisions, exportBomCsv, hasInactiveItems } from '../../../utils/bom'
import { bom360Path } from '../../../config/entity360Routes'
import { bomEditPath, bomListPath, bomNewPath } from '../../../config/bomRoutes'
import type { BomHeader } from '../../../types/bom'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'

const schema = z.object({
  productId: z.string().min(1, 'Select a product from Product Master'),
  bomNo: z.string().min(1, 'BOM number is required'),
  description: z.string().min(1, 'Description is required'),
})

type FormData = z.infer<typeof schema>

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'released', label: 'Released' },
  { value: 'obsolete', label: 'Obsolete' },
]

export function BomListPage() {
  const { pathname } = useLocation()
  const bomHeaders = useBomStore((s) => s.bomHeaders)
  const products = useMasterStore((s) => s.products)
  const isMrpEligible = useBomStore((s) => s.isMrpEligible)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const productMap = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const filtered = useMemo(
    () =>
      bomHeaders.filter((b) => {
        const product = productMap.get(b.productId)
        const s = search.toLowerCase()
        return (
          (status === 'all' || b.status === status) &&
          (b.bomNo.toLowerCase().includes(s) ||
            b.revision.toLowerCase().includes(s) ||
            product?.productName.toLowerCase().includes(s) ||
            product?.productCode.toLowerCase().includes(s))
        )
      }),
    [bomHeaders, search, status, productMap],
  )

  const columns: ColumnDef<BomHeader, unknown>[] = [
    {
      accessorKey: 'bomNo',
      header: 'BOM No',
      cell: ({ row }) => (
        <Link to={bom360Path(row.original.id)} className="font-mono text-xs font-medium text-erp-accent hover:underline">
          {row.original.bomNo}
        </Link>
      ),
    },
    {
      id: 'product',
      header: 'Finished Product',
      cell: ({ row }) => {
        const p = productMap.get(row.original.productId)
        return (
          <div>
            <p className="text-sm font-medium">{p?.productName ?? '—'}</p>
            <p className="font-mono text-xs text-slate-500">{p?.productCode}</p>
          </div>
        )
      },
    },
    { accessorKey: 'revision', header: 'Revision', cell: ({ row }) => <Badge color="purple">{row.original.revision}</Badge> },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    {
      accessorKey: 'totalCost',
      header: 'Total Cost',
      cell: ({ row }) => formatCurrency(row.original.totalCost),
    },
    {
      id: 'mrp',
      header: 'MRP',
      cell: ({ row }) =>
        isMrpEligible(row.original.id) ? (
          <Badge color="green">Eligible</Badge>
        ) : (
          <Badge color="gray">Not Ready</Badge>
        ),
    },
    {
      accessorKey: 'effectiveFrom',
      header: 'Effective From',
      cell: ({ row }) => new Date(row.original.effectiveFrom).toLocaleDateString('en-IN'),
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <RowActions
          viewTo={bom360Path(row.original.id)}
          editTo={row.original.status === 'draft' ? bomEditPath(pathname, row.original.id) : undefined}
        />
      ),
    },
  ]

  const approvedCount = bomHeaders.filter((b) => ['approved', 'released'].includes(b.status)).length

  return (
    <MasterListShell
      title="Bill of Materials"
      description="Multi-level BOM — Finished Product → Assembly → Sub Assembly → Component"
      masterGroupId="engineering"
      createLabel="New BOM"
      createTo={bomNewPath(pathname)}
      search={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search BOM no, product, revision..."
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'Total BOMs', value: bomHeaders.length },
        { label: 'Approved / Released', value: approvedCount, accent: 'green' },
        { label: 'Submitted', value: bomHeaders.filter((b) => b.status === 'submitted').length, accent: 'purple' },
        { label: 'Draft', value: bomHeaders.filter((b) => b.status === 'draft').length },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function BomFormPage() {
  const { id } = useParams()
  const { pathname } = useLocation()
  const bomBase = bomListPath(pathname)
  const navigate = useNavigate()
  const existing = useBomStore((s) => (id ? s.getBom(id) : undefined))
  const createBom = useBomStore((s) => s.createBom)
  const updateBomHeader = useBomStore((s) => s.updateBomHeader)
  const bomHeaders = useBomStore((s) => s.bomHeaders)
  const allProducts = useMasterStore((s) => s.products)
  const products = useMemo(() => allProducts.filter((p) => p.isActive), [allProducts])
  const isEdit = Boolean(id && existing)
  const [saveError, setSaveError] = useState<string | null>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)

  if (isEdit && existing && existing.status !== 'draft') {
    navigate(bom360Path(id!))
    return null
  }

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing
      ? { productId: existing.productId, bomNo: existing.bomNo, description: existing.description }
      : { productId: '', bomNo: '', description: '' },
  })
  const watched = useWatch({ control })

  const onSubmit = handleSubmit((data) => {
    if (isEdit && id) {
      updateBomHeader(id, { productId: data.productId, description: data.description })
      navigate(bom360Path(id))
    } else {
      const validation = codeSeriesRef.current?.validateBeforeSave(data.bomNo, {
        checkDuplicate: (c) => bomHeaders.some((b) => b.bomNo === c),
      })
      if (validation && !validation.ok) {
        setSaveError(validation.message ?? 'Invalid BOM number')
        return
      }
      setSaveError(null)
      const newId = createBom(data.productId, data.description, data.bomNo)
      codeSeriesRef.current?.confirmSaved(data.bomNo)
      navigate(bom360Path(newId))
    }
  })

  return (
    <FormLayout
      masterGroupId="manufacturing"
      backTo={isEdit ? bom360Path(id!) : bomBase}
      backLabel="Back to BOM List"
      title={isEdit ? 'Edit BOM Header' : 'Create Bill of Materials'}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
    >
      <FormSection title="BOM Header">
        {!isEdit ? (
          <MasterCodeField
            entityType="bom"
            label="BOM No"
            isEdit={false}
            value={watched.bomNo ?? ''}
            onChange={(v) => setValue('bomNo', v, { shouldValidate: true })}
            onSeriesReady={(h) => { codeSeriesRef.current = h }}
            error={errors.bomNo?.message ?? saveError ?? undefined}
            required
          />
        ) : null}
        <FormField label="Finished Product" required error={errors.productId?.message}>
          <Select {...register('productId')} disabled={isEdit}>
            <option value="">— Select product —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.productCode} — {p.productName}
              </option>
            ))}
          </Select>
        </FormField>
        <FormField label="Description" required error={errors.description?.message}>
          <Textarea {...register('description')} rows={3} placeholder="e.g. 45 M3 Bulker Trailer — Standard BOM" />
        </FormField>
      </FormSection>
    </FormLayout>
  )
}

export function BomDetailPage() {
  const { id } = useParams()
  const { pathname } = useLocation()
  const bomBase = bomListPath(pathname)
  const navigate = useNavigate()
  const bom = useBomStore((s) => (id ? s.getBom(id) : undefined))
  const getBomTree = useBomStore((s) => s.getBomTree)
  const getFlatLines = useBomStore((s) => s.getFlatLines)
  const getBomsByProduct = useBomStore((s) => s.getBomsByProduct)
  const addBomLine = useBomStore((s) => s.addBomLine)
  const updateBomLine = useBomStore((s) => s.updateBomLine)
  const removeBomLine = useBomStore((s) => s.removeBomLine)
  const cloneBom = useBomStore((s) => s.cloneBom)
  const reviseBom = useBomStore((s) => s.reviseBom)
  const submitForApproval = useBomStore((s) => s.submitForApproval)
  const approveBom = useBomStore((s) => s.approveBom)
  const releaseBom = useBomStore((s) => s.releaseBom)

  const product = useMasterStore((s) => (bom ? s.getProduct(bom.productId) : undefined))
  const items = useMasterStore((s) => s.items)
  const previousBom = useBomStore((s) => (bom?.previousRevisionId ? s.getBom(bom.previousRevisionId) : undefined))

  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addParentId, setAddParentId] = useState<string | null>(null)
  const [editLine, setEditLine] = useState<{ id: string; label: string; qty: number; scrapPct: number } | null>(null)
  const [compareOpen, setCompareOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  if (!bom || !id) {
    return <div className="py-12 text-center text-slate-500">BOM not found</div>
  }

  const tree = getBomTree(id)
  const flatLines = getFlatLines(id)
  const editable = bom.status === 'draft'
  const inactive = hasInactiveItems(useBomStore.getState().getLines(id), items)
  const productRevisions = getBomsByProduct(bom.productId)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }

  function handleAddChild(parentLineId: string | null) {
    setAddParentId(parentLineId)
    setAddModalOpen(true)
  }

  function handleAddLine(itemId: string, qty: number, scrapPct: number, sourceType: 'make' | 'buy' | 'subcontract') {
    const result = addBomLine(id!, addParentId, itemId, qty, scrapPct, sourceType)
    if (!result.ok) showToast(result.error ?? 'Failed to add line')
  }

  function handleExport() {
    const csv = exportBomCsv(bom!, product?.productName ?? '—', flatLines)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${bom!.bomNo}-${bom!.revision}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleClone() {
    const newId = cloneBom(id!)
    navigate(bom360Path(newId))
  }

  function handleRevise() {
    if (!['approved', 'released'].includes(bom!.status)) {
      showToast('Only approved/released BOMs can be revised')
      return
    }
    const newId = reviseBom(id!)
    navigate(bom360Path(newId))
  }

  function handleSubmit() {
    const r = submitForApproval(id!)
    showToast(r.ok ? 'Submitted for approval' : (r.error ?? 'Submit failed'))
  }

  function handleApprove() {
    const r = approveBom(id!, 'Production Manager')
    showToast(r.ok ? 'BOM approved — release to enable MRP' : (r.error ?? 'Approval failed'))
  }

  const compareRows = previousBom
    ? compareBomRevisions(
        useBomStore.getState().getFlatLines(previousBom.id),
        flatLines,
      )
    : []

  const parentLabel = addParentId
    ? flatLines.find((l) => l.id === addParentId)?.itemName ?? null
    : null

  const lineColumns: ColumnDef<(typeof flatLines)[0], unknown>[] = [
    { accessorKey: 'itemCode', header: 'Item Code', cell: ({ row }) => <span className="font-mono text-xs">{row.original.itemCode}</span> },
    { accessorKey: 'itemName', header: 'Item Name' },
    { accessorKey: 'itemType', header: 'Item Type', cell: ({ row }) => <TypeBadge value={row.original.itemType} color="gray" /> },
    { accessorKey: 'nodeLevel', header: 'Level', cell: ({ row }) => <TypeBadge value={row.original.nodeLevel} color="blue" /> },
    { accessorKey: 'specification', header: 'Specification', cell: ({ row }) => <span className="max-w-[180px] truncate text-xs">{row.original.specification}</span> },
    { accessorKey: 'qtyPerProduct', header: 'Qty / Product', cell: ({ row }) => row.original.qtyPerProduct },
    { accessorKey: 'uomCode', header: 'UOM' },
    { accessorKey: 'issueWarehouseCode', header: 'Issue WH' },
    { accessorKey: 'subAssemblyRule', header: 'SA Rule', cell: ({ row }) => row.original.subAssemblyRule ?? '—' },
    { accessorKey: 'scrapPct', header: 'Scrap %', cell: ({ row }) => `${row.original.scrapPct}%` },
    { accessorKey: 'sourceType', header: 'Source', cell: ({ row }) => <TypeBadge value={row.original.sourceType} color="green" /> },
    { accessorKey: 'leadTimeDays', header: 'Lead Time', cell: ({ row }) => `${row.original.leadTimeDays}d` },
    { accessorKey: 'standardCost', header: 'Std Cost', cell: ({ row }) => formatCurrency(row.original.standardCost) },
    { accessorKey: 'totalCost', header: 'Total Cost', cell: ({ row }) => formatCurrency(row.original.totalCost) },
    { accessorKey: 'revision', header: 'Revision' },
  ]

  return (
    <div>
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <DetailLayout
        backTo={bomBase}
        backLabel="Back to BOM List"
        title={`${bom.bomNo} — ${product?.productName ?? 'Unknown Product'}`}
        subtitle={bom.description}
        editTo={editable ? bomEditPath(pathname, id) : undefined}
        badges={
          <>
            <StatusBadge status={bom.status} />
            <Badge color="purple">{bom.revision}</Badge>
          </>
        }
      >
      <div className="mb-4 flex flex-wrap gap-2">
        <Link to={bom360Path(id!)}>
          <Button size="sm" variant="primary">Open BOM 360</Button>
        </Link>
        {editable && (
          <Button size="sm" onClick={() => handleAddChild(null)}>
            <Plus className="h-4 w-4" /> Add Root Assembly
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={handleClone}>
          <Copy className="h-4 w-4" /> Clone BOM
        </Button>
        {['approved', 'released'].includes(bom.status) && (
          <Button size="sm" variant="secondary" onClick={handleRevise}>
            <GitBranch className="h-4 w-4" /> Revise BOM
          </Button>
        )}
        {previousBom && (
          <Button size="sm" variant="secondary" onClick={() => setCompareOpen(true)}>
            <GitCompare className="h-4 w-4" /> Compare Revision
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export BOM
        </Button>
      </div>

      <div className="mb-6 space-y-4">
        <BomApprovalBar
          bom={bom}
          hasInactiveItems={inactive}
          onSubmit={handleSubmit}
          onApprove={handleApprove}
          onRelease={() => releaseBom(id!)}
        />

        <DetailSection title="BOM Header">
          <DetailGrid>
            <DetailField label="Finished Product" value={
              <Link to={`/masters/products/${bom.productId}`} className="text-erp-accent hover:underline">
                {product?.productCode} — {product?.productName}
              </Link>
            } />
            <DetailField label="BOM Number" value={bom.bomNo} />
            <DetailField label="Revision" value={bom.revision} />
            <DetailField label="Effective From" value={new Date(bom.effectiveFrom).toLocaleDateString('en-IN')} />
            <DetailField label="Total BOM Cost" value={formatCurrency(bom.totalCost)} />
            <DetailField label="MRP Status" value={
              useBomStore.getState().isMrpEligible(id!) ? (
                <Badge color="green">Eligible for MRP</Badge>
              ) : (
                <Badge color="yellow">Release required for MRP</Badge>
              )
            } />
          </DetailGrid>
        </DetailSection>
      </div>

      {productRevisions.length > 1 && (
        <DetailSection title="Revision History">
          <div className="flex flex-wrap gap-2">
            {productRevisions.map((rev) => (
              <Link
                key={rev.id}
                to={bom360Path(rev.id)}
                className={`rounded-md border px-3 py-1.5 text-sm ${rev.id === id ? 'border-erp-accent bg-blue-50 text-erp-accent' : 'border-erp-border hover:bg-slate-50'}`}
              >
                {rev.revision} · <StatusBadge status={rev.status} />
              </Link>
            ))}
          </div>
        </DetailSection>
      )}

      <div className="my-6">
        <DetailSection title="Multi-Level BOM Structure">
          <p className="mb-3 text-xs text-slate-500">
            Hierarchy: Finished Product → Assembly → Sub Assembly → Component. Items sourced exclusively from Item Master.
          </p>
          <BomTree
            nodes={tree}
            editable={editable}
            onAddChild={handleAddChild}
            onEditQty={(line) => setEditLine({ id: line.id, label: `${line.itemCode} — ${line.itemName}`, qty: line.qtyPerParent, scrapPct: line.scrapPct })}
            onRemove={(lineId) => removeBomLine(lineId)}
          />
        </DetailSection>
      </div>

      <div className="my-6">
        <DetailSection title="BOM Line Details">
          <DataTable data={flatLines} columns={lineColumns} />
        </DetailSection>
      </div>

      <div className="my-6">
        <BomCostSummary totalCost={bom.totalCost} flatLines={flatLines} productPrice={product?.standardPrice} />
      </div>
      </DetailLayout>

      <AddChildLineModal
        open={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        parentLabel={parentLabel}
        onAdd={handleAddLine}
      />

      {editLine && (
        <EditQtyModal
          key={editLine.id}
          open={Boolean(editLine)}
          lineLabel={editLine.label}
          qty={editLine.qty}
          scrapPct={editLine.scrapPct}
          onClose={() => setEditLine(null)}
          onSave={(qty, scrapPct) => {
            const r = updateBomLine(editLine.id, { qtyPerParent: qty, scrapPct })
            if (!r.ok) showToast(r.error ?? 'Update failed')
          }}
        />
      )}

      <RevisionCompareModal
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        revALabel={previousBom?.revision ?? 'Previous'}
        revBLabel={bom.revision}
        rows={compareRows}
      />
    </div>
  )
}
