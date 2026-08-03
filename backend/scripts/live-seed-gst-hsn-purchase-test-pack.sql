/* =========================================================
   LIVE SEED — GST groups, GST rates, HSN codes + purchase test items
   Tenant: vasant-trailers (stage / erp.dhurandharcrm.com)
   Mirrors: backend/scripts/seed-purchase-test-pack.ts + gstTaxSeedData.ts

   Run in phpMyAdmin on u233611619_foserp (or change USE below).
   Idempotent — safe to re-run.

   Unblocks: /purchase/orders/new — HSN dropdown, GST group, test items
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'seed_gst_hsn_purchase_test_pack' AS script;

SET @tenantSlug := 'vasant-trailers';
SET @tenantId := (
  SELECT id FROM tenants
  WHERE slug = @tenantSlug AND deletedAt IS NULL
  LIMIT 1
);

SELECT @tenantSlug AS tenant_slug, @tenantId AS tenant_id;

/* ---- GST groups (stable ids) ---- */
INSERT INTO master_gst_groups (id, tenantId, code, goodsType, description, status, createdAt, updatedAt)
SELECT 'b2010001-0001-4001-8001-000000000001', @tenantId, 'GST18-GOODS', 'goods', 'Standard 18% GST on goods — trailers, assemblies, components', 'ACTIVE', NOW(3), NOW(3)
FROM DUAL WHERE @tenantId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM master_gst_groups WHERE tenantId=@tenantId AND code='GST18-GOODS');
INSERT INTO master_gst_groups (id, tenantId, code, goodsType, description, status, createdAt, updatedAt)
SELECT 'b2010001-0001-4001-8001-000000000002', @tenantId, 'GST12-GOODS', 'goods', 'Reduced 12% GST on selected steel & structural goods', 'ACTIVE', NOW(3), NOW(3)
FROM DUAL WHERE @tenantId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM master_gst_groups WHERE tenantId=@tenantId AND code='GST12-GOODS');
INSERT INTO master_gst_groups (id, tenantId, code, goodsType, description, status, createdAt, updatedAt)
SELECT 'b2010001-0001-4001-8001-000000000003', @tenantId, 'GST5-GOODS', 'goods', 'Concessional 5% GST on essential inputs', 'ACTIVE', NOW(3), NOW(3)
FROM DUAL WHERE @tenantId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM master_gst_groups WHERE tenantId=@tenantId AND code='GST5-GOODS');
INSERT INTO master_gst_groups (id, tenantId, code, goodsType, description, status, createdAt, updatedAt)
SELECT 'b2010001-0001-4001-8001-000000000004', @tenantId, 'GST28-GOODS', 'goods', '28% GST on luxury / high-rate goods (if applicable)', 'ACTIVE', NOW(3), NOW(3)
FROM DUAL WHERE @tenantId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM master_gst_groups WHERE tenantId=@tenantId AND code='GST28-GOODS');
INSERT INTO master_gst_groups (id, tenantId, code, goodsType, description, status, createdAt, updatedAt)
SELECT 'b2010001-0001-4001-8001-000000000005', @tenantId, 'GST0-GOODS', 'goods', 'Nil-rated / exempt goods', 'ACTIVE', NOW(3), NOW(3)
FROM DUAL WHERE @tenantId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM master_gst_groups WHERE tenantId=@tenantId AND code='GST0-GOODS');
INSERT INTO master_gst_groups (id, tenantId, code, goodsType, description, status, createdAt, updatedAt)
SELECT 'b2010001-0001-4001-8001-000000000006', @tenantId, 'GST18-SERVICE', 'service', '18% GST on fabrication, painting & service charges', 'ACTIVE', NOW(3), NOW(3)
FROM DUAL WHERE @tenantId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM master_gst_groups WHERE tenantId=@tenantId AND code='GST18-SERVICE');
INSERT INTO master_gst_groups (id, tenantId, code, goodsType, description, status, createdAt, updatedAt)
SELECT 'b2010001-0001-4001-8001-000000000007', @tenantId, 'GST12-SERVICE', 'service', '12% GST on selected services', 'ACTIVE', NOW(3), NOW(3)
FROM DUAL WHERE @tenantId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM master_gst_groups WHERE tenantId=@tenantId AND code='GST12-SERVICE');
INSERT INTO master_gst_groups (id, tenantId, code, goodsType, description, status, createdAt, updatedAt)
SELECT 'b2010001-0001-4001-8001-000000000008', @tenantId, 'GST5-SERVICE', 'service', '5% GST on concessional services', 'ACTIVE', NOW(3), NOW(3)
FROM DUAL WHERE @tenantId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM master_gst_groups WHERE tenantId=@tenantId AND code='GST5-SERVICE');

