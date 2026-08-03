# Mobile CRM — Business Card Scanner (M3.2)

> **Date:** 2026-08-03  
> **Verdict:** **READY WITH CONDITIONS**

## Goal

Salesperson scans a business card → optional OCR → reviews/edits → duplicate check → creates Lead / Company+Contact / Contact on existing company → original card attached via existing entity attachment API.

## Flow (max 4 screens)

1. **Capture** — Camera or Gallery  
2. **Preview** — Auto crop, rotate, retake  
3. **Review** — Fields + confidence + company suggest + duplicates + save  
4. (navigation to created record)

No auto-create without review.

## Entry points

- CRM Home quick actions  
- FAB → Scan card  
- Leads register  
- Customers register  
- Company detail → Actions → Scan business card (preselects company)

## OCR strategies

| Priority | Source |
|----------|--------|
| 1 | `EXPO_PUBLIC_BUSINESS_CARD_OCR_URL` remote JSON `{ imageBase64 }` → `{ text }` |
| 2 | Optional native `@react-native-ml-kit/text-recognition` in a prebuild/dev client |
| 3 | Manual edit path when OCR fails (image still saved) |

Parser: pure heuristics for English + Indian cards (phones, emails, GSTIN, PIN, company suffixes, designations). Confidence % on each field; `< 75%` highlighted as uncertain.

## Save options (permission-gated)

| Option | Permission |
|--------|------------|
| Create Lead | `crm.lead.create` |
| Create Company + Contact | both create |
| Add Contact to existing company | `crm.contact.create` |
| Save as draft | always (offline queue) |

Uses existing `POST /crm/leads`, `/crm/companies`, `/crm/contacts`, entity attachments (`BUSINESS_CARD`).

## Duplicates

Checks mobile, email, company name, GSTIN against company / contact / lead search results. Offers Open existing / Add contact / Create anyway (explicit ack).

## Offline

Capture + draft fields + local image; sync on reconnect via `business_card` offline draft kind.

## Non-goals (M3.3+)

AI enrichment · LinkedIn lookup · company database lookup · QR cards · i18n address normalization · OCR translation.

## Conditions

1. **Native OCR** works best with ML Kit linked (EAS/prebuild) **or** remote OCR URL configured. Expo Go may only get manual review path unless mock text is set.  
2. Field capture for UAT uses `EXPO_PUBLIC_BUSINESS_CARD_OCR_MOCK_TEXT` multiline fixture.  
3. Device UAT still required for camera hardware matrix.

## Related

- UAT: [`MOBILE_CRM_BUSINESS_CARD_UAT.md`](MOBILE_CRM_BUSINESS_CARD_UAT.md)  
- Paths under `mobile/app/(app)/crm/business-card/`  
- Logic under `mobile/src/features/crm/businessCard/`
