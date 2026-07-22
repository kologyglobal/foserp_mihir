# Delivery Challan PDF / Document Rules

## Engine (Phase 7C4)

- Document generation stores **immutable HTML** on the Challan (`documentHtml`, `documentGenStatus`)
- Endpoints: `/preview`, `/pdf`, `generate-draft-preview`
- Browser print / “Save as PDF” is the pilot print path
- Binary PDF (puppeteer/pdfkit) is **deferred** — do not claim a separate binary file store unless added later

## Draft vs Issued

| | Draft | Issued |
|--|-------|--------|
| Watermark | `DRAFT — NOT ISSUED` | None |
| Number | Draft label | Official `DC-…` |
| Mutability | Regenerable | Stored snapshot only |

## Content (configurable fields)

Header: legal entity, title Delivery Challan, number, dates  
Customer: bill-to / ship-to / destination / GSTIN  
References: SO(s), Dispatch, Packing Session, Packages  
Items: code, description, HSN, qty, UOM, package/lot/serial summary  
Transport: mode, transporter, vehicle, LR/GR, **manual** e-Way Bill reference  
Totals: qty, packages, gross/net weight  
Footer: remarks, terms, prepared/approved/issued, generated timestamp

## Forbidden on document

- Tax calculation / taxable invoice totals as accounting
- Claiming e-Way Bill “Verified”
- Claiming statutory certification
- Silent HTML preview presented as a different official PDF identity

## Failure handling

Statuses: `NOT_GENERATED` → `GENERATING` → `GENERATED` | `FAILED`  
Retry must not allocate a new challan number.
