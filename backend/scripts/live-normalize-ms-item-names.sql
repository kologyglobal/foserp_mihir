-- Audit raw material item names against MS_GRADE_SECTION pattern.
-- Idempotent: diagnostic SELECT only — no auto-rename (client sign-off required).
-- Pattern: MS_{GRADE}_{SECTION} e.g. MS_IS2062_100x50

SELECT DATABASE() AS db_name, NOW() AS run_at;

-- Optional tenant scope (uncomment and set slug):
-- SET @tenantSlug = 'vasant-trailers';
-- SET @tenantId = (SELECT id FROM tenants WHERE slug = @tenantSlug LIMIT 1);

SELECT
  mi.tenant_id,
  t.slug AS tenant_slug,
  mi.id,
  mi.code,
  mi.name,
  mi.item_type,
  mi.product_type,
  mi.material_grade
FROM master_items mi
JOIN tenants t ON t.id = mi.tenant_id
WHERE mi.deleted_at IS NULL
  AND mi.status = 'ACTIVE'
  AND (mi.item_type = 'raw' OR mi.product_type = 'raw_material')
  AND mi.name NOT REGEXP '^MS_[A-Za-z0-9]+_[A-Za-z0-9xX×.\\-/]+$'
ORDER BY t.slug, mi.code;

SELECT COUNT(*) AS non_compliant_count
FROM master_items mi
WHERE mi.deleted_at IS NULL
  AND mi.status = 'ACTIVE'
  AND (mi.item_type = 'raw' OR mi.product_type = 'raw_material')
  AND mi.name NOT REGEXP '^MS_[A-Za-z0-9]+_[A-Za-z0-9xX×.\\-/]+$';
