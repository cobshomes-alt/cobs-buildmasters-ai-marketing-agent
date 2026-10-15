import type { PGlite } from "@electric-sql/pglite";
import schema from "../fixtures/cobs-existing-schema.json";

const identifier = (name: string) => '"' + name.replaceAll('"', '""') + '"';
export async function restoreExistingSchema(
  db: PGlite,
  users: { id: string; email: string }[],
) {
  await db.exec(`create schema auth; create schema storage; create role anon; create role authenticated;
    create table auth.users(id uuid primary key,email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table storage.buckets(id text primary key,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
    create table public.media_assets(storage_path text,organization_id uuid);
    create function public.same_org(uuid) returns boolean language sql as $$select false$$;
    create table public.unrelated_records(id integer primary key,note text);
    insert into public.unrelated_records values (1,'Preserve unrelated application data');`);
  for (const user of users)
    await db.query("insert into auth.users values ($1,$2)", [
      user.id,
      user.email,
    ]);
  for (const table of schema.tables) {
    const columns = schema.columns
      .filter((c) => c.table_name === table.name)
      .map(
        (c) =>
          `${identifier(c.column_name)} ${c.data_type}${c.column_default ? " default " + c.column_default : ""}${c.is_nullable === "NO" ? " not null" : ""}`,
      );
    await db.exec(
      `create table public.${identifier(table.name)} (${columns.join(",")});`,
    );
    if (table.rls)
      await db.exec(
        `alter table public.${identifier(table.name)} enable row level security;`,
      );
  }
  for (const c of schema.constraints)
    await db.exec(
      `alter table public.${identifier(c.table)} add constraint ${identifier(c.name)} ${c.definition};`,
    );
  for (const fn of schema.functions) await db.exec(fn.definition);
  for (const trigger of schema.triggers) await db.exec(trigger.definition);
  for (const p of schema.policies) await db.exec(policySql(p));
  for (const g of schema.grants)
    await db.exec(
      `grant ${g.privilege_type} on public.${identifier(g.table_name)} to ${identifier(g.grantee)};`,
    );
  await db.exec(
    `grant usage on schema public,auth,storage to anon,authenticated; grant select,insert,update,delete on storage.objects to authenticated;`,
  );
  for (const b of schema.media_bucket)
    await db.query("insert into storage.buckets values ($1,$2,$3,$4)", [
      b.id,
      b.public,
      b.file_size_limit,
      b.allowed_mime_types,
    ]);
}
type Policy = {
  policyname: string;
  tablename: string;
  schemaname: string;
  cmd: string;
  roles: string[];
  qual: string | null;
  with_check: string | null;
};
function policySql(p: Policy) {
  return `create policy ${identifier(p.policyname)} on ${identifier(p.schemaname)}.${identifier(p.tablename)} for ${p.cmd} to ${p.roles.map((r) => (r === "public" ? "PUBLIC" : identifier(r))).join(",")}${p.qual ? " using (" + p.qual + ")" : ""}${p.with_check ? " with check (" + p.with_check + ")" : ""};`;
}

export function targetedRollbackSql() {
  const originalPolicy = schema.policies.find(
    (p) => p.policyname === "owner manages cobs media objects",
  )!;
  return `-- Recovery for the inspected empty COBS workspace only. Never run automatically.
begin;
set local lock_timeout='5s';
do $$ begin
 if exists(select 1 from public.cobs_posts) or exists(select 1 from public.cobs_campaigns)
 or exists(select 1 from public.cobs_leads) or exists(select 1 from public.cobs_media_assets)
 or exists(select 1 from storage.objects where bucket_id='cobs-media') then
 raise exception 'Recovery refused: new records exist. Preserve them and obtain a revised recovery plan.';
 end if;
end; $$;
drop trigger if exists cobs_post_approval_guard on public.cobs_posts;
drop trigger if exists cobs_media_identity_guard on public.cobs_media_assets;
drop function if exists public.cobs_guard_post();
drop function if exists public.cobs_guard_media_identity();
drop policy if exists "owner reads media" on storage.objects;
drop policy if exists "owner uploads media" on storage.objects;
drop policy if exists "owner removes unused media" on storage.objects;
${policySql(originalPolicy)}
drop index if exists public.cobs_posts_media_idx;
drop index if exists public.cobs_media_campaign_idx;
alter table public.cobs_posts drop column campaign_id,drop column media_id,drop column approved_by,drop column approved_at;
alter table public.cobs_posts alter column source drop not null;
alter table public.cobs_media_assets drop column project,drop column product,drop column campaign_id,drop column deletion_pending;
alter table public.cobs_leads drop column created_by;
${schema.grants
  .filter((g) =>
    ["TRUNCATE", "REFERENCES", "TRIGGER"].includes(g.privilege_type),
  )
  .map(
    (g) =>
      `grant ${g.privilege_type} on public.${identifier(g.table_name)} to ${identifier(g.grantee)};`,
  )
  .join("\n")}
commit;`;
}
