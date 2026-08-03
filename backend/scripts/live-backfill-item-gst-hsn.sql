/* =========================================================
   LIVE — Bulk link Item Master → GST group + HSN
   Fixes validation: "HSN code does not belong to the selected GST group"
   and missing tax on Purchase Order lines.

   Prerequisite: master_gst_groups + master_hsn_codes must exist for the tenant.
   Optional seed: backend/scripts/live-seed-gst-hsn-purchase-test-pack.sql

   Run in phpMyAdmin on u233611619_foserp (change @tenantSlug if needed).
   Idempotent — safe to re-run.
   ========================================================= */

SELECT DATABASE() AS current_db, NOW() AS ran_at;
SET @tenantSlug := 'vasant-trailers';  /* ← change for your tenant */

SET @tenantId := (
  SELECT id FROM tenants
  WHERE slug = @tenantSlug AND deletedAt IS NULL
  LIMIT 1
);

SELECT @tenantSlug AS tenant_slug, @tenantId AS tenant_id;

/* ── 1) Diagnostic: items missing tax links ── */
SELECT
  COUNT(*) AS total_items,
  SUM(CASE WHEN (hsnId IS NULL OR hsnId = '') AND (hsnCode IS NULL OR hsnCode = '') THEN 1 ELSE 0 END) AS no_hsn_at_all,
  SUM(CASE WHEN hsnCode IS NOT NULL AND hsnCode <> '' AND (hsnId IS NULL OR hsnId = '') THEN 1 ELSE 0 END) AS has_hsn_text_only,
  SUM(CASE WHEN hsnId IS NOT NULL AND hsnId <> '' AND gstGroupId IS NULL THEN 1 ELSE 0 END) AS hsn_linked_no_gst,
  SUM(CASE WHEN hsnId IS NOT NULL AND hsnId <> '' AND gstGroupId IS NOT NULL THEN 1 ELSE 0 END) AS fully_linked
FROM master_items
WHERE tenantId = @tenantId AND deletedAt IS NULL;

SELECT code, name, hsnCode, hsnId, gstGroupId
FROM master_items
WHERE tenantId = @tenantId AND deletedAt IS NULL
  AND (
    (hsnCode IS NULL OR hsnCode = '')
    OR hsnId IS NULL OR hsnId = ''
    OR gstGroupId IS NULL OR gstGroupId = ''
  )
ORDER BY code
LIMIT 50;

/* ── 2) Backfill hsnId + gstGroupId from exact hsnCode match ── */
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
WHERE i.tenantId = @tenantId
  AND i.deletedAt IS NULL
  AND i.hsnCode IS NOT NULL
  AND i.hsnCode <> ''
  AND (
    i.hsnId IS NULL OR i.hsnId = ''
    OR i.gstGroupId IS NULL OR i.gstGroupId = ''
    OR i.gstGroupId <> h.gstGroupId
  );

/* ── 2b) Prefix match short legacy codes (e.g. 7208 → 721070) when unique ── */
UPDATE master_items i
INNER JOIN master_hsn_codes h
  ON h.tenantId = i.tenantId
 AND h.deletedAt IS NULL
 AND h.status = 'ACTIVE'
 AND h.code LIKE CONCAT(i.hsnCode, '%')
SET
  i.hsnId = h.id,
  i.gstGroupId = h.gstGroupId,
  i.hsnCode = h.code,
  i.updatedAt = NOW(3)
WHERE i.tenantId = @tenantId
  AND i.deletedAt IS NULL
  AND i.hsnCode IS NOT NULL
  AND i.hsnCode <> ''
  AND LENGTH(i.hsnCode) >= 4
  AND (i.hsnId IS NULL OR i.hsnId = '' OR i.gstGroupId IS NULL OR i.gstGroupId = '')
  AND (
    SELECT COUNT(*) FROM master_hsn_codes hx
    WHERE hx.tenantId = i.tenantId AND hx.deletedAt IS NULL AND hx.status = 'ACTIVE'
      AND hx.code LIKE CONCAT(i.hsnCode, '%')
  ) = 1;

/* ── 3) Fix items that have hsnId but wrong/missing gstGroupId ── */
UPDATE master_items i
INNER JOIN master_hsn_codes h ON h.id = i.hsnId AND h.tenantId = i.tenantId
SET
  i.gstGroupId = h.gstGroupId,
  i.hsnCode = h.code,
  i.updatedAt = NOW(3)
WHERE i.tenantId = @tenantId
  AND i.deletedAt IS NULL
  AND i.hsnId IS NOT NULL
  AND i.hsnId <> ''
  AND (i.gstGroupId IS NULL OR i.gstGroupId = '' OR i.gstGroupId <> h.gstGroupId);

/* ── 4) Optional: assign default HSN to items still missing tax (uncomment + set code) ── */
/*
SET @defaultHsnCode := '732690';  -- e.g. general steel fittings @ 18%

UPDATE master_items i
INNER JOIN master_hsn_codes h
  ON h.tenantId = i.tenantId AND h.code = @defaultHsnCode AND h.deletedAt IS NULL
SET
  i.hsnCode = h.code,
  i.hsnId = h.id,
  i.gstGroupId = h.gstGroupId,
  i.updatedAt = NOW(3)
WHERE i.tenantId = @tenantId
  AND i.deletedAt IS NULL
  AND (i.hsnId IS NULL OR i.hsnId = '' OR i.gstGroupId IS NULL OR i.gstGroupId = '');
*/

/* ── 5) Verify ── */
SELECT
  COUNT(*) AS still_missing_tax
FROM master_items
WHERE tenantId = @tenantId AND deletedAt IS NULL
  AND (hsnId IS NULL OR hsnId = '' OR gstGroupId IS NULL OR gstGroupId = '');

SELECT
  i.code AS item_code,
  i.hsnCode,
  h.code AS hsn_master_code,
  g.code AS gst_group_code
FROM master_items i
LEFT JOIN master_hsn_codes h ON h.id = i.hsnId
LEFT JOIN master_gst_groups g ON g.id = i.gstGroupId
WHERE i.tenantId = @tenantId AND i.deletedAt IS NULL
ORDER BY i.code
LIMIT 30;

SELECT 'Item GST/HSN backfill complete' AS status;
