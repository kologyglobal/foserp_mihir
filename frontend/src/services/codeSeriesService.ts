import type { CodeSeries, CodeSeriesContext, CodeSeriesEntityType } from '../types/codeSeriesMaster'
import { useCodeSeriesStore } from '../store/codeSeriesStore'
import {
  buildCodeFromSeries,
  getCalendarYear,
  getFinancialYear,
  getMonthToken,
  previewFormat,
} from '../utils/codeSeriesFormat'
import { getSessionUser } from '../utils/permissions'
import { assertCodeSeriesPermission } from '../utils/codeSeriesPermissions'

export type CodeGenerationMode = 'immediate' | 'reserve' | 'preview'

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function computeNextResetDate(series: CodeSeries, from = new Date()): string | undefined {
  switch (series.resetFrequency) {
    case 'daily': {
      const d = new Date(from)
      d.setDate(d.getDate() + 1)
      return d.toISOString().slice(0, 10)
    }
    case 'monthly': {
      const d = new Date(from.getFullYear(), from.getMonth() + 1, 1)
      return d.toISOString().slice(0, 10)
    }
    case 'financial_year':
      return `${Number(getFinancialYear(from)) + 1}-04-01`
    case 'calendar_year':
      return `${from.getFullYear() + 1}-01-01`
    default:
      return undefined
  }
}

function shouldResetSeries(series: CodeSeries, date = new Date()): boolean {
  const today = date.toISOString().slice(0, 10)
  switch (series.resetFrequency) {
    case 'never':
      return false
    case 'daily':
      return series.lastResetDate !== today
    case 'monthly':
      return !series.lastResetDate || series.lastResetDate.slice(0, 7) !== today.slice(0, 7)
    case 'financial_year': {
      const fy = getFinancialYear(date)
      return !series.lastResetDate || !series.lastResetDate.startsWith(String(fy))
    }
    case 'calendar_year':
      return !series.lastResetDate || !series.lastResetDate.startsWith(getCalendarYear(date))
    default:
      return false
  }
}

export function resetSeriesIfRequired(entityType: CodeSeriesEntityType): void {
  const store = useCodeSeriesStore.getState()
  const series = store.getActiveSeriesByEntity(entityType)
  if (!series || !shouldResetSeries(series)) return
  const ts = todayIso()
  store.updateSeries(series.id, {
    currentNumber: series.startingNumber - 1,
    lastResetDate: ts,
    nextResetDate: computeNextResetDate(series),
  })
}

function resolveContext(series: CodeSeries, context: CodeSeriesContext = {}): CodeSeriesContext {
  const now = new Date()
  return {
    ...context,
    financialYear: context.financialYear ?? (series.financialYearRequired ? getFinancialYear(now) : undefined),
    month: context.month ?? (series.monthRequired ? getMonthToken(now) : undefined),
  }
}

function maxRunningFromExisting(series: CodeSeries, existingNumbers?: string[]): number {
  if (!existingNumbers?.length) return 0
  const len = series.runningNumberLength
  const re = new RegExp(`(\\d{${len}})$`)
  let max = 0
  for (const code of existingNumbers) {
    const match = code.match(re)
    if (!match) continue
    const n = parseInt(match[1]!, 10)
    if (!Number.isNaN(n)) max = Math.max(max, n)
  }
  return max
}

function isCodeCollision(
  entityType: CodeSeriesEntityType,
  series: CodeSeries,
  code: string,
  context: CodeSeriesContext,
): boolean {
  const store = useCodeSeriesStore.getState()
  if (!series.allowDuplicate && store.isCodeUsed(entityType, code)) return true
  return Boolean(context.existingNumbers?.includes(code))
}

function nextRunningNumber(series: CodeSeries, context: CodeSeriesContext = {}): number {
  const store = useCodeSeriesStore.getState()
  const reservedMax = store.reservations
    .filter((r) => r.seriesId === series.id && r.status === 'reserved')
    .reduce((m, r) => Math.max(m, r.runningNumber), 0)
  const existingMax = maxRunningFromExisting(series, context.existingNumbers)
  const base = Math.max(series.currentNumber, series.startingNumber - 1, reservedMax, existingMax)
  return base + series.incrementBy
}

function validateSeriesContext(series: CodeSeries, context: CodeSeriesContext) {
  if (series.branchRequired && !context.branchCode) {
    throw new Error(`Branch code required for ${series.seriesCode}`)
  }
  if (series.departmentRequired && !context.departmentCode) {
    throw new Error(`Department code required for ${series.seriesCode}`)
  }
  if (series.locationRequired && !context.locationCode) {
    throw new Error(`Location code required for ${series.seriesCode}`)
  }
}

export function previewNextCode(entityType: CodeSeriesEntityType, context: CodeSeriesContext = {}): string {
  resetSeriesIfRequired(entityType)
  const series = useCodeSeriesStore.getState().getActiveSeriesByEntity(entityType)
  if (!series) throw new Error(`No active code series for ${entityType}`)
  const ctx = resolveContext(series, context)
  validateSeriesContext(series, ctx)
  return previewFormat(series, ctx)
}

