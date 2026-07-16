import type { QcInspection } from '../types/quality'
import type { QcParameterResult } from '../types/qcParameters'

export interface ProcessWiseQcRow {
  operationName: string
  planCode: string
  inspectionNo: string
  woNo: string | null
  result: string
  passCount: number
  failCount: number
  inspectionDate: string | null
}

export interface ParameterFailureTrendRow {
  parameterCode: string
  parameterName: string
  failureCount: number
  inspectionCount: number
  failureRatePct: number
}

export interface DefectReportRow {
  inspectionNo: string
  woNo: string | null
  parameterName: string
  actualValue: string
  severity: string
  inspectionDate: string | null
}

export interface VendorIncomingRejectionRow {
  vendorId: string
  vendorName: string
  itemCode: string
  inspectionNo: string
  rejectedParameter: string
  inspectionDate: string | null
}

export interface FinalQcChecklistRow {
  inspectionNo: string
  woNo: string | null
  parameterName: string
  passed: boolean
  inspector: string | null
  inspectionDate: string | null
}

function fmtValue(v: QcParameterResult['actualValue']): string {
  if (v === null || v === undefined) return '—'
  return String(v)
}

export function getProcessWiseQcReport(inspections: QcInspection[]): ProcessWiseQcRow[] {
  return inspections
    .filter((i) => i.category === 'in_process' && i.parameterResults.length > 0)
    .map((i) => ({
      operationName: i.operationName,
      planCode: i.planId ?? '—',
      inspectionNo: i.inspectionNo,
      woNo: i.woNo,
      result: i.result ?? i.status,
      passCount: i.parameterResults.filter((p) => p.passed === true).length,
      failCount: i.parameterResults.filter((p) => p.passed === false).length,
      inspectionDate: i.inspectionDate,
    }))
}

export function getParameterFailureTrendReport(inspections: QcInspection[]): ParameterFailureTrendRow[] {
  const map = new Map<string, { name: string; failures: number; total: number }>()
  for (const i of inspections) {
    for (const p of i.parameterResults) {
      const row = map.get(p.parameterCode) ?? { name: p.parameterName, failures: 0, total: 0 }
      row.total += 1
      if (p.passed === false) row.failures += 1
      map.set(p.parameterCode, row)
    }
  }
  return [...map.entries()]
    .map(([parameterCode, v]) => ({
      parameterCode,
      parameterName: v.name,
      failureCount: v.failures,
      inspectionCount: v.total,
      failureRatePct: v.total > 0 ? Math.round((v.failures / v.total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.failureCount - a.failureCount)
}

function defectRowsForPlan(inspections: QcInspection[], planId: string): DefectReportRow[] {
  return inspections
    .flatMap((i) =>
      i.planId === planId
        ? i.parameterResults
            .filter((p) => p.passed === false)
            .map((p) => ({
              inspectionNo: i.inspectionNo,
              woNo: i.woNo,
              parameterName: p.parameterName,
              actualValue: fmtValue(p.actualValue),
              severity: p.severity,
              inspectionDate: i.inspectionDate,
            }))
        : [],
    )
}

export function getWeldingDefectReport(inspections: QcInspection[]) {
  return defectRowsForPlan(inspections, 'plan-welding-bulker')
}

export function getPaintingDefectReport(inspections: QcInspection[]) {
  return defectRowsForPlan(inspections, 'plan-painting-bulker')
}

export function getPressureTestReport(inspections: QcInspection[]) {
  return defectRowsForPlan(inspections, 'plan-pressure-test')
}

export function getSubcontractReturnQcReport(inspections: QcInspection[]) {
  return inspections
    .filter((i) => i.category === 'subcontract_return' && i.parameterResults.length > 0)
    .flatMap((i) =>
      i.parameterResults.map((p) => ({
        inspectionNo: i.inspectionNo,
        woNo: i.woNo,
        itemCode: i.itemCode ?? '—',
        parameterName: p.parameterName,
        actualValue: fmtValue(p.actualValue),
        passed: p.passed === true,
        severity: p.severity,
        inspectionDate: i.inspectionDate,
      })),
    )
}

export function getVendorIncomingRejectionReport(
  inspections: QcInspection[],
  vendorNameLookup: (vendorId: string) => string,
): VendorIncomingRejectionRow[] {
  return inspections
    .filter((i) => i.category === 'incoming' && (i.result === 'reject' || i.status === 'reject'))
    .flatMap((i) =>
      i.parameterResults
        .filter((p) => p.passed === false)
        .map((p) => ({
          vendorId: i.vendorId ?? '—',
          vendorName: i.vendorId ? vendorNameLookup(i.vendorId) : '—',
          itemCode: i.itemCode ?? '—',
          inspectionNo: i.inspectionNo,
          rejectedParameter: p.parameterName,
          inspectionDate: i.inspectionDate,
        })),
    )
}

export function getFinalQcChecklistReport(inspections: QcInspection[]): FinalQcChecklistRow[] {
  return inspections
    .filter((i) => i.category === 'final')
    .flatMap((i) => {
      const params = i.parameterResults.length
        ? i.parameterResults.map((p) => ({
            inspectionNo: i.inspectionNo,
            woNo: i.woNo,
            parameterName: p.parameterName,
            passed: p.passed === true,
            inspector: p.inspector ?? i.inspector,
            inspectionDate: i.inspectionDate,
          }))
        : i.checklistSnapshot.map((c) => ({
            inspectionNo: i.inspectionNo,
            woNo: i.woNo,
            parameterName: c.label,
            passed: c.passed,
            inspector: i.inspector,
            inspectionDate: i.inspectionDate,
          }))
      return params
    })
}
