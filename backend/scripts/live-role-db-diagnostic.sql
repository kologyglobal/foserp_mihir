/* =========================================================
   LIVE DB ROLE / SUPER-ADMIN DIAGNOSTIC
   Database: u233611619_foserp  (stage API DB_NAME)
   Safe: read-only
   Goal: explain why Super Admin may 500 while another user works
   ========================================================= */

SELECT DATABASE() AS current_db, USER() AS db_user, NOW() AS ran_at;

/* ---------- 0) Find users (edit emails if needed) ---------- */
SET @superEmail := 'super@fos-erp.com';
SET @otherEmail := '%rajesh%';   -- matches rajeshpatel / Rajesh Patel

SELECT
  u.id,
  u.email,
  u.firstName,
  u.lastName,
  u.status,
  u.tenantId,
  t.slug AS tenant_slug,
  t.name AS tenant_name,
  u.deletedAt,
  u.departmentId,
  u.failedLoginCount,
  u.lockedAt,
  u.failedLoginAttempts,
  u.lockedUntil
FROM users u
LEFT JOIN tenants t ON t.id = u.tenantId
WHERE u.deletedAt IS NULL
  AND (
    LOWER(u.email) = LOWER(@superEmail)
    OR LOWER(u.email) LIKE LOWER(@otherEmail)
    OR LOWER(CONCAT(u.firstName, ' ', u.lastName)) LIKE LOWER(@otherEmail)
  )
ORDER BY u.email;

/* ---------- 1) Roles + permissions for those users ---------- */
SELECT
  u.email,
  r.name AS role_name,
  r.id AS role_id,
  COUNT(DISTINCT p.name) AS permission_count,
  MAX(CASE WHEN p.name = 'tenant.manage' THEN 1 ELSE 0 END) AS has_tenant_manage,
  MAX(CASE WHEN p.name = 'module.view' THEN 1 ELSE 0 END) AS has_module_view,
  MAX(CASE WHEN p.name = 'module.manage' THEN 1 ELSE 0 END) AS has_module_manage,
  MAX(CASE WHEN p.name = 'crm.sales_order.view' OR p.name LIKE 'crm.salesOrder%' OR p.name LIKE 'sales.order%' THEN 1 ELSE 0 END) AS has_so_view_like,
  MAX(CASE WHEN p.name = 'scope.view' THEN 1 ELSE 0 END) AS has_scope_view,
  MAX(CASE WHEN p.name = 'scope.manage' THEN 1 ELSE 0 END) AS has_scope_manage
FROM users u
JOIN user_roles ur ON ur.userId = u.id AND ur.tenantId = u.tenantId
JOIN roles r ON r.id = ur.roleId AND r.deletedAt IS NULL
LEFT JOIN role_permissions rp ON rp.roleId = r.id
LEFT JOIN permissions p ON p.id = rp.permissionId
WHERE u.deletedAt IS NULL
  AND (
    LOWER(u.email) = LOWER(@superEmail)
    OR LOWER(u.email) LIKE LOWER(@otherEmail)
  )
GROUP BY u.email, r.name, r.id
ORDER BY u.email, r.name;

/* Permission names that differ between Super Admin role and other roles (sample) */
SELECT
  p.name AS permission_name,
  MAX(CASE WHEN r.name IN ('Super Admin', 'SuperAdmin', 'SUPER_ADMIN') THEN 1 ELSE 0 END) AS on_super_admin_role,
  MAX(CASE WHEN r.name NOT IN ('Super Admin', 'SuperAdmin', 'SUPER_ADMIN') THEN 1 ELSE 0 END) AS on_other_role
FROM permissions p
JOIN role_permissions rp ON rp.permissionId = p.id
JOIN roles r ON r.id = rp.roleId AND r.deletedAt IS NULL
GROUP BY p.name
HAVING on_super_admin_role = 1 AND on_other_role = 0
ORDER BY p.name
LIMIT 80;

/* ---------- 2) Schema tables the API needs (MISSING = likely 500) ---------- */
SELECT
  t.wanted AS table_name,
  CASE WHEN i.table_name IS NULL THEN 'MISSING' ELSE 'EXISTS' END AS status
