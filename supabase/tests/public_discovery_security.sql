begin;
select plan(1);
insert into public.jobs(id,external_id,source,title,company_name,description,location,skills,application_url,published_at,expires_at) values
 ('00000000-0000-4000-8000-000000000081','public-active','himalayas','Public fixture','Fixture','Public description','India','{}','https://example.com/job',now(),now()+interval '1 day'),
 ('00000000-0000-4000-8000-000000000082','public-expired','himalayas','Expired fixture','Fixture','Expired description','India','{}','https://example.com/expired',now(),now()-interval '1 day'),
 ('00000000-0000-4000-8000-000000000083','public-hidden','himalayas','Hidden fixture','Fixture','Hidden description','India','{}','https://example.com/hidden',now(),null);
insert into public.jobs(id,external_id,source,created_by,title,company_name,description,location,skills,application_url,published_at) values
 ('00000000-0000-4000-8000-000000000084','private-user','user','00000000-0000-4000-8000-000000000010','Private saved fixture','Private Company','Private','India','{}','https://example.com/private',now());
insert into public.job_reports(id,user_id,job_id,category,details) values('00000000-0000-4000-8000-000000000085','00000000-0000-4000-8000-000000000010','00000000-0000-4000-8000-000000000083','other','Independent hidden fixture');
insert into public.hidden_jobs(job_id) values('00000000-0000-4000-8000-000000000083');
set local role service_role;
do $$ begin
 if not exists(select 1 from public.public_discovery_jobs where id='00000000-0000-4000-8000-000000000081') then raise exception 'Active listing missing';end if;
 if exists(select 1 from public.public_discovery_jobs where id in('00000000-0000-4000-8000-000000000082','00000000-0000-4000-8000-000000000083','00000000-0000-4000-8000-000000000084')) then raise exception 'Expired/hidden/private listing exposed';end if;
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='public_discovery_jobs' and column_name in('created_by','raw_data','user_id')) then raise exception 'Private columns projected';end if;
end $$;
set local role anon;
do $$ begin
 begin perform 1 from public.public_discovery_jobs;raise exception 'Raw browser discovery grant';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
do $$ begin
 begin perform 1 from public.public_discovery_jobs;raise exception 'Authenticated raw grant';exception when insufficient_privilege then null;end;
end $$;
select pass('Public server projection excludes expired/hidden/private listings and private columns without browser grants');
select * from finish();
rollback;
