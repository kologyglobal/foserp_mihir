/* =========================================================
   LIVE SEED — Default Legal Entity per tenant
   File: live-seed-default-legal-entity.sql
   Idempotent — skips tenants that already have an active LE.
   DB: u233611619_foserp (adjust USE if needed)
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'default_legal_entity' AS script;

-- Insert LE + HO branch for tenants without any active legal entity
INSERT INTO `legal_entities` (
  `id`, `tenantId`, `code`, `legalName`, `displayName`, `tradeName`,
  `entityType`, `pan`, `gstin`, `baseCurrency`, `countryCode`, `stateCode`,
  `registeredAddressJson`, `fiscalYearStartMonth`, `isDefault`, `isActive`,
  `createdAt`, `updatedAt`
)
SELECT
  UUID(),
  t.id,
  'LE-VTL',
  'Vasant Trailers Private Limited',
  'Vasant Trailers',
  'Vasant Trailers',
  'PRIVATE_LIMITED',
  'AABCV1234F',
  '27AABCV1234F1Z5',
  'INR',
  'IN',
  '27',
  JSON_OBJECT(
    'line1', 'MIDC Chakan, Phase II',
    'city', 'Pune',
    'state', 'Maharashtra',
    'postalCode', '410501',
    'country', 'India',
    'countryCode', 'IN',
    'stateCode', '27'
  ),
  4,
  true,
  true,
  NOW(3),
  NOW(3)
FROM `tenants` t
WHERE t.deletedAt IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `legal_entities` le
    WHERE le.tenantId = t.id AND le.isActive = true
  );

-- Head office branch (one per new LE without HO branch)
INSERT INTO `branches` (
  `id`, `tenantId`, `legalEntityId`, `code`, `name`, `branchType`,
  `gstin`, `stateCode`, `isHeadOffice`, `isDefault`, `isActive`,
  `createdAt`, `updatedAt`
)
SELECT
  UUID(),
  le.tenantId,
  le.id,
  'HO-PUNE',
  'Pune Head Office',
  'HEAD_OFFICE',
  le.gstin,
  '27',
  true,
  true,
  true,
  NOW(3),
  NOW(3)
FROM `legal_entities` le
WHERE le.isActive = true
  AND NOT EXISTS (
    SELECT 1 FROM `branches` b
    WHERE b.legalEntityId = le.id AND b.isHeadOffice = true
  );

-- Finance settings
INSERT INTO `finance_settings` (
  `id`, `tenantId`, `legalEntityId`, `financeActivated`, `baseCurrency`,
  `createdAt`, `updatedAt`
)
SELECT
  UUID(),
  le.tenantId,
  le.id,
  true,
  'INR',
  NOW(3),
  NOW(3)
FROM `legal_entities` le
WHERE le.isActive = true
  AND NOT EXISTS (
    SELECT 1 FROM `finance_settings` fs WHERE fs.legalEntityId = le.id
  );

-- Current financial year (Apr–Mar)
INSERT INTO `financial_years` (
  `id`, `tenantId`, `legalEntityId`, `name`, `startDate`, `endDate`,
  `status`, `isCurrent`, `createdAt`, `updatedAt`
)
SELECT
  UUID(),
  le.tenantId,
  le.id,
  CONCAT('FY ', YEAR(CURDATE()) - IF(MONTH(CURDATE()) >= 4, 0, 1), '-', RIGHT(YEAR(CURDATE()) + IF(MONTH(CURDATE()) >= 4, 1, 0), 2)),
  STR_TO_DATE(CONCAT(YEAR(CURDATE()) - IF(MONTH(CURDATE()) >= 4, 0, 1), '-04-01'), '%Y-%m-%d'),
  STR_TO_DATE(CONCAT(YEAR(CURDATE()) + IF(MONTH(CURDATE()) >= 4, 1, 0), '-03-31'), '%Y-%m-%d'),
  'ACTIVE',
  true,
  NOW(3),
  NOW(3)
FROM `legal_entities` le
WHERE le.isActive = true
  AND NOT EXISTS (
    SELECT 1 FROM `financial_years` fy
    WHERE fy.legalEntityId = le.id AND fy.isCurrent = true
  );

SELECT 'default legal entity seed complete' AS status;
SELECT le.tenantId, le.code, le.displayName, le.gstin, le.isDefault
FROM `legal_entities` le
WHERE le.isActive = true
ORDER BY le.createdAt DESC
LIMIT 10;
