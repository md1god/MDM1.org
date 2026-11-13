#!/usr/bin/env python3
"""Apply MDM1 Supabase hardening migrations and verify RLS.

Safety:
- Requires SUPABASE_DB_URL; no database credentials are stored in the repository.
- Defaults to --dry-run. Use --apply for a live change.
- Uses psql with ON_ERROR_STOP and a migration ledger, so reruns are idempotent.
- Never prints the connection string or secret values.
"""
from __future__ import annotations

import argparse
import json
import os
import shlex
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MIGRATIONS = [
    ROOT / "supabase/migrations/005_ideas_privacy_hardening.sql",
    ROOT / "supabase/migrations/006_ads_reports_hardening.sql",
]

VERIFY_SQL = r"""
select json_build_object(
  'rls', coalesce((select json_object_agg(relname, relrowsecurity)
    from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname in ('profiles','ideas','idea_replies','ads','ad_reports')), '{}'::json),
  'views', coalesce((select json_agg(table_name order by table_name)
    from information_schema.views where table_schema='public'
      and table_name in ('ideas_public','idea_replies_public')), '[]'::json),
  'policies', coalesce((select json_agg(json_build_object('table', tablename, 'name', policyname, 'command', cmd)
    order by tablename, policyname)
    from pg_policies where schemaname='public'
      and tablename in ('profiles','ideas','idea_replies','ads','ad_reports')), '[]'::json),
  'public_table_select', coalesce((select json_agg(json_build_object('table', table_name, 'grantee', grantee))
    from information_schema.role_table_grants
    where table_schema='public' and table_name in ('profiles','ideas','idea_replies','ad_reports')
      and grantee in ('anon','authenticated') and privilege_type='SELECT'), '[]'::json),
  'report_ad_has_auto_hide', exists(
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='report_ad'
      and pg_get_functiondef(p.oid) ilike '%update public.ads set status%'
  )
);
"""


def run_psql(db_url: str, sql: str | None = None, file: Path | None = None) -> str:
    cmd = ["psql", db_url, "--no-psqlrc", "--set", "ON_ERROR_STOP=1", "--tuples-only", "--no-align"]
    if sql is not None:
        cmd += ["--command", sql]
    elif file is not None:
        cmd += ["--file", str(file)]
    else:
        raise ValueError("sql or file is required")
    try:
        result = subprocess.run(cmd, check=True, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    except FileNotFoundError:
        raise RuntimeError("psql غير مثبت؛ ثبّت PostgreSQL client ثم أعد التشغيل")
    except subprocess.CalledProcessError as exc:
        raise RuntimeError(f"psql فشل (exit {exc.returncode}): {exc.stderr[-1200:]}")
    return result.stdout.strip()


def verify(db_url: str) -> dict:
    raw = run_psql(db_url, sql=VERIFY_SQL)
    if not raw:
        raise RuntimeError("لم تُرجع قاعدة البيانات نتيجة تحقق")
    data = json.loads(raw.splitlines()[-1])
    rls = data.get("rls") or {}
    required = ["profiles", "ideas", "idea_replies", "ads", "ad_reports"]
    problems = [f"RLS غير مفعّل على {name}" for name in required if rls.get(name) is not True]
    if "ideas_public" not in (data.get("views") or []) or "idea_replies_public" not in (data.get("views") or []):
        problems.append("views العامة الآمنة للوحة الأفكار غير موجودة")
    if data.get("public_table_select"):
        problems.append("ما زالت صلاحية SELECT مباشرة موجودة على جداول داخلية")
    if data.get("report_ad_has_auto_hide"):
        problems.append("report_ad ما زالت تحتوي على إخفاء تلقائي للإعلان")
    data["verification"] = "PASS" if not problems else "FAIL"
    data["problems"] = problems
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="نفّذ على قاعدة Supabase الحية")
    parser.add_argument("--verify-only", action="store_true", help="تحقق فقط من قاعدة البيانات")
    parser.add_argument("--migration", action="append", type=Path, help="migration إضافية؛ يمكن تكرار الخيار")
    args = parser.parse_args()

    db_url = os.environ.get("SUPABASE_DB_URL", "").strip()
    migrations = args.migration or DEFAULT_MIGRATIONS
    missing = [str(p) for p in migrations if not p.is_file()]
    if missing:
        print(json.dumps({"status": "error", "missing": missing}, ensure_ascii=False), file=sys.stderr)
        return 2

    if not db_url:
        if args.apply or args.verify_only:
            print("SUPABASE_DB_URL غير مضبوط؛ لم يتم الاتصال أو التعديل.", file=sys.stderr)
            return 2
        print(json.dumps({"status": "dry-run", "migrations": [str(p.relative_to(ROOT)) for p in migrations],
                          "next": "صدّر SUPABASE_DB_URL ثم شغّل --apply", "psql_required": True}, ensure_ascii=False, indent=2))
        return 0

    if args.verify_only:
        result = verify(db_url)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0 if result["verification"] == "PASS" else 1

    if not args.apply:
        print(json.dumps({"status": "dry-run", "migrations": [str(p.relative_to(ROOT)) for p in migrations],
                          "message": "لم يُنفّذ شيء. استخدم --apply للتنفيذ و--verify-only للتحقق."}, ensure_ascii=False, indent=2))
        return 0

    ledger_sql = """
create table if not exists public.mdm1_schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
revoke all on public.mdm1_schema_migrations from anon, authenticated;
"""
    run_psql(db_url, sql=ledger_sql)
    applied, skipped = [], []
    for migration in migrations:
        name = migration.name.replace("'", "''")
        already = run_psql(db_url, sql=f"select 1 from public.mdm1_schema_migrations where filename = '{name}' limit 1;")
        if already.strip() == "1":
            skipped.append(name)
            continue
        # Run each file separately, then record it only after successful completion.
        run_psql(db_url, file=migration)
        run_psql(db_url, sql=f"insert into public.mdm1_schema_migrations(filename) values ('{name}');")
        applied.append(name)

    result = verify(db_url)
    result.update({"status": "applied", "applied": applied, "skipped": skipped})
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result["verification"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
