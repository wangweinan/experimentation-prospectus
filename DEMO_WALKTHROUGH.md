# Live demo walkthrough

Use this as a talk track, not a script to read word-for-word.

## The 30-second opening

> “A sales team needs to answer a simple question before a client signs: given
> the traffic they actually have, what could a disciplined experimentation
> program deliver over the next year?
>
> This planner starts with page-level traffic and conversion data, sizes tests
> to 95% confidence and 80% power, fits those tests into a realistic launch
> calendar, and plays out 10,000 possible years. The output is a range for
> reliable tests, shipped wins, page-level conversion lift, and value—not a
> promise based on a generic benchmark.”

## What to show first

Open Thornfield & Co. It is the best default demo because one account shows
nearly every important design decision:

- high-traffic upstream pages;
- a lower-traffic checkout;
- direct value only at checkout;
- a 14-day client reporting cadence;
- a real execution constraint; and
- a clean baseline close to the client’s stated $40M annual online revenue.

The opening screen should read roughly:

| Headline | Likely result |
| --- | ---: |
| Reliable tests | 47 |
| Shipped wins | 12 |
| Checkout conversion lift | 15.9% |
| Likely added value | $2.8M |
| Traffic-supported ceiling | 67 tests |

These are seeded outputs. The same inputs produce the same results.

## Screen-to-model map

| What the audience sees | Question it answers | Calculation behind it |
| --- | --- | --- |
| Giant reliable-test count | “How many valid tests can we actually run?” | Two-proportion sample size, real traffic, minimum runtime, page concurrency, and launch pace |
| Conservative / likely / upside wins | “How many changes might ship?” | 10th / 50th / 90th percentiles from 10,000 winner paths |
| Page lift | “How much better could this page become?” | Compounded shipped-win lift on that page only |
| Likely added value | “What is the economic opportunity?” | Cumulative extra conversions after deployment × transparent value per conversion |
| Traffic ceiling vs. plan | “Is traffic or team capacity the bottleneck?” | Continuous page-level testing compared with the launch-limited calendar |
| Experiment runway | “When do tests run and wins launch?” | Representative median-like simulation path |
| Client update rhythm | “What will we report every week/month?” | Cumulative completed tests, live tests, wins, and value at each reporting checkpoint |
| Two opportunity rankings | “Where should we start?” | Traffic-supported test count vs. directly modeled dollar value |
| How this is calculated | “Can I defend these numbers?” | Plain-English assumptions with technical definitions available on demand |

## Suggested live click path

### 1. Start with the business answer

Point to the giant `47`.

> “This is the execution-adjusted plan: 47 statistically reliable tests over
> the year. It is not simply 365 divided by two weeks. Every page gets its own
> traffic-based sample requirement, only one test can run on a page at a time,
> and the team starts four tests per 30 days.”

Then point to `12 likely wins` and `$2.8M likely growth value`.

> “At Thornfield’s 25% win-rate assumption, the middle simulated year has 12
> shipped wins. Value starts only after each winner completes and launches.”

### 2. Explain the range without saying “confidence interval”

Point to conservative / likely / upside below a metric.

> “I do not want one precise-looking promise. We play out 10,000 possible
> winner sequences. ‘Likely’ is the middle result. ‘Conservative’ and ‘upside’
> are the 10th and 90th percentile planning cases. They are not statistical
> confidence intervals and they are not guarantees.”

### 3. Show why traffic and execution are separate

Point to `Traffic could support 67 tests; this plan puts 47 on the calendar`.

> “The website has enough traffic for about 67 tests if each page starts the
> next test immediately. The chosen team pace can execute 47. That gap is an
> opportunity to expand throughput later, not a number I hide in the sales
> promise.”

Change **Tests your team can start** from `4` to `2`.

> “The executable plan falls, while the traffic ceiling stays stable. This is
> how the AE can separate a traffic problem from a delivery-capacity problem.”

Reset the sample afterward.

### 4. Show traffic-grounded test sizing

Open **Checkout** in the left rail.

Point to:

- current conversion rate: `69%`;
- smallest lift the test should detect: `3%`;
- traffic check: about `15.4K visitors · 18 days`; and
- expected lift from each shipped win: `3%`.

> “The first 3% is a statistical design choice: what is the smallest relative
> improvement worth reliably detecting? It controls sample size.
>
> The second 3% is a business-effect assumption: how much does a shipped winner
> improve conversion? It defaults to the MDE because that is what the brief
> specifies, but it is separate and editable.”

Change **Expected lift from each shipped win** from `3%` to `4%`.

> “Test sizing does not change because MDE is still 3%. Page lift and dollars
> increase because each shipped win is now assumed to deliver more.”

Use **Match the detectable lift** to restore the default.

### 5. Show transparent revenue inputs

Keep Checkout open and point to the value model:

```text
One-time purchase
$185 revenue per purchase
Value used in forecast: $185 per completed order
```

