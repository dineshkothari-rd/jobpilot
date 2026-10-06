import { matchesDatePosted, matchesExperience, matchesIndustry, matchesSalaryFloor, matchesWorkplace } from '../jobs/filters.ts';
import { equityDetails, matchesEquity } from '../jobs/equity.ts';
import { validateSavedSearchCriteria } from '../jobs/saved-searches.ts';
import type { MatchJob } from '../matching/scorer';
export type AlertJob = MatchJob & { id: string; company_name: string | null; salary_currency: string | null; source: string; published_at: string | null; match_score: number; equity_min?: number | null; equity_max?: number | null };
export function matchesSavedSearch(job: AlertJob, input: unknown, minimumScore: number, now: number) {
  const parsed = validateSavedSearchCriteria(input); if (!parsed.valid) return false;
  const c = parsed.criteria;
  if (job.match_score < (c.minimumScore ?? minimumScore) || c.sourceFilter === 'user') return false;
  if (c.sourceFilter && c.sourceFilter !== 'all' && job.source !== c.sourceFilter) return false;
  if (c.location && c.location !== 'all' && job.location !== c.location || c.employmentType && c.employmentType !== 'all' && job.employment_type !== c.employmentType) return false;
  if (!matchesWorkplace(job,c.workplace || 'all') || !matchesExperience(job,c.experience || 'all') || !matchesIndustry(job,c.industry || 'all') || !matchesDatePosted(job.published_at,c.datePosted || 'all',now) || !matchesSalaryFloor(job,c.salaryMinFloor || 0)) return false;
  if (c.equity && c.equity !== 'all') { const details = job.source === 'jobpilot' ? equityDetails(job.description,job) : null; if (job.source === 'jobpilot' ? (c.equity === 'range' ? details?.minPercent == null : details == null) : !matchesEquity(job.description,c.equity)) return false; }
  return [job.title,job.company_name,job.location,job.country,job.description,job.employment_type,job.seniority,...(job.skills || [])].filter(Boolean).join(' ').toLowerCase().includes((c.search || '').trim().toLowerCase());
}
export function alertDigest(jobs: AlertJob[], site: string) {
  return `${jobs.length} new jobs match your saved searches.\n\n${jobs.slice(0,20).map(job=>`${(job.title || '').replace(/[\r\n]/g,' ')} — ${(job.company_name || '').replace(/[\r\n]/g,' ')}\n${site}/jobs/${job.id}`).join('\n\n')}\n\n${jobs.length>20?'Showing the first 20 matches.\n':''}Review jobs: ${site}/jobs\nManage alerts: ${site}/profile`;
}
