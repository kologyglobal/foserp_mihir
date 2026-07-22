/**
 * Scans backend route modules and writes OpenAPI path stubs for every
 * Express endpoint that is not already hand-documented in swagger.ts.
 *
 * Usage: npx tsx scripts/generate-swagger-paths.ts
 * Output: src/config/swagger.generated-paths.ts
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { swaggerSpec } from '../src/config/swagger.js'

type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete'

interface RouteOp {
  method: HttpMethod
  /** OpenAPI path relative to /api/v1, e.g. /t/{tenantSlug}/manufacturing/job-work/{id} */
  openApiPath: string
  source: string
}

const METHODS = new Set(['get', 'post', 'put', 'patch', 'delete'])
const HTTP_RE = /\b(?:router|app)\.(get|post|put|patch|delete)\(\s*([`'"])([\s\S]*?)\2/g
const USE_RE = /\b(?:router|app)\.use\(\s*([`'"])(\/[^`'"]*)\1\s*,\s*([A-Za-z_][\w]*)/g
const IMPORT_RE =
  /import\s+(?:(\w+)\s*,\s*)?(?:\{\s*([^}]+)\s*\}\s*,?\s*)?(?:(\w+)\s*)?from\s+['"]([^'"]+)['"]/g

// ... later in collectNestedMounts, replace the import loop:

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(__dirname, '../src')

/** Mount prefixes applied in app.ts for tenant slug form (canonical for docs). */
const APP_MOUNTS: Array<{ prefix: string; importHint: string }> = [
  { prefix: '/auth', importHint: 'auth.routes' },
  { prefix: '/tenants', importHint: 'tenant.routes' },
  { prefix: '/t/{tenantSlug}/users', importHint: 'user.routes' },
  { prefix: '/t/{tenantSlug}/roles', importHint: 'role.routes' },
  { prefix: '/t/{tenantSlug}/crm', importHint: 'crm.routes' },
  { prefix: '/t/{tenantSlug}/masters/items', importHint: 'item.routes' },
  { prefix: '/t/{tenantSlug}/masters/vendors', importHint: 'vendor.routes' },
  { prefix: '/t/{tenantSlug}/masters/imports', importHint: 'import.routes' },
  { prefix: '/t/{tenantSlug}/masters/exports', importHint: 'export.routes' },
  { prefix: '/t/{tenantSlug}/masters', importHint: 'masters.routes' },
  { prefix: '/t/{tenantSlug}/inventory', importHint: 'inventory.routes' },
  { prefix: '/t/{tenantSlug}/inventory', importHint: 'inventory-masters.routes' },
  { prefix: '/t/{tenantSlug}/lookups/items', importHint: 'item.routes' },
  { prefix: '/t/{tenantSlug}/lookups/vendors', importHint: 'vendor.routes' },
  { prefix: '/t/{tenantSlug}/lookups', importHint: 'lookups.routes' },
  { prefix: '/t/{tenantSlug}/accounting', importHint: 'accounting.routes' },
  { prefix: '/t/{tenantSlug}/manufacturing', importHint: 'manufacturing.routes' },
  { prefix: '/t/{tenantSlug}/purchase', importHint: 'purchase.routes' },
  { prefix: '/t/{tenantSlug}/quality', importHint: 'quality.routes' },
  { prefix: '/t/{tenantSlug}/dispatch', importHint: 'dispatch.routes' },
  { prefix: '/t/{tenantSlug}/reports', importHint: 'ops-reports.routes' },
  { prefix: '/t/{tenantSlug}/operations/exceptions', importHint: 'exception.routes' },
]

function toOpenApiSegment(expressPath: string): string {
  return expressPath
    .replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, '{$1}')
    .replace(/\/{2,}/g, '/')
    .replace(/\/$/, '') || '/'
}

function joinUrl(base: string, child: string): string {
  if (!child || child === '/') return base || '/'
  if (!base || base === '/') return child.startsWith('/') ? child : `/${child}`
  const left = base.endsWith('/') ? base.slice(0, -1) : base
  const right = child.startsWith('/') ? child : `/${child}`
  return `${left}${right}`
}

function listRouteFiles(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue
      listRouteFiles(full, out)
    } else if (/\.routes\.ts$/.test(entry.name) || entry.name.endsWith('.router.ts')) {
      out.push(full)
    }
  }
  return out
}

