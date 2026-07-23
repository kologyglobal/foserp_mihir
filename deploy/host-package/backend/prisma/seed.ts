import { PrismaClient } from '@prisma/client'
import { PERMISSIONS, ROLE_PERMISSIONS, DEFAULT_PIPELINE_STAGES } from '../src/constants/permissions.js'
import { hashPassword } from '../src/utils/password.js'
import { initTenantCodeSeries } from '../src/services/codeSeries.service.js'

const prisma = new PrismaClient()

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
  await seedRole('CRM Admin', permissionMap, tenant.id, true)
  await seedRole('Master Data Manager', permissionMap, tenant.id, true)
  await seedRole('Purchase Manager', permissionMap, tenant.id, true)
  await seedRole('Inventory Manager', permissionMap, tenant.id, true)
  await seedRole('Sales Manager', permissionMap, tenant.id, true)
  await seedRole('Production Manager', permissionMap, tenant.id, true)
  await seedRole('Sales Executive', permissionMap, tenant.id, true)
  await seedRole('Viewer', permissionMap, tenant.id, true)

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
    update: {
      firstName: 'Rajesh',
      lastName: 'Patel',
      status: 'ACTIVE',
      deletedAt: null,
      designation: 'Managing Director',
      department: 'Management',
    },
  })

  const salesUsers = [
    {
      email: 'priya@vasant-trailers.com',
      firstName: 'Priya',
      lastName: 'Deshmukh',
      mobile: '9876543211',
      designation: 'Sales Executive',
      department: 'Sales',
    },
    {
      email: 'amit@vasant-trailers.com',
      firstName: 'Amit',
      lastName: 'Sharma',
      mobile: '9876543212',
      designation: 'Sales Executive',
      department: 'Sales',
    },
    {
      email: 'sneha@vasant-trailers.com',
      firstName: 'Sneha',
      lastName: 'Patil',
      mobile: '9876543213',
      designation: 'Sales Coordinator',
      department: 'Sales',
    },
  ] as const

  const salesPassword = await hashPassword('Sales@123')
  const seededSalesUsers: Array<{ id: string; firstName: string; lastName: string; designation: string; department: string }> = []
  for (const su of salesUsers) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: su.email } },
      create: {
        tenantId: tenant.id,
        firstName: su.firstName,
        lastName: su.lastName,
        email: su.email,
        mobile: su.mobile,
        passwordHash: salesPassword,
        status: 'ACTIVE',
        emailVerified: true,
        designation: su.designation,
        department: su.department,
      },
      update: {
        firstName: su.firstName,
        lastName: su.lastName,
        status: 'ACTIVE',
        deletedAt: null,
        designation: su.designation,
        department: su.department,
      },
    })
    seededSalesUsers.push({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      designation: su.designation,
      department: su.department,
    })
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: tenantAdminRoleId } },
      create: { userId: user.id, roleId: tenantAdminRoleId, tenantId: tenant.id },
      update: {},
    })
  }

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
        isClosedWon: 'isClosedWon' in stage ? stage.isClosedWon : false,
        isClosedLost: 'isClosedLost' in stage ? stage.isClosedLost : false,
        createdBy: tenantAdmin.id,
      },
      update: {},
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

  // CRM owners must use real user UUIDs (assign / opportunity owner APIs)
  const ownerRows = [
    {
      id: tenantAdmin.id,
      name: 'Rajesh Patel',
      designation: 'Managing Director',
      department: 'Management',
    },
    ...seededSalesUsers.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`.trim(),
      designation: u.designation,
      department: u.department,
    })),
  ]
  for (let i = 0; i < ownerRows.length; i++) {
    const o = ownerRows[i]
    await prisma.crmMaster.upsert({
      where: { tenantId_kind_code: { tenantId: tenant.id, kind: 'owners', code: o.id } },
      create: {
        tenantId: tenant.id,
        kind: 'owners',
        code: o.id,
        name: o.name,
        sortOrder: i + 1,
        attributes: { role: o.designation, department: o.department },
        isSystem: true,
        status: 'active',
        createdBy: tenantAdmin.id,
        updatedBy: tenantAdmin.id,
      },
      update: {
        name: o.name,
        sortOrder: i + 1,
        attributes: { role: o.designation, department: o.department },
        status: 'active',
        deletedAt: null,
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

  await prisma.crmQuotationTemplate.updateMany({
    where: {
      tenantId: tenant.id,
      deletedAt: null,
      code: { notIn: [...QUOTATION_TEMPLATE_KEEP_CODES] },
    },
    data: { deletedAt: new Date(), isActive: false, updatedBy: tenantAdmin.id },
  })

  console.log('\n=== Seed complete ===')
  console.log(`Tenant: ${tenant.name} (slug: ${tenant.slug})`)
  console.log(`Geography: ${GEO_COUNTRY_SEED.length} countries, ${GEO_STATE_SEED.length} states, ${cityCount} cities`)
  console.log(`Products: ${PRODUCT_SEED_ROWS.length}`)
  console.log(`FG items: ${fgItemIdByCode.size}`)
  console.log(`Quotation templates: ${QUOTATION_TEMPLATE_SEED_ROWS.length}`)
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
