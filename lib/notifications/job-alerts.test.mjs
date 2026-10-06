import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesSavedSearch, alertDigest } from './job-alerts.ts';
const job={id:'00000000-0000-4000-8000-000000000016',title:'Senior React engineer',company_name:'Example',description:'Hybrid frontend role. Equity: 0.1–0.2%.',location:'Bengaluru',country:'India',employment_type:'full-time',seniority:'senior',salary_min:1000000,salary_max:2000000,salary_currency:'INR',skills:['React'],source:'remotive',published_at:'2026-10-05T00:00:00Z',match_score:80};
const now=Date.parse('2026-10-05T10:00:00Z');
test('digests honor saved query, all supported filters and inherited profile threshold',()=>{
  assert.equal(matchesSavedSearch(job,{search:'React',workplace:'hybrid',experience:'senior',industry:'engineering',datePosted:'24h',salaryMinFloor:100000,equity:'range',location:'Bengaluru',employmentType:'full-time',sourceFilter:'remotive'},70,now),true);
  for(const c of [{search:'Python'},{workplace:'remote'},{experience:'entry'},{industry:'design'},{salaryMinFloor:300000},{location:'Delhi'},{employmentType:'part-time'},{minimumScore:90},{sourceFilter:'user'},{sourceFilter:'arbeitnow'}])assert.equal(matchesSavedSearch(job,c,70,now),false,JSON.stringify(c));
  assert.equal(matchesSavedSearch(job,{},90,now),false);assert.equal(matchesSavedSearch(job,{minimumScore:75},90,now),true);
  assert.equal(matchesSavedSearch({...job,published_at:'2026-09-01'},{datePosted:'7d'},70,now),false);
  assert.equal(matchesSavedSearch({...job,source:'jobpilot',description:'No equity text',equity_min:0.2,equity_max:0.5},{sourceFilter:'jobpilot',equity:'range'},70,now),true);
});
test('email digest has fixed owner-site job links, bounded items and no header injection',()=>{
  const text=alertDigest([{...job,title:'Example\nforged' },...Array.from({length:25},()=>job)],'https://jobpilot.test');
  assert.ok(text.includes('26 new jobs'));assert.ok(text.includes('Showing the first 20'));assert.equal((text.match(/\/jobs\//g)||[]).length,20);assert.ok(text.includes('Example forged'));assert.ok(text.endsWith('/profile'));
});
