import { useCallback, useEffect, useState } from 'react'
import { Save } from 'lucide-react'
import { ErpButton } from '@/components/erp/ErpButton'
import { Input } from '@/components/forms/Inputs'
import { FormField } from '@/components/forms/FormField'
import { LoadingState } from '@/design-system/components/LoadingState'
import {
  FINANCE_DOCUMENT_TYPE_LABELS,
  REQUIRED_NUMBER_SERIES_TYPES,
  type FinanceDocumentType,
  type FinanceNumberSeries,
} from '@/types/financeSetup'
import { listNumberSeries, resolveLegalEntityId, upsertNumberSeries } from '@/services/bridges/financeApiBridge'
import { useFinancePermissions } from '@/utils/permissions/finance'
import { notify } from '@/store/toastStore'
import { FinanceSettingsShell } from './FinanceSettingsShell'

type SeriesForm = Record<FinanceDocumentType, { prefix: string; padLength: number; currentValue: number; isActive: boolean }>

function defaultForms(existing: FinanceNumberSeries[]): SeriesForm {
  const map = {} as SeriesForm
  for (const t of REQUIRED_NUMBER_SERIES_TYPES) {
    const row = existing.find((s) => s.documentType === t)
    map[t] = {
      prefix: row?.prefix ?? `${t.slice(0, 2)}/`,
      padLength: row?.padLength ?? 6,
      currentValue: row?.currentValue ?? 0,
      isActive: row?.isActive ?? true,
    }
  }
  return map
}

export function NumberSeriesPage() {
  const perms = useFinancePermissions()
  const [forms, setForms] = useState<SeriesForm | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setForms(defaultForms(await listNumberSeries()))
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Failed to load number series')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (perms.canView) void load()
  }, [load, perms.canView])

  const saveAll = async () => {
    if (!forms) return
    try {
      const leId = resolveLegalEntityId()
      for (const documentType of REQUIRED_NUMBER_SERIES_TYPES) {
        const row = forms[documentType]
        await upsertNumberSeries({
          legalEntityId: leId,
          documentType,
          prefix: row.prefix,
          padLength: row.padLength,
          currentValue: row.currentValue,
          resetEachYear: true,
          isActive: row.isActive,
        })
      }
      notify.success('Number series saved.')
      await load()
    } catch (e) {
      notify.error(e instanceof Error ? e.message : 'Save failed')
    }
  }

  return (
    <FinanceSettingsShell
      title="Voucher Number Series"
      description="Configure numbering for finance document types — does not issue vouchers."
      actions={
        perms.canManageNumberSeries ? (
          <ErpButton size="sm" onClick={() => void saveAll()}>
            <Save className="mr-1 h-3.5 w-3.5" />
            Save All
          </ErpButton>
        ) : null
      }
    >
      {loading ? <LoadingState variant="form" /> : null}
      {!loading && forms && perms.canView ? (
        <div className="space-y-3">
          {REQUIRED_NUMBER_SERIES_TYPES.map((documentType) => (
            <div key={documentType} className="grid gap-3 rounded border border-erp-border p-3 md:grid-cols-[1fr_repeat(3,minmax(0,120px))] md:items-end">
              <div>
                <div className="text-[13px] font-semibold text-erp-text">{FINANCE_DOCUMENT_TYPE_LABELS[documentType]}</div>
                <div className="text-[11px] text-erp-muted">{documentType}</div>
              </div>
              <FormField label="Prefix">
                <Input
                  value={forms[documentType].prefix}
                  onChange={(e) => setForms((f) => f && ({ ...f, [documentType]: { ...f[documentType], prefix: e.target.value } }))}
                  disabled={!perms.canManageNumberSeries}
                />
              </FormField>
              <FormField label="Pad length">
                <Input
                  type="number"
                  min={4}
                  max={10}
                  value={forms[documentType].padLength}
                  onChange={(e) => setForms((f) => f && ({ ...f, [documentType]: { ...f[documentType], padLength: Number(e.target.value) } }))}
                  disabled={!perms.canManageNumberSeries}
                />
              </FormField>
              <FormField label="Next #">
                <Input
                  type="number"
                  min={0}
                  value={forms[documentType].currentValue}
                  onChange={(e) => setForms((f) => f && ({ ...f, [documentType]: { ...f[documentType], currentValue: Number(e.target.value) } }))}
                  disabled={!perms.canManageNumberSeries}
                />
              </FormField>
            </div>
          ))}
        </div>
      ) : null}
    </FinanceSettingsShell>
  )
}
