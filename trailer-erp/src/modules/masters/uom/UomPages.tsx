import { useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Ruler } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, CoreMasterRowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailLayout, DetailSection, DetailGrid, DetailField, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { ActiveBadge, TypeBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Checkbox } from '../../../components/forms/Inputs'
import { ErpCardSection } from '../../../components/erp/card-form'
import { useMasterStore } from '../../../store/masterStore'
import { resolveMaybeId, resolveMaybeVoid } from '../../../store/storeAction'
import { formatApiError } from '../../../services/api/apiErrors'
import { notifyMasterSaved } from '../../../store/toastStore'
import type { Uom, UomType } from '../../../types/master'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { formatDate } from '../../../utils/dates/format'
import { EnterpriseMasterWorkspace, MasterForm, MasterStickyFooter } from '../shared/EnterpriseMasterShell'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'

const uomSchema = z.object({
  uomCode: z.string().min(1, 'Code required').max(10),
  uomName: z.string().min(1, 'Name required'),
  description: z.string().optional(),
  uomType: z.enum(['integer', 'weight', 'length', 'volume']),
  decimalPlaces: z.coerce.number().min(0).max(6),
  isBaseUnit: z.boolean(),
  isActive: z.boolean(),
})

type UomForm = z.infer<typeof uomSchema>