UPDATE master_gst_groups SET status='ACTIVE', deletedAt=NULL, updatedAt=NOW(3)
WHERE tenantId=@tenantId AND code IN ('GST18-GOODS','GST12-GOODS','GST5-GOODS','GST28-GOODS','GST0-GOODS','GST18-SERVICE','GST12-SERVICE','GST5-SERVICE');

/* ---- HSN codes (linked to GST group by code) ---- */
INSERT INTO master_hsn_codes (id, tenantId, code, gstGroupId, description, status, createdAt, updatedAt)
SELECT 'b2010101-0001-4001-8001-000000000001', @tenantId, '871639', g.id, 'Trailers and semi-trailers — tankers, bulkers, side-wall', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST18-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_hsn_codes WHERE tenantId=@tenantId AND code='871639');
INSERT INTO master_hsn_codes (id, tenantId, code, gstGroupId, description, status, createdAt, updatedAt)
SELECT 'b2010101-0001-4001-8001-000000000002', @tenantId, '730890', g.id, 'Structures and parts of structures — tank shells, chassis', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST18-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_hsn_codes WHERE tenantId=@tenantId AND code='730890');
INSERT INTO master_hsn_codes (id, tenantId, code, gstGroupId, description, status, createdAt, updatedAt)
SELECT 'b2010101-0001-4001-8001-000000000003', @tenantId, '732690', g.id, 'Other articles of iron or steel — brackets, fittings', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST18-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_hsn_codes WHERE tenantId=@tenantId AND code='732690');
INSERT INTO master_hsn_codes (id, tenantId, code, gstGroupId, description, status, createdAt, updatedAt)
SELECT 'b2010101-0001-4001-8001-000000000004', @tenantId, '848180', g.id, 'Taps, cocks, valves — discharge & pneumatic valves', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST18-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_hsn_codes WHERE tenantId=@tenantId AND code='848180');
INSERT INTO master_hsn_codes (id, tenantId, code, gstGroupId, description, status, createdAt, updatedAt)
SELECT 'b2010101-0001-4001-8001-000000000005', @tenantId, '721070', g.id, 'Flat-rolled MS plate — structural plate', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST12-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_hsn_codes WHERE tenantId=@tenantId AND code='721070');
INSERT INTO master_hsn_codes (id, tenantId, code, gstGroupId, description, status, createdAt, updatedAt)
SELECT 'b2010101-0001-4001-8001-000000000006', @tenantId, '8708', g.id, 'Parts for motor vehicles — axles, suspension, running gear', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST18-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_hsn_codes WHERE tenantId=@tenantId AND code='8708');
INSERT INTO master_hsn_codes (id, tenantId, code, gstGroupId, description, status, createdAt, updatedAt)
SELECT 'b2010101-0001-4001-8001-000000000007', @tenantId, '3208', g.id, 'Paints and varnishes — primer, topcoat', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST18-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_hsn_codes WHERE tenantId=@tenantId AND code='3208');
INSERT INTO master_hsn_codes (id, tenantId, code, gstGroupId, description, status, createdAt, updatedAt)
SELECT 'b2010101-0001-4001-8001-000000000008', @tenantId, '8311', g.id, 'Wire, rods, tubes — welding wire', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST12-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_hsn_codes WHERE tenantId=@tenantId AND code='8311');
INSERT INTO master_hsn_codes (id, tenantId, code, gstGroupId, description, status, createdAt, updatedAt)
SELECT 'b2010101-0001-4001-8001-000000000009', @tenantId, '4016', g.id, 'Articles of vulcanised rubber — seals, gaskets', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST18-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_hsn_codes WHERE tenantId=@tenantId AND code='4016');
INSERT INTO master_hsn_codes (id, tenantId, code, gstGroupId, description, status, createdAt, updatedAt)
SELECT 'b2010101-0001-4001-8001-000000000010', @tenantId, '7311', g.id, 'Compressed gas containers — air tanks', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST18-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_hsn_codes WHERE tenantId=@tenantId AND code='7311');
INSERT INTO master_hsn_codes (id, tenantId, code, gstGroupId, description, status, createdAt, updatedAt)
SELECT 'b2010101-0001-4001-8001-000000000011', @tenantId, '4011', g.id, 'New pneumatic tyres', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST18-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_hsn_codes WHERE tenantId=@tenantId AND code='4011');
INSERT INTO master_hsn_codes (id, tenantId, code, gstGroupId, description, status, createdAt, updatedAt)
SELECT 'b2010101-0001-4001-8001-000000000012', @tenantId, '3814', g.id, 'Organic composite solvents and thinners', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST18-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_hsn_codes WHERE tenantId=@tenantId AND code='3814');

