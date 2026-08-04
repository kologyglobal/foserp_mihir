# Mobile CRM UAT checklist (M3 + M3.1)

## Environment

1. Backend reachable from device (`EXPO_PUBLIC_API_BASE_URL`).
2. Deploy Prisma migration `20260803140000_mobile_device_tokens`.
3. User with CRM permissions; optional AR user with `finance.ar.view` + legal entity.
4. For PDF tests: save at least one quotation PDF attachment (quotation_pdf) from web.

## Pass criteria

| # | Scenario | Android | iOS | Pass? |
|---|----------|---------|-----|-------|
| 1 | Login / restore session / logout | | | |
| 2 | Tenant path preserved on all CRM calls | | | |
| 3 | Lead create | | | |
| 4 | Company 360 header + tabs | | | |
| 5 | Call / WhatsApp / Email / Map links | | | |
| 6 | Follow-up create / complete / reschedule | | | |
| 7 | Meeting with photo (online) | | | |
| 8 | Voice note record → attach → uploaded | | | |
| 9 | Offline meeting + photo → reconnect → attachments on real entity id | | | |
| 10 | Offline draft statuses + retry | | | |
| 11 | Quotation View PDF (available + unavailable) | | | |
| 12 | Quotation approve + convert to SO | | | |
| 13 | Sales order view + PDF attempt | | | |
| 14 | Search groups lead/company/contact/opp/Q/SO | | | |
| 15 | Collection without AR permission hides invoices | | | |
| 16 | Collection with AR permission shows summaries | | | |
| 17 | Deep link open lead/company/quote; invalid → Unavailable | | | |
| 18 | Logout clears offline drafts; tokens leave SecureStore | | | |
| 19 | Swipe Call/WhatsApp/Open on leads | | | |
| 20 | Session refresh mid-use | | | |

## Security spot checks

- [ ] JWT/refresh only in SecureStore (not AsyncStorage logs)
- [ ] No base64 audio/photo dumped to console
- [ ] Temp voice files removed after successful online upload
- [ ] Tenant slug always from session path

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| QA | | | |
| Sales pilot lead | | | |
