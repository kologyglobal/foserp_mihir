import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const backend = join(root, 'backend')
const server = join(backend, 'dist', 'server.js')
const frontend = join(backend, 'public')

if (!existsSync(server)) {
  throw new Error(`Backend build is missing: ${server}. Hostinger must run npm run build before start.`)
}
if (!existsSync(join(frontend, 'index.html'))) {
  throw new Error(`Frontend build is missing: ${frontend}. Hostinger must run npm run build before start.`)
}

// Keep backend dotenv and relative paths stable even though Hostinger launches
// the repository-root entry file.
process.chdir(backend)
process.env.FRONTEND_DIST = process.env.FRONTEND_DIST ?? resolve(frontend)

await import(pathToFileURL(server).href)
