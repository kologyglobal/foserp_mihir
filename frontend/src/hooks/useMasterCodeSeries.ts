import { useCallback, useEffect, useRef, useState } from 'react'
import type { CodeSeriesContext, CodeSeriesEntityType } from '../types/codeSeriesMaster'
import {
  confirmCode,
  releaseReservedCode,
  reserveCode,
} from '../services/codeSeriesService'
import { canCodeSeriesPermission } from '../utils/codeSeriesPermissions'
import { validateMasterCodeBeforeSave, type ValidateMasterCodeOptions } from '../utils/masterCodeValidation'
import { MASTER_CODE_SERIES_MISSING } from '../config/masterCodeSeriesConfig'

export interface UseMasterCodeSeriesOptions {
  isEdit?: boolean
  existingCode?: string
  context?: CodeSeriesContext
}

export interface MasterCodeSeriesHandle {
  reservedCode: string | null
  confirmSaved: (finalCode: string) => void
  releaseOnCancel: () => void
  validateBeforeSave: (code: string, extra?: Omit<ValidateMasterCodeOptions, 'isEdit' | 'existingCode' | 'reservedCode'>) => { ok: boolean; message?: string }
}

export function useMasterCodeSeries(
  entityType: CodeSeriesEntityType,
  options: UseMasterCodeSeriesOptions = {},
) {
  const { isEdit = false, existingCode, context } = options
  const [code, setCode] = useState(existingCode ?? '')
  const [error, setError] = useState<string | null>(null)
  const reservedRef = useRef<string | null>(null)
  const confirmedRef = useRef(false)
  const canManual = canCodeSeriesPermission('codeSeries.manualNumber')

  useEffect(() => {
    confirmedRef.current = false
    if (isEdit) {
      setCode(existingCode ?? '')
      setError(null)
      reservedRef.current = null
      return
    }

    let cancelled = false
    try {
      const reserved = reserveCode(entityType, context)
      if (!cancelled) {
        reservedRef.current = reserved
        setCode(reserved)
        setError(null)
      }
    } catch {
      if (!cancelled) {
        reservedRef.current = null
        setCode('')
        setError(MASTER_CODE_SERIES_MISSING)
      }
    }

    return () => {
      cancelled = true
      if (reservedRef.current && !confirmedRef.current) {
        try {
          releaseReservedCode(entityType, reservedRef.current)
        } catch {
          /* ignore release errors on unmount */
        }
        reservedRef.current = null
      }
    }
  }, [entityType, isEdit, existingCode, context])

  const confirmSaved = useCallback(
    (finalCode: string) => {
      confirmCode(entityType, finalCode.trim())
      confirmedRef.current = true
      reservedRef.current = null
    },
    [entityType],
  )

  const releaseOnCancel = useCallback(() => {
    if (reservedRef.current && !confirmedRef.current) {
      releaseReservedCode(entityType, reservedRef.current)
      reservedRef.current = null
    }
  }, [entityType])

  const validateBeforeSave = useCallback(
    (value: string, extra?: Omit<ValidateMasterCodeOptions, 'isEdit' | 'existingCode' | 'reservedCode'>) =>
      validateMasterCodeBeforeSave(entityType, value, {
        isEdit,
        existingCode,
        reservedCode: reservedRef.current,
        ...extra,
      }),
    [entityType, isEdit, existingCode],
  )

  const handle: MasterCodeSeriesHandle = {
    reservedCode: reservedRef.current,
    confirmSaved,
    releaseOnCancel,
    validateBeforeSave,
  }

  return {
    code,
    setCode,
    error,
    canManual,
    readOnly: isEdit || !canManual,
    confirmSaved,
    releaseOnCancel,
    validateBeforeSave,
    handle,
    reservedCode: reservedRef.current,
  }
}
