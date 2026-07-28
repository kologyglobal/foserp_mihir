/**
 * One-shot IndiaMART go-live readiness check (no secrets printed).
 * Usage: npx tsx scripts/indiamart-golive-check.ts [--tenant=vasant-trailers]
 */
import { prisma } from '../src/config/database.js'
import { isFieldEncryptionConfigured } from '../src/utils/fieldEncryption.js'

const tenantArg = process.argv.find((a) => a.startsWith('--tenant='))?.slice('--tenant='.length)

async function main() {
  const encOk = isFieldEncryptionConfigured()
  console.log(`FIELD_ENCRYPTION_KEY: ${encOk ? 'configured' : 'MISSING — set in backend/.env then restart API'}`)

  let tablesOk = false
  try {
    await prisma.indiaMartConnection.findFirst({ select: { id: true } })
    tablesOk = true
    console.log('IndiaMART tables: reachable (indiamart_connections + related)')
  } catch (e) {
    console.log(`IndiaMART tables: MISSING or Prisma client stale — ${(e as Error).message}`)
    console.log('  → npx tsx scripts/prisma-cli.ts migrate deploy && npx tsx scripts/prisma-cli.ts generate')
  }

  const tenants = tenantArg
    ? await prisma.tenant.findMany({ where: { slug: tenantArg }, select: { id: true, slug: true, name: true } })
    : await prisma.tenant.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, slug: true, name: true },
        take: 20,
        orderBy: { createdAt: 'asc' },
      })

  if (!tenants.length) {
    console.log('No matching tenants.')
    return
  }

  if (!tablesOk) {
    console.log('\nSkip connection rows until tables exist.')
    return
  }

  for (const t of tenants) {
    const conn = await prisma.indiaMartConnection.findUnique({
      where: { tenantId: t.id },
      select: {
        status: true,
        syncEnabled: true,
        encryptedCredentials: true,
        apiBaseUrl: true,
        lastSuccessfulSyncAt: true,
        pushWebhookEnabled: true,
        registeredMobileMasked: true,
      },
    })
    console.log(`\nTenant ${t.slug} (${t.name})`)
    if (!conn) {
      console.log('  connection: none — open Settings and Save Pull key')
      continue
    }
    console.log(`  status: ${conn.status}`)
    console.log(`  credentials: ${conn.encryptedCredentials ? 'present (encrypted)' : 'MISSING'}`)
    console.log(`  syncEnabled: ${conn.syncEnabled}`)
    console.log(`  apiBaseUrl: ${conn.apiBaseUrl}`)
    console.log(`  lastSuccessfulSyncAt: ${conn.lastSuccessfulSyncAt?.toISOString() ?? '—'}`)
    console.log(`  pushWebhookEnabled: ${conn.pushWebhookEnabled}`)
    console.log(`  registeredMobileMasked: ${conn.registeredMobileMasked ?? '—'}`)
  }

  console.log('\nNext:')
  if (!encOk) console.log('  1. Add FIELD_ENCRYPTION_KEY to backend/.env (32-byte base64) and restart API')
  console.log('  2. CRM → IndiaMART → Settings → paste glusr_crm_key → Save → Test connection')
  console.log('  3. Sync now / Initial import → verify Inbox + Imported Leads')
  console.log('  See docs/crm/INDIAMART_GOLIVE.md')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