FROM (
  SELECT 'users' AS wanted UNION ALL
  SELECT 'roles' UNION ALL
  SELECT 'user_roles' UNION ALL
  SELECT 'permissions' UNION ALL
  SELECT 'role_permissions' UNION ALL
  SELECT 'tenants' UNION ALL
  SELECT 'tenant_module_flags' UNION ALL
  SELECT 'module_administrators' UNION ALL
  SELECT 'tenant_security_settings' UNION ALL
  SELECT 'user_legal_entity_access' UNION ALL
  SELECT 'user_branch_access' UNION ALL
  SELECT 'user_warehouse_access' UNION ALL
  SELECT 'responsibilities' UNION ALL
  SELECT 'user_responsibilities' UNION ALL
  SELECT 'departments' UNION ALL
  SELECT 'login_activities' UNION ALL
  SELECT 'legal_entities' UNION ALL
  SELECT 'branches' UNION ALL
  SELECT 'master_warehouses' UNION ALL
  SELECT 'crm_sales_orders' UNION ALL
  SELECT 'crm_leads' UNION ALL
  SELECT 'crm_opportunities' UNION ALL
  SELECT 'crm_quotations'
) t
LEFT JOIN information_schema.tables i
  ON i.table_schema = DATABASE()
 AND i.table_name = t.wanted
ORDER BY status DESC, table_name;

/* ---------- 3) Critical columns on users / CRM (MISSING = 500 for full user load) ---------- */
SELECT
  'users' AS table_name,
  c.column_name,
  CASE WHEN i.column_name IS NULL THEN 'MISSING' ELSE 'OK' END AS status
FROM (
  SELECT 'departmentId' AS column_name UNION ALL
  SELECT 'failedLoginCount' UNION ALL
  SELECT 'lockedAt' UNION ALL
  SELECT 'failedLoginAttempts' UNION ALL
  SELECT 'lockedUntil'
) c
LEFT JOIN information_schema.columns i
  ON i.table_schema = DATABASE()
 AND i.table_name = 'users'
 AND i.column_name = c.column_name

UNION ALL

SELECT
  'crm_sales_orders',
  c.column_name,
  CASE WHEN i.column_name IS NULL THEN 'MISSING' ELSE 'OK' END
FROM (
  SELECT 'itemId' AS column_name UNION ALL
  SELECT 'deliveryTime' UNION ALL
  SELECT 'legalEntityId' UNION ALL
  SELECT 'branchId' UNION ALL
  SELECT 'projectRef' UNION ALL
  SELECT 'projectNameSnapshot' UNION ALL
  SELECT 'directSoReason' UNION ALL
  SELECT 'productId'
) c
LEFT JOIN information_schema.columns i
  ON i.table_schema = DATABASE()
 AND i.table_name = 'crm_sales_orders'
 AND i.column_name = c.column_name

UNION ALL

SELECT
  'crm_leads',
  c.column_name,
  CASE WHEN i.column_name IS NULL THEN 'MISSING' ELSE 'OK' END
FROM (
  SELECT 'legalEntityId' AS column_name UNION ALL
  SELECT 'branchId'
) c
LEFT JOIN information_schema.columns i
  ON i.table_schema = DATABASE()
 AND i.table_name = 'crm_leads'
 AND i.column_name = c.column_name

UNION ALL

SELECT
  'crm_opportunities',
  c.column_name,
  CASE WHEN i.column_name IS NULL THEN 'MISSING' ELSE 'OK' END
FROM (
  SELECT 'legalEntityId' AS column_name UNION ALL
  SELECT 'branchId'
) c
LEFT JOIN information_schema.columns i
  ON i.table_schema = DATABASE()
 AND i.table_name = 'crm_opportunities'
 AND i.column_name = c.column_name

UNION ALL

SELECT
  'crm_quotations',
  c.column_name,
  CASE WHEN i.column_name IS NULL THEN 'MISSING' ELSE 'OK' END
