import { InventoryReferenceType } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import {
  deriveInventoryAccountingEventType,
  isManufacturingOwnedReferenceType,
} from '../src/modules/inventory/accounting/inventory-accounting-builder.service.js'
import {
  INVENTORY_REFERENCE_TYPE_REGISTRY,
  listInventoryReferenceTypes,
} from '../src/modules/inventory/shared/inventory-reference-type.registry.js'

const ALL_REFERENCE_TYPES = Object.values(InventoryReferenceType)

describe('inventory reference type registry — completeness', () => {
  it('has exactly one entry per InventoryReferenceType enum value', () => {
    const registryKeys = Object.keys(INVENTORY_REFERENCE_TYPE_REGISTRY).sort()
    const enumValues = [...ALL_REFERENCE_TYPES].sort()
    expect(registryKeys).toEqual(enumValues)
  })

  it('every entry is keyed by its own code', () => {
    for (const referenceType of ALL_REFERENCE_TYPES) {
      expect(INVENTORY_REFERENCE_TYPE_REGISTRY[referenceType].code).toBe(referenceType)
    }
  })

  it('listInventoryReferenceTypes() returns one row per enum value', () => {
    expect(listInventoryReferenceTypes()).toHaveLength(ALL_REFERENCE_TYPES.length)
  })

  it('every entry declares a non-empty label, description and requiredPermission', () => {
    for (const meta of listInventoryReferenceTypes()) {
      expect(meta.label.length).toBeGreaterThan(0)
      expect(meta.description.length).toBeGreaterThan(0)
      expect(meta.requiredPermission.length).toBeGreaterThan(0)
    }
  })
})

describe('inventory reference type registry — drift guard vs live accounting-builder logic', () => {
  it('registry ownerModule=MANUFACTURING matches isManufacturingOwnedReferenceType() exactly', () => {
    for (const referenceType of ALL_REFERENCE_TYPES) {
      const registeredAsManufacturing = INVENTORY_REFERENCE_TYPE_REGISTRY[referenceType].ownerModule === 'MANUFACTURING'
      expect(registeredAsManufacturing).toBe(isManufacturingOwnedReferenceType(referenceType))
    }
  })

  it('registry postsToGl agrees with deriveInventoryAccountingEventType() for known GL-relevant types', () => {
    const glRelevant: Array<[InventoryReferenceType, number]> = [
      ['GRN', 10],
      ['GRN', -10],
      ['CONTROLLED_ADJUSTMENT', 5],
      ['ADJUSTMENT_REVERSAL', -5],
      ['STOCK_COUNT', 3],
      ['STOCK_COUNT_REVERSAL', -3],
      ['FG_DISPATCH', -2],
      ['FG_DISPATCH', 2],
    ]
    for (const [referenceType, signedQuantity] of glRelevant) {
      expect(deriveInventoryAccountingEventType(referenceType, signedQuantity)).not.toBeNull()
      expect(INVENTORY_REFERENCE_TYPE_REGISTRY[referenceType].postsToGl).toBe(true)
    }
  })

  it('manufacturing-owned reference types never derive an inventory-accounting GL event', () => {
    for (const referenceType of ALL_REFERENCE_TYPES) {
      if (isManufacturingOwnedReferenceType(referenceType)) {
        expect(deriveInventoryAccountingEventType(referenceType, 1)).toBeNull()
        expect(deriveInventoryAccountingEventType(referenceType, -1)).toBeNull()
      }
    }
  })

  it('flags the two reserved gap types with no live posting caller', () => {
    expect(INVENTORY_REFERENCE_TYPE_REGISTRY.SALES_RETURN.reserved).toBe(true)
    expect(INVENTORY_REFERENCE_TYPE_REGISTRY.REQUISITION_ISSUE.reserved).toBe(true)
  })
})
