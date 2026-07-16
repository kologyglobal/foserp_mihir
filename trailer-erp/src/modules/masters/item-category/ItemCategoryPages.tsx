import { useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, useWatch, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import {
  MasterListShell,
  CoreMasterRowActions,
  STATUS_FILTER_OPTIONS,
  matchesStatusFilter,
} from '../../../components/masters/MasterListShell'
import {
  DetailLayout,
  DetailSection,
  DetailGrid,
  DetailField,
  FormLayout,
  MasterNotFound,
} from '../../../components/masters/MasterLayouts'
import { ActiveBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Checkbox } from '../../../components/forms/Inputs'
import { MasterCodeField } from '../../../components/masters/MasterCodeField'
import type { MasterCodeSeriesHandle } from '../../../hooks/useMasterCodeSeries'
import { useMasterStore } from '../../../store/masterStore'
import { resolveMaybeId, resolveMaybeVoid } from '../../../store/storeAction'
import { formatApiError } from '../../../services/api/apiErrors'
import { notifyMasterSaved } from '../../../store/toastStore'
import type { ItemCategory } from '../../../types/master'

const schema = z.object({
  categoryCode: z.string().min(1).max(20),
  categoryName: z.string().min(1),
  parentId: z.string().nullable(),
  level: z.coerce.number().min(1).max(3),
  defaultWarehouseId: z.string().nullable(),
  isActive: z.boolean(),
})

type FormData = z.infer<typeof schema>

export function ItemCategoryListPage() {
  const categories = useMasterStore((s) => s.categories)
  const deleteCategory = useMasterStore((s) => s.deleteCategory)
  const activateCategory = useMasterStore((s) => s.activateCategory)
  const deactivateCategory = useMasterStore((s) => s.deactivateCategory)
  const getCategoryName = useMasterStore((s) => s.getCategoryName)
  const getWarehouseName = useMasterStore((s) => s.getWarehouseName)
  const getItemCountByCategory = useMasterStore((s) => s.getItemCountByCategory)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')

  const filtered = useMemo(
    () =>
      categories.filter(
        (c) =>
          matchesStatusFilter(c.isActive, status) &&
          (c.categoryCode.toLowerCase().includes(search.toLowerCase()) ||
            c.categoryName.toLowerCase().includes(search.toLowerCase())),
      ),
    [categories, search, status],
  )

  const columns: ColumnDef<ItemCategory, unknown>[] = [
    {
      accessorKey: 'categoryCode',
      header: 'Code',
      cell: ({ row }) => (
        <span className="font-mono font-medium">{row.original.categoryCode}</span>
      ),
    },
    { accessorKey: 'categoryName', header: 'Name' },
    {
      id: 'parent',
      header: 'Parent',
      cell: ({ row }) =>
        row.original.parentId ? getCategoryName(row.original.parentId) : '—',
    },
    { accessorKey: 'level', header: 'Level' },
    {
      id: 'warehouse',
      header: 'Default Warehouse',
      cell: ({ row }) =>
        row.original.defaultWarehouseId
          ? getWarehouseName(row.original.defaultWarehouseId)
          : '—',
    },
    {
      id: 'items',
      header: 'Items',
      cell: ({ row }) => getItemCountByCategory(row.original.id),
    },
    {
      accessorKey: 'isActive',
      header: 'Status',
      cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      enableSorting: false,
      cell: ({ row }) => (
        <CoreMasterRowActions
          viewTo={`/masters/item-categories/${row.original.id}`}
          editTo={`/masters/item-categories/${row.original.id}/edit`}
          recordId={row.original.id}
          recordLabel={`${row.original.categoryCode} — ${row.original.categoryName}`}
          isActive={row.original.isActive}
          deleteRecord={deleteCategory}
          activateRecord={activateCategory}
          deactivateRecord={deactivateCategory}
        />
      ),
    },
  ]

  return (
    <MasterListShell
      title="Item Category Master"
      description="Hierarchical classification for raw materials and bought-out parts"
      masterGroupId="foundation"
      createLabel="New Category"
      createTo="/masters/item-categories/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      stats={[
        { label: 'Categories', value: categories.length },
        { label: 'Leaf Categories', value: categories.filter((c) => c.level >= 2).length },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function ItemCategoryFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useMasterStore((s) => (id ? s.getCategory(id) : undefined))
  const categories = useMasterStore((s) => s.categories)
  const warehouses = useMasterStore((s) => s.warehouses)
  const addCategory = useMasterStore((s) => s.addCategory)
  const updateCategory = useMasterStore((s) => s.updateCategory)
  const isEdit = Boolean(id && existing)
  const [saveError, setSaveError] = useState<string | null>(null)
  const codeSeriesRef = useRef<MasterCodeSeriesHandle | null>(null)

  const { register, handleSubmit, control, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing ?? { categoryCode: '', categoryName: '', level: 2, isActive: true, parentId: null, defaultWarehouseId: null },
  })
  const watched = useWatch({ control })

  const onSubmit = handleSubmit((data) => {
    void (async () => {
      const validation = codeSeriesRef.current?.validateBeforeSave(data.categoryCode, {
        checkDuplicate: (c) => categories.some((cat) => cat.categoryCode === c && cat.id !== id),
      })
      if (validation && !validation.ok) {
        setSaveError(validation.message ?? 'Invalid code')
        return
      }
      setSaveError(null)
      const payload = {
        ...data,
        parentId: data.parentId || null,
        defaultWarehouseId: data.defaultWarehouseId || null,
        level: data.parentId
          ? (categories.find((c) => c.id === data.parentId)?.level ?? 0) + 1
          : 1,
      }
      try {
        if (isEdit && id) {
          await resolveMaybeVoid(updateCategory(id, payload))
          notifyMasterSaved('Item Category', false)
          navigate(`/masters/item-categories/${id}`)
        } else {
          const newId = await resolveMaybeId(addCategory(payload))
          codeSeriesRef.current?.confirmSaved(data.categoryCode)
          notifyMasterSaved('Item Category', true)
          navigate(`/masters/item-categories/${newId}`)
        }
      } catch (err) {
        setSaveError(formatApiError(err))
      }
    })()
  })

  function cancelForm() {
    codeSeriesRef.current?.releaseOnCancel()
    navigate('/masters/item-categories')
  }

  const validationErrors = [...Object.values(errors).map((e) => e?.message).filter(Boolean) as string[], ...(saveError ? [saveError] : [])]

  return (
    <FormLayout
      masterGroupId="inventory"
      backTo="/masters/item-categories"
      backLabel="Back to Item Categories"
      title={isEdit ? 'Edit Category' : 'Create Category'}
      onSubmit={onSubmit}
      isSubmitting={isSubmitting}
      validationErrors={validationErrors}
      onCancel={cancelForm}
    >
      <MasterCodeField
        entityType="item_category"
        isEdit={isEdit}
        existingCode={existing?.categoryCode}
        value={watched.categoryCode ?? ''}
        onChange={(v) => setValue('categoryCode', v, { shouldValidate: true })}
        onSeriesReady={(h) => { codeSeriesRef.current = h }}
        error={errors.categoryCode?.message}
        label="Category Code"
        required
      />
      <FormField label="Category Name" required error={errors.categoryName?.message}>
        <Input {...register('categoryName')} error={!!errors.categoryName} />
      </FormField>
      <FormField label="Parent Category">
        <Select {...register('parentId')}>
          <option value="">None (Root)</option>
          {categories.filter((c) => c.id !== id).map((c) => (
            <option key={c.id} value={c.id}>{c.categoryName}</option>
          ))}
        </Select>
      </FormField>
      <FormField label="Default Warehouse">
        <Select {...register('defaultWarehouseId')}>
          <option value="">— Select —</option>
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>{w.warehouseName}</option>
          ))}
        </Select>
      </FormField>
      <div className="flex items-end">
        <Checkbox label="Active" {...register('isActive')} />
      </div>
    </FormLayout>
  )
}

