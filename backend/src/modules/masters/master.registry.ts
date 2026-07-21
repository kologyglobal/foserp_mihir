import type { z } from 'zod'
import {
  createBinSchema,
  createCitySchema,
  createCountrySchema,
  createGstGroupSchema,
  createGstRateSchema,
  createHsnSacSchema,
  createItemCategorySchema,
  createLocationSchema,
  createPlantSchema,
  createProductSchema,
  createStateSchema,
  createUomSchema,
  createWarehouseSchema,
  listMastersQuerySchema,
  updateBinSchema,
  updateCitySchema,
  updateCountrySchema,
  updateGstGroupSchema,
  updateGstRateSchema,
  updateHsnSacSchema,
  updateItemCategorySchema,
  updateLocationSchema,
  updatePlantSchema,
  updateProductSchema,
  updateStateSchema,
  updateUomSchema,
  updateWarehouseSchema,
} from './master.validation.js'

export type MasterResourceSlug =
  | 'countries'
  | 'states'
  | 'cities'
  | 'uom'
  | 'plants'
  | 'warehouses'
  | 'locations'
  | 'storage-locations'
  | 'bins'
  | 'item-categories'
  | 'hsn-sac'
  | 'gst-groups'
  | 'gst-rates'
  | 'products'

export interface MasterResourceConfig {
  slug: MasterResourceSlug
  permissionKey: string
  prismaModel:
    | 'masterCountry'
    | 'masterState'
    | 'masterCity'
    | 'masterUom'
    | 'masterPlant'
    | 'masterWarehouse'
    | 'masterLocation'
    | 'masterBin'
    | 'masterItemCategory'
    | 'masterHsnCode'
    | 'masterGstGroup'
    | 'masterGstRate'
    | 'masterProduct'
  listQuerySchema: typeof listMastersQuerySchema
  createSchema: z.ZodTypeAny
  updateSchema: z.ZodTypeAny
  lookupFields: Array<'id' | 'code' | 'name' | 'description'>
}

export const MASTER_RESOURCES: Record<MasterResourceSlug, MasterResourceConfig> = {
  countries: {
    slug: 'countries',
    permissionKey: 'country',
    prismaModel: 'masterCountry',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createCountrySchema,
    updateSchema: updateCountrySchema,
    lookupFields: ['id', 'code', 'name'],
  },
  states: {
    slug: 'states',
    permissionKey: 'state',
    prismaModel: 'masterState',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createStateSchema,
    updateSchema: updateStateSchema,
    lookupFields: ['id', 'code', 'name'],
  },
  cities: {
    slug: 'cities',
    permissionKey: 'city',
    prismaModel: 'masterCity',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createCitySchema,
    updateSchema: updateCitySchema,
    lookupFields: ['id', 'name'],
  },
  uom: {
    slug: 'uom',
    permissionKey: 'uom',
    prismaModel: 'masterUom',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createUomSchema,
    updateSchema: updateUomSchema,
    lookupFields: ['id', 'code', 'name'],
  },
  plants: {
    slug: 'plants',
    permissionKey: 'plant',
    prismaModel: 'masterPlant',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createPlantSchema,
    updateSchema: updatePlantSchema,
    lookupFields: ['id', 'code', 'name'],
  },
  warehouses: {
    slug: 'warehouses',
    permissionKey: 'warehouse',
    prismaModel: 'masterWarehouse',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createWarehouseSchema,
    updateSchema: updateWarehouseSchema,
    lookupFields: ['id', 'code', 'name'],
  },
  locations: {
    slug: 'locations',
    permissionKey: 'location',
    prismaModel: 'masterLocation',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createLocationSchema,
    updateSchema: updateLocationSchema,
    lookupFields: ['id', 'code', 'name'],
  },
  // Alias for the GRN/inventory naming — same model as `locations`.
  'storage-locations': {
    slug: 'storage-locations',
    permissionKey: 'location',
    prismaModel: 'masterLocation',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createLocationSchema,
    updateSchema: updateLocationSchema,
    lookupFields: ['id', 'code', 'name'],
  },
  bins: {
    slug: 'bins',
    permissionKey: 'bin',
    prismaModel: 'masterBin',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createBinSchema,
    updateSchema: updateBinSchema,
    lookupFields: ['id', 'code', 'name'],
  },
  'item-categories': {
    slug: 'item-categories',
    permissionKey: 'item_category',
    prismaModel: 'masterItemCategory',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createItemCategorySchema,
    updateSchema: updateItemCategorySchema,
    lookupFields: ['id', 'code', 'name'],
  },
  'hsn-sac': {
    slug: 'hsn-sac',
    permissionKey: 'hsn',
    prismaModel: 'masterHsnCode',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createHsnSacSchema,
    updateSchema: updateHsnSacSchema,
    lookupFields: ['id', 'code', 'description'],
  },
  'gst-groups': {
    slug: 'gst-groups',
    permissionKey: 'gst_group',
    prismaModel: 'masterGstGroup',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createGstGroupSchema,
    updateSchema: updateGstGroupSchema,
    lookupFields: ['id', 'code', 'description'],
  },
  'gst-rates': {
    slug: 'gst-rates',
    permissionKey: 'gst_rate',
    prismaModel: 'masterGstRate',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createGstRateSchema,
    updateSchema: updateGstRateSchema,
    lookupFields: ['id', 'code'],
  },
  products: {
    slug: 'products',
    permissionKey: 'product',
    prismaModel: 'masterProduct',
    listQuerySchema: listMastersQuerySchema,
    createSchema: createProductSchema,
    updateSchema: updateProductSchema,
    lookupFields: ['id', 'code', 'name'],
  },
}

export const MASTER_RESOURCE_SLUGS = Object.keys(MASTER_RESOURCES) as MasterResourceSlug[]

export function getMasterResource(slug: string): MasterResourceConfig | null {
  return MASTER_RESOURCES[slug as MasterResourceSlug] ?? null
}

export function masterPermission(action: 'view' | 'create' | 'update' | 'delete', permissionKey: string): string {
  return `master.${permissionKey}.${action}`
}
