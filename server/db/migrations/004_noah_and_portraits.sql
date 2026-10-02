-- Noah Duran joins the roster: shown on the trulinqid.com homepage among its verified members as "Lead Software
-- Engineer · Honolulu", with nothing else public. His score is the engine's on what is known (verified, his city).
-- Ahmad Khalid's portrait is published; with it his profile is complete, so his completeness factor is 20 of 20.
-- Forward only and idempotent: nothing an existing database already holds is overwritten, and a photo or score set
-- since the seed (through the profile editor or the score engine) is left alone.
insert into members (id, slug, name, first_name, headline, role, company, city, region, country, lat, lng, industry, bio, offers, looking, website, website_verified, founded, photo, verification_status, verified_on, referral_code, followers, following, joined_on, created_at)
values (md5('trulinq:member:noah-duran')::uuid, 'noah-duran', 'Noah Duran', 'Noah', 'Lead Software Engineer', 'Lead Software Engineer', '', 'Honolulu', '', 'United States', 21.3069, -157.8583, '', '', '', '', '', false, null, null, 'verified', '2026-09-23', '4C8XZUJB', 0, 0, '2026-09-23', '2026-09-23T12:00:00Z')
on conflict (slug) do nothing;
insert into member_scores (member_id, identity, profile, web, history, standing, total, source)
select id, 45, 3, 0, 0, 0, 564, 'seed' from members where slug = 'noah-duran'
on conflict (member_id) do nothing;

update members set photo = '/portraits/ahmad-khalid' where slug = 'ahmad-khalid' and photo is null;
update member_scores s set profile = 20, total = 740
  from members m
 where m.id = s.member_id and m.slug = 'ahmad-khalid' and s.source = 'seed' and s.profile = 15;
