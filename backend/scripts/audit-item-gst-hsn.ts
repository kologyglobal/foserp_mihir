/**
 * Audit and optionally repair Item ↔ HSN ↔ GST group links on live/stage DB.
 *
 * Usage:
 *   cd backend
 *   set DB_HOST=127.0.0.1
 *   set DB_NAME=u233611619_foserp
 *   set DB_USER=u233611619_erpuser_jul
 *   set DB_PASS=...
 *   npx tsx scripts/audit-item-gst-hsn.ts
 *   npx tsx scripts/audit-item-gst-hsn.ts --tenant vasant-trailers --apply
 */
import mariadb from 'mariadb'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type HsnRow = { id: string; code: string; gstGroupId: string; description: string }
type ItemRow = {
  id: string
  code: string
  name: string
  hsnCode: string
  hsnId: string | null
  gstGroupId: string | null
  isPurchasable: boolean
}

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '')
}

function resolveHsnForItem(
  item: ItemRow,
  hsnByCode: Map<string, HsnRow>,
  hsnById: Map<string, HsnRow>,
): HsnRow | null {
  if (item.hsnId && UUID_RE.test(item.hsnId)) {
    const linked = hsnById.get(item.hsnId)
    if (linked) return linked
  }

  const raw = (item.hsnCode ?? '').trim()
  if (!raw) return null

  const exact = hsnByCode.get(raw)
  if (exact) return exact

  const digits = digitsOnly(raw)
  if (digits) {
    const byDigits = hsnByCode.get(digits)
    if (byDigits) return byDigits

    const prefixMatches = [...hsnByCode.values()].filter(
      (h) => h.code.startsWith(digits) || digits.startsWith(h.code),
    )
    if (prefixMatches.length === 1) return prefixMatches[0]
    if (prefixMatches.length > 1) {
      prefixMatches.sort((a, b) => a.code.length - b.code.length)
      return prefixMatches[0]
    }
  }

  return null
}

