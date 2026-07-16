-- Allow polymorphic CRM notes/attachments on quotations (CRM-P0-2)

ALTER TABLE `crm_notes` MODIFY `entityType` ENUM('COMPANY', 'CONTACT', 'LEAD', 'OPPORTUNITY', 'ACTIVITY', 'FOLLOW_UP', 'QUOTATION') NOT NULL;
ALTER TABLE `crm_attachments` MODIFY `entityType` ENUM('COMPANY', 'CONTACT', 'LEAD', 'OPPORTUNITY', 'ACTIVITY', 'FOLLOW_UP', 'QUOTATION') NOT NULL;
