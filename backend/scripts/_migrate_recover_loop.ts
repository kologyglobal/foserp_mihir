/**
 * Recover drifted migrate history: on P3018 "already exists"/duplicate failures
 * that match known-safe patterns, mark migration applied and continue deploy.
 *
 * Does NOT reset the DB. Stops on unexpected errors.
 */
import { spawnSync } from 'node:child_process'
import { prisma } from '../src/config/database.js'

function runPrisma(args: string[]) {
  const result = spawnSync('npx', ['tsx', 'scripts/prisma-cli.ts', ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: true,
    env: process.env,
  })
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    combined: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  }
}

function extractFailedName(text: string): string | null {
  const m = text.match(/Migration name:\s*([0-9]{14}_[A-Za-z0-9_]+)/)
  return m?.[1] ?? null
}

function isSafeAlreadyAppliedFailure(text: string): boolean {
  // Enum-shrink duplicate on incomplete code_series ENUM lists must NOT be
  // auto-resolved for multi-statement migrations (later CREATE TABLEs never run).
  if (/Duplicate entry '.*-' for key 'code_series_tenantId_entityType_key'/.test(text)) {
    return false
  }

  // Only auto-resolve when the first statement failed (nothing from this migration applied),
  // or table/column already-exists on query 1.
  const queryNo = text.match(/query number\s+(\d+)/i)
  if (queryNo && Number(queryNo[1]) !== 1) return false

  return (
    /Database error code: 1050/.test(text) || // table already exists
    /Database error code: 1060/.test(text) || // duplicate column
    /Database error code: 1061/.test(text) || // duplicate key name
    /already exists/i.test(text) ||
    /Duplicate column name/i.test(text) ||
    /Duplicate key name/i.test(text)
  )
}

async function main() {
  const maxRounds = 40
  for (let i = 1; i <= maxRounds; i++) {
    console.log(`\n===== DEPLOY ROUND ${i} =====`)
    const deploy = runPrisma(['migrate', 'deploy'])
    process.stdout.write(deploy.combined)
    if (deploy.status === 0) {
      console.log('\n✅ migrate deploy succeeded')
      return
    }

    const name = extractFailedName(deploy.combined)
    if (!name) {
      // maybe still blocked by prior failed row
      const failed = await prisma.$queryRawUnsafe<any[]>(
        `SELECT migration_name, LEFT(COALESCE(logs,''), 600) AS logs
         FROM _prisma_migrations
         WHERE finished_at IS NULL AND rolled_back_at IS NULL
         ORDER BY started_at DESC LIMIT 1`,
      )
      if (failed.length && isSafeAlreadyAppliedFailure(String(failed[0].logs))) {
        console.log(`Resolving failed row ${failed[0].migration_name} as applied`)
        const r = runPrisma(['migrate', 'resolve', '--applied', failed[0].migration_name])
        process.stdout.write(r.combined)
        if (r.status !== 0) process.exit(r.status)
        continue
      }
      console.error('Unexpected deploy failure; stopping')
      process.exit(deploy.status)
    }

    if (!isSafeAlreadyAppliedFailure(deploy.combined)) {
      console.error(`Unsafe/unknown failure on ${name}; stopping`)
      process.exit(deploy.status)
    }

    console.log(`Marking ${name} as applied (effects already present / unsafe enum shrink)`)
    const resolve = runPrisma(['migrate', 'resolve', '--applied', name])
    process.stdout.write(resolve.combined)
    if (resolve.status !== 0) process.exit(resolve.status)
  }
  console.error('Exceeded max rounds')
  process.exit(1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
