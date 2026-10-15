import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeEach, afterEach, test, expect } from "vitest";
import {
  restoreExistingSchema,
  targetedRollbackSql,
} from "./helpers/existing-schema";

const owner = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const migration = readFileSync(
  "supabase/migrations/20261015002801_reconcile_existing_cobs_workspace.sql",
  "utf8",
);
let db: PGlite;
beforeEach(async () => {
  db = new PGlite();
  await restoreExistingSchema(db, [
    { id: owner, email: "cobshomes@gmail.com" },
    { id: member, email: "member@example.test" },
  ]);
  await db.query("insert into cobs_profiles(id,email,role) values ($1,$2,$3)", [
    owner,
    "cobshomes@gmail.com",
    "owner",
  ]);
}, 30000);
afterEach(async () => {
  await db.close();
});
async function asOwner() {
  await db.exec(
    `set role authenticated; set request.jwt.claim.sub='${owner}';`,
  );
}

test("live-schema reconciliation preserves the owner record and unrelated policies", async () => {
  const before = (await db.query("select * from cobs_profiles"))
    .rows[0] as Record<string, unknown>;
  const policies = (
    await db.query(
      `select policyname,qual,with_check from pg_policies where policyname like 'organization members%' order by policyname`,
    )
  ).rows;
  await db.exec(migration);
  const after = (await db.query("select * from cobs_profiles"))
    .rows[0] as Record<string, unknown>;
  for (const field of Object.keys(before))
    expect(after[field]).toEqual(before[field]);
  expect(
    (
      await db.query(
        `select policyname,qual,with_check from pg_policies where policyname like 'organization members%' order by policyname`,
      )
    ).rows,
  ).toEqual(policies);
  expect((await db.query("select * from unrelated_records")).rows).toHaveLength(
    1,
  );
});
test("lead-author drift is corrected and the owner can save a lead", async () => {
  await db.exec(migration);
  await asOwner();
  await db.exec(
    `insert into cobs_leads(name,created_by) values ('Local rehearsal lead','${owner}');`,
  );
  expect((await db.query("select * from cobs_leads")).rows).toHaveLength(1);
});
test("new leads without authors make the entire migration stop safely", async () => {
  await db.exec(
    `insert into cobs_leads(name) values ('Existing lead requiring attribution');`,
  );
  await expect(db.exec(migration)).rejects.toThrow(
    "COBS records changed since the verified recovery snapshot",
  );
  await db.exec("rollback;");
  expect(
    (
      await db.query(
        "select column_name from information_schema.columns where table_name='cobs_leads' and column_name='created_by'",
      )
    ).rows,
  ).toHaveLength(0);
  expect((await db.query("select * from cobs_leads")).rows).toHaveLength(1);
});
test("historical approvals can be deliberately reviewed; subsequent edits clear approval", async () => {
  await db.exec(migration);
  // Local fixture only: simulate a historical approval without an audit record.
  await db.exec(
    "alter table cobs_posts disable trigger cobs_post_approval_guard;",
  );
  await db.exec(
    `insert into cobs_posts(title,body,status,created_by) values ('Legacy approval','Original body','Approved','${owner}');`,
  );
  await db.exec(
    "alter table cobs_posts enable trigger cobs_post_approval_guard;",
  );
  await asOwner();
  await db.exec(
    "update cobs_posts set status='Pending approval'; update cobs_posts set status='Approved';",
  );
  expect(
    (
      await db.query<{ approved_by: string }>(
        "select approved_by from cobs_posts",
      )
    ).rows[0].approved_by,
  ).toBe(owner);
  await db.exec("update cobs_posts set body='Edited body';");
  expect(
    (
      await db.query<{ status: string; approved_at: null }>(
        "select status,approved_at from cobs_posts",
      )
    ).rows[0],
  ).toEqual({ status: "Draft", approved_at: null });
});
test("member and anonymous access stay denied and browser roles cannot truncate", async () => {
  await db.exec(migration);
  await db.exec(
    `set role authenticated;set request.jwt.claim.sub='${member}';`,
  );
  expect((await db.query("select * from cobs_posts")).rows).toHaveLength(0);
  await expect(
    db.exec(
      `insert into cobs_posts(title,body,created_by) values ('Forbidden','Forbidden','${member}')`,
    ),
  ).rejects.toThrow();
  await expect(
    db.exec(
      "insert into storage.objects(bucket_id,name) values ('cobs-media','other/file.jpg')",
    ),
  ).rejects.toThrow();
  await expect(db.exec("truncate cobs_profiles")).rejects.toThrow(
    "permission denied",
  );
  await db.exec("reset role;set request.jwt.claim.sub='';set role anon;");
  expect((await db.query("select * from cobs_profiles")).rows).toHaveLength(0);
  await expect(db.exec("truncate cobs_posts")).rejects.toThrow(
    "permission denied",
  );
});
test("targeted rollback restores the original schema, permissions and records", async () => {
  const state = async () => ({
    profiles: (await db.query("select * from cobs_profiles order by id")).rows,
    columns: (
      await db.query(
        "select table_name,column_name,is_nullable from information_schema.columns where table_schema='public' and table_name like 'cobs_%' order by table_name,ordinal_position",
      )
    ).rows,
    policies: (
      await db.query(
        "select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies order by schemaname,tablename,policyname",
      )
    ).rows,
    privileges: (
      await db.query(
        "select table_name,grantee,privilege_type from information_schema.table_privileges where table_name like 'cobs_%' order by table_name,grantee,privilege_type",
      )
    ).rows,
  });
  const before = await state();
  await db.exec(migration);
  await db.exec(targetedRollbackSql());
  expect(await state()).toEqual(before);
});
test("rollback refuses to discard newly created marketing records", async () => {
  await db.exec(migration);
  await asOwner();
  await db.exec(
    `insert into cobs_posts(title,body,created_by) values ('Keep me','Never discard new data','${owner}'); reset role;`,
  );
  await expect(db.exec(targetedRollbackSql())).rejects.toThrow(
    "Recovery refused: new records exist",
  );
  await db.exec("rollback;");
  expect((await db.query("select * from cobs_posts")).rows).toHaveLength(1);
});
