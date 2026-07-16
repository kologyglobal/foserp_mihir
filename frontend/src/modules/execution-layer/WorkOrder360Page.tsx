import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ClipboardList,
  Package,
  Play,
  Printer,
  ShieldCheck,
  Truck,
  Wrench,
} from 'lucide-react'
import { Entity360Shell, Entity360Panel } from '../../components/design-system/Entity360Shell'
import { FactBox } from '../../components/design-system/FactBox'
import { QuickActions } from '../../components/design-system/WorkspaceLayout'
import { CommandBar, CommandBarButton, CommandBarGroup } from '../../components/ui/CommandBar'
import { Badge, formatStatus, statusColor } from '../../components/ui/Badge'
import { TableLink } from '../../components/ui/AppLink'
import { JobCardPanel } from '../../components/production/JobCardPanel'
import { WorkOrderCostPanel } from '../../components/costing/WorkOrderCostPanel'
import { useWorkOrder360 } from '../../utils/workOrder360Metrics'
import { formatCurrency, formatNumber } from '../../utils/formatters/currency'
import { formatDate } from '../../utils/dates/format'
import { useWorkOrderStore } from '../../store/workOrderStore'
import { canStartOperation } from '../../utils/qualityEngine'
import { EntityDocumentsPanel, useEntityDocumentCount } from '../../components/dms/EntityDocumentsPanel'
import { EntityQrToolbar } from '../../components/qr/EntityQrToolbar'
import { SerialGenealogyPanel } from '../../components/serial/SerialGenealogyPanel'
import { DocumentHealthBadge, NextBestActionPanel, LiveStatusLabel } from '../../components/live-erp'
import { buildWoNextActions, computeWoHealth } from '../../utils/liveErpMetrics'

type Tab =
  | 'overview'
  | 'materials'
  | 'operations'
  | 'job_cards'
  | 'qc_rework'
  | 'subcontract'
  | 'wip'
  | 'costing'
  | 'timeline'
  | 'documents'

