import type { CodeSeriesEntityType } from '../types/codeSeriesMaster'
import { useCodeSeriesStore } from '../store/codeSeriesStore'
import { canCodeSeriesPermission } from './codeSeriesPermissions'
import { MASTER_CODE_SERIES_MISSING } from '../config/masterCodeSeriesConfig'

export interface ValidateMasterCodeOptions {
  isEdit?: boolean
  existingCode?: string
  reservedCode?: string | null
  checkDuplicate?: (code: string) => boolean
}

export function validateMasterCodeBeforeSave(
  entityType: CodeSeriesEntityType,
  code: string,
  options: ValidateMasterCodeOptions = {},
): { ok: boolean; message?: string } {
  const trimmed = code?.trim()
  if (!trimmed) return { ok: false, message: 'Code is required.' }

  if (options.isEdit && trimmed === options.existingCode?.trim()) {
    return { ok: true }
  }

  const store = useCodeSeriesStore.getState()
  const series = store.getActiveSeriesByEntity(entityType)
  if (!series) return { ok: false, message: MASTER_CODE_SERIES_MISSING }

  const isManualOverride =
    !options.isEdit &&
    options.reservedCode != null &&
    trimmed !== options.reservedCode

  if (isManualOverride) {
    if (!canCodeSeriesPermission('codeSeries.manualNumber')) {
      return { ok: false, message: 'Manual code entry is not permitted.' }
    }
    if (!series.allowDuplicate && store.isCodeUsed(entityType, trimmed)) {
      return { ok: false, message: 'Duplicate code blocked.' }
    }
  } else if (!options.isEdit) {
    const reservation = store.getReservationByCode(entityType, trimmed)
    if (!reservation || reservation.status !== 'reserved') {
      if (!series.allowDuplicate && store.isCodeUsed(entityType, trimmed)) {
        return { ok: false, message: 'Duplicate code blocked.' }
      }
    }
  }

  if (options.checkDuplicate?.(trimmed)) {
    return { ok: false, message: 'Duplicate code blocked.' }
  }

  return { ok: true }
}
