/**
 * One-off Phase 11: migrate config, bridge, and auth shim imports.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

const REPLACEMENTS: Array<[RegExp, string]> = [
  [/from ['"]@\/services\/api\/config['"]/g, "from '@/config/apiConfig'"],
  [/from ['"]\.\.\/services\/api\/config['"]/g, "from '../config/apiConfig'"],
  [/from ['"]\.\.\/\.\.\/services\/api\/config['"]/g, "from '../../config/apiConfig'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/services\/api\/config['"]/g, "from '../../../config/apiConfig'"],
  [/from ['"]@\/services\/api\/crmApiAuth['"]/g, "from '@/services/api/authApi'"],
  [/from ['"]\.\.\/services\/api\/crmApiBridge['"]/g, "from '../services/bridges/crmApiBridge'"],
  [/from ['"]\.\.\/\.\.\/services\/api\/crmApiBridge['"]/g, "from '../../services/bridges/crmApiBridge'"],
  [/from ['"]\.\.\/services\/api\/masterApiBridge['"]/g, "from '../services/bridges/masterApiBridge'"],
  [/from ['"]\.\.\/services\/api\/masterBatchApiBridge['"]/g, "from '../services/bridges/masterBatchApiBridge'"],
  [/from ['"]\.\.\/\.\.\/services\/api\/masterBatchApiBridge['"]/g, "from '../../services/bridges/masterBatchApiBridge'"],
  [/from ['"]\.\.\/\.\.\/\.\.\/services\/api\/crmMasterApiBridge['"]/g, "from '../../../services/bridges/crmMasterApiBridge'"],
  [/import\('\.\.\/store\/bootstrap\/crmBootstrap'\)/g, "import('../demo/factories/crmEcosystemBootstrap')"],
  [/from ['"]\.\.\/data\/crm\/quotationTemplates['"]/g, "from '../data/quotations/quotationTemplates'"],
  [/from ['"]\.\/templates\/isoTank26Kl['"]/g, "from '../../quotations/templates/isoTank26Kl'"],
  [/from ['"]\.\/crmPermissions['"]/g, "from './permissions/crm'"],
  [/import\('\.\.\/services\/api\/crmApiBridge'\)/g, "import('../services/bridges/crmApiBridge')"],
  [/import\('\.\.\/services\/api\/masterApiBridge'\)/g, "import('../services/bridges/masterApiBridge')"],
  [/import\('\.\.\/services\/api\/masterBatchApiBridge'\)/g, "import('../services/bridges/masterBatchApiBridge')"],
]

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = path.join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry !== 'node_modules') walk(p, files)
    } else if (entry.endsWith('.ts') || entry.endsWith('.tsx')) {
      files.push(p)
    }
  }
  return files
}

let count = 0
for (const file of walk(SRC)) {
  const original = readFileSync(file, 'utf8')
  let next = original
  for (const [re, rep] of REPLACEMENTS) {
    next = next.replace(re, rep)
  }
  if (next !== original) {
    writeFileSync(file, next, 'utf8')
    count++
    console.log('  updated', path.relative(ROOT, file))
  }
}

// AuthProvider uses crmApi for auth — fix explicitly
const authProvider = path.join(SRC, 'context', 'AuthProvider.tsx')
let ap = readFileSync(authProvider, 'utf8')
if (ap.includes("from '../services/api/crmApi'")) {
  ap = ap.replace("import * as authApi from '../services/api/crmApi'", "import * as authApi from '../services/api/authApi'")
  writeFileSync(authProvider, ap, 'utf8')
  console.log('  updated context/AuthProvider.tsx (authApi)')
  count++
}

// quotationApiBridge: split crmApi + quotationApi
const qBridge = path.join(SRC, 'services', 'bridges', 'quotationApiBridge.ts')
let qb = readFileSync(qBridge, 'utf8')
if (!qb.includes("from '../api/quotationApi'")) {
  qb = qb.replace(
    "import * as api from '../api/crmApi'",
    "import * as crmApi from '../api/crmApi'\nimport * as quotationApi from '../api/quotationApi'",
  )
  qb = qb.replace(/api\.(QuotationApiDto|createQuotationApi|updateQuotationApi|updateQuotationDocumentApi|createQuotationRevisionApi|submitQuotationDocumentApprovalApi|approveQuotationDocumentApi|rejectQuotationDocumentApi|markQuotationDocumentSentApi|deleteQuotationApi|fetchQuotationApi)/g, 'quotationApi.$1')
  qb = qb.replace(/api\.QuotationApiDto/g, 'quotationApi.QuotationApiDto')
  qb = qb.replace(/api\.fetchAllCrmPages/g, 'crmApi.fetchAllCrmPages')
  qb = qb.replace(/dto: api\.QuotationApiDto/g, 'dto: quotationApi.QuotationApiDto')
  qb = qb.replace(/api\.QuotationApiDto\[\]/g, 'quotationApi.QuotationApiDto[]')
  writeFileSync(qBridge, qb, 'utf8')
  console.log('  updated services/bridges/quotationApiBridge.ts')
  count++
}

console.log(`\nMigrated ${count} files.`)
