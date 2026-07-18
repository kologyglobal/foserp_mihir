-- Phase 3A5: AR reporting query indexes (additive only)

CREATE INDEX `receivable_open_items_tenant_le_status_due_idx`
  ON `receivable_open_items`(`tenantId`, `legalEntityId`, `status`, `dueDate`);

CREATE INDEX `receivable_open_items_tenant_le_customer_status_idx`
  ON `receivable_open_items`(`tenantId`, `legalEntityId`, `customerId`, `status`);

CREATE INDEX `receivable_open_items_tenant_le_recv_acct_status_idx`
  ON `receivable_open_items`(`tenantId`, `legalEntityId`, `receivableAccountId`, `status`);

CREATE INDEX `general_ledger_entries_tenant_le_account_posting_idx`
  ON `general_ledger_entries`(`tenantId`, `legalEntityId`, `accountId`, `postingDate`);
