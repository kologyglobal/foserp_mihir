# CRM Master Navigation Report

**Generated:** June 2026  
**Module path:** `/crm/masters`

---

## 1. Sidebar Navigation

```
CRM
├── Dashboard          /crm
├── Leads              /crm/leads
├── Opportunities      /crm/opportunities
├── Quotations         /crm/quotations
├── Companies          /crm/customers
├── Contacts           /crm/contacts
├── Reports            /crm/reports
└── Masters            /crm/masters  ← Hub entry
```

---

## 2. Hub Dashboard (`/crm/masters`)

### Company & Account
| Card | Click Target | Record Count |
|------|--------------|--------------|
| Company Master | `/crm/masters/companies` → `/crm/customers` | Live customer count |
| Contact Master | `/crm/masters/contacts` → `/crm/contacts` | Live contact count |
| Lead Source Master | `/crm/masters/lead-sources` | 50+ |
| Industry Master | `/crm/masters/industries` | 25+ |
| Territory Master | `/crm/masters/territories` | 20+ |

### Pipeline & Ownership
| Card | Route | Records |
|------|-------|---------|
| CRM User / Owner Master | `/crm/masters/owners` | 6 |
| Lead Stage Master | `/crm/masters/lead-stages` | 7 |
| Lead Priority Master | `/crm/masters/lead-priorities` | 4 |
| Lead Status / Reason Master | `/crm/masters/lead-reasons` | 21+ |
| Opportunity Stage Master | `/crm/masters/opportunity-stages` | 10 |
| Opportunity Priority Master | `/crm/masters/opportunity-priorities` | 4 |
| Competitor Master | `/crm/masters/competitors` | 30+ |
| Lost Reason Master | `/crm/masters/lost-reasons` | 30+ |

### Activities & Follow-ups
| Card | Route | Records |
|------|-------|---------|
| Activity Type Master | `/crm/masters/activity-types` | 40+ |
| Follow-up Type Master | `/crm/masters/follow-up-types` | 9 |

### Quotation & Terms
| Card | Route | Records |
|------|-------|---------|
| Product Interest Master | `/crm/masters/product-interests` | 9 |
| Quotation Template Master | `/crm/masters/quotation-templates` | Live templates |
| Commercial Terms Master | `/crm/masters/commercial-terms` | 8 |
| Payment Terms Master | `/crm/masters/payment-terms` | 20+ |
| Delivery Terms Master | `/crm/masters/delivery-terms` | 15+ |
| Warranty Terms Master | `/crm/masters/warranty-terms` | 15+ |

### Governance & Documents
| Card | Route | Records |
|------|-------|---------|
| Approval Rule Master | `/crm/masters/approval-rules` | 20+ |
| Document Type Master | `/crm/masters/document-types` | 10 |

**Total hub cards:** 23 (20 catalog + 3 linked)

---

## 3. Route Table

| Method | Pattern | Component |
|--------|---------|-----------|
| GET | `/crm/masters` | `CrmMastersHubPage` |
| GET | `/crm/masters/companies` | `CrmLinkedMasterPage` |
| GET | `/crm/masters/contacts` | `CrmLinkedMasterPage` |
| GET | `/crm/masters/quotation-templates` | `CrmLinkedMasterPage` |
| GET | `/crm/masters/:kind` | `CrmMasterListPage` |
| GET | `/crm/masters/:kind/new` | `CrmMasterFormPage` |
| GET | `/crm/masters/:kind/:id` | `CrmMasterDetailPage` |
| GET | `/crm/masters/:kind/:id/edit` | `CrmMasterFormPage` |

**Route file:** `src/routes/crmRoutes.tsx`

---

## 4. Breadcrumb Patterns

### Hub
`Home > CRM > CRM Masters`

### List
`Home > CRM > CRM Masters > [Master Name]`

### Detail
`Home > CRM > CRM Masters > [Master Name] > [Record Name]`

### Form
`Home > CRM > CRM Masters > [Master Name] > New` or `Edit [Name]`

---

## 5. Back Navigation

| From | Back Action |
|------|-------------|
| List page | Hub (`CRM Masters` command bar button) |
| Detail page | List (`backLabel` = master title) |
| Form page | List (Cancel or back link) |
| Linked bridge | Hub + Open Register |

---

## 6. Command Bar Actions by Page

### Hub
- **Primary:** Master Setup Guide (scrolls to guide section)
- **Secondary:** Company Master, Lead Stages shortcuts

### List (all catalog masters)
- **Primary:** New
- **Secondary:** Import*, Export CSV, Export Excel, Print, History, CRM Masters
*Import available on registers flagged `importExport: true`

### Form
- Cancel | Save Draft | Save | Save & New | Save & Close

### Detail
- Edit | Duplicate | Activate/Deactivate | Delete

---

## 7. Global Search (Planned)

Master records should be discoverable via global search by:
- Master register name (e.g. "Industry Master")
- Record code and name (e.g. "cement", "Gujarat")

*Implementation: wire `pageNavigation` registry with master slugs.*

---

## 8. Favorites

Each master list supports favorites via `favoritePath`:
- `/crm/masters` (hub)
- `/crm/masters/[kind]` (per register)

---

## 9. Test Coverage

```bash
npm run test:crm-masters
```

36 automated checks covering:
- Navigation menu entry
- All 23 master routes
- Seed data minimums
- CRUD business rules
- Lead form integration
- CI/UAT wiring

---

## 10. Quick Start Path for Administrators

1. Open **CRM → Masters**
2. Configure **Territories** and **Owners** first
3. Review **Lead Stages** and **Opportunity Stages**
4. Set up **Payment / Delivery / Warranty Terms**
5. Define **Approval Rules** for quotation thresholds
6. Import bulk data via CSV where needed
7. Verify usage on detail pages after go-live
