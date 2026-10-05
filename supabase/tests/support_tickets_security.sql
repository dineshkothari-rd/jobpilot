begin;
select plan(1);
select set_config('jobpilot.test.owner',(select id::text from auth.users order by created_at limit 1),true);
select set_config('jobpilot.test.other',(select id::text from auth.users order by created_at limit 1 offset 1),true);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated','user_metadata',json_build_object('role','admin'))::text,true);
insert into public.support_tickets(user_id,category,subject,details)
values(auth.uid(),'account','Password reset problem','The reset link failed after I opened it in the same browser.');
do $$ begin
  update public.support_tickets set status='resolved',response='Forged a support reply',version=version+1 where user_id=auth.uid();
  if found then raise exception 'Owner self-resolved ticket'; end if;
  begin insert into public.support_tickets(user_id,category,subject,details) values(current_setting('jobpilot.test.other')::uuid,'account','Forged ownership','This must not impersonate another user.'); raise exception 'Foreign ticket allowed'; exception when insufficient_privilege then null; end;
  begin insert into public.support_tickets(user_id,category,subject,details,status) values(auth.uid(),'account','Forged status','This status must be server managed.','resolved'); raise exception 'Forged status allowed'; exception when insufficient_privilege then null; end;
  begin delete from public.support_tickets where user_id=auth.uid(); raise exception 'Client deleted ticket'; exception when insufficient_privilege then null; end;
end $$;
insert into public.support_tickets(user_id,category,subject,details)
select auth.uid(),'other','Limit test '||i,'This request validates the support ticket limit.' from generate_series(1,4)i;
do $$ begin
  begin insert into public.support_tickets(user_id,category,subject,details) values(auth.uid(),'other','One too many','This must exceed the five ticket limit.'); raise exception 'Rate limit not enforced'; exception when raise_exception then if sqlerrm <> 'support_rate_limit' then raise; end if; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.other'),'role','authenticated')::text,true);
do $$ begin
  if exists(select 1 from public.support_tickets where user_id=current_setting('jobpilot.test.owner')::uuid) then raise exception 'Foreign tickets visible'; end if;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.other'),'role','authenticated','app_metadata',json_build_object('role','admin'))::text,true);
update public.support_tickets set status='resolved',response='Please request a new link in the same browser.',version=2 where user_id=current_setting('jobpilot.test.owner')::uuid and subject='Password reset problem' and version=1;
do $$ begin
  if not exists(select 1 from public.support_tickets where subject='Password reset problem' and status='resolved' and version=2) then raise exception 'Admin reply failed'; end if;
  begin update public.support_tickets set response='A stale reply must be rejected.' where subject='Password reset problem'; raise exception 'Stale update accepted'; exception when raise_exception then if sqlerrm <> 'support_version_conflict' then raise; end if; end;
end $$;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated')::text,true);
do $$ begin
  if not exists(select 1 from public.support_tickets where user_id=auth.uid() and response='Please request a new link in the same browser.') then raise exception 'Owner cannot read support response'; end if;
end $$;
reset role;
insert into public.account_deletion_requests(user_id) values(current_setting('jobpilot.test.owner')::uuid);
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.other'),'role','authenticated')::text,true);
insert into public.support_tickets(user_id,category,subject,details)
values(auth.uid(),'other','Another account ticket','This other account ticket must survive deletion.');
reset role;
insert into public.account_deletion_requests(user_id) values(current_setting('jobpilot.test.other')::uuid);
set local role authenticated;
do $$ begin
  begin insert into public.support_tickets(user_id,category,subject,details) values(auth.uid(),'other','Deletion underway','This account has requested deletion.'); raise exception 'Deleting account submitted a ticket'; exception when insufficient_privilege then null; end;
end $$;
reset role;
delete from auth.users where id=current_setting('jobpilot.test.owner')::uuid;
do $$ begin
  if exists(select 1 from public.support_tickets where user_id=current_setting('jobpilot.test.owner')::uuid) then raise exception 'Deleted account tickets retained'; end if;
  if not exists(select 1 from public.support_tickets where user_id=current_setting('jobpilot.test.other')::uuid) then raise exception 'Foreign tickets deleted'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims',json_build_object('sub',current_setting('jobpilot.test.owner'),'role','authenticated','app_metadata',json_build_object('role','admin'))::text,true);
do $$ begin
  if exists(select 1 from public.support_tickets) then raise exception 'Deleted admin JWT retained queue access'; end if;
end $$;
reset role;
select pass('support ownership, forged admin/status denial, rate limits, replies, stale versions and account cleanup pass');
select * from finish();
rollback;
