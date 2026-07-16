/**
 * Manufacturing settings, reports, saved views (Phase 4).
 * Backend authorization must enforce the same permission rules.
 */

import {
  DEFAULT_MANUFACTURING_SETTINGS,
  MANUFACTURING_REPORTS,
  type ManufacturingReportFilter,
  type ManufacturingReportId,
  type ManufacturingReportResult,
  type ManufacturingSavedView,
  type ManufacturingSettings,
} from '../../types/manufacturingSettings'

const delay = (ms = 50) => new Promise((r) => setTimeout(r, ms))

let settings: ManufacturingSettings = structuredClone(DEFAULT_MANUFACTURING_SETTINGS)
let savedViews: ManufacturingSavedView[] = [
  {
    id: 'view-wo-open',
    name: 'Open Work Orders',
    scope: 'work_orders',
    filterJson: JSON.stringify({ tab: 'in_progress' }),
    createdAt: new Date().toISOString(),
    createdBy: 'Demo User',
  },
]

export async function getManufacturingSettings(): Promise<ManufacturingSettings> {
  await delay()
  return structuredClone(settings)
}

export function isManualMaterialIssueEnabled(): boolean {
  return settings.materialConsumption.manualMaterialIssue
}

export async function updateManufacturingSettingsDemo(
  patch: Partial<ManufacturingSettings>,
): Promise<{ ok: boolean; settings: ManufacturingSettings }> {
  await delay()
  settings = {
    ...settings,
    ...patch,
    general: { ...settings.general, ...patch.general },
    numberSeries: { ...settings.numberSeries, ...patch.numberSeries },
    materialConsumption: { ...settings.materialConsumption, ...patch.materialConsumption },
    operations: { ...settings.operations, ...patch.operations },
    quality: { ...settings.quality, ...patch.quality },
    jobWork: { ...settings.jobWork, ...patch.jobWork },
    costing: { ...settings.costing, ...patch.costing },
    approvals: { ...settings.approvals, ...patch.approvals },
    advanced: { ...settings.advanced, ...patch.advanced },
  }
  return { ok: true, settings: structuredClone(settings) }
}

export async function getManufacturingSavedViews(
  scope?: ManufacturingSavedView['scope'],
): Promise<ManufacturingSavedView[]> {
  await delay()
  return savedViews.filter((v) => !scope || v.scope === scope).map((v) => structuredClone(v))
}

export async function saveManufacturingView(
  input: Omit<ManufacturingSavedView, 'id' | 'createdAt' | 'createdBy'>,
): Promise<{ ok: boolean; view: ManufacturingSavedView }> {
  await delay()
  const view: ManufacturingSavedView = {
    ...input,
    id: `view-${crypto.randomUUID().slice(0, 8)}`,
    createdAt: new Date().toISOString(),
    createdBy: 'Demo User',
  }
  savedViews = [view, ...savedViews]
  return { ok: true, view: structuredClone(view) }
}

export async function deleteManufacturingView(id: string): Promise<{ ok: boolean }> {
  await delay()
  savedViews = savedViews.filter((v) => v.id !== id)
  return { ok: true }
}

export function listManufacturingReportDefinitions() {
  return MANUFACTURING_REPORTS
}

