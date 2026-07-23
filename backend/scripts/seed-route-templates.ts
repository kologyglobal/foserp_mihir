/**
 * Seeds 2 reusable Route Master templates (generic routings — no item lock):
 *   RT-TMPL-ASSEMBLY     — Standard Assembly
 *   RT-TMPL-FABRICATION  — Standard Fabrication
 *
 * Each gets draft v1 with stages + operations, then activated.
 * Safe to re-run (upsert by code; skip structure if version already has stages).
 *
 * Usage:
 *   npx tsx scripts/seed-route-templates.ts
 *   npx tsx scripts/seed-route-templates.ts vasant-trailers
 */
import { prisma } from '../src/config/database.js'

const tenantSlug = process.argv[2] ?? process.env.TENANT_SLUG ?? 'vasant-trailers'

type OpDef = { code: string; name: string; sequence: number; setup: number; run: number; quality?: boolean }
type StageDef = { code: string; name: string; displayOrder: number; qualityRequired?: boolean; ops: OpDef[] }

interface RouteTemplate {
  code: string
  name: string
  description: string
  workCentreCode: string
  workCentreName: string
  stages: StageDef[]
}

const TEMPLATES: RouteTemplate[] = [
  {
    code: 'RT-TMPL-ASSEMBLY',
    name: 'Standard Assembly Route',
    description: 'Reusable assembly template — Prep → Assemble → QC → Pack. Link an item on the routing or profile when needed.',
    workCentreCode: 'WC-TMPL-ASM',
    workCentreName: 'Assembly Bay (Template)',
    stages: [
      {
        code: 'PREP',
        name: 'Material prep',
        displayOrder: 10,
        ops: [
          { code: 'OP-10', name: 'Kit issue & stage materials', sequence: 10, setup: 10, run: 20 },
          { code: 'OP-20', name: 'Incoming check', sequence: 20, setup: 5, run: 15 },
        ],
      },
      {
        code: 'ASM',
        name: 'Assembly',
        displayOrder: 20,
        ops: [
          { code: 'OP-30', name: 'Fit & assemble', sequence: 30, setup: 15, run: 90 },
          { code: 'OP-40', name: 'Torque / fasten', sequence: 40, setup: 5, run: 30 },
        ],
      },
      {
        code: 'QC',
        name: 'Final QC',
        displayOrder: 30,
        qualityRequired: true,
        ops: [{ code: 'OP-50', name: 'Inspection & sign-off', sequence: 50, setup: 5, run: 25, quality: true }],
      },
      {
        code: 'PACK',
        name: 'Pack & dispatch ready',
        displayOrder: 40,
        ops: [{ code: 'OP-60', name: 'Pack / tag / stage FG', sequence: 60, setup: 5, run: 20 }],
      },
    ],
  },
  {
    code: 'RT-TMPL-FABRICATION',
    name: 'Standard Fabrication Route',
    description: 'Reusable fabrication template — Cut → Weld → Finish → QC. Link an item on the routing or profile when needed.',
    workCentreCode: 'WC-TMPL-FAB',
    workCentreName: 'Fabrication Cell (Template)',
    stages: [
      {
        code: 'CUT',
        name: 'Cutting',
        displayOrder: 10,
        ops: [
          { code: 'OP-10', name: 'Mark & cut', sequence: 10, setup: 15, run: 60 },
          { code: 'OP-20', name: 'Edge prep', sequence: 20, setup: 10, run: 30 },
        ],
      },
      {
        code: 'WELD',
        name: 'Welding',
        displayOrder: 20,
        ops: [
          { code: 'OP-30', name: 'Fit-up', sequence: 30, setup: 20, run: 45 },
          { code: 'OP-40', name: 'Weld', sequence: 40, setup: 15, run: 120 },
        ],
      },
      {
        code: 'FIN',
        name: 'Finish',
        displayOrder: 30,
        ops: [
          { code: 'OP-50', name: 'Grind / clean', sequence: 50, setup: 10, run: 40 },
          { code: 'OP-60', name: 'Paint / coat', sequence: 60, setup: 20, run: 60 },
        ],
      },
      {
        code: 'QC',
        name: 'Final QC',
        displayOrder: 40,
        qualityRequired: true,
        ops: [{ code: 'OP-70', name: 'Dimensional & visual QC', sequence: 70, setup: 5, run: 30, quality: true }],
      },
    ],
  },
]

