import { prisma } from '../src/config/database.js'

/** Complete the failed purchase_setup_full_persistence migration after identifier-length fix. */
async function main() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS \`quality_inspection_lines\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`tenantId\` VARCHAR(191) NOT NULL,
    \`qualityInspectionId\` VARCHAR(191) NOT NULL,
    \`lineNumber\` INTEGER NOT NULL,
    \`goodsReceiptLineId\` VARCHAR(191) NULL,
    \`purchaseOrderLineId\` VARCHAR(191) NULL,
    \`itemId\` VARCHAR(191) NULL,
    \`itemCodeSnapshot\` VARCHAR(64) NOT NULL DEFAULT '',
    \`itemNameSnapshot\` VARCHAR(300) NOT NULL DEFAULT '',
    \`inspectedQuantity\` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    \`acceptedQuantity\` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    \`rejectedQuantity\` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    \`deviationQuantity\` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    \`remarks\` TEXT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`qi_lines_tenant_qi_lineno_key\`(\`tenantId\`, \`qualityInspectionId\`, \`lineNumber\`),
    INDEX \`quality_inspection_lines_tenantId_idx\`(\`tenantId\`),
    INDEX \`qi_lines_tenant_qi_idx\`(\`tenantId\`, \`qualityInspectionId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`purchase_invoices\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`tenantId\` VARCHAR(191) NOT NULL,
    \`invoiceNumber\` VARCHAR(64) NOT NULL,
    \`invoiceDate\` DATE NOT NULL,
    \`vendorInvoiceNumber\` VARCHAR(100) NULL,
    \`vendorInvoiceDate\` DATE NULL,
    \`vendorId\` VARCHAR(191) NOT NULL,
    \`purchaseOrderId\` VARCHAR(191) NULL,
    \`goodsReceiptId\` VARCHAR(191) NULL,
    \`status\` ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'MATCHED', 'PARTIALLY_MATCHED', 'MISMATCH', 'POSTED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    \`isDirectInvoice\` BOOLEAN NOT NULL DEFAULT false,
    \`currencyCode\` VARCHAR(8) NOT NULL DEFAULT 'INR',
    \`gstScheme\` ENUM('CGST_SGST', 'IGST') NOT NULL DEFAULT 'CGST_SGST',
    \`placeOfSupplyState\` VARCHAR(100) NULL,
    \`placeOfSupplyStateCode\` VARCHAR(8) NULL,
    \`reverseCharge\` BOOLEAN NOT NULL DEFAULT false,
    \`subtotalAmount\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    \`taxAmount\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    \`roundOffAmount\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    \`totalAmount\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    \`matchingStatus\` VARCHAR(64) NULL,
    \`matchingRemarks\` TEXT NULL,
    \`overrideAuthorized\` BOOLEAN NOT NULL DEFAULT false,
    \`overrideRemarks\` TEXT NULL,
    \`remarks\` TEXT NULL,
    \`submittedAt\` DATETIME(3) NULL,
    \`approvedAt\` DATETIME(3) NULL,
    \`postedAt\` DATETIME(3) NULL,
    \`cancelledAt\` DATETIME(3) NULL,
    \`createdById\` VARCHAR(36) NULL,
    \`updatedById\` VARCHAR(36) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    \`deletedAt\` DATETIME(3) NULL,
    UNIQUE INDEX \`purchase_invoices_tenantId_invoiceNumber_key\`(\`tenantId\`, \`invoiceNumber\`),
    INDEX \`purchase_invoices_tenantId_idx\`(\`tenantId\`),
    INDEX \`purchase_invoices_tenantId_status_idx\`(\`tenantId\`, \`status\`),
    INDEX \`purchase_invoices_tenantId_deletedAt_idx\`(\`tenantId\`, \`deletedAt\`),
    INDEX \`purchase_invoices_tenantId_vendorId_idx\`(\`tenantId\`, \`vendorId\`),
    INDEX \`purchase_invoices_tenantId_purchaseOrderId_idx\`(\`tenantId\`, \`purchaseOrderId\`),
    INDEX \`purchase_invoices_tenantId_goodsReceiptId_idx\`(\`tenantId\`, \`goodsReceiptId\`),
    INDEX \`purchase_invoices_tenantId_invoiceDate_idx\`(\`tenantId\`, \`invoiceDate\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`purchase_invoice_lines\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`tenantId\` VARCHAR(191) NOT NULL,
    \`purchaseInvoiceId\` VARCHAR(191) NOT NULL,
    \`lineNumber\` INTEGER NOT NULL,
    \`purchaseOrderLineId\` VARCHAR(191) NULL,
    \`goodsReceiptLineId\` VARCHAR(191) NULL,
    \`itemId\` VARCHAR(191) NULL,
    \`itemCodeSnapshot\` VARCHAR(64) NOT NULL DEFAULT '',
    \`itemNameSnapshot\` VARCHAR(300) NOT NULL DEFAULT '',
    \`description\` TEXT NULL,
    \`quantity\` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    \`uomCodeSnapshot\` VARCHAR(32) NOT NULL DEFAULT '',
    \`rate\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    \`amount\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    \`taxRatePct\` DECIMAL(5, 2) NOT NULL DEFAULT 0,
    \`taxAmount\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    \`lineTotal\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    \`remarks\` TEXT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`pi_lines_tenant_pi_lineno_key\`(\`tenantId\`, \`purchaseInvoiceId\`, \`lineNumber\`),
    INDEX \`purchase_invoice_lines_tenantId_idx\`(\`tenantId\`),
    INDEX \`pi_lines_tenant_pi_idx\`(\`tenantId\`, \`purchaseInvoiceId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`purchase_returns\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`tenantId\` VARCHAR(191) NOT NULL,
    \`returnNumber\` VARCHAR(64) NOT NULL,
    \`returnDate\` DATE NOT NULL,
    \`vendorId\` VARCHAR(191) NOT NULL,
    \`purchaseOrderId\` VARCHAR(191) NULL,
    \`goodsReceiptId\` VARCHAR(191) NULL,
    \`qualityInspectionId\` VARCHAR(191) NULL,
    \`status\` ENUM('DRAFT', 'SUBMITTED', 'APPROVED', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    \`warehouseId\` VARCHAR(191) NULL,
    \`reason\` TEXT NULL,
    \`remarks\` TEXT NULL,
    \`submittedAt\` DATETIME(3) NULL,
    \`completedAt\` DATETIME(3) NULL,
    \`cancelledAt\` DATETIME(3) NULL,
    \`createdById\` VARCHAR(36) NULL,
    \`updatedById\` VARCHAR(36) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    \`deletedAt\` DATETIME(3) NULL,
    UNIQUE INDEX \`purchase_returns_tenantId_returnNumber_key\`(\`tenantId\`, \`returnNumber\`),
    INDEX \`purchase_returns_tenantId_idx\`(\`tenantId\`),
    INDEX \`purchase_returns_tenantId_status_idx\`(\`tenantId\`, \`status\`),
    INDEX \`purchase_returns_tenantId_deletedAt_idx\`(\`tenantId\`, \`deletedAt\`),
    INDEX \`purchase_returns_tenantId_vendorId_idx\`(\`tenantId\`, \`vendorId\`),
    INDEX \`purchase_returns_tenantId_purchaseOrderId_idx\`(\`tenantId\`, \`purchaseOrderId\`),
    INDEX \`purchase_returns_tenantId_goodsReceiptId_idx\`(\`tenantId\`, \`goodsReceiptId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,

    `CREATE TABLE IF NOT EXISTS \`purchase_return_lines\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`tenantId\` VARCHAR(191) NOT NULL,
    \`purchaseReturnId\` VARCHAR(191) NOT NULL,
    \`lineNumber\` INTEGER NOT NULL,
    \`goodsReceiptLineId\` VARCHAR(191) NULL,
    \`purchaseOrderLineId\` VARCHAR(191) NULL,
    \`itemId\` VARCHAR(191) NULL,
    \`itemCodeSnapshot\` VARCHAR(64) NOT NULL DEFAULT '',
    \`itemNameSnapshot\` VARCHAR(300) NOT NULL DEFAULT '',
    \`returnQuantity\` DECIMAL(18, 4) NOT NULL DEFAULT 0,
    \`rate\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    \`amount\` DECIMAL(18, 2) NOT NULL DEFAULT 0,
    \`remarks\` TEXT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL,
    UNIQUE INDEX \`prt_lines_tenant_prt_lineno_key\`(\`tenantId\`, \`purchaseReturnId\`, \`lineNumber\`),
    INDEX \`purchase_return_lines_tenantId_idx\`(\`tenantId\`),
    INDEX \`prt_lines_tenant_prt_idx\`(\`tenantId\`, \`purchaseReturnId\`),
    PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  ]

  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql)
    console.log('applied create')
  }

  const fks: Array<[string, string]> = [
    [
      'purchase_approval_tiers_tenantId_fkey',
      'ALTER TABLE `purchase_approval_tiers` ADD CONSTRAINT `purchase_approval_tiers_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    ],
    [
      'purchase_approval_tiers_purchaseSettingsId_fkey',
      'ALTER TABLE `purchase_approval_tiers` ADD CONSTRAINT `purchase_approval_tiers_purchaseSettingsId_fkey` FOREIGN KEY (`purchaseSettingsId`) REFERENCES `purchase_settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    ],
    [
      'purchase_approval_tier_roles_tierId_fkey',
      'ALTER TABLE `purchase_approval_tier_roles` ADD CONSTRAINT `purchase_approval_tier_roles_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `purchase_approval_tiers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    ],
    [
      'purchase_inspection_categories_tenantId_fkey',
      'ALTER TABLE `purchase_inspection_categories` ADD CONSTRAINT `purchase_inspection_categories_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    ],
    [
      'purchase_inspection_categories_purchaseSettingsId_fkey',
      'ALTER TABLE `purchase_inspection_categories` ADD CONSTRAINT `purchase_inspection_categories_purchaseSettingsId_fkey` FOREIGN KEY (`purchaseSettingsId`) REFERENCES `purchase_settings`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    ],
    [
      'quality_inspections_tenantId_fkey',
      'ALTER TABLE `quality_inspections` ADD CONSTRAINT `quality_inspections_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    ],
    [
      'quality_inspection_lines_tenantId_fkey',
      'ALTER TABLE `quality_inspection_lines` ADD CONSTRAINT `quality_inspection_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    ],
    [
      'quality_inspection_lines_qualityInspectionId_fkey',
      'ALTER TABLE `quality_inspection_lines` ADD CONSTRAINT `quality_inspection_lines_qualityInspectionId_fkey` FOREIGN KEY (`qualityInspectionId`) REFERENCES `quality_inspections`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    ],
    [
      'purchase_invoices_tenantId_fkey',
      'ALTER TABLE `purchase_invoices` ADD CONSTRAINT `purchase_invoices_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    ],
    [
      'purchase_invoice_lines_tenantId_fkey',
      'ALTER TABLE `purchase_invoice_lines` ADD CONSTRAINT `purchase_invoice_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    ],
    [
      'purchase_invoice_lines_purchaseInvoiceId_fkey',
      'ALTER TABLE `purchase_invoice_lines` ADD CONSTRAINT `purchase_invoice_lines_purchaseInvoiceId_fkey` FOREIGN KEY (`purchaseInvoiceId`) REFERENCES `purchase_invoices`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    ],
    [
      'purchase_returns_tenantId_fkey',
      'ALTER TABLE `purchase_returns` ADD CONSTRAINT `purchase_returns_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    ],
    [
      'purchase_return_lines_tenantId_fkey',
      'ALTER TABLE `purchase_return_lines` ADD CONSTRAINT `purchase_return_lines_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE',
    ],
    [
      'purchase_return_lines_purchaseReturnId_fkey',
      'ALTER TABLE `purchase_return_lines` ADD CONSTRAINT `purchase_return_lines_purchaseReturnId_fkey` FOREIGN KEY (`purchaseReturnId`) REFERENCES `purchase_returns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE',
    ],
  ]

  for (const [name, sql] of fks) {
    const existing = await prisma.$queryRawUnsafe<Array<{ CONSTRAINT_NAME: string }>>(
      `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = '${name}'`,
    )
    if (existing.length) {
      console.log('fk exists', name)
      continue
    }
    await prisma.$executeRawUnsafe(sql)
    console.log('fk added', name)
  }

  console.log('recovery SQL complete — mark migration applied next')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
