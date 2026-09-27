/* Environment: parsed once, server-only. Nothing here is ever sent to the browser. */
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.string().default('development'),
  DATABASE_URL: z.string().optional(),
  PGLITE_DIR: z.string().default('.data/pglite'),
  ALLOWED_ORIGINS: z.string().default(''),
  ADMIN_EMAILS: z.string().default(''),
  APP_ORIGIN: z.string().default(''),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Trulinq <no-reply@trulinq.com>'),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  SESSION_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  RATE_LIMIT_SALT: z.string().default('trulinq'),
  SIGNUP_REQUIRES_INVITE: z.string().default('true')
});

export type Env = z.infer<typeof schema> & {
  isProd: boolean;
  allowedOrigins: string[];
  adminEmails: string[];
  signupRequiresInvite: boolean;
};

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.parse(source);
  return {
    ...parsed,
    isProd: parsed.NODE_ENV === 'production',
    allowedOrigins: parsed.ALLOWED_ORIGINS.split(',').map((s) => s.trim().replace(/\/$/, '')).filter(Boolean),
    adminEmails: parsed.ADMIN_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    signupRequiresInvite: parsed.SIGNUP_REQUIRES_INVITE !== 'false'
  };
}
