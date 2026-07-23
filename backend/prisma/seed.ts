import { PERMISSIONS, ROLE_PERMISSIONS, DEFAULT_PIPELINE_STAGES } from '../src/constants/permissions.js'
import { prisma } from '../src/config/database.js'
import { hashPassword } from '../src/utils/password.js'
import { initTenantCodeSeries } from '../src/services/codeSeries.service.js'

async function seedPermissions(): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  for (const name of PERMISSIONS) {
    const [module] = name.split('.')
    const perm = await prisma.permission.upsert({
      where: { name },
      create: { name, module, description: name },
      update: {},
    })
    map.set(name, perm.id)
  }
  return map
}

async function seedRole(
  name: string,
  permissionMap: Map<string, string>,
  tenantId: string | null,
  isSystem: boolean,
): Promise<string> {
  let role = await prisma.role.findFirst({
    where: { name, tenantId: tenantId ?? null },
  })

  if (!role) {
    role = await prisma.role.create({
      data: { name, tenantId, isSystem, description: `${name} role` },
    })
  }

  const permNames = ROLE_PERMISSIONS[name] ?? []
  for (const permName of permNames) {
    const permissionId = permissionMap.get(permName)
    if (!permissionId) continue
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: role.id, permissionId } },
      create: { roleId: role.id, permissionId },
      update: {},
    })
  }
  return role.id
}

