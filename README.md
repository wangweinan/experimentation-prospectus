# Experimentation Prospectus

A prospect-facing experimentation outlook for Account Executives. It converts
real page traffic into a 12-month view of:

- statistically reliable tests
- likely deployable winners
- page-level conversion lift
- incremental modeled value
- the gap between traffic capacity and delivery capacity

The tool is deliberately a planning model, not a performance guarantee or a
true ROI calculator. ROI requires program cost, and no cost input is provided.

**Presenting soon?** Use the [live demo walkthrough](DEMO_WALKTHROUGH.md) for
the click path, exact Thornfield calculation, design rationale, and likely
questions.

## Run locally

Requires Node.js 20.19 or newer.

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

```bash
npm test       # statistical, simulation, and all-client audit checks
npm run build  # TypeScript check + production build
npm run preview
```

## Sales-call experience

The app opens with Thornfield & Co and includes all five supplied client
profiles. An AE can:

1. choose a sample account;
2. edit the README-defined program and page inputs;
3. see conservative, likely, and upside outcomes update;
4. walk through the 12-month experiment runway;
5. show cumulative Low / Likely / High value paths over calendar time;
6. compare page capacity with directly modeled value;
7. open “How this is calculated” when a prospect wants the detail; and
8. use the browser’s print dialog to save a client-ready PDF.

The main experience uses plain business language. Statistical terms are kept in
the methodology disclosure and this document.

## Inputs

The primary form preserves the supplied JSON contract.

### Program inputs

| UI label | JSON key | Meaning |
| --- | --- | --- |
| How far ahead? | `horizon_days` | Days included in the outlook |
| How often will you report? | `reporting_cadence_days` | Client update cadence; tests may span checkpoints |
| How often do tests win? | `win_rate` | Share of completed tests expected to produce a deployable winner |
| How sure before shipping? | `confidence_target` | Confidence required to call a winner |

### Page inputs

| UI label | JSON key | Meaning |
| --- | --- | --- |
| Page name | `name` | Prospect-facing page label |
| What counts as a conversion? | UI context | Plain-English name for the event behind the conversion rate |
| Visitors per day | `daily_visitors` | Total traffic available to a test |
| Current conversion rate | `baseline_rate` | Current binary conversion rate |
| How does this conversion create value? | `revenue_per_conversion` + UI context | Transparent value calculation; `0` means no dollar attribution |
| Smallest lift worth detecting | `min_detectable_lift` | Relative lift to size for and the assumed effect of a winner |
| Assumed lift when a test wins | UI assumption | Relative conversion increase after a winner; defaults to MDE but replaces rather than adds to it |

### Advanced planning assumptions

These are visible and editable, but collapsed by default:

| Input | Default | Why it exists |
| --- | ---: | --- |
| Chance to spot a real lift | 80% | The README gives confidence but not power |
| Shortest test | 14 days | Prevents high traffic from producing implausibly short tests |
| Tests your team can start | 4 per 30 days | Separates traffic-supported capacity from executable pace |

### Standardized value inputs

The source JSON’s `revenue_per_conversion` remains the effective value used by
the forecast. The UI explains how that number is built instead of asking an AE
to enter an opaque blended amount:

| Value model | Visible inputs | Value used per conversion |
| --- | --- | --- |
| No direct value | None | `$0` |
| One-time purchase | Revenue per purchase | Purchase revenue |
| Subscription | Monthly revenue, months of value to count | Monthly revenue × months |
| Sales lead or demo | Average contract value, lead-to-customer rate, sales-cycle note | Contract value × close rate |
| Pre-calculated expected value | Expected value and an attribution/timing note | Supplied expected value |

The five examples map cleanly:

- BrightPath: `$49` one-time course purchase
- Meridian: `$12.99/month × 1 month`; only the supplied first month is counted
- NovaDash: `$79` pre-calculated downstream value, with in-product payment timing disclosed
- Stackform: `$4,200 contract × 14% close rate = $588` expected per demo, with a 75-day cycle disclosed
- Thornfield: `$185` one-time order value; upstream pages remain `$0`

This structure improves transparency without inventing retention, funnel, or
cash-timing inputs that the client files do not provide.

## Statistical model

### 1. Size one reliable test

Each page uses a fixed-horizon, two-sided test of two independent conversion
rates with a 50/50 allocation.

For baseline rate `p0` and relative MDE `r`, the defaults are 5% significance
(`α = 0.05`) and 80% power:

```text
p1 = p0 × (1 + r)
p̄  = (p0 + p1) / 2

n per variant =
  [z(1 - α/2) × √(2p̄(1-p̄))
   + z(power) × √(p0(1-p0) + p1(1-p1))]²
  / (p1 - p0)²
```

`α = 1 - confidence_target`. Sample size is rounded up. Total sample is `2n`,
and duration is:

```text
max(ceil(total sample / daily visitors), minimum test runtime)
```

The implementation uses Peter Acklam’s inverse-normal approximation and checks
its standard quantiles in the test suite.

