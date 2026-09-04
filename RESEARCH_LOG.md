# Research log

Date: 2026-09-04

## Brief review

The experimentation README establishes four non-negotiable outputs: tests,
winners, conversion lift, and dollars. It also makes three important modeling
constraints explicit:

1. traffic must ground the outlook;
2. a results cadence is a communication checkpoint, not a test-duration cap;
3. MDE is both the lift to detect and the assumed size of a winning change.

The final UI preserves that equality as the default but exposes shipped-winner
lift separately. This lets an AE size the test for one threshold without hiding
a different expected business effect.

The five client profiles expose cases that a generic calculator can easily
misstate:

| Client | Modeling pressure |
| --- | --- |
| BrightPath | Many pages and a combined long tail can imply more test capacity than a team can ship |
| Meridian | `$12.99` is monthly price, not lifetime value |
| NovaDash | The paid outcome happens in-product, while only one web page has a supplied direct value |
| Stackform | `$588` is expected demo value and realizes after a long sales cycle |
| Thornfield | Only checkout has order value; upstream pages must not inherit its dollars |

This led to a strict rule: use each numeric input exactly as supplied, explain
its basis, and do not invent missing funnel or cash-flow relationships.

### Standardizing revenue inputs

The client narratives show that one `revenue_per_conversion` box represents
four materially different concepts:

- direct transaction revenue (`$49` courses, `$185` orders);
- one month of subscription revenue (`$12.99`, explicitly not LTV);
- probability-weighted lead value (`$4,200 × 14% = $588`, delayed about 75 days);
- a pre-calculated downstream value (`$79`) whose paid event occurs in-product.

The UI now asks what the conversion is and how it creates value, then exposes
the corresponding arithmetic. The original JSON values remain unchanged and a
test asserts that every structured model resolves back to its supplied
`revenue_per_conversion`. Sales-cycle timing is disclosed but does not reduce
economic value; subscription months default to `1` because no retention input
is supplied. Pages with `0` remain unpriced.

Dollar inputs are excluded from the simulation’s random seed. If a value edit
does not change page priority, it scales dollars without arbitrarily redrawing
the same test and winner path.

The simulation now retains cumulative value at every reporting checkpoint.
The visualization plots pointwise P10/P50/P90 across all 10,000 paths, with a
P10–P90 band. This is deliberately labeled as a simulated planning
distribution, not historical evidence or three literal sample paths.

## Product decisions

Decisions were made for an Account Executive operating the tool live with a
prospect.

| Question | Decision | Reason |
| --- | --- | --- |
| Forecast shape | Conservative / likely / upside | A single point estimate looks overconfident |
| Test design | Two-sided two-proportion test, 80% power, 50/50 split | Conventional, explainable, and supported by the supplied binary rates |
| Minimum runtime | Editable 14 days | Avoid one-day “reliable” tests on high-traffic pages |
| Page concurrency | One active test per page; pages may overlap | Matches the README’s independent-page framing |
| Winner impact | Deploy at completion and compound | Produces a chronological roadmap rather than annualized hand-waving |
| Shipped-win lift | Separate editable conversion uplift, defaulting to MDE | Replaces rather than adds to MDE as the impact assumption; revenue is derived |
| Path dependence | Re-size later tests after wins | Improved baselines alter future sample requirements |
| Uncertainty engine | Seeded Monte Carlo, 10,000 paths | Exact binomial counts no longer hold when test count depends on earlier wins |
| Dollar timing | Count only after deployment | Conservative and easy to explain |
| Operational capacity | Show traffic ceiling plus editable launch cap | Traffic alone overstates what a real team can execute |
| Scheduling priority | Greatest supplied direct-value opportunity first | Explicit business policy; no opaque composite score |
| Cross-page lift | Keep relative lift page-level | Page events and visitors may overlap |
| Upstream value | No attribution when supplied value is zero | The brief provides no funnel transition probabilities |
| Subscription / pipeline value | Count supplied value once and label its basis | Avoid unsupported LTV and cash timing |
| ROI | Do not claim it | No program cost is supplied |
| Narrative | Deterministic | Keeps every claim traceable to the same model |
| Export | Browser print stylesheet | Native platform support is enough for v1 |

