import { recruiterContext,json } from "@/lib/recruiter/server";
import { providerId } from "@/lib/billing/provider";
import { receiptPdf } from "@/lib/billing/receipt";
export async function GET(request:Request){try{const c=await recruiterContext();if(c.response)return c.response;let id:string;try{id=providerId(new URL(request.url).searchParams.get("id"),"pay");}catch{return json({error:"Choose a receipt."},400);}
 const r=await c.admin.from("billing_payments").select("id,amount_minor,refunded_minor,paid_at").eq("id",id).eq("user_id",c.user.id).single();if(r.error||!r.data)return json({error:"Receipt not found."},404);
 return new Response(new Uint8Array(receiptPdf(r.data)),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="jobpilot-${id}.pdf"`,"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}});
 }catch{return json({error:"Receipt unavailable."},503);}}
