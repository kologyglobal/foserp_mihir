# Standing Instructions (Phase 5B3)

Recurring bank-originated patterns (EMI, subscriptions, recurring interest) modelled as **`StandingInstruction`** + immutable **`StandingInstructionExecution`**.

## Rules

- Generate **DRAFT** `TreasuryAdjustment` only via `POST …/standing-instructions/generate-due-drafts`.
- Never auto-approve or auto-post.
- Generation is idempotent per due date / instruction (duplicate executions blocked).
- Execution history is never deleted.

## Frontend

`/accounting/bank-cash/standing-instructions` — list / create / detail with Activate / Pause / Resume / Cancel / Generate Due Drafts.
