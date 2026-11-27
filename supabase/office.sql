-- ============================================================================
-- MDM1 private AI Office — Supabase schema (optional relay)
-- ----------------------------------------------------------------------------
-- Run this in the Supabase SQL editor. RLS is ON with NO public policies:
-- only the service_role key (used by Edge Functions) can read/write.
--
-- pwa21 hard-security batch (new tables below):
--   ar: جداول جديدة لحالة المستخدم، بوابة العميل، الحصص، رموز OTP، الهويات،
--       وقائمة المهام. الوصول العام ممنوع؛ الـ relay يستخدم service_role فقط.
--   en: new tables for user state, portal links, quotas, OTP, identities and
--       the task queue. No anon policies; all access goes through service_role.
-- ============================================================================

create extension if not exists pgcrypto;

create table if not exists public.office_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  direction text not null check (direction in ('in', 'out')),
  chat_id bigint,
  username text,
  text text not null,
  delivered boolean not null default false,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists office_messages_created_idx on public.office_messages (created_at desc);
create index if not exists office_messages_chat_idx on public.office_messages (chat_id, created_at desc);

create table if not exists public.office_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  actor text,
  summary text,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists office_events_created_idx on public.office_events (created_at desc);

-- Optional encrypted state sync. `workspace` is SHA-256(sync secret), never the
-- secret itself, and `state` is an AES-256-GCM blob produced in the browser.
create table if not exists public.office_sync (
  workspace text primary key,
  state text not null,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.office_messages enable row level security;
alter table public.office_events enable row level security;
alter table public.office_sync enable row level security;

-- Intentionally no policies for anon/authenticated. All access is through
-- service_role in Edge Functions, so the office data is not publicly readable.

-- Atomic, optimistic-concurrency write. Returns a conflict row with the newer
-- state when the browser's version is stale.
create or replace function public.office_sync_write(
  p_workspace text,
  p_state text,
  p_expected bigint
) returns table (version bigint, state text, conflict boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_version bigint;
  cur_state text;
begin
  -- Qualify the column references: this function has OUT parameters named
  -- "version" and "state", so bare names are ambiguous in PL/pgSQL.
  select s.version, s.state into cur_version, cur_state
    from public.office_sync s where s.workspace = p_workspace for update;

  if not found then
    insert into public.office_sync (workspace, state, version)
      values (p_workspace, p_state, 1)
      returning office_sync.version, office_sync.state into version, state;
    conflict := false;
    return next;
    return;
  end if;

  if p_expected <> cur_version then
    version := cur_version;
    state := cur_state;
    conflict := true;
    return next;
    return;
  end if;

  update public.office_sync
     set state = p_state, version = cur_version + 1, updated_at = now()
   where workspace = p_workspace
   returning office_sync.version, office_sync.state into version, state;
  conflict := false;
  return next;
end;
$$;

-- Keep only the last 5000 messages/events.
create or replace function public.office_trim() returns void language sql as $$
  delete from public.office_messages where id not in (
    select id from public.office_messages order by created_at desc limit 5000
  );
  delete from public.office_events where id not in (
    select id from public.office_events order by created_at desc limit 5000
  );
$$;

-- ============================================================================
-- pwa21 — hard security / backend tables
-- ar: كل الجداول أدناه مشفّرة على مستوى الصفوف (RLS). المستخدم يرى صفوفه فقط،
--     والبحث العام للبوابة يتم داخل الـ relay عبر service_role.
-- en: all tables below use RLS. A signed-in user sees only their own rows;
--     public portal lookup happens inside the relay via service_role only.
-- ============================================================================

-- Per-user encrypted browser state with optimistic concurrency.
-- ar: حالة المتصفح المشفّرة لكل مستخدم مع رقم إصدار لمنع الكتابة المتزامنة.
create table if not exists public.office_user_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  blob text not null default '',
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);
comment on table public.office_user_state is
  'Encrypted per-user PWA state (blob is opaque); version enables optimistic locking.';

-- Short-lived client portal links. token_hash = SHA-256(raw token), never the token.
-- ar: روابط بوابة العميل؛ يُخزَّن تجزئة الرمز فقط، والرمز نفسه لا يُحفظ أبداً.
create table if not exists public.office_portal_links (
  token_hash text primary key,
  summary jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  expires_at timestamptz not null,
  revoked boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.office_portal_links is
  'Portal links keyed by SHA-256(token). summary must be non-sensitive only.';
-- Earlier deployments already had a simpler portal-links table. Upgrade it in
-- place instead of dropping customer links: add the columns the relay expects
-- and relax legacy NOT NULL columns that the new summary-only flow does not use.
alter table public.office_portal_links
  add column if not exists summary jsonb not null default '{}'::jsonb;
alter table public.office_portal_links
  add column if not exists created_by uuid;
alter table public.office_portal_links
  alter column customer_id drop not null;
alter table public.office_portal_links
  alter column label drop not null;

create index if not exists office_portal_links_expiry_idx
  on public.office_portal_links (expires_at);

-- Daily per-user provider counters (reserve/release are atomic RPCs below).
-- ar: عدّاد يومي لكل مستخدم ومزود؛ الحجز والإلغاء عبر دوال ذرية.
create table if not exists public.office_quota_daily (
  user_id uuid not null references auth.users (id) on delete cascade,
  provider text not null check (provider in ('groq', 'openrouter')),
  day date not null default current_date,
  requests int not null default 0,
  cost numeric(12, 4) not null default 0,
  primary key (user_id, provider, day)
);
comment on table public.office_quota_daily is
  'Daily request/cost counters. Limits come from relay env, never from the client.';

-- One-time codes. code_hash = SHA-256(code + OFFICE_OTP_SALT); no plaintext code.
-- ar: رموز لمرة واحدة؛ تُخزَّن التجزئة فقط مع الملح السري، ولا يُخزَّن الرمز.
-- meta holds user_id, email, target and telegram_chat_id for webhook matching.
create table if not exists public.office_otp_codes (
  target_hash text not null,
  channel text not null check (channel in ('telegram', 'whatsapp', 'google')),
  code_hash text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  used boolean not null default false,
  created_at timestamptz not null default now(),
  meta jsonb not null default '{}'::jsonb,
  primary key (target_hash, channel)
);
comment on table public.office_otp_codes is
  'OTP hashes only. No public policies — telegram-webhook uses service_role.';
create index if not exists office_otp_codes_expiry_idx on public.office_otp_codes (expires_at);
create index if not exists office_otp_codes_chat_idx
  on public.office_otp_codes ((meta ->> 'telegram_chat_id'));

-- Verified channel targets for a Google-signed-in user.
-- ar: القنوات المؤكدة المرتبطة بحساب Google؛ التحديث لأصحاب الحساب فقط.
create table if not exists public.office_identities (
  user_id uuid primary key references auth.users (id) on delete cascade,
  telegram text,
  whatsapp text,
  google_email text,
  updated_at timestamptz not null default now()
);
comment on table public.office_identities is
  'Normalized E.164 channel targets linked to a verified Google user.';

-- Deterministic, no-model task queue run by the scheduled Actions workflow.
-- ar: قائمة مهام بلا نماذج ذكاء اصطناعي؛ ينفّذها الـ Actions كل 5 دقائق.
create table if not exists public.office_task_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'generic',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'done', 'archived', 'failed')),
  run_after timestamptz not null default now(),
  attempts int not null default 0,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.office_task_queue is
  'Deterministic task queue; queue_run uses only OFFICE_QUEUE_SECRET, never model keys.';
