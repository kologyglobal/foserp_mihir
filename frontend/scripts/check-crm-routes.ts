/**
 * Smoke-check: required CRM paths are declared in route source files.
 * Avoids importing React route modules (path aliases / JSX).
 *
 * Run: npx tsx scripts/check-crm-routes.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const routesDir = path.resolve(rootDir, '../src/routes')

const REQUIRED: Array<{ path: string; mustInclude: string[] }> = [
  { path: '/crm', mustInclude: ["index: true"] },
  { path: '/crm/leads', mustInclude: ["path: 'leads'"] },
  { path: '/crm/leads/new', mustInclude: ["path: 'leads/new'"] },
  { path: '/crm/customers', mustInclude: ["path: 'customers'"] },
  { path: '/crm/contacts', mustInclude: ["path: 'contacts'"] },
  { path: '/crm/opportunities', mustInclude: ["path: 'opportunities'"] },
  { path: '/crm/opportunities/new', mustInclude: ["path: 'opportunities/new'"] },
  { path: '/crm/forecast', mustInclude: ["path: 'forecast'"] },
  { path: '/crm/masters', mustInclude: ["path: 'masters'"] },
  { path: '/crm/quotation-templates', mustInclude: ["path: 'quotation-templates'"] },
]

const sources = ['crmRoutes.tsx', 'quotationRoutes.tsx', 'index.tsx']
  .map((name) => fs.readFileSync(path.join(routesDir, name), 'utf8'))
  .join('\n\n')

const missing: string[] = []
for (const item of REQUIRED) {
  const ok = item.mustInclude.every((needle) => sources.includes(needle))
  if (!ok) missing.push(item.path)
}

const spaGuards = [
  { file: path.resolve(rootDir, '../nginx.conf'), needle: 'try_files $uri $uri/ /index.html;' },
  { file: path.resolve(rootDir, '../public/.htaccess'), needle: 'RewriteRule . /index.html [L]' },
  { file: path.resolve(rootDir, '../vite.config.ts'), needle: "proxy:" },
]

const spaMissing: string[] = []
for (const g of spaGuards) {
  if (!fs.existsSync(g.file) || !fs.readFileSync(g.file, 'utf8').includes(g.needle)) {
    spaMissing.push(`${path.basename(g.file)} (missing ${JSON.stringify(g.needle)})`)
  }
}

if (missing.length || spaMissing.length) {
  if (missing.length) {
    console.error('CRM route smoke check FAILED. Missing route declarations:')
    for (const p of missing) console.error(`  - ${p}`)
  }
  if (spaMissing.length) {
    console.error('SPA fallback / Vite proxy checks failed:')
    for (const p of spaMissing) console.error(`  - ${p}`)
  }
  process.exit(1)
}

console.log('CRM route smoke check PASSED')
for (const item of REQUIRED) console.log(`  ✓ ${item.path}`)
console.log('  ✓ nginx SPA try_files')
console.log('  ✓ public/.htaccess SPA fallback')
console.log('  ✓ Vite /api proxy')
