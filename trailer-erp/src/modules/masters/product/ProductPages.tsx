import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { type ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MasterRegisterTable } from '../../../components/masters/MasterRegisterTable'
import { MasterListShell, RowActions, STATUS_FILTER_OPTIONS, matchesStatusFilter } from '../../../components/masters/MasterListShell'
import { FormLayout, FormSection } from '../../../components/masters/MasterLayouts'
import { ActiveBadge, TypeBadge } from '../../../components/ui/StatusBadge'
import { FormField } from '../../../components/forms/FormField'
import { Input, Select, Checkbox, Textarea } from '../../../components/forms/Inputs'
import { useMasterStore } from '../../../store/masterStore'
import { useProductMasterStore } from '../../../store/productMasterStore'
import { resolveMaybeId } from '../../../store/storeAction'
import { useFgItems } from '../../../hooks/useMasterLists'
import { formatCurrency } from '../../../utils/formatters/currency'
import { productStatusColor } from '../../../utils/productMaster'
import type { Product, ProductType } from '../../../types/master'
import { PRODUCT_CATEGORY_LABELS, PRODUCT_FAMILY_LABELS, PRODUCT_STATUS_LABELS } from '../../../types/productMaster'
import type { ProductCategory, ProductFamily, ProductStatus } from '../../../types/productMaster'
import { PRODUCT_TYPE_LABELS } from '../../../types/master'

export { ProductDetailPage } from './ProductDetailPage'

const familyKeys = Object.keys(PRODUCT_FAMILY_LABELS) as [ProductFamily, ...ProductFamily[]]
const typeKeys = Object.keys(PRODUCT_TYPE_LABELS) as [Product['productType'], ...Product['productType'][]]

const schema = z.object({
  productCode: z.string().min(1),
  productName: z.string().min(1),
  productFamily: z.enum(familyKeys),
  productType: z.enum(typeKeys),
  fgItemId: z.string().min(1),
  capacity: z.string(),
  axleConfig: z.string(),
  tareWeightKg: z.coerce.number().min(0),
  gvwKg: z.coerce.number().min(0),
  standardPrice: z.coerce.number().min(0),
  standardLeadDays: z.coerce.number().min(1),
  baseUomId: z.string().min(1),
  hsnCode: z.string(),
  specifications: z.string(),
  isActive: z.boolean(),
  engineeringOwner: z.string().min(1),
  revisionReason: z.string(),
})

type FormData = z.infer<typeof schema>

