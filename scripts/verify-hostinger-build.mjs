import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDist = join(root, 'frontend', 'dist')
const published = join(root, 'backend', 'public')
const backendServer = join(root, 'backend', 'dist', 'server.js')

function fail(message) {
  console.error(`Deployment verification failed: ${message}`)
  process.exit(1)
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

for (const path of [
  join(sourceDist, 'index.html'),
  join(published, 'index.html'),
  join(published, 'build-meta.json'),
  backendServer,
]) {
  if (!existsSync(path)) fail(`missing ${path}`)
}

const sourceHtml = readFileSync(join(sourceDist, 'index.html'), 'utf8')
const publishedHtml = readFileSync(join(published, 'index.html'), 'utf8')
if (sourceHtml !== publishedHtml) fail('backend/public/index.html differs from frontend/dist/index.html')

const assetRefs = [...publishedHtml.matchAll(/(?:src|href)="\/(assets\/[^"]+)"/g)].map((match) => match[1])
if (assetRefs.length === 0) fail('published index.html has no hashed assets')
for (const ref of assetRefs) {
  const source = join(sourceDist, ref)
  const target = join(published, ref)
  if (!existsSync(source) || !existsSync(target)) fail(`missing published asset ${ref}`)
  if (sha256(source) !== sha256(target)) fail(`published asset differs from Vite output: ${ref}`)
}

const meta = JSON.parse(readFileSync(join(published, 'build-meta.json'), 'utf8'))
let head = 'unknown'
try {
  head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
} catch {
  // Git metadata can be unavailable in a packaged deployment.
}
if (head !== 'unknown' && meta.revision !== head) {
  fail(`build revision ${meta.revision} does not match HEAD ${head}`)
}

console.log(`Deployment build verified: ${assetRefs.length} assets, revision ${meta.revision}`)
