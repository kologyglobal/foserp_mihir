# Database Conventions

Schema: `backend/prisma/schema.prisma`  
Provider: **MySQL 8** via `DATABASE_URL` or `DB_*` env vars.

## Tenant-owned record standard columns

Most business tables include:

```text
id          UUID primary key
tenantId    FK → tenants.id (required on all business data)
createdBy   User id (nullable)
updatedBy   User id (nullable)
createdAt   DateTime @default(now())
updatedAt   DateTime @updatedAt
deletedAt   DateTime? (soft delete)
```

## Transaction rules

- Use Prisma `$transaction` for multi-table writes (workflow actions, imports, conversions).
- Workflow endpoints (qualify, convert, win, lose) must not be bypassed via generic PATCH.
- Code series increments inside transactions to avoid duplicate codes.
- Import pipelines batch-insert with per-row error collection; rollback on fatal errors.

## Naming standards

- Tables: `snake_case` plural (`crm_companies`, `master_items`)
- Prisma models: `PascalCase` (`CrmCompany`, `MasterItem`)
- API routes: kebab-case resource slugs (`/crm/follow-ups`, `/masters/hsn-sac`)
- Permissions: `module.resource.action` (`crm.lead.create`)

## ID strategy

- **Primary keys:** UUID strings (`@id @default(uuid())`, stored as `VARCHAR(191)`).
- **Foreign keys:** UUID references with Prisma relations.
- **Codes:** Human-readable tenant-scoped codes (`leadCode`, `companyCode`, `code` on masters) via `code_series` table or manual entry.

## Tenant columns

- Every business model includes `tenantId String` FK → `tenants.id`.
- Composite unique indexes always include `tenantId` first.
- Queries **must** filter `where: { tenantId, deletedAt: null }` (use `tenantActiveFilter()` in CRM services).

## Audit columns

Standard pattern on mutable entities:

| Column | Purpose |
|--------|---------|
| `createdBy` | User id (nullable UUID string) |
| `updatedBy` | User id |
| `createdAt` | `@default(now())` |
| `updatedAt` | `@updatedAt` |

Platform audit log: `audit_logs` table (module, entity, entityId, action, oldValues, newValues JSON, ipAddress, userAgent).

History tables (CRM): `crm_lead_status_history`, `crm_opportunity_stage_history`, `crm_opportunity_assignment_history`, `crm_opportunity_amount_history`, `crm_opportunity_status_history`.

## Soft delete

- `deletedAt DateTime?` on tenant-scoped business tables.
- Delete endpoints set `deletedAt = now()`; list/get filters exclude deleted rows.
- Tenants themselves support soft delete (`tenants.deletedAt`).

## Status enums

| Enum | Used on |
|------|---------|
| `TenantStatus` | tenants |
| `UserStatus` | users |
| `ActivityType`, `ActivityStatus` | crm_activities |
| `OpportunityStatus` | crm_opportunities |
| `PipelineStatus` | crm_pipelines |
| `MasterRecordStatus` | master_* tables |
| `CrmEntityType` | crm_notes, crm_attachments |

Many CRM fields use string status slugs (e.g. lead `stage`, follow-up `status`) for flexibility.

## Migrations

Applied in order under `backend/prisma/migrations/`:

| Migration | Contents |
|-----------|----------|
| `20260710180000_init` | tenants, users, roles, permissions, auth tokens, audit_logs, code_series, full CRM core (companies, contacts, leads, activities, pipelines, opportunities, lines) |
| `20260710200000_crm_follow_ups` | crm_follow_ups |
| `20260710210000_master_foundation` | countries, states, cities, uom, warehouses, locations |
| `20260710220000_master_batch_phase4` | item_categories, hsn, gst_groups, gst_rates, items |
| `20260710230000_vendor_geography_fks` | vendors + geography FKs |
| `20260710240000_crm_masters_notes_attachments_histories` | crm_masters, crm_notes, crm_attachments, opportunity history tables |
| `20260710212426_add_crm_quotations` | crm_quotations, crm_quotation_documents |
| `20260718150000_add_vendor_invoice_and_ap_open_item_foundation` | vendor_invoices, vendor_invoice_lines, vendor_invoice_source_links, payable_open_items; extends finance number series + approval enums with VENDOR_INVOICE |

Apply migrations non-interactively in CI/automation:

```bash
npx tsx scripts/prisma-cli.ts migrate deploy
```

Commands:

```bash
cd backend
npm run db:generate    # prisma generate
npm run db:migrate     # dev migrate
npm run db:setup       # generate + deploy + seed
npm run db:seed        # seed only
```

## Seed

`backend/prisma/seed.ts`:

