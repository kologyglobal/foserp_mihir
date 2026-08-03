/* =========================================================
   LIVE DEPLOY — Part C dummy data
   File: live-seed-dummy-legal-entity.sql
   Order: 6th (after schema + prisma bookkeeping).
   Tenant: vasant-trailers
   Creates (if missing):
     - Legal Entity LE-MAIN (Demo Legal Entity)
     - Head Office branch
     - FinanceSettings (financeActivated=1)
     - Current financial year + one OPEN period
     - Organisation GST registration
   Idempotent — safe to re-run.
   Unblocks: Vendor Invoice draft / PI → AP handoff legalEntityId
   ========================================================= */

USE `u233611619_foserp`;

SELECT DATABASE() AS current_db, NOW() AS ran_at, 'seed_dummy_legal_entity' AS script;

SET @tenantSlug := 'vasant-trailers';
SET @tenantId := (
  SELECT id FROM tenants
  WHERE slug = @tenantSlug AND deletedAt IS NULL
  LIMIT 1
);

SELECT @tenantSlug AS tenant_slug, @tenantId AS tenant_id;

/* Abort-friendly: if tenant missing, later inserts affect 0 rows */
SET @leId := 'a1000001-0001-4001-8001-000000000001';
SET @branchId := 'a1000001-0001-4001-8001-000000000002';
SET @fyId := 'a1000001-0001-4001-8001-000000000003';
SET @periodId := 'a1000001-0001-4001-8001-000000000004';
SET @fsId := 'a1000001-0001-4001-8001-000000000005';
SET @regId := 'a1000001-0001-4001-8001-000000000006';

SET @fyStartYear := IF(MONTH(UTC_DATE()) >= 4, YEAR(UTC_DATE()), YEAR(UTC_DATE()) - 1);
SET @fyName := CONCAT('FY ', @fyStartYear, '-', RIGHT(@fyStartYear + 1, 2));
SET @fyStart := CONCAT(@fyStartYear, '-04-01');
SET @fyEnd := CONCAT(@fyStartYear + 1, '-03-31');

/* Prefer an existing active LE if present; else use stable dummy id */
SET @existingLeId := (
  SELECT id FROM legal_entities
  WHERE tenantId = @tenantId AND isActive = 1
  ORDER BY isDefault DESC, createdAt ASC
  LIMIT 1
);
SET @useLeId := IFNULL(@existingLeId, @leId);

/* ---- Legal entity ---- */
INSERT INTO `legal_entities` (
  `id`, `tenantId`, `code`, `legalName`, `displayName`, `tradeName`,
  `entityType`, `pan`, `gstin`, `baseCurrency`, `countryCode`, `stateCode`,
  `registeredAddressJson`, `billingAddressJson`,
  `fiscalYearStartMonth`, `isDefault`, `isActive`,
  `createdAt`, `updatedAt`
)
SELECT
  @leId,
  @tenantId,
  'LE-MAIN',
  'Demo Legal Entity Private Limited',
  'Demo Legal Entity',
  'Demo Legal Entity',
  'PRIVATE_LIMITED',
  'AABCV1234F',
  '27AABCV1234F1Z5',
  'INR',
  'IN',
  '27',
  JSON_OBJECT(
    'line1', 'Demo Industrial Estate',
    'city', 'Pune',
    'state', 'Maharashtra',
    'postalCode', '411001',
    'country', 'India',
    'countryCode', 'IN',
    'stateCode', '27'
  ),
  JSON_OBJECT(
    'line1', 'Demo Industrial Estate',
    'city', 'Pune',
    'state', 'Maharashtra',
    'postalCode', '411001',
    'country', 'India',
    'countryCode', 'IN',
    'stateCode', '27'
  ),
  4,
  1,
  1,
  NOW(3),
  NOW(3)
FROM DUAL
WHERE @tenantId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM legal_entities
    WHERE tenantId = @tenantId AND (id = @leId OR code = 'LE-MAIN')
  );

/* Refresh useLeId after insert */
SET @useLeId := IFNULL((
  SELECT id FROM legal_entities
  WHERE tenantId = @tenantId AND isActive = 1
  ORDER BY isDefault DESC, createdAt ASC
  LIMIT 1
), @leId);

/* Ensure at least one default active LE */
UPDATE legal_entities
SET isDefault = 1, isActive = 1, updatedAt = NOW(3)
WHERE id = @useLeId AND tenantId = @tenantId AND isDefault = 0;

UPDATE legal_entities
SET isDefault = 0, updatedAt = NOW(3)
WHERE tenantId = @tenantId AND id <> @useLeId AND isDefault = 1;

/* ---- Head Office branch ---- */
INSERT INTO `branches` (
  `id`, `tenantId`, `legalEntityId`, `code`, `name`, `branchType`,
  `gstin`, `stateCode`, `isHeadOffice`, `isDefault`, `isActive`,
  `createdAt`, `updatedAt`
)
SELECT
  @branchId,
  @tenantId,
  @useLeId,
  'HO',
  'Head Office',
  'HEAD_OFFICE',
  '27AABCV1234F1Z5',
  '27',
  1,
  1,
  1,
  NOW(3),
  NOW(3)
