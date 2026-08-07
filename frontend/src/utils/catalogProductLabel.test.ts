import { describe, expect, it } from 'vitest'
import {
  formatCodeNameLabel,
  isLikelyUuid,
  resolveCatalogProductDisplay,
  resolveCatalogProductLabel,
} from './catalogProductLabel'
import type { Item, Product } from '../types/master'

const item = {
  id: '0203a1a2-4c77-403c-beaf-c9c85d4c6f20',
  itemCode: 'FG-ISO-20',
  itemName: 'ISO Tank 20KL',
} as Item

const product = {
  id: 'prod-iso',
  productCode: 'ISO-20',
  productName: 'ISO Tank Trailer',
} as Product

describe('catalogProductLabel', () => {
  it('detects UUIDs', () => {
    expect(isLikelyUuid('0203a1a2-4c77-403c-beaf-c9c85d4c6f20')).toBe(true)
    expect(isLikelyUuid('FG-ISO-20')).toBe(false)
  })

  it('formats code — name', () => {
    expect(formatCodeNameLabel('FG-ISO-20', 'ISO Tank 20KL')).toBe('FG-ISO-20 — ISO Tank 20KL')
    expect(formatCodeNameLabel('FG-ISO-20', '')).toBe('FG-ISO-20')
  })

  it('resolves item UUID stored on productId (sales header dual-read)', () => {
    const label = resolveCatalogProductLabel(
      { productId: item.id, itemId: item.id },
      { items: [item], products: [product] },
    )
    expect(label).toBe('FG-ISO-20 — ISO Tank 20KL')
    expect(label).not.toContain('0203a1a2')
  })

  it('prefers item master when productId is an item UUID not on Product master', () => {
    const display = resolveCatalogProductDisplay(item.id, { items: [item], products: [] })
    expect(display.code).toBe('FG-ISO-20')
    expect(display.name).toBe('ISO Tank 20KL')
  })

  it('falls back to product master codes', () => {
    expect(resolveCatalogProductLabel(product.id, { items: [], products: [product] })).toBe(
      'ISO-20 — ISO Tank Trailer',
    )
  })

  it('never returns raw UUID when masters miss', () => {
    expect(resolveCatalogProductLabel(item.id, { items: [], products: [] })).toBe('-')
  })

  it('uses line productOrItem only when not a UUID', () => {
    expect(
      resolveCatalogProductLabel(
        {
          productId: item.id,
          lines: [{ productOrItem: 'Custom scope text' }],
        },
        { items: [], products: [] },
      ),
    ).toBe('Custom scope text')

    expect(
      resolveCatalogProductLabel(
        {
          productId: item.id,
          lines: [{ productOrItem: item.id }],
        },
        { items: [], products: [] },
      ),
    ).toBe('-')
  })

  it('uses itemCodeSnapshot when present', () => {
    expect(
      resolveCatalogProductLabel(
        {
          productId: item.id,
          lines: [{ itemCodeSnapshot: 'SNAP-01', itemNameSnapshot: 'Snap Item' }],
        },
        { items: [], products: [] },
      ),
    ).toBe('SNAP-01 — Snap Item')
  })
})
