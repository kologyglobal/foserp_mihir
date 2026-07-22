# Payment Account Mapping (Phase 5A1)

> Last verified: **2026-07-19** against `backend/src/modules/accounting/treasury/payment-mappings/`.

Overview: [`BANK_CASH_ARCHITECTURE.md`](BANK_CASH_ARCHITECTURE.md).

## Purpose

`PaymentAccountMapping` routes a `(paymentMethod, useCase, direction, [branchId], [currencyCode])` combination to a `TreasuryAccount` to debit/credit — plus an optional `clearingAccountId` for two-step (clearing/settlement) postings. Phase 5A1 ships **CRUD + a read-only resolve endpoint**; no payment-posting code path calls it yet — see [`BANK_CASH_ARCHITECTURE.md`](BANK_CASH_ARCHITECTURE.md) for what is deferred.

`TreasuryPaymentMethod` is a **dedicated enum**, deliberately separate from `CustomerReceiptPaymentMethod` / `VendorPaymentMethod` (those AR/AP enums are frozen). It carries the same values plus `PAYMENT_GATEWAY` and `DIRECT_DEBIT`; callers translate their own payment-method enum to `TreasuryPaymentMethod` 1:1 by name where they overlap.

## Resolution algorithm (`payment-account-mapping-resolve.service.ts`)

Given `(legalEntityId, paymentMethod, useCase, direction ∈ {RECEIPT, PAYMENT}, [branchId], [currencyCode])`:

1. **Candidate filter** — active mappings matching `paymentMethod` + `useCase` exactly, and `direction ∈ {input.direction, BOTH}`.
2. **Eligibility filter** — a mapping's `branchId`/`currencyCode` must either match the input exactly or be `null` (branch-/currency-agnostic). Mappings that specify a *different* branch or currency are excluded.
3. If exactly one candidate remains, it wins immediately.
4. Otherwise, tie-break in order:
   1. **Specificity score** — exact branch match (+4) + exact currency match (+2) + exact direction match, i.e. not `BOTH` (+1). Highest score wins.
   2. **`priority`** (lower number wins) among score ties.
   3. **`isDefault = true`** among remaining ties.
5. If more than one mapping still ties after all three tie-breaks, resolution is rejected as `409 PAYMENT_ACCOUNT_MAPPING_AMBIGUOUS` rather than guessing.
6. No eligible candidate at all → `404 PAYMENT_ACCOUNT_MAPPING_NO_MATCH`.

This means a branch- and currency-specific mapping always beats a generic fallback mapping for the same method/use case, and a generic fallback still resolves correctly when the specific one's branch/currency doesn't match the request.

## Default-mapping conflict

Creating or updating a mapping with `isDefault = true` is rejected with `409 PAYMENT_ACCOUNT_MAPPING_DEFAULT_CONFLICT` if another **active** mapping already has `isDefault = true` for the same `(legalEntityId, paymentMethod, useCase, direction)` — regardless of branch/currency. `isDefault` is a tie-break signal for the resolver (step 4.3 above), not itself part of the resolution filter.

## Clearing / settlement role

`role = CLEARING` or `role = SETTLEMENT` requires `clearingAccountId` (a second `TreasuryAccount`) — enforced by `PAYMENT_ACCOUNT_MAPPING_CLEARING_ACCOUNT_REQUIRED` (`400`) if omitted. `role = DIRECT_POSTING` / `CHARGE` do not use `clearingAccountId`.

## API

Mounted at `/api/v1/t/:tenantSlug/accounting/treasury/payment-account-mappings`.

| Method & path | Permission | Notes |
|---|---|---|
| `GET /` | `finance.treasury.payment_mapping.view` | Paginated, filterable by `legalEntityId`/`paymentMethod`/`useCase`/`isActive` |
| `POST /` | `finance.treasury.payment_mapping.manage` | |
| `GET /:id` | `finance.treasury.payment_mapping.view` | |
| `PUT /:id` | `finance.treasury.payment_mapping.manage` | Requires `expectedUpdatedAt` |
| `POST /:id/activate` \| `/deactivate` | `finance.treasury.payment_mapping.manage` | Requires `expectedUpdatedAt` |
| `POST /resolve` | `finance.treasury.payment_mapping.view` | Read-only; runs the algorithm above, returns the winning `PaymentAccountMapping` row (not the `TreasuryAccount`) — read its `treasuryAccountId`/`clearingAccountId` |

`/resolve` is mounted before `/:id` in the router so it is never shadowed by the uuid-param route.
