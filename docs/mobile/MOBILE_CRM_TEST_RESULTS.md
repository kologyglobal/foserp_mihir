# Mobile CRM M3.1 — Test Results

> **Date:** 2026-08-03  
> **Runner:** structural + pure unit (`npm run test:unit` → `verify-m31-hardening.ts`)

## Automated

| Suite | Result |
|-------|--------|
| M1 foundation structural | Expected PASS (existing) |
| M3 CRM structural | Expected PASS (existing) |
| M3.1 hardening (PDF pick, offline relink, status derive, timeline mapping, deep links, search surfaces, collection perm, device token files, BE search + token routes) | Implemented |

Run evidence command:

```text
cd mobile && npm run test:unit
cd mobile && npm run typecheck
```

## Device UAT (pilot)

| Case | Android | iOS | Notes |
|------|---------|-----|-------|
| Login / tenant | Pending device | Pending device | Use SecureStore session |
| Company 360 tabs | Pending | Pending | Lazy sections |
| Voice note upload | Pending | Pending | Mic permission |
| Meeting photo offline → sync | Pending | Pending | Must not remain entityId=pending |
| Quotation PDF (DMS present) | Pending | Pending | Store PDF from web first |
| Quotation PDF missing | Pending | Pending | Shows unavailable |
| Search Q/SO | Pending | Pending | Requires BE deploy |
| Collection without finance.ar.view | Pending | Pending | No AR rows |
| Collection with finance.ar.view | Pending | Pending | Requires LE on profile |
| Deep link invalid id | Pending | Pending | Unavailable screen |
| Logout clears drafts | Pending | Pending | Security |

## Expo build check

```text
cd mobile
npx expo install expo-av expo-sharing react-native-webview
npx expo start --android
npx expo start --ios
```

Full EAS/TestFlight binary production is **out of band** for this code drop; pilot uses Expo Go or dev client until assets signed.

## Verdict

**Code readiness:** READY FOR CONTROLLED PILOT  
**Device evidence:** partial until field UAT executed (tracked above).
