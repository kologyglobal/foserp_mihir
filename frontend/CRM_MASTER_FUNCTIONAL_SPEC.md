# CRM Master Functional Specification

**Module:** CRM Masters (`/crm/masters`)  
**Version:** 2.0 Enterprise  
**Date:** June 2026  
**Standard:** Microsoft Dynamics 365 / SAP Business One parity

---

## 1. Purpose

CRM Masters is the centralized configuration layer for all CRM reference data. Every dropdown, stage, term, owner, and governance rule used in Leads, Opportunities, Quotations, Sales Orders, Companies, Contacts, and Reports is maintained here.

**Design principles:**
- No placeholder pages — every hub card opens a working register
- No empty tables — all registers ship with realistic B2B manufacturing seed data
- Identical enterprise layout across all masters
- Full CRUD with audit trail, usage tracking, and import/export

---

## 2. Navigation

| Entry | Route | Type |
|-------|-------|------|
| CRM Masters Hub | `/crm/masters` | Catalog dashboard |
| Generic Master List | `/crm/masters/:kind` | 20 catalog registers |
| New Record | `/crm/masters/:kind/new` | Create form |
| Detail | `/crm/masters/:kind/:id` | Read + actions |
| Edit | `/crm/masters/:kind/:id/edit` | Update form |
| Company Master | `/crm/masters/companies` → `/crm/customers` | Linked register |
| Contact Master | `/crm/masters/contacts` → `/crm/contacts` | Linked register |
| Quotation Template | `/crm/masters/quotation-templates` → `/crm/quotation-templates` | Linked register |

Sidebar: **CRM → Masters**

---

## 3. Standard Page Layout

Every master register uses this structure:

```
Breadcrumb: CRM > CRM Masters > [Master Name]
Title + Purpose description
─────────────────────────────────────────
Command Bar: New | Import | Export CSV | Export Excel | Print | History
─────────────────────────────────────────
KPI Strip: Total | Active | Inactive | Filtered
─────────────────────────────────────────
Filter Bar: Search | Status | Column Selector | Sort | View | Record Count
─────────────────────────────────────────
Table (multi-select, actions per row)
─────────────────────────────────────────
Pagination (10/25/50/100 rows)
─────────────────────────────────────────
Right Panel: Purpose | Used In | Audit (on detail/form)
```

### 3.1 List Features

| Feature | Status |
|---------|--------|
| Search (code, name, description) | ✅ |
| Status filter (Active/Inactive) | ✅ |
| Sorting (sequence, name, code, status, last modified) | ✅ |
| Pagination | ✅ |
| Multi-select + bulk deactivate | ✅ |
| Column selector (Code, Name, In Use, etc.) | ✅ |
| Export CSV | ✅ |
| Export Excel (TSV) | ✅ |
| Import CSV (code, name, status, description) | ✅ |
| Print | ✅ |
| Saved views (All / Active / Inactive) | ✅ |

### 3.2 Row Actions

| Action | Description |
|--------|-------------|
| View | Open detail page |
| Edit | Open edit form |
| Duplicate | Copy record with new code |
| History | Audit log on detail page |
| Delete | Hard delete (blocked if in use) |
| Activate / Deactivate | Soft lifecycle control |

### 3.3 Form Layout

Two-column main area + right context panel:

| Section | Fields |
|---------|--------|
| Basic Information | Code, Name, Status |
| Description | Long text |
| Configuration | Catalog-specific attributes |
| Notes | Internal administrator notes |

**Sticky footer actions:**
- Cancel
- Save Draft (localStorage)
- Save
- Save & New
- Save & Close

### 3.4 Detail Page

- Basic + configuration field display
- Live usage links (filtered CRM records)
- Duplicate, Activate, Deactivate, Delete
- Audit history panel
- Created By / Modified By / timestamps

---

## 4. Master Registers

### 4.1 Company & Account (Linked + Catalog)

| Master | Route | Records (seed) | CRUD |
|--------|-------|----------------|------|
| Company Master | `/crm/customers` | Demo customers | Full (operational) |
| Contact Master | `/crm/contacts` | CRM contacts | Full (operational) |
| Lead Source | `/crm/masters/lead-sources` | 50+ | Full |
| Industry | `/crm/masters/industries` | 25+ | Full |
| Territory | `/crm/masters/territories` | 20+ | Full |

### 4.2 Pipeline & Ownership

| Master | Records (seed) | Used In |
|--------|------------------|---------|
| CRM User / Owner | 6 | Leads, Opportunities |
| Lead Stage | 7 | Leads |
| Lead Priority | 4 | Leads |
| Lead Status / Reason | 21+ | Leads |
| Opportunity Stage | 10 | Opportunities |
| Opportunity Priority | 4 | Opportunities |
| Competitor | 30+ | Opportunities, Reports |
| Lost Reason | 30+ | Opportunities, Reports |

### 4.3 Communication

| Master | Records | Used In |
|--------|---------|---------|
| Activity Type | 40+ | Leads, Opportunities, Customer 360 |
| Follow-up Type | 9 | Leads, Opportunities, Quotations |

### 4.4 Quotation & Terms

| Master | Records | Used In |
|--------|---------|---------|
| Product Interest | 9 | Leads, Quotations |
| Commercial Terms | 8 | Quotations |
| Payment Terms | 20+ | Quotations, SO, Invoices |
| Delivery Terms | 15+ | Quotations |
| Warranty Terms | 15+ | Quotations |
| Quotation Template | Templates | Quotations (linked) |

### 4.5 Governance

| Master | Records | Used In |
|--------|---------|---------|
| Approval Rules | 20+ | Quotations, Sales Orders |
| Document Types | 10 | DMS, all CRM entities |

---

## 5. Business Rules

1. **Unique code** per kind — enforced on create
2. **System-controlled** entries (e.g. `converted_to_opportunity`) — cannot delete, deactivate, or change code
3. **In-use protection** — delete blocked when referenced in live CRM data; deactivate allowed
4. **Inactive exclusion** — inactive values excluded from new transaction dropdowns
5. **Audit trail** — created, updated, activated, deactivated, duplicated events logged
6. **Import** — skips duplicates (by code); reports imported/skipped counts

---

## 6. Integration Status

| Consumer | Masters Wired |
|----------|---------------|
| Lead Form / List | Lead stages, priorities, reasons, follow-up types, owners |
| Opportunity Pipeline | *Planned:* opportunity stages, priorities, lost reasons |
| Quotation Builder | *Planned:* payment, delivery, warranty, commercial terms |
| Company / Contact pages | Operational registers (not catalog) |
| CRM Reports | Analytics by master dimensions |

---

## 7. Technical Architecture

| Layer | Path |
|-------|------|
| Types | `src/types/crmMasters.ts` |
| Store (persisted) | `src/store/crmMasterStore.ts` |
| Seed | `src/data/crm/crmMastersSeed.ts` + `crmMastersSeedBulk.ts` |
| Catalog | `src/config/crmMastersCatalog.ts` |
| Pages | `src/modules/crm/masters/` |
| Utils | `src/utils/crmMasterUtils.ts`, `crmMasterAudit.ts` |
| Hooks | `src/hooks/useCrmMasters.ts` |
| Tests | `npm run test:crm-masters` (36 checks) |

---

## 8. Out of Scope (Future)

- Server-side API persistence
- RBAC per register
- Effective dating / versioning
- Drag-and-drop sequence reorder UI
- Full quotation template document designer
- Opportunity pipeline full master consumption (in progress)
