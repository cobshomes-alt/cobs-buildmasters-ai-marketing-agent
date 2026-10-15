# COBS BUILDMASTERS LTD — interface audit and corrections

Date: 15 October 2026. Branch: `develop/dashboard-media`.

Subsequent development note: the later bounded combined-export milestone supersedes this audit's historical “combined export unimplemented” boundary. See `MEDIA_STUDIO_MULTI_EXPORT_VALIDATION.md` for the current implementation, limits and 108-test/7-browser-test results. Hosted saving, P2 and other pending integrations remain pending; this audit's original test results are retained as historical evidence.

## Scope and safeguards

This extends the existing application. Existing uncommitted Media Studio, batch-upload, rendering and timeline work was retained. No production database queries or writes were required for this audit. P2, authentication settings, RLS, Storage policies and migration history were not changed. No OpenAI requests, paid services, deployment, merge, commit or push occurred.

Browser checks use the existing Playwright framework and mocked Supabase/API responses on port 3100. They do not establish new hosted integration acceptance results. Earlier hosted security verification remains documented separately.

## Confirmed causes and corrections

The production-brief activity fieldset retained `#f8fafc`, while the later premium stylesheet forced labels to `#edf3fb`. Browser computed styles confirmed this combination, rather than a failed login or loading problem. Its contrast was **1.07:1**.

The application also had two conflicting root palettes: `--navy` meant a dark brand background in one and pale text in the other. Light component backgrounds and dark-theme inheritance therefore disagreed.

Corrections:

- Consolidated the imported theme into `app/globals.css`, with one authoritative root token definition. Removed the separate premium stylesheet import. Removed superseded declarations for identical selectors within the same scope, retaining media-query boundaries and cascade positions.
- Restored navy as the dark brand colour; separated text, muted text, surfaces, control borders and gold tokens. Updated shared card/button styles to reference tokens.
- Changed the activity fieldset at its original component rule to the raised dark surface. Comparable legacy white surfaces and muted text rules use semantic tokens.
- Added explicit native checkbox presentation: visible unchecked border, gold checked fill, dark check mark, hover border and keyboard focus. Disabled checkboxes retain a dashed border; disabled buttons remain visible and distinguishable.
- Strengthened form boundaries, including sign-in fields. Corrected the sample-plan and checklist-save buttons to use dark text on gold.
- Replaced the clipped mobile navigation strip with two visible columns and 44px minimum targets. Existing responsive editor panels and timelines remain intact.
- Reduced the original logo's sidebar frame while preserving its full square proportions and `object-fit: contain`.
- Added an accessible name to the original-media import dialog.
- Retained restrained entrance/hover effects and reduced-motion rules; no new animation dependency was introduced.

Some existing layout overrides still use `!important` to accommodate inline layout rules. This is not a claim that all historical CSS has been rewritten. The contrast correction changes the original fieldset/theme definitions rather than adding another conflicting colour override.

## Owner-facing messages

| Previous presentation | Current presentation |
|---|---|
| Persistent “Secure Supabase workspace connected.” banner | Not rendered after successful workspace loading. Owner readiness still depends on trusted profile and workspace reads. |
| AI configuration banner in Creative Director hero | Removed. The disabled generation action has an adjacent, accessible explanation; configured requests retain a quota warning. |
| Empty/default Creative Director instruction banner | Removed; actual action results, errors and busy state remain. |
| Default multi-source milestone banner | Removed. Actual failures/results remain visible. |
| Schema/migration explanation in ordinary timeline workspace | Concise warning that saving is unavailable and changes remain unsaved. Technical context is in Settings. |
| “Milestone One” owner-facing heading | “COBS PRODUCTION STUDIO”. |

Settings → **System Status & Integrations** contains owner/workspace context, an authenticated read-only AI configuration check, the pending multi-asset database prerequisite, local-worker requirement, combined-export limitation and manual publishing status. AI configuration failures are explicitly reported. Neither configuration checks nor sample generation consume OpenAI generation credits.

Meaningful sign-in errors, validation failures, action results, unavailable-feature explanations, sample identification, unsaved-change warnings and owner approval requirements are preserved. No control has been enabled merely to hide its unavailable state.

## Browser inspection coverage

