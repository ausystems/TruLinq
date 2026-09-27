/* The billing configuration: the only place a price is written. Pages, the verification form, the dashboard and the
   pricing register read it; static HTML gets the same values at build time (see vite.config.js). Card payments are
   not connected yet (no STRIPE_SECRET_KEY), so nothing here is charged by this site. */
export const PLANS = {
  member: { name: 'Member', price: 0 },
  verified: {
    name: 'Verified Business',
    yearly: { perMonth: 19, perYear: 228 },
    monthly: { perMonth: 24, perYear: 288 }
  },
  enterprise: { name: 'Enterprise', price: null }
};
export const CURRENCY = 'USD';
export const money = (n) => `$${Number(n).toLocaleString('en-US')}`;
/* Derived figures, so no page does its own arithmetic. */
export const BILLING = {
  yearlyPerMonth: money(PLANS.verified.yearly.perMonth),
  yearlyPerYear: money(PLANS.verified.yearly.perYear),
  monthlyPerMonth: money(PLANS.verified.monthly.perMonth),
  monthlyPerYear: money(PLANS.verified.monthly.perYear),
  yearlySaves: money(PLANS.verified.monthly.perYear - PLANS.verified.yearly.perYear),
  yearlyPerDay: `${Math.round((PLANS.verified.yearly.perYear / 365) * 100)}¢`
};
