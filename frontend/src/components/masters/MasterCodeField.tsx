import { useEffect, useRef } from 'react'
import type { CodeSeriesContext, CodeSeriesEntityType } from '../../types/codeSeriesMaster'
import { FormField } from '../forms/FormField'
import { Input } from '../forms/Inputs'
import { useMasterCodeSeries, type MasterCodeSeriesHandle } from '../../hooks/useMasterCodeSeries'
import { MASTER_CODE_HELPER_TEXT } from '../../config/masterCodeSeriesConfig'
import { cn } from '../../utils/cn'

export interface MasterCodeFieldProps {
  entityType: CodeSeriesEntityType
  value: string
  onChange: (code: string) => void
  isEdit?: boolean
  existingCode?: string
  context?: CodeSeriesContext
  label?: string
  required?: boolean
  error?: string
  className?: string
  placeholder?: string
  onSeriesReady?: (handle: MasterCodeSeriesHandle) => void
}

export function MasterCodeField({
  entityType,
  value,
  onChange,
  isEdit = false,
  existingCode,
  context,
  label = 'Code',
  required,
  error,
  className,
  placeholder,
  onSeriesReady,
}: MasterCodeFieldProps) {
  const series = useMasterCodeSeries(entityType, { isEdit, existingCode, context })
  const readyRef = useRef(onSeriesReady)
  readyRef.current = onSeriesReady

  useEffect(() => {
    readyRef.current?.(series.handle)
  }, [series.handle])

  useEffect(() => {
    if (!isEdit && series.code && series.code !== value) {
      onChange(series.code)
    }
  }, [series.code, isEdit, onChange, value])

  const displayError = error ?? series.error ?? undefined
  const readOnly = series.readOnly

  return (
    <FormField
      label={label}
      required={required}
      error={displayError}
      hint={!isEdit && !displayError ? MASTER_CODE_HELPER_TEXT : undefined}
      className={className}
    >
      <Input
        value={value}
        onChange={(e) => {
          if (readOnly) return
          onChange(e.target.value)
        }}
        readOnly={readOnly}
        disabled={isEdit}
        placeholder={placeholder}
        className={cn('font-mono', readOnly && 'bg-erp-surface-alt/60')}
        aria-readonly={readOnly}
      />
    </FormField>
  )
}