The automated screenshot/overflow audit covers **1440×900, 768×900 and 390×900**. Each main section and Creative Director tab receives a screenshot. The existing editor suite additionally checks a populated 20-original/21-clip workspace, editing interactions and import dialog; the dashboard suite checks single-source editing, social previews and sign-in branding.

| Section | Rendered state inspected in audit | Main checks |
|---|---|---|
| Overview | Populated synthetic workspace | Cards, typography, original logo, navigation, responsive layout |
| Campaign Planner | Existing mock campaign and creation form | Form labels, input boundaries, list readability |
| Content Calendar | Saved mock draft and review draft | Copy, attachment, campaign selection, actions |
| Creative Studio | Saved sample production plan | All eight tabs below, missing-AI action, plan save/reopen and review-draft handoff |
| Media Library | Synthetic image; separate populated-library fixture | Original preview, forms, card layout and pagination regressions |
| Media Studio | Unavailable-saving state; separate populated editor fixture | Unsaved warning, panels, timeline, preview, editing and import dialog |
| Approvals | Empty pending queue | Empty state, typography and layout; approval behaviour covered by existing mocked/database regressions |
| Scheduler | No approved posts | Publishing limitation and readiness explanation |
| Leads | Lead-entry form | Labels, spacing and controls; no populated lead list exists in this interface |
| Settings | Integration summary | Contextual technical status, failure handling and responsive definition list |

Creative Director tabs inspected at all three widths: **Creative dashboard, Production brief, Storyboard, Filming checklist, Scripts & captions, Ideas & calendar, Original media and Production workflow**. The sample plan has populated scripts, storyboard and calendar; original-media preview uses a synthetic fixture.

This does not claim a visual inspection of every possible error, loading frame, browser-native confirmation or business-record combination. Existing regression tests cover several such states, including failed AI regeneration preserving the plan, authentication errors and unsaved-navigation protection. Full cross-browser and assistive-technology certification remains outside this run.

## Contrast and accessibility evidence

Computed activity-panel colours at all three widths: background `rgb(25,43,64)`, labels `rgb(237,243,251)`, helper text `rgb(186,203,224)`.

| Pair | Contrast | Requirement |
|---|---:|---:|
| Previous activity labels / near-white panel | 1.07:1 | Fails 4.5:1 |
| Corrected activity labels / panel | 12.88:1 | Passes 4.5:1 |
| Helper text / panel | 8.70:1 | Passes 4.5:1 |
| Unchecked border / panel | 5.30:1 | Passes 3:1 |
| Gold focus/checked fill / panel | 7.42:1 | Passes 3:1 |
| Dark button text / gold | 8.25:1 | Passes 4.5:1 |

The browser audit uses axe WCAG 2 A/AA and WCAG 2.1 AA checks across 30 main-section renders plus 24 Creative Director tab renders. Gradient/translucency cases are recorded as incomplete by axe and require manual review; zero automatic violations does not establish universal accessibility compliance. Screenshots and the explicit solid-panel measurements supplement those checks.

Native checkbox semantics and labels remain intact. Existing keyboard focus rules remain visible; reduced-motion rules disable transitions/animations. Import dialog naming was corrected during source review.

## Logo integrity

`public/branding/cobs-buildmasters-logo.jpeg` remains the exact supplied 44,578-byte JPEG. Its SHA-256 matches the Downloads original:

`ae058b018e0629ce577dffd4740307677d7254339af041d75035938f0d0b7f14`

No crop, recolour, background removal, recreation, stretching or file conversion occurred. Its original white margin is part of the supplied image and remains visible. Existing browser tests verify 1280px natural width, square rendered proportions and containment.

## Verification results

- **85 unit/integration tests across 15 files passed.** These include owner/authentication and approval regressions, media/API protections, isolated database/timeline tests, render tests, batch upload, planning and the two new status-panel tests.
- **TypeScript passed.**
- **Prettier checks passed.**
- **All 6 browser tests passed** in the final sequential run (1.9 minutes). All 54 main-section/tab axe scans reported zero automatic violations; incomplete gradient checks remain explicitly recorded.
- **Production build passed** in the final standalone run (Next.js 15.5.28; main route first-load JavaScript 201 kB).
- Free accessibility dependency installation reported **0 vulnerabilities**.

