import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function writeAudit({
  userId,
  action,
  entity,
  entityId,
  diff,
}: {
  userId: string | null;
  action: string;
  entity: string;
  entityId?: string;
  diff?: Record<string, unknown>;
}) {
  await db.insert(auditLog).values({
    userId,
    action,
    entity,
    entityId: entityId ?? null,
    diff: diff ?? null,
  });
}
