import { json,recruiterContext,requestBody } from "@/lib/recruiter/server";
import { uuid } from "@/lib/recruiter/validation";
import { billingConfiguration,razorpay,providerId,hostedUrl,matchedPlan } from "@/lib/billing/provider";
export async function POST(request:Request){
 try{
 const c=await recruiterContext(request);if(c.response)return c.response;
 const config=billingConfiguration();if(!config.ready)return json({error:"Payments are disabled for the free first launch."},503);
 if(!c.user.email_confirmed_at)return json({error:"Confirm your account email before checkout."},409);
 let id:string,product:string;
 try{const b=await requestBody(request);if(!b||Object.keys(b).some(k=>!["id","product"].includes(k))||typeof b.product!=="string"||b.product.length>100)throw Error();id=uuid(b.id);product=b.product;}catch{return json({error:"Choose a valid product."},400);}
 const selected=await c.admin.from("billing_products").select("*").eq("id",product).single();if(selected.error)return json({error:"Product unavailable."},400);
 let plan:string|null=null;
 if(selected.data.kind==="subscription"){
 plan=providerId(process.env[`RAZORPAY_PLAN_${product.toUpperCase()}`],"plan");
 matchedPlan(await razorpay(`/plans/${plan}`),selected.data.amount_minor);
 }
 const begun=await c.admin.rpc("begin_billing_checkout",{p_user:c.user.id,p_id:id,p_product:product,p_mode:config.mode});
 if(begun.error)return json({error:"An existing checkout needs review, or this product requires a verified company."},409);
 const intent=begun.data;
 if(!intent.new){if(intent.status!=="created"||!intent.checkout_url)return json({error:"This checkout is in progress or already active. Review billing before starting another."},409);return json({url:hostedUrl(intent.checkout_url)});}
 // Never retry an ambiguous external create automatically. The persisted intent blocks duplicates.
 const remote=selected.data.kind==="subscription"?await razorpay("/subscriptions",{plan_id:plan,total_count:12,quantity:1,customer_notify:false,notes:{jobpilot_checkout:intent.id}}):await razorpay("/payment_links",{amount:intent.amount_minor,currency:"INR",accept_partial:false,reference_id:intent.id,description:selected.data.name,notify:{sms:false,email:false},reminder_enable:false,expire_by:Math.floor(Date.now()/1000)+3600,notes:{jobpilot_checkout:intent.id}});
 if(plan ? remote.plan_id!==plan : remote.reference_id!==intent.id || remote.amount!==intent.amount_minor || remote.currency!=="INR" || remote.accept_partial===true)throw Error("Checkout identity mismatch.");
 const resource=providerId(remote.id,plan?"sub":"plink"),url=hostedUrl(remote.short_url);
 const saved=await c.admin.from("billing_intents").update({provider_resource:resource,provider_plan:plan,checkout_url:url,status:"created"}).eq("id",intent.id).eq("user_id",c.user.id).eq("status","creating").select("id").single();
 if(saved.error)return json({error:"Checkout needs recovery. Contact support before retrying."},503);
 return json({url});
 }catch{return json({error:"Checkout is unavailable. Review billing before retrying; no access is granted from a return URL."},503);}
}
