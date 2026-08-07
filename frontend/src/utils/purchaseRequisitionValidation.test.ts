import { describe, expect, it } from 'vitest'
import { prDepartmentLabel, resolvePrDepartmentDisplay } from './purchaseRequisitionValidation'

describe('resolvePrDepartmentDisplay', () => {
  it('prefers API departmentName over id', () => {
    expect(
      resolvePrDepartmentDisplay('795be403-0588-4a81-b3ea-9f755f60c329', 'Purchase'),
    ).toBe('Purchase')
  })

  it('maps legacy department codes', () => {
    expect(resolvePrDepartmentDisplay('PURCHASE', null)).toBe('Purchase')
    expect(prDepartmentLabel('PURCHASE')).toBe('Purchase')
  })

  it('hides raw UUID when name is missing', () => {
    expect(
      resolvePrDepartmentDisplay('795be403-0588-4a81-b3ea-9f755f60c329', null),
    ).toBe('—')
  })
})
