# ERP Card Form System Report

**Project:** Vasant Trailer ERP  
**Date:** June 2026  
**Pattern:** Business Central–inspired data entry (workflow philosophy, not pixel copy)

---

## Final Verdict

**Business Central–style ERP Card Form System Ready**

Phase 1 forms are migrated. Reusable components, tab navigation, command bar, FactBox, sticky save bar, keyboard shortcuts, and automated gate tests are in place.

---

## Components Created

Location: `src/components/erp/card-form/`

| Component | Purpose |
|-----------|---------|
| `ErpCardFormPage` | Top-level shell: header, command bar, status strip, tabs, main + FactBox, sticky footer |
| `ErpCardCommandBar` | Home / Reports / More Options command groups |
| `ErpCardTabs` | BC-style underline tab navigation |
| `ErpCardSection` | FastTab collapsible section cards |
| `ErpFieldRow` | Dense horizontal label–control rows |
| `ErpFieldLabel` | Required marker, caption styling |
| `ErpFieldControl` | Read-only / disabled field states |
| `ErpSubpageGrid` | Line-item subpage grid (add / delete / duplicate / keyboard nav) |
| `ErpFactBoxPanel` | Right-rail contextual summary |
| `ErpStickySaveBar` | Cancel · Save Draft · Save · Save & New · Save & Close |
| `ErpFormStatusStrip` | Draft · Owner · Approval · missing fields |
| `ErpFormValidationSummary` | Re-export of unified validation banner |
| `useErpCardFormKeyboard` | Ctrl+S, Ctrl+Enter, Esc, Alt+N, Alt+D |

**Tab presets:** `ERP_CARD_FORM_TABS_STANDARD`, `ERP_CARD_FORM_TABS_CRM`, `ERP_CARD_FORM_TABS_QUOTATION`, `ERP_CARD_FORM_TABS_SALES_ORDER`, `ERP_CARD_FORM_TABS_MASTER`

**Styles:** `src/styles/dynamics-components.css` — `.erp-card-form-*`, `.erp-field-row`, `.erp-subpage-grid`, `.erp-factbox-panel`

---

## Forms Migrated (Phase 1)

| Form | File | Card form usage |
|------|------|-----------------|
| CRM Lead Create/Edit | `CrmLeadFormPage.tsx` | Tabs, status strip, sticky save bar, `ErpCardSection` via `CrmLeadFormSection` |
| Opportunity Edit | `OpportunityEditPage.tsx` | Full `ErpCardFormPage`, command bar, FactBox, tabs, field rows |
| Quotation Create | `QuotationCrmPages.tsx` → `CrmQuotationNewPage` | Full `ErpCardFormPage`, quotation tabs, FactBox, sticky save |
| Company Master | `CustomerPages.tsx` → `CustomerFormPage` | Status strip, master tabs, sticky save bar |
| CRM Masters | `CrmMasterPages.tsx` → `CrmMasterFormPage` | `ErpCardSection`, tabs, status strip, sticky save bar |

---

## Features Implemented

### Tab navigation
- CRM, Quotation, Sales Order, Master, and Standard transaction tab presets
- Active tab drives visible sections on Opportunity, Quotation New, CRM Masters

### Command bar
- `ErpCardCommandBar` with Home / Reports / More Options groups
- Wired on Opportunity Edit and Quotation New

### Subpage grid
- `ErpSubpageGrid` with add line, delete, duplicate, row selection, totals footer slot
- Ready for Phase 2 transaction forms (SO, PO, GRN lines)

### FactBox
- `ErpFactBoxPanel` + `ErpFactBoxField` on Opportunity Edit and Quotation New

### Sticky save bar
- `ErpStickySaveBar` — navy primary Save, always visible, scroll padding `pb-28`

### Keyboard shortcuts
- Ctrl+S → save
- Ctrl+Enter → save & close
- Esc → cancel (hook ready)
- Alt+N → add line
- Alt+D → delete line

### Dense two-column layout
- `ErpFieldRow` horizontal mode: fixed label width, dotted connector, aligned controls

---

## Tests

**Script:** `npm run test:erp-card-form-system`  
**Result:** 44/44 passed

Wired into:
- `test:ci`
- `test:uat`
- `test:eeta-100`
- `test:full-system-uat`

---

## Remaining Gaps (Phase 2 / 3)

| Area | Status |
|------|--------|
| Sales Order form | Not yet on `ErpCardFormPage` |
| Purchase Requisition / PO / GRN | Not yet migrated |
| Item / Vendor Master | Partial — company done; item/vendor pending |
| Work Order / Job Work / QC / Dispatch / Invoice | Phase 3 |
| Quotation editor (`QuotationBuilder`) | Still document builder layout; footer uses `DocumentFooterActions` |
| CRM Lead full `ErpCardFormPage` shell | Tabs + sticky bar done; shell not fully swapped |
| Subpage line auto-fetch from Item Master | Grid ready; domain wiring per form pending |
| F2 inline grid edit | Hook scaffold only |

---

## Usage

```tsx
import {
  ErpCardFormPage,
  ErpCardCommandBar,
  ErpCardSection,
  ErpFieldRow,
  ErpFactBoxPanel,
  ErpStickySaveBar,
  ERP_CARD_FORM_TABS_CRM,
} from '@/components/erp/card-form'

<ErpCardFormPage
  title="Edit Opportunity"
  recordNo="OPP-0001"
  tabs={ERP_CARD_FORM_TABS_CRM}
  activeTab={tab}
  onTabChange={setTab}
  commandBar={<ErpCardCommandBar homeActions={[...]} />}
  statusStrip={[{ label: 'Status', value: 'Open', tone: 'success' }]}
  onSubmit={handleSubmit}
  factBox={<ErpFactBoxPanel>...</ErpFactBoxPanel>}
  footer={<ErpStickySaveBar cancelTo="/crm/opportunities" onSave={save} />}
>
  <ErpCardSection title="Deal details">
    <ErpFieldRow label="Deal Value"><Input ... /></ErpFieldRow>
  </ErpCardSection>
</ErpCardFormPage>
```
