-- Minimal fix: Convert Quotation -> Sales Order permissions.
-- Extracted from backend/scripts/permission-sync.sql (source of truth: src/constants/permissions.ts).
-- Idempotent (INSERT IGNORE): safe to run repeatedly; never removes or modifies existing grants.
-- Run in phpMyAdmin: select the ERP database in the left sidebar first, then SQL tab -> paste -> Go.

-- 1) Missing permission catalog rows
INSERT IGNORE INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`) VALUES (UUID(), 'crm.quotation.convert', 'crm', 'crm.quotation.convert', NOW(3));
INSERT IGNORE INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`) VALUES (UUID(), 'crm.sales_order.create', 'crm', 'crm.sales_order.create', NOW(3));
INSERT IGNORE INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`) VALUES (UUID(), 'crm.sales_order.update', 'crm', 'crm.sales_order.update', NOW(3));
INSERT IGNORE INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`) VALUES (UUID(), 'crm.sales_order.delete', 'crm', 'crm.sales_order.delete', NOW(3));
INSERT IGNORE INTO `permissions` (`id`, `name`, `module`, `description`, `createdAt`) VALUES (UUID(), 'crm.sales_order.confirm', 'crm', 'crm.sales_order.confirm', NOW(3));

-- 2) Role links (per ROLE_PERMISSIONS in code; matches every non-deleted role with these names, any tenant)

-- Full CRM roles: convert + all sales_order lifecycle
INSERT IGNORE INTO `role_permissions` (`id`, `roleId`, `permissionId`)
SELECT UUID(), r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`name` IN ('crm.quotation.convert', 'crm.sales_order.create', 'crm.sales_order.update', 'crm.sales_order.delete', 'crm.sales_order.confirm')
WHERE r.`name` IN ('Super Admin', 'Tenant Admin', 'Admin', 'Administrator', 'Sales Manager', 'CRM Admin') AND r.`deletedAt` IS NULL;

-- Sales Executive: convert + sales_order create/update only
INSERT IGNORE INTO `role_permissions` (`id`, `roleId`, `permissionId`)
SELECT UUID(), r.`id`, p.`id`
FROM `roles` r
JOIN `permissions` p ON p.`name` IN ('crm.quotation.convert', 'crm.sales_order.create', 'crm.sales_order.update')
WHERE r.`name` = 'Sales Executive' AND r.`deletedAt` IS NULL;

-- 3) Verify (run after the inserts)
-- SELECT name FROM permissions WHERE name IN ('crm.quotation.convert','crm.sales_order.create');
-- SELECT r.name AS role, COUNT(*) AS grants
-- FROM role_permissions rp
-- JOIN roles r ON r.id = rp.roleId
-- JOIN permissions p ON p.id = rp.permissionId
-- WHERE p.name IN ('crm.quotation.convert','crm.sales_order.create')
-- GROUP BY r.name;