UPDATE master_hsn_codes h
JOIN master_gst_groups g ON g.tenantId=h.tenantId AND g.deletedAt IS NULL
SET h.gstGroupId = CASE h.code
  WHEN '721070' THEN (SELECT id FROM master_gst_groups WHERE tenantId=@tenantId AND code='GST12-GOODS' LIMIT 1)
  WHEN '8311' THEN (SELECT id FROM master_gst_groups WHERE tenantId=@tenantId AND code='GST12-GOODS' LIMIT 1)
  ELSE (SELECT id FROM master_gst_groups WHERE tenantId=@tenantId AND code='GST18-GOODS' LIMIT 1)
END,
h.status='ACTIVE', h.deletedAt=NULL, h.updatedAt=NOW(3)
WHERE h.tenantId=@tenantId AND h.code IN ('871639','730890','732690','848180','721070','8708','3208','8311','4016','7311','4011','3814');

/* ---- GST rates (Gujarat intra + common inter-state) ---- */
INSERT INTO master_gst_rates (id, tenantId, code, gstGroupId, fromState, locationStateCode, dateFrom, sgst, cgst, igst, applicableFor, status, createdAt, updatedAt)
SELECT 'b2010201-0001-4001-8001-000000000001', @tenantId, 'GSTR-18-GJ-IN', g.id, 'Gujarat', 'Gujarat', '2017-07-01', 9, 9, 18, 'BOTH', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST18-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_gst_rates WHERE tenantId=@tenantId AND code='GSTR-18-GJ-IN');
INSERT INTO master_gst_rates (id, tenantId, code, gstGroupId, fromState, locationStateCode, dateFrom, sgst, cgst, igst, applicableFor, status, createdAt, updatedAt)
SELECT 'b2010201-0001-4001-8001-000000000002', @tenantId, 'GSTR-12-GJ-IN', g.id, 'Gujarat', 'Gujarat', '2017-07-01', 6, 6, 12, 'BOTH', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST12-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_gst_rates WHERE tenantId=@tenantId AND code='GSTR-12-GJ-IN');
INSERT INTO master_gst_rates (id, tenantId, code, gstGroupId, fromState, locationStateCode, dateFrom, sgst, cgst, igst, applicableFor, status, createdAt, updatedAt)
SELECT 'b2010201-0001-4001-8001-000000000003', @tenantId, 'GSTR-5-GJ-IN', g.id, 'Gujarat', 'Gujarat', '2017-07-01', 2.5, 2.5, 5, 'BOTH', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST5-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_gst_rates WHERE tenantId=@tenantId AND code='GSTR-5-GJ-IN');
INSERT INTO master_gst_rates (id, tenantId, code, gstGroupId, fromState, locationStateCode, dateFrom, sgst, cgst, igst, applicableFor, status, createdAt, updatedAt)
SELECT 'b2010201-0001-4001-8001-000000000004', @tenantId, 'GSTR-18-GJ-MH', g.id, 'Gujarat', 'Maharashtra', '2017-07-01', 0, 0, 18, 'BOTH', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST18-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_gst_rates WHERE tenantId=@tenantId AND code='GSTR-18-GJ-MH');
INSERT INTO master_gst_rates (id, tenantId, code, gstGroupId, fromState, locationStateCode, dateFrom, sgst, cgst, igst, applicableFor, status, createdAt, updatedAt)
SELECT 'b2010201-0001-4001-8001-000000000005', @tenantId, 'GSTR-12-GJ-MH', g.id, 'Gujarat', 'Maharashtra', '2017-07-01', 0, 0, 12, 'BOTH', 'ACTIVE', NOW(3), NOW(3)
FROM master_gst_groups g WHERE g.tenantId=@tenantId AND g.code='GST12-GOODS' AND @tenantId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_gst_rates WHERE tenantId=@tenantId AND code='GSTR-12-GJ-MH');

