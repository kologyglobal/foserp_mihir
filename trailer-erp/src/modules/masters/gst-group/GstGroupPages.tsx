import { useMemo, useState, useRef, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { FileText, Link2 } from 'lucide-react'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, CoreMasterRowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { DetailGrid, DetailField, DetailLayout, DetailSection, MasterNotFound } from '../../../components/masters/MasterLayouts'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Select, Checkbox, Textarea } from '../../../components/forms/Inputs'
import { useMasterStore } from '../../../store/masterStore'
import { resolveMaybeId, resolveMaybeVoid } from '../../../store/storeAction'
import { formatApiError } from '../../../services/api/apiErrors'
import { notifyMasterSaved } from '../../../store/toastStore'
import { GST_GOODS_TYPE_LABELS, type GstGroupCode, type GstGoodsType } from '../../../types/taxMaster'
import { buildMasterBreadcrumbs } from '../../../utils/masterNavigation'
import { formatDate } from '../../../utils/dates/format'
import {
  EnterpriseMasterWorkspace,
  MasterFormCommandBar,
  MasterFormSection,
  MasterStickyFooter,
} from '../shared/EnterpriseMasterShell'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'

const schema = z.object({
  code: z.string().min(1, 'Code required').max(20),
  goodsType: z.enum(['goods', 'service']),
  description: z.string().min(1, 'Description required'),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof schema>

export function GstGroupListPage() {
  const gstGroups = useMasterStore((s) => s.gstGroups)
  const deleteGstGroup = useMasterStore((s) => s.deleteGstGroup)
  const activateGstGroup = useMasterStore((s) => s.activateGstGroup)
  const deactivateGstGroup = useMasterStore((s) => s.deactivateGstGroup)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(
    () =>
      gstGroups.filter((g) => {
        const s = search.toLowerCase()
        return (
          matchesStatusFilter(g.isActive, status) &&
          (g.code.toLowerCase().includes(s) || g.description.toLowerCase().includes(s))
        )
      }),
    [gstGroups, search, status],
  )

  const columns: ColumnDef<GstGroupCode, unknown>[] = [
    { accessorKey: 'code', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs font-semibold">{row.original.code}</span> },
    { accessorKey: 'goodsType', header: 'GST Goods Type', cell: ({ row }) => GST_GOODS_TYPE_LABELS[row.original.goodsType] },
    { accessorKey: 'description', header: 'Description' },
    { accessorKey: 'isActive', header: 'Status', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => (
      <CoreMasterRowActions
        viewTo={`/masters/gst-groups/${row.original.id}`}
        editTo={`/masters/gst-groups/${row.original.id}/edit`}
        recordId={row.original.id}
        recordLabel={row.original.code}
        isActive={row.original.isActive}
        deleteRecord={deleteGstGroup}
        activateRecord={activateGstGroup}
        deactivateRecord={deactivateGstGroup}
      />
    ) },
  ]

  return (
    <MasterListShell
      title="GST Group Code Master"
      description="GST classification groups for items, HSN codes, and rate slabs"
      masterGroupId="tax"
      createLabel="New GST Group"
      createTo="/masters/gst-groups/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'Groups', value: gstGroups.length },
        { label: 'Goods', value: gstGroups.filter((g) => g.goodsType === 'goods').length },
        { label: 'Active', value: gstGroups.filter((g) => g.isActive).length, accent: 'green' },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function GstGroupFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useMasterStore((s) => (id ? s.getGstGroup(id) : undefined))
  const gstGroups = useMasterStore((s) => s.gstGroups)
  const addGstGroup = useMasterStore((s) => s.addGstGroup)
  const updateGstGroup = useMasterStore((s) => s.updateGstGroup)
  const hsnMasters = useMasterStore((s) => s.hsnMasters)
  const hsnCount = useMemo(() => hsnMasters.filter((h) => h.gstGroupId === id).length, [hsnMasters, id])
  const isEdit = Boolean(id && existing)
  const [activeSection, setActiveSection] = useState('general')
  const [saveError, setSaveError] = useState<string | null>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing ?? { goodsType: 'goods' as GstGoodsType, isActive: true, description: '', code: '' },
  })
  const watched = useWatch({ control })

  function save(mode: 'default' | 'new' | 'close' = 'default') {
    void handleSubmit(async (data) => {
      const validation = codeSeriesRef.current?.validateBeforeSave(data.code, {
        checkDuplicate: (c) => gstGroups.some((g) => g.code === c && g.id !== id),
      })
      if (validation && !validation.ok) {
        setSaveError(validation.message ?? 'Invalid code')
        return
      }
      setSaveError(null)
      try {
        let recordId = id
        if (isEdit && id) await resolveMaybeVoid(updateGstGroup(id, data))
        else recordId = await resolveMaybeId(addGstGroup(data))
        if (!isEdit) codeSeriesRef.current?.confirmSaved(data.code)
        notifyMasterSaved('GST Group', !isEdit)
        if (mode === 'new') { navigate('/masters/gst-groups/new'); return }
        if (mode === 'close') { navigate('/masters/gst-groups'); return }
        if (mode === 'default' && isEdit && id) { navigate(`/masters/gst-groups/${id}`); return }
        if (!isEdit && recordId) navigate(`/masters/gst-groups/${recordId}/edit`, { replace: true })
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  }

  const breadcrumbs = buildMasterBreadcrumbs('tax', isEdit ? 'Edit GST Group' : 'New GST Group')
  const validationErrors = [...Object.values(errors).map((e) => e?.message).filter(Boolean) as string[], ...(saveError ? [saveError] : [])]

  function cancelForm() {
    codeSeriesRef.current?.releaseOnCancel()
    navigate('/masters/gst-groups')
  }

  return (
    <EnterpriseMasterWorkspace
      title={isEdit ? existing!.code : 'New GST Group Code'}
      subtitle="GST group classification for tax calculation"
      masterGroupId="tax"
      favoritePath="/masters/gst-groups"
      recordNo={isEdit ? existing!.code : undefined}
      isActive={watched.isActive}
      breadcrumbs={breadcrumbs}
      validationErrors={validationErrors}
      onSubmit={(e: FormEvent) => { e.preventDefault(); save('default') }}
      onSaveShortcut={() => save('default')}
      onSaveCloseShortcut={() => save('close')}
      onSaveAndNewShortcut={() => save('new')}
      documentStrip={[
        { label: 'Code', value: watched.code?.trim() || '—', highlight: Boolean(watched.code?.trim()) },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive' },
        { label: 'Goods Type', value: watched.goodsType ? GST_GOODS_TYPE_LABELS[watched.goodsType] : '—' },
      ]}
      commandBar={(
        <MasterFormCommandBar
          listPath="/masters/gst-groups"
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={cancelForm}
        />
      )}
      sectionNavItems={[
        { id: 'general', label: 'General', icon: FileText, done: Boolean(watched.code?.trim() && watched.description?.trim()) },
        { id: 'related', label: 'Related Records', icon: Link2, done: hsnCount > 0 },
      ]}
      activeSection={activeSection}
      onSectionSelect={setActiveSection}
      formMetrics={[
        { label: 'HSN Links', value: String(hsnCount), accent: 'blue' as const },
        { label: 'Type', value: watched.goodsType ? GST_GOODS_TYPE_LABELS[watched.goodsType] : '—', accent: 'violet' as const },
        { label: 'Status', value: watched.isActive ? 'Active' : 'Inactive', accent: watched.isActive ? 'green' as const : 'amber' as const },
      ]}
      factBoxTitle="GST Group insight"
      factBoxSummary={[
        { label: 'Used in', value: 'Item Master, HSN Master, GST Rate Master' },
        { label: 'Linked HSN', value: String(hsnCount) },
        { label: 'Last modified', value: existing ? formatDate(existing.updatedAt.slice(0, 10)) : 'New record' },
      ]}
      stickyFooter={(
        <MasterStickyFooter
          isEdit={isEdit}
          isSubmitting={isSubmitting}
          onSave={() => save('default')}
          onSaveClose={() => save('close')}
          onSaveNew={() => save('new')}
          onCancel={cancelForm}
        />
      )}
    >
      <MasterFormSection
        sectionId="general"
        activeSection={activeSection}
        id="gstg-section-general"
        title="General"
        subtitle="Code, goods type, and description."
        icon={FileText}
        accent="blue"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <MasterCodeField
            entityType="gst_group"
            isEdit={isEdit}
            existingCode={existing?.code}
            value={watched.code ?? ''}
            onChange={(v) => setValue('code', v, { shouldValidate: true })}
            onSeriesReady={(h) => { codeSeriesRef.current = h }}
            error={errors.code?.message}
            required
          />
          <FormField label="GST Goods Type" required error={errors.goodsType?.message}>
            <Select {...register('goodsType')}>
              <option value="goods">Goods</option>
              <option value="service">Service</option>
            </Select>
          </FormField>
          <FormField label="Description" required error={errors.description?.message} className="md:col-span-2">
            <Textarea rows={3} {...register('description')} placeholder="Standard 18% GST on manufactured goods" />
          </FormField>
          <FormField label="Status">
            <Checkbox {...register('isActive')} label="Active" />
          </FormField>
        </div>
      </MasterFormSection>

      <MasterFormSection
        sectionId="related"
        activeSection={activeSection}
        id="gstg-section-related"
        title="Related HSN Codes"
        subtitle="HSN master records linked to this GST group."
        icon={Link2}
        accent="violet"
      >
        {isEdit && id ? (
          hsnCount > 0 ? (
            <ul className="divide-y divide-erp-border rounded-md border border-erp-border">
              {hsnMasters.filter((h) => h.gstGroupId === id).map((h) => (
                <li key={h.id} className="flex items-center justify-between px-4 py-2.5 text-[13px]">
                  <span className="font-mono font-semibold text-erp-primary">{h.code}</span>
                  <span className="text-erp-muted">{h.description}</span>
                  <Link to={`/masters/hsn/${h.id}`} className="text-[12px] font-semibold text-erp-primary hover:underline">
                    View
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-erp-muted">No HSN codes linked yet. Assign this group on the HSN Master.</p>
          )
        ) : (
          <p className="text-[13px] text-erp-muted">Save the GST group first, then link HSN codes from HSN Master.</p>
        )}
      </MasterFormSection>
    </EnterpriseMasterWorkspace>
  )
}

export function GstGroupDetailPage() {
  const { id } = useParams()
  const record = useMasterStore((s) => (id ? s.getGstGroup(id) : undefined))
  const hsnMasters = useMasterStore((s) => s.hsnMasters)
  const hsnLinks = useMemo(() => hsnMasters.filter((h) => h.gstGroupId === id), [hsnMasters, id])

  if (!record) return <MasterNotFound message="GST group not found." />

  return (
    <DetailLayout
      backTo="/masters/gst-groups"
      backLabel="Back to GST Groups"
      masterGroupId="tax"
      title={record.code}
      subtitle={record.description}
      recordNo={record.code}
      isActive={record.isActive}
      editTo={`/masters/gst-groups/${record.id}/edit`}
      badges={<ActiveBadge isActive={record.isActive} />}
      documentStrip={[
        { label: 'Code', value: record.code, highlight: true },
        { label: 'Goods Type', value: GST_GOODS_TYPE_LABELS[record.goodsType] },
        { label: 'Status', value: record.isActive ? 'Active' : 'Inactive' },
      ]}
      formMetrics={[
        { label: 'HSN Links', value: String(hsnLinks.length), accent: 'blue' },
        { label: 'Modified', value: formatDate(record.updatedAt.slice(0, 10)), accent: 'violet' },
      ]}
      factBoxSummary={[
        { label: 'Used in', value: 'Item, HSN, GST Rate masters' },
        { label: 'Linked HSN', value: String(hsnLinks.length) },
        { label: 'Goods type', value: GST_GOODS_TYPE_LABELS[record.goodsType] },
      ]}
      sectionNavItems={[
        { id: 'general', label: 'General', icon: FileText, done: true },
        { id: 'related', label: 'Related Records', icon: Link2, done: hsnLinks.length > 0 },
      ]}
    >
      <DetailSection title="General" sectionId="general">
        <DetailGrid>
          <DetailField label="Code" value={record.code} />
          <DetailField label="GST Goods Type" value={GST_GOODS_TYPE_LABELS[record.goodsType]} />
          <DetailField label="Description" value={record.description} />
          <DetailField label="Status" value={record.isActive ? 'Active' : 'Inactive'} />
          <DetailField label="Last modified" value={formatDate(record.updatedAt.slice(0, 10))} />
        </DetailGrid>
      </DetailSection>
      <DetailSection title="Related HSN Codes" sectionId="related">
        <DetailGrid>
          {hsnLinks.length ? hsnLinks.map((h) => (
            <DetailField key={h.id} label={h.code} value={(
              <Link to={`/masters/hsn/${h.id}`} className="text-erp-primary hover:underline">{h.description}</Link>
            )} />
          )) : <DetailField label="HSN" value="No linked HSN codes" />}
        </DetailGrid>
      </DetailSection>
    </DetailLayout>
  )
}
