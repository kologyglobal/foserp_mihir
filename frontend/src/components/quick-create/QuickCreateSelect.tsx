import { useMemo } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { Input } from '../forms/Inputs'
import { ErpSmartSelect } from '../erp/ErpSmartSelect'
import { useQuickCreate } from '../../hooks/useQuickCreate'
import { useMasterStore } from '../../store/masterStore'
import {
  QUICK_CREATE_ADD_LABELS,
  QUICK_CREATE_EMPTY_LABELS,
} from '../../types/quickCreate'
import type { QuickCreateEntityType } from '../../types/quickCreate'

export interface QuickCreateOption {
  id: string
  label: string
}

interface QuickCreateSelectProps {
  entityType: QuickCreateEntityType
  value: string
  onChange: (id: string) => void
  options: QuickCreateOption[]
  placeholder?: string
  disabled?: boolean
  allowEmpty?: boolean
  emptyOptionLabel?: string
  context?: Record<string, unknown>
  className?: string
}

export function QuickCreateSelect({
  entityType,
  value,
  onChange,
  options,
  placeholder = 'Type to search…',
  disabled = false,
  allowEmpty = false,
  emptyOptionLabel = '— Select —',
  context,
  className,
}: QuickCreateSelectProps) {
  const { openDrawer, canCreate, getDenialReason } = useQuickCreate()
  const allowed = canCreate(entityType)
  const denialReason = getDenialReason(entityType)

  const smartOptions = useMemo(
    () => [
      ...(allowEmpty ? [{ value: '', label: emptyOptionLabel, searchText: emptyOptionLabel.toLowerCase() }] : []),
      ...options.map((o) => ({
        value: o.id,
        label: o.label,
        searchText: o.label.toLowerCase(),
      })),
    ],
    [options, allowEmpty, emptyOptionLabel],
  )

  function handleAdd() {
    if (!allowed) return
    openDrawer(entityType, {
      defaultValues: context,
      onCreated: (result) => onChange(result.id),
    })
  }

  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <div className="flex gap-2">
        <ErpSmartSelect
          className="flex-1 min-w-0"
          options={smartOptions}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          allowEmpty={allowEmpty}
          disabled={disabled}
          emptyMessage={QUICK_CREATE_EMPTY_LABELS[entityType]}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={handleAdd}
          disabled={disabled || !allowed}
          title={!allowed ? denialReason : undefined}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add New
        </Button>
      </div>
      {smartOptions.length <= (allowEmpty ? 1 : 0) && (
        <div className="rounded-md border border-dashed border-erp-border bg-erp-surface-alt px-3 py-2 text-[13px]">
          <p className="text-erp-muted">{QUICK_CREATE_EMPTY_LABELS[entityType]}</p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="mt-2"
            onClick={handleAdd}
            disabled={disabled || !allowed}
            title={!allowed ? denialReason : undefined}
          >
            {QUICK_CREATE_ADD_LABELS[entityType]}
          </Button>
          {!allowed && denialReason && (
            <p className="mt-2 text-xs text-amber-700">{denialReason}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** Transporter field: select from master or free-text with quick-create */
interface TransporterQuickCreateFieldProps {
  value: string
  onChange: (name: string) => void
  disabled?: boolean
}

export function TransporterQuickCreateField({ value, onChange, disabled }: TransporterQuickCreateFieldProps) {
  const masterTransporters = useMasterStore((s) => s.transporters)
  const getTransporter = useMasterStore((s) => s.getTransporter)
  const { canCreate, getDenialReason } = useQuickCreate()
  const options = useMemo(
    () =>
      masterTransporters
        .filter((t) => t.isActive)
        .map((t) => ({ id: t.id, label: t.transporterName })),
    [masterTransporters],
  )

  const selectedId = options.find((o) => o.label === value)?.id ?? ''

  return (
    <div className="space-y-2">
      <QuickCreateSelect
        entityType="transporter"
        value={selectedId}
        onChange={(id) => {
          const t = getTransporter(id)
          if (t) onChange(t.transporterName)
        }}
        options={options}
        placeholder="Search transporters…"
        disabled={disabled}
        allowEmpty
        emptyOptionLabel="— Custom / type below —"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Transporter name"
        disabled={disabled}
      />
      {!canCreate('transporter') && (
        <p className="text-xs text-amber-700">{getDenialReason('transporter')}</p>
      )}
    </div>
  )
}
