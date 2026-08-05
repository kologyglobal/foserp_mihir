/**
 * Store material-issue structural checks (no live backend required).
 * Run via: npm run test:unit
 */
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function src(rel: string) {
  return join(root, rel)
}

assert.ok(existsSync(src('src/features/store/api.ts')))
assert.ok(existsSync(src('src/features/store/hooks.ts')))
assert.ok(existsSync(src('app/(app)/store/material-issue/index.tsx')))

const api = readFileSync(src('src/features/store/api.ts'), 'utf8')
assert.match(api, /manufacturing\.materials\.issue/)
assert.match(api, /idempotencyKey/)
assert.match(api, /createIssueIdempotencyKey/)
assert.match(api, /materials\/issue/)
assert.match(api, /retries:\s*0/)
assert.ok(!api.includes('AsyncStorage'))

const screen = readFileSync(src('app/(app)/store/material-issue/index.tsx'), 'utf8')
assert.match(screen, /issueWorkOrderMaterial/)
assert.match(screen, /idempotencyRef/)
assert.match(screen, /canIssue/)
assert.ok(!screen.includes('ComingSoonScreen'))

const catalog = readFileSync(src('src/auth/navigationCatalog.ts'), 'utf8')
assert.match(catalog, /material-issue/)
assert.match(catalog, /manufacturing\.materials\.issue/)

console.log('Store material issue structural checks: PASS')
