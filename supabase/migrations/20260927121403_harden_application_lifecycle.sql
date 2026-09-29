alter table public.applications
  alter column status set default 'saved',
  add column version integer not null default 1 check (version > 0);
