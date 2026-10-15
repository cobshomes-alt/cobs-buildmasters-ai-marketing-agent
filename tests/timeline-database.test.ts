import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { restoreExistingSchema } from "./helpers/existing-schema";
import schema from "./fixtures/cobs-security-schema.json";
import { newTimeline, newClip } from "../lib/timeline";
const db = new PGlite(),
  owner = "11111111-1111-4111-8111-111111111111",
  member = "22222222-2222-4222-8222-222222222222",
  media = "33333333-3333-4333-8333-333333333333";
let doc = newTimeline();
beforeAll(async () => {
  await restoreExistingSchema(
    db,
    [
      { id: owner, email: "cobshomes@gmail.com" },
      { id: member, email: "member@example.test" },
    ],
    schema,
  );
  await db.exec(
    `insert into cobs_profiles(id,email,role) values('${owner}','cobshomes@gmail.com','owner'),('${member}','member@example.test','member');grant usage on schema auth,public,storage to authenticated,anon;grant select,delete on storage.objects to authenticated;grant select on public.media_assets to authenticated;`,
  );
  await db.exec(
    readFileSync("supabase/proposals/premium-media-projects.sql", "utf8"),
  );
  await db.exec(
    `set role authenticated;set request.jwt.claim.sub='${owner}';insert into cobs_media_assets(id,storage_path,original_name,mime_type,size_bytes,project,product,created_by) values('${media}','${owner}/fixture.png','Synthetic.png','image/png',68,'','', '${owner}');`,
  );
  doc = {
    ...newTimeline(),
    title: "Isolated synthetic production",
    clips: [
      newClip({
        id: media,
        original_name: "Synthetic.png",
        mime_type: "image/png",
      }),
    ],
  };
}, 30000);
afterAll(() => db.close());
async function save(revision: number, document = doc) {
  return db.query<{ result: { revision: number } }>(
    "select cobs_save_edit_project($1::jsonb,$2) result",
    [JSON.stringify(document), revision],
  );
}
test("atomic relational saves persist and reopen complete multi-item recipes with increasing revision", async () => {
  doc = {
    ...doc,
    clips: [
      ...doc.clips,
      newClip({
        id: media,
        original_name: "Synthetic second use",
        mime_type: "image/png",
      }),
    ],
  };
  expect((await save(0)).rows[0].result.revision).toBe(1);
  expect(
    (await db.query("select * from cobs_edit_clips order by position")).rows,
  ).toHaveLength(2);
  await expect(save(0)).rejects.toThrow(/Stale/);
  expect((await save(1)).rows[0].result.revision).toBe(2);
  await expect(
    save(2, {
      ...doc,
      clips: [
        { ...doc.clips[0], mediaId: "44444444-4444-4444-8444-444444444444" },
      ],
    }),
  ).rejects.toThrow(/unavailable/);
  expect(
    (await db.query("select revision from cobs_edit_projects")).rows[0],
  ).toMatchObject({ revision: 2 });
  expect((await db.query("select * from cobs_edit_clips")).rows).toHaveLength(
    2,
  );
});
test("referenced source cannot be reserved for deletion or removed through Storage", async () => {
  await expect(
    db.query("update cobs_media_assets set deletion_pending=true where id=$1", [
      media,
    ]),
  ).rejects.toThrow(/referenced/);
  await db.exec("reset role");
  await db.query("insert into storage.objects(bucket_id,name) values($1,$2)", [
    "cobs-media",
    `${owner}/fixture.png`,
  ]);
  await db.exec(`set role authenticated;set request.jwt.claim.sub='${owner}';`);
  expect(
    (
      await db.query("delete from storage.objects where name=$1 returning id", [
        `${owner}/fixture.png`,
      ])
    ).rows,
  ).toHaveLength(0);
});
test("database rejects missing version, missing revision and string-valued numeric edits", async () => {
  const missing = { ...doc } as any;
  delete missing.version;
  await expect(save(2, missing)).rejects.toThrow(/Invalid timeline/);
  await expect(
    db.query("select cobs_save_edit_project($1::jsonb,null)", [
      JSON.stringify(doc),
    ]),
  ).rejects.toThrow(/Invalid timeline/);
  await expect(
    save(2, {
      ...doc,
      clips: [
        {
          ...doc.clips[0],
          recipe: { ...doc.clips[0].recipe, duration: "5" as any },
        },
      ],
    }),
  ).rejects.toThrow(/check constraint/);
  expect(
    (await db.query("select revision from cobs_edit_projects")).rows[0],
  ).toMatchObject({ revision: 2 });
});
test("non-owner and anonymous roles cannot read or save production timelines", async () => {
  await db.exec(`set request.jwt.claim.sub='${member}';`);
  expect(
    (await db.query("select * from cobs_edit_projects")).rows,
  ).toHaveLength(0);
  expect((await db.query("select * from cobs_edit_clips")).rows).toHaveLength(
    0,
  );
  await expect(save(2)).rejects.toThrow(/Owner/);
  await db.exec("reset role;set role anon;");
  await expect(db.query("select * from cobs_edit_projects")).rejects.toThrow(
    /permission denied/,
  );
  await expect(save(2)).rejects.toThrow(/permission denied/);
  await db.exec("reset role;");
  expect((await db.query("select * from unrelated_records")).rows).toHaveLength(
    1,
  );
  expect((await db.query("select * from cobs_media_assets")).rows).toHaveLength(
    1,
  );
});
