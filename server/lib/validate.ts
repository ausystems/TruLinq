/* Every user-controlled field is validated here, on the server, before it touches a query. */
import { z } from 'zod';

export const INDUSTRIES = ['Consulting', 'Direct sales/service', 'Energy', 'Marketing', 'Real Estate', 'Restaurant', 'Technology'] as const;
export const POST_KINDS = ['Win', 'Hiring', 'Offer', 'Update', 'Ask'] as const;

const trimmed = (max: number, min = 0) => z.string().trim().min(min).max(max);
export const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const password = z.string().min(10, 'Use at least 10 characters.').max(200);
export const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64);
export const uuid = z.string().uuid();
/** Invitation / referral code as typed by a person: "TL-7K2M-Q9RD", "tl7k2mq9rd" or "E9EAF5" all normalise. */
export const referralCodeInput = z.string().trim().min(6).max(24);
const website = z.string().trim().max(200).transform((v) => v.replace(/^https?:\/\//i, '').replace(/\/+$/, '')).refine((v) => !v || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/[^\s]*)?$/i.test(v), 'Enter a website like yourbusiness.com');

export const signupSchema = z.object({
  name: trimmed(80, 2),
  email,
  password,
  code: referralCodeInput.optional(),
  business: trimmed(120).optional(),
  country: trimmed(80).optional(),
  agree: z.boolean().refine((v) => v === true, 'Please agree to continue.')
});
export const loginSchema = z.object({ email, password: z.string().min(1).max(200) });
export const resetRequestSchema = z.object({ email });
export const resetConfirmSchema = z.object({ token: z.string().min(20).max(200), password });

export const profilePatchSchema = z.object({
  name: trimmed(80, 2).optional(),
  headline: trimmed(160).optional(),
  role: trimmed(60).optional(),
  company: trimmed(120).optional(),
  city: trimmed(80).optional(),
  region: trimmed(80).optional(),
  country: trimmed(80).optional(),
  industry: z.enum(INDUSTRIES).or(z.literal('')).optional(),
  bio: trimmed(600).optional(),
  offers: trimmed(200).optional(),
  looking: trimmed(200).optional(),
  website: website.optional(),
  founded: z.coerce.number().int().min(1800).max(2100).nullable().optional(),
  visibility: z.enum(['public', 'private']).optional()
}).strict();

export const memberListSchema = z.object({
  q: z.string().trim().max(80).optional(),
  industry: z.string().trim().max(40).optional(),
  sort: z.enum(['newest', 'score', 'az']).default('newest'),
  status: z.enum(['verified', 'all']).default('verified'),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(50)
});

export const verificationSubmitSchema = z.object({
  identity: z.object({
    first: trimmed(60, 1),
    last: trimmed(60, 1),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date.').refine((d) => { const age = (Date.now() - new Date(d + 'T00:00:00Z').getTime()) / 31557600000; return age >= 18 && age < 120; }, 'You must be 18 or older.'),
    country: trimmed(80, 2),
    idType: z.enum(['Passport', 'Driver’s licence', 'National ID'])
  }),
  business: z.object({
    name: trimmed(120, 2),
    registration: trimmed(60, 4),
    registeredIn: trimmed(80, 2),
    website: website.optional().default(''),
    industry: z.enum(INDUSTRIES),
    role: trimmed(60, 2),
    authorised: z.boolean().refine((v) => v === true, 'Confirm you are authorised to represent this business.')
  }),
  terms: z.boolean().refine((v) => v === true, 'Accept the terms to continue.'),
  documentId: uuid.optional()
});

export const postSchema = z.object({ kind: z.enum(POST_KINDS), body: trimmed(2000, 1) });
export const messageSchema = z.object({ body: trimmed(2000, 1) });
export const endorsementSchema = z.object({ body: trimmed(600, 10) });
export const feedQuerySchema = z.object({ kind: z.enum(POST_KINDS).optional(), before: z.string().datetime({ offset: true }).optional(), limit: z.coerce.number().int().min(1).max(50).default(20) });

export const contactSchema = z.object({
  topic: z.enum(['support', 'fraud', 'privacy', 'enterprise']),
  name: trimmed(80, 2),
  email,
  message: trimmed(4000, 8),
  profile: trimmed(300).optional(),
  copy: z.boolean().default(false)
});
export const reportSchema = z.object({ link: trimmed(300, 4), details: trimmed(4000, 8), email: email.optional().or(z.literal('')) });
export const newsletterSchema = z.object({ email });

export const decisionSchema = z.object({ decision: z.enum(['approve', 'reject', 'in_review']), note: trimmed(2000).optional(), websiteVerified: z.boolean().optional() });
export const memberStatusSchema = z.object({ status: z.enum(['unverified', 'pending', 'verified', 'revoked']), note: trimmed(2000).optional() });

export type SignupInput = z.infer<typeof signupSchema>;
export type ProfilePatch = z.infer<typeof profilePatchSchema>;
export type VerificationSubmit = z.infer<typeof verificationSubmitSchema>;
