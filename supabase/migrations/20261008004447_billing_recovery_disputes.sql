create table public.billing_disputes (
 id text primary key,intent_id uuid not null references public.billing_intents(id),user_id uuid references auth.users(id) on delete set null,
 payment_id text not null,status text not null check(status in ('open','under_review','action_required','won','lost','closed')),
 amount_minor integer not null check(amount_minor>0),updated_at timestamptz not null default now()
);
create index billing_disputes_intent on public.billing_disputes(intent_id);
alter table public.billing_disputes enable row level security;
revoke all on public.billing_disputes from public,anon,authenticated;
grant select on public.billing_disputes to authenticated;
grant select,insert,update on public.billing_disputes to service_role;
create policy billing_disputes_owner on public.billing_disputes for select to authenticated using(user_id=(select auth.uid()));
create policy active_account_required on public.billing_disputes as restrictive for all to authenticated using((select jobpilot_private.current_account_is_active())) with check((select jobpilot_private.current_account_is_active()));
alter table public.billing_intents add column disputed boolean not null default false;
create function public.recover_billing_checkout(p_user uuid,p_intent uuid,p_resource text,p_plan text,p_url text) returns void language plpgsql security invoker set search_path='' as $$
declare i public.billing_intents; product public.billing_products;
begin
 perform 1 from public.profiles where id=p_user for update;
 if not found or not jobpilot_private.account_is_active(p_user) or exists(select 1 from public.account_deletion_requests where user_id=p_user) then raise exception 'account_unavailable';end if;
 select * into i from public.billing_intents where id=p_intent and user_id=p_user for update;
 if i.id is null then raise exception 'checkout_conflict';end if;
 if i.provider_resource=p_resource then return;end if;
 if i.provider_resource is not null or i.status<>'creating' or p_resource is null or p_resource !~ '^(sub|plink)_[a-zA-Z0-9]{6,100}$' or p_url is null or p_url !~ '^https://rzp\.io/' then raise exception 'checkout_conflict';end if;
 select * into product from public.billing_products where id=i.product_id;
 if product.kind='subscription' and (p_plan is null or p_plan !~ '^plan_[a-zA-Z0-9]{6,100}$' or p_resource !~ '^sub_') or product.kind='posting_pack' and (p_plan is not null or p_resource !~ '^plink_') then raise exception 'checkout_conflict';end if;
 if (product.kind='posting_pack' or product.plan_id like 'recruiter_%') and not exists(select 1 from public.recruiter_companies where user_id=p_user and verification_status='verified') then raise exception 'company_not_verified';end if;
 update public.billing_intents set provider_resource=p_resource,provider_plan=p_plan,checkout_url=p_url,status='created',updated_at=now() where id=i.id;
 insert into public.billing_events(id,intent_id) values('recovery_'||gen_random_uuid(),i.id);
end $$;
create function public.apply_billing_dispute(p_intent uuid,p_token uuid,p_id text,p_payment text,p_status text,p_amount integer) returns void language plpgsql security invoker set search_path='' as $$
declare i public.billing_intents; blocked boolean;
begin
 select * into i from public.billing_intents where id=p_intent for update;
 if i.id is null or p_token is null or i.lease_token is distinct from p_token or i.lease_until is null or i.lease_until<=now() then raise exception 'billing_busy';end if;
 if p_id is null or p_id !~ '^disp_[a-zA-Z0-9]{6,100}$' or p_payment is null or p_payment !~ '^pay_[a-zA-Z0-9]{6,100}$' or p_status is null or p_status not in ('open','under_review','action_required','won','lost','closed') or p_amount is null or p_amount<=0 or p_amount>i.amount_minor then raise exception 'invalid_dispute';end if;
 if exists(select 1 from public.billing_disputes where id=p_id and (intent_id<>i.id or payment_id<>p_payment)) then raise exception 'dispute_conflict';end if;
 insert into public.billing_disputes(id,intent_id,user_id,payment_id,status,amount_minor) values(p_id,i.id,i.user_id,p_payment,p_status,p_amount)
 on conflict(id) do update set status=excluded.status,updated_at=now();
 select exists(select 1 from public.billing_disputes where intent_id=i.id and status<>'won') into blocked;
 update public.billing_intents set disputed=blocked where id=i.id;
 if blocked then
 update public.billing_entitlements set active=false where intent_id=i.id;
 if i.credits_granted then
 update public.posting_credit_balance set balance=balance-i.credits where user_id=i.user_id and mode=i.mode;
 update public.billing_intents set credits_granted=false where id=i.id;
 end if;
 end if;
end $$;
revoke all on function public.recover_billing_checkout(uuid,uuid,text,text,text),public.apply_billing_dispute(uuid,uuid,text,text,text,integer) from public,anon,authenticated;
grant execute on function public.recover_billing_checkout(uuid,uuid,text,text,text),public.apply_billing_dispute(uuid,uuid,text,text,text,integer) to service_role;

