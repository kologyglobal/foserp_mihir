import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

/** Concatenated source of all route modules (post Phase 2 split). */
export function readAllRouteSources(root: string): string {
  const routesDir = path.join(root, 'src/routes')
  return readdirSync(routesDir)
    .filter((f) => f.endsWith('.tsx'))
    .sort()
    .map((f) => readFileSync(path.join(routesDir, f), 'utf8'))
    .join('\n')
}