FROM DUAL
WHERE @tenantId IS NOT NULL
  AND @useLeId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM branches
    WHERE tenantId = @tenantId AND legalEntityId = @useLeId AND code = 'HO'
  );

/* ---- Finance settings ---- */
INSERT INTO `finance_settings` (
  `id`, `tenantId`, `legalEntityId`,
  `baseCurrency`, `dateFormat`, `amountPrecision`, `quantityPrecision`,
  `roundingMethod`, `roundingTolerance`,
  `allowBackdatedPosting`, `backdatedDaysLimit`,
  `allowManualControlAccountPosting`, `financeActivated`,
  `createdAt`, `updatedAt`
)
SELECT
  @fsId,
  @tenantId,
  @useLeId,
  'INR',
  'DD/MM/YYYY',
  2,
  3,
  'ROUND_HALF_UP',
  1,
  0,
  0,
  0,
  1,
  NOW(3),
  NOW(3)
FROM DUAL
WHERE @tenantId IS NOT NULL
  AND @useLeId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM finance_settings WHERE legalEntityId = @useLeId
  );

UPDATE finance_settings
SET financeActivated = 1, updatedAt = NOW(3)
WHERE legalEntityId = @useLeId AND financeActivated = 0;

/* ---- Current financial year ---- */
INSERT INTO `financial_years` (
  `id`, `tenantId`, `legalEntityId`, `name`,
  `startDate`, `endDate`, `status`, `isCurrent`,
  `createdAt`, `updatedAt`
)
SELECT
  @fyId,
  @tenantId,
  @useLeId,
  @fyName,
  @fyStart,
  @fyEnd,
  'ACTIVE',
  1,
  NOW(3),
  NOW(3)
FROM DUAL
WHERE @tenantId IS NOT NULL
  AND @useLeId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM financial_years
    WHERE tenantId = @tenantId AND legalEntityId = @useLeId AND isCurrent = 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM financial_years
    WHERE tenantId = @tenantId AND legalEntityId = @useLeId AND name = @fyName
  );

SET @useFyId := IFNULL((
  SELECT id FROM financial_years
  WHERE tenantId = @tenantId AND legalEntityId = @useLeId AND isCurrent = 1
  ORDER BY startDate DESC
  LIMIT 1
), (
  SELECT id FROM financial_years
  WHERE tenantId = @tenantId AND legalEntityId = @useLeId AND name = @fyName
  LIMIT 1
));

/* ---- One OPEN accounting period spanning the FY ---- */
INSERT INTO `accounting_periods` (
  `id`, `tenantId`, `legalEntityId`, `financialYearId`,
  `periodNumber`, `name`, `startDate`, `endDate`, `status`,
  `createdAt`, `updatedAt`
)
SELECT
  @periodId,
  @tenantId,
  @useLeId,
  @useFyId,
  1,
  'Open',
  @fyStart,
  @fyEnd,
  'OPEN',
  NOW(3),
  NOW(3)
FROM DUAL
WHERE @tenantId IS NOT NULL
  AND @useLeId IS NOT NULL
  AND @useFyId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE financialYearId = @useFyId AND periodNumber = 1
  );

/* ---- GST organisation registration ---- */
INSERT INTO `organisation_registrations` (
  `id`, `tenantId`, `legalEntityId`,
  `registrationType`, `registrationNumber`,
  `country`, `state`, `status`,
  `createdAt`, `updatedAt`
)
SELECT
  @regId,
  @tenantId,
  @useLeId,
  'GST',
  '27AABCV1234F1Z5',
  'India',
  'Maharashtra',
  'ACTIVE',
  NOW(3),
  NOW(3)
FROM DUAL
WHERE @tenantId IS NOT NULL
  AND @useLeId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM organisation_registrations
    WHERE tenantId = @tenantId
      AND registrationType = 'GST'
      AND registrationNumber = '27AABCV1234F1Z5'
      AND deletedAt IS NULL
  );

/* ---- Summary ---- */
SELECT
  @tenantId AS tenant_id,
  @useLeId AS legal_entity_id,
  (SELECT code FROM legal_entities WHERE id = @useLeId) AS le_code,
  (SELECT displayName FROM legal_entities WHERE id = @useLeId) AS le_name,
  (SELECT COUNT(*) FROM branches WHERE tenantId = @tenantId AND legalEntityId = @useLeId) AS branch_count,
  (SELECT COUNT(*) FROM finance_settings WHERE legalEntityId = @useLeId) AS finance_settings_count,
  (SELECT financeActivated FROM finance_settings WHERE legalEntityId = @useLeId LIMIT 1) AS finance_activated,
  @useFyId AS financial_year_id,
  (SELECT COUNT(*) FROM accounting_periods WHERE financialYearId = @useFyId) AS period_count,
  (SELECT COUNT(*) FROM organisation_registrations WHERE legalEntityId = @useLeId AND deletedAt IS NULL) AS reg_count;
