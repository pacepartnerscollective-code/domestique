-- Seeds the two Phase 1 accounts. token_ref holds the NAME of the Vercel
-- Sensitive env var that carries the actual Page access token — never the
-- token itself. See docs/phase-1-prd.md §0 and §9.

insert into accounts (ig_user_id, handle, owner, page_id, token_ref) values
  ('17841403400545180', 'francisayling',  'francis', '1211240448749705', 'META_TOKEN_FRANCIS'),
  ('17841401067553376', 'baileyroseking', 'bailey',  '1334186459774678', 'META_TOKEN_BAILEY')
on conflict (ig_user_id) do update set
  handle    = excluded.handle,
  page_id   = excluded.page_id,
  token_ref = excluded.token_ref;
