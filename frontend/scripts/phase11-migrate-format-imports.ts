/**
 * One-off Phase 11: split utils/format imports into formatters/currency + dates/format.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(ROOT, 'src')

const CURRENCY = new Set(['formatCurrency', 'formatCompactCurrency', 'formatNumber'])
const DATES = new Set(['formatDate', 'formatDateTime', 'formatRecentTime', 'formatRelativeTime'])

const IMPORT_RE =
  /^import\s*\{([^}]+)\}\s*from\s*['"]([^'"]*\/format|\.\/format|@\/utils\/format)['"]\s*;?\s*$/m

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

function baseFromFormatPath(formatPath: string): string {
  if (formatPath === '@/utils/format') return '@/utils'
  if (formatPath === './format') return '.'
  return formatPath.replace(/\/format$/, '')
}

function migrateFile(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf8')
  let changed = false
  const next = content.replace(IMPORT_RE, (full, namesRaw: string, fromPath: string) => {
    const names = namesRaw
      .split(',')
      .map((n) => n.trim())
      .filter(Boolean)
      .map((n) => n.replace(/^type\s+/, ''))
    const currency = names.filter((n) => CURRENCY.has(n.replace(/^type\s+/, '')))
    const dates = names.filter((n) => DATES.has(n.replace(/^type\s+/, '')))
    const unknown = names.filter((n) => {
      const bare = n.replace(/^type\s+/, '')
      return !CURRENCY.has(bare) && !DATES.has(bare)
    })
    if (unknown.length > 0) {
      console.warn(`  skip ${path.relative(ROOT, filePath)}: unknown names ${unknown.join(', ')}`)
      return full
    }
    const base = baseFromFormatPath(fromPath)
    const lines: string[] = []
    if (currency.length) {
      const suffix = base === '.' ? './formatters/currency' : `${base}/formatters/currency`
      lines.push(`import { ${currency.join(', ')} } from '${suffix}'`)
    }
    if (dates.length) {
      const suffix = base === '.' ? './dates/format' : `${base}/dates/format`
      lines.push(`import { ${dates.join(', ')} } from '${suffix}'`)
    }
    changed = true
    return lines.join('\n')
  })
  if (changed) writeFileSync(filePath, next, 'utf8')
  return changed
}

let count = 0
for (const file of walk(SRC)) {
  if (file.endsWith('utils/format.ts')) continue
  if (migrateFile(file)) {
    count++
    console.log('  updated', path.relative(ROOT, file))
  }
}
console.log(`\nMigrated ${count} files.`)