create index if not exists office_task_queue_due_idx
  on public.office_task_queue (status, run_after) where status = 'pending';
create index if not exists office_task_queue_owner_idx
  on public.office_task_queue (user_id, created_at desc);

alter table public.office_user_state enable row level security;
alter table public.office_portal_links enable row level security;
alter table public.office_quota_daily enable row level security;
alter table public.office_otp_codes enable row level security;
alter table public.office_identities enable row level security;
alter table public.office_task_queue enable row level security;

-- office_otp_codes intentionally has NO policies (not even for authenticated).
-- ar: لا توجد أي سياسة عامة لرموز OTP — الـ service_role فقط.

drop policy if exists "office_state_select_own" on public.office_user_state;
create policy "office_state_select_own" on public.office_user_state
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "office_state_insert_own" on public.office_user_state;
create policy "office_state_insert_own" on public.office_user_state
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "office_state_update_own" on public.office_user_state;
create policy "office_state_update_own" on public.office_user_state
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "office_state_delete_own" on public.office_user_state;
create policy "office_state_delete_own" on public.office_user_state
  for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "office_portal_select_own" on public.office_portal_links;
create policy "office_portal_select_own" on public.office_portal_links
  for select to authenticated using (auth.uid() = created_by);

drop policy if exists "office_quota_select_own" on public.office_quota_daily;
create policy "office_quota_select_own" on public.office_quota_daily
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "office_identity_select_own" on public.office_identities;
create policy "office_identity_select_own" on public.office_identities
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "office_identity_update_own" on public.office_identities;
create policy "office_identity_update_own" on public.office_identities
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "office_task_select_own" on public.office_task_queue;
create policy "office_task_select_own" on public.office_task_queue
  for select to authenticated using (auth.uid() = user_id);
