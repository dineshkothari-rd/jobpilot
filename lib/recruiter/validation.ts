import { isIP } from 'node:net';
const object=(value:unknown)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid request.');return value as Record<string,unknown>;};
const text=(value:unknown,label:string,min:number,max:number)=>{if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw Error(`${label} must contain ${min}–${max} characters.`);return value.trim();};
export function publicHttps(value:unknown,label='URL'){
  const input=text(value,label,8,2048);let url:URL;try{url=new URL(input);}catch{throw Error(`${label} must be a public HTTPS URL.`);}
  const host=url.hostname; if(url.protocol!=='https:'||url.username||url.password||url.port||isIP(host)||!host.includes('.')||host.endsWith('.local')||host.endsWith('.localhost'))throw Error(`${label} must be a public HTTPS URL.`);
  return url.href;
}
export function parseCompany(value:unknown){
  const input=object(value);const website=publicHttps(input.website,'Company website');const domain=new URL(website).hostname.replace(/^www\./,'');
  if(!/^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}$/.test(domain)||['gmail.com','outlook.com','hotmail.com','yahoo.com','proton.me'].includes(domain))throw Error('Use your company’s own website domain.');
  return {name:text(input.name,'Company name',2,200),domain,contact_name:text(input.contact_name,'Contact name',2,100),website,...parseEvidence(input)};
}
export function parseEvidence(value:unknown){const input=object(value);return {evidence_url:publicHttps(input.evidence_url,'Business evidence link'),details:text(input.details,'Verification details',20,2000)};}
export function uuid(value:unknown){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))throw Error('Invalid record ID.');return value;}
export function version(value:unknown){if(typeof value!=='number'||!Number.isSafeInteger(value)||value<1)throw Error('Reload this record before trying again.');return value;}
export function parsePosting(value:unknown){
  const input=object(value);const number=(key:string,max:number)=>{const value=input[key];if(value===null||value===''||value===undefined)return null;if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)throw Error(`Invalid ${key.replaceAll('_',' ')}.`);return value;};
  const salary_min=number('salary_min',2147483647),salary_max=number('salary_max',2147483647),equity_min=number('equity_min',100),equity_max=number('equity_max',100);
  if([salary_min,salary_max].some(v=>v!==null&&!Number.isInteger(v))||salary_max!==null&&salary_max<(salary_min??0))throw Error('Salary range is invalid.');
  if((equity_min===null)!==(equity_max===null)||equity_min!==null&&equity_max!<equity_min)throw Error('Enter both equity percentages in increasing order.');
  const salary_currency=text(input.salary_currency||'INR','Salary currency',3,3).toUpperCase();if(!['INR','USD','EUR','GBP','CAD','AUD'].includes(salary_currency))throw Error('Unsupported salary currency.');
  if(!Array.isArray(input.skills)||input.skills.length<1||input.skills.length>30)throw Error('Enter 1–30 skills.');
  const skills=[...new Set(input.skills.map(v=>text(v,'Skill',1,80)))];
  const posting_status=input.posting_status;if(!['draft','published','paused','closed'].includes(String(posting_status)))throw Error('Invalid posting status.');
  const employment_type=text(input.employment_type,'Employment type',1,50);if(!['full-time','part-time','contract','internship'].includes(employment_type))throw Error('Choose a supported employment type.');
  return {title:text(input.title,'Job title',2,200),description:text(input.description,'Job description',50,10000),location:text(input.location,'Location',1,300),country:typeof input.country==='string'?text(input.country||'India','Country',1,100):'India',employment_type,seniority:text(input.seniority||'Not specified','Experience level',1,100),salary_min,salary_max,salary_currency,equity_min,equity_max,skills,application_url:publicHttps(input.application_url,'Application URL'),posting_status};
}
