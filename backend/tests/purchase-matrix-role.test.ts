import { describe, expect, it } from 'vitest'
import {
  matrixEnumToApi,
  normalizeMatrixRoleApi,
} from '../src/modules/purchase/shared/purchase-matrix-role.js'

describe('purchase matrix role helpers', () => {
  it('normalizes api role strings', () => {
    expect(normalizeMatrixRoleApi('purchase_head')).toBe('purchase_head')
    expect(normalizeMatrixRoleApi('Department Head')).toBe('department_head')
    expect(normalizeMatrixRoleApi('')).toBeNull()
  })

  it('maps prisma enums to api roles', () => {
    expect(matrixEnumToApi('DEPARTMENT_HEAD')).toBe('department_head')
    expect(matrixEnumToApi('FINANCE_HEAD')).toBe('finance_head')
    expect(matrixEnumToApi('MANAGEMENT')).toBe('management')
    expect(matrixEnumToApi('PURCHASE_HEAD')).toBe('purchase_head')
  })
})
