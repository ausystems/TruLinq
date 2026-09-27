/* Trust-related state changes leave a row here. Never passwords, tokens, documents or raw IPs. */
import type { Queryable } from '../db/client.ts';

export interface AuditEvent { action: string; subjectType: string; subjectId: string; actorUserId?: string | null; actorMemberId?: string | null; data?: Record<string, unknown>; ipHash?: string | null }
export async function audit(db: Queryable, e: AuditEvent): Promise<void> {
  await db.query(
    `insert into audit_events (actor_user_id, actor_member_id, action, subject_type, subject_id, data, ip_hash) values ($1, $2, $3, $4, $5, $6::jsonb, $7)`,
    [e.actorUserId ?? null, e.actorMemberId ?? null, e.action, e.subjectType, e.subjectId, JSON.stringify(e.data ?? {}), e.ipHash ?? null]);
}
