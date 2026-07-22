/**
 * Apply missing objects from 20260721120000_purchase_setup_full_persistence
 * that were skipped when enum-shrink on query 1 failed but migration was marked applied.
 */
import fs from 'node:fs'
import path from 'node:path'
import { prisma } from '../src/config/database.js'

async function tableExists(name: string) {
  const r = await prisma.$queryRawUnsafe<any[]>(`SHOW TABLES LIKE '${name}'`)
  return r.length > 0
}

async function fkExists(name: string) {
  const r = await prisma.$queryRawUnsafe<any[]>(
    `SELECT 1 FROM information_schema.TABLE_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    name,
  )
  return r.length > 0
}

async function exec(label: string, sql: string) {
  console.log('>>', label)
  await prisma.$executeRawUnsafe(sql)
}

async function main() {
  const sqlPath = path.join(
    process.cwd(),
    'prisma/migrations/20260721120000_purchase_setup_full_persistence/migration.sql',
  )
  const full = fs.readFileSync(sqlPath, 'utf8')

  // Extract CREATE TABLE blocks we still need
  const needed = [
    'quality_inspection_lines',
    'purchase_invoices',
    'purchase_invoice_lines',
    'purchase_returns',
    'purchase_return_lines',
  ]

  for (const table of needed) {
    if (await tableExists(table)) {
      console.log('skip create', table, '(exists)')
      continue
    }
    const re = new RegExp(
      `CREATE TABLE \\\`${table}\\\` \\([\\s\\S]*?\\) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
    )
    const m = full.match(re)
    if (!m) throw new Error(`Could not extract CREATE TABLE for ${table}`)
    await exec(`CREATE ${table}`, m[0])
  }

  const fks: Array<{ name: string; sql: string }> = [
    {
      name: 'quality_inspection_lines_tenantId_fkey',
      sql: `ALTER TABLE \`quality_inspection_lines\`
  ADD CONSTRAINT \`quality_inspection_lines_tenantId_fkey\`
    FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    },
    {
      name: 'quality_inspection_lines_qualityInspectionId_fkey',
      sql: `ALTER TABLE \`quality_inspection_lines\`
  ADD CONSTRAINT \`quality_inspection_lines_qualityInspectionId_fkey\`
    FOREIGN KEY (\`qualityInspectionId\`) REFERENCES \`quality_inspections\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    },
    {
      name: 'purchase_invoices_tenantId_fkey',
      sql: `ALTER TABLE \`purchase_invoices\`
  ADD CONSTRAINT \`purchase_invoices_tenantId_fkey\`
    FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    },
    {
      name: 'purchase_invoice_lines_tenantId_fkey',
      sql: `ALTER TABLE \`purchase_invoice_lines\`
  ADD CONSTRAINT \`purchase_invoice_lines_tenantId_fkey\`
    FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    },
    {
      name: 'purchase_invoice_lines_purchaseInvoiceId_fkey',
      sql: `ALTER TABLE \`purchase_invoice_lines\`
  ADD CONSTRAINT \`purchase_invoice_lines_purchaseInvoiceId_fkey\`
    FOREIGN KEY (\`purchaseInvoiceId\`) REFERENCES \`purchase_invoices\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    },
    {
      name: 'purchase_returns_tenantId_fkey',
      sql: `ALTER TABLE \`purchase_returns\`
  ADD CONSTRAINT \`purchase_returns_tenantId_fkey\`
    FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    },
    {
      name: 'purchase_return_lines_tenantId_fkey',
      sql: `ALTER TABLE \`purchase_return_lines\`
  ADD CONSTRAINT \`purchase_return_lines_tenantId_fkey\`
    FOREIGN KEY (\`tenantId\`) REFERENCES \`tenants\`(\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE`,
    },
    {
      name: 'purchase_return_lines_purchaseReturnId_fkey',
      sql: `ALTER TABLE \`purchase_return_lines\`
  ADD CONSTRAINT \`purchase_return_lines_purchaseReturnId_fkey\`
    FOREIGN KEY (\`purchaseReturnId\`) REFERENCES \`purchase_returns\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    },
  ]

  for (const fk of fks) {
    if (await fkExists(fk.name)) {
      console.log('skip fk', fk.name)
      continue
    }
    try {
      await exec(fk.name, fk.sql)
    } catch (e: any) {
      console.warn('fk warning', fk.name, e?.message ?? e)
    }
  }

  for (const t of needed) {
    console.log(t, (await tableExists(t)) ? 'EXISTS' : 'MISSING')
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
