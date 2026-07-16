/**
 * Ensure CRM owner options exist from tenant users (UUID codes).
 * Also creates sample sales users if missing.
 * Usage: npx tsx scripts/seed-crm-owners.ts
 */
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../src/utils/password.js'

config()

function buildDatabaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  const host = process.env.DB_HOST ?? 'localhost'
  const port = process.env.DB_PORT ?? '3306'
  const name = process.env.DB_NAME ?? 'fos_erp'
  const user = process.env.DB_USER ?? 'root'
  const pass = encodeURIComponent(process.env.DB_PASS ?? '')
  return `mysql://${user}:${pass}@${host}:${port}/${name}`
}

process.env.DATABASE_URL = buildDatabaseUrl()

const prisma = new PrismaClient()
const TENANT_SLUG = process.env.VITE_TENANT_SLUG ?? 'vasant-trailers'

async function main() {
  const tenant = await prisma.tenant.findUnique({ where: { slug: TENANT_SLUG } })
  if (!tenant) throw new Error(`Tenant not found: ${TENANT_SLUG}`)

  const admin = await prisma.user.findFirst({
    where: { tenantId: tenant.id, email: 'admin@vasant-trailers.com', deletedAt: null },
  })
  if (!admin) throw new Error('admin@vasant-trailers.com not found — run prisma seed first')

  const salesRole = await prisma.role.findFirst({
    where: { tenantId: tenant.id, name: 'Tenant Admin' },
  })
  if (!salesRole) throw new Error('Tenant Admin role missing')

  const salesPassword = await hashPassword('Sales@123')
  const salesUsers = [
    { email: 'priya@vasant-trailers.com', firstName: 'Priya', lastName: 'Deshmukh', mobile: '9876543211', designation: 'Sales Executive', department: 'Sales' },
    { email: 'amit@vasant-trailers.com', firstName: 'Amit', lastName: 'Sharma', mobile: '9876543212', designation: 'Sales Executive', department: 'Sales' },
    { email: 'sneha@vasant-trailers.com', firstName: 'Sneha', lastName: 'Patil', mobile: '9876543213', designation: 'Sales Coordinator', department: 'Sales' },
  ]

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
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: salesRole.id } },
      create: { userId: user.id, roleId: salesRole.id, tenantId: tenant.id },
      update: {},
    })
    console.log(`  ✓ user ${su.email}`)
  }

  const users = await prisma.user.findMany({
    where: { tenantId: tenant.id, deletedAt: null, status: 'ACTIVE' },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })

  let i = 0
  for (const u of users) {
    i += 1
    const name = `${u.firstName} ${u.lastName}`.trim()
    await prisma.crmMaster.upsert({
      where: { tenantId_kind_code: { tenantId: tenant.id, kind: 'owners', code: u.id } },
      create: {
        tenantId: tenant.id,
        kind: 'owners',
        code: u.id,
        name,
        sortOrder: i,
        attributes: { role: u.designation ?? '', department: u.department ?? '' },
        isSystem: true,
        status: 'active',
        createdBy: admin.id,
        updatedBy: admin.id,
      },
      update: {
        name,
        sortOrder: i,
        attributes: { role: u.designation ?? '', department: u.department ?? '' },
        status: 'active',
        deletedAt: null,
      },
    })
    console.log(`  ✓ owner ${name}`)
  }

  console.log(`\nDone. ${users.length} CRM owners ready for opportunity assignment.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