> “The original JSON gives one field called revenue per conversion. The client
> narratives show that this means very different things. The calculator makes
> the arithmetic visible instead of asking an AE to understand an opaque
> expected-value number.”

If time allows, switch sample accounts:

| Client | What to point out |
| --- | --- |
| BrightPath | `$49` one-time course purchase |
| Meridian | `$12.99/month × 1 month`; no invented retention or LTV |
| NovaDash | `$79` pre-calculated downstream value; paid conversion happens in-product |
| Stackform | `$4,200 contract × 14% close rate = $588` per demo; 75-day cycle disclosed |
| Thornfield | `$185` order value; homepage and product page stay unpriced |

### 6. Show compounding

Point to Checkout lift.

> “A shipped win does not add a flat 3 percentage points. It multiplies the
> current rate by 1.03. Five 3% wins produce:
>
> `1.03⁵ - 1 = 15.9%` relative lift.
>
> Each later winner starts from the already-improved rate, so conversion and
> revenue gains compound. The model accrues the full difference from the
> original baseline for every day after deployment.”

### 7. Show cadence changing the output

Scroll to **Client update rhythm** below the experiment runway.

> “Thornfield asks for a readout every 14 days. That creates 27 progress
> snapshots across the 365-day plan. Each snapshot shows completed tests,
> shipped wins, tests still live, and cumulative value on the representative
> path.”

Change **How often will you report?** from `14` to `30`.

> “The strip changes to monthly updates. The annual test capacity and winner
> math do not change, because a reporting meeting should not stop a valid test.”

Reset the sample.

### 8. Close with the opportunity views

Point to:

- the experiment runway;
- traffic-supported capacity ranking; and
- direct modeled value ranking.

> “These rankings are intentionally separate. Combining them into one
> proprietary opportunity score would hide the tradeoff. Traffic tells us
> where we can learn fastest. Supplied value tells us where the clearest
> economic case is.”

## Backbone statistical calculation

### Inputs for one page

For Thornfield Checkout:

```text
daily visitors                 = 860
baseline conversion rate       = 0.69
relative MDE                   = 0.03
confidence target              = 0.95
significance level (alpha)     = 1 - 0.95 = 0.05
power                          = 0.80
traffic split                  = 50 / 50
minimum runtime                = 14 days
```

The conversion rate under the target alternative is:

```text
p0 = 0.69
p1 = p0 × (1 + MDE)
   = 0.69 × 1.03
   = 0.7107
```

The two-sided two-proportion normal approximation uses:

```text
z(1 - alpha/2) = z(0.975) = 1.95996
z(power)       = z(0.80)  = 0.84162
p_bar          = (p0 + p1) / 2
```

Sample size per variant:

```text
n =
  [z(1 - alpha/2) × sqrt(2 × p_bar × (1 - p_bar))
   + z(power) × sqrt(p0 × (1 - p0) + p1 × (1 - p1))]^2
  / (p1 - p0)^2

n = 7,688 visitors per variant
```

Therefore:

```text
total visitors = 15,376
traffic days   = ceil(15,376 / 860) = 18
test duration  = max(18 traffic days, 14 minimum days) = 18 days
```

This is what “grounded in real traffic” means in the planner.

### When traffic is insufficient

NovaDash’s pricing page supplies:

```text
700 daily visitors
1.8% baseline conversion
3% relative MDE
```

At 95% confidence and 80% power, that target needs about 1.93M total visitors,
or 2,759 days. The planner does not count a partial test. It solves the inverse
question by bisection: with 365 days of traffic, the smallest reliably
measurable relative lift is about 8.35%.

### Execution scheduling

For the default four launches per 30 days:

```text
launch interval = 30 / 4 = 7.5 days
```

At each launch slot:

1. finish any tests whose sample and minimum runtime are complete;
2. deploy and compound any winner;
3. exclude pages already running a test;
4. exclude tests that cannot finish inside the horizon; and
5. choose the available page with the largest direct post-deployment value
   opportunity, breaking ties by shorter test duration and stable page order.

The traffic ceiling removes step 5’s global launch limit but still allows only
one active test per page.

### Winner simulation

For each of 10,000 seeded trials:

```text
winner ~ Bernoulli(program win rate)
```

If a test wins:

```text
new page rate = current page rate × (1 + expected shipped-win lift)
```

The next test is sized from that new rate, so win order can change later test
duration. That path dependence is why the planner simulates full years instead
of applying a simple binomial interval to a fixed test count.

### Compounded conversion and value

If five Checkout winners each deliver 3% relative lift:

```text
ending rate / starting rate = 1.03^5
relative lift               = 1.03^5 - 1
                            = 15.9%
```

For each period after a winner:

```text
extra conversions per day
  = daily visitors × (current compounded rate - original rate)

added value
  = extra conversions per day
    × days that improved rate is live
    × transparent value per conversion
```

The calculation starts only when the winner deploys. Losing treatments create
no lasting effect and are modeled as neutral.

