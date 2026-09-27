import { randomInt } from 'node:crypto';
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const chunk = (n: number): string => { let s = ''; for (let i = 0; i < n; i++) s += ALPHA[randomInt(ALPHA.length)]; return s; };
/** Human-readable references like TQ-2026-0918-7K2M (verification) or TQ-CT-Q9RD (contact). */
export function reference(prefix: string, now = new Date()): string {
  const d = now.toISOString().slice(0, 10).replace(/-/g, '');
  return `${prefix}-${d.slice(0, 4)}-${d.slice(4)}-${chunk(4)}`;
}
export const shortReference = (prefix: string): string => `${prefix}-${chunk(4)}`;