FROM (
  SELECT 'legalEntityId' AS column_name UNION ALL
  SELECT 'branchId'
) c
LEFT JOIN information_schema.columns i
  ON i.table_schema = DATABASE()
 AND i.table_name = 'crm_quotations'
 AND i.column_name = c.column_name

ORDER BY table_name, column_name;

/* productId on sales orders: OK if MISSING (dropped by design). BAD if EXISTS and itemId MISSING. */

/* ---------- 4) Data-scope grants (Super Admin with BAD grants can 500; empty = fail-open OK) ---------- */
SELECT
  u.email,
  'legal_entity' AS scope_type,
  COUNT(*) AS grant_rows,
  SUM(CASE WHEN le.id IS NULL THEN 1 ELSE 0 END) AS orphan_missing_le
FROM users u
JOIN user_legal_entity_access a
  ON a.userId = u.id AND a.tenantId = u.tenantId AND a.deletedAt IS NULL
LEFT JOIN legal_entities le ON le.id = a.legalEntityId
WHERE u.deletedAt IS NULL
GROUP BY u.email

UNION ALL

SELECT
  u.email,
  'branch',
  COUNT(*),
  SUM(CASE WHEN b.id IS NULL THEN 1 ELSE 0 END)
FROM users u
JOIN user_branch_access a
  ON a.userId = u.id AND a.tenantId = u.tenantId AND a.deletedAt IS NULL
LEFT JOIN branches b ON b.id = a.branchId
WHERE u.deletedAt IS NULL
GROUP BY u.email

UNION ALL

SELECT
  u.email,
  'warehouse',
  COUNT(*),
  SUM(CASE WHEN w.id IS NULL THEN 1 ELSE 0 END)
FROM users u
JOIN user_warehouse_access a
  ON a.userId = u.id AND a.tenantId = u.tenantId AND a.deletedAt IS NULL
LEFT JOIN master_warehouses w ON w.id = a.warehouseId
WHERE u.deletedAt IS NULL
GROUP BY u.email

ORDER BY email, scope_type;

/* Detail orphans (any user) — these break loadUserDataScope JOINs */
SELECT 'LE_ACCESS_ORPHAN' AS issue, a.id, a.userId, u.email, a.legalEntityId AS missing_ref
FROM user_legal_entity_access a
JOIN users u ON u.id = a.userId
LEFT JOIN legal_entities le ON le.id = a.legalEntityId
WHERE a.deletedAt IS NULL AND le.id IS NULL
LIMIT 50;

SELECT 'BRANCH_ACCESS_ORPHAN' AS issue, a.id, a.userId, u.email, a.branchId AS missing_ref
FROM user_branch_access a
JOIN users u ON u.id = a.userId
LEFT JOIN branches b ON b.id = a.branchId
WHERE a.deletedAt IS NULL AND b.id IS NULL
LIMIT 50;

SELECT 'WH_ACCESS_ORPHAN' AS issue, a.id, a.userId, u.email, a.warehouseId AS missing_ref
FROM user_warehouse_access a
JOIN users u ON u.id = a.userId
LEFT JOIN master_warehouses w ON w.id = a.warehouseId
WHERE a.deletedAt IS NULL AND w.id IS NULL
LIMIT 50;

/* ---------- 5) module_administrators orphans (breaks GET /modules include user) ---------- */
SELECT
  ma.id,
  ma.moduleKey,
  ma.userId,
  u.email AS user_email,
  CASE
    WHEN u.id IS NULL THEN 'ORPHAN_USER'
    WHEN u.deletedAt IS NOT NULL THEN 'USER_DELETED'
    WHEN u.status <> 'ACTIVE' THEN CONCAT('USER_STATUS_', u.status)
    ELSE 'OK'
  END AS status
FROM module_administrators ma
LEFT JOIN users u ON u.id = ma.userId
WHERE ma.deletedAt IS NULL
ORDER BY status DESC, ma.moduleKey
LIMIT 100;

