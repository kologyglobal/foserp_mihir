import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { EntityDocumentsPanel, useEntityDocumentCount } from '../../components/dms/EntityDocumentsPanel'
import {
  AlertTriangle,
  Download,
  GitBranch,
  GitCompare,
  Layers,
  Printer,
  Search,
} from 'lucide-react'
import { Entity360Shell, Entity360Panel } from '../../components/design-system/Entity360Shell'
import { DataGrid } from '../../components/design-system/DataGrid'
import { FactBox } from '../../components/design-system/FactBox'
import { Timeline } from '../../components/design-system/Timeline'
import { QuickActions } from '../../components/design-system/WorkspaceLayout'
import { BomTreeView } from './BomTreeView'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { TableLink } from '../../components/ui/AppLink'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useBom360 } from '../../utils/entity360Metrics'
import { bom360Path } from '../../config/entity360Routes'
import { exportBomCsv } from '../../utils/bom'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import type { BomLineEnriched } from '../../types/bom'

type Tab = 'overview' | 'structure' | 'cost' | 'revision' | 'usage' | 'risk' | 'impact' | 'documents' | 'timeline'

function KpiTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-erp-border bg-erp-surface-alt/40 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-erp-muted">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-erp-text">{value}</p>
    </div>
  )
}

export function Bom360Page() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useBom360(id)
  const [tab, setTab] = useState<Tab>('overview')
  const [impactItemId, setImpactItemId] = useState<string | null>(null)
  const docCount = useEntityDocumentCount('bom', id)

  const structureColumns = useMemo<ColumnDef<BomLineEnriched, unknown>[]>(
    () => [
      { accessorKey: 'itemCode', header: 'Item', cell: ({ row }) => <span className="font-mono text-xs">{row.original.itemCode}</span> },
      { accessorKey: 'itemName', header: 'Description' },
      { accessorKey: 'nodeLevel', header: 'Level', cell: ({ row }) => <StatusBadge status={row.original.nodeLevel} /> },
      { accessorKey: 'qtyPerProduct', header: 'Qty', cell: ({ row }) => <span className="tabular-nums">{formatNumber(row.original.qtyPerProduct)}</span> },
      { accessorKey: 'uomCode', header: 'UOM' },
      { accessorKey: 'sourceType', header: 'Source', cell: ({ row }) => <StatusBadge status={row.original.sourceType} /> },
      { accessorKey: 'issueWarehouseCode', header: 'Warehouse' },
      { accessorKey: 'totalCost', header: 'Cost', cell: ({ row }) => formatCurrency(row.original.totalCost) },
    ],
    [],
  )

  if (!data) return <p className="p-8 text-erp-muted">BOM not found.</p>

  const { bom, product } = data
  const impactLine = impactItemId ? data.flat.find((l) => l.itemId === impactItemId) : data.leafLines[0]

  function handleExport() {
    const csv = exportBomCsv(bom, product?.productName ?? bom.description, data!.flat)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${bom.bomNo}-rev-${bom.revision}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const revisionColumns: ColumnDef<(typeof data.revisions)[0], unknown>[] = [
    { accessorKey: 'bomNo', header: 'BOM', cell: ({ row }) => <TableLink to={bom360Path(row.original.id)}>{row.original.bomNo}</TableLink> },
    { accessorKey: 'revision', header: 'Revision' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
    { accessorKey: 'updatedAt', header: 'Updated', cell: ({ row }) => row.original.updatedAt.slice(0, 10) },
  ]

  return (
    <Entity360Shell
      badge="BOM 360"
      title={bom.description}
      subtitle={`${bom.bomNo} · Rev ${bom.revision}`}
      backTo="/manufacturing/setup/boms"
      backLabel="BOMs"
      editTo={`/manufacturing/setup/boms`}
      editLabel={bom.status === 'draft' ? 'Edit BOM' : 'Manage BOM'}
      favoritePath={bom360Path(bom.id)}
      insights={[
        { label: 'Components', value: data.leafLines.length, accent: 'blue' },
        { label: 'Total Cost', value: formatCurrency(data.standardCost), accent: 'green' },
        { label: 'Released', value: data.isReleased ? 'Yes' : 'No', accent: data.isReleased ? 'green' : 'amber' },
        { label: 'Long Lead', value: data.longLead.length, accent: data.longLead.length ? 'amber' : 'green' },
        { label: 'Risk Items', value: data.riskItemCount, accent: data.riskItemCount ? 'red' : 'green' },
        { label: 'Open WO', value: data.openWosUsing.length, accent: 'blue' },
      ]}
      commandBar={
        <CommandBar>
          <CommandBarGroup label="BOM Actions">
            <CommandBarButton icon={GitBranch} label="Revise BOM" onClick={() => navigate(`/manufacturing/setup/boms`)} primary />
            <CommandBarButton icon={GitCompare} label="Compare Revision" onClick={() => navigate(`/manufacturing/setup/boms`)} />
            <CommandBarButton icon={Download} label="Export BOM" onClick={handleExport} />
            <CommandBarButton icon={Printer} label="Print BOM" onClick={() => window.print()} />
            <CommandBarButton icon={Layers} label="View Product" onClick={() => product && navigate(`/masters/products/${product.id}`)} />
            <CommandBarButton icon={Search} label="Impact Analysis" onClick={() => setTab('impact')} />
          </CommandBarGroup>
        </CommandBar>
      }
      tabs={[
        { id: 'overview', label: 'Overview' },
        { id: 'structure', label: 'Structure', count: data.flat.length },
        { id: 'cost', label: 'Cost Rollup' },
        { id: 'revision', label: 'Revision History', count: data.revisions.length },
        { id: 'usage', label: 'Usage' },
        { id: 'risk', label: 'Material Risk', count: data.riskItemCount },
        { id: 'impact', label: 'Impact Analysis' },
        { id: 'documents', label: 'Documents', count: docCount },
        { id: 'timeline', label: 'Timeline' },
      ]}
      activeTab={tab}
      onTabChange={(t) => setTab(t as Tab)}
      activity={data.activity}
      quickActions={
        <QuickActions actions={[
          { label: 'Manage Structure', onClick: () => navigate(`/manufacturing/setup/boms`) },
          { label: 'Production Plan', onClick: () => navigate('/manufacturing/production-plan') },
          { label: 'WO Register', onClick: () => navigate('/manufacturing/work-orders') },
          { label: 'Costing', onClick: () => navigate('/accounting/manufacturing') },
        ]} />
      }
      factBoxes={
        <>
          <FactBox title="BOM Overview" fields={[
            { label: 'BOM No', value: bom.bomNo },
            { label: 'Product', value: product ? <TableLink to={`/masters/products/${product.id}`}>{product.productName}</TableLink> : '—' },
            { label: 'Revision', value: bom.revision },
            { label: 'Status', value: <StatusBadge status={bom.status} /> },
            { label: 'Effective Date', value: formatDate(bom.effectiveFrom) },
            { label: 'Released By', value: bom.approvedBy ?? '—' },
          ]} />
          <FactBox title="Cost & Risk" fields={[
            { label: 'Total Components', value: data.leafLines.length },
            { label: 'Total Cost', value: formatCurrency(data.standardCost) },
            { label: 'Long Lead Items', value: data.longLead.length },
            { label: 'Risk Items', value: data.riskItemCount },
          ]} />
        </>
      }
    >
      {tab === 'overview' && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <KpiTile label="BOM No" value={bom.bomNo} />
          <KpiTile label="Product" value={product?.productCode ?? '—'} />
          <KpiTile label="Revision" value={bom.revision} />
          <KpiTile label="Status" value={<StatusBadge status={bom.status} />} />
          <KpiTile label="Effective Date" value={formatDate(bom.effectiveFrom)} />
          <KpiTile label="Released By" value={bom.approvedBy ?? '—'} />
          <KpiTile label="Total Components" value={data.leafLines.length} />
          <KpiTile label="Total Cost" value={formatCurrency(data.standardCost)} />
          <KpiTile label="Long Lead Items" value={data.longLead.length} />
          <KpiTile label="Risk Items" value={data.riskItemCount} />
        </div>
      )}

      {tab === 'structure' && (
        <div className="space-y-4">
          <Entity360Panel title="Multi-level BOM Tree" subtitle="Assembly → Sub Assembly → Component">
            <div className="p-4">
              <BomTreeView tree={data.tree} />
            </div>
          </Entity360Panel>
          <Entity360Panel title="Flat Structure Grid">
            <DataGrid
              data={data.flat}
              columns={structureColumns}
              compact
              showToolbar
              searchPlaceholder="Search item code or name…"
              globalFilterFn={(row, filter) =>
                row.itemCode.toLowerCase().includes(filter.toLowerCase()) ||
                row.itemName.toLowerCase().includes(filter.toLowerCase())
              }
              emptyMessage="No BOM lines on this structure."
            />
          </Entity360Panel>
        </div>
      )}

      {tab === 'cost' && (
        <Entity360Panel title="Cost Roll-up">
          <div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-5">
            <KpiTile label="Material Cost" value={formatCurrency(data.materialCost)} />
            <KpiTile label="Bought Out Cost" value={formatCurrency(data.boughtOutCost)} />
            <KpiTile label="Subcontract Cost" value={formatCurrency(data.subcontractCost)} />
            <KpiTile label="Scrap Cost" value={formatCurrency(data.scrapCost)} />
            <KpiTile label="Total Standard Cost" value={formatCurrency(data.standardCost)} />
          </div>
          <DataGrid
            data={data.leafLines}
            columns={structureColumns}
            compact
            emptyMessage="No leaf components for cost roll-up."
          />
        </Entity360Panel>
      )}

      {tab === 'revision' && (
        <Entity360Panel title="Revision History">
          <DataGrid data={data.revisions} columns={revisionColumns} compact emptyMessage="No revisions for this product." />
        </Entity360Panel>
      )}

      {tab === 'usage' && (
        <div className="space-y-4">
          <Entity360Panel title="Products Using This BOM">
            {product ? (
              <div className="p-4 text-[13px]">
                <TableLink to={`/masters/products/${product.id}`}>{product.productCode}</TableLink>
                <span className="text-erp-muted"> — {product.productName}</span>
              </div>
            ) : (
              <p className="p-4 text-erp-muted">No product linked.</p>
            )}
          </Entity360Panel>
          <Entity360Panel title="Open Sales Orders">
            <DataGrid
              data={data.openSosUsing}
              columns={[
                { accessorKey: 'salesOrderNo', header: 'SO', cell: ({ row }) => <TableLink to={`/sales/orders/${row.original.id}`}>{row.original.salesOrderNo}</TableLink> },
                { accessorKey: 'qty', header: 'Qty' },
                { accessorKey: 'requiredDate', header: 'Required', cell: ({ row }) => formatDate(row.original.requiredDate) },
                { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
              ]}
              compact
              emptyMessage="No open sales orders for this product."
            />
          </Entity360Panel>
          <Entity360Panel title="Open Work Orders">
            <DataGrid
              data={data.openWosUsing}
              columns={[
                { accessorKey: 'woNo', header: 'WO', cell: ({ row }) => <TableLink to={`/work-orders/${row.original.id}`}>{row.original.woNo}</TableLink> },
                { accessorKey: 'qty', header: 'Qty' },
                { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
                { id: 'wo360', header: '', cell: ({ row }) => <TableLink to={`/manufacturing/work-orders/${row.original.id}`}>WO</TableLink> },
              ]}
              compact
              emptyMessage="No open work orders pegged to this BOM."
            />
          </Entity360Panel>
          <Entity360Panel title="Recent Production Plans">
            <DataGrid
              data={data.mrpRunsUsing}
              columns={[
                { accessorKey: 'runNo', header: 'Run', cell: ({ row }) => <TableLink to="/manufacturing/production-plan">{row.original.runNo}</TableLink> },
                { accessorKey: 'runBy', header: 'Run By' },
                { accessorKey: 'runAt', header: 'Date', cell: ({ row }) => formatDate(row.original.runAt.slice(0, 10)) },
              ]}
              compact
              emptyMessage="No planning runs reference BOM components yet."
            />
          </Entity360Panel>
        </div>
      )}

      {tab === 'risk' && (
        <Entity360Panel title="Material Risk Register">
          <DataGrid
            data={[
              ...data.shortageComponents.map((m) => ({ id: m.id, itemCode: m.itemCode, risk: 'Shortage', detail: formatNumber(m.shortageQty) })),
              ...data.longLead.map((l) => ({ id: `ll-${l.id}`, itemCode: l.itemCode, risk: 'Long Lead', detail: `${l.leadTimeDays} days` })),
              ...data.singleSource.map((l) => ({ id: `ss-${l.id}`, itemCode: l.itemCode, risk: 'Single Vendor', detail: '1 vendor map' })),
              ...data.inactiveItems.map((l) => ({ id: `in-${l.id}`, itemCode: l.itemCode, risk: 'Inactive Item', detail: l.itemName })),
              ...data.noCostItems.map((l) => ({ id: `nc-${l.id}`, itemCode: l.itemCode, risk: 'No Cost', detail: 'Std cost = 0' })),
            ]}
            columns={[
              { accessorKey: 'itemCode', header: 'Item' },
              { accessorKey: 'risk', header: 'Risk Type', cell: ({ row }) => <StatusBadge status={row.original.risk} /> },
              { accessorKey: 'detail', header: 'Detail' },
            ]}
            compact
            emptyMessage="No material risks identified on this BOM."
          />
        </Entity360Panel>
      )}

      {tab === 'impact' && (
        <Entity360Panel title="Impact Analysis" subtitle="Select a component to see downstream effect">
          <div className="flex flex-wrap gap-2 border-b border-erp-border p-4">
            {data.leafLines.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setImpactItemId(l.itemId)}
                className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                  impactLine?.itemId === l.itemId ? 'border-erp-primary bg-erp-primary-soft text-erp-primary' : 'border-erp-border text-erp-text hover:border-erp-primary/40'
                }`}
              >
                {l.itemCode}
              </button>
            ))}
          </div>
          {impactLine && (
            <div className="space-y-4 p-4">
              <p className="flex items-center gap-2 text-[13px] font-semibold text-erp-text">
                <AlertTriangle className="h-4 w-4 text-erp-warning-fg" />
                If {impactLine.itemName} ({impactLine.itemCode}) changes:
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                <FactBox title="Affected Entities" fields={[
                  { label: 'Products', value: product?.productName ?? '—' },
                  { label: 'Sales Orders', value: data.sosUsing.length },
                  { label: 'Work Orders', value: data.wosUsing.length },
                  { label: 'Purchase Requirements', value: data.purchaseRequirements.length },
                  { label: 'Cost Sheets', value: data.costSheets.length },
                ]} />
              </div>
              <DataGrid
                data={data.purchaseRequirements}
                columns={[
                  { accessorKey: 'prNo', header: 'PR', cell: ({ row }) => <TableLink to={`/purchase/requisitions/${row.original.id}`}>{row.original.prNo}</TableLink> },
                  { accessorKey: 'status', header: 'Status', cell: ({ row }) => <StatusBadge status={row.original.status} /> },
                ]}
                compact
                emptyMessage="No purchase requirements for BOM components."
              />
            </div>
          )}
        </Entity360Panel>
      )}

      {tab === 'documents' && bom.id && <EntityDocumentsPanel entityType="bom" entityId={bom.id} />}

      {tab === 'timeline' && (
        <Entity360Panel title="BOM Lifecycle Timeline">
          <div className="p-4">
            <Timeline events={data.timeline} />
          </div>
        </Entity360Panel>
      )}
    </Entity360Shell>
  )
}