export function ItemCategoryDetailPage() {
  const { id } = useParams()
  const category = useMasterStore((s) => (id ? s.getCategory(id) : undefined))
  const getCategoryName = useMasterStore((s) => s.getCategoryName)
  const getWarehouseName = useMasterStore((s) => s.getWarehouseName)
  const getItemCountByCategory = useMasterStore((s) => s.getItemCountByCategory)
  const allItems = useMasterStore((s) => s.items)
  const items = useMemo(() => allItems.filter((i) => i.categoryId === id), [allItems, id])

  if (!category) return <MasterNotFound message="Category not found." />

  return (
    <DetailLayout
      masterGroupId="foundation"
      backTo="/masters/item-categories"
      backLabel="Back to Item Categories"
      title={category.categoryName}
      subtitle={category.categoryCode}
      editTo={`/masters/item-categories/${category.id}/edit`}
      badges={<ActiveBadge isActive={category.isActive} />}
    >
      <div className="space-y-6">
        <DetailSection title="Category Details">
          <DetailGrid>
            <DetailField label="Code" value={<span className="font-mono">{category.categoryCode}</span>} />
            <DetailField label="Parent" value={category.parentId ? getCategoryName(category.parentId) : 'Root'} />
            <DetailField label="Level" value={category.level} />
            <DetailField label="Default Warehouse" value={category.defaultWarehouseId ? getWarehouseName(category.defaultWarehouseId) : '—'} />
            <DetailField label="Linked Items" value={getItemCountByCategory(category.id)} />
          </DetailGrid>
        </DetailSection>
        {items.length > 0 && (
          <DetailSection title="Items in this Category">
            <table className="erp-table">
              <thead><tr><th>Code</th><th>Name</th><th>Status</th></tr></thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td className="font-mono text-xs">{i.itemCode}</td>
                    <td>{i.itemName}</td>
                    <td><ActiveBadge isActive={i.isActive} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DetailSection>
        )}
      </div>
    </DetailLayout>
  )
}