async function main(): Promise<void> {
  console.log('Seeding database...')

  const permissionMap = await seedPermissions()

  const superAdminRoleId = await seedRole('Super Admin', permissionMap, null, true)

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'vasant-trailers' },
    create: {
      name: 'Vasant Trailers',
      slug: 'vasant-trailers',
      legalName: 'Vasant Trailers Pvt Ltd',
      email: 'admin@vasant-trailers.com',
      phone: '+91 9876543210',
      country: 'India',
      state: 'Gujarat',
      city: 'Ahmedabad',
      status: 'ACTIVE',
      subscriptionPlan: 'trial',
      subscriptionStatus: 'active',
    },
    update: {},
  })

  const tenantAdminRoleId = await seedRole('Tenant Admin', permissionMap, tenant.id, true)
  await seedRole('Admin', permissionMap, tenant.id, true)
  await seedRole('Administrator', permissionMap, tenant.id, true)
  await seedRole('CEO', permissionMap, tenant.id, true)
  await seedRole('CRM Admin', permissionMap, tenant.id, true)
  await seedRole('Master Data Manager', permissionMap, tenant.id, true)
  await seedRole('Purchase Manager', permissionMap, tenant.id, true)
  await seedRole('Purchase Executive', permissionMap, tenant.id, true)
  await seedRole('Requester', permissionMap, tenant.id, true)
  await seedRole('Department Manager', permissionMap, tenant.id, true)
  await seedRole('Department Head', permissionMap, tenant.id, true)
  await seedRole('Administrator', permissionMap, tenant.id, true)
  await seedRole('Inventory Manager', permissionMap, tenant.id, true)
  await seedRole('Sales Manager', permissionMap, tenant.id, true)
  await seedRole('Production Manager', permissionMap, tenant.id, true)
  await seedRole('Production Supervisor', permissionMap, tenant.id, true)
  await seedRole('Production Engineer', permissionMap, tenant.id, true)
  await seedRole('Sales Executive', permissionMap, tenant.id, true)
  await seedRole('Viewer', permissionMap, tenant.id, true)

  // Rebuild Tenant Admin / Admin / Administrator grants on every tenant so catalog
  // expansions (e.g. production.view) land without a one-off migration script.
  const allTenants = await prisma.tenant.findMany({ select: { id: true, slug: true } })
  for (const t of allTenants) {
    await seedRole('Tenant Admin', permissionMap, t.id, true)
    await seedRole('Admin', permissionMap, t.id, true)
    await seedRole('Administrator', permissionMap, t.id, true)
    console.log(`  Synced workspace-admin role packs for tenant ${t.slug}`)
  }

  await initTenantCodeSeries(tenant.id)

  const adminPassword = await hashPassword('Admin@123')
  const superPassword = await hashPassword('Super@123')

  const superAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'super@fos-erp.com' } },
    create: {
      tenantId: tenant.id,
      firstName: 'Super',
      lastName: 'Admin',
      email: 'super@fos-erp.com',
      passwordHash: superPassword,
      status: 'ACTIVE',
      emailVerified: true,
      designation: 'System Administrator',
    },
    update: {},
  })

  const tenantAdmin = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@vasant-trailers.com' } },
    create: {
      tenantId: tenant.id,
      firstName: 'Rajesh',
      lastName: 'Patel',
      email: 'admin@vasant-trailers.com',
      mobile: '9876543210',
      passwordHash: adminPassword,
      status: 'ACTIVE',
      emailVerified: true,
      designation: 'Managing Director',
      department: 'Management',
    },
    update: {},
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: superAdmin.id, roleId: superAdminRoleId } },
    create: { userId: superAdmin.id, roleId: superAdminRoleId, tenantId: tenant.id },
    update: {},
  })

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: tenantAdmin.id, roleId: tenantAdminRoleId } },
    create: { userId: tenantAdmin.id, roleId: tenantAdminRoleId, tenantId: tenant.id },
    update: {},
  })

  const pipeline = await prisma.crmPipeline.upsert({
    where: { id: '00000000-0000-4000-8000-000000000001' },
    create: {
      id: '00000000-0000-4000-8000-000000000001',
      tenantId: tenant.id,
      name: 'Default Sales Pipeline',
      description: 'Standard CRM pipeline',
      isDefault: true,
      status: 'ACTIVE',
      createdBy: tenantAdmin.id,
    },
    update: {},
  })

  for (const stage of DEFAULT_PIPELINE_STAGES) {
    const isClosedWon = 'isClosedWon' in stage ? Boolean(stage.isClosedWon) : false
    const isClosedLost = 'isClosedLost' in stage ? Boolean(stage.isClosedLost) : false
    await prisma.crmPipelineStage.upsert({
      where: {
        tenantId_pipelineId_slug: {
          tenantId: tenant.id,
          pipelineId: pipeline.id,
          slug: stage.slug,
        },
      },
      create: {
        tenantId: tenant.id,
        pipelineId: pipeline.id,
        name: stage.name,
        slug: stage.slug,
        sequence: stage.sequence,
        probability: stage.probability,
        isClosedWon,
        isClosedLost,
        createdBy: tenantAdmin.id,
      },
      update: {
        name: stage.name,
        sequence: stage.sequence,
        probability: stage.probability,
        isClosedWon,
        isClosedLost,
        deletedAt: null,
        updatedBy: tenantAdmin.id,
      },
    })
  }

  const { CRM_MASTER_SEED_ROWS } = await import('./crmMasterSeedData.js')
  for (const row of CRM_MASTER_SEED_ROWS) {
    await prisma.crmMaster.upsert({
      where: {
        tenantId_kind_code: { tenantId: tenant.id, kind: row.kind, code: row.code },
      },
      create: {
        tenantId: tenant.id,
        kind: row.kind,
        code: row.code,
        name: row.name,
        sortOrder: row.sortOrder,
        attributes: row.attributes ?? {},
        isSystem: row.isSystem ?? false,
        status: 'active',
        createdBy: tenantAdmin.id,
        updatedBy: tenantAdmin.id,
      },
      update: {
        name: row.name,
        sortOrder: row.sortOrder,
        attributes: row.attributes ?? {},
      },
    })
  }

  const { GEO_COUNTRY_SEED, GEO_STATE_SEED, GEO_CITY_SEED } = await import('./geographySeedData.js')

  for (const row of GEO_COUNTRY_SEED) {
    await prisma.masterCountry.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        name: row.name,
        status: 'ACTIVE',
        createdBy: tenantAdmin.id,
        updatedBy: tenantAdmin.id,
      },
      update: { name: row.name, status: 'ACTIVE', deletedAt: null },
    })
  }

  const stateIdByCode = new Map<string, string>()
  for (const row of GEO_STATE_SEED) {
    const st = await prisma.masterState.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        name: row.name,
        status: 'ACTIVE',
        createdBy: tenantAdmin.id,
        updatedBy: tenantAdmin.id,
      },
      update: { name: row.name, status: 'ACTIVE', deletedAt: null },
    })
    stateIdByCode.set(row.code, st.id)
  }

  let cityCount = 0
  for (const [stateCode, cities] of Object.entries(GEO_CITY_SEED)) {
    const stateId = stateIdByCode.get(stateCode)
    if (!stateId) continue
    for (const cityName of cities) {
      await prisma.masterCity.upsert({
        where: {
          tenantId_stateId_name: { tenantId: tenant.id, stateId, name: cityName },
        },
        create: {
          tenantId: tenant.id,
          stateId,
          name: cityName,
          status: 'ACTIVE',
          createdBy: tenantAdmin.id,
          updatedBy: tenantAdmin.id,
        },
        update: { status: 'ACTIVE', deletedAt: null },
      })
      cityCount += 1
    }
  }

  const { PRODUCT_SEED_ROWS, VASANT_FG_ITEM_SEED } = await import('./productSeedData.js')

  const nosUom = await prisma.masterUom.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'Nos' } },
    create: {
      tenantId: tenant.id,
      code: 'Nos',
      name: 'Numbers',
      description: 'Each / unit count',
      uomType: 'integer',
      decimalPlaces: 0,
      isBaseUnit: true,
      status: 'ACTIVE',
      createdBy: tenantAdmin.id,
      updatedBy: tenantAdmin.id,
    },
    update: { status: 'ACTIVE', deletedAt: null, name: 'Numbers' },
  })

  const fgCategory = await prisma.masterItemCategory.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'CAT-FG' } },
    create: {
      tenantId: tenant.id,
      code: 'CAT-FG',
      name: 'Finished Goods',
      level: 1,
      status: 'ACTIVE',
      createdBy: tenantAdmin.id,
      updatedBy: tenantAdmin.id,
    },
    update: { status: 'ACTIVE', deletedAt: null, name: 'Finished Goods' },
  })

  const fgItemIdByCode = new Map<string, string>()
  const fgItemSeed = [
    ...VASANT_FG_ITEM_SEED,
    { code: 'FG-45M3-BULKER', name: '45 M3 Bulker Trailer', standardRate: 2850000 },
    { code: 'FG-ISO-TANK-26K', name: '26 KL ISO Tank', standardRate: 4200000 },
    { code: 'FG-SIDEWALL-32FT', name: '32 FT Side Wall Trailer', standardRate: 1950000 },
  ]
  const fgSeen = new Set<string>()
  for (const fg of fgItemSeed) {
    if (fgSeen.has(fg.code)) continue
    fgSeen.add(fg.code)
    const item = await prisma.masterItem.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: fg.code } },
      create: {
        tenantId: tenant.id,
        code: fg.code,
        name: fg.name,
        itemDescription: fg.name,
        categoryId: fgCategory.id,
        baseUomId: nosUom.id,
        itemType: 'finished_good',
        productType: 'finish_product',
        inventoryType: 'inventory',
        hsnCode: '8716',
        standardRate: fg.standardRate,
        isPurchasable: false,
        isStockable: true,
        status: 'ACTIVE',
        createdBy: tenantAdmin.id,
        updatedBy: tenantAdmin.id,
      },
      update: {
        name: fg.name,
        itemDescription: fg.name,
        categoryId: fgCategory.id,
        baseUomId: nosUom.id,
        itemType: 'finished_good',
        productType: 'finish_product',
        standardRate: fg.standardRate,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
    fgItemIdByCode.set(fg.code, item.id)
  }

  for (const row of PRODUCT_SEED_ROWS) {
    const fgItemId = row.fgItemCode ? fgItemIdByCode.get(row.fgItemCode) ?? null : null
    await prisma.masterProduct.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        name: row.name,
        productFamily: row.productFamily,
        productType: row.productType,
        fgItemId,
        capacity: row.capacity,
        axleConfig: row.axleConfig,
        tareWeightKg: row.tareWeightKg,
        gvwKg: row.gvwKg,
        standardPrice: row.standardPrice,
        standardLeadDays: row.standardLeadDays,
        baseUomId: nosUom.id,
        hsnCode: row.hsnCode,
        specifications: row.specifications,
        productStatus: row.productStatus,
        details: row.details,
        status: 'ACTIVE',
        createdBy: tenantAdmin.id,
        updatedBy: tenantAdmin.id,
      },
      update: {
        name: row.name,
        productFamily: row.productFamily,
        productType: row.productType,
        fgItemId,
        capacity: row.capacity,
        axleConfig: row.axleConfig,
        tareWeightKg: row.tareWeightKg,
        gvwKg: row.gvwKg,
        standardPrice: row.standardPrice,
        standardLeadDays: row.standardLeadDays,
        baseUomId: nosUom.id,
        hsnCode: row.hsnCode,
        specifications: row.specifications,
        productStatus: row.productStatus,
        details: row.details,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
  }

  const { QUOTATION_TEMPLATE_SEED_ROWS, QUOTATION_TEMPLATE_KEEP_CODES, VF_WORD_PRINT_LAYOUT_SEED } =
    await import('./quotationTemplateSeedData.js')
  for (const row of QUOTATION_TEMPLATE_SEED_ROWS) {
    await prisma.crmQuotationTemplate.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        templateName: row.templateName,
        productFamily: row.productFamily,
        version: row.version,
        sections: row.sections,
        defaultTerms: row.defaultTerms,
        defaultWarranty: row.defaultWarranty,
        defaultExclusions: row.defaultExclusions,
        printLayout: VF_WORD_PRINT_LAYOUT_SEED,
        isActive: true,
        createdBy: tenantAdmin.id,
        updatedBy: tenantAdmin.id,
      },
      update: {
        templateName: row.templateName,
        productFamily: row.productFamily,
        version: row.version,
        sections: row.sections,
        defaultTerms: row.defaultTerms,
        defaultWarranty: row.defaultWarranty,
        defaultExclusions: row.defaultExclusions,
        printLayout: VF_WORD_PRINT_LAYOUT_SEED,
        isActive: true,
        deletedAt: null,
        updatedBy: tenantAdmin.id,
      },
    })
  }

  // Live/demo seed must not leave trailer/bulker/custom templates active.
  const retiredTemplates = await prisma.crmQuotationTemplate.updateMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      code: { notIn: [...QUOTATION_TEMPLATE_KEEP_CODES] },
    },
    data: {
      deletedAt: new Date(),
      isActive: false,
      updatedBy: tenantAdmin.id,
    },
  })
  if (retiredTemplates.count > 0) {
    console.log(`Quotation templates retired (extras soft-deleted): ${retiredTemplates.count}`)
  }

  const { WAREHOUSE_SEED_ROWS, LOCATION_SEED_ROWS } = await import('./warehouseLocationSeedData.js')
  const warehouseIdByCode = new Map<string, string>()
  for (const row of WAREHOUSE_SEED_ROWS) {
    const wh = await prisma.masterWarehouse.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        code: row.code,
        name: row.name,
        warehouseType: row.warehouseType,
        plantCode: row.plantCode,
        address: row.address ?? null,
        status: 'ACTIVE',
        createdBy: tenantAdmin.id,
        updatedBy: tenantAdmin.id,
      },
      update: {
        name: row.name,
        warehouseType: row.warehouseType,
        plantCode: row.plantCode,
        address: row.address ?? null,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: tenantAdmin.id,
      },
    })
    warehouseIdByCode.set(row.code, wh.id)
  }

  let locationCount = 0
  for (const row of LOCATION_SEED_ROWS) {
    const warehouseId = warehouseIdByCode.get(row.warehouseCode)
    if (!warehouseId) {
      console.warn(`Skipping location ${row.code}: warehouse ${row.warehouseCode} not found`)
      continue
    }
    await prisma.masterLocation.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: row.code } },
      create: {
        tenantId: tenant.id,
        warehouseId,
        code: row.code,
        name: row.name,
        addressLine1: row.addressLine1 ?? null,
        addressLine2: row.addressLine2 ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        pincode: row.pincode ?? null,
        country: row.country ?? 'India',
        gstin: row.gstin ?? null,
        registeredType: row.registeredType ?? null,
        allowSales: row.allowSales ?? true,
        allowPurchase: row.allowPurchase ?? true,
        allowProduction: row.allowProduction ?? true,
        allowInventory: row.allowInventory ?? true,
        status: 'ACTIVE',
        createdBy: tenantAdmin.id,
        updatedBy: tenantAdmin.id,
      },
      update: {
        warehouseId,
        name: row.name,
        addressLine1: row.addressLine1 ?? null,
        addressLine2: row.addressLine2 ?? null,
        city: row.city ?? null,
        state: row.state ?? null,
        pincode: row.pincode ?? null,
        country: row.country ?? 'India',
        gstin: row.gstin ?? null,
        registeredType: row.registeredType ?? null,
        allowSales: row.allowSales ?? true,
        allowPurchase: row.allowPurchase ?? true,
        allowProduction: row.allowProduction ?? true,
        allowInventory: row.allowInventory ?? true,
        status: 'ACTIVE',
        deletedAt: null,
        updatedBy: tenantAdmin.id,
      },
    })
    locationCount += 1
  }

  // Quality Phase 4B — sample parameters + active IN_PROCESS plan
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
      createdBy: tenantAdmin.id,
    },
    update: { active: true, deletedAt: null, updatedBy: tenantAdmin.id },
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
      createdBy: tenantAdmin.id,
    },
    update: { active: true, deletedAt: null, updatedBy: tenantAdmin.id },
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
      createdBy: tenantAdmin.id,
    },
    update: { active: true, deletedAt: null, updatedBy: tenantAdmin.id },
  })

  const inProcessPlan = await prisma.qualityInspectionPlan.upsert({
    where: { tenantId_planCode: { tenantId: tenant.id, planCode: 'IP-INPROC-STD' } },
    create: {
      tenantId: tenant.id,
      planCode: 'IP-INPROC-STD',
      planName: 'Standard in-process QC',
      category: 'IN_PROCESS',
      status: 'ACTIVE',
      revision: 'A',
      createdBy: tenantAdmin.id,
      lines: {
        create: [
          { tenantId: tenant.id, parameterId: qpVisual.id, sortOrder: 0 },
          { tenantId: tenant.id, parameterId: qpDim.id, sortOrder: 1 },
          { tenantId: tenant.id, parameterId: qpNotes.id, sortOrder: 2, mandatoryOverride: false },
        ],
      },
    },
    update: { status: 'ACTIVE', deletedAt: null, updatedBy: tenantAdmin.id },
  })

  const finalPlan = await prisma.qualityInspectionPlan.upsert({
    where: { tenantId_planCode: { tenantId: tenant.id, planCode: 'IP-FINAL-STD' } },
    create: {
      tenantId: tenant.id,
      planCode: 'IP-FINAL-STD',
      planName: 'Standard final QC',
      category: 'FINAL',
      status: 'ACTIVE',
      revision: 'A',
      createdBy: tenantAdmin.id,
      lines: {
        create: [
          { tenantId: tenant.id, parameterId: qpVisual.id, sortOrder: 0 },
          { tenantId: tenant.id, parameterId: qpDim.id, sortOrder: 1 },
        ],
      },
    },
    update: { status: 'ACTIVE', deletedAt: null, updatedBy: tenantAdmin.id },
  })

  // Ensure default profile ref points at in-process plan code when profile exists
  await prisma.manufacturingProfile.updateMany({
    where: { tenantId: tenant.id, defaultQualityPlanRef: null },
    data: { defaultQualityPlanRef: inProcessPlan.planCode },
  })

  console.log('\n=== Seed complete ===')
  console.log(`Tenant: ${tenant.name} (slug: ${tenant.slug})`)
  console.log(`Geography: ${GEO_COUNTRY_SEED.length} countries, ${GEO_STATE_SEED.length} states, ${cityCount} cities`)
  console.log(`Warehouses: ${WAREHOUSE_SEED_ROWS.length}`)
  console.log(`Locations: ${locationCount}`)
  console.log(`Products: ${PRODUCT_SEED_ROWS.length}`)
  console.log(`FG items: ${fgItemIdByCode.size}`)
  console.log(`Quotation templates: ${QUOTATION_TEMPLATE_SEED_ROWS.length}`)
  console.log(`QC parameters: 3 · plans: ${inProcessPlan.planCode}, ${finalPlan.planCode}`)
  console.log('\nDevelopment credentials:')
  console.log('  Super Admin: super@fos-erp.com / Super@123')
  console.log('  Tenant Admin: admin@vasant-trailers.com / Admin@123')
  console.log(`\nLogin with tenantSlug: "${tenant.slug}"`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
