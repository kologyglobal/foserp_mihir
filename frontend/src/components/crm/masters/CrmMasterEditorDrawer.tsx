import { useEffect, useMemo, useState } from 'react'
import { ErpButton, ErpButtonGroup } from '../../erp/ErpButton'
import { Input, Select, Textarea } from '../../forms/Inputs'
import { ErpRichTextEditor } from '../../forms/ErpRichTextEditor'
import { CrmDrawerShell } from '../CrmDrawerShell'
import { useCrmMasterStore } from '../../../store/crmMasterStore'
import type { CrmMasterCatalogItem, CrmMasterEntry, CrmMasterKind } from '../../../types/crmMasters'
import {
  crmMasterBasicExtraFields,
  crmMasterConfigurationFields,
  crmMasterHasEffectiveDate,
  crmMasterShowsDescription,
  crmMasterShowsNotes,
} from '../../../utils/crmMasterUtils'
import { crmKindToEntityType, MASTER_CODE_HELPER_TEXT } from '../../../config/masterCodeSeriesConfig'
import { useMasterCodeSeries } from '../../../hooks/useMasterCodeSeries'
import {
  resolveCrmMasterWrite,
  writeCrmMasterEntry,
} from '../../../services/bridges/crmMasterApiBridge'
import { resolveStoreAction } from '../../../store/storeAction'
import { notifyMasterSaved } from '../../../store/toastStore'
import { cn } from '../../../utils/cn'
import { MasterFormField, renderCatalogField } from './CrmMasterFormFields'

export interface CrmMasterEditorDrawerProps {
  open: boolean
  onClose: () => void
  catalog: CrmMasterCatalogItem
  kind: CrmMasterKind
  entry?: CrmMasterEntry | null
  onSaved?: () => void
}

