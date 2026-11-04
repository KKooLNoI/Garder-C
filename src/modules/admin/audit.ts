import type { Prisma } from "@prisma/client";

/** Writes an audit entry using the caller's transaction so the log and the change commit together. */
export function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Prisma.InputJsonValue,
) {
  // Never put secrets (passwords, tokens) in metadata.
  return tx.auditLog.create({ data: { actorId, action, entityType, entityId, metadata } });
}
