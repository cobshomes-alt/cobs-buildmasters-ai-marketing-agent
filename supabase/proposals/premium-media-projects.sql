-- PROPOSAL ONLY. Not in migrations/; never db push/repair this file.
-- Requires a fresh read-only live preflight, recovery capture and explicit approval.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $$ begin
 if to_regclass('public.cobs_edit_projects') is not null or to_regclass('public.cobs_edit_clips') is not null then raise exception 'Project objects already exist: stop for drift review'; end if;
 if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='owner removes unused media' and cmd='DELETE') then raise exception 'Expected COBS Storage policy missing';end if;
end $$;
create table public.cobs_edit_projects(
 id uuid primary key, title text not null check(char_length(trim(title)) between 1 and 180),
 campaign_id uuid references public.cobs_campaigns(id) on delete set null,
 aspect text not null check(aspect in ('9:16','16:9','1:1','4:5')),
 revision integer not null default 1 check(revision>0),
 created_by uuid not null default auth.uid() references auth.users(id),
 updated_at timestamptz not null default now()
);
create function public.cobs_valid_edit_recipe(r jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(r)='object' and r->'version'='1'::jsonb
 and not exists(select 1 from unnest(array['position','start','duration','brightness','contrast','saturation','volume','fade']) k where jsonb_typeof(r->k) is distinct from 'number')
 and r->>'aspect' in ('9:16','16:9','1:1','4:5') and r->>'fit' in ('contain','cover')
 and (r->>'position')::numeric between 0 and 1 and (r->>'start')::numeric between 0 and 570
 and (r->>'duration')::numeric between 1 and 30 and (r->>'brightness')::numeric between -0.3 and 0.3
 and (r->>'contrast')::numeric between 0.5 and 1.5 and (r->>'saturation')::numeric between 0 and 2
 and (r->>'volume')::numeric between 0 and 2 and (r->>'fade')::numeric between 0 and least(3,(r->>'duration')::numeric/2)
 and jsonb_typeof(r->'watermark')='boolean' and jsonb_typeof(r->'text')='string' and char_length(r->>'text')<=120
 and jsonb_typeof(r->'subtitle')='string' and char_length(r->>'subtitle')<=120
 and r->>'text' !~ '[[:cntrl:]]' and r->>'subtitle' !~ '[[:cntrl:]]',false)
$$;
create table public.cobs_edit_clips(
 id uuid primary key, project_id uuid not null references public.cobs_edit_projects(id) on delete cascade,
 media_id uuid not null references public.cobs_media_assets(id) on delete restrict,
 position integer not null check(position between 0 and 39),
 kind text not null check(kind in ('image','video')),
 label text not null check(char_length(label)<=200),
 recipe jsonb not null check(public.cobs_valid_edit_recipe(recipe)),
 unique(project_id,position)
);
create index cobs_edit_projects_owner_updated_idx on public.cobs_edit_projects(created_by,updated_at desc);
create index cobs_edit_clips_media_idx on public.cobs_edit_clips(media_id);
alter table public.cobs_edit_projects enable row level security;
alter table public.cobs_edit_clips enable row level security;
create policy "COBS owner editing projects" on public.cobs_edit_projects for all to authenticated
 using(public.cobs_is_owner() and created_by=auth.uid()) with check(public.cobs_is_owner() and created_by=auth.uid());
create policy "COBS owner editing clips" on public.cobs_edit_clips for all to authenticated
 using(public.cobs_is_owner() and exists(select 1 from public.cobs_edit_projects p where p.id=project_id and p.created_by=auth.uid()))
 with check(public.cobs_is_owner() and exists(select 1 from public.cobs_edit_projects p where p.id=project_id and p.created_by=auth.uid()));
revoke all on public.cobs_edit_projects,public.cobs_edit_clips from public,anon,authenticated;
grant select,insert,update,delete on public.cobs_edit_projects,public.cobs_edit_clips to authenticated;
create function public.cobs_edit_clip_guard() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from public.cobs_edit_projects p where p.id=new.project_id and p.aspect=new.recipe->>'aspect';
 if not found then raise exception 'Clip aspect differs from production';end if;
 perform 1 from public.cobs_media_assets a where a.id=new.media_id and not a.deletion_pending
 and ((new.kind='image' and a.mime_type in ('image/jpeg','image/png','image/webp')) or (new.kind='video' and a.mime_type in ('video/mp4','video/quicktime'))) for share;
 if not found then raise exception 'Original media unavailable';end if;return new;
