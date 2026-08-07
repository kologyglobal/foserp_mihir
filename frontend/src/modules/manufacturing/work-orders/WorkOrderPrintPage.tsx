import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { ErpButton, ErpButtonGroup } from '@/components/erp/ErpButton'
import {
  WorkOrderPrintDocument,
  type WorkOrderPrintModel,
} from '@/components/manufacturing/WorkOrderPrintDocument'
import { PageLoadingFallback } from '@/components/system/PageLoadingFallback'
import { isApiMode } from '@/config/apiConfig'
import { getWorkOrderDetail, listWorkOrderMaterials } from '@/services/api/manufacturingApi'
import { getWorkOrderById, getWorkOrderMaterials, getWorkOrderOperations } from '@/services/manufacturing'
import { printWorkOrderDocument, workOrderPdfFileName } from '@/utils/workOrderPdfExport'
import type { WorkOrderDetail } from '@/types/manufacturingProduction'

function mapApiWorkOrder(
  wo: WorkOrderDetail,
  materials: WorkOrderPrintModel['materials'],
): WorkOrderPrintModel {
  const stages = [...(wo.stages ?? [])]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((s, idx) => ({
      seq: idx + 1,
      code: s.code,
      name: s.name,
      status: s.status,
      planned: s.plannedQuantity,
      good: s.goodQuantity,
      qcRequired: s.qualityRequired,
    }))

  return {
    workOrderNo: wo.workOrderNo || wo.orderNumber,
    status: wo.status,
    healthStatus: wo.healthStatus,
    productCode: wo.productItemCode ?? '',
    productName: wo.productItemName ?? '',
    plannedQty: wo.plannedQuantity,
    completedQty: wo.completedGoodQuantity,
    reworkQty: wo.reworkQuantity,
    rejectedQty: wo.rejectedQuantity,
    scrapQty: wo.scrapQuantity,
    uom: '',
    dueDate: wo.requiredCompletionDate,
    plannedStart: wo.plannedStartDate,
    actualStart: wo.actualStartAt,
    priority: wo.priority,
    plant: wo.plantCode,
    jobNumber: wo.jobNumber,
    salesOrderNo: wo.relatedSalesOrder?.salesOrderNo ?? wo.salesOrderNo ?? null,
    customerName: wo.relatedSalesOrder?.customerName ?? wo.customerName ?? null,
    supervisor: wo.supervisorName ?? null,
    materialStatus: wo.materialControlStatus,
    qualityStatus: wo.qualityStatus,
    notes: wo.notes,
    stages,
    materials,
  }
}

async function mapDemoWorkOrder(workOrderId: string): Promise<WorkOrderPrintModel | null> {
  const wo = await getWorkOrderById(workOrderId)
  if (!wo) return null

  const [materialsRaw, ops] = await Promise.all([
    getWorkOrderMaterials(wo.id),
    getWorkOrderOperations(wo.id),
  ])

  const materials = materialsRaw.map((m) => ({
    code: m.componentItemCode,
    name: m.componentItemName,
    required: String(m.requiredQty),
    issued: String(m.issuedQty ?? m.consumedQty ?? 0),
    uom: m.uom,
    status: m.status,
  }))

  const stages = ops.map((op, idx) => ({
    seq: op.sequenceNo || idx + 1,
    code: `OP-${op.sequenceNo || idx + 1}`,
    name: op.operationName,
    status: op.status,
    planned: String(op.plannedQty ?? wo.plannedQty),
    good: String(op.completedQty ?? 0),
    qcRequired: Boolean(op.qcRequired),
  }))

  return {
    workOrderNo: wo.woNumber,
    status: wo.status,
    productCode: wo.finishedItemCode,
    productName: wo.finishedItemName,
    plannedQty: String(wo.plannedQty),
    completedQty: String(wo.producedQty),
    reworkQty: String(wo.reworkQty ?? 0),
    rejectedQty: String(wo.rejectedQty ?? 0),
    scrapQty: String(wo.scrapQty ?? 0),
    uom: wo.uom,
    dueDate: wo.dueDate,
    plannedStart: wo.startDate ?? null,
    actualStart: wo.startedAt ?? null,
    priority: wo.priority,
    plant: wo.plantName || null,
    jobNumber: null,
    salesOrderNo: wo.salesOrderNo || null,
    customerName: wo.customerName || null,
    supervisor: wo.supervisor ?? null,
    materialStatus: wo.materialStatus,
    qualityStatus: wo.qualityHold ? 'HOLD' : wo.qualityRequired ? 'REQUIRED' : 'NOT_APPLICABLE',
    notes: wo.notes ?? null,
    stages,
    materials,
  }
}

