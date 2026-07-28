# IndiaMART Go-Live (config + UAT — not a rebuild)

Phases 1–5 are already shipped. This runbook only covers **encryption → Pull key → Test connection → UAT**.

## Prerequisites

| Check | How |
|-------|-----|
| Migrations | `npx tsx scripts/prisma-cli.ts migrate deploy` — need `20260724120000_indiamart_*` + `20260724140000_indiamart_push_alerts` |
| API mode FE | `VITE_USE_API=true` |
| Permissions | User has `crm.indiamart.settings.manage` + `crm.indiamart.credentials.manage` (+ `sync.run` for Sync) |
| Encryption | `FIELD_ENCRYPTION_KEY` in `backend/.env` (32-byte base64 **or** hex **or** any string hashed to AES-256) |

### Generate `FIELD_ENCRYPTION_KEY` (local / UAT)

```powershell
# PowerShell — 32 random bytes as base64
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 } | ForEach-Object { [byte]$_ }))
```

```bash
# bash / openssl
openssl rand -base64 32
```

Add to `backend/.env` (never commit):

```env
FIELD_ENCRYPTION_KEY=<paste>
```

**Restart the API** after changing the key. Rotating the key invalidates already-encrypted Pull credentials (re-paste the key in Settings).

### Readiness script

```bash
cd backend
npx tsx scripts/indiamart-golive-check.ts --tenant=vasant-trailers
```

Prints encryption status, table presence, and connection row state — **no secrets**.

## Pull API key (live)

1. seller.indiamart.com → **Lead Manager** → **CRM / Pull API** → generate / copy `glusr_crm_key`
2. FOS: **CRM → IndiaMART → Settings**
3. Paste into **Pull API key**, optional registered mobile/email, **Save settings**
4. Click **Test connection**
   - Success includes CODE 204 (no leads in window) — still valid
   - Failure → status `EXPIRED` / `CONNECTION_FAILED`; fix key or IndiaMART account
5. Enable **scheduled sync** (15 min default; IndiaMART min hit interval 5 min)
6. **Initial import** (e.g. 7 days) or **Sync now**
7. Verify **Inbox** → create/link lead → **Imported Leads** / Lead 360

Default Pull: `https://mapi.indiamart.com/wservce/crm/crmListing/v2/` with query param `glusr_crm_key`.

## Optional Push webhook

1. Settings → **Enable Push webhook** → copy URL once
2. Register URL in IndiaMART Push API settings
3. Confirm FOS returns **HTTP 200** on accept (avoids IndiaMART deactivating Push after ~48h of non-200)

Public path: `POST /api/v1/webhooks/indiamart/:tenantSlug/:webhookToken`

## UAT checklist

- [ ] `FIELD_ENCRYPTION_KEY` set; Settings banner for missing encryption is gone
- [ ] Pull key saved; masked key shown; Test connection **ok**
- [ ] Initial import or Sync now creates enquiries (`UNIQUE_QUERY_ID` idempotent)
- [ ] Duplicate enquiry does not double-create CRM lead (per duplicate behaviour)
- [ ] Auto-create lead + optional follow-up when enabled
- [ ] Product mapping (if used) resolves product name → item
- [ ] Dashboard KPIs / alerts load
- [ ] (Optional) Push webhook delivers a test lead; sync run `triggerType=PUSH`
- [ ] Scheduler: with `syncEnabled`, a due run appears in Sync History

## Out of scope (not go-live blockers)

- Lead 360 FactBox deep-link polish
- Queue-backed multi-instance sync lock
- Rebuilding Pull/Push modules

## Related

- Architecture / API contract: [`INDIAMART_INTEGRATION.md`](./INDIAMART_INTEGRATION.md)
- Env template: `backend/.env.example` (`FIELD_ENCRYPTION_KEY`)