Initial test failures were investigated and corrected: outdated success-banner assertions in unit/browser reauthentication tests, and the additional low-contrast sample-plan button exposed by the tab-level axe scan. Auth readiness assertions continue to use the owner-only workspace navigation; no security checks were replaced with cosmetic text checks.

A concurrent browser/build run collided in Next.js's shared `.next` output directory (missing routes manifest / `_not-found` entry). Browser tests were rerun alone and passed. Build verification is run separately, with the local preview stopped. Run these commands sequentially; do not run the existing Playwright development server and production compilation concurrently in this checkout.

## Review artifacts

Local-only, ignored artifacts:

- Before: `.tools/screenshots/ui-before-verified-activities.png` and `.tools/ui-before-activities.json`.
- After: `.tools/screenshots/audit-1440-creative-production-brief.png`, `audit-768-creative-production-brief.png`, `audit-390-creative-production-brief.png`.
- Every section: `.tools/screenshots/audit-{width}-{section}.png`.
- Detailed automated accessibility observations: `.tools/ui-audit-results.json`.
- Test/build logs: `.tools/ui-final-unit-tests.log`, `.tools/ui-final-browser-tests.log`, `.tools/ui-final-build.log`.

These screenshots use synthetic content. Browser sessions, credentials, configuration and artifacts are not proposed application assets.

## Remaining issues and limits

| Severity | Item | Next safe action |
|---|---|---|
| Medium | Multi-asset hosted saving still requires the separately reviewed schema proposal | Fresh preflight, recovery review and explicit production approval; no automatic migration |
| Medium | Combined video export and advanced AI editing are unimplemented | Separate approved development phase |
| Medium | P2 and other security packages remain pending | Follow existing security reports; no changes made here |
| Low | Axe cannot resolve every gradient/translucent contrast case automatically | Manual review of delivered screenshots and further assistive-technology testing |
| Low | Exhaustive loading/failure/modal permutations and other browsers were not visually certified | Expand isolated fixtures if further assurance is required |
| Low | Historical responsive inline-layout overrides remain | Incremental component/layout cleanup rather than a risky whole-app rewrite |

The existing live Supabase, AI credential validity, social publishing and hosted multi-asset saving are not re-certified by these mocked UI tests. No production acceptance tests were repeated unnecessarily. Existing security and integration reports remain authoritative about those limitations.

## Delivery and recovery

Files changed specifically for this audit:

- `app/globals.css`: authoritative theme, semantic palette, activity/checkbox/button contrast, logo frame and mobile navigation.
- `app/layout.tsx` / `app/premium.css`: remove the extra imported theme layer; its rules are consolidated into the shared stylesheet. The unused premium file contains only a relocation comment.
- `app/page.tsx`: suppress routine healthy-state banner, token-based shared styles, owner heading and Settings integration panel.
- `app/components/creative-director.tsx`: contextual AI availability, accessible explanation, conditional action notice and concise busy wording.
- `app/components/production-workspace.tsx`: concise unavailable-saving explanation, conditional notice and named import dialog.
- `app/components/media-studio.tsx`: remove milestone/internal worker wording from ordinary instructions and suppress an empty notice.
- `app/components/system-status.tsx`: read-only integration details and safe configuration failure handling.
- `tests/e2e/creative-director.spec.ts`: computed-style evidence, all-section/tab screenshots, viewport overflow assertions and axe checks.
- `tests/e2e/reauthentication.spec.ts`, `tests/dashboard.test.tsx`, `tests/creative-director.test.tsx`: replace retired banner assertions while preserving readiness and security assertions.
- `tests/system-status.test.tsx`: mocked read-only status success/failure cases.
- `package.json` / `package-lock.json`: development-only `@axe-core/playwright` dependency; existing unrelated changes retained.
- This report. Scripts, logs and screenshots under `.tools` are ignored local artifacts.

All work remains local for interface review. `main` and `origin/main` remain at `5578dfdbebc4029f028dbdfed4da692146c84e5e`; no Git mutation was performed. Original unrelated working-tree changes remain present.

No database rollback is needed because this work changes no production database state. If a visual correction needs revision, edit the affected local component/theme rules selectively; do not reset the working tree or discard the pre-existing Media Studio work. Obtain explicit approval before committing or pushing.
