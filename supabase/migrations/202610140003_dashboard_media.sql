-- Apply after 202610140002_secure_workspace.sql.
begin;
alter table public.cobs_media_assets add column if not exists project text not null default '';
alter table public.cobs_media_assets add column if not exists product text not null default '';
alter table public.cobs_media_assets add column if not exists campaign_id uuid references public.cobs_campaigns(id) on delete set null;
alter table public.cobs_media_assets add column if not exists deletion_pending boolean not null default false;
alter table public.cobs_posts add column if not exists campaign_id uuid references public.cobs_campaigns(id) on delete set null;
alter table public.cobs_posts add column if not exists media_id uuid references public.cobs_media_assets(id) on delete restrict;
alter table public.cobs_posts add column if not exists approved_by uuid references auth.users(id);
alter table public.cobs_posts add column if not exists approved_at timestamptz;
-- Historical approvals have no owner audit record; require fresh review.
update public.cobs_posts set status = 'Draft', scheduled_at = null
where status in ('Approved','Scheduled') and approved_by is null;

-- Existing authenticated users also need profiles (the original trigger only covers new signups).
insert into public.cobs_profiles (id, email, role)
select id, lower(email), case when lower(email) = 'cobshomes@gmail.com' then 'owner' else 'member' end
from auth.users where email is not null on conflict (id) do nothing;

create or replace function public.cobs_guard_post()
returns trigger language plpgsql set search_path = public as $$
begin
  if not public.cobs_is_owner() then raise exception 'Owner permission required'; end if;
  if new.media_id is not null then
    -- Serialize attachment changes against media removal on another device.
    perform 1 from public.cobs_media_assets where id = new.media_id and not deletion_pending for share;
    if not found then raise exception 'Media is unavailable or being removed'; end if;
  end if;
  if char_length(trim(new.title)) not between 1 and 240 or char_length(trim(new.body)) not between 1 and 10000 then
    raise exception 'Title or body length is invalid';
  end if;
  if TG_OP = 'INSERT' then
    if new.created_by <> auth.uid() then raise exception 'Invalid author'; end if;
    new.status := 'Draft'; new.approved_by := null; new.approved_at := null; new.scheduled_at := null;
  else
    if new.created_by <> old.created_by then raise exception 'Author cannot be changed'; end if;
    if (new.title, new.body, new.media_id, new.campaign_id, new.source) is distinct from
       (old.title, old.body, old.media_id, old.campaign_id, old.source) then
      new.status := 'Draft'; new.approved_by := null; new.approved_at := null; new.scheduled_at := null;
    elsif new.status is distinct from old.status then
      if not ((old.status in ('Draft','Rejected') and new.status = 'Pending approval') or
              (old.status = 'Pending approval' and new.status in ('Approved','Rejected')) or
              (old.status = 'Approved' and new.status = 'Scheduled')) then
        raise exception 'Invalid approval transition';
      end if;
      if new.status = 'Approved' then new.approved_by := auth.uid(); new.approved_at := now();
      elsif new.status <> 'Scheduled' then new.approved_by := null; new.approved_at := null; new.scheduled_at := null;
      end if;
    else
      new.approved_by := old.approved_by; new.approved_at := old.approved_at;
    end if;
    if new.status = 'Scheduled' and (new.approved_by is null or new.approved_at is null) then
      raise exception 'Owner approval required before publishing readiness';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists cobs_post_approval_guard on public.cobs_posts;
create trigger cobs_post_approval_guard before insert or update on public.cobs_posts
for each row execute function public.cobs_guard_post();

-- Never overwrite a media object or its content identity: replacements are new assets.
drop policy if exists "owner manages cobs media objects" on storage.objects;
create policy "owner reads media" on storage.objects for select to authenticated
using (bucket_id = 'cobs-media' and public.cobs_is_owner());
create policy "owner uploads media" on storage.objects for insert to authenticated
with check (bucket_id = 'cobs-media' and public.cobs_is_owner() and (storage.foldername(name))[1] = auth.uid()::text);
create policy "owner removes unused media" on storage.objects for delete to authenticated
using (bucket_id = 'cobs-media' and public.cobs_is_owner() and not exists (
  select 1 from public.cobs_media_assets a join public.cobs_posts p on p.media_id = a.id where a.storage_path = name
));
create or replace function public.cobs_guard_media_identity()
returns trigger language plpgsql as $$ begin
  if new.deletion_pending and exists (select 1 from public.cobs_posts where media_id = old.id) then
    raise exception 'Attached media cannot be removed';
  end if;
  if (new.storage_path, new.mime_type, new.size_bytes, new.created_by) is distinct from
     (old.storage_path, old.mime_type, old.size_bytes, old.created_by) then
    raise exception 'Upload a new asset to replace media';
  end if;
  return new;
end; $$;
create trigger cobs_media_identity_guard before update on public.cobs_media_assets
for each row execute function public.cobs_guard_media_identity();
create index if not exists cobs_posts_media_idx on public.cobs_posts(media_id);
create index if not exists cobs_media_campaign_idx on public.cobs_media_assets(campaign_id);
commit;
