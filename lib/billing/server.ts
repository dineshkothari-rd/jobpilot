import "server-only";
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { razorpay, providerId, hostedUrl } from "./provider";
export type Intent = {id:string;user_id:string|null;product_id:string;mode:string;amount_minor:number;provider_resource:string;provider_plan:string|null;status:string};
export async function reconcileBilling(admin: SupabaseClient, intent: Intent, event: string, paymentId?: string, cancel = false) {
  const token=randomUUID();
  const claim=await admin.rpc("claim_billing_event",{p_intent:intent.id,p_token:token,p_event:event});
  if(claim.error)throw Error("Billing update is busy.");if(!claim.data)return;
  try {
    const productRead=await admin.from("billing_products").select("kind").eq("id",intent.product_id).single();
    if(productRead.error)throw Error("Billing product unavailable.");
    const subscription=productRead.data.kind==="subscription";
    let resource=await razorpay(`/${subscription?"subscriptions":"payment_links"}/${providerId(intent.provider_resource,subscription?"sub":"plink")}`);
    if(subscription && resource.plan_id!==intent.provider_plan || !subscription && (resource.reference_id!==intent.id || resource.amount!==intent.amount_minor || resource.currency!=="INR" || resource.accept_partial===true))throw Error("Checkout identity mismatch.");
    if(cancel){
      if(!subscription)throw Error("Only subscriptions can be cancelled.");
      if(!["cancelled","completed","expired"].includes(resource.status)){
        await razorpay(`/subscriptions/${providerId(intent.provider_resource,"sub")}/cancel`,{cancel_at_cycle_end:true});
        resource=await razorpay(`/subscriptions/${providerId(intent.provider_resource,"sub")}`);
        if(resource.plan_id!==intent.provider_plan)throw Error("Checkout identity mismatch.");
      }
    }
    if(!paymentId){
      if(subscription && resource.current_end){
        const invoices=await razorpay(`/invoices?subscription_id=${providerId(intent.provider_resource,"sub")}&count=100`);
        if(!Array.isArray(invoices.items))throw Error("Invoice lookup failed.");
        paymentId=invoices.items.find((row:{subscription_id?:string;billing_end?:number;payment_id?:string})=>row.subscription_id===intent.provider_resource && row.billing_end===resource.current_end && row.payment_id)?.payment_id;
      }else if(!subscription && Array.isArray(resource.payments))paymentId=resource.payments.find((row:{status?:string;payment_id?:string})=>["captured","refunded"].includes(row.status||""))?.payment_id;
    }
    let payment: {id:string;status:string;amount:number;currency:string;amount_refunded:number;created_at:number;invoice_id:string}|null=null;
    let invoiceUrl:string|null=null;
    let paidPeriodEnd:number|null=null;
    if(paymentId){
      payment=await razorpay(`/payments/${providerId(paymentId,"pay")}`);
      if(payment && payment.status!=="captured" && payment.status!=="refunded")payment=null;
      if(payment){
        if(payment.id!==paymentId||payment.amount!==intent.amount_minor||payment.currency!=="INR"||!Number.isSafeInteger(payment.amount_refunded)||payment.amount_refunded<0||payment.amount_refunded>payment.amount)throw Error("Payment amount mismatch.");
        if(subscription){
          const invoice=await razorpay(`/invoices/${providerId(payment.invoice_id,"inv")}`);
          if(invoice.subscription_id!==intent.provider_resource || invoice.payment_id!==payment.id)throw Error("Payment subscription mismatch.");
          if(!Number.isSafeInteger(invoice.billing_end))throw Error("Payment billing period missing.");
          paidPeriodEnd=invoice.billing_end;
          if(invoice.short_url)invoiceUrl=hostedUrl(invoice.short_url);
        }else if(!Array.isArray(resource.payments)||!resource.payments.some((row:{payment_id?:string})=>row.payment_id===paymentId))throw Error("Payment checkout mismatch.");
      }
    }
    const status=(payment?.amount_refunded??0)>0?"refunded":resource.status;
    const result=await admin.rpc("apply_billing_snapshot",{
      p_intent:intent.id,p_token:token,p_event:event,p_status:status,
      p_payment:payment?.id||null,p_amount:payment?.amount||null,p_refunded:payment?.amount_refunded??null,
      p_paid_at:payment?new Date(payment.created_at*1000).toISOString():null,
      p_expires:subscription&&paidPeriodEnd?new Date(paidPeriodEnd*1000).toISOString():null,p_invoice:invoiceUrl,
    });
    if(result.error)throw Error("Billing update could not be recorded.");
  } finally {
    const release=await admin.from("billing_intents").update({lease_token:null,lease_until:null}).eq("id",intent.id).eq("lease_token",token);
    if(release.error)throw Error("Billing lock could not be released.");
  }
}