export function WorkOrderPrintPage() {
  const { workOrderId } = useParams<{ workOrderId: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [model, setModel] = useState<WorkOrderPrintModel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!workOrderId) return
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        if (isApiMode()) {
          const [detailRes, materialsRes] = await Promise.all([
            getWorkOrderDetail(workOrderId!),
            listWorkOrderMaterials(workOrderId!).catch(() => ({ data: [] as Awaited<
              ReturnType<typeof listWorkOrderMaterials>
            >['data'] })),
          ])
          if (cancelled) return
          const materials = (materialsRes.data ?? []).map((m) => ({
            code: m.item?.code ?? m.itemId,
            name: m.item?.name ?? '-',
            required: m.requiredQty,
            issued: m.issuedQty,
            uom: m.uom?.code ?? '',
            status: m.status,
          }))
          setModel(mapApiWorkOrder(detailRes.data, materials))
        } else {
          const mapped = await mapDemoWorkOrder(workOrderId!)
          if (!mapped) throw new Error('Work order not found')
          if (!cancelled) setModel(mapped)
        }
      } catch (err) {
        if (!cancelled) {
          setModel(null)
          setError(err instanceof Error ? err.message : 'Could not load work order')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [workOrderId])

  const fileName = useMemo(
    () => (model ? workOrderPdfFileName(model.workOrderNo) : 'WorkOrder.pdf'),
    [model],
  )

  useEffect(() => {
    if (!model || searchParams.get('autoprint') !== '1') return
    printWorkOrderDocument({ fileName })
  }, [model, searchParams, fileName])

  if (loading) return <PageLoadingFallback label="Loading work order…" />

  if (!model) {
    return (
      <div className="erp-page flex flex-col items-center justify-center gap-3 p-12 text-center">
        <p className="text-erp-muted">{error ?? 'Work order not found.'}</p>
        <Link to="/manufacturing/work-orders" className="text-sm font-semibold text-erp-primary hover:underline">
          Back to work orders
        </Link>
      </div>
    )
  }

  const detailPath = `/manufacturing/work-orders/${workOrderId}`

  return (
    <div className="wo-print-page erp-page">
      <div className="wo-print-toolbar no-print">
        <div>
          <p className="wo-print-toolbar__title">{model.workOrderNo}</p>
          <p className="wo-print-toolbar__subtitle">Work order — shop-floor preview &amp; PDF</p>
        </div>
        <ErpButtonGroup>
          <ErpButton
            type="button"
            variant="primary"
            icon={Printer}
            onClick={() => printWorkOrderDocument({ fileName })}
          >
            Print
          </ErpButton>
          <ErpButton
            type="button"
            variant="secondary"
            icon={Download}
            onClick={() => printWorkOrderDocument({ fileName })}
          >
            Download PDF
          </ErpButton>
          <ErpButton type="button" variant="ghost" icon={ArrowLeft} onClick={() => navigate(detailPath)}>
            Back to work order
          </ErpButton>
        </ErpButtonGroup>
      </div>

      <div className="wo-print-stage">
        <WorkOrderPrintDocument model={model} />
      </div>
    </div>
  )
}