drop policy if exists "office_task_insert_own" on public.office_task_queue;
create policy "office_task_insert_own" on public.office_task_queue
  for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "office_task_update_own" on public.office_task_queue;
create policy "office_task_update_own" on public.office_task_queue
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "office_task_delete_own" on public.office_task_queue;
create policy "office_task_delete_own" on public.office_task_queue
  for delete to authenticated using (auth.uid() = user_id);

-- Atomic state_put for office-relay (p_user_id comes from the verified JWT sub).
-- ar: كتابة ذرية مع تحقق من رقم الإصدار؛ يمنع تجاوز تحديثات المستخدم الآخر.
create or replace function public.office_user_state_write(
  p_user_id uuid,
  p_blob text,
  p_expected bigint
) returns table (version bigint, blob text, conflict boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  cur_version bigint;
  cur_blob text;
begin
  if p_user_id is null or p_blob is null or length(p_blob) > 8000000 then
    raise exception 'invalid state payload';
  end if;

  select s.version, s.blob into cur_version, cur_blob
    from public.office_user_state s where s.user_id = p_user_id for update;

  if not found then
    insert into public.office_user_state (user_id, blob, version)
      values (p_user_id, p_blob, 1)
      returning office_user_state.version, office_user_state.blob into version, blob;
    conflict := false;
    return next;
    return;
  end if;

  if p_expected <> cur_version then
    version := cur_version;
    blob := cur_blob;
    conflict := true;
    return next;
    return;
  end if;

  update public.office_user_state s
     set blob = p_blob, version = cur_version + 1, updated_at = now()
   where s.user_id = p_user_id
   returning s.version, s.blob into version, blob;
  conflict := false;
  return next;
end;
$$;

-- Atomic quota reserve. Returns used request count and the caller-supplied limit.
-- ar: حجز ذري للحصة؛ الحد يأتي من إعدادات السيرفر وليس من المتصفح.
drop function if exists public.office_quota_reserve(uuid, text, numeric, int);
drop function if exists public.office_quota_release(uuid, text, numeric);
create or replace function public.office_quota_reserve(
  p_user_id uuid,
  p_provider text,
  p_cost numeric,
  p_limit int
) returns table (allowed boolean, used int, daily_limit int, quota_day date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
  v_cost numeric := greatest(coalesce(p_cost, 0), 0);
begin
  if p_user_id is null or p_provider not in ('groq', 'openrouter') then
    raise exception 'invalid quota request';
  end if;

  quota_day := v_day;
  daily_limit := greatest(coalesce(p_limit, 0), 0);

  if daily_limit <= 0 then
    select coalesce(sum(q.requests), 0)::int into used
      from public.office_quota_daily q
     where q.user_id = p_user_id and q.provider = p_provider and q.day = v_day;
    allowed := false;
    return next;
    return;
  end if;

  insert into public.office_quota_daily (user_id, provider, day, requests, cost)
  values (p_user_id, p_provider, v_day, 1, v_cost)
  on conflict (user_id, provider, day) do update
     set requests = public.office_quota_daily.requests + 1,
         cost = public.office_quota_daily.cost + v_cost
   where public.office_quota_daily.requests < daily_limit
  returning office_quota_daily.requests into used;

  if found then
    allowed := true;
  else
    select coalesce(q.requests, 0) into used
      from public.office_quota_daily q
     where q.user_id = p_user_id and q.provider = p_provider and q.day = v_day;
    allowed := false;
  end if;
  return next;
end;
$$;

-- Release a failed reservation (never below zero).
-- ar: إلغاء الحجز عند فشل الاتصال؛ لا ينزل العدّاد عن الصفر.
create or replace function public.office_quota_release(
  p_user_id uuid,
  p_provider text,
  p_cost numeric
) returns table (used int, cost numeric, quota_day date)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (now() at time zone 'utc')::date;
begin
  if p_user_id is null or p_provider not in ('groq', 'openrouter') then
    raise exception 'invalid quota request';
  end if;

  quota_day := v_day;
  update public.office_quota_daily q
     set requests = greatest(q.requests - 1, 0),
         cost = greatest(q.cost - greatest(coalesce(p_cost, 0), 0), 0)
   where q.user_id = p_user_id and q.provider = p_provider and q.day = v_day
  returning q.requests, q.cost into used, cost;

  if not found then
    used := 0;
    cost := 0;
  end if;
  return next;
end;
$$;

-- Verify an OTP hash atomically, mark it used and link the channel identity.
-- The plaintext code never reaches SQL: p_code_hash = SHA-256(code + salt).
-- ar: تحقق ذري من الرمز وربط القناة؛ الرمز الخام لا يصل إلى قاعدة البيانات.
create or replace function public.office_otp_consume(
  p_target_hash text,
  p_channel text,
  p_code_hash text,
  p_email text default '',
  p_max_attempts int default 5
) returns table (ok boolean, linked boolean, attempts_left int, error text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.office_otp_codes%rowtype;
  v_owner uuid;
  v_target text;
  v_email text;
begin
  ok := false;
  linked := false;
  attempts_left := 0;
  error := null;

  select * into v_row
    from public.office_otp_codes c
   where c.target_hash = p_target_hash and c.channel = p_channel
   for update;

  if not found then
    error := 'invalid code';
    return next;
    return;
  end if;

  if v_row.used then
    error := 'code already used';
    return next;
    return;
  end if;

  if v_row.expires_at <= now() then
    error := 'code expired';
    update public.office_otp_codes c set used = true
     where c.target_hash = p_target_hash and c.channel = p_channel;
    return next;
    return;
  end if;

  if v_row.attempts >= p_max_attempts then
    error := 'too many attempts';
    update public.office_otp_codes c set used = true
     where c.target_hash = p_target_hash and c.channel = p_channel;
    return next;
    return;
  end if;

  if v_row.code_hash is distinct from p_code_hash then
    update public.office_otp_codes c set attempts = c.attempts + 1
     where c.target_hash = p_target_hash and c.channel = p_channel;
    attempts_left := greatest(p_max_attempts - v_row.attempts - 1, 0);
    error := 'invalid code';
    return next;
    return;
  end if;

  v_owner := nullif(v_row.meta ->> 'user_id', '')::uuid;
  if v_owner is null then
    error := 'code has no owner';
    return next;
    return;
  end if;

  v_target := coalesce(nullif(v_row.meta ->> 'target', ''), p_target_hash);
  -- The email recorded with the OTP wins: a caller must not be able to
  -- overwrite the requester's linked Google email by consuming their code.
  v_email := coalesce(
    nullif(v_row.meta ->> 'email', ''),
    nullif(trim(coalesce(p_email, '')), '')
  );

  update public.office_otp_codes c
     set used = true,
         meta = coalesce(c.meta, '{}'::jsonb)
             || jsonb_build_object('verified', true, 'verified_at', now())
   where c.target_hash = p_target_hash and c.channel = p_channel;

  insert into public.office_identities (user_id, telegram, whatsapp, google_email, updated_at)
  values (
    v_owner,
    case when p_channel = 'telegram' then v_target end,
    case when p_channel = 'whatsapp' then v_target end,
    v_email,
    now()
  )
  on conflict (user_id) do update
     set telegram = case when p_channel = 'telegram' then v_target
                         else public.office_identities.telegram end,
         whatsapp = case when p_channel = 'whatsapp' then v_target
                         else public.office_identities.whatsapp end,
         google_email = coalesce(v_email, public.office_identities.google_email),
         updated_at = now();

  ok := true;
  linked := true;
  attempts_left := greatest(p_max_attempts - v_row.attempts, 0);
  error := null;
  return next;
end;
$$;

-- Claim due tasks with row locking so two runners cannot execute the same row.
-- Tasks stranded in "running" by a crashed runner become claimable after
-- 15 minutes (the workflow itself is capped at 5 minutes).
-- ar: حجز المهام المستحقة بقفل صفوف لمنع التنفيذ المزدوج، واستعادة المهام
--     التي توقفت بسبب فشل المُنفّذ بعد 15 دقيقة.
create or replace function public.office_task_claim(p_limit int default 25)
returns table (id uuid, user_id uuid, kind text, payload jsonb)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with picked as (
    select q.id
      from public.office_task_queue q
     where (q.status = 'pending' and q.run_after <= now())
        or (q.status = 'running' and q.updated_at < now() - interval '15 minutes')
     order by q.run_after, q.created_at
     limit greatest(1, least(coalesce(p_limit, 25), 100))
       for update skip locked
  )
  update public.office_task_queue q
     set status = 'running', attempts = q.attempts + 1, updated_at = now()
    from picked
   where q.id = picked.id
  returning q.id, q.user_id, q.kind, q.payload;
end;
$$;

-- Finish a task. p_user_id limits a client completion to its own row;
-- service_role passes NULL when the scheduled runner finishes a claimed task.
-- ar: إغلاق المهمة؛ المستخدم يغلق مهامه فقط والمجدول يغلق ما حجزه.
create or replace function public.office_task_finish(
  p_id uuid,
  p_user_id uuid,
  p_status text,
  p_result jsonb
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_done boolean := false;
begin
  if p_status not in ('done', 'archived', 'failed') then
    raise exception 'invalid task status';
  end if;

  update public.office_task_queue q
     set status = p_status, result = p_result, updated_at = now()
   where q.id = p_id
     and (p_user_id is null or q.user_id = p_user_id)
   returning true into v_done;

  return coalesce(v_done, false);
end;
$$;

-- These RPCs are service_role-only. Browser code must never execute them.
-- ar: هذه الدوال للـ service_role فقط؛ لا يمكن للمتصفح استدعاءها.
revoke all on function public.office_sync_write(text, text, bigint) from public, anon, authenticated;
revoke all on function public.office_trim() from public, anon, authenticated;
revoke all on function public.office_user_state_write(uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.office_quota_reserve(uuid, text, numeric, int) from public, anon, authenticated;
revoke all on function public.office_quota_release(uuid, text, numeric) from public, anon, authenticated;
revoke all on function public.office_otp_consume(text, text, text, text, int) from public, anon, authenticated;
revoke all on function public.office_task_claim(int) from public, anon, authenticated;
revoke all on function public.office_task_finish(uuid, uuid, text, jsonb) from public, anon, authenticated;

grant execute on function public.office_sync_write(text, text, bigint) to service_role;
grant execute on function public.office_trim() to service_role;
grant execute on function public.office_user_state_write(uuid, text, bigint) to service_role;
grant execute on function public.office_quota_reserve(uuid, text, numeric, int) to service_role;
grant execute on function public.office_quota_release(uuid, text, numeric) to service_role;
grant execute on function public.office_otp_consume(text, text, text, text, int) to service_role;
grant execute on function public.office_task_claim(int) to service_role;
grant execute on function public.office_task_finish(uuid, uuid, text, jsonb) to service_role;