UPDATE master_gst_rates SET status='ACTIVE', deletedAt=NULL, updatedAt=NOW(3)
WHERE tenantId=@tenantId AND code IN ('GSTR-18-GJ-IN','GSTR-12-GJ-IN','GSTR-5-GJ-IN','GSTR-18-GJ-MH','GSTR-12-GJ-MH');

/* ---- Purchase test items (needs NOS UOM + any item category) ---- */
SET @nosUomId := (
  SELECT id FROM master_uoms
  WHERE tenantId=@tenantId AND deletedAt IS NULL AND UPPER(code)='NOS'
  ORDER BY createdAt ASC LIMIT 1
);
SET @categoryId := (
  SELECT id FROM master_item_categories
  WHERE tenantId=@tenantId AND deletedAt IS NULL
  ORDER BY createdAt ASC LIMIT 1
);

SELECT @nosUomId AS nos_uom_id, @categoryId AS category_id;

INSERT INTO master_item_categories (id, tenantId, code, name, level, stockPolicy, defaultIsStockable, defaultInventoryType, status, createdAt, updatedAt)
SELECT 'b2010401-0001-4001-8001-000000000001', @tenantId, 'RM-TEST', 'Raw Material (Test)', 1, 'REQUIRED', 1, 'inventory', 'ACTIVE', NOW(3), NOW(3)
FROM DUAL
WHERE @tenantId IS NOT NULL AND @categoryId IS NULL
  AND NOT EXISTS (SELECT 1 FROM master_item_categories WHERE tenantId=@tenantId AND code='RM-TEST');

SET @categoryId := IFNULL(@categoryId, (
  SELECT id FROM master_item_categories WHERE tenantId=@tenantId AND code='RM-TEST' LIMIT 1
));

INSERT INTO master_items (id, tenantId, code, name, itemDescription, categoryId, baseUomId, purchaseUomId, itemType, productType, inventoryType, hsnCode, hsnId, gstGroupId, standardRate, isPurchasable, isStockable, qcRequired, qualityTestGroupCode, status, createdAt, updatedAt)
SELECT 'b2010301-0001-4001-8001-000000000001', @tenantId, 'RM-STEEL-PLT', 'MS Plate 8mm — Purchase Test', 'MS Plate 8mm — Purchase Test', @categoryId, @nosUomId, @nosUomId, 'raw_material', 'raw_material', 'inventory', '721070', h.id, h.gstGroupId, 85000, 1, 1, 1, 'QT-RM-IN', 'ACTIVE', NOW(3), NOW(3)
FROM master_hsn_codes h WHERE h.tenantId=@tenantId AND h.code='721070' AND @tenantId IS NOT NULL AND @nosUomId IS NOT NULL AND @categoryId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_items WHERE tenantId=@tenantId AND code='RM-STEEL-PLT');

