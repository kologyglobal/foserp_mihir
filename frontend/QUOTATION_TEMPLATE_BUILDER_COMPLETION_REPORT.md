# Quotation Template Builder — Completion Report

**Project:** Vasant Trailer ERP  
**Date:** 29 June 2026  
**Verdict:** Advanced Quotation Template Builder Ready

---

## Summary

A reusable quotation template engine has been implemented for CRM, modeled on the **26 KL ISO Tank** technical-commercial quotation structure. Users can create and edit templates, build quotations from opportunities with auto-filled ERP data, preview and print professional A4 documents, manage revisions and approvals, and convert approved quotations to Sales Orders.

---

## Delivered Capabilities

### Template Builder
- **Routes:** `/crm/quotation-templates`, `/new`, `/:id`, `/:id/editor`, `/:id/preview`
- **10 product templates** including detailed **26 KL ISO Tank Container** (16 sections, spec tables)
- Template CRUD: `createQuotationTemplate`, `updateQuotationTemplate`, `duplicateQuotationTemplate`
- Section library via `QuotationSectionEditor` — add, remove, reorder, duplicate types
- `QuotationTemplateBuilder` for full template editing with save & preview

### Quotation Builder
- **Routes:** `/crm/quotations/new`, `/:id/editor`, `/:id/preview`, `/:id/print`
- Three-column layout: section navigator (completion status), document canvas, data source sidebar
- Sticky footer: Save, Save & Preview, Cancel
- Command bar: Submit Approval, Preview, Print, Export PDF, Save to DMS, New Revision

### ISO Tank Reference Mapping
Sections mapped from uploaded quotation format:
1. Header / Cover  
2. Customer details (merge fields)  
3. Opening paragraph  
4. Commercial price table  
5. Technical specifications (spec table)  
6. Material of construction  
7. Surface finish and cleaning  
8. Tank fittings  
9. Other accessories  
10. Painting  
11. Test and approvals  
12. Documents to be provided  
13. Scope of work  
14. General sales terms  
15. Closing paragraph  
16. Signature block  

### Placeholder / Merge Field System
- Engine: `src/utils/quotationEngine/placeholders.ts`
- Fields: `{{quotation_no}}`, `{{customer_name}}`, `{{grand_total}}`, `{{amount_in_words}}`, etc.
- Insert buttons in rich-text sections
- Data source panel shows origin labels and missing placeholder warnings

### Technical Specification Editor
- `QuotationTechnicalSpecEditor` — numbered rows (1.1, 1.2), label/value/unit, add/duplicate/remove
- `contentFormat: 'spec_table'` on sections

### Commercial Price Table
- Full columns: Sr, Description, Qty, UOM, Basic, Disc %, Disc Amt, Taxable, GST %, GST Amt, Total
- Auto GST/total calculation via `crmQuotationCalc`
- Amount in words (INR) via `amountInWordsINR`

### Revision Control
- Rev 0, 1, 2… with mandatory reason
- Previous revision locks on new revision
- Revision history in editor sidebar

### Approval Workflow
- Submit / Approve / Reject via existing `QuotationApprovalPanel`
- Threshold rules (discount, amount) preserved from CRM store

### Print / PDF
- `QuotationPrintDocument` — A4, company header, spec tables, price grid, signature
- `QuotationPreview` — customer-facing view with print warnings
- Print CSS (`@media print`) hides editor chrome
- PDF via browser print; DMS save via `saveQuotationPdfToDms`

### Quotation → Sales Order
- Existing `convertQuotationDocumentToSalesOrder` — only latest approved revision

### Data Auto-Fetch
- CRM: customer, contact, opportunity, sales owner
- Product/opportunity requirement → line items and scope
- Company profile defaults for print header
- Editable while draft; locked when approved

### Tests
- `npm run test:quotation-template-builder` — 27 checks
- Wired into: `test:ci`, `test:uat`, `test:eeta-100`, `test:full-system-uat`

---

## Key Files

| Area | Path |
|------|------|
| ISO Tank template | `src/data/crm/templates/isoTank26Kl.ts` |
| Template seed | `src/data/crm/quotationTemplates.ts` |
| Merge engine | `src/utils/quotationEngine/*` |
| Print layout | `src/components/crm/QuotationPrintDocument.tsx` |
| Spec editor | `src/components/crm/QuotationTechnicalSpecEditor.tsx` |
| Builder UI | `src/components/crm/QuotationBuilder.tsx` |
| Template editor | `src/components/crm/QuotationTemplateBuilder.tsx` |
| Store | `src/store/crmStore.ts` |
| Tests | `scripts/test-quotation-template-builder.ts` |

---

## Remaining Gaps (Future)

1. **DOCX import** — stub only; full heading/table extraction not implemented (spec allows DMS reference + manual structuring)
2. **True PDF generation** — uses browser print; no server-side PDF renderer
3. **Email quotation** — UI placeholder; send-to-customer not wired to mail service
4. **Internal margin view** — hidden cost/margin panel for sales managers not added
5. **Section library persistence** — save section to shared library across templates (in-memory only)
6. **Drag-and-drop reorder** — uses up/down buttons; not drag handles
7. **Change highlighting** on revision diff view

---

## Final Verdict

**Advanced Quotation Template Builder Ready**

The system is a reusable document builder connected to ERP data—not a static form or simple CRUD table. ISO Tank quotation structure is seeded, professional print output is available, and the full quotation lifecycle (draft → approval → SO) is test-covered.
