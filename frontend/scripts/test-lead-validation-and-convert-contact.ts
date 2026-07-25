/**
 * Lead create validation + convert contact transfer regression checks.
 */
import assert from 'node:assert/strict'
import {
  getLeadCreateValidationError,
  validateLeadForm,
} from '../src/utils/validation/crmSchemas/leadSchema.ts'

const today = new Date().toISOString().slice(0, 10)

function baseValid(overrides: Record<string, unknown> = {}) {
  return {
    prospectName: 'Acme Logistics',
    customerId: null,
    leadOwnerId: 'user-1',
    priority: 'medium',
    createdDate: today,
    email: '',
    mobile: '9876543210',
    mobileCountry: 'IN',
    contactPerson: 'Rajesh Patel',
    contactId: null,
    remarks: 'First enquiry call notes',
    leadStage: 'new' as const,
    requirementText: '',
    hasRequirementLines: false,
    expectedCloseDate: '',
    nextFollowUpDate: '',
    activityStatus: 'active',
    inactiveReason: '',
    notQualifiedReason: '',
    closedDate: '',
    closedReason: '',
    isEdit: false,
    ...overrides,
  }
}

// Empty notes must pass (optional)
{
  const errors = validateLeadForm(baseValid({ remarks: '   ' }))
  assert.equal(errors.remarks, undefined)
  assert.deepEqual(errors, {})
}

// Valid payload passes
{
  const errors = validateLeadForm(baseValid())
  assert.deepEqual(errors, {})
}

// Store/bridge guard rejects incomplete create (missing priority)
{
  const err = getLeadCreateValidationError({
    prospectName: 'X',
    leadOwnerId: 'user-1',
    createdDate: today,
    stage: 'new',
  })
  assert.ok(err)
}

// Blank notes must not block create guard
{
  const err = getLeadCreateValidationError({
    prospectName: 'X',
    leadOwnerId: 'user-1',
    priority: 'medium',
    createdDate: today,
    stage: 'new',
    remarks: '',
  })
  assert.equal(err, null)
}

// Bridge convert must send contactId (static source check)
{
  const fs = await import('node:fs')
  const bridge = fs.readFileSync(new URL('../src/services/bridges/crmApiBridge.ts', import.meta.url), 'utf8')
  assert.match(bridge, /convertLeadApi\([\s\S]*contactId/)
}

console.log('lead-validation-and-convert-contact: ok')
