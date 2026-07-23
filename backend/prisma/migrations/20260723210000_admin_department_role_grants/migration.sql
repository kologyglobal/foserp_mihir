-- Backfill department.* grants for admin roles (Phase 5 migration applied before grant SQL existed)
INSERT INTO `role_permissions` (`id`, `roleId`, `permissionId`)
SELECT UUID(), r.`id`, p.`id`
FROM `roles` r
CROSS JOIN `permissions` p
WHERE r.`deletedAt` IS NULL
  AND r.`name` IN ('Super Admin', 'Tenant Admin', 'Admin', 'Administrator', 'CEO')
  AND p.`name` IN ('department.view', 'department.create', 'department.update', 'department.delete')
  AND NOT EXISTS (
    SELECT 1 FROM `role_permissions` rp
    WHERE rp.`roleId` = r.`id` AND rp.`permissionId` = p.`id`
  );