create or replace function public.apply_billing_snapshot(p_intent uuid,p_token uuid,p_event text,p_status text,p_payment text,p_amount integer,p_refunded integer,p_paid_at timestamptz,p_expires timestamptz,p_invoice text) returns void language plpgsql security invoker set search_path='' as $$
declare i public.billing_intents; product public.billing_products; had_refund boolean:=false; grant_credits boolean;
begin
 select * into i from public.billing_intents where id=p_intent for update;
 if p_token is null or p_event is null or length(p_event) not between 8 and 200 or i.id is null or i.lease_token is null or i.lease_token is distinct from p_token or i.lease_until is null or i.lease_until<=now() then raise exception 'billing_busy';end if;
 if exists(select 1 from public.billing_events where id=p_event) then return;end if;
 select * into product from public.billing_products where id=i.product_id;
 if p_status is null or p_status not in ('created','authenticated','active','pending','halted','paused','cancelled','completed','expired','paid','failed','refunded') then raise exception 'invalid_event';end if;
 if p_payment is not null then
 if p_payment !~ '^pay_[a-zA-Z0-9]+$' or p_amount is distinct from i.amount_minor or p_refunded is null or p_refunded<0 or p_refunded>p_amount or p_paid_at is null or p_paid_at>now()+interval '5 minutes' or (p_invoice is not null and p_invoice !~ '^https://rzp\.io/') then raise exception 'invalid_payment';end if;
 if exists(select 1 from public.billing_payments where id=p_payment and intent_id<>i.id) then raise exception 'payment_conflict';end if;
 select refunded_minor>0 into had_refund from public.billing_payments where id=p_payment;
 insert into public.billing_payments(id,intent_id,user_id,amount_minor,refunded_minor,paid_at,invoice_url) values(p_payment,i.id,i.user_id,p_amount,p_refunded,p_paid_at,p_invoice)
 on conflict(id) do update set refunded_minor=greatest(public.billing_payments.refunded_minor,excluded.refunded_minor),invoice_url=coalesce(excluded.invoice_url,public.billing_payments.invoice_url);
 end if;
 if product.kind='posting_pack' and i.user_id is not null then
 grant_credits:=not i.disputed and p_status='paid' and p_payment is not null and p_refunded=0 and not coalesce(had_refund,false);
 if grant_credits and not i.credits_granted then
 insert into public.posting_credit_balance(user_id,mode,balance) values(i.user_id,i.mode,i.credits) on conflict(user_id,mode) do update set balance=public.posting_credit_balance.balance+excluded.balance;
 update public.billing_intents set credits_granted=true where id=i.id;
 elsif i.credits_granted and (i.disputed or p_refunded>0 or p_status='refunded') then
 -- ponytail: refunded spent credits become debt; future purchases offset it before new posts.
 update public.posting_credit_balance set balance=balance-i.credits where user_id=i.user_id and mode=i.mode;
 update public.billing_intents set credits_granted=false where id=i.id;
 end if;
 end if;
 if product.kind='subscription' and i.user_id is not null then
 if not i.disputed and p_payment is not null and p_refunded=0 and not coalesce(had_refund,false) and p_status='active' then
 if p_expires is null or p_expires>now()+interval '45 days' then raise exception 'invalid_period';end if;
 if p_expires>now() then
 insert into public.billing_entitlements(user_id,mode,plan_id,intent_id,expires_at,active) values(i.user_id,i.mode,product.plan_id,i.id,p_expires,true)
 on conflict(user_id,mode) do update set plan_id=excluded.plan_id,intent_id=excluded.intent_id,expires_at=case when public.billing_entitlements.intent_id=excluded.intent_id then greatest(public.billing_entitlements.expires_at,excluded.expires_at) else excluded.expires_at end,active=true;
 end if;
 elsif i.disputed or p_refunded>0 or p_status in ('paused','halted','pending','failed','refunded','expired') then update public.billing_entitlements set active=false where user_id=i.user_id and mode=i.mode and intent_id=i.id;
 end if;
 end if;
 update public.billing_intents set status=p_status,lease_token=null,lease_until=null,updated_at=now() where id=i.id;
 insert into public.billing_events(id,intent_id) values(p_event,i.id);
end $$;

-- Serialize deletion with checkout creation: a native mandate must end first.
create function jobpilot_private.require_subscription_cleanup() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.profiles where id=new.user_id for update;
 if exists(select 1 from public.billing_intents i join public.billing_products p on p.id=i.product_id where i.user_id=new.user_id and i.mode='live' and p.kind='subscription' and i.status not in ('cancelled','completed','expired')) then raise exception 'subscription_active';end if;
 return new;
end $$;
revoke all on function jobpilot_private.require_subscription_cleanup() from public,anon,authenticated;
grant execute on function jobpilot_private.require_subscription_cleanup() to service_role;
create trigger subscription_cleanup_before_deletion before insert or update on public.account_deletion_requests for each row execute function jobpilot_private.require_subscription_cleanup();