function resolveImport(fromFile: string, spec: string): string | null {
  if (!spec.startsWith('.')) return null
  // TS imports often end with `.js` (NodeNext); map to `.ts` on disk.
  const cleaned = spec.replace(/\.js$/, '')
  const base = path.resolve(path.dirname(fromFile), cleaned)
  for (const candidate of [base, `${base}.ts`, `${base}.js`, path.join(base, 'index.ts')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

interface FileMount {
  mount: string
  file: string
}

/** Recursively collect router.use('/x', childRouter) mounts from an aggregator file. */
function collectNestedMounts(file: string, prefix: string, visited = new Set<string>()): FileMount[] {
  if (visited.has(file)) return []
  visited.add(file)
  const src = fs.readFileSync(file, 'utf8')
  const localImports = new Map<string, string>()

  for (const m of src.matchAll(IMPORT_RE)) {
    const defaultName = m[1] || m[3]
    const named = m[2]
    const spec = m[4]
    const resolved = resolveImport(file, spec)
    if (!resolved) continue
    if (defaultName) localImports.set(defaultName, resolved)
    if (named) {
      for (const part of named.split(',')) {
        const id = part.trim().split(/\s+as\s+/).pop()?.trim()
        if (id) localImports.set(id, resolved)
      }
    }
  }

  const mounts: FileMount[] = [{ mount: prefix, file }]

  for (const m of src.matchAll(USE_RE)) {
    const mountPath = m[2]
    const binding = m[3]
    const childFile = localImports.get(binding)
    if (!childFile) continue
    const next = joinUrl(prefix, toOpenApiSegment(mountPath))
    mounts.push(...collectNestedMounts(childFile, next, visited))
  }

  return mounts
}

function extractOpsFromFile(file: string, prefix: string): RouteOp[] {
  const src = fs.readFileSync(file, 'utf8')
  const ops: RouteOp[] = []
  for (const m of src.matchAll(HTTP_RE)) {
    const method = m[1].toLowerCase() as HttpMethod
    if (!METHODS.has(method)) continue
    let routePath = m[3].trim()
    // Skip template literals with ${} interpolation — rare; leave for hand docs
    if (routePath.includes('${')) continue
    if (!routePath.startsWith('/')) routePath = `/${routePath}`
    const openApiPath = joinUrl(prefix, toOpenApiSegment(routePath))
    ops.push({
      method,
      openApiPath,
      source: path.relative(SRC, file).replace(/\\/g, '/'),
    })
  }
  return ops
}

function tagFor(openApiPath: string): string {
  const parts = openApiPath.split('/').filter(Boolean)
  const domainIdx = parts[0] === 't' || parts[0] === 'tenants' ? 2 : 0
  const domain = parts[domainIdx] ?? 'API'
  const sub = parts[domainIdx + 1]
  const title = (s: string) =>
    s
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
  if (!sub || sub.startsWith('{')) return title(domain)
  return `${title(domain)} — ${title(sub)}`
}

function summaryFor(method: HttpMethod, openApiPath: string): string {
  const leaf = openApiPath.split('/').filter(Boolean).pop() ?? openApiPath
  const action =
    method === 'get'
      ? leaf.startsWith('{')
        ? 'Get'
        : 'List / get'
      : method === 'post'
        ? leaf.startsWith('{')
          ? 'Action'
          : 'Create / action'
        : method === 'patch' || method === 'put'
          ? 'Update'
          : 'Delete'
  return `${action} ${leaf.replace(/[{}]/g, '')}`
}

function pathParams(openApiPath: string): Array<Record<string, unknown>> {
  const names = [...openApiPath.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/g)].map((m) => m[1])
  return names.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: {
      type: 'string',
      ...(name.toLowerCase().includes('id') || name === 'tenantId' ? { format: 'uuid' } : {}),
      ...(name === 'tenantSlug' ? { example: 'vasant-trailers' } : {}),
    },
  }))
}

