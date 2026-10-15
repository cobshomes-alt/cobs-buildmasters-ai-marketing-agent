import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, expect, test } from "vitest";
import { restoreExistingSchema } from "./helpers/existing-schema";
import schema from "./fixtures/cobs-security-schema.json";
import acls from "./fixtures/cobs-security-acls.json";

const owner = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const campaign = "33333333-3333-4333-8333-333333333333";
const post = "44444444-4444-4444-8444-444444444444";
const media = "55555555-5555-4555-8555-555555555555";
const path = `${owner}/66666666-6666-4666-8666-666666666666.png`;
const sql = (name: string) =>
  readFileSync(`supabase/security-proposals/${name}.sql`, "utf8");
let db: PGlite;

beforeEach(async () => {
  db = new PGlite();
  await restoreExistingSchema(
    db,
    [{ id: owner, email: "cobshomes@gmail.com" }],
    schema,
  );
  await db.exec(`create role service_role bypassrls;
    create role supabase_auth_admin noinherit;
    alter table auth.users owner to supabase_auth_admin;
    grant usage on schema auth to supabase_auth_admin;
    grant insert on auth.users to supabase_auth_admin;
    grant select on public.media_assets to authenticated;`);
  for (const acl of acls) {
    // Reproduce the captured explicit grants, including PUBLIC and service_role.
    await db.exec(
      `grant execute on function public.${acl.function} to public,anon,authenticated,service_role;`,
    );
  }
  await db.query(
    "insert into cobs_profiles(id,email,role) values ($1,$2,'owner')",
    [owner, "cobshomes@gmail.com"],
  );
}, 30000);
afterEach(async () => {
  await db.close();
});
async function actor(role: string, uid = "") {
  await db.exec(`reset role; set role ${role};`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [uid]);
}
async function applyBoth() {
  await db.exec(sql("p1"));
  await db.exec(sql("p2"));
}
async function provisionMember() {
  await actor("supabase_auth_admin");
  await db.query("insert into auth.users(id,email) values ($1,$2)", [
    member,
    "member@example.test",
  ]);
  await db.exec("reset role;");
}
async function capture() {
  await db.exec("reset role;");
  return {
    functions: (
      await db.query(`select proname,(select array_agg(a::text order by a::text) from unnest(proacl) a) as acl,pg_get_functiondef(oid) as definition,
        pg_get_userbyid(proowner) as owner from pg_proc
        where pronamespace='public'::regnamespace and proname like 'cobs_%' order by proname`)
    ).rows,
    policies: (
      await db.query(
        "select * from pg_policies order by schemaname,tablename,policyname",
      )
    ).rows,
    triggers: (
      await db.query(
        "select pg_get_triggerdef(oid) as definition,tgenabled from pg_trigger where not tgisinternal order by tgname",
      )
    ).rows,
    profiles: (await db.query("select * from cobs_profiles order by id")).rows,
    unrelated: (await db.query("select * from unrelated_records")).rows,
    campaigns: (await db.query("select * from cobs_campaigns order by id"))
      .rows,
    posts: (await db.query("select * from cobs_posts order by id")).rows,
  };
}

test("P1 alone preserves owner operations and denies anonymous/non-owner access", async () => {
  await provisionMember();
  await db.exec(sql("p1"));
  await actor("authenticated", owner);
  expect((await db.query("select cobs_is_owner() as allowed")).rows).toEqual([
    { allowed: true },
  ]);
  await db.exec(`insert into cobs_campaigns(id,name,created_by)
    values ('${campaign}','LOCAL SECURITY TEST','${owner}');`);
  await actor("authenticated", member);
  expect((await db.query("select * from cobs_campaigns")).rows).toHaveLength(0);
  await expect(
    db.exec(
      `insert into cobs_campaigns(name,created_by) values ('Forbidden','${member}')`,
    ),
  ).rejects.toThrow();
  await actor("anon");
  expect((await db.query("select * from cobs_campaigns")).rows).toHaveLength(0);
  await expect(db.exec("select cobs_is_owner()")).rejects.toThrow(
    "permission denied",
  );
  await expect(
    db.exec(
      `insert into cobs_campaigns(name,created_by) values ('Forbidden','${owner}')`,
    ),
  ).rejects.toThrow();
});

