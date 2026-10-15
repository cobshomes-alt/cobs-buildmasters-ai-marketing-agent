import { randomUUID } from "node:crypto";
import { database, readiness, tick, cleanup } from "../lib/render-worker.mjs";
if (!readiness()) {
  console.error(
    "Local rendering is disabled or FFmpeg tools are missing. See MEDIA_STUDIO_IMPLEMENTATION_REPORT.md.",
  );
  process.exit(1);
}
const db = database(),
  token = randomUUID();
console.log(
  "COBS owner-operated media worker started. No provider credentials are stored.",
);
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
while (!stopped) {
  await tick(db, token);
  cleanup(db);
  await new Promise((r) => setTimeout(r, 1000));
}
db.close();
