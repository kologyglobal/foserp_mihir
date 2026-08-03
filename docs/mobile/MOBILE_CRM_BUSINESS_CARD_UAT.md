# Business Card Scanner UAT (M3.2)

## Prep

1. Backend API + CRM permissions (`crm.lead.create`, `crm.company.create`, `crm.contact.create`).  
2. Optional: configure OCR  
   - `EXPO_PUBLIC_BUSINESS_CARD_OCR_URL`, or  
   - dev client with ML Kit, or  
   - `EXPO_PUBLIC_BUSINESS_CARD_OCR_MOCK_TEXT` for parser/UAT without camera OCR.  
3. `cd mobile && npm install && npx expo start`

## Pass matrix

| # | Case | Pass? |
|---|------|-------|
| 1 | Open scanner from Home / FAB / Leads / Customers / Company actions | |
| 2 | Capture + gallery import | |
| 3 | Auto crop + rotate + retake | |
| 4 | English business card OCR / mock text → fields | |
| 5 | Indian card (GSTIN, 6-digit PIN, +91 mobile) | |
| 6 | Multiple phones + emails | |
| 7 | Uncertain fields highlighted with confidence | |
| 8 | Company type-ahead suggests existing companies | |
| 9 | Duplicate mobile/email/company/GST shows options | |
| 10 | Open existing / Add contact / Create anyway | |
| 11 | Create Lead + BUSINESS_CARD attachment | |
| 12 | Create Company + Contact + attachment | |
| 13 | Add contact to existing company | |
| 14 | Offline draft → reconnect sync | |
| 15 | Hide create options without permission | |
| 16 | Poor image / unreadable → manual edit path | |
| 17 | Tenant isolation (session slug on all APIs) | |

## Sign-off

| Role | Date | Result |
|------|------|--------|
| QA | | |
| Sales pilot | | |