test("P2 alone provisions members through the Auth writer and preserves existing owner authorization", async () => {
  await db.exec(sql("p2"));
  await provisionMember();
  expect(
    (await db.query("select role from cobs_profiles where id=$1", [member]))
      .rows,
  ).toEqual([{ role: "member" }]);
  await actor("authenticated", owner);
  expect((await db.query("select cobs_is_owner() as allowed")).rows).toEqual([
    { allowed: true },
  ]);
  expect((await db.query("select role from cobs_profiles")).rows).toEqual([
    { role: "owner" },
  ]);
  await expect(db.exec("select cobs_new_user_profile()")).rejects.toThrow(
    "permission denied",
  );
  await actor("authenticated", member);
  expect(
    (
      await db.query(
        "update cobs_profiles set role='owner' where id=auth.uid() returning id",
      )
    ).rows,
  ).toHaveLength(0);
  await actor("anon");
  await expect(db.exec("select cobs_new_user_profile()")).rejects.toThrow(
    "permission denied",
  );
});

test("combined patches preserve draft persistence, approval transitions and authenticated media policies", async () => {
  await applyBoth();
  await provisionMember();
  await actor("authenticated", owner);
  await db.exec(`insert into cobs_campaigns(id,name,created_by) values ('${campaign}','LOCAL SECURITY TEST','${owner}');
    insert into storage.objects(bucket_id,name) values ('cobs-media','${path}');
    insert into cobs_media_assets(id,storage_path,original_name,mime_type,size_bytes,created_by,campaign_id)
      values ('${media}','${path}','synthetic.png','image/png',117,'${owner}','${campaign}');
    insert into cobs_posts(id,title,body,created_by,campaign_id,media_id)
      values ('${post}','LOCAL SECURITY TEST','Persist this draft','${owner}','${campaign}','${media}');`);
  await actor("authenticated", owner); // Fresh database role/claim context, not a browser reload.
  expect(
    (await db.query("select title,body,status from cobs_posts")).rows,
  ).toEqual([
    {
      title: "LOCAL SECURITY TEST",
      body: "Persist this draft",
      status: "Draft",
    },
  ]);
  await expect(
    db.exec("update cobs_posts set status='Scheduled'"),
  ).rejects.toThrow("Invalid approval transition");
  await db.exec(
    "update cobs_posts set status='Pending approval'; update cobs_posts set status='Rejected'; update cobs_posts set status='Pending approval'; update cobs_posts set status='Approved';",
  );
  expect(
    (
      await db.query(
        "select approved_by,approved_at is not null as approved from cobs_posts",
      )
    ).rows,
  ).toEqual([{ approved_by: owner, approved: true }]);
  await actor("authenticated", member);
  for (const table of [
    "cobs_posts",
    "cobs_campaigns",
    "cobs_media_assets",
    "storage.objects",
  ]) {
    expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
  }
  expect(
    (await db.query("update cobs_posts set status='Approved' returning id"))
      .rows,
  ).toHaveLength(0);
  await expect(
    db.exec(
      `insert into storage.objects(bucket_id,name) values ('cobs-media','${member}/denied.png')`,
    ),
  ).rejects.toThrow();
  await actor("authenticated", owner);
  expect(
    (await db.query("delete from storage.objects returning id")).rows,
  ).toHaveLength(0); // Attached asset protected.
  await expect(
    db.exec(
      `insert into storage.objects(bucket_id,name) values ('cobs-media','${member}/wrong-prefix.png')`,
    ),
  ).rejects.toThrow();
  await db.exec("update cobs_posts set body='Revised draft',media_id=null;");
  expect(
    (
      await db.query(
        "select status,approved_by,approved_at,scheduled_at from cobs_posts",
      )
    ).rows,
  ).toEqual([
    {
      status: "Draft",
      approved_by: null,
      approved_at: null,
      scheduled_at: null,
    },
  ]);
  expect((await db.query("select name from storage.objects")).rows).toEqual([
    { name: path },
  ]);
  await db.exec(
    "update cobs_media_assets set deletion_pending=true; delete from storage.objects; delete from cobs_media_assets;",
  );
  expect((await db.query("select * from storage.objects")).rows).toHaveLength(
    0,
  );
  await actor("anon");
  for (const table of ["cobs_posts", "cobs_campaigns", "cobs_media_assets"])
    expect((await db.query(`select * from ${table}`)).rows).toHaveLength(0);
});

