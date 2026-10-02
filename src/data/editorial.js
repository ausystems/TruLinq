/* Editorial choices: which real member appears where on the pages, and which sentences are quoted from their own
   public profiles. Quotes are exact excerpts of each member's bio. */
export const FEATURED = {
  /* Tyler Shirakawa, Noah Duran and Ahmad Khalid are the cards the site leads with wherever it previews people */
  hero: 'tyler-shirakawa',
  world: ['tyler-shirakawa', 'noah-duran', 'ahmad-khalid'],
  score: 'ahmad-khalid',
  auth: ['tyler-shirakawa', 'noah-duran', 'ahmad-khalid'],
  /* the app concept: whose profile its home screen opens on, and who the discover screen lists */
  app: { home: 'ahmad-khalid', discover: ['tyler-shirakawa', 'noah-duran', 'ahmad-khalid', 'preston-sinenci-jr', 'david'] }
};

export const QUOTES = [
  { member: 'ahmad-khalid', text: 'Web development and digital marketing: websites built to bring in customers, and the SEO and paid campaigns that keep them coming.' },
  { member: 'makalea-medeiros', text: 'I’m here to surround myself with high-level thinkers, learn from people who have already achieved what I’m pursuing, and turn that knowledge into action.' },
  { member: 'david', text: 'My mission is to connect buyers to sellers and vice versa.' }
];
