/* The Trulinq roster: the verified members listed on trulinqid.com/match (captured 27 September 2026, their public
   profile fields exactly as published, score factors as the live product computed them), plus Ahmad Khalid.
   This file is the single source for the seed migration (scripts/gen-seed.mjs), the static member pages
   (scripts/gen-members.mjs), the build-time statistics and the offline fallback. Once a database is connected the
   API is the source of truth and this file only seeds it.

   Fields are stored as the member wrote them. The only normalisation: country names spelled out ("US" → "United
   States"), tracking parameters removed from links, stray spaces removed. `uid` is the member's id on the live
   product. `photo` is null for everyone: portraits render as monograms until member photos are approved for use. */
export const MEMBERS = [
  {
    id: 'tyler-shirakawa', uid: '0542e68e-ae26-4a7e-ae34-252ae5e022ed', referralCode: 'E9EAF5',
    name: 'Tyler Shirakawa', first: 'Tyler', headline: 'CEO of Trulinq', role: 'CEO', company: 'Trulinq',
    city: 'Hilo', region: '', country: 'United States', lat: 19.7241, lng: -155.0868,
    industry: 'Marketing', factors: [45, 20, 15, 0, 1], verifiedOn: '2026-09-01', joined: '2026-09-01',
    website: 'trulinqid.com', founded: null, followers: 2, following: 4, photo: null,
    bio: '36 Yr old entrepreneur based in Hawaii. Background is marketing, trading, and pemf sales and peptides.',
    offers: '', looking: 'Investors, potential business partners.'
  },
  {
    id: 'maverick-kang-jr', uid: 'ff8d19ca-d314-448f-a596-7de8f2b07d44',
    name: 'Maverick kang Jr', first: 'Maverick', headline: 'Credit Repair + Funding Coach', role: 'Owner', company: 'QUIK SCALE LLC',
    city: 'Phoenix', region: '', country: 'United States', lat: 33.4484, lng: -112.074,
    industry: 'Consulting', factors: [45, 20, 15, 0, 1], verifiedOn: '2026-09-02', joined: '2026-09-02',
    website: 'instagram.com/mavkangjr', founded: null, followers: 1, following: 0, photo: null,
    bio: 'Helping individuals and business owners strengthen their credit profiles, improve funding readiness, and access better financing opportunities. Focused on practical credit optimization, strategic funding preparation, and long-term financial positioning.',
    offers: '', looking: 'Credit Repair + Funding Clients'
  },
  {
    id: 'michael-onwumere', uid: 'bdf564c8-1639-490e-9317-043b0bed80a5',
    name: 'Michael Onwumere', first: 'Michael', headline: 'O’mere', role: '', company: 'O’mere',
    city: '', region: '', country: 'Canada', lat: null, lng: null,
    industry: '', factors: [45, 8, 0, 0, 1], verifiedOn: '2026-09-02', joined: '2026-09-02',
    website: '', founded: null, followers: 0, following: 0, photo: null,
    bio: '', offers: '', looking: ''
  },
  {
    id: 'preston-sinenci-jr', uid: '76250bba-25c8-4b1b-beab-aed41597925b',
    name: 'Preston Sinenci Jr', first: 'Preston', headline: '', role: 'Founder', company: 'Preston Ventures',
    city: 'Honolulu', region: '', country: 'United States', lat: 21.3069, lng: -157.8583,
    industry: 'Technology', factors: [45, 20, 15, 2, 1], verifiedOn: '2026-09-02', joined: '2026-03-31',
    website: 'trulinqid.com', founded: null, followers: 3, following: 0, photo: null,
    bio: 'Verified entrepreneur on Trulinq.', offers: '', looking: ''
  },
  {
    id: 'makalea-medeiros', uid: '26011ade-a5ed-40b4-8208-4e31e2f1aff4',
    name: 'Makalea Medeiros', first: 'Makalea', headline: 'Entrepreneur', role: 'Owner', company: 'Waiakoa enterprise LLC',
    city: 'Kula', region: 'Maui', country: 'United States', lat: 20.7911, lng: -156.3261,
    industry: 'Direct sales/service', factors: [45, 20, 15, 0, 1], verifiedOn: '2026-09-03', joined: '2026-09-02',
    website: 'instagram.com/makamedeiros', founded: null, followers: 1, following: 4, photo: null,
    bio: 'I’m Maka Medeiros, an entrepreneur from Maui focused on building businesses, investing in real estate, and creating multiple streams of income. My mission is to transition out of the traditional 9–5, build assets that generate long-term cash flow, and create financial freedom and generational wealth for my family. I’m here to surround myself with high-level thinkers, learn from people who have already achieved what I’m pursuing, and turn that knowledge into action.',
    offers: '', looking: 'Investors'
  },
  {
    id: 'david', uid: '9f0c35f7-554b-4b1b-bd5b-21cf6b91a075',
    name: 'David', first: 'David', headline: 'Building the first Binational AI Hyperscale north México Campus - A Cross Border AI Data Center',
    role: 'Chief Business Development Officer', company: 'KoridaIA',
    city: 'Richland', region: '', country: 'United States', lat: 46.2857, lng: -119.2845,
    industry: 'Energy', factors: [45, 20, 15, 0, 1], verifiedOn: '2026-09-02', joined: '2026-09-02',
    website: 'koridaia.mx', founded: null, followers: 1, following: 4, photo: null,
    bio: 'With over 8 years of professional experience, including tenure as a sourcing specialist, high school teacher and energy industry consultant, I bring a diverse background to my role. I am passionate about fostering strong relationships and creating aligned, repeatable structures that meet the needs of brokers and clients. My mission is to connect buyers to sellers and vice versa.',
    offers: 'Data center services, financing partners, renewable and sustainability energy projects, RWA’s, and tokenization companies.',
    looking: 'Cofounders, data center experts, energy companies, funding experts'
  },
  {
    id: 'chelsea-pferschy', uid: '7d88daa1-570a-4f1d-b32e-5c8005829b10',
    name: 'Chelsea Pferschy', first: 'Chelsea', headline: '', role: 'Realtor', company: 'CP',
    city: 'Honolulu', region: '', country: 'United States', lat: 21.2934, lng: -157.8283,
    industry: 'Real Estate', factors: [45, 18, 0, 0, 1], verifiedOn: '2026-09-02', joined: '2026-09-02',
    website: '', founded: null, followers: 3, following: 0, photo: null,
    bio: '', offers: '', looking: 'General help and info'
  },
  {
    id: 'palani-maharaj', uid: 'bf7df63c-af30-4099-98c4-26b73690a137',
    name: 'Palani Maharaj', first: 'Palani', headline: 'Son of one of the best Thai foods on Bigisland Hawaii', role: 'Cook/Co Owner', company: 'Ratcha Thai',
    city: 'Waikoloa', region: 'Hawaiʻi', country: 'United States', lat: 19.9406, lng: -155.7919,
    industry: 'Restaurant', factors: [45, 18, 0, 0, 1], verifiedOn: '2026-09-02', joined: '2026-09-02',
    website: '', founded: null, followers: 1, following: 0, photo: null,
    bio: '', offers: '', looking: 'Connections'
  },
  {
    id: 'omai-kofi', uid: '4533bad7-acd5-4705-96e8-2818861e7b9d',
    name: 'Omai Kofi', first: 'Omai', headline: 'The Board Of Literacy', role: '', company: 'The Board Of Literacy',
    city: '', region: '', country: 'United States', lat: null, lng: null,
    industry: '', factors: [45, 8, 0, 0, 0], verifiedOn: '2026-09-25', joined: '2026-09-25',
    website: '', founded: null, followers: 0, following: 0, photo: null,
    bio: '', offers: '', looking: ''
  },
  {
    id: 'ahmad-khalid', uid: null,
    name: 'Ahmad Khalid', first: 'Ahmad', headline: '', role: 'Owner', company: 'Skybound Scaling',
    city: 'Toronto', region: '', country: 'Canada', lat: 43.6532, lng: -79.3832,
    industry: 'Marketing', factors: [45, 15, 15, 0, 0], verifiedOn: '2026-09-24', joined: '2026-09-20',
    website: 'skyboundscaling.com', founded: 2025, followers: 0, following: 0, photo: null,
    bio: 'Owner of Skybound Scaling. Web development and digital marketing: websites built to bring in customers, and the SEO and paid campaigns that keep them coming.',
    offers: 'Web development, digital marketing (SEO, Google and Meta ads)', looking: 'Founders and owners who want a site that brings in customers'
  }
];

export const byId = Object.fromEntries(MEMBERS.map((m) => [m.id, m]));

export { INDUSTRIES } from './industries.js';

/* Endorsements: none have been written yet. They appear here once members write them. */
export const VOUCHES = {};
