/**
 * Seed tenant `kology` as SERVICES packaging — reuses FOS CRM/Sales/Accounting.
 * Never hardcodes product behaviour on slug in runtime; only seed identity uses slug.
 */
import { prisma } from '../src/config/database.js'
import { hashPassword } from '../src/utils/password.js'
import { initTenantCodeSeries } from '../src/services/codeSeries.service.js'
import {
  applyServicesModulePack,
  SERVICES_DISPLAY_TERMINOLOGY,
} from '../src/modules/modules/tenant-packaging.js'

const KOLOGY_SERVICES: Array<{
  code: string
  name: string
  description: string
  billingType: string
  rate: number
}> = [
  { code: 'SVC-SAAS', name: 'Sales as a Service', description: 'Outsourced B2B sales execution', billingType: 'MONTHLY', rate: 150000 },
  { code: 'SVC-MAAS', name: 'Marketing as a Service', description: 'Demand generation and nurture', billingType: 'MONTHLY', rate: 120000 },
  { code: 'SVC-LEAD', name: 'Lead Generation', description: 'Qualified B2B lead generation', billingType: 'PER_LEAD', rate: 2500 },
  { code: 'SVC-BDC', name: 'Business Development Consulting', description: 'BD strategy and pipeline coaching', billingType: 'FIXED_PROJECT', rate: 300000 },
  { code: 'SVC-STAFF', name: 'Staff Augmentation', description: 'Remote SDR/BDR capacity', billingType: 'PER_RESOURCE', rate: 80000 },
  { code: 'SVC-ERP', name: 'ERP Consulting', description: 'ERP process and implementation advisory', billingType: 'DAILY', rate: 25000 },
  { code: 'SVC-SOFT', name: 'Software Consulting', description: 'Software architecture and delivery consulting', billingType: 'HOURLY', rate: 4500 },
  { code: 'SVC-DX', name: 'Digital Transformation Consulting', description: 'DX roadmap and change programmes', billingType: 'MILESTONE', rate: 500000 },
  { code: 'SVC-AI', name: 'AI Consulting', description: 'AI opportunity assessment and pilots', billingType: 'FIXED_PROJECT', rate: 400000 },
  { code: 'SVC-EMAIL', name: 'Email Outbound System', description: 'Cold email infrastructure and sequences', billingType: 'MONTHLY', rate: 45000 },
  { code: 'SVC-LI', name: 'LinkedIn Outreach', description: 'LinkedIn lead generation campaigns', billingType: 'MONTHLY', rate: 55000 },
  { code: 'SVC-OBC', name: 'Offshore Business Center', description: 'Managed offshore sales operations', billingType: 'MONTHLY', rate: 250000 },
]

type SeedRoleFn = (
  name: string,
  permissionMap: Map<string, string>,
  tenantId: string | null,
  isSystem: boolean,
) => Promise<string>

