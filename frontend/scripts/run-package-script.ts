/**
 * Run package.json scripts without requiring npm on PATH (uses process.execPath + local bins).
 */
import { spawnSync, type SpawnSyncReturns } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'

function readScript(root: string, scriptName: string): string {
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
  const cmd = pkg.scripts?.[scriptName]
  if (!cmd) throw new Error(`Unknown package script: ${scriptName}`)
  return cmd
}

function runCommand(cmd: string, root: string): SpawnSyncReturns<string> {
  if (cmd.includes(' && ')) {
    let stdout = ''
    let stderr = ''
    for (const part of cmd.split(' && ').map((s) => s.trim())) {
      const r = runCommand(part, root)
      stdout += r.stdout ?? ''
      stderr += r.stderr ?? ''
      if (r.status !== 0) return { ...r, stdout, stderr }
    }
    return { status: 0, stdout, stderr, output: [stdout, stderr].filter(Boolean).join('\n'), pid: 0, signal: null, error: undefined }
  }

  const [bin, ...args] = cmd.split(/\s+/)
  const opts = { cwd: root, encoding: 'utf8' as const, env: { ...process.env, FORCE_COLOR: '0' } }

  if (bin === 'tsx') {
    return spawnSync(process.execPath, [path.join(root, 'node_modules/tsx/dist/cli.mjs'), ...args], opts)
  }
  if (bin === 'tsc') {
    return spawnSync(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'), ...args], opts)
  }
  if (bin === 'vite') {
    return spawnSync(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), ...args], opts)
  }

  return spawnSync(cmd, { ...opts, shell: true })
}

export function runPackageScript(scriptName: string, root: string): SpawnSyncReturns<string> {
  return runCommand(readScript(root, scriptName), root)
}
