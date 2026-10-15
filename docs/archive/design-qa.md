# Design QA — Profiles mobile density

**Source visual truth:** `D:\OpportunityPilot\OpportunityPilotWebapp\design-reference-profile-mobile.png`

**Implementation evidence:**

- `D:\OpportunityPilot\OpportunityPilotWebapp\design-qa-mobile-light.png`
- `D:\OpportunityPilot\OpportunityPilotWebapp\design-qa-mobile-dark.png`
- `D:\OpportunityPilot\OpportunityPilotWebapp\design-qa-comparison.png`

**Viewport and normalization:** Browser CSS viewport was 375 × 812 at device scale 1. The source issue capture is
238 × 460 pixels. The browser content captures are 360 × 744 pixels in light mode (vertical scrollbar excluded) and
375 × 775 pixels in dark mode. The side-by-side comparison scales both images to 375 CSS pixels wide and is evidence
of layout/density, not pixel-for-pixel fidelity to a differently cropped source.

**State:** brand-new local development user, zero profiles, `/profiles/new`, Candidate selected; light and dark themes.

## Findings

No actionable P0, P1 or P2 findings remain.

- The source shows the reported problem rather than a target mock: a narrow content column and one full-width card per
  profile type. The implementation intentionally uses the available width and a two-column selector.
- The empty profile-list rail is absent for a zero-profile user. The form is the only primary region.
- All four types are visible in two rows. At 375 CSS pixels each card is about 160–168 pixels wide and 70 pixels high.
- Measured document width does not exceed the viewport in either theme: dark 375/375; light content 360 within a 375
  viewport. Persistent controls remain reachable.

## Required fidelity surfaces

- **Typography:** existing application font, weights and hierarchy are preserved; card descriptions remain readable
  and wrap without clipping.
- **Spacing/layout:** the redundant list rail is removed for first use; card padding and gaps are reduced at the mobile
  breakpoint; the editor stays single-column.
- **Colors/tokens:** only existing semantic surface, border, primary and text tokens are used. Selected state and text
  contrast remain clear in light and dark themes.
- **Image quality/assets:** this screen contains no product imagery or non-standard assets; existing interface icons are
  unchanged.
- **Copy/content:** all four profile names and descriptions remain present. No meaning or claim was removed.

## Interaction and runtime checks

- Development sign-in → Candidate onboarding → Continue to profile.
- Selected-state control and theme toggle.
- Empty-profile rail suppression.
- Console errors: none observed on the rendered profile screen.
- `npm run typecheck`: passed.
- `npm run lint`: passed.

## Comparison history

1. Original evidence: one-column type cards consume most of the mobile viewport and an empty Profiles region can
   occupy the page without useful content.
2. Fix: suppress the rail when the loaded profile count is zero; use a compact two-column grid through 860 pixels,
   with a one-column fallback below 341 pixels.
3. Post-fix evidence: 375-pixel light/dark captures show four visible types, the form using the full content width,
   and zero horizontal overflow.

Focused region comparison was not needed: the selector labels, descriptions, radio state and boundaries are readable
in the full-view side-by-side comparison, and there are no detailed image assets.

final result: passed

---

# Design QA — Job discovery controls

**Source reference:** `D:\Temp\codex-clipboard-5533fbd5-16d5-4921-b9d2-64877513336e.png` (1279 × 630).

## Source issues addressed

- KPI label, value and supporting text were inline and visually collided.
- Six Sales KPIs were forced into the five-column Candidate layout.
- Sales had no discovery filters, and Candidate had no explicit tech-stack/company/state/sort controls.

## Implementation checks

- Sales uses the six-column KPI strip; Candidate keeps five columns.
- Every KPI is a vertical flex stack: label → numeric value → supporting text.
- Wellfound filters wrap within the existing responsive filter container.
- Indeed is labelled as an official search handoff and never renders fabricated listing rows.
- TypeScript, lint, 146 unit tests and the production build pass.

## Visual comparison

Post-change browser capture and 375 px interaction check were not run because the user explicitly asked to stop browser-based testing. No claim of live visual verification is made.

final result: code-verified; visual check intentionally skipped by user request

---

# Design QA — Application header redesign

**Source visual truth:** `D:\Temp\codex-clipboard-8a23a8ed-5631-407b-b08f-8847dec185de.png` (1240 × 99 px).

**Implementation evidence:** browser-rendered capture emitted inline from the local `/connectors` preview on 13 October 2026.

**Viewport and normalization:** desktop Edge viewport, 1119 px capture width at device scale 1. The source is a shallow header crop; the implementation evidence includes the same header plus its surrounding application context, so comparison focused on the header region rather than page-body fidelity.

**State:** dark theme, Candidate workspace, Guide on, Advanced off, Connectors route, local development user.

## Findings

No actionable P0, P1 or P2 findings remain.

- The page title, workspace selector and utility controls stay on one aligned row without the account control dropping below it.
- Candidate/Sales is visually distinct from Guide/Advanced: workspace selection uses semantic workspace accents, while view preferences use a quiet contained group.
- Help, theme and account actions share one icon-button treatment and consistent target size.
- The current page title remains visible in Simple mode; behavior, routes, switch semantics and accessible names are preserved.
- Progressive breakpoints hide secondary context before primary controls and collapse workspace labels only on the narrowest phones.

## Required fidelity surfaces

- **Typography:** existing Inter/system stack is preserved; page title is promoted to 700 weight while secondary hints remain visually quiet.
- **Spacing/layout:** controls are grouped into context and action zones; the header is nowrap, with responsive reductions at 1180, 1040, 860, 700 and 520 px.
- **Colors/tokens:** existing surface, line, primary, amber and AI tokens are reused in light and dark themes; no new hard-coded palette was introduced.
- **Image quality/assets:** there is no product imagery in this component; all visible controls use the existing Lucide icon system.
- **Copy/content:** Candidate, Sales, page title, AI state, Guide, Advanced, help, theme and account controls retain their original meaning.

## Verification

- Primary interactions visually present: workspace buttons, Guide/Advanced switches, help, theme and account menu.
- Browser-rendered header inspected at desktop width; no visible wrapping, clipping or horizontal overflow.
- Console-facing production build completed; lint passed; 37 test files and 333 tests passed.

Focused-region comparison used the header crop because the reference contains no page-body design. No P3 follow-up is required for this iteration.

final result: passed