export function ProductListPage() {
  const products = useMasterStore((s) => s.products)
  const getItem = useMasterStore((s) => s.getItem)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [familyFilter, setFamilyFilter] = useState('all')
  const [materialFilter, setMaterialFilter] = useState('all')

  const materials = useMemo(() => {
    const set = new Set<string>()
    for (const p of products) {
      if (p.material?.trim()) set.add(p.material.trim())
    }
    return [...set].sort()
  }, [products])

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const s = search.toLowerCase()
        const category = String(p.productCategory ?? '')
        const familyLabel = PRODUCT_FAMILY_LABELS[p.productFamily] ?? p.productFamily
        const hay = [
          p.productCode,
          p.productName,
          familyLabel,
          category,
          p.capacity,
          p.material ?? '',
          p.vehicleGvwLabel ?? '',
        ].join(' ').toLowerCase()
        return (
          matchesStatusFilter(p.isActive, status) &&
          (statusFilter === 'all' || p.status === statusFilter) &&
          (categoryFilter === 'all' || category === categoryFilter) &&
          (familyFilter === 'all' || p.productFamily === familyFilter) &&
          (materialFilter === 'all' || (p.material ?? '') === materialFilter) &&
          (!s || hay.includes(s))
        )
      }),
    [products, search, status, statusFilter, categoryFilter, familyFilter, materialFilter],
  )

  const columns: ColumnDef<Product, unknown>[] = [
    { accessorKey: 'productCode', header: 'Code', cell: ({ row }) => <span className="font-mono text-xs font-medium">{row.original.productCode}</span> },
    { accessorKey: 'productName', header: 'Product Name' },
    {
      id: 'category',
      header: 'Category',
      cell: ({ row }) => {
        const cat = row.original.productCategory as ProductCategory | undefined
        return cat ? (PRODUCT_CATEGORY_LABELS[cat] ?? cat) : '—'
      },
    },
    {
      accessorKey: 'productFamily',
      header: 'Family',
      cell: ({ row }) => PRODUCT_FAMILY_LABELS[row.original.productFamily] ?? row.original.productFamily,
    },
    {
      id: 'variant',
      header: 'Capacity / Variant',
      cell: ({ row }) => row.original.capacity || (row.original.isConfigurableParent ? 'Configurable' : '—'),
    },
    {
      id: 'material',
      header: 'Material',
      cell: ({ row }) => row.original.material || '—',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => <TypeBadge value={row.original.status} color={productStatusColor(row.original.status)} />,
    },
    {
      id: 'fgItem',
      header: 'FG Item',
      cell: ({ row }) => {
        const fg = getItem(row.original.fgItemId)
        return fg ? <Link to={`/masters/items/${fg.id}`} className="font-mono text-xs text-erp-accent hover:underline">{fg.itemCode}</Link> : '—'
      },
    },
    { accessorKey: 'standardPrice', header: 'List Price', cell: ({ row }) => row.original.standardPrice > 0 ? formatCurrency(row.original.standardPrice) : '—' },
    { accessorKey: 'isActive', header: 'Active', cell: ({ row }) => <ActiveBadge isActive={row.original.isActive} /> },
    { id: 'actions', header: 'Actions', enableSorting: false, cell: ({ row }) => <RowActions viewTo={`/masters/products/${row.original.id}`} editTo={`/masters/products/${row.original.id}/edit`} /> },
  ]

  return (
    <MasterListShell
      title="Product Master"
      description="Vasant Fabricators portfolio — category → family → product → variant"
      masterGroupId="engineering"
      createLabel="New Product"
      createTo="/masters/products/new"
      search={search}
      onSearchChange={setSearch}
      statusFilter={status}
      onStatusFilterChange={setStatus}
      statusOptions={STATUS_FILTER_OPTIONS}
      resultCount={filtered.length}
      extraFilters={
        <>
          <Select wrapClassName="w-40" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="all">All Categories</option>
            {(Object.keys(PRODUCT_CATEGORY_LABELS) as ProductCategory[]).map((c) => (
              <option key={c} value={c}>{PRODUCT_CATEGORY_LABELS[c]}</option>
            ))}
          </Select>
          <Select wrapClassName="w-48" value={familyFilter} onChange={(e) => setFamilyFilter(e.target.value)}>
            <option value="all">All Families</option>
            {(Object.keys(PRODUCT_FAMILY_LABELS) as ProductFamily[]).map((f) => (
              <option key={f} value={f}>{PRODUCT_FAMILY_LABELS[f]}</option>
            ))}
          </Select>
          <Select wrapClassName="w-40" value={materialFilter} onChange={(e) => setMaterialFilter(e.target.value)}>
            <option value="all">All Materials</option>
            {materials.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </Select>
          <Select wrapClassName="w-40" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="all">All Lifecycles</option>
            {(Object.keys(PRODUCT_STATUS_LABELS) as ProductStatus[]).map((st) => (
              <option key={st} value={st}>{PRODUCT_STATUS_LABELS[st]}</option>
            ))}
          </Select>
        </>
      }
      stats={[
        { label: 'Products', value: products.length },
        { label: 'Released', value: products.filter((p) => p.status === 'released').length },
        { label: 'Fuel variants', value: products.filter((p) => p.parentProductCode === 'PRD-FUEL-TANK').length },
      ]}
    >
      <MasterRegisterTable data={filtered} columns={columns} />
    </MasterListShell>
  )
}