function findModuleFile(hint: string): string | null {
  const normalized = hint.replace(/\\/g, '/').replace(/\.ts$/, '')
  const all = listRouteFiles(path.join(SRC, 'modules'))
  const matches = all.filter((f) => {
    const rel = f.replace(/\\/g, '/').replace(/\.ts$/, '')
    return rel.endsWith(`/${normalized}`) || rel.endsWith(normalized) || path.basename(rel) === path.basename(normalized)
  })
  if (matches.length >= 1) {
    // Prefer exact basename match when multiple
    const exact = matches.find((f) => path.basename(f).replace(/\.ts$/, '') === path.basename(normalized))
    return exact ?? matches[0]
  }
  return null
}

function main() {
  // Also document health
  const allOps: RouteOp[] = [
    { method: 'get', openApiPath: '/health', source: 'app.ts' },
  ]

  for (const mount of APP_MOUNTS) {
    const file = findModuleFile(mount.importHint.endsWith('.ts') ? mount.importHint : `${mount.importHint}.ts`)
      ?? findModuleFile(mount.importHint)
    if (!file) {
      console.warn(`WARN: could not resolve route module for ${mount.importHint}`)
      continue
    }
    const nested = collectNestedMounts(file, mount.prefix)
    for (const n of nested) {
      allOps.push(...extractOpsFromFile(n.file, n.mount))
    }
  }

  // Auth is not under /t — add auth routes with /auth prefix (already in APP_MOUNTS)
  // Deduplicate
  const byKey = new Map<string, RouteOp>()
  for (const op of allOps) {
    const key = `${op.method} ${op.openApiPath}`
    if (!byKey.has(key)) byKey.set(key, op)
  }
  const unique = [...byKey.values()]

  const existing = new Set<string>()
  const handPaths = (swaggerSpec as { paths?: Record<string, Record<string, unknown>> }).paths ?? {}
  for (const [p, methods] of Object.entries(handPaths)) {
    for (const m of Object.keys(methods)) {
      if (METHODS.has(m)) existing.add(`${m} ${p}`)
    }
  }

  const generated: Record<string, Record<string, unknown>> = {}
  let added = 0
  let skipped = 0
  const tags = new Set<string>()

  for (const op of unique.sort((a, b) => a.openApiPath.localeCompare(b.openApiPath) || a.method.localeCompare(b.method))) {
    const key = `${op.method} ${op.openApiPath}`
    const alt = key.replace('/t/{tenantSlug}', '/tenants/{tenantId}')
    if (existing.has(key) || existing.has(alt)) {
      skipped += 1
      continue
    }
    const tag = tagFor(op.openApiPath)
    tags.add(tag)
    if (!generated[op.openApiPath]) generated[op.openApiPath] = {}
    generated[op.openApiPath][op.method] = {
      tags: [tag],
      summary: summaryFor(op.method, op.openApiPath),
      description: `Auto-generated stub from \`${op.source}\`. Enrich in \`swagger.ts\` when needed.`,
      parameters: pathParams(op.openApiPath),
      responses: {
        200: { description: 'Success' },
        400: { description: 'Validation error' },
        401: { description: 'Unauthorized' },
        403: { description: 'Forbidden' },
        404: { description: 'Not found' },
      },
    }
    added += 1
  }

  const outFile = path.resolve(__dirname, '../src/config/swagger.generated-paths.ts')
  const tagList = [...tags].sort()
  const body = `/**
 * AUTO-GENERATED — do not edit by hand.
 * Run: npx tsx scripts/generate-swagger-paths.ts
 * Generated: ${new Date().toISOString()}
 * Stubs added: ${added} (skipped already documented: ${skipped}; scanned ops: ${unique.length})
 */

export const generatedSwaggerTags = ${JSON.stringify(
    tagList.map((name) => ({ name, description: 'Auto-generated from Express routes' })),
    null,
    2,
  )} as const

export const generatedSwaggerPaths: Record<string, Record<string, unknown>> = ${JSON.stringify(generated, null, 2)}
`

  fs.writeFileSync(outFile, body, 'utf8')
  console.log(`Wrote ${outFile}`)
  console.log(`Added stubs: ${added}`)
  console.log(`Already documented (skipped): ${skipped}`)
  console.log(`Unique ops scanned: ${unique.length}`)
  console.log(`Generated tags: ${tagList.length}`)
}

main()
