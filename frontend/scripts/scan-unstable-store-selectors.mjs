// Finds Zustand selectors that allocate a new array/object on every call.
// Zustand v5 feeds the selector straight into useSyncExternalStore, which
// compares snapshots with Object.is, so such selectors re-render forever and
// crash the page with "Maximum update depth exceeded" as soon as they mount.
//
// Exit code 1 when any HARD finding remains.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../src', import.meta.url))

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

/** Reads the balanced argument list starting at the `(` index. */
function readArgs(src, openIdx) {
  let depth = 0
  for (let i = openIdx; i < src.length; i += 1) {
    const ch = src[i]
    if (ch === '(' || ch === '[' || ch === '{') depth += 1
    else if (ch === ')' || ch === ']' || ch === '}') {
      depth -= 1
      if (depth === 0) return { body: src.slice(openIdx + 1, i), end: i }
    }
  }
  return null
}

const ALLOCATING = [
  { re: /\.filter\s*\($/, why: '.filter()' },
  { re: /\.map\s*\($/, why: '.map()' },
  { re: /\.slice\s*\($/, why: '.slice()' },
  { re: /\.sort\s*\($/, why: '.sort()' },
  { re: /\.concat\s*\($/, why: '.concat()' },
  { re: /\.flatMap\s*\($/, why: '.flatMap()' },
  { re: /\.reverse\s*\($/, why: '.reverse()' },
  { re: /Object\.(values|keys|entries)\s*\($/, why: 'Object.values/keys/entries()' },
  { re: /Array\.from\s*\($/, why: 'Array.from()' },
]

/** Reports which allocation the selector's outermost expression performs, if any. */
function classify(selectorBody) {
  const body = selectorBody.trim()
  if (!body) return null

  const arrow = body.indexOf('=>')
  if (arrow === -1) return null
  const expr = body.slice(arrow + 2).trim().replace(/,+$/, '').trim()

  // Block-bodied selectors need manual review — flag any that return a literal.
  if (expr.startsWith('{')) {
    return /return\s*[[{]/.test(expr) ? { level: 'HARD', why: 'block body returns literal' } : null
  }

  if (expr.startsWith('[')) return { level: 'HARD', why: 'array literal' }
  if (expr.startsWith('({')) return { level: 'HARD', why: 'object literal' }

  // `s.foo ?? []` allocates a fresh empty array on the fallback path.
  if (/(\?\?|\|\|)\s*(\[\s*\]|\{\s*\})$/.test(expr)) {
    return { level: 'HARD', why: 'empty literal fallback (?? [])' }
  }

  // Walk from the end to isolate the outermost trailing call.
  if (!expr.endsWith(')')) return null
  let depth = 0
  let start = -1
  for (let i = expr.length - 1; i >= 0; i -= 1) {
    const ch = expr[i]
    if (ch === ')' || ch === ']' || ch === '}') depth += 1
    else if (ch === '(' || ch === '[' || ch === '{') {
      depth -= 1
      if (depth === 0) {
        start = i
        break
      }
    }
  }
  if (start <= 0) return null
  const head = expr.slice(0, start + 1)
  for (const { re, why } of ALLOCATING) {
    if (re.test(head)) return { level: 'HARD', why }
  }

  const getter = head.match(/^\w+\.(\w+)\($/)
  if (getter) return { level: 'CHECK', why: `store getter ${getter[1]}()` }
  return null
}

const files = walk(ROOT)

/**
 * Indexes getter bodies per store hook. Getter names collide across stores
 * (several define `getRequest`), so lookups must be scoped to the hook that
 * the selector actually reads from. Only the `create(...)` implementation is
 * indexed — the `interface XState` block above it declares the same names.
 */
function indexStoreGetters() {
  const byHook = new Map()
  for (const file of files.filter((f) => f.includes(`${sep}store${sep}`))) {
    const src = readFileSync(file, 'utf8')
    for (const decl of src.matchAll(/export const (use\w+) = create\b/g)) {
      const impl = src.slice(decl.index)
      const getters = new Map()
      const re = /^\s{2,}(\w+):\s*\(([^)]*)\)\s*=>/gm
      let m
      while ((m = re.exec(impl))) {
        getters.set(m[1], impl.slice(re.lastIndex, re.lastIndex + 600))
      }
      byHook.set(decl[1], getters)
    }
  }
  return byHook
}

const GETTERS_BY_HOOK = indexStoreGetters()

/** true = reference-stable, false = allocates, null = unknown. */
function getterIsStable(hook, name) {
  const body = GETTERS_BY_HOOK.get(hook)?.get(name)
  if (!body) return null
  const head = body.split('\n').slice(0, 12).join('\n')
  if (head.includes('memoizedOnSource')) return true
  // Isolate the returned expression, whether inline or after `return`.
  const returned = (head.trim().startsWith('{') ? /return\s+([\s\S]*)/.exec(head)?.[1] : head) ?? head
  const firstExpr = returned.split('\n')[0]
  if (/\.\.\.|\.map\(|\.filter\(|\.sort\(|\.slice\(|\.concat\(/.test(firstExpr)) return false
  // Scalar reads and `.find()` lookups hand back references that already exist.
  return /\.find\(|get\(\)\.[\w.?[\]]+\s*(\?\?|===|!==|\|\||\)|,|$)/.test(firstExpr)
}

const findings = []

for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const STORE_CALL = /\buse[A-Z]\w*(?:Store|State)\s*\(/g
  let m
  while ((m = STORE_CALL.exec(src))) {
    const args = readArgs(src, m.index + m[0].length - 1)
    if (!args) continue
    const kind = classify(args.body)
    if (!kind) continue

    const hook = m[0].slice(0, -1).trim()
    let { level, why } = kind
    if (level === 'CHECK') {
      const getter = why.match(/store getter (\w+)\(\)/)?.[1]
      const stable = getter ? getterIsStable(hook, getter) : null
      if (stable === true) continue
      level = stable === false ? 'HARD' : 'CHECK'
      why = stable === false ? `${why} allocates a new value` : `${why} — verify manually`
    }

    findings.push({
      file: relative(ROOT, file).replace(/\\/g, '/'),
      line: src.slice(0, m.index).split('\n').length,
      hook: m[0].slice(0, -1),
      level,
      why,
    })
  }
}

findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line)
for (const level of ['HARD', 'CHECK']) {
  const rows = findings.filter((f) => f.level === level)
  console.log(`\n=== ${level} (${rows.length}) ===`)
  for (const f of rows) {
    console.log(`${f.file}:${f.line}  ${f.hook}  → ${f.why}`)
  }
}

process.exit(findings.some((f) => f.level === 'HARD') ? 1 : 0)