export function CrmMasterEditorDrawer({
  open,
  onClose,
  catalog,
  kind,
  entry,
  onSaved,
}: CrmMasterEditorDrawerProps) {
  const isEdit = Boolean(entry)
  const entries = useCrmMasterStore((s) => s.getByKind(kind, false))
  const addEntry = useCrmMasterStore((s) => s.addEntry)
  const updateEntry = useCrmMasterStore((s) => s.updateEntry)
  const series = useMasterCodeSeries(crmKindToEntityType(kind), {
    isEdit,
    existingCode: entry?.code,
  })

  const [code, setCode] = useState(entry?.code ?? '')
  const [name, setName] = useState(entry?.name ?? '')
  const [status, setStatus] = useState<'active' | 'inactive'>(entry?.status ?? 'active')
  const [sortOrder, setSortOrder] = useState(String(entry?.sortOrder ?? entries.length + 1))
  const [description, setDescription] = useState(entry?.description ?? '')
  const [notes, setNotes] = useState(entry?.notes ?? '')
  const [attrs, setAttrs] = useState<Record<string, string>>(() => {
    const base: Record<string, string> = {}
    if (entry) {
      Object.entries(entry.attributes).forEach(([k, v]) => {
        base[k] = String(v ?? '')
      })
    }
    return base
  })
  const [errors, setErrors] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const configFields = useMemo(() => crmMasterConfigurationFields(catalog), [catalog])
  const basicExtraFields = useMemo(() => crmMasterBasicExtraFields(catalog), [catalog])
  const showNotes = crmMasterShowsNotes(catalog)
  const showDescription = crmMasterShowsDescription(catalog)
  const usesRichDescription = catalog.descriptionFormat === 'richtext'
  const showEffectiveDate = crmMasterHasEffectiveDate(catalog)
  const effectiveDateField = catalog.fields.find((f) => f.key === 'effectiveDate')

  useEffect(() => {
    if (!open) return
    setCode(entry?.code ?? '')
    setName(entry?.name ?? '')
    setStatus(entry?.status ?? 'active')
    setSortOrder(String(entry?.sortOrder ?? entries.length + 1))
    setDescription(entry?.description ?? '')
    setNotes(entry?.notes ?? '')
    const nextAttrs: Record<string, string> = {}
    if (entry) {
      Object.entries(entry.attributes).forEach(([k, v]) => {
        nextAttrs[k] = String(v ?? '')
      })
    }
    setAttrs(nextAttrs)
    setErrors([])
  }, [open, entry, entries.length])

  useEffect(() => {
    if (!open || isEdit || entry?.systemControlled) return
    if (series.code && series.code !== code) setCode(series.code)
  }, [open, series.code, isEdit, entry?.systemControlled, code])

  function buildAttributes() {
    const out: Record<string, string | number | boolean | null> = {}
    catalog.fields.forEach((f) => {
      if (['code', 'name', 'status', 'description', 'notes'].includes(f.key)) return
      const raw = attrs[f.key] ?? ''
      if (f.type === 'number') out[f.key] = raw === '' ? null : Number(raw)
      else if (f.type === 'boolean') out[f.key] = raw === 'true'
      else out[f.key] = raw || null
    })
    return out
  }

  function validate() {
    const errs: string[] = []
    if (!code.trim()) errs.push('Code is required.')
    if (!name.trim()) errs.push('Name is required.')
    catalog.fields
      .filter((f) => f.required && !['code', 'name', 'status'].includes(f.key))
      .forEach((f) => {
        const val = f.key === 'description' ? description : attrs[f.key]
        if (!String(val ?? '').trim()) errs.push(`${f.label} is required.`)
      })
    return errs
  }

  function handleSubmit() {
    const errs = validate()
    if (errs.length) {
      setErrors(errs)
      return
    }
    if (!entry?.systemControlled) {
      const validation = series.validateBeforeSave(code.trim(), {
        checkDuplicate: (c) => entries.some((e) => e.code === c && e.id !== entry?.id),
      })
      if (!validation.ok) {
        setErrors([validation.message ?? 'Invalid code'])
        return
      }
    }
    setErrors([])
    setIsSubmitting(true)
    const payload = {
      kind,
      code: code.trim(),
      name: name.trim(),
      status,
      sortOrder: Number(sortOrder) || 1,
      description: description.trim() || undefined,
      notes: notes.trim() || undefined,
      attributes: buildAttributes(),
    }
    void (async () => {
      const r = await resolveStoreAction(
        resolveCrmMasterWrite(
          () => (isEdit && entry ? updateEntry(entry.id, payload) : addEntry(payload)),
          () => writeCrmMasterEntry(payload, isEdit ? entry?.id : undefined),
        ),
      )
      setIsSubmitting(false)
      if (!r.ok) {
        setErrors([r.error ?? 'Save failed'])
        return
      }
      if (!isEdit && !entry?.systemControlled) series.confirmSaved(code.trim())
      notifyMasterSaved(catalog.title.replace(/ Master$/i, '') || 'Record', !isEdit)
      onSaved?.()
      onClose()
    })()
  }

  function handleClose() {
    if (!isEdit && !entry?.systemControlled) series.releaseOnCancel()
    onClose()
  }

  return (
    <CrmDrawerShell
      open={open}
      onClose={handleClose}
      title={isEdit ? `Edit ${catalog.title}` : `New ${catalog.title}`}
      subtitle={catalog.purpose ?? catalog.description}
      width="md"
      footer={(
        <ErpButtonGroup className="justify-end">
          <ErpButton type="button" variant="ghost" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </ErpButton>
          <ErpButton type="button" variant="primary" disabled={isSubmitting} onClick={handleSubmit}>
            {isSubmitting ? 'Saving…' : isEdit ? 'Save Changes' : 'Create'}
          </ErpButton>
        </ErpButtonGroup>
      )}
    >
      <div className="space-y-3">
        {errors.length > 0 ? (
          <ul className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        ) : null}
        <MasterFormField label="Code" required>
          <Input
            className={cn('font-mono', (series.readOnly || entry?.systemControlled) && 'bg-erp-surface-alt/60')}
            value={code}
            disabled={entry?.systemControlled || isEdit}
            readOnly={!entry?.systemControlled && !isEdit && !series.canManual}
            onChange={(e) => {
              if (series.readOnly || entry?.systemControlled) return
              setCode(e.target.value)
            }}
          />
          {!isEdit && !series.canManual && !series.error ? (
            <p className="mt-1 text-[12px] text-erp-muted">{MASTER_CODE_HELPER_TEXT}</p>
          ) : null}
          {series.error ? <p className="mt-1 text-[12px] text-erp-danger">{series.error}</p> : null}
        </MasterFormField>
        <MasterFormField label="Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </MasterFormField>
        <div className="grid grid-cols-2 gap-3">
          <MasterFormField label="Status" required>
            <Select wrapClassName="w-full" value={status} onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </MasterFormField>
          <MasterFormField label="Sort Order">
            <Input type="number" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </MasterFormField>
        </div>
        {showEffectiveDate && effectiveDateField
          ? renderCatalogField(effectiveDateField, attrs.effectiveDate ?? '', (v) =>
              setAttrs((prev) => ({ ...prev, effectiveDate: v })),
            )
          : null}
        {basicExtraFields
          .filter((f) => f.key !== 'effectiveDate')
          .map((field) =>
            renderCatalogField(field, attrs[field.key] ?? '', (v) => setAttrs((prev) => ({ ...prev, [field.key]: v }))),
          )}
        {configFields.map((field) =>
          renderCatalogField(field, attrs[field.key] ?? '', (v) => setAttrs((prev) => ({ ...prev, [field.key]: v }))),
        )}
        {showDescription ? (
          <MasterFormField label="Description" wide>
            {usesRichDescription ? (
              <ErpRichTextEditor value={description} onChange={setDescription} minHeight={120} />
            ) : (
              <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            )}
          </MasterFormField>
        ) : null}
        {showNotes ? (
          <MasterFormField label="Notes" wide>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Internal notes" />
          </MasterFormField>
        ) : null}
      </div>
    </CrmDrawerShell>
  )
}
