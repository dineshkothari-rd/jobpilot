// A payment receipt is not a tax invoice. Provider-issued invoices stay with the gateway.
export function receiptPdf(payment:{id:string;amount_minor:number;refunded_minor:number;paid_at:string}) {
 const text=(value:string)=>value.replace(/[^\x20-\x7e]/g,"?").replace(/[\\()]/g,"\\$&");
 const lines=["JobPilot payment receipt",`Payment: ${payment.id}`,`Paid: ${payment.paid_at}`,`Amount: INR ${(payment.amount_minor/100).toFixed(2)}`,`Refunded: INR ${(payment.refunded_minor/100).toFixed(2)}`,"This receipt is not a tax invoice.","Support: dineshkothari2021@gmail.com"];
 const stream=`BT /F1 12 Tf 50 780 Td ${lines.map((line,index)=>`${index?"0 -24 Td ":""}(${text(line)}) Tj`).join("\n")} ET`;
 const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let pdf="%PDF-1.4\n";const offsets=[0];objects.forEach((object,index)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${object}\nendobj\n`;});const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(offset=>`${String(offset).padStart(10,"0")} 00000 n \n`).join("")}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(pdf);
}
