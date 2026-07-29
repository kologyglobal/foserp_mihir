import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const backend = dirname(fileURLToPath(import.meta.url))
const server = join(backend, 'dist', 'server.js')
const frontend = join(backend, 'public')

if (!existsSync(server)) {
  throw new Error(`Backend build is missing: ${server}. Hostinger must run npm run build before start.`)
}
const prismaModule = join(backend, 'dist', 'config', 'prisma.js')
if (!existsSync(prismaModule)) {
  throw new Error(
    `Backend build is incomplete: ${prismaModule} is missing. Delete dist/ and tsconfig.tsbuildinfo, then run npm run build and confirm dist/config/prisma.js exists before restart.`,
  )
}
if (!existsSync(join(frontend, 'index.html'))) {
  throw new Error(`Frontend build is missing: ${frontend}. Hostinger must run npm run build before start.`)
}

// Hostinger launches this file from the selected backend output directory.
// Keep dotenv and all relative backend paths stable.
process.chdir(backend)
process.env.FRONTEND_DIST = process.env.FRONTEND_DIST ?? resolve(frontend)

await import(pathToFileURL(server).href)
