/* The dashboard's demonstration account. It is shown only when the account service can't be reached, under a banner
   that says so, and it appears nowhere else. It is not a person: every identifying field is a neutral placeholder
   ("Your name", "Your business"), its portrait is a blank figure, and it has no profile page. Its dates are set
   relative to today so that every figure on the page agrees with every other, and its score factors follow the same
   rules as the score engine (server/lib/score.ts). */
export function demoAccount(now = new Date()) {
  const ago = (days) => { const d = new Date(now); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10); };
  const joined = ago(92), submitted = ago(34), reviewed = ago(33), verified = ago(31);
  return {
    demo: true,
    user: { id: 'demo', email: 'you@example.com', role: 'member' },
    member: {
      id: 'sample', placeholder: true, name: 'Your name', first: 'Your name', headline: '', role: 'Owner', company: 'Your business',
      city: 'Your city', region: '', country: '', lat: null, lng: null, industry: 'Your industry',
      website: 'example.com', founded: 2021, photo: null, followers: 0, following: 0,
      bio: 'Your bio.', offers: 'What you offer', looking: 'What you’re looking for',
      status: 'verified', verifiedOn: verified, joined, createdAt: `${joined}T12:00:00.000Z`, visibility: 'public',
      /* identity 45 (verified) · profile 18 (7 of 8 details: no photo) · web 15 (domain confirmed)
         · history 1 (about three months) · standing 1 (about one month) → 740, AA Excellent */
      factors: [45, 18, 15, 1, 1],
      completeness: { photo: false, bio: true, industry: true, city: true, website: true, founded: true, offers: true, looking: true },
      referralCode: '', referralLink: ''
    },
    verification: {
      id: 'demo', reference: 'TQ-SAMPLE', status: 'approved', submittedAt: `${submitted}T18:00:00.000Z`, reviewStartedAt: `${reviewed}T18:00:00.000Z`, decidedAt: `${verified}T18:00:00.000Z`, note: null,
      identity: { idType: 'Passport', country: 'United States' },
      business: { name: 'Your business', registration: null, registeredIn: 'Your state or country', website: 'example.com' },
      documents: 1
    },
    subscription: null,
    referrals: { count: 0, referredBy: null },
    endorsements: [],
    posts: []
  };
}
