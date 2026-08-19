# Mobile — Google Play Store Submission (Native CRM / Expo app)

> **Status:** API-36 fix, app icon/branding, and Privacy Policy page shipped (branch `mobile_1`); Play Console account/listing steps in §4 remain (outside this repo, need a human with Play Console access)
> **Date:** 2026-08-17
> **Scope:** `mobile/` (Native CRM Expo app) only — **not** the `/m` factory-ops web routes, and **not** the new desktop-only work (bins, put-away, store picking, tenant SMTP, SO/PO/invoice email). Those are separate surfaces with no mobile-app change required.

## 1. App identity (fixed values — do not change without a plan)

| Field | Value | Source |
|---|---|---|
| App name | `FOS ERP` | `mobile/app.config.ts` |
| Slug | `fos-erp-mobile` | `mobile/app.config.ts` |
| **Android package name** | **`com.fos.erp.mobile`** | `mobile/app.config.ts` — permanent once uploaded to Play Console; cannot be changed or reused after first release |
| iOS bundle ID | `com.fos.erp.mobile` | `mobile/app.config.ts` |
| Version name | `1.0.0` (`EXPO_PUBLIC_APP_VERSION`) | `mobile/.env` |
| Version code / build number | `1` (`EXPO_PUBLIC_BUILD_NUMBER`) | `mobile/.env` — **must increment on every Play Console upload** |
| Target / compile SDK | `36` (Android 16) | `expo-build-properties` plugin, see §3 |
| Scheme | `fos-erp` | `mobile/app.config.ts` |

## 2. Declared permissions (drives Data Safety + content rating)

| Permission | Declared purpose |
|---|---|
| Camera | Scan warehouse barcodes/QR codes, capture business cards, CRM photos/documents |
| Photo library | Business card import, CRM attachments |
| Microphone | Record CRM voice notes on follow-ups/meetings |

No location, contacts-list, SMS, or background-data permissions are requested.

**App scope reminder:** this app is the **CRM pilot** only — login, leads, companies, follow-ups, quotations/SO. It talks to `/api/v1/t/:tenantSlug/crm/…` and `/auth/*` only. It has no store/admin/warehouse screens, so none of the recently ported desktop features (bins, put-away, store picking, tenant SMTP, document email buttons) require any mobile code change.

## 3. Code changes — `mobile_1` branch (base: `purchase_25`)

