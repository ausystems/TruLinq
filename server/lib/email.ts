/* Transactional email, provider-ready. With RESEND_API_KEY set, mail goes out through Resend; without it the call
   reports delivered: false so callers can say so instead of pretending. */
import type { Env } from '../env.ts';

export interface Mail { to: string; subject: string; text: string }
export interface MailResult { delivered: boolean; reason?: 'email_not_configured' | 'provider_error'; id?: string }

export async function sendEmail(env: Env, mail: Mail): Promise<MailResult> {
  if (!env.RESEND_API_KEY) return { delivered: false, reason: 'email_not_configured' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${env.RESEND_API_KEY}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [mail.to], subject: mail.subject, text: mail.text })
    });
    if (!res.ok) { console.error('[email] provider responded', res.status); return { delivered: false, reason: 'provider_error' }; }
    const data = (await res.json()) as { id?: string };
    return { delivered: true, id: data.id };
  } catch (e) {
    console.error('[email] send failed', (e as Error).message);
    return { delivered: false, reason: 'provider_error' };
  }
}
