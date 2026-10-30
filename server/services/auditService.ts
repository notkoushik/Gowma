import { prisma } from "../prisma.ts"

export type AuditActor = { userId?: string | null; name: string; role: string }

/**
 * Appends a line to the money audit log. It never blocks or fails the action it describes:
 * if the log table is not there yet, the line goes to the server log instead.
 */
export async function audit(
  actor: AuditActor,
  action: string,
  targetType: string,
  targetId?: string | null,
  details?: Record<string, unknown>,
) {
  try {
    await prisma.walletAuditLog.create({
      data: {
        actorId: actor.userId ?? null,
        actorName: actor.name,
        actorRole: actor.role,
        action,
        targetType,
        targetId: targetId ?? null,
        details: details ? (JSON.parse(JSON.stringify(details)) as any) : undefined,
      },
    })
  } catch (err: any) {
    console.warn(`[audit] ${action} ${targetType}:${targetId ?? "-"} by ${actor.name} (${actor.role}) not saved: ${String(err?.message || err).split("\n").pop()}`)
  }
}

export const SYSTEM_ACTOR: AuditActor = { userId: null, name: "System", role: "system" }
