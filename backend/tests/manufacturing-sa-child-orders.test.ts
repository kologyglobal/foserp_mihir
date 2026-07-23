/**
 * Unit-style checks for Tank SA child WO ordering + SA receipt route wiring.
 * Run: npx vitest run tests/manufacturing-sa-child-orders.test.ts
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { PREFERRED_CHILD_ITEM_CODES } from '../src/modules/manufacturing/work-orders/child-orders.service.js'

describe('Manufacturing SA child orders + SA receipt wiring', () => {
  it('prefers Tank SA first in child explode order', () => {
    expect(PREFERRED_CHILD_ITEM_CODES[0]).toBe('SA-TANK-ASM')
    expect([...PREFERRED_CHILD_ITEM_CODES]).toEqual([
      'SA-TANK-ASM',
      'SA-CHASSIS',
      'SA-RUN-GEAR',
      'SA-PAINT-SYS',
    ])
  })

  it('work-order routes mount generate-child-orders and sa-receipts', () => {
    const routes = readFileSync(
      path.resolve('src/modules/manufacturing/work-orders/work-order.routes.ts'),
      'utf8',
    )
    expect(routes).toContain('generate-child-orders')
    expect(routes).toContain('sa-receipts')
    expect(routes).toContain('/:id/children')
  })

  it('inventory movements expose /sa-receipt', () => {
    const routes = readFileSync(
      path.resolve('src/modules/inventory/movements/movement.routes.ts'),
      'utf8',
    )
    expect(routes).toContain("'/sa-receipt'")
    expect(routes).toContain('postSaReceipt')
  })

  it('SO convert schema accepts generateChildOrders', () => {
    const schemas = readFileSync(
      path.resolve('src/modules/manufacturing/demands/demand.schemas.ts'),
      'utf8',
    )
    expect(schemas).toContain('generateChildOrders')
  })
})
