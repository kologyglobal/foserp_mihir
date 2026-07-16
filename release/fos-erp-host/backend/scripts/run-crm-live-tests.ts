import { config } from 'dotenv'
import { spawnSync } from 'node:child_process'

config()

process.env.RUN_CRM_E2E = 'true'
process.env.DB_NAME ??= process.env.CRM_E2E_DB_NAME ?? 'fos_erp'

const result = spawnSync(
  'npx',
  ['vitest', 'run', 'tests/crm-e2e.test.ts', 'tests/crm-tenant-isolation.test.ts'],
  { stdio: 'inherit', shell: true, env: process.env },
)

process.exit(result.status ?? 1)