export function reserveCode(entityType: CodeSeriesEntityType, context: CodeSeriesContext = {}): string {
  resetSeriesIfRequired(entityType)
  const store = useCodeSeriesStore.getState()
  const series = store.getActiveSeriesByEntity(entityType)
  if (!series) throw new Error(`No active code series for ${entityType}`)

  const ctx = resolveContext(series, context)
  validateSeriesContext(series, ctx)

  let runningNumber = nextRunningNumber(series, ctx)
  let code = buildCodeFromSeries(series, runningNumber, ctx)
  let guard = 0
  while (isCodeCollision(entityType, series, code, ctx) && guard < 1000) {
    runningNumber += series.incrementBy
    code = buildCodeFromSeries(series, runningNumber, ctx)
    guard++
  }
  if (isCodeCollision(entityType, series, code, ctx)) {
    throw new Error(`Unable to allocate unique code for ${entityType}`)
  }

  store.addReservation({
    seriesId: series.id,
    entityType,
    code,
    runningNumber,
    status: 'reserved',
    reservedAt: new Date().toISOString(),
    posted: context.posted ?? false,
  })

  return code
}

export function confirmCode(entityType: CodeSeriesEntityType, code: string): void {
  const store = useCodeSeriesStore.getState()
  const series = store.getActiveSeriesByEntity(entityType)
  if (!series) throw new Error(`No active code series for ${entityType}`)

  const reservation = store.getReservationByCode(entityType, code)
  const ts = new Date().toISOString()

  if (reservation) {
    if (reservation.posted && series.lockAfterPosting) {
      throw new Error(`Posted code cannot be re-confirmed: ${code}`)
    }
    store.updateReservation(reservation.id, {
      status: 'confirmed',
      confirmedAt: ts,
    })
    store.updateSeries(series.id, {
      currentNumber: Math.max(series.currentNumber, reservation.runningNumber),
      lastUsedNumber: reservation.runningNumber,
      lastUsedDate: ts.slice(0, 10),
    })
  } else if (!series.allowDuplicate && store.isCodeUsed(entityType, code)) {
    throw new Error(`Duplicate confirmed code: ${code}`)
  }

  store.trackConfirmedCode(entityType, code)
  store.pushAudit({
    seriesId: series.id,
    action: 'confirmed',
    at: ts,
    by: getSessionUser().name,
    detail: code,
  })
}

export function releaseReservedCode(entityType: CodeSeriesEntityType, code: string): void {
  const store = useCodeSeriesStore.getState()
  const reservation = store.getReservationByCode(entityType, code)
  if (!reservation) return
  if (reservation.posted) throw new Error(`Posted code cannot be released: ${code}`)

  store.updateReservation(reservation.id, {
    status: 'released',
    releasedAt: new Date().toISOString(),
  })
  store.pushAudit({
    seriesId: reservation.seriesId,
    action: 'released',
    at: new Date().toISOString(),
    by: getSessionUser().name,
    detail: code,
  })
}

export function getNextCode(
  entityType: CodeSeriesEntityType,
  context: CodeSeriesContext = {},
  mode: CodeGenerationMode = 'immediate',
): string {
  if (mode === 'preview') return previewNextCode(entityType, context)
  const code = reserveCode(entityType, context)
  if (mode === 'immediate') confirmCode(entityType, code)
  return code
}

export function validateManualCode(entityType: CodeSeriesEntityType, code: string): { ok: boolean; message?: string } {
  const store = useCodeSeriesStore.getState()
  const series = store.getActiveSeriesByEntity(entityType)
  if (!series) return { ok: false, message: 'No active series' }
  if (!series.allowManualNumber) return { ok: false, message: 'Manual numbers not allowed' }
  if (!code.trim()) return { ok: false, message: 'Code required' }
  if (!series.allowDuplicate && store.isCodeUsed(entityType, code.trim())) {
    return { ok: false, message: 'Code already used' }
  }
  return { ok: true }
}

export function validateUniqueActiveEntity(entityType: CodeSeriesEntityType, excludeId?: string): boolean {
  const active = useCodeSeriesStore.getState().series.filter(
    (s) => s.entityType === entityType && s.isActive && s.id !== excludeId,
  )
  return active.length === 0
}

export function adminResetSeries(seriesId: string, reason: string): void {
  assertCodeSeriesPermission('codeSeries.reset')
  useCodeSeriesStore.getState().resetSeries(seriesId, getSessionUser().name, reason)
}

/** Legacy prefix bridge — maps old nextDocumentNo prefixes to entity types */
export const LEGACY_PREFIX_ENTITY_MAP: Record<string, CodeSeriesEntityType> = {
  'LEAD-': 'lead',
  'INQ-': 'inquiry',
  'QUO-': 'quotation',
  OPP: 'opportunity',
  'SO-': 'sales_order',
  'PR-': 'purchase_requisition',
  'RFQ-': 'rfq',
  'PO-': 'purchase_order',
  'GRN-': 'grn',
  'VQ-': 'vendor_quotation',
  'PRET-': 'purchase_return',
  'PI-': 'proforma_invoice',
  'ECR-': 'ecr',
  'ECO-': 'eco',
  'QC-': 'qc_inspection',
  'GP-': 'gate_pass',
  'DOC-': 'document',
  'BC-': 'barcode',
  'QR-': 'qr',
}

export function entityTypeFromLegacyPrefix(prefix: string): CodeSeriesEntityType | undefined {
  return LEGACY_PREFIX_ENTITY_MAP[prefix]
}

export { previewFormat }
