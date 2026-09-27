/* The rooms on Trulinq, as on the live product (trulinqid.com/rooms). Nobody has posted in them yet; messages
   come from the API once verified members speak. */
export const ROOMS = [
  { slug: 'lounge', name: 'Executive Founder Circle', topic: 'Private floor for verified entrepreneurs to connect and collaborate.', members: [], messages: [] },
  { slug: 'retail', name: 'Retail & E-Commerce Board', topic: 'Storefronts, suppliers, fulfilment and omnichannel growth.', members: [], messages: [] },
  { slug: 'saas', name: 'SaaS & Technology Board', topic: 'Product, pricing, churn and go to market for software founders.', members: [], messages: [] },
  { slug: 'trade', name: 'Trade & Logistics Board', topic: 'Sourcing, freight, customs and cross border payments.', members: [], messages: [] }
];

export const roomBySlug = Object.fromEntries(ROOMS.map((r) => [r.slug, r]));
