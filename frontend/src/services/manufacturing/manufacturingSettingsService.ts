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
import { isApiMode } from '../../config/apiConfig'
import {
  getManufacturingSettingsApi,
  putManufacturingSettingsApi,
} from '../api/manufacturingSettingsApi'

const delay = (ms = 50) => new Promise((r) => setTimeout(r, ms))

let settings: ManufacturingSettings = structuredClone(DEFAULT_MANUFACTURING_SETTINGS)
let apiVersion: number | undefined
let apiSettings: ManufacturingSettings | undefined
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
  if (isApiMode()) {
    const response = await getManufacturingSettingsApi()
    apiVersion = response.version
    apiSettings = structuredClone(response.payloadJson)
    return structuredClone(apiSettings)
  }
  await delay()
  return structuredClone(settings)
}

export function isManualMaterialIssueEnabled(): boolean {
  return settings.materialConsumption.manualMaterialIssue
}

export async function updateManufacturingSettings(
  patch: Partial<ManufacturingSettings>,
): Promise<{ ok: boolean; settings: ManufacturingSettings }> {
  if (isApiMode()) {
    const current = apiSettings ?? structuredClone(DEFAULT_MANUFACTURING_SETTINGS)
    const next = {
      ...current,
      ...patch,
      general: { ...current.general, ...patch.general },
      numberSeries: { ...current.numberSeries, ...patch.numberSeries },
      materialConsumption: { ...current.materialConsumption, ...patch.materialConsumption },
      operations: { ...current.operations, ...patch.operations },
      quality: { ...current.quality, ...patch.quality },
      jobWork: { ...current.jobWork, ...patch.jobWork },
      costing: { ...current.costing, ...patch.costing },
      approvals: { ...current.approvals, ...patch.approvals },
      advanced: { ...current.advanced, ...patch.advanced },
    }
    const response = await putManufacturingSettingsApi(next, apiVersion)
    apiVersion = response.version
    apiSettings = structuredClone(response.payloadJson)
    return { ok: true, settings: structuredClone(apiSettings) }
  }
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

/** @deprecated Use updateManufacturingSettings. */
export const updateManufacturingSettingsDemo = updateManufacturingSettings

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

function daysBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`)
  const b = new Date(`${to}T00:00:00`)
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86_400_000))
}

function inDateRange(date: string | undefined, from?: string, to?: string): boolean {
  if (!date) return true
  const d = date.slice(0, 10)
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

export async function getManufacturingReports(
  reportId: ManufacturingReportId,
  filter?: ManufacturingReportFilter,
): Promise<ManufacturingReportResult> {
  await delay()
  const { getWorkOrders, getWorkOrderMaterials } = await import('./workOrderService')
  const { getJobWorkOrders } = await import('./jobWorkService')
  const {
    getWorkOrderListStatus,
    getWorkOrderOwnerLine,
    WO_SOURCE_LABELS,
    WO_LIST_STATUS_LABELS,
  } = await import('../../types/manufacturingWorkOrder')
  const { JW_STATUS_LABELS } = await import('../../types/manufacturingJobWork')

  const today = new Date().toISOString().slice(0, 10)
  const itemQ = (filter?.item || filter?.finishedItem || '').trim().toLowerCase()
  const statusQ = (filter?.status || '').trim().toLowerCase()
  const warehouseQ = (filter?.warehouse || '').trim().toLowerCase()

  let wos = await getWorkOrders({
    search: filter?.workOrder || filter?.finishedItem || filter?.item,
  })

  wos = wos.filter((w) => {
    if (itemQ) {
      const hay = `${w.finishedItemCode} ${w.finishedItemName}`.toLowerCase()
      if (!hay.includes(itemQ)) return false
    }
    if (statusQ && statusQ !== 'all') {
      const list = getWorkOrderListStatus(w)
      if (w.status !== statusQ && list !== statusQ) return false
    }
    if (warehouseQ) {
      const wh = `${w.materialWarehouseName ?? ''} ${w.fgWarehouseName ?? ''}`.toLowerCase()
      if (!wh.includes(warehouseQ)) return false
    }
    const dateRef = w.completedAt?.slice(0, 10) || w.startedAt?.slice(0, 10) || w.dueDate || w.createdAt.slice(0, 10)
    if (!inDateRange(dateRef, filter?.dateFrom, filter?.dateTo)) return false
    return true
  })

  let jwos = await getJobWorkOrders({
    search: filter?.jobWorkOrder || filter?.vendor,
  })
  jwos = jwos.filter((j) => {
    if (statusQ && statusQ !== 'all' && j.status !== statusQ) return false
    if (!inDateRange(j.expectedReturnDate, filter?.dateFrom, filter?.dateTo)
      && !inDateRange(j.materialSentDate, filter?.dateFrom, filter?.dateTo)
      && !inDateRange(j.createdAt.slice(0, 10), filter?.dateFrom, filter?.dateTo)) {
      return false
    }
    return true
  })

  let columns: string[] = []
  let rows: ManufacturingReportResult['rows'] = []

  switch (reportId) {
    case 'work_order_status': {
      columns = ['WO No', 'Item', 'Source', 'Planned Qty', 'Completed Qty', 'Pending Qty', 'Due Date', 'Status', 'Delay Days']
      rows = wos.map((w) => {
        const listStatus = getWorkOrderListStatus(w)
        const open = !['closed', 'cancelled'].includes(w.status)
        const delayDays = open && w.dueDate < today ? daysBetween(w.dueDate, today) : 0
        return {
          id: w.id,
          cells: {
            'WO No': w.woNumber,
            Item: `${w.finishedItemCode} — ${w.finishedItemName}`,
            Source: WO_SOURCE_LABELS[w.source],
            'Planned Qty': w.plannedQty,
            'Completed Qty': w.producedQty,
            'Pending Qty': w.remainingQty,
            'Due Date': w.dueDate,
            Status: WO_LIST_STATUS_LABELS[listStatus] ?? w.status,
            'Delay Days': delayDays,
          },
        }
      })
      break
    }
    case 'daily_production': {
      columns = ['Date', 'WO No', 'Item', 'Planned Qty', 'Good Qty', 'Scrap Qty', 'Rework Qty', 'Reject Qty', 'Operator / Line', 'Status']
      rows = wos.map((w) => {
        const listStatus = getWorkOrderListStatus(w)
        const date = (w.completedAt || w.startedAt || w.createdAt).slice(0, 10)
        return {
          id: w.id,
          cells: {
            Date: date,
            'WO No': w.woNumber,
            Item: `${w.finishedItemCode} — ${w.finishedItemName}`,
            'Planned Qty': w.plannedQty,
            'Good Qty': w.producedQty,
            'Scrap Qty': w.scrapQty,
            'Rework Qty': w.reworkQty,
            'Reject Qty': w.rejectedQty,
            'Operator / Line': getWorkOrderOwnerLine(w),
            Status: WO_LIST_STATUS_LABELS[listStatus] ?? w.status,
          },
        }
      })
      break
    }
    case 'material_consumption': {
      columns = ['WO No', 'Raw Material', 'Required Qty', 'Consumed Qty', 'Variance', 'Warehouse']
      const materialRows: ManufacturingReportResult['rows'] = []
      for (const w of wos) {
        const mats = await getWorkOrderMaterials(w.id)
        for (const m of mats) {
          if (warehouseQ && !(m.warehouseName ?? '').toLowerCase().includes(warehouseQ)) continue
          const variance = Math.round((m.consumedQty - m.requiredQty) * 1000) / 1000
          materialRows.push({
            id: `${w.id}-${m.id}`,
            cells: {
              'WO No': w.woNumber,
              'Raw Material': `${m.componentItemCode} — ${m.componentItemName}`,
              'Required Qty': m.requiredQty,
              'Consumed Qty': m.consumedQty,
              Variance: variance,
              Warehouse: m.warehouseName || w.materialWarehouseName || '—',
            },
          })
        }
      }
      rows = materialRows
      break
    }
    case 'scrap_rework': {
      columns = ['WO No', 'Item', 'Good Qty', 'Scrap Qty', 'Rework Qty', 'Reject Qty', 'Operator / Line', 'Status']
      rows = wos
        .filter((w) => w.scrapQty > 0 || w.reworkQty > 0 || w.rejectedQty > 0)
        .map((w) => ({
          id: w.id,
          cells: {
            'WO No': w.woNumber,
            Item: `${w.finishedItemCode} — ${w.finishedItemName}`,
            'Good Qty': w.producedQty,
            'Scrap Qty': w.scrapQty,
            'Rework Qty': w.reworkQty,
            'Reject Qty': w.rejectedQty,
            'Operator / Line': getWorkOrderOwnerLine(w),
            Status: WO_LIST_STATUS_LABELS[getWorkOrderListStatus(w)] ?? w.status,
          },
        }))
      break
    }
    case 'qc_pending': {
      columns = ['WO No', 'Item', 'Good Qty', 'QC Status', 'Due Date', 'Operator / Line', 'Status']
      rows = wos
        .filter((w) => {
          const list = getWorkOrderListStatus(w)
          return w.qualityHold || list === 'qc_pending' || list === 'qc_hold'
        })
        .map((w) => ({
          id: w.id,
          cells: {
            'WO No': w.woNumber,
            Item: `${w.finishedItemCode} — ${w.finishedItemName}`,
            'Good Qty': w.producedQty,
            'QC Status': w.qualityHold ? 'Pending / Hold' : 'Required',
            'Due Date': w.dueDate,
            'Operator / Line': getWorkOrderOwnerLine(w),
            Status: WO_LIST_STATUS_LABELS[getWorkOrderListStatus(w)] ?? w.status,
          },
        }))
      break
    }
    case 'job_work_pending': {
      columns = ['Job Work No', 'Linked WO', 'Vendor', 'Process', 'Sent Qty', 'Received Qty', 'Balance Qty', 'Expected Return', 'Status']
      rows = jwos
        .filter((j) => !['closed', 'cancelled', 'received'].includes(j.status))
        .map((j) => ({
          id: j.id,
          cells: {
            'Job Work No': j.jwNumber,
            'Linked WO': j.workOrderNo,
            Vendor: j.vendorName,
            Process: j.process,
            'Sent Qty': j.sentQty,
            'Received Qty': j.receivedQty,
            'Balance Qty': j.pendingQty,
            'Expected Return': j.expectedReturnDate,
            Status: JW_STATUS_LABELS[j.status],
          },
        }))
      break
    }
    case 'delayed_work_orders': {
      columns = ['WO No', 'Item', 'Source', 'Planned Qty', 'Completed Qty', 'Pending Qty', 'Due Date', 'Status', 'Delay Days']
      rows = wos
        .filter((w) => !['closed', 'cancelled'].includes(w.status) && w.dueDate < today)
        .map((w) => ({
          id: w.id,
          cells: {
            'WO No': w.woNumber,
            Item: `${w.finishedItemCode} — ${w.finishedItemName}`,
            Source: WO_SOURCE_LABELS[w.source],
            'Planned Qty': w.plannedQty,
            'Completed Qty': w.producedQty,
            'Pending Qty': w.remainingQty,
            'Due Date': w.dueDate,
            Status: WO_LIST_STATUS_LABELS[getWorkOrderListStatus(w)] ?? w.status,
            'Delay Days': daysBetween(w.dueDate, today),
          },
        }))
      break
    }
    case 'production_efficiency': {
      columns = ['WO No', 'Item', 'Planned Qty', 'Good Qty', 'Scrap Qty', 'Yield %', 'Efficiency %', 'Operator / Line', 'Status']
      rows = wos.map((w) => {
        const output = w.producedQty + w.scrapQty + w.rejectedQty + w.reworkQty
        const yieldPct = output > 0 ? Math.round((w.producedQty / output) * 1000) / 10 : 0
        const efficiencyPct = w.plannedQty > 0 ? Math.round((w.producedQty / w.plannedQty) * 1000) / 10 : 0
        return {
          id: w.id,
          cells: {
            'WO No': w.woNumber,
            Item: `${w.finishedItemCode} — ${w.finishedItemName}`,
            'Planned Qty': w.plannedQty,
            'Good Qty': w.producedQty,
            'Scrap Qty': w.scrapQty,
            'Yield %': yieldPct,
            'Efficiency %': efficiencyPct,
            'Operator / Line': getWorkOrderOwnerLine(w),
            Status: WO_LIST_STATUS_LABELS[getWorkOrderListStatus(w)] ?? w.status,
          },
        }
      })
      break
    }
    default:
      columns = ['WO No', 'Item', 'Status']
      rows = wos.map((w) => ({
        id: w.id,
        cells: { 'WO No': w.woNumber, Item: w.finishedItemCode, Status: w.status },
      }))
  }

  return { reportId, columns, rows, generatedAt: new Date().toISOString() }
}

export async function exportManufacturingReport(
  reportId: ManufacturingReportId,
  format: 'excel' | 'csv' | 'pdf',
  filter?: ManufacturingReportFilter,
): Promise<{ ok: boolean; fileName: string; csv?: string }> {
  await delay()
  const result = await getManufacturingReports(reportId, filter)
  const header = result.columns.join(',')
  const body = result.rows
    .map((row) =>
      result.columns
        .map((col) => {
          const raw = row.cells[col]
          const text = raw == null ? '' : String(raw)
          return `"${text.replace(/"/g, '""')}"`
        })
        .join(','),
    )
    .join('\n')
  const csv = `${header}\n${body}`
  const fileName = `${reportId}-${result.generatedAt.slice(0, 10)}.${format === 'excel' ? 'csv' : format === 'pdf' ? 'csv' : 'csv'}`
  return { ok: true, fileName, csv }
}

export async function getManufacturingPrintPreview(
  reportId: ManufacturingReportId,
  filter?: ManufacturingReportFilter,
): Promise<{ ok: boolean; html: string; title: string }> {
  await delay()
  const def = MANUFACTURING_REPORTS.find((r) => r.id === reportId)
  const result = await getManufacturingReports(reportId, filter)
  const title = def?.label ?? reportId
  const head = result.columns.map((c) => `<th>${c}</th>`).join('')
  const body = result.rows
    .map(
      (row) =>
        `<tr>${result.columns.map((c) => `<td>${row.cells[c] ?? ''}</td>`).join('')}</tr>`,
    )
    .join('')
  return {
    ok: true,
    title,
    html: `<h1>${title}</h1><p>${result.rows.length} rows · ${result.generatedAt}</p><table border="1" cellpadding="4" cellspacing="0"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`,
  }
}
