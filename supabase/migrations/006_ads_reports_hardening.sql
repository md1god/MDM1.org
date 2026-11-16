-- Migration 006: ad reports are a moderation queue, never an automatic takedown metric.
-- Anonymous visitors may still report ads. A report is deduplicated per ad/reporter,
-- but untrusted client reporter ids must never change public ad visibility.

create or replace function public.report_ad(p_ad_id uuid, p_reporter text, p_reason text default null)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_count integer;
  normalized_reporter text := left(regexp_replace(lower(trim(coalesce(p_reporter, ''))), '[^a-z0-9_-]', '', 'g'), 64);
begin
  if p_ad_id is null or normalized_reporter is null or char_length(normalized_reporter) < 8 then
    return false;
  end if;

  insert into public.ad_reports(ad_id, reporter_id, reason)
  select p_ad_id, normalized_reporter, left(nullif(trim(p_reason), ''), 200)
  where exists (
    select 1 from public.ads
    where id = p_ad_id and status = 'active' and expires_at > now()
  )
  on conflict (ad_id, reporter_id) do nothing;

  get diagnostics inserted_count = row_count;
  -- Deliberately no UPDATE of public.ads here. Visibility changes require moderation.
  return inserted_count > 0;
end
$$;

revoke all on function public.report_ad(uuid, text, text) from public;
grant execute on function public.report_ad(uuid, text, text) to anon, authenticated;

-- Ensure reports remain a write-only queue for visitors; no direct report-table reads.
revoke all on public.ad_reports from anon, authenticated;
