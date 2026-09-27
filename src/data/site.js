/* Where the site lives and how Trulinq is reached. Every canonical URL, share link, referral link, sitemap entry and
   contact address comes from here. Changing the production domain is a one-line change to `url`. */
export const SITE = {
  name: 'Trulinq',
  url: 'https://tru-linq.vercel.app',
  place: 'Hilo, Hawaiʻi',
  email: {
    support: 'support@trulinq.com',
    trust: 'trust@trulinq.com',
    privacy: 'privacy@trulinq.com',
    sales: 'sales@trulinq.com'
  },
  review: { businessDays: 2 },
  reverifyMonths: 12
};
export const SITE_HOST = new URL(SITE.url).host;
