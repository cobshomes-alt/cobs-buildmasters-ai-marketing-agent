# Security patch status

Status recorded 15 October 2026. These files are outside the active migration directory and must not be automatically applied.

| Package | Production state                                                                   | Files                       |
| ------- | ---------------------------------------------------------------------------------- | --------------------------- |
| P1      | Applied with explicit approval; not registered in migration history, as instructed | `p1.sql`, `p1.rollback.sql` |
| P2      | Pending; production execution is not approved                                      | `p2.sql`, `p2.rollback.sql` |

SQL comments preserve the reviewed proposal bytes and hashes. They do not supersede this current status. Do not replay P1, run P2, repair history or run a rollback without fresh explicit approval and drift checks. The rollback files are locally rehearsed scoped permission recovery, not full-project backups.

See [P1 completion](P1_COMPLETION.md), [baseline proposal](BASELINE_PROPOSAL.md) and the [security verification handoff](../../SECURITY_VERIFICATION_HANDOFF.md). Earlier reports record phase-specific snapshots; current status and unresolved work are consolidated in the handoff.