export function ProductFormPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = useMasterStore((s) => (id ? s.getProduct(id) : undefined))
  const uoms = useMasterStore((s) => s.uoms)
  const fgItems = useFgItems()
  const addProduct = useMasterStore((s) => s.addProduct)
  const updateWithLog = useProductMasterStore((s) => s.updateProductWithLog)
  const isEdit = Boolean(id && existing)

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema) as Resolver<FormData>,
    defaultValues: existing
      ? {
          productCode: existing.productCode,
          productName: existing.productName,
          productFamily: existing.productFamily,
          productType: existing.productType,
          fgItemId: existing.fgItemId,
          capacity: existing.capacity,
          axleConfig: existing.axleConfig,
          tareWeightKg: existing.tareWeightKg,
          gvwKg: existing.gvwKg,
          standardPrice: existing.standardPrice,
          standardLeadDays: existing.standardLeadDays,
          baseUomId: existing.baseUomId,
          hsnCode: existing.hsnCode,
          specifications: existing.specifications,
          isActive: existing.isActive,
          engineeringOwner: existing.engineeringOwner,
          revisionReason: existing.revisionReason,
        }
      : {
          productType: 'bulker' as ProductType,
          productFamily: 'bulker_trailer' as ProductFamily,
          baseUomId: uoms.find((u) => u.uomCode === 'NOS')?.id ?? '',
          standardLeadDays: 45,
          isActive: true,
          engineeringOwner: '',
          revisionReason: 'Initial creation',
        },
  })

  const onSubmit = handleSubmit(async (data) => {
    if (isEdit && id) {
      updateWithLog(id, data, 'Product master edit')
      navigate(`/masters/products/${id}`)
    } else {
      const newId = await resolveMaybeId(addProduct({ ...data, status: 'draft' as ProductStatus }))
      navigate(`/masters/products/${newId}`)
    }
  })

  return (
    <FormLayout masterGroupId="inventory" backTo="/masters/products" backLabel="Back to Products" title={isEdit ? 'Edit Product' : 'Create Product'} onSubmit={onSubmit} isSubmitting={isSubmitting}>
      <FormSection title="Product Identity">
        <FormField label="Product Code" required error={errors.productCode?.message}><Input {...register('productCode')} disabled={isEdit} error={!!errors.productCode} /></FormField>
        <FormField label="Product Name" required error={errors.productName?.message}><Input {...register('productName')} error={!!errors.productName} /></FormField>
        <FormField label="Product Family" required>
          <Select {...register('productFamily')}>
            {(Object.keys(PRODUCT_FAMILY_LABELS) as ProductFamily[]).map((f) => (
              <option key={f} value={f}>{PRODUCT_FAMILY_LABELS[f]}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="Product Type" required>
          <Select {...register('productType')}>
            {(Object.keys(PRODUCT_TYPE_LABELS) as Product['productType'][]).map((t) => (
              <option key={t} value={t}>{PRODUCT_TYPE_LABELS[t]}</option>
            ))}
          </Select>
        </FormField>
        <FormField label="FG Item" required error={errors.fgItemId?.message}>
          <Select {...register('fgItemId')} disabled={isEdit}>
            <option value="">— Select —</option>
            {fgItems.map((i) => <option key={i.id} value={i.id}>{i.itemCode} — {i.itemName}</option>)}
          </Select>
        </FormField>
        <FormField label="UOM" required error={errors.baseUomId?.message}><Select {...register('baseUomId')}>{uoms.map((u) => <option key={u.id} value={u.id}>{u.uomCode}</option>)}</Select></FormField>
        <FormField label="Capacity"><Input {...register('capacity')} placeholder="e.g. 40 KL" /></FormField>
        <FormField label="Axle Config"><Input {...register('axleConfig')} placeholder="e.g. 3-Axle" /></FormField>
        <FormField label="Engineering Owner" required><Input {...register('engineeringOwner')} /></FormField>
      </FormSection>
      <FormSection title="Commercial">
        <FormField label="List Price (INR)" required><Input type="number" {...register('standardPrice')} /></FormField>
        <FormField label="Lead Time (days)" required><Input type="number" {...register('standardLeadDays')} /></FormField>
        <FormField label="HSN"><Input {...register('hsnCode')} /></FormField>
        <FormField label="Tare (kg)"><Input type="number" {...register('tareWeightKg')} /></FormField>
        <FormField label="GVW (kg)"><Input type="number" {...register('gvwKg')} /></FormField>
        <div className="flex items-end"><Checkbox label="Active" {...register('isActive')} /></div>
      </FormSection>
      <FormSection title="Specifications">
        <FormField label="Description / Specs" className="md:col-span-2"><Textarea {...register('specifications')} rows={4} /></FormField>
        <FormField label="Change Reason"><Input {...register('revisionReason')} /></FormField>
      </FormSection>
    </FormLayout>
  )
}
