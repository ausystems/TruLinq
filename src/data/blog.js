/* The guides: the only place a guide's title, description, dates and links are written. The blog index, each guide's
   head, byline, breadcrumb and related guides, the structured data, the sitemap, the RSS feed and llms.txt all read
   this list (vite.config.js, src/build/, scripts/gen-seo.mjs). The words of each guide live in its own page,
   blog/<slug>/index.html, between <!--guide-body--> and <!--/guide-body-->; its art in partials/art/<slug>.html.

   title       the headline on the page; one phrase in [brackets] carries the ink (.hl)
   seoTitle    the <title>: 30 to 60 characters, the searched phrase first
   description the meta description: 120 to 160 characters
   dek         the line under the headline
   short       the footer's label for it
   published, modified   ISO dates; change `modified` whenever the facts in a guide are re-checked or changed */
export const BLOG = {
  path: '/blog/',
  name: 'Trulinq guides',
  title: 'Guides to spotting scams, fakes and fraud · Trulinq',
  description: 'Plain, sourced guides to checking businesses, websites, profiles and invoices before you trust them with your money, your data or your name.',
  lead: 'Plain, sourced guides to checking businesses, websites, people and invoices before you trust them with your money, your data or your name.'
};

export const ARTICLES = [
  {
    slug: 'how-to-check-if-a-business-is-legit',
    title: 'How to check if a business is [legit]',
    seoTitle: 'How to check if a business is legit: a 12-point checklist',
    description: 'Twelve checks that tell a real company from a convincing front: official registries, licenses, addresses, reviews, court records and how to pay safely.',
    dek: 'Twelve checks, from the official registry to the way you pay, that tell a real company from a convincing front. Most take a minute or two, and nearly all of them are free.',
    short: 'Check a business',
    topic: 'Businesses',
    keywords: ['how to check if a business is legit', 'how to verify a business', 'is this company legit', 'business entity search', 'how to check if a company is registered'],
    published: '2026-10-07',
    modified: '2026-10-07',
    related: ['how-to-find-out-who-owns-a-business', 'how-to-tell-if-a-website-is-legit', 'business-email-compromise']
  },
  {
    slug: 'how-to-tell-if-a-website-is-legit',
    title: 'How to tell if a website is [legit]',
    seoTitle: 'How to tell if a website is legit or a scam · Trulinq',
    description: 'How to check a website before you buy, sign in or type a card number: read the real domain, check its age, test the padlock myth and pay the safe way.',
    dek: 'Before you buy, sign in or type a card number: read the real address, check how old the site is, look past the padlock and pay in a way you can take back.',
    short: 'Check a website',
    topic: 'Websites',
    keywords: ['how to check if a website is legit', 'is this website legit', 'how to tell if a website is a scam', 'website legit checker', 'how to check if a website is safe'],
    published: '2026-10-07',
    modified: '2026-10-07',
    related: ['how-to-check-if-a-business-is-legit', 'business-email-compromise', 'how-to-spot-a-fake-linkedin-profile']
  },
  {
    slug: 'how-to-spot-a-fake-linkedin-profile',
    title: 'How to spot a fake [LinkedIn] profile',
    seoTitle: 'How to spot a fake LinkedIn profile, recruiter or investor',
    description: 'The checks that still catch fake LinkedIn profiles, recruiters and investors, now that AI faces look real: verification badges, history, photos and asks.',
    dek: 'AI can now make a face you will trust more than a real one. These are the checks that still work on fake profiles, fake recruiters and fake investors.',
    short: 'Spot a fake profile',
    topic: 'People',
    keywords: ['how to spot a fake linkedin profile', 'fake linkedin profile', 'linkedin scams', 'fake recruiter', 'ai generated profile picture'],
    published: '2026-10-07',
    modified: '2026-10-07',
    related: ['what-is-kyc-and-kyb', 'business-email-compromise', 'how-to-tell-if-a-website-is-legit']
  },
  {
    slug: 'business-email-compromise',
    title: 'Business email compromise: how to stop [fake invoices]',
    seoTitle: 'Business email compromise: how to stop invoice fraud',
    description: 'How business email compromise and fake invoice scams work, the controls that stop them, and what to do in the first hours if money has already gone.',
    dek: 'One convincing email, one changed bank account, one payment you cannot pull back. How the most expensive scam aimed at businesses works, and the habits that stop it.',
    short: 'Stop invoice fraud',
    topic: 'Payments',
    keywords: ['business email compromise', 'BEC scam', 'invoice fraud', 'fake invoice scam', 'payment redirection fraud'],
    published: '2026-10-07',
    modified: '2026-10-07',
    related: ['how-to-check-if-a-business-is-legit', 'how-to-tell-if-a-website-is-legit', 'how-to-spot-a-fake-linkedin-profile']
  },
  {
    slug: 'how-to-find-out-who-owns-a-business',
    title: 'How to find out who [owns] a business',
    seoTitle: 'How to find out who owns a business (US, Canada, UK)',
    description: 'Where ownership is actually on record: state filings, DBA records, SEC filings, Form 990s, and the Canadian and UK registers of people with control.',
    dek: 'Ownership is on record more often than you think, just not in one place. Where to look in the United States, Canada and the UK, and what each record can and cannot tell you.',
    short: 'Find a business owner',
    topic: 'Businesses',
    keywords: ['how to find out who owns a business', 'business owner lookup', 'who owns this company', 'how to find the owner of an llc', 'find business owner by name'],
    published: '2026-10-07',
    modified: '2026-10-07',
    related: ['how-to-check-if-a-business-is-legit', 'what-is-kyc-and-kyb', 'business-email-compromise']
  },
  {
    slug: 'what-is-kyc-and-kyb',
    title: 'What is KYC? Identity and business checks, [explained]',
    seoTitle: 'What is KYC? KYC and KYB verification explained · Trulinq',
    description: 'What KYC and KYB mean, the rules behind them, how ID and selfie checks really work, what businesses are asked for, and how your data should be protected.',
    dek: 'Know your customer and know your business: what the rules require, what actually happens when you upload an ID or a selfie, and what a business is asked to prove.',
    short: 'KYC and KYB explained',
    topic: 'Verification',
    keywords: ['what is kyc', 'kyc meaning', 'kyc verification', 'what is kyb', 'know your business', 'kyc vs kyb', 'identity verification'],
    published: '2026-10-07',
    modified: '2026-10-07',
    related: ['how-to-find-out-who-owns-a-business', 'how-to-spot-a-fake-linkedin-profile', 'how-to-check-if-a-business-is-legit']
  }
];

export const articleBySlug = Object.fromEntries(ARTICLES.map((a) => [a.slug, a]));
export const articlePath = (a) => `${BLOG.path}${a.slug}/`;
/* the headline as text, and as markup with its bracketed phrase in ink */
export const plainTitle = (a) => a.title.replace(/\[|\]/g, '');