async function ensureWorkCentre(tenantId: string, userId: string | null, code: string, name: string) {
  return prisma.manufacturingWorkCentre.upsert({
    where: { tenantId_code: { tenantId, code } },
    create: {
      tenantId,
      code,
      name,
      capacityPerShift: 8,
      createdBy: userId,
      updatedBy: userId,
    },
    update: { name, deletedAt: null, isActive: true },
  })
}

async function seedTemplate(tenantId: string, userId: string | null, tmpl: RouteTemplate) {
  const wc = await ensureWorkCentre(tenantId, userId, tmpl.workCentreCode, tmpl.workCentreName)

  const routing = await prisma.manufacturingRouting.upsert({
    where: { tenantId_code: { tenantId, code: tmpl.code } },
    create: {
      tenantId,
      code: tmpl.code,
      name: tmpl.name,
      productItemId: null,
      description: tmpl.description,
      isActive: true,
      createdBy: userId,
      updatedBy: userId,
    },
    update: {
      name: tmpl.name,
      description: tmpl.description,
      productItemId: null,
      deletedAt: null,
      isActive: true,
    },
  })

  let version = await prisma.manufacturingRoutingVersion.findFirst({
    where: { tenantId, routingId: routing.id, versionNumber: 1, deletedAt: null },
  })

  if (!version) {
    version = await prisma.manufacturingRoutingVersion.create({
      data: {
        tenantId,
        routingId: routing.id,
        versionNumber: 1,
        revisionCode: 'A',
        status: 'DRAFT',
        effectiveFrom: new Date(),
        revisionNotes: 'System route master template',
        createdBy: userId,
        updatedBy: userId,
      },
    })
  }

  const existingStages = await prisma.manufacturingStageGroup.count({
    where: { tenantId, routingVersionId: version.id, deletedAt: null },
  })

  if (existingStages === 0) {
    for (const stage of tmpl.stages) {
      const sg = await prisma.manufacturingStageGroup.create({
        data: {
          tenantId,
          routingVersionId: version.id,
          code: stage.code,
          name: stage.name,
          displayOrder: stage.displayOrder,
          defaultWorkCentreId: wc.id,
          qualityRequired: stage.qualityRequired ?? false,
          completionRule: 'ALL_OPERATIONS',
          createdBy: userId,
          updatedBy: userId,
        },
      })
      for (const op of stage.ops) {
        await prisma.manufacturingRoutingOperation.create({
          data: {
            tenantId,
            routingVersionId: version.id,
            stageGroupId: sg.id,
            code: op.code,
            name: op.name,
            sequence: op.sequence,
            workCentreId: wc.id,
            setupTimeMinutes: op.setup,
            runTimeValue: op.run,
            runTimeBasis: 'PER_UNIT',
            qualityRequired: op.quality ?? false,
            inputType: 'MATERIAL',
            outputType: 'NONE',
            createdBy: userId,
            updatedBy: userId,
          },
        })
      }
    }
    console.log(`  ${tmpl.code}: created ${tmpl.stages.length} stages with operations`)
  } else {
    console.log(`  ${tmpl.code}: stages already present (${existingStages}) — skipped structure`)
  }

  // Activate if still draft (and no other ACTIVE version on this routing)
  if (version.status === 'DRAFT') {
    const otherActive = await prisma.manufacturingRoutingVersion.findFirst({
      where: {
        tenantId,
        routingId: routing.id,
        status: 'ACTIVE',
        id: { not: version.id },
        deletedAt: null,
      },
    })
    if (!otherActive) {
      version = await prisma.manufacturingRoutingVersion.update({
        where: { id: version.id },
        data: {
          status: 'ACTIVE',
          activatedAt: new Date(),
          activatedBy: userId,
          updatedBy: userId,
        },
      })
      console.log(`  ${tmpl.code}: version 1 activated`)
    }
  } else {
    console.log(`  ${tmpl.code}: version 1 status=${version.status}`)
  }

  return { routing, version }
}

async function main() {
  const tenant = await prisma.tenant.findFirst({
    where: { slug: tenantSlug, deletedAt: null },
  })
  if (!tenant) {
    console.error(`Tenant not found: ${tenantSlug}`)
    process.exit(1)
  }

  const user = await prisma.user.findFirst({
    where: { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`Seeding route master templates for ${tenant.slug}…`)
  for (const tmpl of TEMPLATES) {
    await seedTemplate(tenant.id, user?.id ?? null, tmpl)
  }
  console.log('Done.')
  console.log('Open Manufacturing → Setup → Routings:')
  for (const t of TEMPLATES) console.log(`  • ${t.code} — ${t.name}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