INSERT INTO master_items (id, tenantId, code, name, itemDescription, categoryId, baseUomId, purchaseUomId, itemType, productType, inventoryType, hsnCode, hsnId, gstGroupId, standardRate, isPurchasable, isStockable, qcRequired, qualityTestGroupCode, status, createdAt, updatedAt)
SELECT 'b2010301-0001-4001-8001-000000000002', @tenantId, 'RM-VALVE-TEST', 'Discharge Valve — Purchase Test', 'Discharge Valve — Purchase Test', @categoryId, @nosUomId, @nosUomId, 'raw_material', 'raw_material', 'inventory', '848180', h.id, h.gstGroupId, 12500, 1, 1, 1, 'QT-RM-IN', 'ACTIVE', NOW(3), NOW(3)
FROM master_hsn_codes h WHERE h.tenantId=@tenantId AND h.code='848180' AND @tenantId IS NOT NULL AND @nosUomId IS NOT NULL AND @categoryId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_items WHERE tenantId=@tenantId AND code='RM-VALVE-TEST');

INSERT INTO master_items (id, tenantId, code, name, itemDescription, categoryId, baseUomId, purchaseUomId, itemType, productType, inventoryType, hsnCode, hsnId, gstGroupId, standardRate, isPurchasable, isStockable, qcRequired, qualityTestGroupCode, status, createdAt, updatedAt)
SELECT 'b2010301-0001-4001-8001-000000000003', @tenantId, 'RM-BRACKET-TEST', 'Steel Bracket — Purchase Test', 'Steel Bracket — Purchase Test', @categoryId, @nosUomId, @nosUomId, 'raw_material', 'raw_material', 'inventory', '732690', h.id, h.gstGroupId, 450, 1, 1, 0, NULL, 'ACTIVE', NOW(3), NOW(3)
FROM master_hsn_codes h WHERE h.tenantId=@tenantId AND h.code='732690' AND @tenantId IS NOT NULL AND @nosUomId IS NOT NULL AND @categoryId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM master_items WHERE tenantId=@tenantId AND code='RM-BRACKET-TEST');

UPDATE master_items i
JOIN master_hsn_codes h ON h.tenantId=i.tenantId AND h.code=i.hsnCode AND h.deletedAt IS NULL
SET i.hsnId=h.id, i.gstGroupId=h.gstGroupId, i.status='ACTIVE', i.deletedAt=NULL, i.updatedAt=NOW(3)
WHERE i.tenantId=@tenantId AND i.code IN ('RM-STEEL-PLT','RM-VALVE-TEST','RM-BRACKET-TEST');

/* ---- Summary ---- */
SELECT
  (SELECT COUNT(*) FROM master_gst_groups WHERE tenantId=@tenantId AND deletedAt IS NULL) AS gst_groups,
  (SELECT COUNT(*) FROM master_gst_rates WHERE tenantId=@tenantId AND deletedAt IS NULL) AS gst_rates,
  (SELECT COUNT(*) FROM master_hsn_codes WHERE tenantId=@tenantId AND deletedAt IS NULL) AS hsn_codes,
  (SELECT COUNT(*) FROM master_items WHERE tenantId=@tenantId AND deletedAt IS NULL AND isPurchasable=1) AS purchasable_items;

SELECT code, description, status FROM master_hsn_codes
WHERE tenantId=@tenantId AND deletedAt IS NULL
ORDER BY code;

SELECT 'Test PO items: RM-STEEL-PLT, RM-VALVE-TEST, RM-BRACKET-TEST' AS note;