function classifyItem(
  item: ItemRow,
  hsnByCode: Map<string, HsnRow>,
  hsnById: Map<string, HsnRow>,
  gstCodeById: Map<string, string>,
) {
  const resolved = resolveHsnForItem(item, hsnByCode, hsnById)
  const issues: string[] = []

  if (!resolved) {
    if (!item.hsnCode?.trim() && !item.hsnId) issues.push('missing_hsn')
    else issues.push('hsn_not_in_master')
    return { item, resolved: null as HsnRow | null, issues, gstCode: null as string | null }
  }

  const gstCode = gstCodeById.get(resolved.gstGroupId) ?? '?'

  if (!item.hsnId || !UUID_RE.test(item.hsnId)) issues.push('invalid_or_missing_hsn_id')
  else if (item.hsnId !== resolved.id) issues.push('hsn_id_mismatch')

  if (!item.gstGroupId || !UUID_RE.test(item.gstGroupId)) issues.push('invalid_or_missing_gst_group_id')
  else if (item.gstGroupId !== resolved.gstGroupId) issues.push('gst_group_mismatch')

  if ((item.hsnCode ?? '').trim() && item.hsnCode.trim() !== resolved.code) {
    issues.push('legacy_hsn_text_mismatch')
  }

  if (item.hsnId === resolved.id && item.gstGroupId === resolved.gstGroupId && item.hsnCode === resolved.code) {
    return { item, resolved, issues: [] as string[], gstCode }
  }

  if (issues.length === 0) issues.push('needs_sync')
  return { item, resolved, issues, gstCode }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const tenantArg = process.argv.find((a, i) => process.argv[i - 1] === '--tenant')
  const defaultHsnArg = process.argv.find((a, i) => process.argv[i - 1] === '--default-hsn')

  const c = await mariadb.createConnection({
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASS ?? '',
    database: process.env.DB_NAME ?? 'fos_erp',
  })

  const db = process.env.DB_NAME ?? 'fos_erp'
  console.log(`Audit item GST/HSN on ${process.env.DB_USER}@${process.env.DB_HOST}/${db}`)
  console.log(apply ? 'Mode: APPLY fixes\n' : 'Mode: report only (pass --apply to update)\n')

  const tenants = await c.query<{ id: string; slug: string; name: string }[]>(
    `SELECT id, slug, name FROM tenants WHERE deletedAt IS NULL
     ${tenantArg ? 'AND slug = ?' : ''}
     ORDER BY slug`,
    tenantArg ? [tenantArg] : [],
  )

  if (tenants.length === 0) {
    console.error(tenantArg ? `Tenant not found: ${tenantArg}` : 'No tenants found')
    process.exit(1)
  }

  let totalFixed = 0

  for (const tenant of tenants) {
    console.log(`\n=== ${tenant.name} (${tenant.slug}) ===`)

    const gstGroups = await c.query<{ id: string; code: string }[]>(
      `SELECT id, code FROM master_gst_groups WHERE tenantId = ? AND deletedAt IS NULL`,
      [tenant.id],
    )
    const hsns = await c.query<HsnRow[]>(
      `SELECT id, code, gstGroupId, description FROM master_hsn_codes
       WHERE tenantId = ? AND deletedAt IS NULL AND status = 'ACTIVE'`,
      [tenant.id],
    )
    const items = await c.query<ItemRow[]>(
      `SELECT id, code, name, hsnCode, hsnId, gstGroupId, isPurchasable
       FROM master_items WHERE tenantId = ? AND deletedAt IS NULL ORDER BY code`,
      [tenant.id],
    )

    const hsnByCode = new Map<string, HsnRow>()
    for (const h of hsns) {
      hsnByCode.set(h.code, h)
      const d = digitsOnly(h.code)
      if (d && d !== h.code && !hsnByCode.has(d)) hsnByCode.set(d, h)
    }
    const hsnById = new Map(hsns.map((h) => [h.id, h]))
    const gstCodeById = new Map(gstGroups.map((g) => [g.id, g.code]))

    console.log(
      `Masters: ${gstGroups.length} GST groups, ${hsns.length} HSN codes, ${items.length} items`,
    )

    const problems: ReturnType<typeof classifyItem>[] = []
    let ok = 0

    for (const item of items) {
      const result = classifyItem(item, hsnByCode, hsnById, gstCodeById)
      if (result.issues.length === 0) ok += 1
      else problems.push(result)
    }

    console.log(`OK: ${ok} | Needs fix: ${problems.length}`)

    if (problems.length === 0) continue

    console.log('\nItems needing attention:')
    console.log('code | legacy hsn | → master hsn | gst group | issues')
    console.log('-'.repeat(90))

    for (const p of problems.slice(0, 40)) {
      const masterCode = p.resolved?.code ?? '—'
      const gst = p.resolved ? (gstCodeById.get(p.resolved.gstGroupId) ?? '?') : '—'
      console.log(
        `${p.item.code} | ${p.item.hsnCode || '—'} | → ${masterCode} | ${gst} | ${p.issues.join(', ')}`,
      )
    }
    if (problems.length > 40) console.log(`… and ${problems.length - 40} more`)

    if (!apply) continue

    for (const p of problems) {
      if (!p.resolved) continue
      await c.query(
        `UPDATE master_items
         SET hsnId = ?, gstGroupId = ?, hsnCode = ?, updatedAt = UTC_TIMESTAMP(3)
         WHERE id = ? AND tenantId = ?`,
        [p.resolved.id, p.resolved.gstGroupId, p.resolved.code, p.item.id, tenant.id],
      )
      totalFixed += 1
    }

    if (defaultHsnArg && apply) {
      const defaultHsn = hsnByCode.get(defaultHsnArg)
      if (defaultHsn) {
        const r = await c.query(
          `UPDATE master_items
           SET hsnId = ?, gstGroupId = ?, hsnCode = ?, updatedAt = UTC_TIMESTAMP(3)
           WHERE tenantId = ? AND deletedAt IS NULL AND isPurchasable = 1
             AND (hsnId IS NULL OR hsnId = '' OR gstGroupId IS NULL OR gstGroupId = '')`,
          [defaultHsn.id, defaultHsn.gstGroupId, defaultHsn.code, tenant.id],
        )
        const n = Number(r.affectedRows ?? 0)
        if (n > 0) {
          console.log(`Default HSN ${defaultHsnArg} applied to ${n} purchasable item(s) still missing tax`)
          totalFixed += n
        }
      } else {
        console.warn(`--default-hsn ${defaultHsnArg} not found in tenant HSN master`)
      }
    }

    const stillMissing = await c.query<{ c: number }[]>(
      `SELECT COUNT(*) AS c FROM master_items
       WHERE tenantId = ? AND deletedAt IS NULL
         AND (hsnId IS NULL OR hsnId = '' OR gstGroupId IS NULL OR gstGroupId = '')`,
      [tenant.id],
    )
    console.log(`Applied ${problems.filter((p) => p.resolved).length} fixes; still missing tax: ${stillMissing[0].c}`)
  }

  await c.end()

  if (!apply) {
    console.log('\nRe-run with --apply to update items from HSN master resolution.')
  } else {
    console.log(`\nDone. Updated ${totalFixed} item row(s).`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