test("P1-only rollback restores exact permissions and preserves existing records", async () => {
  await actor("authenticated", owner);
  await db.exec(`insert into cobs_campaigns(id,name,created_by) values ('${campaign}','P1 recovery fixture','${owner}');
    insert into cobs_posts(title,body,created_by,campaign_id) values ('Preserve P1 draft','Local recovery rehearsal','${owner}','${campaign}');`);
  const before = await capture();
  await db.exec(sql("p1"));
  await actor("authenticated", owner);
  expect((await db.query("select * from cobs_posts")).rows).toHaveLength(1);
  await db.exec("reset role;");
  await db.exec(sql("p1.rollback"));
  expect(await capture()).toEqual(before);
});

test("exact P1/P2 rollback restores function ACLs, policies, triggers and existing records", async () => {
  await actor("authenticated", owner);
  await db.exec(`insert into cobs_campaigns(id,name,created_by) values ('${campaign}','Preserve existing local fixture','${owner}');
    insert into cobs_posts(title,body,created_by,campaign_id) values ('Preserve existing draft','Local fixture only','${owner}','${campaign}');`);
  const before = await capture();
  await applyBoth();
  await db.exec(sql("p2.rollback"));
  await db.exec(sql("p1.rollback"));
  expect(await capture()).toEqual(before);
});

test("patches abort on definition or policy drift without partial changes", async () => {
  await db.exec(
    'alter policy "owner manages COBS posts" on cobs_posts using (false);',
  );
  const drifted = await capture();
  await expect(db.exec(sql("p1"))).rejects.toThrow("Policy drift");
  await db.exec("rollback;");
  expect(await capture()).toEqual(drifted);
  await db.exec(
    "alter function cobs_new_user_profile() set search_path=pg_catalog;",
  );
  await expect(db.exec(sql("p2"))).rejects.toThrow(
    "Function definition/owner/ACL drift",
  );
  await db.exec("rollback;");
});

test("rollback refuses unexpected grant changes and rolled-back patches can be reapplied", async () => {
  await applyBoth();
  await db.exec("grant execute on function cobs_is_owner() to anon;");
  await expect(db.exec(sql("p1.rollback"))).rejects.toThrow(
    "Function definition/owner/ACL drift",
  );
  await db.exec(
    "rollback; revoke execute on function cobs_is_owner() from anon;",
  );
  await db.exec(sql("p2.rollback"));
  await db.exec(sql("p1.rollback"));
  await applyBoth();
  expect(
    (
      await db.query(
        "select has_function_privilege('anon','cobs_is_owner()','EXECUTE') as allowed",
      )
    ).rows,
  ).toEqual([{ allowed: false }]);
});

test("P2 preserves owner-email bootstrap through the local Auth writer", async () => {
  // Synthetic local users only; no hosted Auth accounts are modified.
  await db.exec("delete from cobs_profiles; delete from auth.users;");
  await db.exec(sql("p2"));
  await actor("supabase_auth_admin");
  await db.query("insert into auth.users(id,email) values ($1,$2)", [
    owner,
    "cobshomes@gmail.com",
  ]);
  await actor("authenticated", owner);
  expect((await db.query("select role from cobs_profiles")).rows).toEqual([
    { role: "owner" },
  ]);
  expect((await db.query("select cobs_is_owner() as allowed")).rows).toEqual([
    { allowed: true },
  ]);
});
