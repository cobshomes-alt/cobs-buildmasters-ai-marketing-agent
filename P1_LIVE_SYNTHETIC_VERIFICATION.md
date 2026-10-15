# P1 limited live synthetic verification

**Cleanup completed after separate approval:** the owner instructed “Delete only the two approved records and stop.” The exact post `a42d94d0-6cad-4492-8b66-b7a91175afa7` and campaign `57dd4d30-08da-490f-8a65-742aefb6331f` were removed in a guarded transaction. A read-only comparison confirmed all five COBS tables and the Storage object count exactly match the pre-test baseline. No media object existed or was deleted. The historical stopped-run results below are retained; no further tests or production security changes were performed.

15 October 2026 (UTC). Branch: `develop/dashboard-media`. Existing project: `ldnyctzrgcpcjmhnrpms`.

**Outcome: live run stopped at an unresolved re-authentication readiness check. No confirmed application regression; the full acceptance workflow is not complete.** No further live mutations were attempted after stopping.

## Actual results

| Check                                                     | Result                             | Evidence                                                                                                                                                                                                                     |
| --------------------------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial owner authentication/workspace                    | PASS — live                        | Owner signed in directly in the labelled browser.                                                                                                                                                                            |
| One labelled campaign and linked draft created            | PASS — live                        | App save responses returned the exact IDs below; hosted records independently confirmed.                                                                                                                                     |
| Persistence after application refresh                     | PASS — live                        | Both records appeared again after reload.                                                                                                                                                                                    |
| Persistence after sign-out/re-authentication              | BLOCKED                            | Test signed out; user reported re-authentication and selecting Overview, but automation did not detect the expected connected Overview. Stopped instead of asserting success or continuing writes. No cause was established. |
| Rejection, resubmission, approval and edit invalidation   | UNTESTED in this run               | Stopped before these actions. Draft remains Draft with original synthetic text.                                                                                                                                              |
| PNG upload, owner preview and anonymous object denial     | UNTESTED in this run               | Local PNG staged but never uploaded. No Storage object or media metadata created.                                                                                                                                            |
| Attach PNG to temporary post                              | UNTESTED                           | Post media_id remains null.                                                                                                                                                                                                  |
| Unauthorized database API approval of populated test post | UNTESTED in this run               | Planned probes were not executed after stopping. Earlier checks/local tests are not substituted for this live result.                                                                                                        |
| Existing COBS record preservation                         | PASS — hosted read-only comparison | Apart from the exact campaign and post, COBS records match the private pre-test snapshot; Storage object count unchanged.                                                                                                    |
| Automated regression suite after halted live run          | PASS — 37 tests across five files  | Local/mocked and isolated SQL tests; no hosted mutation by these tests.                                                                                                                                                      |
| Confirmed application failures                            | NONE established                   | The readiness blocker may be browser/test state or application behavior; it needs diagnosis before any live continuation.                                                                                                    |

The application can retain its active section across sign-out. The runner waited specifically for Overview and the connected status, so the user was asked to select Overview; this did not resolve the observable readiness check. The test was stopped while waiting, not restarted, and no duplicate records were created. Do not infer a failed password login or a database authorization regression from this alone.

## Exact production items left intact

| Item                          | Label                                          | ID/state                                                                              |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------- |
| Campaign                      | COBS TEMP P1 VERIFY 20261015-77d13a45 campaign | `57dd4d30-08da-490f-8a65-742aefb6331f`                                                |
| Post                          | COBS TEMP P1 VERIFY 20261015-77d13a45 draft    | `a42d94d0-6cad-4492-8b66-b7a91175afa7`; Draft; linked to the campaign above; no media |
| Media metadata/Storage object | None                                           | No asset ID or storage path was created                                               |

Post body: `COBS TEMP P1 VERIFY 20261015-77d13a45 synthetic test only. Never publish.`

The local-only staged file is `COBS_TEMP_P1_VERIFY_20261015-77d13a45_synthetic.png`, a harmless 32×32, 117-byte checkerboard under ignored `.tools/p1-live-acceptance/`. It is not company media and was not uploaded.

## Safety and next decision

P2 remains unapplied. No unrelated table, security policy, Auth setting or migration history was modified. No real company media, additional project, paid API, publication, deployment or main merge was used. Credentials were entered only in the app; none were read or logged by the runner.

Both records remain intact pending separate cleanup approval. Retaining them permits diagnosis and a later explicitly authorized continuation using the same IDs. Any approved cleanup must check exact IDs, labels and dependencies, delete only the test post then campaign, and refuse unexpected references. No live cleanup or security rollback has occurred. Do not roll back P1 for an undiagnosed browser-readiness blocker.

Private evidence: `.tools/p1-live-acceptance/manifest.json`, `baseline.json` and `stopped-state.json`. The report and test artifacts remain local; no commit or push was requested.
