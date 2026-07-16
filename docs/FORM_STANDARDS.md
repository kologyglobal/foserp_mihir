# Form Design Standards — FOS ERP

> System-wide data-entry form architecture. Last updated: **2026-07-13**.

## Design rule

```text
CREATE FAST → SHOW LESS FIRST → REVEAL MORE WHEN NEEDED
```

| Layer | Purpose |
|-------|---------|
| **Quick Entry** | Mandatory + high-frequency fields only |
| **Additional Information** | Optional / advanced fields (collapsed by default on new records) |
| **3-column grid** | Default for medium/large forms (tablet 2 / mobile 1) |
| **Buttons** | Semantic variants via shared `.erp-btn` / `ErpButton` |
| **Form actions** | End of form — **not** sticky |

---

## Shared components

| Component | Path | Role |
|-----------|------|------|
| `ErpQuickEntrySection` | `src/components/erp/card-form/ErpQuickEntrySection.tsx` | Core Quick Entry FastTab |
| `ErpAdditionalInfoToggle` / `Panel` / `useErpAdditionalInfo` | `src/components/erp/card-form/ErpAdditionalInfo.tsx` | Progressive disclosure |
| `ErpFormGrid` / `ErpFormSpan` | `src/components/erp/card-form/ErpFormGrid.tsx` | Responsive 3-col grid + spans |
| `ErpFieldGroup` | `src/components/erp/card-form/ErpFieldGroup.tsx` | Sub-group inside Quick Entry |
| `ErpCardSection` | `src/components/erp/card-form/ErpCardSection.tsx` | Section FastTab (**dense default = 3 cols**) |
| `ErpFieldRow` | `src/components/erp/card-form/ErpFieldRow.tsx` | Standard field row |
| `ErpStickySaveBar` | `src/components/erp/card-form/ErpStickySaveBar.tsx` | End-of-form actions (`sticky` default **false**) |
| `ErpAdditionalSectionNav` | `src/components/erp/card-form/ErpAdditionalSectionNav.tsx` | One-at-a-time section chips inside Additional Info |

CSS: `src/styles/dynamics-components.css` — `.erp-quick-entry`, `.erp-additional-info-*`, `.erp-additional-section-nav*`, `.erp-form-grid`, `.erp-field-group`.

---

## Additional Information accordion

When Additional Information opens, show a **section navigator** (status chips). **Only one section body is expanded at a time.** Do not stack Territory + Products + Commercial + Notes + Activities + Status + Timeline vertically.

```text
Additional Information
5 sections · 2 need attention        ˅ / ˄
  [Products  3 items]   [Commercial  Needs input]   [Timeline  3 updates]
  [Attachments  No files]  [Status  Qualified]
  → active section panel only
```

Title stays **Additional Information**; subtitle is `N sections · M need attention` (omit the attention clause when M is 0). Chevron indicates expand/collapse — do not use “Add/Hide Additional Information”.

Section tiles use **subdued status text** (not pill badges). Only warnings (`Needs input`, overdue, etc.) use amber emphasis; OK/neutral values stay quiet.

Applied on: Lead create/edit (`CrmLeadFormPage`), Lead 360 (`Lead360Workspace`), Opportunity New, Contact create/edit.

### Lead / Opportunity 360 Activity Timeline

Notes, activities, follow-ups, and system/relationship events are **one chronological feed** with filters (`All | Activities | Notes | Follow-ups | System`). Add each type via dedicated buttons/drawers — do not ship separate overlapping history sections.

Applied on: Lead 360, Opportunity 360.

---

## Button variants (semantic)

| Variant | Use for |
|---------|---------|
| `primary` | Save, Create, Update, Confirm |
| `secondary` | Save & New, Add, alternate actions |
| `outline` | Save & Close |
| `ghost` | Cancel |
| `success` | Approve, Complete, Convert |
| `warning` | Hold, Escalate |
| `danger` | Delete, Reject, Void |
| `info` | Preview, AI Insight |

Order: **[Save] [Save & New] [Save & Close] [Cancel]**

---

## Standard page structure

```text
PAGE HEADER (+ command bar)
QUICK ENTRY          ← 3-column
Additional Information   ← N sections · M need attention + chevron
ADDITIONAL SECTIONS  ← collapsed by default (new)
FORM ACTIONS         ← end of form, non-sticky
```

---

## Forms converted (Phase 3)

| Form | Status | Quick Entry fields |
|------|--------|-------------------|
| Lead (`CrmLeadFormPage`) | ✅ | Company, Contact, Mobile, Email, Owner, Source, Priority, Stage, Created Date, Notes |
| Contact (`CrmContactFormPage`) | ✅ | Code, Name, Company, Mobile, Email, Designation, Primary |
| Opportunity New (`OpportunityNewPage`) | ✅ | Customer, Contact, Name, Stage, Owner, Priority, Close Date |
| Company / Customer (`CustomerFormPage`) | ✅ | Code, Name, Type, Territory, Status, Primary Contact |
| Sticky footers (system-wide) | ✅ | Defaults off; CSS neutralized |

## Remaining (Phase 4 — use shared components)

| Form | Class | Notes |
|------|-------|-------|
| Opportunity Edit | Standard | Mirror Opportunity New |
| Quotation New | Complex | Header Quick Entry + lines in Additional / below |
| Sales Order Create / Edit | Complex | Same as quotation |
| Proforma | Complex | Same pattern |
| Purchase PR / PO / RFQ | Complex | Header Quick Entry + lines |
| Item / Vendor / Location masters | Standard–Complex | Prefer `ErpFieldRow` + Quick Entry over time |
| Inventory txn pages | Legacy | Not on ErpCard stack yet |
| Production / Quality | Demo lists | No real card forms |

---

## Adoption checklist (future forms)

1. Import `ErpQuickEntrySection`, `ErpAdditionalInfo*`, `ErpFieldRow`, `ErpStickySaveBar`.
2. Put only mandatory / high-frequency fields in Quick Entry (`columns={3}`).
3. Wrap the rest in `ErpAdditionalInfoPanel` (collapsed for new records).
4. Use `ErpStickySaveBar` with default non-sticky footer.
5. Use `ErpButton` semantic variants — do not invent page-local button CSS.
6. On validation failure: focus first invalid field; expand Additional only if the error lives there.

---

## Test evidence (manual)

After conversion verify per form:

- [ ] Create / Edit / Save / Save & New / Save & Close / Cancel
- [ ] Required validation + scroll/focus
- [ ] Additional Information expand/collapse
- [ ] Responsive 3 → 2 → 1 columns
- [ ] No sticky action bar
- [ ] Demo + API mode (where applicable)
