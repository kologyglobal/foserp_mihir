-- Prisma 1:1 requires unique on the FK field itself (composite tenant+ob is not enough).
CREATE UNIQUE INDEX `dsp_pod_ob_uidx` ON `dispatch_proofs_of_delivery`(`outboundDispatchId`);
