import { prisma } from '../src/config/prisma.js'

async function main() {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      migration_name: string
      finished_at: Date | null
      applied_steps_count: number
    }>
  >(
    `SELECT migration_name, finished_at, applied_steps_count
     FROM _prisma_migrations
     ORDER BY started_at DESC`,
  )

  console.log('migration_name\tfinished_at\tapplied_steps_count')
  for (const row of rows) {
    console.log(
      [
        row.migration_name,
        row.finished_at ? new Date(row.finished_at).toISOString() : 'NULL',
        String(row.applied_steps_count),
      ].join('\t'),
    )
  }
  console.log(`\nTotal rows: ${rows.length}`)

  const suspicious = await prisma.$queryRawUnsafe<
    Array<{
      migration_name: string
      finished_at: Date | null
      applied_steps_count: bigint
      rolled_back_at: Date | null
      started_at: Date
    }>
  >(
    `SELECT migration_name, finished_at, applied_steps_count, rolled_back_at, started_at
     FROM _prisma_migrations
     WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL OR applied_steps_count = 0
     ORDER BY started_at DESC`,
  )

  if (suspicious.length) {
    console.log('\n--- Suspicious rows (NULL finished / rolled back / steps=0) ---')
    for (const row of suspicious) {
      console.log(
        [
          row.migration_name,
          row.finished_at ? new Date(row.finished_at).toISOString() : 'NULL',
          String(row.applied_steps_count),
          row.rolled_back_at ? new Date(row.rolled_back_at).toISOString() : 'NULL',
          new Date(row.started_at).toISOString(),
        ].join('\t'),
      )
    }
  } else {
    console.log('\nNo suspicious rows (all finished, steps > 0).')
  }

  const dupes = await prisma.$queryRawUnsafe<
    Array<{ migration_name: string; cnt: bigint; unfinished: bigint; finished: bigint }>
  >(
    `SELECT migration_name,
            COUNT(*) AS cnt,
            SUM(CASE WHEN finished_at IS NULL THEN 1 ELSE 0 END) AS unfinished,
            SUM(CASE WHEN finished_at IS NOT NULL THEN 1 ELSE 0 END) AS finished
     FROM _prisma_migrations
     GROUP BY migration_name
     HAVING cnt > 1 OR unfinished > 0
     ORDER BY migration_name DESC`,
  )

  if (dupes.length) {
    console.log('\n--- Duplicate or unfinished migration names ---')
    for (const row of dupes) {
      console.log(
        [row.migration_name, String(row.cnt), String(row.unfinished), String(row.finished)].join('\t'),
      )
    }
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
