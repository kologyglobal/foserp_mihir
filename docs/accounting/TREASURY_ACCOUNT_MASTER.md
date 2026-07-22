# Treasury Account Master (Phase 5A1)

> Last verified: **2026-07-19** against `backend/src/modules/accounting/treasury/accounts/` and `treasury-account-security.service.ts`.

Overview: [`BANK_CASH_ARCHITECTURE.md`](BANK_CASH_ARCHITECTURE.md).

## Model

`TreasuryAccount` (one row per bank account / cash location / clearing account), with a 1:1 optional profile:

| `accountType` | Profile | GL account rule (`Account.accountType` / `.category`) |
|---|---|---|
| `BANK` | `TreasuryBankProfile` (required at create) | `accountType = BANK`, `category = ASSET` |
| `CASH` | `TreasuryCashProfile` (optional) | `accountType = CASH`, `category = ASSET` |
| `CLEARING` | none | `accountType ∈ {BANK, CASH, GENERAL}`, `category ∈ {ASSET, LIABILITY}` |

GL account must also be a non-group, active, postable account (`assertAccountForMapping` — same helper used by AP/AR default mappings).

Status lifecycle: `ACTIVE → INACTIVE ⇄ ACTIVE`, and `INACTIVE → CLOSED` (one-way; a closed account cannot be reactivated). Attempting to close an `ACTIVE` account is rejected — deactivate first.

## One active GL mapping per account

At most one `ACTIVE` `TreasuryAccount` may reference a given `glAccountId` per tenant + legal entity. This is **enforced in `treasury-account.service.ts`** (checked before insert/update and again on re-activation), not by a DB constraint, because `INACTIVE`/`CLOSED` rows must be allowed to keep the historical GL reference. Violating it returns `409 TREASURY_ACCOUNT_GL_MAPPING_CONFLICT`.

## Bank account number security

`treasury-account-security.service.ts` is the only place that ever touches a raw account number:

1. **Masking** — always computed: `last4` (last 4 digits) and `masked` (`XXXXXXXX1234`). Both are safe to store and return.
2. **Hashing** — HMAC-SHA256 over `tenantId|legalEntityId|normalizedNumber`, keyed by `TREASURY_ACCOUNT_HMAC_SECRET` (falls back to `FIELD_ENCRYPTION_KEY` if that is the only secret configured). Used only for the `@@unique([tenantId, legalEntityId, accountNumberHash])` duplicate check (`treas_bank_prof_hash_key`) — **never returned by any API response**.
3. **Encryption** — AES-256-GCM, only if `FIELD_ENCRYPTION_KEY` is configured (32 bytes, base64 or hex; any other non-empty string is deterministically derived into a 32-byte key via SHA-256 so encryption still works, just without a documented key format). Write-only; `decryptAccountNumber` exists for future internal use but is never wired to a controller.
4. **No secret configured** → creating/updating a bank profile **with** an `accountNumber` is rejected with `422 TREASURY_BANK_ACCOUNT_SECURITY_UNAVAILABLE`. Creating the account **without** an `accountNumber` still succeeds — a bank account can exist before its number is captured.

Duplicate account number (same tenant + legal entity, any bank account) → `409 TREASURY_BANK_ACCOUNT_DUPLICATE_NUMBER`.

`redactTreasurySensitiveFields()` strips `accountNumber`, `accountNumberEncrypted`, `accountNumberHash`, `iban` from any object before it is logged or audited — used when writing `AuditLog.newValues`/`oldValues` for treasury accounts.

## API

All routes require `authenticate` + tenant resolution + the listed permission; mounted at `/api/v1/t/:tenantSlug/accounting/treasury/accounts`.

| Method & path | Permission | Notes |
|---|---|---|
| `GET /` | `finance.treasury.account.view` | Paginated; requires `legalEntityId` query param |
| `POST /` | `finance.treasury.account.create` | `bankProfile` required for `BANK`, forbidden otherwise; `cashProfile` only for `CASH` |
| `GET /:id` | `finance.treasury.account.view` | 404 if not in caller's tenant |
| `PUT /:id` | `finance.treasury.account.edit` | Requires `expectedUpdatedAt` (optimistic concurrency) |
| `POST /:id/activate` | `finance.treasury.account.activate` | No-op if already `ACTIVE`; rejects `CLOSED` |
| `POST /:id/deactivate` | `finance.treasury.account.deactivate` | Optional `reason` |
| `POST /:id/close` | `finance.treasury.account.close` | Only from `INACTIVE`; optional `reason` |

Concurrency conflicts return `409 TREASURY_ACCOUNT_STALE_VERSION`.

Money fields (`overdraftLimit`, `imprestLimit`) are always returned as fixed 4-decimal strings (`formatForPersistence`), matching the rest of the finance API.
