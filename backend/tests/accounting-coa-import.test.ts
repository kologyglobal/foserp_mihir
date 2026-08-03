/**
 * Unit/regression tests for CoA CSV import parsing + service helpers.
 * Run: npx vitest run tests/accounting-coa-import.test.ts
 */
import { describe, expect, it } from 'vitest'
import { accountImportTemplateCsv } from '../src/modules/accounting/accounts/account-import.service.js'
import { accountImportSchema } from '../src/modules/accounting/accounts/account.validation.js'

describe('Chart of Accounts CSV import', () => {
  it('template has mandatory headers', () => {
    const csv = accountImportTemplateCsv()
    const header = csv.split('\n')[0] ?? ''
    expect(header).toContain('Account Code')
    expect(header).toContain('Account Name')
    expect(header).toContain('Account Type')
    expect(header).toContain('Category')
    expect(header).toContain('Parent Account Code')
    expect(csv.split('\n').length).toBeGreaterThan(2)
  })

  it('accountImportSchema accepts template-shaped rows', () => {
    const parsed = accountImportSchema.parse({
      legalEntityId: '11111111-1111-1111-1111-111111111111',
      duplicateMode: 'skip',
      rows: [
        {
          'Account Code': '1000',
          'Account Name': 'Assets',
          'Account Type': 'Group',
          Category: 'Asset',
          'Parent Account Code': '',
          'Normal Balance': 'Debit',
          'Direct Posting': 'N',
          'Control Account': 'N',
          Active: 'Y',
        },
      ],
    })
    expect(parsed.rows).toHaveLength(1)
    expect(parsed.duplicateMode).toBe('skip')
  })
})
