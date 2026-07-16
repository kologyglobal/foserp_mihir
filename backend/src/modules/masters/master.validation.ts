import { z } from 'zod'
import { paginationSchema } from '../../utils/pagination.js'

export const MASTER_REGISTRY_SLUGS = [
  'countries',
  'states',
  'cities',
  'uom',
  'warehouses',
  'locations',
  'item-categories',
  'hsn-sac',
  'gst-groups',
  'gst-rates',
  'products',
] as const

export const masterResourceParamSchema = z.object({
  resource: z.enum(MASTER_REGISTRY_SLUGS),
})

export const listMastersQuerySchema = paginationSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  stateId: z.string().uuid().optional(),
  warehouseId: z.string().uuid().optional(),
  gstGroupId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
})

const codeNameBase = {
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
}

export const createCountrySchema = z.object(codeNameBase)
export const updateCountrySchema = createCountrySchema.partial()

export const createStateSchema = z.object(codeNameBase)
export const updateStateSchema = createStateSchema.partial()

export const createCitySchema = z.object({
  stateId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})
export const updateCitySchema = createCitySchema.partial()

export const createUomSchema = z.object({
  ...codeNameBase,
  description: z.string().trim().max(500).optional(),
  uomType: z.enum(['integer', 'weight', 'length', 'volume']).default('integer'),
  decimalPlaces: z.coerce.number().int().min(0).max(6).default(0),
  isBaseUnit: z.boolean().optional(),
})
export const updateUomSchema = createUomSchema.partial()

export const createWarehouseSchema = z.object({
  ...codeNameBase,
  warehouseType: z.enum(['main', 'sub', 'wip', 'fg', 'quarantine']).default('main'),
  plantCode: z.string().trim().max(32).default('PUNE'),
  address: z.string().trim().max(2000).optional(),
})
export const updateWarehouseSchema = createWarehouseSchema.partial()

export const createLocationSchema = z.object({
  warehouseId: z.string().uuid(),
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  addressLine1: z.string().trim().max(300).optional(),
  addressLine2: z.string().trim().max(300).optional(),
  city: z.string().trim().max(100).optional(),
  state: z.string().trim().max(100).optional(),
  pincode: z.string().trim().max(16).optional(),
  country: z.string().trim().max(100).optional(),
  gstin: z.string().trim().max(15).optional(),
  registeredType: z.string().trim().max(64).optional(),
  allowSales: z.boolean().optional(),
  allowPurchase: z.boolean().optional(),
  allowProduction: z.boolean().optional(),
  allowInventory: z.boolean().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})
export const updateLocationSchema = createLocationSchema.partial()

export const createItemCategorySchema = z.object({
  code: z.string().trim().min(1).max(32),
  name: z.string().trim().min(1).max(200),
  parentId: z.string().uuid().nullable().optional(),
  level: z.coerce.number().int().min(1).max(3).default(1),
  defaultWarehouseId: z.string().uuid().nullable().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})
export const updateItemCategorySchema = createItemCategorySchema.partial()

export const createHsnSacSchema = z.object({
  code: z.string().trim().min(4).max(10),
  gstGroupId: z.string().uuid(),
  description: z.string().trim().min(1).max(500),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})
export const updateHsnSacSchema = createHsnSacSchema.partial()

export const createGstGroupSchema = z.object({
  code: z.string().trim().min(1).max(32),
  goodsType: z.enum(['goods', 'service']).default('goods'),
  description: z.string().trim().min(1).max(500),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})
export const updateGstGroupSchema = createGstGroupSchema.partial()

const gstRateBaseSchema = z.object({
  code: z.string().trim().min(1).max(32),
  gstGroupId: z.string().uuid(),
  fromState: z.string().trim().min(1).max(100),
  locationStateCode: z.string().trim().min(1).max(100),
  dateFrom: z.string().trim().min(1),
  dateTo: z.string().trim().nullable().optional(),
  sgst: z.coerce.number().min(0).max(100),
  cgst: z.coerce.number().min(0).max(100),
  igst: z.coerce.number().min(0).max(100),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})

function validateGstRateRules(
  data: z.infer<typeof gstRateBaseSchema>,
  ctx: z.RefinementCtx,
): void {
  if (data.dateTo && data.dateFrom && data.dateTo < data.dateFrom) {
    ctx.addIssue({ code: 'custom', message: 'Date To cannot be before Date From', path: ['dateTo'] })
  }
  const intra = data.fromState === data.locationStateCode
  if (intra) {
    if (Math.abs(data.sgst + data.cgst - data.igst) > 0.01) {
      ctx.addIssue({
        code: 'custom',
        message: 'Intra-state: SGST + CGST should equal IGST',
        path: ['igst'],
      })
    }
  } else if (data.sgst + data.cgst > 0) {
    ctx.addIssue({
      code: 'custom',
      message: 'Inter-state: use IGST only (SGST/CGST should be 0)',
      path: ['sgst'],
    })
  }
}

export const createGstRateSchema = gstRateBaseSchema.superRefine(validateGstRateRules)
export const updateGstRateSchema = gstRateBaseSchema.partial()

export const createProductSchema = z.object({
  code: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(300),
  productFamily: z.string().trim().min(1).max(64).default('bulker_trailer'),
  productType: z.string().trim().min(1).max(32).default('bulker'),
  fgItemId: z.string().trim().max(64).nullable().optional(),
  capacity: z.string().trim().max(100).optional(),
  axleConfig: z.string().trim().max(100).optional(),
  tareWeightKg: z.coerce.number().min(0).optional(),
  gvwKg: z.coerce.number().min(0).optional(),
  standardPrice: z.coerce.number().min(0).optional(),
  standardLeadDays: z.coerce.number().int().min(0).optional(),
  baseUomId: z.string().trim().max(64).nullable().optional(),
  hsnCode: z.string().trim().max(16).optional(),
  specifications: z.string().trim().max(5000).optional(),
  productStatus: z
    .enum(['draft', 'engineering_review', 'approved', 'released', 'obsolete'])
    .default('draft'),
  details: z.record(z.unknown()).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
})
export const updateProductSchema = createProductSchema.partial()

export type ListMastersQuery = z.infer<typeof listMastersQuerySchema>
export type CreateCountryInput = z.infer<typeof createCountrySchema>
export type CreateStateInput = z.infer<typeof createStateSchema>
export type CreateCityInput = z.infer<typeof createCitySchema>
export type CreateUomInput = z.infer<typeof createUomSchema>
export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>
export type CreateLocationInput = z.infer<typeof createLocationSchema>
export type CreateItemCategoryInput = z.infer<typeof createItemCategorySchema>
export type CreateHsnSacInput = z.infer<typeof createHsnSacSchema>
export type CreateGstGroupInput = z.infer<typeof createGstGroupSchema>
export type CreateGstRateInput = z.infer<typeof createGstRateSchema>