### Reporting checkpoints

For cadence `c` and horizon `H`, checkpoints occur at:

```text
c, 2c, 3c, ... < H, H
```

At each checkpoint the representative path reports:

- tests with `end_day <= checkpoint`;
- winners among those completed tests;
- tests with `start_day <= checkpoint < end_day`; and
- cumulative post-deployment value through that day.

Cadence changes this reporting layer. It does not change sample size, test end
dates, or the annual distribution.

## Design choices and why they exist

### One screen, two jobs

The left side is the AE’s control surface. The right side is the client story.
An AE can edit a number without leaving the result they are explaining.

### One dominant number

The test count is the first visual anchor because it answers the feasibility
question before the conversation moves to wins and dollars. It also prevents
the page from looking like a grid of equally important dashboard cards.

### Coframe visual language

The UI uses public Coframe tokens:

```text
background     #F7F8FB
primary text   #1F212F
brand blue     #5A52EC
support blue   #9FC0FF
atmosphere     #D3DDF5
```

The font stack starts with Inter and falls back to the operating system’s UI
font. It stays readable and requires no remote font request during a live demo.

### Plain-English first

Labels are phrased as questions an AE can ask:

- “How far ahead?”
- “How often will you report?”
- “How often do tests win?”
- “What counts as a conversion?”
- “How does this conversion create value?”

Every input and headline metric has a keyboard-accessible tooltip. Technical
details live under “How this is calculated,” so rigor is available without
making it the opening experience.

### No blended account conversion rate

Homepage clicks, sign-ups, demos, and orders are different events and may share
visitors. The planner keeps relative conversion lift page-level. It only
aggregates compatible quantities: tests, winners, and supplied dollar value.

### No invented ROI

The brief supplies no program cost. The product therefore says “likely added
value,” not ROI or payback.

### Deterministic narrative

No LLM generates the sales story. The same inputs produce the same metrics,
timeline, and language. Every claim can be traced to code and assumptions.

## Likely questions

### “Why 95% confidence and 80% power?”

They are conventional defaults for fixed-horizon A/B testing and match the
requested 5% significance / 80% power standard. Both are visible; power is
under Fine-tune the model.

### “Is the MDE absolute or relative?”

Relative. A 3% lift on a 69% baseline means `69% × 1.03 = 71.07%`, not 72%.

### “Why require at least 14 days?”

The sample formula answers how many visitors are needed, not whether the sample
covers weekly behavior. The editable floor prevents a high-traffic page from
claiming a one-day test is automatically robust.

### “Why Monte Carlo?”

Winner order changes the compounded baseline; that can change the sample
requirement for later tests and which page is available at a launch slot. A
fixed-count binomial model misses that path dependence.

### “Does a monthly readout force monthly tests?”

No. Reporting cadence changes progress snapshots only. A test runs until it has
enough visitors and satisfies the minimum runtime.

### “Does revenue compound?”

Yes. Every shipped win raises the current page rate, not the original one. The
revenue integral uses the full difference between the current compounded rate
and the original rate for every post-deployment day.

### “Why is NovaDash value zero?”

Its only valued page cannot reliably detect the supplied 3% relative lift in
the one-year horizon. The tool refuses to monetize an underpowered result and
shows the roughly 8.35% lift the traffic can support.

### “Why can Stackform’s likely winner count be zero?”

It supports roughly four completed tests at a 15% win rate. The chance of zero
winners is `0.85^4 ≈ 52%`, so zero is the honest median even though the upside
case has winners.

### “What is missing for production?”

Eligible traffic, traffic forecasts, idea supply, implementation effort,
deployment lag, funnel relationships, retention, margin, program cost, and
forecast-vs-actual calibration. Those are production inputs, not values to
invent in a sales prototype.

## Edge-case demo options

Use one if asked:

1. **NovaDash pricing:** show the 2,759-day requirement and attainable MDE.
2. **Stackform demo:** show `$4,200 × 14% = $588` and the 75-day timing note.
3. **Meridian subscription:** show why only one paid month is counted by default.
4. **Set value to none:** dollars disappear while testing and lift remain.
5. **Raise certainty or power:** sample size and test duration increase.
6. **Lower launch pace:** execution plan falls but traffic ceiling does not.
7. **Change reporting cadence:** only the checkpoint strip changes.

## Final close

> “The core choice is honesty over a bigger number. Traffic determines what can
> be learned, operating pace determines what can be shipped, and only supplied
> business value becomes dollars. Every assumption is visible, every result is
> reproducible, and the AE can change the story live with the client.”

## Before presenting

```bash
npm install
npm test
npm run dev
```

Then:

1. open Thornfield;
2. keep Checkout expanded;
3. confirm the headline reads 47 tests and 12 wins;
4. practice changing launch pace, shipped-win lift, and reporting cadence;
5. reset the sample between changes; and
6. keep `README.md` and `RESEARCH_LOG.md` available for deeper questions.