### 2. Build the executable roadmap

- One test may run on a page at a time.
- Different pages may run concurrently.
- Launch opportunities are spaced evenly from the editable per-30-day limit.
- When a launch slot opens, the planner selects the available page with the
  greatest potential direct post-deployment value.
- Ties and pages without direct value prefer shorter reliable tests, then stable
  page order.
- Reporting cadence draws client readout checkpoints; it does not start or stop
  tests.
- Every checkpoint shows cumulative completed tests, shipped wins, currently
  running tests, and value unlocked on the representative likely path. Changing
  cadence changes these snapshots, not the final statistical capacity.

A second run removes the launch cap while retaining one active test per page.
That result is the **traffic-supported ceiling**, not the sales promise.

### 3. Model winner uncertainty

The browser runs 10,000 seeded simulations of the selected planning horizon.
These are hypothetical test-by-test paths, not historical years or client
records. The same inputs always yield the same result.

- Each completed test wins independently at the supplied win rate.
- A winner delivers the editable shipped-win lift, which defaults to the page’s
  supplied MDE. It may be higher or lower. It is the entire modeled winner
  effect—not an extra lift added on top of MDE.
- Winners compound the page baseline.
- Later tests are re-sized from that improved baseline.
- A losing test is neutral.

The main UI calls the 10th, 50th, and 90th percentiles **conservative**,
**likely**, and **upside**. They are planning percentiles, not confidence
intervals.

The cumulative value chart calculates those percentiles independently at every
client checkpoint and connects them over calendar time:

- Low = pointwise P10
- Likely = pointwise P50
- High = pointwise P90

The shaded band is the P10–P90 planning range. These curves summarize the
simulation distribution; they are not three observed clients or three literal
historical paths.

### 4. Count conversion value

A winner begins contributing only after its test completes. For each page, the
engine integrates the difference between the compounded and original baseline
over the remaining horizon:

```text
incremental conversions
  = daily visitors × (current rate - original rate) × days active

incremental modeled value
  = incremental conversions × transparently derived value per conversion
```

The baseline bridge is:

```text
current modeled value + incremental modeled value = modeled value with plan
```

Each shipped win multiplies the already-improved page conversion rate. Revenue
therefore compounds as well: every later gain applies to the new baseline, and
the model accrues the full cumulative improvement for the remaining days.

The model does **not** infer:

- dollars for pages whose supplied value is `0`
- relationships between upstream and downstream funnel events
- subscription retention or lifetime value
- sales-cycle cash timing
- experiment or program cost
- ROI or payback

Relative conversion lift remains page-level because the sample pages may
represent different events and overlapping visitors.

## Edge cases

Handled explicitly:

- a page cannot finish one powered test inside the horizon;
- a larger detectable lift is required to make a low-traffic page testable;
- reporting cadence is shorter than test duration;
- high traffic hits the minimum-duration floor;
- a compounded rate approaches 100%;
- pages have no supplied direct value;
- execution capacity binds before traffic capacity;
- all supplied inputs are invalid or all pages are constrained; and
- subscription and pipeline values use different business bases.

Intentionally out of scope:

- sequential monitoring and early stopping
- multiple variants or unequal traffic allocation
- guardrails and multiple-comparison correction
- seasonality, traffic growth, novelty effects, and interference
- implementation delay after a winner
- negative treatment impact during a losing test
- idea-backlog quality and engineering effort by experiment

These require inputs the take-home does not provide. The UI discloses the
relevant assumptions instead of silently fabricating them.

## Project layout

```text
planner/
  src/
    components/       editable canvas, outlook, and runway
    data/             five typed sample client profiles
    model/            validation, test sizing, and simulation
    ui/               display formatting
  README.md
  RESEARCH_LOG.md
```

The model is pure TypeScript and independent of React. There is no backend,
state library, chart library, LLM call, persistence layer, or PDF library.

## From take-home to production

### Sales tool

The current static planner: editable assumptions, transparent math, sample
accounts, deterministic outputs, and printable prospectus.

### Proof of concept

Add authenticated scenario saving, actual eligible-traffic definitions,
experiment backlog and implementation-time inputs, and links to observed
analytics baselines. Validate forecast calibration against completed programs.

### Planning product

Integrate experiment history, traffic forecasts, funnel/event definitions,
guardrail metrics, deployment state, costs, and realized value. Add governed
scenario versioning, approvals, audit logs, monitoring, and forecast-vs-actual
calibration. Consider sequential or Bayesian methods only with a matching
decision policy and validation.

## Suggested live demo flow

1. Open Thornfield and explain the likely tests, winners, page lift, and value.
2. Change launch capacity or win rate and show the story move.
3. Walk the experiment runway and readout checkpoints.
4. Compare executable tests with the traffic-supported ceiling.
5. Show NovaDash’s constrained pricing page and its measurable-lift guidance.
6. Open the methodology, then summarize the research log and discarded options.
7. Close with handled edge cases and the sales → PoC → product path.
