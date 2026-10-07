/* Build-time tokens: every shared fact written once. {{price.yearlyPerMonth}}, {{stats.verified}}, {{site.url}} and
   the rest come from src/data, the same modules the scripts and the API read, so the static HTML can never disagree
   with them. Pages that can reach the API refresh the statistics after load. vite.config.js fills them into every
   page (an unknown token fails the build); scripts/gen-seo.mjs fills them into what it reads from the pages. */
import { SITE, SITE_HOST } from '../data/site.js';
import { BILLING } from '../data/billing.js';
import { MEMBERS } from '../data/members.js';
import { POSTS } from '../data/feed.js';
import { statsOf } from '../data/stats.js';

const STATS = statsOf(MEMBERS, POSTS);
export const TOKENS = {
  'site.url': SITE.url, 'site.host': SITE_HOST, 'site.place': SITE.place, 'site.name': SITE.name,
  'email.support': SITE.email.support, 'email.trust': SITE.email.trust, 'email.privacy': SITE.email.privacy, 'email.sales': SITE.email.sales,
  'review.businessDays': String(SITE.review.businessDays), 'reverify.months': String(SITE.reverifyMonths),
  'price.yearlyPerMonth': BILLING.yearlyPerMonth, 'price.yearlyPerYear': BILLING.yearlyPerYear,
  'price.monthlyPerMonth': BILLING.monthlyPerMonth, 'price.monthlyPerYear': BILLING.monthlyPerYear,
  'price.yearlySaves': BILLING.yearlySaves, 'price.yearlyPerDay': BILLING.yearlyPerDay,
  ...Object.fromEntries(Object.entries(STATS).map(([k, v]) => [`stats.${k}`, String(v)])),
  year: String(new Date().getFullYear())
};
export const TOKEN_RE = /\{\{\s*([a-z]+(?:\.[a-zA-Z]+)*)\s*\}\}/g;
/* fill the shared tokens, leaving any others as they are */
export const fillShared = (s) => String(s).replace(TOKEN_RE, (whole, key) => (key in TOKENS ? TOKENS[key] : whole));