export function UomListPage() {
  const uoms = useMasterStore((s) => s.uoms)
  const deleteUom = useMasterStore((s) => s.deleteUom)
  const activateUom = useMasterStore((s) => s.activateUom)
  const deactivateUom = useMasterStore((s) => s.deactivateUom)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(
    () =>
      uoms.filter(
        (u) =>
          matchesStatusFilter(u.isActive, status) &&
          (u.uomCode.toLowerCase().includes(search.toLowerCase()) ||
            u.uomName.toLowerCase().includes(search.toLowerCase()) ||
            (u.description ?? '').toLowerCase().includes(search.toLowerCase())),
      ),
    [uoms, search, status],
  )

  const columns: ColumnDef<Uom, unknown>[] = [
    { accessorKey: 'uomCode', header: 'Code', cell: ({ row }) => <span className="font-mono text-[13px] font-semibold text-erp-primary">{row.original.uomCode}</span> },
    { id: 'description', header: 'Description', cell: ({ row }) => row.original.description ?? row.original.uomName },
    { accessorKey: 'decimalPlaces', header: 'Decimal Precision' },
    { id: 'base', header: 'Base Unit', cell: ({ row }) => (row.original.isBaseUnit ? 'Yes' : 'No') },
    { accessorKey: 'uomType', header: 'Type', cell: ({ row }) => <TypeBadge value={row.original.uomType} color="purple" /> },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => (
      <CoreMasterRowActions
        viewTo={`/masters/uom/${row.original.id}`}
        editTo={`/masters/uom/${row.original.id}/edit`}
        recordId={row.original.id}
        recordLabel={`${row.original.uomCode} — ${row.original.uomName}`}
        isActive={row.original.isActive}
        deleteRecord={deleteUom}
        activateRecord={activateUom}
        deactivateRecord={deactivateUom}
      />
    ) },
  ]

  return (
    <MasterListShell
      title="Unit of Measure Master"
      description="Units of measure for items, BOM, purchase, and inventory transactions"
      masterGroupId="inventory"
      createLabel="New UOM"
      createTo="/masters/uom/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'UOMs', value: uoms.length },
        { label: 'Base Units', value: uoms.filter((u) => u.isBaseUnit).length },
        { label: 'Active', value: uoms.filter((u) => u.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function UomFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const uoms = useMasterStore((s) => s.uoms)
  const existing = useMasterStore((s) => (id ? s.getUom(id) : undefined))
  const addUom = useMasterStore((s) => s.addUom)
  const updateUom = useMasterStore((s) => s.updateUom)
  const isEdit = Boolean(id && existing)
  const [activeSection, setActiveSection] = useState('general')
  const [saveError, setSaveError] = useState<string | null>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<UomForm>({
    resolver: zodResolver(uomSchema) as Resolver<UomForm>,
    defaultValues: existing
      ? { ...existing, description: existing.description ?? existing.uomName, isBaseUnit: existing.isBaseUnit ?? false }
      : { uomCode: '', uomName: '', uomType: 'integer' as UomType, decimalPlaces: 0, isBaseUnit: false, isActive: true, description: '' },
  })
  const watched = useWatch({ control })

  function save(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit(async (data) => {
      const validation = codeSeriesRef.current?.validateBeforeSave(data.uomCode, {
        checkDuplicate: (c) => uoms.some((u) => u.uomCode === c && u.id !== id),
      })
      if (validation && !validation.ok) {
        setSaveError(validation.message ?? 'Invalid code')
        return
      }
      setSaveError(null)
      const payload = { ...data, uomName: data.uomName || data.description || data.uomCode, description: data.description || data.uomName }
      try {
        let recordId = id
        if (isEdit && id) await resolveMaybeVoid(updateUom(id, payload))
        else recordId = await resolveMaybeId(addUom(payload))
        if (!isEdit) codeSeriesRef.current?.confirmSaved(data.uomCode)
        notifyMasterSaved('UOM', !isEdit)
        if (mode === 'new') { navigate('/masters/uom/new'); return }
        if (mode === 'close') { navigate('/masters/uom'); return }
        if (!isEdit && recordId) navigate(`/masters/uom/${recordId}/edit`, { replace: true })
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  }

  function cancelForm() {
    codeSeriesRef.current?.releaseOnCancel()
    navigate('/masters/uom')
  }

  const validationErrors = [...Object.values(errors).map((e) => e?.message).filter(Boolean) as string[], ...(saveError ? [saveError] : [])]

  return (
    <EnterpriseMasterWorkspace
      title={isEdit ? existing!.uomCode : 'New Unit of Measure'}
      subtitle="Base and alternate units for item master"
      breadcrumbs={buildMasterBreadcrumbs('inventory', isEdit ? 'Edit UOM' : 'New UOM')}
      validationErrors={validationErrors}
      documentStrip={[
        { label: 'Code', value: watched.uomCode?.trim() || '—', highlight: Boolean(watched.uomCode?.trim()) },
        { label: 'Precision', value: watched.decimalPlaces != null ? String(watched.decimalPlaces) : '—' },
        { label: 'Base Unit', value: watched.isBaseUnit ? 'Yes' : 'No' },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive' },
      ]}
      commandBar={<MasterForm listPath="/masters/uom" isEdit={isEdit} onSave={() => save('default')} onSaveClose={() => save('close')} onSaveNew={() => save('new')} onCancel={cancelForm} />}
      sectionNavItems={[{ id: 'general', label: 'General', icon: Ruler, done: Boolean(watched.uomCode?.trim()) }]}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      formMetrics={[
        { label: 'Type', value: watched.uomType ?? '—', accent: 'blue' as const },
        { label: 'Decimals', value: String(watched.decimalPlaces ?? 0), accent: 'violet' as const },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive', accent: 'green' as const },
      ]}
      factBoxTitle="UOM insight"
      factBoxSummary={[
        { label: 'Used in', value: 'Item Master, Purchase, Inventory, BOM' },
        { label: 'Base unit', value: watched.isBaseUnit ? 'Yes — default posting UOM' : 'Alternate UOM' },
        { label: 'Modified', value: existing?.updatedAt ? formatDate(existing.updatedAt.slice(0, 10)) : 'New' },
      ]}
      stickyFooter={<MasterStickyFooter isEdit={isEdit} isSubmitting={isSubmitting} onSave={() => save('default')} onSaveClose={() => save('close')} onSaveNew={() => save('new')} onCancel={cancelForm} />}
    >
      <form onSubmit={(e: FormEvent) => { e.preventDefault(); save('default') }}>
        <ErpCardSection id="uom-section-general" title="General" subtitle="Code, description, precision, and base unit flag." icon={Ruler} accent="blue" collapsible defaultOpen>
          <div className="grid gap-4 md:grid-cols-2">
            <MasterCodeField
              entityType="uom"
              isEdit={isEdit}
              existingCode={existing?.uomCode}
              value={watched.uomCode ?? ''}
              onChange={(v) => setValue('uomCode', v, { shouldValidate: true })}
              onSeriesReady={(h) => { codeSeriesRef.current = h }}
              error={errors.uomCode?.message}
              required
            />
            <FormField label="Description" required error={errors.uomName?.message}>
              <Input {...register('uomName')} placeholder="Numbers / each" />
            </FormField>
            <FormField label="Extended Description" error={errors.description?.message}>
              <Input {...register('description')} placeholder="Optional long description" />
            </FormField>
            <FormField label="UOM Type" required>
              <Select {...register('uomType')}>
                <option value="integer">Integer</option>
                <option value="weight">Weight</option>
                <option value="length">Length</option>
                <option value="volume">Volume</option>
              </Select>
            </FormField>
            <FormField label="Decimal Precision" required error={errors.decimalPlaces?.message}>
              <Input type="number" min={0} max={6} {...register('decimalPlaces')} />
            </FormField>
            <FormField label="Base Unit">
              <Checkbox {...register('isBaseUnit')} label="Use as base unit of measure" />
            </FormField>
            <FormField label="Status">
              <Checkbox {...register('isActive')} label="Active" />
            </FormField>
          </div>
        </ErpCardSection>
      </form>
    </EnterpriseMasterWorkspace>
  )
}

export function UomDetailPage() {
  const { id } = useParams()
  const record = useMasterStore((s) => (id ? s.getUom(id) : undefined))
  if (!record) return <MasterNotFound message="UOM not found." />
  return (
    <DetailLayout backTo="/masters/uom" backLabel="UOM Master" title={record.uomCode} editTo={`/masters/uom/${record.id}/edit`}>
      <DetailSection title="General">
        <DetailGrid>
          <DetailField label="Code" value={record.uomCode} />
          <DetailField label="Description" value={record.description ?? record.uomName} />
          <DetailField label="Decimal Precision" value={String(record.decimalPlaces)} />
          <DetailField label="Base Unit" value={record.isBaseUnit ? 'Yes' : 'No'} />
          <DetailField label="Type" value={record.uomType} />
          <DetailField label="Status" value={record.isActive ? 'Active' : 'Inactive'} />
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
