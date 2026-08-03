-- Knowledge Base / OpenKB Wave 1 foundation tables (tenant-scoped)

CREATE TABLE `knowledge_categories` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `code` VARCHAR(64) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `knowledge_categories_tenantId_code_key`(`tenantId`, `code`),
    INDEX `knowledge_categories_tenantId_idx`(`tenantId`),
    INDEX `knowledge_categories_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `knowledge_categories_tenantId_parentId_idx`(`tenantId`, `parentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `knowledge_tags` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `slug` VARCHAR(120) NOT NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `knowledge_tags_tenantId_slug_key`(`tenantId`, `slug`),
    INDEX `knowledge_tags_tenantId_idx`(`tenantId`),
    INDEX `knowledge_tags_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `knowledge_sources` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `sourceType` ENUM('MANUAL', 'URL', 'UPLOAD', 'ERP_MODULE', 'OPENKB') NOT NULL DEFAULT 'MANUAL',
    `baseUrl` VARCHAR(1000) NULL,
    `configJson` JSON NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastSyncAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `knowledge_sources_tenantId_idx`(`tenantId`),
    INDEX `knowledge_sources_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `knowledge_sources_tenantId_sourceType_idx`(`tenantId`, `sourceType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `knowledge_documents` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NULL,
    `sourceId` VARCHAR(191) NULL,
    `title` VARCHAR(500) NOT NULL,
    `description` TEXT NULL,
    `kind` ENUM('UPLOAD', 'URL', 'HTML', 'MARKDOWN', 'TEXT', 'ERP_LINK') NOT NULL DEFAULT 'UPLOAD',
    `status` ENUM('DRAFT', 'PROCESSING', 'READY', 'FAILED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    `mimeType` VARCHAR(128) NULL,
    `originalFilename` VARCHAR(500) NULL,
    `storageKey` VARCHAR(500) NULL,
    `fileSize` INTEGER NOT NULL DEFAULT 0,
    `sourceUrl` VARCHAR(2000) NULL,
    `language` VARCHAR(16) NULL,
    `currentVersionId` VARCHAR(191) NULL,
    `ownerUserId` VARCHAR(191) NULL,
    `indexingError` TEXT NULL,
    `indexedAt` DATETIME(3) NULL,
    `publishedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(191) NULL,
    `updatedBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `knowledge_documents_tenantId_idx`(`tenantId`),
    INDEX `knowledge_documents_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `knowledge_documents_tenantId_status_idx`(`tenantId`, `status`),
    INDEX `knowledge_documents_tenantId_categoryId_idx`(`tenantId`, `categoryId`),
    INDEX `knowledge_documents_tenantId_ownerUserId_idx`(`tenantId`, `ownerUserId`),
    INDEX `knowledge_documents_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `knowledge_versions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `versionNo` INTEGER NOT NULL,
    `markdownContent` LONGTEXT NULL,
    `contentHash` VARCHAR(64) NULL,
    `changeSummary` VARCHAR(500) NULL,
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `knowledge_versions_tenantId_documentId_versionNo_key`(`tenantId`, `documentId`, `versionNo`),
    INDEX `knowledge_versions_tenantId_idx`(`tenantId`),
    INDEX `knowledge_versions_tenantId_documentId_idx`(`tenantId`, `documentId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `knowledge_chunks` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `versionId` VARCHAR(191) NULL,
    `chunkIndex` INTEGER NOT NULL,
    `headingPath` VARCHAR(500) NULL,
    `contentMd` LONGTEXT NOT NULL,
    `tokenCount` INTEGER NULL,
    `charStart` INTEGER NULL,
    `charEnd` INTEGER NULL,
    `metadataJson` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `knowledge_chunks_tenantId_documentId_chunkIndex_key`(`tenantId`, `documentId`, `chunkIndex`),
    INDEX `knowledge_chunks_tenantId_idx`(`tenantId`),
    INDEX `knowledge_chunks_tenantId_documentId_idx`(`tenantId`, `documentId`),
    INDEX `knowledge_chunks_tenantId_versionId_idx`(`tenantId`, `versionId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `knowledge_embeddings` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `chunkId` VARCHAR(191) NOT NULL,
    `modelId` VARCHAR(120) NOT NULL,
    `dimensions` INTEGER NOT NULL,
    `vectorJson` JSON NOT NULL,
    `contentHash` VARCHAR(64) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `knowledge_embeddings_tenantId_chunkId_modelId_key`(`tenantId`, `chunkId`, `modelId`),
    INDEX `knowledge_embeddings_tenantId_idx`(`tenantId`),
    INDEX `knowledge_embeddings_tenantId_modelId_idx`(`tenantId`, `modelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `knowledge_document_tags` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NOT NULL,
    `tagId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `knowledge_document_tags_tenantId_documentId_tagId_key`(`tenantId`, `documentId`, `tagId`),
    INDEX `knowledge_document_tags_tenantId_idx`(`tenantId`),
    INDEX `knowledge_document_tags_tenantId_tagId_idx`(`tenantId`, `tagId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `knowledge_chat_sessions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `title` VARCHAR(300) NULL,
    `contextJson` JSON NULL,
    `lastMessageAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    INDEX `knowledge_chat_sessions_tenantId_idx`(`tenantId`),
    INDEX `knowledge_chat_sessions_tenantId_userId_idx`(`tenantId`, `userId`),
    INDEX `knowledge_chat_sessions_tenantId_deletedAt_idx`(`tenantId`, `deletedAt`),
    INDEX `knowledge_chat_sessions_tenantId_lastMessageAt_idx`(`tenantId`, `lastMessageAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `knowledge_chat_history` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `sessionId` VARCHAR(191) NOT NULL,
    `role` ENUM('USER', 'ASSISTANT', 'SYSTEM') NOT NULL,
    `content` LONGTEXT NOT NULL,
    `citationsJson` JSON NULL,
    `modelId` VARCHAR(120) NULL,
    `tokenIn` INTEGER NULL,
    `tokenOut` INTEGER NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `knowledge_chat_history_tenantId_idx`(`tenantId`),
    INDEX `knowledge_chat_history_tenantId_sessionId_idx`(`tenantId`, `sessionId`),
    INDEX `knowledge_chat_history_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `knowledge_feedback` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `sessionId` VARCHAR(191) NULL,
    `messageId` VARCHAR(191) NULL,
    `documentId` VARCHAR(191) NULL,
    `rating` ENUM('UP', 'DOWN', 'SCORE') NOT NULL DEFAULT 'UP',
    `score` INTEGER NULL,
    `comment` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `knowledge_feedback_tenantId_idx`(`tenantId`),
    INDEX `knowledge_feedback_tenantId_sessionId_idx`(`tenantId`, `sessionId`),
    INDEX `knowledge_feedback_tenantId_documentId_idx`(`tenantId`, `documentId`),
    INDEX `knowledge_feedback_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `knowledge_permissions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `documentId` VARCHAR(191) NULL,
    `categoryId` VARCHAR(191) NULL,
    `principalType` ENUM('USER', 'ROLE', 'ALL_TENANT') NOT NULL,
    `principalId` VARCHAR(64) NULL,
    `action` ENUM('VIEW', 'EDIT', 'ADMIN', 'CHAT') NOT NULL DEFAULT 'VIEW',
    `createdBy` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `knowledge_permissions_tenantId_idx`(`tenantId`),
    INDEX `knowledge_permissions_tenantId_documentId_idx`(`tenantId`, `documentId`),
    INDEX `knowledge_permissions_tenantId_principalType_principalId_idx`(`tenantId`, `principalType`, `principalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `knowledge_activity_logs` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `action` VARCHAR(64) NOT NULL,
    `entityType` VARCHAR(64) NULL,
    `entityId` VARCHAR(191) NULL,
    `message` VARCHAR(500) NULL,
    `metaJson` JSON NULL,
    `ipAddress` VARCHAR(64) NULL,
    `userAgent` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `knowledge_activity_logs_tenantId_idx`(`tenantId`),
    INDEX `knowledge_activity_logs_tenantId_action_idx`(`tenantId`, `action`),
    INDEX `knowledge_activity_logs_tenantId_entityType_entityId_idx`(`tenantId`, `entityType`, `entityId`),
    INDEX `knowledge_activity_logs_tenantId_createdAt_idx`(`tenantId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Foreign keys
ALTER TABLE `knowledge_categories` ADD CONSTRAINT `knowledge_categories_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `knowledge_categories` ADD CONSTRAINT `knowledge_categories_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `knowledge_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `knowledge_tags` ADD CONSTRAINT `knowledge_tags_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `knowledge_sources` ADD CONSTRAINT `knowledge_sources_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `knowledge_documents` ADD CONSTRAINT `knowledge_documents_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `knowledge_documents` ADD CONSTRAINT `knowledge_documents_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `knowledge_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `knowledge_documents` ADD CONSTRAINT `knowledge_documents_sourceId_fkey` FOREIGN KEY (`sourceId`) REFERENCES `knowledge_sources`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `knowledge_versions` ADD CONSTRAINT `knowledge_versions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `knowledge_versions` ADD CONSTRAINT `knowledge_versions_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `knowledge_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `knowledge_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_versionId_fkey` FOREIGN KEY (`versionId`) REFERENCES `knowledge_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `knowledge_embeddings` ADD CONSTRAINT `knowledge_embeddings_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `knowledge_embeddings` ADD CONSTRAINT `knowledge_embeddings_chunkId_fkey` FOREIGN KEY (`chunkId`) REFERENCES `knowledge_chunks`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `knowledge_document_tags` ADD CONSTRAINT `knowledge_document_tags_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `knowledge_document_tags` ADD CONSTRAINT `knowledge_document_tags_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `knowledge_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `knowledge_document_tags` ADD CONSTRAINT `knowledge_document_tags_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `knowledge_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `knowledge_chat_sessions` ADD CONSTRAINT `knowledge_chat_sessions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `knowledge_chat_history` ADD CONSTRAINT `knowledge_chat_history_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `knowledge_chat_history` ADD CONSTRAINT `knowledge_chat_history_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `knowledge_chat_sessions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `knowledge_feedback` ADD CONSTRAINT `knowledge_feedback_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `knowledge_feedback` ADD CONSTRAINT `knowledge_feedback_sessionId_fkey` FOREIGN KEY (`sessionId`) REFERENCES `knowledge_chat_sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `knowledge_feedback` ADD CONSTRAINT `knowledge_feedback_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `knowledge_chat_history`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `knowledge_feedback` ADD CONSTRAINT `knowledge_feedback_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `knowledge_documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE `knowledge_permissions` ADD CONSTRAINT `knowledge_permissions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `knowledge_permissions` ADD CONSTRAINT `knowledge_permissions_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `knowledge_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `knowledge_activity_logs` ADD CONSTRAINT `knowledge_activity_logs_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `tenants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