export function WorkOrder360Page() {
  const { id } = useParams()
  const navigate = useNavigate()
  const data = useWorkOrder360(id)
  const reserveMaterials = useWorkOrderStore((s) => s.reserveMaterials)
  const startJobCard = useWorkOrderStore((s) => s.startJobCard)
  const completeJobCard = useWorkOrderStore((s) => s.completeJobCard)
  const [tab, setTab] = useState<Tab>('overview')
  const [toast, setToast] = useState<string | null>(null)
  const docCount = useEntityDocumentCount('work_order', id)

  if (!data) return <p className="p-8 text-erp-muted">Work order not found.</p>

  const { wo, kpis } = data

  function show(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'materials', label: 'Materials', count: data.mats.length },
    { id: 'operations', label: 'Operations', count: data.ops.length },
    { id: 'job_cards', label: 'Job Cards', count: data.cards.length },
    { id: 'qc_rework', label: 'QC & Rework', count: data.woInspections.length + data.woReworks.length },
    { id: 'subcontract', label: 'Subcontract / Job Work', count: data.shipments.length },
    { id: 'wip', label: 'WIP & Movements', count: data.movements.length },
    { id: 'costing', label: 'Costing' },
    { id: 'timeline', label: 'Timeline', count: data.woActivities.length },
    { id: 'documents', label: 'Documents', count: docCount },
  ]

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-erp-border bg-erp-surface px-6 py-3 text-sm font-medium shadow-erp-lg">
          {toast}
        </div>
      )}
      <Entity360Shell
        title={wo.woNo}
        subtitle={wo.outputItemCode}
        description={`${formatStatus(wo.woType)} · ${formatStatus(wo.status)} · ${kpis.progressPct}% complete`}
        badge="Work Order 360"
        backTo={`/work-orders/${wo.id}`}
        backLabel="WO Detail"
        favoritePath={`/work-orders/${wo.id}/360`}
        insights={[
          { label: 'Material Ready', value: `${kpis.materialReadinessPct}%`, accent: kpis.materialReadinessPct >= 80 ? 'green' : 'amber' },
          { label: 'Ops Done', value: `${kpis.operationsCompletedPct}%`, accent: 'blue' },
          { label: 'QC Holds', value: kpis.qcHolds, accent: kpis.qcHolds > 0 ? 'red' : 'green' },
          { label: 'Rework', value: kpis.reworkCount, accent: kpis.reworkCount > 0 ? 'amber' : 'green' },
          { label: 'Issued Value', value: formatCurrency(kpis.issuedMaterialValue), accent: 'blue' },
          { label: 'Actual Cost', value: formatCurrency(kpis.actualCost), accent: 'blue' },
          { label: 'Variance', value: `${kpis.variancePct}%`, accent: Math.abs(kpis.variancePct) > 10 ? 'red' : 'green' },
          { label: 'Days Delayed', value: kpis.daysDelayed, accent: kpis.daysDelayed > 0 ? 'red' : 'green' },
        ]}
        commandBar={
          <CommandBar>
            <CommandBarGroup label="Execution">
              <CommandBarButton
                icon={Package}
                label="Reserve Material"
                primary
                onClick={() => {
                  const r = reserveMaterials(wo.id)
                  show(r.ok ? 'Materials reserved' : r.error ?? 'Reserve failed')
                }}
              />
              <CommandBarButton icon={Package} label="Issue Material" onClick={() => navigate(`/work-orders/${wo.id}?tab=issue`)} />
              <CommandBarButton icon={Play} label="Start Operation" onClick={() => navigate(`/production/job-cards`)} />
              <CommandBarButton icon={ClipboardList} label="Open Job Cards" onClick={() => setTab('job_cards')} />
              <CommandBarButton icon={ShieldCheck} label="Request QC" onClick={() => navigate('/quality/queue')} />
              <CommandBarButton icon={Truck} label="Post SA Receipt" onClick={() => navigate(`/work-orders/${wo.id}?tab=sa_receipt`)} />
              <CommandBarButton icon={Wrench} label="Post FG Receipt" onClick={() => navigate(`/work-orders/${wo.id}?tab=fg_receipt`)} />
              <CommandBarButton icon={Printer} label="Print WO" onClick={() => window.print()} />
            </CommandBarGroup>
          </CommandBar>
        }
        tabs={tabs}
        activeTab={tab}
        onTabChange={(t) => setTab(t as Tab)}
        activity={data.activityFeed}
        quickActions={
          <QuickActions
            actions={[
              { label: 'Shop Floor Queue', onClick: () => navigate('/shop-floor') },
              { label: 'Job Work Register', onClick: () => navigate('/job-work') },
              { label: 'Costing Dashboard', onClick: () => navigate('/costing') },
              { label: 'WO Detail', onClick: () => navigate(`/work-orders/${wo.id}`) },
            ]}
          />
        }
        factBoxes={
          <>
            <FactBox
              title="Work Order"
              fields={[
                { label: 'WO No', value: wo.woNo },
                { label: 'Linked SO', value: <TableLink to={`/sales/orders/${wo.salesOrderId}`}>{wo.salesOrderNo}</TableLink> },
                { label: 'Company', value: data.customer?.customerName ?? '—' },
                { label: 'Product / FG', value: data.product?.productName ?? wo.outputItemCode },
                { label: 'WO Type', value: formatStatus(wo.woType) },
                { label: 'Status', value: <Badge color={statusColor(wo.status)}>{formatStatus(wo.status)}</Badge> },
                { label: 'Progress', value: `${kpis.progressPct}%` },
                { label: 'Planned Start', value: formatDate(wo.plannedStartDate) },
                { label: 'Planned Finish', value: formatDate(wo.plannedFinishDate) },
                { label: 'Actual Start', value: wo.releasedAt ? formatDate(wo.releasedAt.slice(0, 10)) : '—' },
                { label: 'Actual Finish', value: wo.completedAt ? formatDate(wo.completedAt.slice(0, 10)) : '—' },
                { label: 'Current Operation', value: data.currentOp?.operationName ?? '—' },
                { label: 'Next Action', value: data.nextAction },
                { label: 'Blockers', value: data.blockers.length ? data.blockers.join('; ') : 'None' },
              ]}
            />
          </>
        }
      >
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-erp-border bg-white px-4 py-3">
              <DocumentHealthBadge health={computeWoHealth(wo)} />
              <LiveStatusLabel
                message={
                  kpis.qcHolds > 0
                    ? 'QC hold — reinspection or rework may be required before next operation'
                    : kpis.daysDelayed > 0
                      ? `${kpis.daysDelayed} day(s) behind planned finish`
                      : `Progress ${kpis.progressPct}% — ${data.nextAction}`
                }
                variant={kpis.qcHolds > 0 || kpis.daysDelayed > 0 ? 'warning' : 'neutral'}
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="lg:col-span-2 grid gap-4 lg:grid-cols-2">
            <Entity360Panel title="Execution Snapshot">
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
                {[
                  ['Material Readiness', `${kpis.materialReadinessPct}%`],
                  ['Operations Completed', `${kpis.operationsCompletedPct}%`],
                  ['QC Holds', kpis.qcHolds],
                  ['Rework Count', kpis.reworkCount],
                  ['Issued Material Value', formatCurrency(kpis.issuedMaterialValue)],
                  ['Actual Cost', formatCurrency(kpis.actualCost)],
                  ['Variance %', `${kpis.variancePct}%`],
                  ['Days Delayed', kpis.daysDelayed],
                ].map(([label, val]) => (
                  <div key={String(label)} className="rounded-lg border border-erp-border bg-erp-surface-alt/50 p-3">
                    <p className="text-[11px] font-semibold uppercase text-erp-muted">{label}</p>
                    <p className="mt-1 text-lg font-bold tabular-nums">{val}</p>
                  </div>
                ))}
              </div>
            </Entity360Panel>
            <Entity360Panel title="Next Steps">
              <div className="space-y-2 p-4 text-sm">
                <p><strong>Current:</strong> {data.currentOp?.operationName ?? '—'}</p>
                <p><strong>Next operation:</strong> {data.nextOp?.operationName ?? '—'}</p>
                <p><strong>Recommended action:</strong> {data.nextAction}</p>
                {data.blockers.length > 0 && (
                  <ul className="mt-2 list-disc pl-5 text-erp-danger">
                    {data.blockers.map((b) => <li key={b}>{b}</li>)}
                  </ul>
                )}
              </div>
            </Entity360Panel>
              </div>
              <NextBestActionPanel actions={buildWoNextActions(wo)} title="Next Best Actions" />
            </div>
          </div>
        )}

        {tab === 'materials' && (
          <Entity360Panel title="Material Lines">
            <table className="erp-table">
              <thead>
                <tr><th>Item</th><th className="text-right">Required</th><th className="text-right">Reserved</th><th className="text-right">Issued</th><th>Status</th></tr>
              </thead>
              <tbody>
                {data.mats.map((l) => (
                  <tr key={l.id}>
                    <td><TableLink to={`/masters/items/${l.itemId}/360`}>{l.itemCode}</TableLink></td>
                    <td className="num">{formatNumber(l.requiredQty)}</td>
                    <td className="num">{formatNumber(l.reservedQty)}</td>
                    <td className="num">{formatNumber(l.issuedQty)}</td>
                    <td><Badge color={statusColor(l.status)}>{formatStatus(l.status)}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Entity360Panel>
        )}

        {tab === 'operations' && (
          <Entity360Panel title="Routing Operations">
            <table className="erp-table">
              <thead>
                <tr><th>Seq</th><th>Operation</th><th>Work Center</th><th>Status</th><th className="text-right">Planned Hrs</th></tr>
              </thead>
              <tbody>
                {data.ops.map((o) => (
                  <tr key={o.id}>
                    <td>{o.sequenceNo}</td>
                    <td>{o.operationName}</td>
                    <td>{o.workCenterCode}</td>
                    <td><Badge color={statusColor(o.status)}>{formatStatus(o.status)}</Badge></td>
                    <td className="num">{o.standardHours}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Entity360Panel>
        )}

        {tab === 'job_cards' && id && (
          <Entity360Panel title="Job Cards">
            {data.ops.length === 0 ? (
              <p className="p-4 text-sm text-erp-muted">Start production to generate job cards.</p>
            ) : (
              <div className="space-y-4 p-4">
                {data.ops.map((op) => {
                  const jc = data.cards.find((j) => j.productionOperationId === op.id)
                  const seqGate = canStartOperation(data.ops, op.id)
                  return (
                    <JobCardPanel
                      key={op.id}
                      woNo={wo.woNo}
                      workOrderId={wo.id}
                      operation={op}
                      jobCard={jc}
                      inspections={data.woInspections}
                      reworks={data.woReworks}
                      sequenceBlocked={!seqGate.ok}
                      sequenceBlockReason={seqGate.error}
                      onStart={(jobCardId, assignedTeam, startTime) => {
                        const r = startJobCard(jobCardId, { assignedTeam, startTime })
                        show(r.ok ? `Started · ${assignedTeam}` : r.error ?? 'Failed')
                      }}
                      onComplete={(jobCardId, endTime, actualHours, remarks, qcChecks) => {
                        const r = completeJobCard(jobCardId, { endTime, actualHours, remarks, qcChecks })
                        show(r.ok ? 'Job card completed' : r.error ?? 'Failed')
                      }}
                    />
                  )
                })}
              </div>
            )}
          </Entity360Panel>
        )}

        {tab === 'qc_rework' && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Entity360Panel title="Inspections">
              <table className="erp-table">
                <thead><tr><th>No</th><th>Category</th><th>Status</th><th>Operation</th></tr></thead>
                <tbody>
                  {data.woInspections.map((i) => (
                    <tr key={i.id}>
                      <td><Link to={`/quality/inspections/${i.id}`}>{i.inspectionNo}</Link></td>
                      <td>{formatStatus(i.category)}</td>
                      <td><Badge color={statusColor(i.status)}>{formatStatus(i.status)}</Badge></td>
                      <td>{i.operationName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Entity360Panel>
            <Entity360Panel title="Rework & NCR">
              <table className="erp-table">
                <thead><tr><th>Type</th><th>No</th><th>Status</th></tr></thead>
                <tbody>
                  {data.woReworks.map((r) => (
                    <tr key={r.id}><td>Rework</td><td>{r.reworkNo}</td><td>{formatStatus(r.status)}</td></tr>
                  ))}
                  {data.woNcrs.map((n) => (
                    <tr key={n.id}><td>NCR</td><td><Link to={`/quality/ncr/${n.id}`}>{n.ncrNo}</Link></td><td>{formatStatus(n.status)}</td></tr>
                  ))}
                </tbody>
              </table>
            </Entity360Panel>
          </div>
        )}

        {tab === 'subcontract' && (
          <Entity360Panel title="Subcontract / Job Work">
            {wo.woType === 'subcontract' && data.jwo ? (
              <div className="space-y-4 p-4">
                <p className="text-sm">JWO: <Link to={`/job-work/${wo.id}`} className="text-erp-primary">{data.jwo.jwoNo}</Link></p>
                <table className="erp-table">
                  <thead><tr><th>Challan</th><th className="text-right">Sent</th><th className="text-right">Received</th><th className="text-right">Rejected</th><th>Status</th></tr></thead>
                  <tbody>
                    {data.shipments.map((s) => (
                      <tr key={s.id}>
                        <td>{s.challanNo}</td>
                        <td className="num">{s.sentQty}</td>
                        <td className="num">{s.receivedQty}</td>
                        <td className="num">{s.rejectedQty}</td>
                        <td>{formatStatus(s.status)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-4 text-sm text-erp-muted">No subcontract activity on this work order.</p>
            )}
          </Entity360Panel>
        )}

        {tab === 'wip' && (
          <Entity360Panel title="Inventory Movements">
            <table className="erp-table">
              <thead><tr><th>Date</th><th>Type</th><th className="text-right">Qty</th><th>Reference</th></tr></thead>
              <tbody>
                {data.movements.map((m) => (
                  <tr key={m.id}>
                    <td>{formatDate(m.movementDate)}</td>
                    <td>{formatStatus(m.movementType)}</td>
                    <td className="num">{m.qty}</td>
                    <td>{m.referenceNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Entity360Panel>
        )}

        {tab === 'costing' && id && <WorkOrderCostPanel workOrderId={id} />}

        {tab === 'timeline' && (
          <Entity360Panel title="Activity Timeline">
            <ul className="divide-y divide-erp-border p-4">
              {data.woActivities.map((a) => (
                <li key={a.id} className="py-2 text-sm">
                  <strong>{a.action}</strong> — {a.details}
                  <span className="ml-2 text-erp-muted">{formatDate(a.createdAt.slice(0, 10))}</span>
                </li>
              ))}
            </ul>
          </Entity360Panel>
        )}

        {tab === 'documents' && <EntityDocumentsPanel entityType="work_order" entityId={wo.id} />}
      </Entity360Shell>
      <div className="mx-auto max-w-7xl space-y-4 px-6 pb-6">
        <EntityQrToolbar
          entityType="WORK_ORDER"
          entityId={wo.id}
          displayCode={wo.woNo}
          metadata={{ woNo: wo.woNo, itemCode: wo.outputItemCode }}
          payload={{ wo: wo.woNo, item: wo.outputItemCode }}
        />
        <SerialGenealogyPanel workOrderId={wo.id} />
      </div>
    </>
  )
}
