/**
 * Structural CRM M3 checks.
 */
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const required = [
  'src/api/crmApi.ts',
  'src/types/crm.ts',
  'src/features/crm/hooks.ts',
  'src/features/crm/offlineDrafts.ts',
  'app/(app)/(tabs)/customers.tsx',
  'app/(app)/crm/leads/index.tsx',
  'app/(app)/crm/leads/[id].tsx',
  'app/(app)/crm/follow-ups/index.tsx',
  'app/(app)/crm/quotations/index.tsx',
  'app/(app)/crm/opportunities/index.tsx',
  'app/(app)/crm/search.tsx',
  'app/(app)/crm/collection.tsx',
  'app/(app)/crm/meetings/create.tsx',
]

for (const rel of required) {
  assert.ok(existsSync(join(root, rel)), `missing ${rel}`)
}

console.log('M3 CRM structural checks: PASS')
