import { useCallback, useMemo, useState } from 'react'

export type FieldValidationState = 'idle' | 'error' | 'success'

export interface FieldRule {
  required?: boolean
  message?: string
  validate?: (value: unknown) => string | null
}

export function useInlineFormValidation<T extends Record<string, unknown>>(
  values: T,
  rules: Partial<Record<keyof T, FieldRule>>,
) {
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({})

  const touch = useCallback((field: keyof T) => {
    setTouched((prev) => ({ ...prev, [field]: true }))
  }, [])

  const touchAll = useCallback(() => {
    const all = Object.keys(rules).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {} as Partial<Record<keyof T, boolean>>,
    )
    setTouched(all)
  }, [rules])

  const fieldErrors = useMemo(() => {
    const errors: Partial<Record<keyof T, string>> = {}
    for (const key of Object.keys(rules) as (keyof T)[]) {
      const rule = rules[key]
      if (!rule) continue
      const value = values[key]
      const empty =
        value === null ||
        value === undefined ||
        value === '' ||
        (typeof value === 'number' && Number.isNaN(value))

      if (rule.required && empty) {
        errors[key] = rule.message ?? 'Required'
        continue
      }
      if (rule.validate) {
        const msg = rule.validate(value)
        if (msg) errors[key] = msg
      }
    }
    return errors
  }, [values, rules])

  function fieldState(field: keyof T): FieldValidationState {
    if (!touched[field]) return 'idle'
    return fieldErrors[field] ? 'error' : 'success'
  }

  function fieldError(field: keyof T): string | undefined {
    return touched[field] ? fieldErrors[field] : undefined
  }

  const errorList = useMemo(() => Object.values(fieldErrors).filter(Boolean) as string[], [fieldErrors])

  return {
    fieldErrors,
    fieldState,
    fieldError,
    touch,
    touchAll,
    errorList,
    isValid: errorList.length === 0,
  }
}