**Why:** Google Play requires new app submissions to target **Android 16 (API 36)** starting **31 Aug 2026**. Expo SDK 52 (this project's SDK) defaults to `targetSdkVersion 34`, which was already below Play's prior minimum (API 35, effective Aug 2025) — this would have blocked submission.

**Commit:** `f92188b4` — *"Target Android API 36 for mobile app Play Store submission"*
**Files touched:** `mobile/app.config.ts`, `mobile/package.json`, `mobile/package-lock.json` (3 files, 39 insertions, 0 deletions)

### `mobile/app.config.ts`

```diff
@@ -75,6 +75,18 @@ export default ({ config }: ConfigContext): ExpoConfig => {
           microphonePermission: 'Allow FOS ERP to record CRM voice notes.',
         },
       ],
+      [
+        'expo-build-properties',
+        {
+          // Play Store requires target API 36 (Android 16) for new submissions from
+          // 31 Aug 2026 — SDK 52 defaults to targetSdkVersion 34, so override explicitly.
+          android: {
+            compileSdkVersion: 36,
+            targetSdkVersion: 36,
+            buildToolsVersion: '36.0.0',
+          },
+        },
+      ],
     ],
     experiments: {
       typedRoutes: true,
```

### `mobile/package.json`

```diff
@@ -19,6 +19,7 @@
     "@tanstack/react-query": "^5.66.0",
     "axios": "^1.7.9",
     "expo": "~52.0.46",
+    "expo-build-properties": "~0.13.2",
     "expo-asset": "~11.0.5",
     "expo-av": "~15.0.2",
     "expo-camera": "~16.0.18",
```

`mobile/package-lock.json` — regenerated via `npm install` to lock `expo-build-properties@0.13.2` and its transitive deps (26 lines added, no other package versions touched).

**Verification run at the time of this change:**
- `npm install` in `mobile/` — clean, 2 packages added
- `npm run typecheck` — passes
- `npx expo config --type public` — confirms `compileSdkVersion`/`targetSdkVersion`/`buildToolsVersion` resolve to `36`/`36`/`'36.0.0'` with no plugin errors

**Follow-up before shipping a build:** targeting API 36 makes edge-to-edge display mandatory on Android 16 — do a visual smoke pass on an Android 16 emulator/device after the next `eas build` / `expo run:android` to catch any screen laid out under the status/nav bar.

**Branch status:** pushed to `origin/mobile_1` (tracking). No other in-flight work from `purchase_25` (item master, purchase order, inventory changes) was included — those remain uncommitted on `purchase_25` untouched.

## 3b. App icon / branding assets (shipped)

The app previously used a 1×1px placeholder PNG for `icon.png` / `adaptive-icon.png` / `splash-icon.png` / `favicon.png`. Replaced with a generated "FOS" flat-vector monogram (deep blue `#1e4a8a` → `#2c5eb8`, white + light-cyan mark, gear + bar-chart motif) matching the product's enterprise-software brand tone.

| File | Size | Used for |
|---|---|---|
| `mobile/assets/icon.png` | 1024×1024 | App icon (iOS + Android legacy) |
| `mobile/assets/adaptive-icon.png` | 1024×1024 | Android adaptive icon foreground (`backgroundColor: '#1e4a8a'` set in `app.config.ts` to match) |
| `mobile/assets/splash-icon.png` | 1024×1024 | Launch screen (`splash.backgroundColor` also set to `#1e4a8a` for a seamless full-bleed splash) |
| `mobile/assets/favicon.png` | 196×196 | Web export favicon |
| `docs/mobile/store-assets/icon-512.png` | 512×512 | Play Console **Hi-res icon** upload (App content → Store settings → Main store listing) |
| `docs/mobile/store-assets/feature-graphic-1024x500.png` | 1024×500 | Play Console **Feature graphic** upload |

**Still needed (cannot be generated without a running build):** 2–8 phone screenshots (16:9 or 9:16) captured from a real device/emulator running the app, for the Play Console listing.

## 3c. Privacy Policy page (shipped)

Google Play requires a hosted, publicly reachable Privacy Policy URL for any app requesting Camera/Photos/Microphone or collecting personal data — both apply here.

- **Page added:** `frontend/public/privacy-policy.html` — static, self-contained HTML (no auth, no JS dependency), covers data collected (account, CRM contacts, photos, voice notes), permissions used, retention/deletion, and a contact address.
- **Served at:** the same origin as the FOS ERP web app once the frontend build ships — Vite copies `frontend/public/*` into `frontend/dist/`, and `backend/src/app.ts` serves that directory with `express.static(..., { index: false })` *before* the SPA fallback, so static files are returned verbatim.
  - Production: `https://erp.dhurandharcrm.com/privacy-policy.html`
  - **Action needed:** deploy `purchase_25`/`mobile_1`-adjacent frontend changes to production (or whichever branch is live on `erp.dhurandharcrm.com`) so this path resolves before submitting to Play Console — the URL will 404 until the next frontend deploy.
- **Wired into the app:** `mobile/src/config/env.ts` exposes `env.privacyPolicyUrl` (default `https://erp.dhurandharcrm.com/privacy-policy.html`, overridable via `EXPO_PUBLIC_PRIVACY_POLICY_URL`). A "Privacy Policy" link now opens it from both the **Login screen** footer (reachable pre-auth, which reviewers check) and **Settings → Privacy**.
- **Contact address used in the policy:** `privacy@kology.co` — update `frontend/public/privacy-policy.html` if a different mailbox should be used.

## 4. Play Console checklist (account/content — not code)

### 4a. Account-level gate (check first — longest lead time)

- **Personal developer account created after 13 Nov 2023** → must run a **closed test with ≥12 opted-in testers, continuous for 14 days**, before Production access unlocks. Start in parallel with everything else below.
- **Organization account** (D-U-N-S number) → exempt.

### 4b. Store listing text (draft — ready to paste)

**Short description (≤80 chars):**
> Mobile CRM for FOS ERP — leads, companies, follow-ups, quotes on the go.

**Full description (≤4000 chars):**
> FOS ERP Mobile brings your CRM pipeline to your phone. Log in with your company tenant, and manage:
> - Leads and companies — view, update, and track status
> - Follow-ups — log calls/meetings, attach voice notes and photos
> - Quotations and sales orders — review and progress deals from the field
> - Business card capture — scan a card or barcode to create a contact fast
>
> This is a companion app for FOS ERP customers with an active tenant account. It does not include warehouse, purchasing, or admin functions — those remain on the desktop/web application.

**Category:** Business

### 4c. Compliance forms

| Form | Answer for this app |
|---|---|
| Data Safety — Name/email/phone (CRM contacts) | Collected, app functionality, not shared |
| Data Safety — Photos | Collected, business card/attachment capture, not shared |
| Data Safety — Audio | Collected, follow-up voice notes, not shared |
| Data Safety — Account credentials | Collected, authentication |
| Data Safety — Encryption in transit | Yes (HTTPS enforced — `assertApiConfigured` in `mobile/README.md`) |
| Data Safety — Deletion | Via tenant admin |
| Content rating | Business app, no violence/gambling/public UGC → expect Everyone/PEGI 3 |
| Ads | No ads |
| Target audience | Not designed for children |
| Financial features | No (payments/invoicing/accounting are desktop-only, not in this app) |
| App access (reviewer login) | **Must provide a working demo tenant login** (tenant slug + username + password) in Play Console → App content → App access, or review stalls at the login screen. Default dev tenant slug is `vasant-trailers` (`mobile/.env.example`) — set up a real test user there. |
| Privacy Policy URL | **Ready:** `https://erp.dhurandharcrm.com/privacy-policy.html` (see §3c) — paste into Play Console → App content → Privacy policy once the frontend is redeployed with this change |

### 4d. Assets to prepare

| Asset | Spec | Status |
|---|---|---|
| Hi-res icon | 512×512 PNG | **Ready** — `docs/mobile/store-assets/icon-512.png` |
| Feature graphic | 1024×500 PNG/JPG | **Ready** — `docs/mobile/store-assets/feature-graphic-1024x500.png` |
| Phone screenshots | ≥2 (recommend 4–8), 16:9 or 9:16 | **Pending** — needs a real device/emulator run of the built app |
| Privacy Policy | Hosted URL — mandatory (camera/photo/mic + personal data) | **Ready** — see §3c (pending frontend redeploy) |

## 5. Build & submit

```bash
cd mobile
eas login
eas build --platform android --profile production   # uses mobile/eas.json, produces .aab
```

- First upload: opt into **Play App Signing** in Play Console (Google manages the final signing key; the EAS-managed upload key just signs the upload).
- `mobile/eas.json` `submit.production` is currently empty — no automated `eas submit` wired up. Either upload the `.aab` manually via Play Console for release #1, or configure a Google Cloud service-account JSON key (Play Console → Setup → API access) and set `serviceAccountKeyPath` in `eas.json` to use `eas submit`.

## 6. Explicitly out of scope for this app (confirmed, no change needed)

- CRM login, leads, companies, follow-ups, quotations, sales orders — unchanged, same APIs.
- Approvals / gate / QC / dispatch pick — unaffected (dispatch pick ≠ new store pick list).
- Masters → Email (SMTP) — desktop admin-only, no mobile screen.
- Document email buttons (SO/PO/invoice) — desktop-only.
- Put-away (`/inventory/put-away`), Store picking (`/inventory/picking`), same-warehouse bin-to-bin move — new **desktop** workbenches; only relevant here if store operations are ever added to this app later.
- Web `/m` factory-ops routes (GRN, issue, transfer, QC, dispatch, gate) — a phone-browser shell of the desktop ERP, not a Play Store app; not part of this submission.
