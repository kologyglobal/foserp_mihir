# CRM Opportunity Item Lines Completion Report

**Project:** Vasant Trailer ERP  
**Sprint:** CRM Opportunity Item Line Entry  
**Date:** 2026-06-29  
**Verdict:** **Opportunity Item Line Entry Ready**

---

## Summary

Invoice-style multi-line product entry is now available on **New Opportunity** (`/crm/opportunities/new`) and **Edit Opportunity** (`/crm/opportunities/:id/edit`). Deal value, pipeline metrics, and quotation handover are driven from item lines instead of a single product dropdown.

---

## Delivered

### Item line grid
- **`ErpLineItemsGrid`** — 16-column invoice-style grid (Sr, Product/Item, code, description, qty, UOM, price, discount, taxable, GST, line total, delivery, remarks, actions)
- **`ErpSmartSelect`** — searchable portal dropdown (not native `<select>`)
- Row actions: Add, Delete, Duplicate, Clear, Move up/down
- Summary panel: total qty, basic, discount, taxable, GST, grand total, probability, weighted value

### Item Master integration
- Options from **released Product Master** + linked FG **Item** + UOM
- Search: code, name, family, drawing revision, HSN, item fields
- Auto-fill on select: code, description, UOM, GST %, standard price, family, item type
- ISO Tank family maps default template `qtpl-iso-tank`

### Data model
- **`OpportunityLine`** on `Opportunity.lines[]`
- **`opportunityLineCalc.ts`** — sync, summary, validation, quotation mapping, legacy resolution

### Calculation rules
- Basic = Qty × Unit Price  
- Discount = Basic × Discount %  
- Taxable = Basic − Discount  
- GST = Taxable × GST %  
- Line Total = Taxable + GST  
- **Expected Value** = Grand Total (read-only on form)  
- **Weighted** = Grand Total × Probability %

### Validation
- Blocks save without lines, product, qty > 0, unit price, GST %, company, owner, stage, probability
- Top validation summary + inline row errors

### Save behavior
- `createOpportunity` / `updateOpportunity` persist `lines[]` and recompute `value` + primary `productId`
- Activity: *"Opportunity created with X item lines worth ₹Y."*
- Lead prefill: first line from lead requirement; lead stage advanced when applicable

### Quotation handover
- **Save & Create Quotation** → `/crm/quotations/new?opportunityId=…`
- `createQuotationFromOpportunity` seeds `priceLines` from opportunity lines

### 360 / list / kanban
- Deal 360 **Items** tab with read-only grid + summary
- Pipeline list: Primary Item + item count + weighted column
- Kanban card: primary item label + item count

---

## Tests

`npm run test:crm-opportunity-item-lines` — **30/30 passed**

Wired into:
- `test:ci`
- `test:uat`
- `test:eeta-100`
- `test:crm-eeata-fix` (CRM freeze suite)

---

## Remaining gaps

| Gap | Notes |
|-----|--------|
| Stock qty in dropdown | Hook ready via `stockByItemId`; not yet wired to live inventory positions |
| Value override permission | Expected value is always computed from lines (no manual override role) |
| Sample seed lines | Legacy demo opps use `lines: []`; display resolves from `productId` + `value` |
| Attachments / history tabs | Still placeholders on new/edit forms |
| Drag reorder | Move up/down implemented; drag-and-drop not added |

---

## Key files

| Area | Path |
|------|------|
| Types | `src/types/crm.ts` |
| Calculations | `src/utils/opportunityLineCalc.ts` |
| Product options | `src/utils/opportunityProductOptions.ts` |
| Smart select | `src/components/erp/ErpSmartSelect.tsx` |
| Line grid | `src/components/erp/ErpLineItemsGrid.tsx` |
| New / Edit pages | `src/modules/crm/OpportunityNewPage.tsx`, `OpportunityEditPage.tsx` |
| Deal 360 | `src/modules/crm/Opportunity360Page.tsx` |
| Store | `src/store/crmStore.ts` |
| Tests | `scripts/test-crm-opportunity-item-lines.ts` |
