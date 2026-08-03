# Mobile CRM Hardening — Phase M3.1

> **Date:** 2026-08-03  
> **Verdict:** **READY FOR CONTROLLED PILOT**  
> Prior M3: READY WITH CONDITIONS

## Goal

Move native CRM Mobile from pilot-blocked gaps to a controlled field pilot, without rebuilding CRM or adding purchase/ops modules.

## What shipped

| Area | Change |
|------|--------|
| **Native PDF** | `/(app)/crm/pdf/[entityType]/[entityId]` downloads server attachment PDF (quotation_pdf DMS) via authenticated download; WebView + Share. Never generates PDF on device. |
| **Voice notes** | `expo-av` recorder (Record→Stop→Preview→Attach) on Lead/Company notes and Meeting create; uploads via entity attachment API as `VOICE_NOTE`. |
| **Offline attachment sync** | Compound drafts: create parent entity first, then upload attachments; status Pending / Syncing / Partially Synced / Failed / Synced; `clientKey` dedupe; never leave `entityId=pending` after parent sync; retry; clear on logout/tenant switch. |
| **Company 360** | Flagship company detail: header fields, quick actions, lazy tabs (Overview…Notes), commercial outstanding when permitted. |
| **Unified timeline** | `buildUnifiedTimeline` maps activities, FU, notes, files, quotations/approvals, SO, payments. |
| **Contextual actions** | Bottom sheets on Lead / Company / Quotation / Follow-up. |
| **Swipe actions** | Leads, Follow-ups, Tasks (non-destructive without outcome confirm). |
| **Search** | Backend search includes quotations + sales orders; mobile groups results; bounded fallback list search. |
| **Collection** | AR customer summaries when `finance.ar.view`; otherwise CRM company balances only (no sensitive AR for sales-only). |
| **Push foundation** | `MobileDeviceToken` model + `POST/DELETE /mobile/device-tokens`; mobile `registerDeviceToken` / `removeDeviceToken` / `handleNotificationDeepLink`. **No push delivery engine.** |
| **Deep links** | `fos-erp://crm/…` router + `/crm/unavailable` safe screen. |
| **Security** | SecureStore unchanged; no media body logging; temp file cleanup after successful upload; offline drafts cleared on logout/tenant switch. |

## PDF gap (honest)

CRM does **not** have a server-side “generate quotation PDF” endpoint (web generates client-side). Mobile reuses **entity attachment download** when a PDF was stored (e.g. DMS `quotation_pdf`). If none exists, UI shows **PDF unavailable**.

## Explicit non-goals (held)

Purchase · Store · Inventory · Gate · AI transcription · business card OCR · nearby routing · full push delivery · calendar sync.

## Tests

```bash
cd mobile
npm run typecheck
npm run test:unit   # includes verify-m31-hardening.ts
```

Device UAT checklist: `MOBILE_CRM_UAT.md` · results: `MOBILE_CRM_TEST_RESULTS.md`.

## Controlled pilot gates

1. Deploy migration `20260803140000_mobile_device_tokens`.
2. Device Android + iOS against real tenant API.
3. Export quotation PDF to DMS from web for pilot quotes that sales will open on mobile.
4. Users with AR collection needs: grant `finance.ar.view` + legal entity on profile.
