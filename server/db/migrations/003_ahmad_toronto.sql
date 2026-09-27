-- Ahmad Khalid works from Toronto, Canada. Fills in the location on databases seeded before it was known. A location
-- set since then through the profile editor is left alone.
update members
   set city = 'Toronto', region = '', country = 'Canada', lat = 43.6532, lng = -79.3832
 where slug = 'ahmad-khalid' and city = '' and lat is null;
