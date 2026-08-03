/* =========================================================
   LIVE — Audit + repair Item ↔ HSN ↔ GST (all tenants)
   Run in phpMyAdmin on u233611619_foserp.
   Idempotent — safe to re-run.

   Fixes:
   - Exact hsnCode → master_hsn_codes match
   - Prefix match (e.g. legacy 7208 → master 721070)
   - hsnId present but gstGroupId wrong/missing
   - Sync legacy hsnCode text to master code

   Prerequisite: run live-seed-gst-hsn-purchase-test-pack.sql if no HSN masters.
   ========================================================= */

SELECT DATABASE() AS current_db, NOW() AS ran_at;

/* ── A) Per-tenant summary ── */
SELECT
  t.slug AS tenant_slug,
  (SELECT COUNT(*) FROM master_gst_groups g WHERE g.tenantId = t.id AND g.deletedAt IS NULL) AS gst_groups,
  (SELECT COUNT(*) FROM master_hsn_codes h WHERE h.tenantId = t.id AND h.deletedAt IS NULL) AS hsn_codes,
  (SELECT COUNT(*) FROM master_items i WHERE i.tenantId = t.id AND i.deletedAt IS NULL) AS items,
  (SELECT COUNT(*) FROM master_items i
   WHERE i.tenantId = t.id AND i.deletedAt IS NULL
     AND (i.hsnId IS NULL OR i.hsnId = '' OR i.gstGroupId IS NULL OR i.gstGroupId = '')) AS items_missing_tax
FROM tenants t
WHERE t.deletedAt IS NULL
ORDER BY t.slug;

/* ── B) Items with broken / missing tax links ── */
SELECT
  t.slug AS tenant,
  i.code AS item_code,
  i.name AS item_name,
  i.hsnCode AS legacy_hsn,
  h.code AS hsn_master,
  g.code AS gst_group,
  CASE
    WHEN i.hsnId IS NULL OR i.hsnId = '' THEN 'missing_hsn_id'
    WHEN i.gstGroupId IS NULL OR i.gstGroupId = '' THEN 'missing_gst_group'
    WHEN h.id IS NULL THEN 'orphan_hsn_id'
    WHEN i.gstGroupId <> h.gstGroupId THEN 'gst_mismatch'
    WHEN i.hsnCode <> h.code THEN 'legacy_text_mismatch'
    ELSE 'ok'
  END AS issue
FROM master_items i
JOIN tenants t ON t.id = i.tenantId
LEFT JOIN master_hsn_codes h ON h.id = i.hsnId AND h.tenantId = i.tenantId AND h.deletedAt IS NULL
LEFT JOIN master_gst_groups g ON g.id = i.gstGroupId AND g.tenantId = i.tenantId AND g.deletedAt IS NULL
WHERE i.deletedAt IS NULL
  AND (
    i.hsnId IS NULL OR i.hsnId = ''
    OR i.gstGroupId IS NULL OR i.gstGroupId = ''
    OR h.id IS NULL
    OR i.gstGroupId <> h.gstGroupId
    OR (h.code IS NOT NULL AND i.hsnCode <> h.code)
  )
ORDER BY t.slug, i.code
LIMIT 100;

/* ── C) Fix 1: exact hsnCode match ── */
UPDATE master_items i
INNER JOIN master_hsn_codes h
  ON h.tenantId = i.tenantId
 AND h.code = i.hsnCode
 AND h.deletedAt IS NULL
 AND h.status = 'ACTIVE'
SET
  i.hsnId = h.id,
  i.gstGroupId = h.gstGroupId,
  i.updatedAt = NOW(3)
WHERE i.deletedAt IS NULL
  AND i.hsnCode IS NOT NULL
  AND i.hsnCode <> ''
  AND (
    i.hsnId IS NULL OR i.hsnId = ''
    OR i.gstGroupId IS NULL OR i.gstGroupId = ''
    OR i.gstGroupId <> h.gstGroupId
    OR i.hsnId <> h.id
  );

/* ── D) Fix 2: prefix match legacy short code (7208 → 721070) ── */
UPDATE master_items i
INNER JOIN master_hsn_codes h
  ON h.tenantId = i.tenantId
 AND h.deletedAt IS NULL
 AND h.status = 'ACTIVE'
 AND (
   h.code LIKE CONCAT(i.hsnCode, '%')
   OR i.hsnCode LIKE CONCAT(h.code, '%')
 )
SET
  i.hsnId = h.id,
  i.gstGroupId = h.gstGroupId,
  i.hsnCode = h.code,
  i.updatedAt = NOW(3)
WHERE i.deletedAt IS NULL
  AND i.hsnCode IS NOT NULL
  AND i.hsnCode <> ''
  AND LENGTH(i.hsnCode) >= 4
  AND (i.hsnId IS NULL OR i.hsnId = '' OR i.gstGroupId IS NULL OR i.gstGroupId = '')
  AND (
    SELECT COUNT(*) FROM master_hsn_codes hx
    WHERE hx.tenantId = i.tenantId AND hx.deletedAt IS NULL AND hx.status = 'ACTIVE'
      AND (hx.code LIKE CONCAT(i.hsnCode, '%') OR i.hsnCode LIKE CONCAT(hx.code, '%'))
  ) = 1;

/* ── E) Fix 3: hsnId set but gstGroup / legacy text out of sync ── */
UPDATE master_items i
INNER JOIN master_hsn_codes h ON h.id = i.hsnId AND h.tenantId = i.tenantId AND h.deletedAt IS NULL
SET
  i.gstGroupId = h.gstGroupId,
  i.hsnCode = h.code,
  i.updatedAt = NOW(3)
WHERE i.deletedAt IS NULL
  AND i.hsnId IS NOT NULL
  AND i.hsnId <> ''
  AND (i.gstGroupId IS NULL OR i.gstGroupId = '' OR i.gstGroupId <> h.gstGroupId OR i.hsnCode <> h.code);

/* ── F) Post-fix report ── */
SELECT
  t.slug AS tenant,
  COUNT(*) AS still_missing_tax
FROM master_items i
JOIN tenants t ON t.id = i.tenantId
WHERE i.deletedAt IS NULL
  AND (i.hsnId IS NULL OR i.hsnId = '' OR i.gstGroupId IS NULL OR i.gstGroupId = '')
GROUP BY t.slug;

SELECT
  t.slug AS tenant,
  i.code AS item_code,
  i.hsnCode,
  h.code AS hsn_master,
  g.code AS gst_group
FROM master_items i
JOIN tenants t ON t.id = i.tenantId
LEFT JOIN master_hsn_codes h ON h.id = i.hsnId
LEFT JOIN master_gst_groups g ON g.id = i.gstGroupId
WHERE i.deletedAt IS NULL
ORDER BY t.slug, i.code
LIMIT 50;

SELECT 'Item GST/HSN audit + repair complete' AS status;