/* ---------- 6) All roles: permission health ---------- */
SELECT
  r.name AS role_name,
  r.tenantId,
  t.slug AS tenant_slug,
  COUNT(DISTINCT rp.permissionId) AS permission_count,
  MAX(CASE WHEN p.name = 'tenant.manage' THEN 'YES' ELSE 'no' END) AS tenant_manage,
  MAX(CASE WHEN p.name = 'module.view' THEN 'YES' ELSE 'no' END) AS module_view,
  MAX(CASE WHEN p.name = 'module.manage' THEN 'YES' ELSE 'no' END) AS module_manage
FROM roles r
LEFT JOIN tenants t ON t.id = r.tenantId
LEFT JOIN role_permissions rp ON rp.roleId = r.id
LEFT JOIN permissions p ON p.id = rp.permissionId
WHERE r.deletedAt IS NULL
GROUP BY r.id, r.name, r.tenantId, t.slug
ORDER BY permission_count ASC, r.name;

/* Roles with ZERO permissions (broken) */
SELECT r.id, r.name, r.tenantId, t.slug
FROM roles r
LEFT JOIN tenants t ON t.id = r.tenantId
LEFT JOIN role_permissions rp ON rp.roleId = r.id
WHERE r.deletedAt IS NULL
GROUP BY r.id, r.name, r.tenantId, t.slug
HAVING COUNT(rp.permissionId) = 0;

/* Users with NO role assignment */
SELECT u.id, u.email, u.status, t.slug
FROM users u
LEFT JOIN tenants t ON t.id = u.tenantId
LEFT JOIN user_roles ur ON ur.userId = u.id AND ur.tenantId = u.tenantId
WHERE u.deletedAt IS NULL
GROUP BY u.id, u.email, u.status, t.slug
HAVING COUNT(ur.roleId) = 0
LIMIT 50;

/* ---------- 7) Compare hydrate risk: who would call org-scoped CRM lists ---------- */
SELECT
  u.email,
  GROUP_CONCAT(DISTINCT r.name ORDER BY r.name SEPARATOR ', ') AS roles,
  (SELECT COUNT(*) FROM user_legal_entity_access a
    WHERE a.userId = u.id AND a.tenantId = u.tenantId AND a.deletedAt IS NULL) AS le_grants,
  (SELECT COUNT(*) FROM user_branch_access a
    WHERE a.userId = u.id AND a.tenantId = u.tenantId AND a.deletedAt IS NULL) AS branch_grants,
  (SELECT COUNT(*) FROM user_warehouse_access a
    WHERE a.userId = u.id AND a.tenantId = u.tenantId AND a.deletedAt IS NULL) AS wh_grants,
  CASE
    WHEN (
      (SELECT COUNT(*) FROM user_legal_entity_access a WHERE a.userId = u.id AND a.tenantId = u.tenantId AND a.deletedAt IS NULL) = 0
      AND (SELECT COUNT(*) FROM user_branch_access a WHERE a.userId = u.id AND a.tenantId = u.tenantId AND a.deletedAt IS NULL) = 0
      AND (SELECT COUNT(*) FROM user_warehouse_access a WHERE a.userId = u.id AND a.tenantId = u.tenantId AND a.deletedAt IS NULL) = 0
    ) THEN 'UNRESTRICTED (fail-open)'
    ELSE 'SCOPED (joins LE/branch/WH — orphans can 500)'
  END AS scope_mode
FROM users u
JOIN user_roles ur ON ur.userId = u.id AND ur.tenantId = u.tenantId
JOIN roles r ON r.id = ur.roleId AND r.deletedAt IS NULL
WHERE u.deletedAt IS NULL
  AND u.status = 'ACTIVE'
GROUP BY u.id, u.email, u.tenantId
ORDER BY scope_mode DESC, u.email
LIMIT 100;

/* ---------- DONE ----------
   How to read:
   - Section 2 MISSING tables → fix schema (same for all users hitting that API)
   - Section 4/5 orphans → often hits only users WITH scope grants / module admin rows
   - Section 1 Super has more permissions → UI hydrates /modules + CRM → more 500 surface
   - Rajesh may lack CRM/module perms → those calls skipped or fail-open → no red screen
   ========================================================= */
