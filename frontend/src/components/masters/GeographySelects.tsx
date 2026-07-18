import { useMemo } from 'react'
import { Select } from '../forms/Inputs'
import { useActiveCountries, useActiveStates, useCitiesForState, useAllMasterCities } from '../../hooks/useMasterLists'
import { useCommercialTermsByType } from '../../hooks/useStableStoreData'
import type { CommercialTerm } from '../../types/master'
import { CUSTOMER_COUNTRIES } from '../../config/countries'
import { cn } from '../../utils/cn'

interface StateSelectProps {
  value: string
  onChange: (stateName: string) => void
  required?: boolean
  error?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function StateSelect({
  value,
  onChange,
  required,
  error,
  placeholder = '— Select state —',
  className,
  disabled,
}: StateSelectProps) {
  const states = useActiveStates()

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      required={required}
      className={cn(className)}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {states.map((s) => (
        <option key={s.id} value={s.stateName}>
          {s.stateName}
        </option>
      ))}
    </Select>
  )
}

interface CitySelectProps {
  stateName: string
  value: string
  onChange: (cityName: string) => void
  required?: boolean
  error?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
  /** When true, lists all cities (for filters) instead of filtering by state */
  allCities?: boolean
}

export function CitySelect({
  stateName,
  value,
  onChange,
  required,
  error,
  placeholder,
  className,
  disabled,
  allCities = false,
}: CitySelectProps) {
  const filtered = useCitiesForState(stateName)
  const all = useAllMasterCities()
  const cities = allCities ? all : filtered
  const emptyLabel = allCities
    ? '— All cities —'
    : stateName
      ? '— Select city —'
      : '— Select state first —'

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      required={required}
      className={cn(className)}
      disabled={disabled || (!allCities && !stateName)}
    >
      <option value="">{placeholder ?? emptyLabel}</option>
      {cities.map((c) => (
        <option key={c.id} value={c.cityName}>
          {c.cityName}
        </option>
      ))}
    </Select>
  )
}

interface CommercialTermSelectProps {
  termType: CommercialTerm['termType']
  value: string
  onChange: (termName: string) => void
  required?: boolean
  error?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function CommercialTermSelect({
  termType,
  value,
  onChange,
  required,
  error,
  placeholder = '— Select term —',
  className,
  disabled,
}: CommercialTermSelectProps) {
  const terms = useCommercialTermsByType(termType)
  const resolvedTerms = useMemo(() => {
    if (!value?.trim()) return terms
    if (terms.some((t) => t.name === value)) return terms
    return [
      {
        id: `custom-${termType}-${value}`,
        code: 'CUSTOM',
        name: value,
        termType,
        description: value,
        isActive: true,
        createdAt: new Date().toISOString(),
      } satisfies CommercialTerm,
      ...terms,
    ]
  }, [terms, termType, value])

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      required={required}
      disabled={disabled}
      className={cn(className)}
      native
    >
      <option value="">{placeholder}</option>
      {resolvedTerms.map((t) => (
        <option key={t.id} value={t.name}>
          {t.code === 'CUSTOM' ? t.name : `${t.code} — ${t.name}`}
        </option>
      ))}
    </Select>
  )
}

interface MasterEnumSelectProps {
  value: string
  onChange: (value: string) => void
  options: readonly string[]
  placeholder?: string
  required?: boolean
  error?: boolean
  className?: string
}

export function MasterEnumSelect({
  value,
  onChange,
  options,
  placeholder = '— Select —',
  required,
  error,
  className,
}: MasterEnumSelectProps) {
  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      error={error}
      className={cn(className)}
    >
      <option value="">{placeholder}</option>
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </Select>
  )
}

interface CountrySelectProps {
  value: string
  onChange: (country: string) => void
  required?: boolean
  error?: boolean
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function CountrySelect({
  value,
  onChange,
  required,
  error,
  placeholder = '— Select country —',
  className,
  disabled,
}: CountrySelectProps) {
  const countries = useActiveCountries()
  const options = countries.length > 0
    ? countries.map((c) => c.countryName)
    : [...CUSTOMER_COUNTRIES]

  return (
    <Select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      required={required}
      className={cn(className)}
      disabled={disabled}
    >
      <option value="">{placeholder}</option>
      {options.map((country) => (
        <option key={country} value={country}>
          {country}
        </option>
      ))}
    </Select>
  )
}
