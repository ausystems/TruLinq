/* Network statistics, computed one way everywhere: at build time from the roster (the numbers in the static HTML),
   in the browser when the API can't be reached, and by the API itself from the database (GET /api/stats). */
export function statsOf(members, posts = []) {
  const pub = members.filter((m) => (m.visibility || 'public') === 'public');
  const verified = pub.filter((m) => (m.status || 'verified') === 'verified');
  return {
    people: pub.length,
    verified: verified.length,
    revoked: members.filter((m) => m.status === 'revoked').length,
    posts: posts.length,
    cities: new Set(verified.map((m) => m.city).filter(Boolean)).size,
    industries: new Set(verified.map((m) => m.industry).filter(Boolean)).size
  };
}