## Statistical research and checks

The sample-size implementation follows the normal approximation for two
independent proportions: pooled variance under the null and unpooled variance
under the alternative.

References:

- [statsmodels: power for two independent proportions](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.power_proportions_2indep.html)
- [statsmodels: sample size for two independent proportions](https://www.statsmodels.org/stable/generated/statsmodels.stats.proportion.samplesize_proportions_2indep_onetail.html)
- [Peter Acklam: inverse normal CDF approximation](https://web.archive.org/web/20150910144400/http://home.online.no/~pjacklam/notes/invnorm)

An independent Python 3.9 check used the standard-library
`statistics.NormalDist().inv_cdf` rather than the TypeScript approximation.
Reference outputs at 95% confidence and 80% power:

| Baseline | Relative MDE | Required per variant |
| ---: | ---: | ---: |
| 10.0% | 10.0% | 14,751 |
| 5.0% | 10.0% | 31,234 |
| 69.0% | 3.0% | 7,688 |
| 1.8% | 3.0% | 965,563 |

The NovaDash pricing page therefore needs about 2,759 days at its supplied
traffic and 3% relative MDE. A bisection check found that roughly 8.354%
relative lift is the smallest target measurable in 365 days with the same
confidence and power assumptions. This is the kind of constraint the sales
story should surface, not hide.

A deterministic compounding check uses four consecutive 10% winners: the page
ends 46.41% above its original conversion rate, and cumulative revenue accrues
from each successively higher baseline rather than adding four flat 10% gains.

## Iterations and discarded approaches

### Single deterministic outlook

Discarded because expected winner counts can be fractional and give a false
sense of precision. Replaced with a stable conservative/likely/upside range.

### Exact binomial winner interval

Initially attractive: small, exact, and easy to explain. Discarded after choosing
to compound winners and re-size later tests, because the number of completed
tests then depends on the order of wins. A seeded path simulation preserves that
dependency.

### Traffic-only test count

Discarded as the headline because continuously testing every page can create an
implausible sales promise. Retained as a clearly labeled ceiling and paired
with an editable launch pace.

### Account-wide conversion lift

Discarded. A homepage click, sign-up, checkout, and purchase are not one
exchangeable event, and visitors may appear on several pages. The tool shows
page lift and aggregates only compatible quantities.

### Funnel and LTV inference

Discarded. The supplied files do not include transition probabilities,
retention, margin, realization lag, or discounting. A richer number would be
less rigorous, not more.

### LLM-written narrative

Discarded. A small deterministic talk track updates instantly, works offline,
and cannot drift away from the displayed numbers.

### Product infrastructure

Authentication, storage, collaboration, share links, APIs, analytics, a chart
library, and generated-PDF machinery were discarded for the take-home. None is
needed to demonstrate the model or the sales workflow.

## Visual refinement

The initial warm, low-contrast prospectus treatment read as a beige wash and
weakened the hierarchy. The
[mono-color skill](https://github.com/yanliudesign/mono-color-skill) was reviewed
read-only; no third-party skill, script, hook, or asset was installed or run.
Its MIT-licensed instructions and design-system catalogs informed the revision:

- Neutral White `#FAFAF7` substrate
- Charcoal `#30343A` dominant ink
- Signal Red `#C83232` accent ink
- ruled-information composition
- one oversized test-count focal event
- condensed programmatic display type and sparse support copy

No repository artwork or restricted example asset was copied.

A stakeholder review then replaced the alarming red accent with Coframe’s
public product tokens, read from the current `coframe.com` stylesheet:

- background `#F7F8FB`
- primary text `#1F212F`
- brand blue `#5A52EC`
- support blue `#9FC0FF`
- blue atmosphere `#D3DDF5`

The final UI uses an Inter/system-sans stack with no remote font request. Every
editable field and headline result has a keyboard-focusable, plain-English
calculation tooltip. The copy favors questions an Account Executive can ask
aloud—“How far ahead?” and “How often do tests win?”—over statistical labels.
Contrast checks measured 5.13:1 for brand blue on the app background, 5.32:1
for light text on the brand button, and 15.02:1 for primary text.

## Edge-case review

| Case | Current behavior |
| --- | --- |
| Test needs longer than the horizon | Mark constrained; show required days and attainable lift |
| Test finishes faster than 14 days by sample alone | Apply the editable minimum runtime |
| Test spans several client readouts | Keep it running; draw readout checkpoints |
| Reporting cadence changes | Rebuild cumulative client checkpoints without changing test completion math |
| Winner raises a baseline | Compound only after completion; re-size the next test |
| Compounded treatment rate reaches 100% | Stop offering another invalid test |
| Page value is zero | Show tests and lift; no dollar attribution |
| No page has direct value | Replace dollars with “Not modeled” |
| Launch pace binds | Lead with executable plan and show traffic ceiling |
| Losing test | Count completion, no deployed effect, no modeled test-period loss |
| Mixed value bases | Preserve page labels and disclose that the math uses supplied values once |
| Invalid input | Pause the outlook and show field-level correction messages |

## Test harness

The committed Vitest suite covers:

- inverse-normal reference quantiles;
- sample-size reference cases;
- minimum runtime and low-traffic feasibility;
- attainable-MDE bisection;
- input validation;
- reproducible simulation output;
- launch spacing and one active test per page;
- conversion and revenue compounding;
- cadence-based cumulative readout checkpoints;
- post-deployment-only value;
- zero-value pages;
- percentile ordering;
- baseline + incremental = with-plan identity; and
- a snapshot audit across all five supplied client profiles.

Runtime validation used Node.js 24.8.0 and npm 11.6.0:

```bash
npm install
npm test
npm run build
```

- 3 Vitest files passed
- 19 tests passed
- 1 all-client snapshot written and re-verified
- TypeScript checking passed
- Vite production build passed
- Chrome inspection covered 1440×1200 desktop, 390×844 mobile, and the full
  long-form page
- Browser print produced a seven-page, landscape Letter PDF with editing controls
  removed
- The initial low-contrast visual treatment was rejected after inspection and
  replaced by the two-ink ruled-information system documented above

The 10,000-path client audit produced:

| Client | Reliable tests (likely) | Winners (likely) | Incremental modeled value (likely) | Traffic-supported tests |
| --- | ---: | ---: | ---: | ---: |
| BrightPath | 29 | 6 | $505,863 | 34 |
| Meridian | 47 | 9 | $1,718,019 | 52 |
| NovaDash | 47 | 9 | $0 | 52 |
| Stackform | 4 | 0 | $0 | 5 |
| Thornfield & Co | 47 | 12 | $2,770,871 | 67 |

The zero-dollar and zero-median-winner results are retained rather than
massaged: NovaDash’s only directly valued page is underpowered at its supplied
MDE, while four Stackform tests have a greater than 50% chance of producing no
winners at a 15% win rate.

## AI and tool disclosure

- GitHub Copilot CLI 1.0.80
- GPT-5.6 Sol (`gpt-5.6-sol`)
- Ponytail skill in full mode for YAGNI and minimal-dependency pressure
- Frontend Design skill for visual direction and interaction quality
- Clarify skill for non-technical labels, help text, and calculation tooltips
- Colorize skill for the verified Coframe palette and accessible color roles
- Delight skill for restrained, presentation-appropriate interaction polish
- Vercel React Best Practices skill for React implementation guidance
- Python 3.9 standard library for independent statistical reference values
- Vitest for the committed model and scenario audit
- Vite/TypeScript production build as the compile-time harness

No background coding agents, runtime LLM API, third-party plugin, hook, or MCP
integration was added to the product.

## Productionization questions

Before this becomes a planning system rather than a sales calculator:

1. Define eligible experiment traffic instead of total page traffic.
2. Calibrate win rate and effect distributions from Coframe’s completed tests.
3. Represent idea supply, implementation effort, QA, and deployment lag.
4. Connect page goals through an explicitly measured funnel.
5. Add retention, margin, cash timing, program cost, and realized-value
   reconciliation before using ROI language.
6. Version scenarios and assumptions with owners, approvals, and audit history.
7. Compare forecast with actual throughput, winners, lift, and value by cohort.
8. Revisit fixed-horizon testing only alongside a governed sequential or
   Bayesian decision policy.
