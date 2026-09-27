create or replace function public.prevent_job_ownership_transfer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.created_by is distinct from old.created_by then
    raise insufficient_privilege
      using message = 'Job ownership cannot be reassigned';
  end if;

  return new;
end;
$$;

create trigger prevent_job_ownership_transfer
before update of created_by on public.jobs
for each row
execute function public.prevent_job_ownership_transfer();
