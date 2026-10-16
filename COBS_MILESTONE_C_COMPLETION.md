# Milestone C — Simple AI Editing Experience

Local implementation on `develop/dashboard-media`; no commit, push, deployment, production database changes, P2 or paid requests.

## Implemented

- Ask COBS AI inside the existing Media Studio, shared by Create with AI and Edit Myself.
- Free deterministic instruction processing; proposed changes require owner confirmation. Stale proposals are rejected. Applying an edit uses existing undo/redo history and dirty-project protection.
- Three starter templates: Cinematic Construction (warm grade and restrained fades), Luxury Real Estate (gentler contrast/saturation), Concrete Block Advertisement (stronger contrast). All use existing FFmpeg photo motion and original-logo ending. No stock company imagery or invented claims.
- Existing upload, multitrack timeline, preview, export and owner-review handoff remain available. Templates preserve project identity, source IDs and originals.

## Supported commands

Use the examples below, optionally joining supported commands with “and”. Unsupported wording/effects reject the entire proposal rather than silently discarding part of a request.

- Make this video more cinematic.
- Shorten this video to 30 seconds (shortening only; every retained scene must remain at least one second).
- Use a vertical Instagram format (9:16, uncropped contain framing).
- Make the colours warmer.
- Add my original logo at the end.
- Add professional captions (requires owner-supplied verified text; existing timed captions are protected).
- Use the Cinematic Construction template; the other two template names also work.
- Arrange the uploaded photos and videos into an attractive sequence (alternates media types, preserves order within each type; no visual ranking).

Changes remain unsaved timeline edits until the owner saves/downloads a project. The existing server validates exported timeline instructions and media permissions. This assistant adds no new API or database schema.

## Unavailable and boundaries

No live LLM, visual scene understanding, automatic transcription, music generation or beat detection. Templates do not supply music, invent footage or infer property/product claims. Complex wording requires manual editing or the existing Automatic Editing Director. Existing preview approximations remain; review the rendered MP4 for exact colour, transitions and audio. Very short scenes can make an effect/duration combination invalid; validation rejects it without changing the project.

Commercial Remotion remains disabled pending licensing approval. This milestone uses FFmpeg only and installs no dependencies. Existing cloud timeline persistence/migration limitations and security-advisor/P2 items remain documented in previous reports. Rendering requires the existing local worker/FFmpeg configuration; no hosting or production integration was enabled.

## Verification

Initial focused instruction tests passed. The changed premium-editor browser scenario passed, including confirmation, undo, template selection and mobile overflow assertions. An initial missing recording-binary path was corrected by reusing `.tools/playwright-browsers`; a test-file encoding error was also corrected. Neither was evidence of a live authentication failure.

The complete automated suite ran once at the end: **169 tests passed in 33 files**, 276.46 seconds. This includes four assistant tests, real renderer tests and existing security regressions. No hosted Supabase login or record write is claimed by the mocked browser checks. The focused browser scenario reported a pass in 29.1 seconds; its managed dev-server teardown stalled and was stopped after the passing result. The independent fresh-export Chrome playback check completed normally with exit code 0.

The assistant's confirmed caption proposal was passed through the existing six-source construction fixture: three videos and three photographs, real FFmpeg rendering in **9:16, 16:9 and 1:1**, each 12 seconds/300 frames. Existing pixel/audio assertions verify source order, trim/speed, colour consistency, transitions, text, mixed tones and original-logo ending; source hashes remain unchanged. Caption instructions are validated and rendered, although no OCR assessment of caption wording is claimed. The fresh portrait MP4 played to completion in Chrome: 720 × 1280, 12 seconds, no media error. Audio is synthetic tones, not professional music. No visual scene analysis or live AI is involved.

[Example completed MP4](.tools/delivery/media-studio/cobs-art-of-building-9x16.mp4) · [Render verification](.tools/delivery/media-studio/art-of-building-verification.json) · [Chrome playback result](.tools/delivery/media-studio/milestone-c-browser.json) · [Playback screenshot](.tools/screenshots/milestone-c-export.png)

Final sequential TypeScript, configured Prettier formatting and production build all passed. Next.js 15.5.28 generated seven pages; Home first-load JavaScript is 223 kB. The existing experimental SQLite warning did not fail the checks. `git diff --check` passed; a heuristic scan of 73 candidate source/documentation files found no credential indicators (not a guarantee for every secret format). All 37 protected renderer/API/security/logo files matched the pre-Remotion checkpoint, and core dependency versions are unchanged. The original JPEG SHA-256 remains `ae058b018e0629ce577dffd4740307677d7254339af041d75035938f0d0b7f14`.

HEAD remains `a9e53f54a3b2de9f9c84e8bc4e726393eb2b158f`; local main remains `5578dfdbebc4029f028dbdfed4da692146c84e5e`. All milestone changes remain local and uncommitted on `develop/dashboard-media`.

The refreshed local preview is running at `http://127.0.0.1:3102` (Home HTTP 200). Open Edit Myself or Create with AI to find Ask COBS AI. The preview process clears the OpenAI key and leaves Remotion evaluation disabled; environment files and hosted settings were not changed. This startup smoke check does not verify live owner login or worker readiness.

## Changed files in this milestone

- `lib/assistant-editing.ts`: bounded proposal generation and stale-proposal validation.
- `app/components/ask-cobs-ai.tsx`: assistant, templates, explicit confirmation and undo.
- `app/components/production-workspace.tsx`: existing editor/history integration.
- `app/product-experience.css`: responsive assistant styles and visible focus states.
- `tests/assistant-editing.test.ts`: commands, validation, immutability and arrangement.
- `tests/e2e/premium-studio.spec.ts`: assistant browser workflow and screenshots.
- `tests/construction-preset-output.test.ts`: assistant-confirmed captions through the existing six-source real render.
- This report. Previous uncommitted development work is retained.

## Review evidence

Screenshots use synthetic fixtures and mocked services:

- [Assistant and proposed edit](.tools/screenshots/milestone-c-assistant.png)
- [Applied template and timeline](.tools/screenshots/milestone-c-completed-edit.png)
- [Mobile editor](.tools/screenshots/milestone-c-mobile.png)

Do not commit ignored local outputs, browser sessions or private configuration. Stop after delivery; further development and commit/push require owner instruction.
