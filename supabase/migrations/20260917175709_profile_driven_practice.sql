-- Add a role-driven focus without changing ownership, grants or saved sessions.
alter table public.interview_practice_sessions
  drop constraint interview_practice_sessions_topic_check;
alter table public.interview_practice_sessions
  add constraint interview_practice_sessions_topic_check
  check (topic in ('role', 'frontend', 'react', 'javascript', 'backend', 'sql'));
