# Post-P1 live acceptance

15 October 2026. Branch `develop/dashboard-media`; existing project `ldnyctzrgcpcjmhnrpms`. **Live acceptance and separately approved cleanup passed. Final local validation results are recorded below.**

## Actual results so far

| Check                                                                         | Result                                                                                                                                            |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Stable owner workspace and explicit login confirmation before record creation | PASS — real hosted owner workspace, corrected navigation-based readiness                                                                          |
| Exactly one labelled campaign and linked draft                                | PASS — created through app, IDs tracked below                                                                                                     |
| Persistence after reload and real sign-out/manual re-authentication           | PASS                                                                                                                                              |
| Rejection, resubmission and approval                                          | PASS — hosted responses confirmed transitions and owner actor/time                                                                                |
| Approved text edit invalidates approval                                       | PASS — Draft, cleared approval actor/time                                                                                                         |
| Synthetic PNG upload/private owner preview                                    | PASS — 32×32, 117 bytes, image decoded in actual browser                                                                                          |
| Image attachment and persistence after reload                                 | PASS — hosted post media_id and explicit attachment caption confirmed                                                                             |
| Anonymous/invalid-JWT database API approval attempts                          | PASS — actual existing synthetic post hidden; anonymous update returned no affected rows; invalid JWT returned 401                                |
| Private media anonymous access                                                | PASS — anonymous download denied and public-object URL denied for the actual uploaded object                                                      |
| Authenticated non-owner restriction                                           | PASS for hosted SQL role/claim simulation in rolled-back transaction; real non-owner JWT remains untested                                         |
| Existing business record preservation                                         | PASS — private before/after comparison excludes only the three exact synthetic records; COBS Storage count increased by exactly one               |
| Detachment before removal                                                     | PASS — current post is Draft with media_id null; no post references the image                                                                     |
| Owner deletion of unattached media                                            | PASS — after separate exact-item approval, owner removed the unused synthetic image through the app; metadata and Storage object confirmed absent |
| Approved test-record cleanup                                                  | PASS — guarded exact-ID deletion of only the draft and campaign; all five COBS tables and Storage object count exactly match pre-test baseline    |
| Final automated regressions                                                   | PASS � 38 Vitest tests across five files and two mocked Playwright browser tests, after live cleanup                                              |
| Production build, strict TypeScript and source formatting                     | PASS � run sequentially after browser tests                                                                                                       |
| Unresolved failures                                                           | NONE within this scope; two resolved harness assertion issues are disclosed below                                                                 |

A valid owner-issued signed URL remains a bearer capability until expiry. The anonymous media check tested raw/private download and the public-object endpoint, not whether a holder of a valid signed link can fetch it.

## Exact temporary items created and removed after approval

- Campaign `f074dd03-acf5-4e8d-afb6-93bd9dca3869`: **COBS TEMP P1 FINAL 20261015-b60d5c0b campaign**.
- Post `3f7a61a6-e519-40df-8c9d-7ea1ffa943ff`: **COBS TEMP P1 FINAL 20261015-b60d5c0b draft**, linked to that campaign; last state before approved deletion was Draft and unattached.
- Media asset `0c0fe5c7-1af1-4b37-b09b-ebfb49759085`: **COBS_TEMP_P1_FINAL_20261015-b60d5c0b_synthetic.png**.
- Private bucket `cobs-media`; object `3a2bbdc9-35f9-47c0-8830-66b0c7e804eb/064c511d-a3af-469f-a472-b6207c85dc2f.png`.

These were the only created test records/object. No real company media was used. The owner separately approved removal of the unused image and both test records. The app removed the image, then a guarded transaction checked exact IDs, names, author, revised body, Draft status, absence of references and absence of the media object/metadata before deleting the post and campaign. All three records and the object are now absent; the complete private COBS record snapshot matches the pre-test baseline.

## Harness corrections and boundaries

The attachment filename appears in a figcaption and a summary, causing an ambiguous text locator. Verification resumed with the explicit caption locator and the same existing asset, without duplicate data or uploads. The detach save then returned a single-row object, while its follow-up assertion expected an array. A read-only hosted query independently confirmed the successful detach, revised post text and unused asset. These were harness assertions, not demonstrated application regressions.

Automatic approval review initially rejected launching a deletion-capable cleanup runner before separate media-deletion approval existed. Nothing was deleted then. After explicit approval for the exact three synthetic items, cleanup proceeded successfully with fresh checks. No automatic approval bypass or unapproved deletion occurred.

P2, security settings, Auth configuration, Storage policies and migration history remain unchanged. No paid API, deployment, main merge or publication occurred. Evidence is private under ignored `.tools/post-p1-final-acceptance/`; credentials and signed URLs were not exported. This report is local and uncommitted.

Remaining integrations beyond this scope include real non-owner JWT acceptance, video/cross-device coverage and live AI/provider integration. No further production change is implied by this report.

Verification is complete and work is stopped. Reports remain local and uncommitted; no commit/push was requested for this phase. Further production changes require fresh explicit approval.