1. Upserts all permissions from `PERMISSIONS` constant.
2. Creates global Super Admin role + tenant-scoped roles with `ROLE_PERMISSIONS` map.
3. Creates default tenant `vasant-trailers`.
4. Creates seed users (emails documented in `backend/README.md` — passwords are dev-only, never store in docs).
5. Seeds default CRM pipeline + stages.
6. Seeds CRM master kinds (sources, industries, lost reasons, etc.).

Re-run seed after adding new permissions: `npm run db:seed`.

## Tables by module

### Platform / Auth

| Table | Model |
|-------|-------|
| tenants | Tenant |
| users | User |
| roles | Role |
| permissions | Permission |
| user_roles | UserRole |
| role_permissions | RolePermission |
| refresh_tokens | RefreshToken |
| password_reset_tokens | PasswordResetToken |
| audit_logs | AuditLog |
| code_series | CodeSeries |

### CRM core

| Table | Model |
|-------|-------|
| crm_companies | CrmCompany |
| crm_contacts | CrmContact |
| crm_leads | CrmLead |
| crm_lead_status_history | CrmLeadStatusHistory |
| crm_lead_assignments | CrmLeadAssignment |
| crm_activities | CrmActivity |
| crm_pipelines | CrmPipeline |
| crm_pipeline_stages | CrmPipelineStage |
| crm_opportunities | CrmOpportunity |
| crm_opportunity_lines | CrmOpportunityLine |
| crm_follow_ups | CrmFollowUp |
| crm_masters | CrmMaster |
| crm_notes | CrmNote |
| crm_attachments | CrmAttachment |
| crm_opportunity_stage_history | CrmOpportunityStageHistory |
| crm_opportunity_assignment_history | CrmOpportunityAssignmentHistory |
| crm_opportunity_amount_history | CrmOpportunityAmountHistory |
| crm_opportunity_status_history | CrmOpportunityStatusHistory |

### CRM quotations

| Table | Model | Status |
|-------|-------|--------|
| crm_quotations | CrmQuotation | Migrated (`20260710212426_add_crm_quotations`) |
| crm_quotation_documents | CrmQuotationDocument | Migrated (`20260710212426_add_crm_quotations`) |

### Master data

| Table | Model |
|-------|-------|
| master_countries | MasterCountry |
| master_states | MasterState |
| master_cities | MasterCity |
| master_uoms | MasterUom |
| master_warehouses | MasterWarehouse |
| master_locations | MasterLocation |
| master_item_categories | MasterItemCategory |
| master_hsn_codes | MasterHsnCode |
| master_gst_groups | MasterGstGroup |
| master_gst_rates | MasterGstRate |
| master_items | MasterItem |
| master_vendors | MasterVendor |

### Accounting — Accounts Payable (Phases 4A1 + 4B1 foundation)

| Table | Model | Notes |
|-------|-------|-------|
| vendor_invoices | VendorInvoice | Financial supplier bill; soft `vendorId` → `MasterVendor` (no FK); UUID id; `createdBy`/`updatedBy` audit; **no `deletedAt`** |
| vendor_invoice_lines | VendorInvoiceLine | Cascade delete with invoice |
| vendor_invoice_source_links | VendorInvoiceSourceLink | Optional soft links to PO/GRN/etc.; Cascade delete with invoice |
| payable_open_items | PayableOpenItem | AP subledger; `sourceVendorInvoiceId` / `sourceVendorPaymentId` unique; Restrict on source deletes |
| vendor_payments | VendorPayment | Settlement / advance / mixed; soft `vendorId`; `vendorPaymentNumber` null until post (4B3) |
| vendor_payment_adjustment_lines | VendorPaymentAdjustmentLine | TDS/discount/charges; unique `(vendorPaymentId, lineNumber)` |
| payable_allocation_batches | PayableAllocationBatch | Subledger-only; one DEBIT source open item; no GL |
| payable_allocation_lines | PayableAllocationLine | Unique `(allocationBatchId, targetCreditOpenItemId)` |

Money fields on AP tables use `@db.Decimal(18, 4)`; exchange rates `@db.Decimal(18, 8)`. Line quantities `@db.Decimal(18, 6)`.

### Not in database (frontend demo only)

Purchase orders, GRN, inventory transactions, work orders, BOM, routing, quality inspections, dispatch, sales orders — live in Zustand stores only. **Finance ledger operational screens** beyond shipped AR/Money In and AP vendor-invoice Money Out remain demo/mock where noted. AP **payment HTTP** and allocation execution are not shipped (4B2+).

## Indexing conventions

- Always index `tenantId`.
- Common composites: `[tenantId, deletedAt]`, `[tenantId, status]`, entity-specific lookups.
- Soft-deleted rows remain in index (filter in query).

## Decimal / money

Financial amounts use `@db.Decimal(18, 2)` or `(18, 4)` for quantities and AP/AR money fields. Services use `decimalToNumber()` when returning JSON.