export async function seedKologyTenant(
  permissionMap: Map<string, string>,
  seedRole: SeedRoleFn,
): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'kology' },
    create: {
      name: 'Kology',
      slug: 'kology',
      legalName: 'Kology Global Groupe Pvt Ltd.',
      email: 'admin@kology.co',
      phone: '+91 9876500000',
      country: 'India',
      state: 'Gujarat',
      city: 'Ahmedabad',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      status: 'ACTIVE',
      businessType: 'SERVICES',
      displayTerminology: SERVICES_DISPLAY_TERMINOLOGY,
      subscriptionPlan: 'services',
      subscriptionStatus: 'active',
    },
    update: {
      name: 'Kology',
      legalName: 'Kology Global Groupe Pvt Ltd.',
      email: 'admin@kology.co',
      businessType: 'SERVICES',
      displayTerminology: SERVICES_DISPLAY_TERMINOLOGY,
      subscriptionPlan: 'services',
      subscriptionStatus: 'active',
      status: 'ACTIVE',
      deletedAt: null,
    },
  })

  await applyServicesModulePack(tenant.id)
  await initTenantCodeSeries(tenant.id)

  const adminRoleId = await seedRole('Tenant Admin', permissionMap, tenant.id, true)
  await seedRole('Admin', permissionMap, tenant.id, true)
  const salesMgrRoleId = await seedRole('Sales Manager', permissionMap, tenant.id, true)
  await seedRole('Sales Executive', permissionMap, tenant.id, true)
  const financeMgrRoleId = await seedRole('Finance Manager', permissionMap, tenant.id, true)
  await seedRole('Finance Executive', permissionMap, tenant.id, true)
  await seedRole('CRM User', permissionMap, tenant.id, true)
  await seedRole('CRM Admin', permissionMap, tenant.id, true)

  async function upsertUser(input: {
    email: string
    password: string
    firstName: string
    lastName: string
    designation: string
    department: string
    roleIds: string[]
  }) {
    const passwordHash = await hashPassword(input.password)
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: input.email } },
      create: {
        tenantId: tenant.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
        designation: input.designation,
        department: input.department,
      },
      update: {
        firstName: input.firstName,
        lastName: input.lastName,
        passwordHash,
        status: 'ACTIVE',
        emailVerified: true,
        designation: input.designation,
        department: input.department,
        deletedAt: null,
      },
    })
    for (const roleId of input.roleIds) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        create: { userId: user.id, roleId, tenantId: tenant.id },
        update: {},
      })
    }
  }

  await upsertUser({
    email: 'admin@kology.co',
    password: 'Admin@123',
    firstName: 'Kology',
    lastName: 'Admin',
    designation: 'Tenant Admin',
    department: 'Management',
    roleIds: [adminRoleId],
  })
  await upsertUser({
    email: 'sales@kology.co',
    password: 'Sales@123',
    firstName: 'Sales',
    lastName: 'Manager',
    designation: 'Sales Manager',
    department: 'Sales',
    roleIds: [salesMgrRoleId],
  })
  await upsertUser({
    email: 'accounts@kology.co',
    password: 'Accounts@123',
    firstName: 'Accounts',
    lastName: 'Executive',
    designation: 'Finance Manager',
    department: 'Accounts',
    roleIds: [financeMgrRoleId],
  })

  // Minimal UOM + service category for MasterItem
  const uom = await prisma.masterUom.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'NOS' } },
    create: {
      tenantId: tenant.id,
      code: 'NOS',
      name: 'Numbers',
      status: 'ACTIVE',
    },
    update: { name: 'Numbers', status: 'ACTIVE', deletedAt: null },
  })

  const category = await prisma.masterItemCategory.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'SVC' } },
    create: {
      tenantId: tenant.id,
      code: 'SVC',
      name: 'Services',
      level: 1,
      stockPolicy: 'FORBIDDEN',
      defaultIsStockable: false,
      defaultInventoryType: 'non_inventory',
      status: 'ACTIVE',
    },
    update: {
      name: 'Services',
      stockPolicy: 'FORBIDDEN',
      defaultIsStockable: false,
      status: 'ACTIVE',
      deletedAt: null,
    },
  })

  for (const svc of KOLOGY_SERVICES) {
    await prisma.masterItem.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: svc.code } },
      create: {
        tenantId: tenant.id,
        code: svc.code,
        name: svc.name,
        itemDescription: svc.description,
        salesDescription: svc.description,
        categoryId: category.id,
        baseUomId: uom.id,
        itemType: 'service',
        isPurchasable: false,
        isStockable: false,
        salesAllowed: true,
        productionAllowed: false,
        defaultFulfilmentMethod: 'SERVICE',
        defaultSalesRate: svc.rate,
        standardRate: svc.rate,
        hsnCode: '9983',
        status: 'ACTIVE',
        productType: svc.billingType,
      },
      update: {
        name: svc.name,
        itemDescription: svc.description,
        salesDescription: svc.description,
        itemType: 'service',
        isPurchasable: false,
        isStockable: false,
        salesAllowed: true,
        productionAllowed: false,
        defaultFulfilmentMethod: 'SERVICE',
        defaultSalesRate: svc.rate,
        standardRate: svc.rate,
        productType: svc.billingType,
        status: 'ACTIVE',
        deletedAt: null,
      },
    })
  }

  console.log(`\nKology SERVICES tenant ready (slug: kology)`)
  console.log('  Admin:    admin@kology.co    / Admin@123')
  console.log('  Sales:    sales@kology.co    / Sales@123')
  console.log('  Accounts: accounts@kology.co / Accounts@123')
  console.log(`  Services seeded: ${KOLOGY_SERVICES.length}`)
}
