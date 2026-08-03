/**
 * Soft-delete leftover VF manufacturing quotation templates for tenant `kology`,
 * and ensure the SERVICES standard template `KOLOGY-OUTBOUND-PILOT` is active.
 *
 * Idempotent. Usage (from backend/):
 *   npx tsx scripts/cleanup-kology-quotation-templates.ts
 *   npx tsx scripts/cleanup-kology-quotation-templates.ts --dry-run
 */
import { prisma } from '../src/config/database.js'
import {
  KOLOGY_OUTBOUND_PILOT_CODE,
  KOLOGY_OUTBOUND_PILOT_SEED_ROW,
  KOLOGY_OUTBOUND_PILOT_SECTIONS,
} from '../src/modules/crm/quotation-templates/quotation-template.kology-outbound.js'
import { toTemplateJson } from '../src/modules/crm/quotation-templates/quotation-template.types.js'

const dryRun = process.argv.includes('--dry-run')
const KEEP_CODE = KOLOGY_OUTBOUND_PILOT_CODE
const TENANT_SLUG = 'kology'

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: TENANT_SLUG, deletedAt: null },
    select: { id: true, name: true, businessType: true },
  })
  if (!tenant) {
    console.log(`Tenant "${TENANT_SLUG}" not found — nothing to do.`)
    return
  }

  const extras = await prisma.crmQuotationTemplate.findMany({
    where: { tenantId: tenant.id, deletedAt: null, code: { not: KEEP_CODE } },
    select: { id: true, code: true, templateName: true },
  })

  console.log(
    `Tenant ${tenant.name} (${tenant.businessType}): keeping "${KEEP_CODE}", removing ${extras.length} template(s)`,
  )
  for (const t of extras) console.log(`  - ${t.code} | ${t.templateName}`)

  if (!dryRun && extras.length > 0) {
    await prisma.crmQuotationTemplate.updateMany({
      where: { id: { in: extras.map((t) => t.id) } },
      data: { deletedAt: new Date(), isActive: false },
    })
  }

  const existing = await prisma.crmQuotationTemplate.findFirst({
    where: { tenantId: tenant.id, code: KEEP_CODE },
  })

  if (!dryRun) {
    if (!existing) {
      await prisma.crmQuotationTemplate.create({
        data: {
          tenantId: tenant.id,
          code: KOLOGY_OUTBOUND_PILOT_SEED_ROW.code,
          templateName: KOLOGY_OUTBOUND_PILOT_SEED_ROW.templateName,
          productFamily: KOLOGY_OUTBOUND_PILOT_SEED_ROW.productFamily,
          version: KOLOGY_OUTBOUND_PILOT_SEED_ROW.version,
          sections: toTemplateJson([...KOLOGY_OUTBOUND_PILOT_SECTIONS]),
          defaultTerms: KOLOGY_OUTBOUND_PILOT_SEED_ROW.defaultTerms,
          defaultWarranty: KOLOGY_OUTBOUND_PILOT_SEED_ROW.defaultWarranty,
          defaultExclusions: KOLOGY_OUTBOUND_PILOT_SEED_ROW.defaultExclusions,
          printLayout: toTemplateJson(KOLOGY_OUTBOUND_PILOT_SEED_ROW.printLayout),
          isActive: true,
          deletedAt: null,
        },
      })
      console.log(`Created ${KEEP_CODE}`)
    } else {
      await prisma.crmQuotationTemplate.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          isActive: true,
          templateName: KOLOGY_OUTBOUND_PILOT_SEED_ROW.templateName,
          productFamily: KOLOGY_OUTBOUND_PILOT_SEED_ROW.productFamily,
          version: KOLOGY_OUTBOUND_PILOT_SEED_ROW.version,
          sections: toTemplateJson([...KOLOGY_OUTBOUND_PILOT_SECTIONS]),
          defaultTerms: KOLOGY_OUTBOUND_PILOT_SEED_ROW.defaultTerms,
          defaultWarranty: KOLOGY_OUTBOUND_PILOT_SEED_ROW.defaultWarranty,
          defaultExclusions: KOLOGY_OUTBOUND_PILOT_SEED_ROW.defaultExclusions,
          printLayout: toTemplateJson(KOLOGY_OUTBOUND_PILOT_SEED_ROW.printLayout),
        },
      })
      console.log(`Updated / restored ${KEEP_CODE}`)
    }
  }

  const remaining = await prisma.crmQuotationTemplate.findMany({
    where: { tenantId: tenant.id, deletedAt: null },
    select: { code: true, templateName: true },
  })
  console.log(`\nRemaining active template(s) for ${TENANT_SLUG}:`, dryRun ? '(dry-run — not yet applied)' : '')
  for (const t of remaining) console.log(`  - ${t.code} | ${t.templateName}`)

  console.log(dryRun ? '\nDry run complete — no changes applied.' : '\nDone.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