export async function getManufacturingReports(
  reportId: ManufacturingReportId,
  filter?: ManufacturingReportFilter,
): Promise<ManufacturingReportResult> {
  await delay()
  const { getWorkOrders } = await import('./workOrderService')
  const { getJobWorkOrders } = await import('./jobWorkService')
  const wos = await getWorkOrders({
    search: filter?.workOrder || filter?.finishedItem,
    status: (filter?.status as never) || undefined,
  })
  const jwos = await getJobWorkOrders({
    search: filter?.jobWorkOrder || filter?.vendor,
  })

  const costReports = new Set(
    MANUFACTURING_REPORTS.filter((r) => r.requiresCostPermission).map((r) => r.id),
  )

  let columns: string[] = []
  let rows: ManufacturingReportResult['rows'] = []

  switch (reportId) {
    case 'work_order_register':
    case 'production_status':
    case 'production_delay':
    case 'work_in_progress':
      columns = ['Work Order', 'Item', 'Planned', 'Produced', 'Status', 'Due Date']
      rows = wos.map((w) => ({
        id: w.id,
        cells: {
          'Work Order': w.woNumber,
          Item: w.finishedItemCode,
          Planned: w.plannedQty,
          Produced: w.producedQty,
          Status: w.status,
          'Due Date': w.dueDate,
        },
      }))
      break
    case 'production_output':
    case 'finished_goods_output':
      columns = ['Work Order', 'Item', 'Good Qty', 'Rejected', 'Scrap', 'Rework']
      rows = wos.map((w) => ({
        id: w.id,
        cells: {
          'Work Order': w.woNumber,
          Item: w.finishedItemCode,
          'Good Qty': w.producedQty,
          Rejected: w.rejectedQty,
          Scrap: w.scrapQty,
          Rework: w.reworkQty,
        },
      }))
      break
    case 'material_shortage':
      columns = ['Work Order', 'Item', 'Material Status']
      rows = wos
        .filter((w) => w.materialStatus === 'shortage' || w.materialStatus === 'partial')
        .map((w) => ({
          id: w.id,
          cells: {
            'Work Order': w.woNumber,
            Item: w.finishedItemCode,
            'Material Status': w.materialStatus,
          },
        }))
      break
    case 'scrap_and_rejection':
      columns = ['Work Order', 'Scrap', 'Rejected']
      rows = wos
        .filter((w) => w.scrapQty > 0 || w.rejectedQty > 0)
        .map((w) => ({
          id: w.id,
          cells: { 'Work Order': w.woNumber, Scrap: w.scrapQty, Rejected: w.rejectedQty },
        }))
      break
    case 'job_work_register':
    case 'job_work_ageing':
    case 'material_sent_to_vendor':
    case 'material_with_vendor':
    case 'job_work_receipt':
    case 'job_work_reconciliation':
    case 'vendor_invoice_link_status':
      columns = ['Job Work', 'Work Order', 'Vendor', 'Ordered', 'Received', 'Status', 'Invoice']
      rows = jwos.map((j) => ({
        id: j.id,
        cells: {
          'Job Work': j.jwNumber,
          'Work Order': j.workOrderNo,
          Vendor: j.vendorName,
          Ordered: j.orderedQty,
          Received: j.receivedQty,
          Status: j.status,
          Invoice: j.invoiceStatus,
        },
      }))
      break
    case 'production_cost_summary':
    case 'production_variance':
    case 'job_work_cost':
      columns = ['Document', 'Item', 'Qty', 'Est. Cost']
      rows = (costReports.has(reportId) ? wos : wos).map((w) => ({
        id: w.id,
        cells: {
          Document: w.woNumber,
          Item: w.finishedItemCode,
          Qty: w.producedQty,
          'Est. Cost': w.producedQty * 28000,
        },
      }))
      break
    default:
      columns = ['Work Order', 'Item', 'Status']
      rows = wos.map((w) => ({
        id: w.id,
        cells: { 'Work Order': w.woNumber, Item: w.finishedItemCode, Status: w.status },
      }))
  }

  return { reportId, columns, rows, generatedAt: new Date().toISOString() }
}

export async function exportManufacturingReport(
  reportId: ManufacturingReportId,
  format: 'excel' | 'csv' | 'pdf',
  filter?: ManufacturingReportFilter,
): Promise<{ ok: boolean; fileName: string }> {
  await delay()
  const result = await getManufacturingReports(reportId, filter)
  return {
    ok: true,
    fileName: `${reportId}-${result.generatedAt.slice(0, 10)}.${format === 'excel' ? 'xlsx' : format}`,
  }
}

export async function getManufacturingPrintPreview(
  reportId: ManufacturingReportId,
): Promise<{ ok: boolean; html: string }> {
  await delay()
  const result = await getManufacturingReports(reportId)
  return {
    ok: true,
    html: `<h1>${reportId}</h1><p>${result.rows.length} rows · ${result.generatedAt}</p>`,
  }
}