end $$;
create trigger cobs_edit_clip_guard before insert or update on public.cobs_edit_clips for each row execute function public.cobs_edit_clip_guard();
create function public.cobs_edit_asset_guard() returns trigger language plpgsql set search_path='' as $$
begin
 if new.deletion_pending and exists(select 1 from public.cobs_edit_clips c where c.media_id=old.id) then raise exception 'Original is referenced by an editing project';end if;return new;
end $$;
create trigger cobs_edit_asset_guard before update of deletion_pending on public.cobs_media_assets for each row execute function public.cobs_edit_asset_guard();
create function public.cobs_edit_media_used(path text) returns boolean language sql stable set search_path='' as $$
 select exists(select 1 from public.cobs_edit_clips c join public.cobs_media_assets a on a.id=c.media_id where a.storage_path=path)
$$;
-- Preserve the exact existing DELETE expression and only add a reference guard.
-- Capture the original pg_policies row externally for exact rollback BEFORE approval.
do $$ declare previous text;begin
 select qual into previous from pg_policies where schemaname='storage' and tablename='objects' and policyname='owner removes unused media';
 execute format('alter policy %I on storage.objects using ((%s) and not public.cobs_edit_media_used(name))','owner removes unused media',previous);
end $$;
create function public.cobs_save_edit_project(document jsonb,expected_revision integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare pid uuid; current_revision integer; c jsonb; ordinal integer:=0; total numeric:=0;
begin
 if not public.cobs_is_owner() then raise exception 'Owner permission required';end if;
 if document->'version' is distinct from '1'::jsonb or coalesce(jsonb_typeof(document->'clips'),'')<>'array' or jsonb_array_length(document->'clips')>40 or expected_revision is null or expected_revision<0 then raise exception 'Invalid timeline';end if;
 pid:=(document->>'id')::uuid;
 select revision into current_revision from public.cobs_edit_projects where id=pid for update;
 if found then
  if expected_revision<>current_revision then raise exception 'Stale project' using errcode='40001';end if;
  update public.cobs_edit_projects set title=document->>'title',campaign_id=nullif(document->>'campaignId','')::uuid,aspect=document->>'aspect',revision=revision+1,updated_at=clock_timestamp() where id=pid;
 else
  if expected_revision<>0 then raise exception 'Missing project' using errcode='40001';end if;
  insert into public.cobs_edit_projects(id,title,campaign_id,aspect,created_by) values(pid,document->>'title',nullif(document->>'campaignId','')::uuid,document->>'aspect',auth.uid());
 end if;
 -- Only this owner's explicitly saved timeline rows are replaced, atomically.
 delete from public.cobs_edit_clips where project_id=pid;
 for c in select value from jsonb_array_elements(document->'clips') loop
  total:=total+(c->'recipe'->>'duration')::numeric;
  if total>300 then raise exception 'Timeline exceeds five minutes';end if;
  insert into public.cobs_edit_clips(id,project_id,media_id,position,kind,label,recipe)
   values((c->>'id')::uuid,pid,(c->>'mediaId')::uuid,ordinal,c->>'kind',c->>'label',c->'recipe');
  ordinal:=ordinal+1;
 end loop;
 return (select jsonb_build_object('id',id,'revision',revision,'updatedAt',updated_at) from public.cobs_edit_projects where id=pid);
end $$;
revoke all on function public.cobs_valid_edit_recipe(jsonb),public.cobs_edit_clip_guard(),public.cobs_edit_asset_guard(),public.cobs_edit_media_used(text),public.cobs_save_edit_project(jsonb,integer) from public,anon,authenticated;
grant execute on function public.cobs_valid_edit_recipe(jsonb),public.cobs_edit_media_used(text),public.cobs_save_edit_project(jsonb,integer) to authenticated;
commit;
