import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, test, expect } from "vitest";

const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const post = "33333333-3333-4333-8333-333333333333";
beforeAll(async () => {
  await db.exec(`create schema auth; create schema storage; create role authenticated;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true),'')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;`);
  await db.exec(
    readFileSync(
      "supabase/migrations/202610140002_secure_workspace.sql",
      "utf8",
    ),
  );
  // Simulates users that existed before the profile trigger was installed.
  await db.exec(`alter table auth.users disable trigger cobs_profile_after_signup;
    insert into auth.users values ('${owner}','cobshomes@gmail.com'),('${member}','member@example.com');
    alter table auth.users enable trigger cobs_profile_after_signup;`);
  await db.exec(
    readFileSync(
      "supabase/migrations/202610140003_dashboard_media.sql",
      "utf8",
    ),
  );
  await db.exec(`grant usage on schema public,auth,storage to authenticated;
    grant select,insert,update,delete on all tables in schema public,storage to authenticated;
    set role authenticated; set test.uid='${owner}';`);
}, 30000);
afterAll(async () => {
  await db.close();
});

test("existing owner profile is backfilled and drafts/campaigns persist", async () => {
  await db.exec(`insert into cobs_campaigns(name,created_by) values ('Factory production','${owner}');
    insert into cobs_posts(id,title,body,created_by,status) values ('${post}','Blocks','Original caption','${owner}','Approved');`);
  const saved = await db.query<{ status: string }>(
    `select status from cobs_posts where id='${post}'`,
  );
  expect(saved.rows[0].status).toBe("Draft");
  expect((await db.query(`select * from cobs_campaigns`)).rows).toHaveLength(1);
});
test("approval cannot be bypassed and scheduling requires approval", async () => {
  await expect(
    db.exec(`update cobs_posts set status='Scheduled' where id='${post}'`),
  ).rejects.toThrow("Invalid approval transition");
  await expect(
    db.exec(`update cobs_posts set status='Approved' where id='${post}'`),
  ).rejects.toThrow("Invalid approval transition");
  await db.exec(
    `update cobs_posts set status='Pending approval' where id='${post}'; update cobs_posts set status='Approved' where id='${post}';`,
  );
  const approved = (
    await db.query<{ approved_by: string; approved_at: string }>(
      `select * from cobs_posts where id='${post}'`,
    )
  ).rows[0];
  expect(approved.approved_by).toBe(owner);
  expect(approved.approved_at).toBeTruthy();
  await db.exec(`update cobs_posts set status='Scheduled' where id='${post}';`);
});
test("editing approved content clears approval and readiness in the database", async () => {
  await db.exec(
    `update cobs_posts set body='Revised caption',status='Approved' where id='${post}';`,
  );
  const row = (
    await db.query<{
      status: string;
      approved_by: null;
      approved_at: null;
      scheduled_at: null;
    }>(`select * from cobs_posts where id='${post}'`)
  ).rows[0];
  expect(row.status).toBe("Draft");
  expect(row.approved_by).toBeNull();
  expect(row.approved_at).toBeNull();
  expect(row.scheduled_at).toBeNull();
});
test("member cannot read workspace data, approve content or upload objects", async () => {
  await db.exec(`set test.uid='${member}';`);
  expect((await db.query(`select * from cobs_posts`)).rows).toHaveLength(0);
  expect((await db.query(`select * from cobs_campaigns`)).rows).toHaveLength(0);
  expect(
    (await db.query(`update cobs_posts set status='Approved' returning id`))
      .rows,
  ).toHaveLength(0);
  await expect(
    db.exec(
      `insert into cobs_campaigns(name,created_by) values('Forbidden','${member}')`,
    ),
  ).rejects.toThrow();
  await expect(
    db.exec(
      `insert into storage.objects(bucket_id,name) values ('cobs-media','${member}/file.jpg')`,
    ),
  ).rejects.toThrow();
  await db.exec(`set test.uid='${owner}';`);
});

test("owner may reject and resubmit content for a fresh review", async () => {
  await db.exec(`update cobs_posts set status='Pending approval' where id='${post}';
    update cobs_posts set status='Rejected' where id='${post}';`);
  expect(
    (
      await db.query<{ status: string; approved_at: null }>(
        `select * from cobs_posts where id='${post}'`,
      )
    ).rows[0],
  ).toMatchObject({ status: "Rejected", approved_at: null });
  await db.exec(`update cobs_posts set status='Pending approval' where id='${post}';
    update cobs_posts set status='Approved' where id='${post}';
    update cobs_posts set body='Fresh caption for media' where id='${post}';`);
});
test("private media cannot be overwritten or deleted while attached; replacing resets approval", async () => {
  const asset = "44444444-4444-4444-8444-444444444444";
  await db.exec(`insert into storage.objects(bucket_id,name) values ('cobs-media','${owner}/file.jpg');
    insert into cobs_media_assets(id,storage_path,original_name,mime_type,size_bytes,created_by)
    values ('${asset}','${owner}/file.jpg','Blocks.jpg','image/jpeg',100,'${owner}');
    update cobs_posts set media_id='${asset}' where id='${post}';
    update cobs_posts set status='Pending approval' where id='${post}';
    update cobs_posts set status='Approved' where id='${post}';`);
  expect(
    (
      await db.query(
        `update storage.objects set name='changed.jpg' returning id`,
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (await db.query(`delete from storage.objects returning id`)).rows,
  ).toHaveLength(0);
  await expect(
    db.exec(`delete from cobs_media_assets where id='${asset}'`),
  ).rejects.toThrow();
  await expect(
    db.exec(
      `update cobs_media_assets set deletion_pending=true where id='${asset}'`,
    ),
  ).rejects.toThrow("Attached media cannot be removed");
  await expect(
    db.exec(
      `update cobs_media_assets set storage_path='different.jpg' where id='${asset}'`,
    ),
  ).rejects.toThrow("Upload a new asset");
  await db.exec(`update cobs_posts set media_id=null where id='${post}'`);
  await db.exec(
    `update cobs_media_assets set deletion_pending=true where id='${asset}'`,
  );
  await expect(
    db.exec(`update cobs_posts set media_id='${asset}' where id='${post}'`),
  ).rejects.toThrow("Media is unavailable or being removed");
  expect(
    (
      await db.query<{ status: string }>(
        `select status from cobs_posts where id='${post}'`,
      )
    ).rows[0].status,
  ).toBe("Draft");
  expect(
    (await db.query(`delete from storage.objects returning id`)).rows,
  ).toHaveLength(1);
  await db.exec(`delete from cobs_media_assets where id='${asset}'`);
});
