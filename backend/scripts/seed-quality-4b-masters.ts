/**
 * Upsert Quality Phase 4B sample masters for vasant-trailers only.
 * Usage: npx tsx scripts/seed-quality-4b-masters.ts
 */
import { prisma } from '../src/config/database.js'

async function main() {
  const tenant = await prisma.tenant.findFirst({ where: { slug: 'vasant-trailers' } })
  if (!tenant) throw new Error('Tenant vasant-trailers not found')

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'admin@vasant-trailers.com' },
  })
  const userId = admin?.id ?? null

  const qpVisual = await prisma.qualityParameter.upsert({
    where: { tenantId_parameterCode: { tenantId: tenant.id, parameterCode: 'QP-VISUAL' } },
    create: {
      tenantId: tenant.id,
      parameterCode: 'QP-VISUAL',
      parameterName: 'Visual appearance',
      parameterType: 'BOOLEAN',
      mandatory: true,
      severity: 'MAJOR',
      passFailRule: 'BOOLEAN_TRUE',
      active: true,
      createdBy: userId,
    },
    update: { active: true, deletedAt: null, updatedBy: userId },
  })

  const qpDim = await prisma.qualityParameter.upsert({
    where: { tenantId_parameterCode: { tenantId: tenant.id, parameterCode: 'QP-DIM-LEN' } },
    create: {
      tenantId: tenant.id,
      parameterCode: 'QP-DIM-LEN',
      parameterName: 'Overall length',
      parameterType: 'NUMERIC',
      uomCode: 'mm',
      minValue: 100,
      maxValue: 12000,
      targetValue: 6000,
      mandatory: true,
      severity: 'CRITICAL',
      passFailRule: 'NUMERIC_TOLERANCE',
      active: true,
      createdBy: userId,
    },
    update: { active: true, deletedAt: null, updatedBy: userId },
  })

  const qpNotes = await prisma.qualityParameter.upsert({
    where: { tenantId_parameterCode: { tenantId: tenant.id, parameterCode: 'QP-NOTES' } },
    create: {
      tenantId: tenant.id,
      parameterCode: 'QP-NOTES',
      parameterName: 'Inspector notes',
      parameterType: 'TEXT',
      mandatory: false,
      severity: 'MINOR',
      passFailRule: 'MANUAL',
      active: true,
      createdBy: userId,
    },
    update: { active: true, deletedAt: null, updatedBy: userId },
  })

  let inProcess = await prisma.qualityInspectionPlan.findFirst({
    where: { tenantId: tenant.id, planCode: 'IP-INPROC-STD', deletedAt: null },
  })
  if (!inProcess) {
    inProcess = await prisma.qualityInspectionPlan.create({
      data: {
        tenantId: tenant.id,
        planCode: 'IP-INPROC-STD',
        planName: 'Standard in-process QC',
        category: 'IN_PROCESS',
        status: 'ACTIVE',
        revision: 'A',
        createdBy: userId,
        lines: {
          create: [
            { tenantId: tenant.id, parameterId: qpVisual.id, sortOrder: 0 },
            { tenantId: tenant.id, parameterId: qpDim.id, sortOrder: 1 },
            { tenantId: tenant.id, parameterId: qpNotes.id, sortOrder: 2, mandatoryOverride: false },
          ],
        },
      },
    })
  } else {
    await prisma.qualityInspectionPlan.update({
      where: { id: inProcess.id },
      data: { status: 'ACTIVE', deletedAt: null, updatedBy: userId },
    })
  }

  let finalPlan = await prisma.qualityInspectionPlan.findFirst({
    where: { tenantId: tenant.id, planCode: 'IP-FINAL-STD', deletedAt: null },
  })
  if (!finalPlan) {
    finalPlan = await prisma.qualityInspectionPlan.create({
      data: {
        tenantId: tenant.id,
        planCode: 'IP-FINAL-STD',
        planName: 'Standard final QC',
        category: 'FINAL',
        status: 'ACTIVE',
        revision: 'A',
        createdBy: userId,
        lines: {
          create: [
            { tenantId: tenant.id, parameterId: qpVisual.id, sortOrder: 0 },
            { tenantId: tenant.id, parameterId: qpDim.id, sortOrder: 1 },
          ],
        },
      },
    })
  } else {
    await prisma.qualityInspectionPlan.update({
      where: { id: finalPlan.id },
      data: { status: 'ACTIVE', deletedAt: null, updatedBy: userId },
    })
  }

  const profileUpdated = await prisma.manufacturingProfile.updateMany({
    where: { tenantId: tenant.id, defaultQualityPlanRef: null },
    data: { defaultQualityPlanRef: inProcess.planCode },
  })

  const params = await prisma.qualityParameter.count({ where: { tenantId: tenant.id, deletedAt: null } })
  const plans = await prisma.qualityInspectionPlan.count({ where: { tenantId: tenant.id, deletedAt: null } })

  console.log(`Seeded Quality 4B masters for ${tenant.slug}`)
  console.log(`  Parameters: ${params} (incl. QP-VISUAL, QP-DIM-LEN, QP-NOTES)`)
  console.log(`  Plans: ${plans} (IP-INPROC-STD, IP-FINAL-STD)`)
  console.log(`  Profiles updated with defaultQualityPlanRef: ${profileUpdated.count}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
