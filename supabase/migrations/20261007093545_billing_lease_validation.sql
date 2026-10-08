-- Reject absent leases rather than relying on nullable SQL comparisons.
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
 grant_credits:=p_status='paid' and p_payment is not null and p_refunded=0 and not coalesce(had_refund,false);
 if grant_credits and not i.credits_granted then
 insert into public.posting_credit_balance(user_id,mode,balance) values(i.user_id,i.mode,i.credits) on conflict(user_id,mode) do update set balance=public.posting_credit_balance.balance+excluded.balance;
 update public.billing_intents set credits_granted=true where id=i.id;
 elsif i.credits_granted and (p_refunded>0 or p_status='refunded') then
 -- ponytail: refunded spent credits become debt; future purchases offset it before new posts.
 update public.posting_credit_balance set balance=balance-i.credits where user_id=i.user_id and mode=i.mode;
 update public.billing_intents set credits_granted=false where id=i.id;
 end if;
 end if;
 if product.kind='subscription' and i.user_id is not null then
 if p_payment is not null and p_refunded=0 and not coalesce(had_refund,false) and p_status='active' then
 if p_expires is null or p_expires>now()+interval '45 days' then raise exception 'invalid_period';end if;
 if p_expires>now() then
 insert into public.billing_entitlements(user_id,mode,plan_id,intent_id,expires_at,active) values(i.user_id,i.mode,product.plan_id,i.id,p_expires,true)
 on conflict(user_id,mode) do update set plan_id=excluded.plan_id,intent_id=excluded.intent_id,expires_at=case when public.billing_entitlements.intent_id=excluded.intent_id then greatest(public.billing_entitlements.expires_at,excluded.expires_at) else excluded.expires_at end,active=true;
 end if;
 elsif p_refunded>0 or p_status in ('paused','halted','pending','failed','refunded','expired') then update public.billing_entitlements set active=false where user_id=i.user_id and mode=i.mode and intent_id=i.id;
 end if;
 end if;
 update public.billing_intents set status=p_status,lease_token=null,lease_until=null,updated_at=now() where id=i.id;
 insert into public.billing_events(id,intent_id) values(p_event,i.id);
end $$;
