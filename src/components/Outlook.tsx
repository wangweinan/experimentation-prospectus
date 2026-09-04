import { InfoTip } from "./InfoTip";
import { Runway } from "./Runway";
import { ValueTrajectory } from "./ValueTrajectory";
import type {
  ClientScenario,
  ForecastResult,
  PageForecast,
  Range,
} from "../model/types";
import { describeValueModel, valuePerConversion } from "../model/value";
import {
  formatCompactNumber,
  formatCurrency,
  formatDays,
  formatInteger,
  formatPercent,
  rangeText,
} from "../ui/format";

interface OutlookProps {
  scenario: ClientScenario;
  forecast: ForecastResult;
  updating: boolean;
  onPrint: () => void;
}

function MetricStrand({
  label,
  detail,
  tooltip,
  range,
  format,
}: {
  label: string;
  detail: string;
  tooltip: string;
  range: Range;
  format: (value: number) => string;
}) {
  return (
    <article className="metric-strand">
      <p>
        {label}
        <InfoTip text={tooltip} />
      </p>
      <strong>{format(range.likely)}</strong>
      <span>{detail}</span>
      <div className="metric-strand__range">
        <small>Conservative {format(range.conservative)}</small>
        <i aria-hidden="true" />
        <small>Upside {format(range.upside)}</small>
      </div>
    </article>
  );
}

function pageForecastById(
  forecasts: PageForecast[],
  pageId: string,
): PageForecast {
  const forecast = forecasts.find((candidate) => candidate.page_id === pageId);
  if (!forecast) {
    throw new Error(`Missing forecast for page "${pageId}".`);
  }
  return forecast;
}

function InvalidOutlook({ forecast }: { forecast: ForecastResult }) {
  const uniqueMessages = [
    ...new Set(forecast.validation_issues.map((issue) => issue.message)),
  ];
  return (
    <section className="invalid-outlook" aria-live="polite">
      <p className="eyebrow">Outlook paused</p>
      <h1>Fix the highlighted inputs to rebuild the plan.</h1>
      <ul>
        {uniqueMessages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
    </section>
  );
}

export function Outlook({
  scenario,
  forecast,
  updating,
  onPrint,
}: OutlookProps) {
  if (forecast.validation_issues.length > 0) {
    return (
      <div className="outlook">
        <InvalidOutlook forecast={forecast} />
      </div>
    );
  }

  const execution = forecast.execution;
  const ceiling = forecast.traffic_ceiling;
  const hasDirectValue = scenario.pages.some(
    (page) => valuePerConversion(page) > 0,
  );
  const horizonLabel =
    scenario.program.horizon_days === 365
      ? "12-month"
      : `${formatInteger(scenario.program.horizon_days)}-day`;
  const pageOutlooks = scenario.pages.map((page) => ({
      page,
      forecast: pageForecastById(execution.pages, page.id),
    }));
  const directlyValuedOutlooks = pageOutlooks.filter(
    ({ forecast: pageForecast }) => pageForecast.incremental_value.likely > 0,
  );
  const leadingLiftPage = (
    directlyValuedOutlooks.length > 0 ? directlyValuedOutlooks : pageOutlooks
  )
    .slice()
    .sort(
      (left, right) =>
        right.forecast.incremental_value.likely -
          left.forecast.incremental_value.likely ||
        right.forecast.relative_lift.likely - left.forecast.relative_lift.likely,
    )[0];
  const capacityShare =
    ceiling.tests.likely > 0
      ? Math.min(1, execution.tests.likely / ceiling.tests.likely)
      : 0;
  const constrained = forecast.feasibility.filter(
    (item) => !item.testable_in_horizon,
  );
  const dollarRanking = scenario.pages
    .map((page) => ({
      page,
      forecast: pageForecastById(execution.pages, page.id),
    }))
    .sort(
      (left, right) =>
        right.forecast.incremental_value.likely -
        left.forecast.incremental_value.likely,
    );
  const capacityRanking = scenario.pages
    .map((page) => ({
      page,
      forecast: pageForecastById(ceiling.pages, page.id),
    }))
    .sort(
      (left, right) =>
        right.forecast.tests.likely - left.forecast.tests.likely,
    );
  const valueBases = [
    ...new Set(
      scenario.pages
        .filter((page) => valuePerConversion(page) > 0)
        .map(describeValueModel),
    ),
  ];

  return (
    <div
      className={`outlook ${updating ? "outlook--updating" : ""}`}
      id="outlook"
      aria-busy={updating}
    >
      <header className="outlook-header">
        <div>
          <p className="eyebrow">{scenario.company} · Experimentation outlook</p>
          <h1>
            <span className="outlook-header__number">
              {formatInteger(execution.tests.likely)}
            </span>
            <span className="outlook-header__declaration">
              reliable tests
              <small>
                over the {horizonLabel} plan
                <InfoTip text="For each page, we calculate how many visitors a trustworthy A/B test needs, apply the shortest-test rule, then fit tests into the delivery calendar." />
              </small>
            </span>
          </h1>
          <div className="outlook-header__impact">
            <p>
              <strong>{formatInteger(execution.winners.likely)}</strong>
              <span>
                likely wins
                <InfoTip
                  text={`The browser simulates this ${formatInteger(
                    scenario.program.horizon_days,
                  )}-day plan ${formatInteger(
                    forecast.simulation_runs,
                  )} times. Each completed test draws win or no win using your win-rate assumption. This is the middle result—not historical data.`}
                />
              </span>
            </p>
            <p>
              <strong>
                {hasDirectValue
                  ? formatCurrency(execution.incremental_value.likely)
                  : "Not modeled"}
              </strong>
              <span>
                likely growth value
                <InfoTip text="For every modeled winner: extra conversion rate × daily visitors × days left after launch × value of one conversion." />
              </span>
            </p>
          </div>
          <p className="outlook-header__context">{scenario.context}</p>
        </div>
        <div className="outlook-actions screen-only">
          <span className="model-status">
            <i aria-hidden="true" />
            {updating ? "Updating outlook" : "Outlook ready"}
          </span>
          <button className="print-button" type="button" onClick={onPrint}>
            Save or print
          </button>
        </div>
      </header>

      <section className="metric-spread" aria-label="Likely program outlook" aria-live="polite">
        <MetricStrand
          label="Likely wins"
          detail={`based on a ${formatPercent(scenario.program.win_rate, 0)} win rate`}
          tooltip={`The browser runs ${formatInteger(
            forecast.simulation_runs,
          )} simulated versions of this plan. Each completed test draws win or no win using your win rate. The large number is the middle outcome.`}
          range={execution.winners}
          format={formatInteger}
        />
        {leadingLiftPage ? (
          <MetricStrand
            label={`${leadingLiftPage.page.name} lift`}
            detail={`${leadingLiftPage.page.conversion_name}, after wins launch`}
            tooltip="Each winner raises this page's current conversion rate by the expected shipped-win lift. Multiple wins build on one another."
            range={leadingLiftPage.forecast.relative_lift}
            format={(value) => formatPercent(value)}
          />
        ) : null}
        {hasDirectValue ? (
          <MetricStrand
            label="Likely added value"
            detail="after winning changes launch"
            tooltip="Extra conversions after each winner launches, multiplied by the value you entered for that page. We do not count test-period value."
            range={execution.incremental_value}
            format={formatCurrency}
          />
        ) : (
          <article className="metric-strand">
            <p>
              Likely added value
              <InfoTip text="No page has a direct value above $0, so the planner deliberately avoids making a dollar claim." />
            </p>
            <strong>Not modeled</strong>
            <span>No page has a supplied direct value.</span>
          </article>
        )}
      </section>

      <section className="capacity-note" aria-labelledby="capacity-title">
        <div>
          <p className="eyebrow">
            Your experimentation runway
            <InfoTip text="The larger number is what visitor volume could support. The smaller number also respects how many tests your team can launch." />
          </p>
          <h2 id="capacity-title">
            Your traffic could support about {formatInteger(ceiling.tests.likely)}{" "}
            tests. This plan puts {formatInteger(execution.tests.likely)} of them
            on the calendar.
          </h2>
        </div>
        <div className="capacity-meter" aria-label={`${formatPercent(capacityShare, 0)} of traffic-supported capacity planned`}>
          <span style={{ width: `${capacityShare * 100}%` }} />
        </div>
        <p>
          {capacityShare < 0.95
            ? "Your team’s launch pace is the limiter here—not visitor traffic."
            : "The plan uses nearly all of the testing capacity supported by current traffic."}
        </p>
      </section>

      {hasDirectValue ? (
        <section className="value-bridge section-rule" aria-labelledby="value-bridge-title">
          <div className="section-heading">
            <p className="eyebrow">Value bridge</p>
            <h2 id="value-bridge-title">From today’s results to the likely plan</h2>
          </div>
          <div className="value-equation">
            <div>
              <span>
                Value at today’s rates
                <InfoTip text="Daily visitors × today's conversion rate × value of one conversion × days in the plan." />
              </span>
              <strong>{formatCurrency(forecast.baseline_value)}</strong>
              <small>starting modeled value</small>
            </div>
            <b aria-hidden="true">+</b>
            <div className="value-equation__accent">
              <span>
                Likely added value
                <InfoTip text="The extra conversions created after winners launch, multiplied by each page's supplied conversion value." />
              </span>
              <strong>{formatCurrency(execution.incremental_value.likely)}</strong>
              <small>
                {rangeText(execution.incremental_value, formatCurrency)} range
              </small>
            </div>
            <b aria-hidden="true">=</b>
            <div>
              <span>
                Likely total value
                <InfoTip text="Today's modeled baseline value plus the likely incremental value from the experimentation plan." />
              </span>
              <strong>{formatCurrency(forecast.with_plan_value.likely)}</strong>
              <small>same supplied value basis</small>
            </div>
          </div>
          <p className="value-basis-note">
            {valueBases.join(" ")} This is modeled conversion value,
            not audited revenue, cash timing, lifetime value, or ROI.
          </p>
        </section>
      ) : (
        <section className="value-bridge value-bridge--empty section-rule">
          <p className="eyebrow">Value bridge</p>
          <h2>Testing potential is visible; dollars are intentionally not inferred.</h2>
          <p>
            Add a direct value to a page when the business can support that
            attribution.
          </p>
        </section>
      )}

      <ValueTrajectory
        points={forecast.value_trajectory}
        horizonDays={scenario.program.horizon_days}
        simulationRuns={forecast.simulation_runs}
      />

      <Runway
        scenario={scenario}
        records={forecast.representative_timeline}
        readouts={forecast.readouts}
      />

      <section className="opportunity-section section-rule" aria-labelledby="opportunity-title">
        <div className="section-heading">
          <p className="eyebrow">Where to focus</p>
          <h2 id="opportunity-title">Two honest views of opportunity</h2>
        </div>
        <div className="ranking-spread">
          <div>
            <h3>Traffic-supported capacity</h3>
            <p>Pages that can sustain the most reliable learning.</p>
            <ol className="ranking-list">
              {capacityRanking.map(({ page, forecast: pageForecast }) => (
                <li key={page.id}>
                  <span>{page.name}</span>
                  <strong>{formatInteger(pageForecast.tests.likely)} tests</strong>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <h3>Direct modeled value</h3>
            <p>Pages prioritized by value supplied in this scenario.</p>
            <ol className="ranking-list">
              {dollarRanking.map(({ page, forecast: pageForecast }) => (
                <li key={page.id}>
                  <span>{page.name}</span>
                  <strong>
                    {valuePerConversion(page) > 0
                      ? formatCurrency(pageForecast.incremental_value.likely)
                      : "No direct value"}
                  </strong>
                </li>
              ))}
            </ol>
          </div>
        </div>

        <div className="table-scroll" tabIndex={0} aria-label="Scrollable page outlook table">
          <table className="page-table">
            <thead>
              <tr>
                <th>Page</th>
                <th>
                  One reliable test
                  <InfoTip text="Visitors needed for the target lift, converted into days and never shorter than your minimum test length." />
                </th>
                <th>
                  Likely tests
                  <InfoTip text="Tests that finish inside the plan after page traffic, test length, and launch pace are applied." />
                </th>
                <th>
                  Likely winners
                  <InfoTip
                    text={`The middle winner outcome across ${formatInteger(
                      forecast.simulation_runs,
                    )} simulated versions of this plan at your selected win rate.`}
                  />
                </th>
                <th>
                  Page lift
                  <InfoTip text="The page's ending conversion rate compared with today's rate after likely winners build on one another." />
                </th>
                <th>
                  Likely added value
                  <InfoTip text="Extra post-launch conversions × the value entered for this page. $0 means no direct value was supplied." />
                </th>
              </tr>
            </thead>
            <tbody>
              {scenario.pages.map((page) => {
                const pageForecast = pageForecastById(execution.pages, page.id);
                const feasibility = forecast.feasibility.find(
                  (item) => item.page_id === page.id,
                );
                return (
                  <tr key={page.id}>
                    <th scope="row">
                      {page.name}
                      <small>{page.conversion_name}</small>
                    </th>
                    <td>
                      {feasibility?.sizing ? (
                        <>
                          <strong>{formatDays(feasibility.sizing.duration_days)}</strong>
                          <small>
                            {formatCompactNumber(feasibility.sizing.total_sample)} visitors
                          </small>
                        </>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{formatInteger(pageForecast.tests.likely)}</td>
                    <td>
                      {formatInteger(pageForecast.winners.likely)}
                      <small>
                        {rangeText(pageForecast.winners, formatInteger)} range
                      </small>
                    </td>
                    <td>
                      {pageForecast.tests.likely > 0
                        ? formatPercent(pageForecast.relative_lift.likely)
                        : "—"}
                      {pageForecast.tests.likely > 0 ? (
                        <small>
                          {rangeText(pageForecast.relative_lift, (value) =>
                            formatPercent(value),
                          )}{" "}
                          range
                        </small>
                      ) : null}
                    </td>
                    <td>
                      {valuePerConversion(page) > 0
                        ? formatCurrency(pageForecast.incremental_value.likely)
                        : "Not modeled"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {constrained.length > 0 ? (
          <div className="constraint-callout">
            <p className="eyebrow">Traffic-constrained today</p>
            {constrained.map((item) => {
              const page = scenario.pages.find(
                (candidate) => candidate.id === item.page_id,
              );
              return (
                <p key={item.page_id}>
                  <strong>{page?.name}:</strong> {item.issue}{" "}
                  {item.attainable_lift
                    ? `Within this horizon, a lift around ${formatPercent(
                        item.attainable_lift,
                      )} is the smallest reliably measurable target.`
                    : "No valid lift can be measured within this horizon."}
                </p>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="talk-track section-rule" aria-labelledby="talk-track-title">
        <div className="section-heading">
          <p className="eyebrow">Client-ready talk track</p>
          <h2 id="talk-track-title">What the plan says, in plain English</h2>
        </div>
        <ol>
          <li>
            <span>01</span>
            <p>
              At the selected delivery pace, {scenario.company} can complete
              about <strong>{formatInteger(execution.tests.likely)} reliable tests</strong>{" "}
              over {formatDays(scenario.program.horizon_days)}. Current traffic
              could support about {formatInteger(ceiling.tests.likely)}, so the
              gap is visible rather than hidden.
            </p>
          </li>
          <li>
            <span>02</span>
            <p>
              With a {formatPercent(scenario.program.win_rate, 0)} win-rate
              assumption, the likely path produces{" "}
              <strong>{formatInteger(execution.winners.likely)} deployable winners</strong>,
              with {rangeText(execution.winners, formatInteger)} across the
              conservative-to-upside range.
            </p>
          </li>
          <li>
            <span>03</span>
            <p>
              Conversion lift is kept page-specific.{" "}
              {leadingLiftPage ? (
                <>
                  A leading page outlook is{" "}
                  <strong>
                    {leadingLiftPage.page.name} at{" "}
                    {formatPercent(leadingLiftPage.forecast.relative_lift.likely)}
                  </strong>
                  .
                </>
              ) : (
                "No page has a completed test in the current plan."
              )}
            </p>
          </li>
          <li>
            <span>04</span>
            <p>
              {hasDirectValue ? (
                <>
                  The plan could add{" "}
                  <strong>{formatCurrency(execution.incremental_value.likely)}</strong>{" "}
                  after winning changes launch, using only values supplied here.
                  It does not invent downstream value or call this ROI.
                </>
              ) : (
                "No direct conversion value was supplied, so the model makes no dollar claim."
              )}
            </p>
          </li>
        </ol>
      </section>

      <details className="methodology section-rule">
        <summary>
          <span>
            <span className="eyebrow">Methodology</span>
            <strong>How this is calculated</strong>
          </span>
          <span aria-hidden="true">Open</span>
        </summary>
        <div className="methodology__body">
          <div>
            <h3>How we size a test</h3>
            <p>
              We split visitors evenly between today’s page and the new version.
              We collect enough visits to meet your{" "}
              {formatPercent(scenario.program.confidence_target, 0)} certainty
              standard and {formatPercent(scenario.program.power_target, 0)}{" "}
              chance of spotting the target lift. Every test runs at least{" "}
              {formatDays(scenario.program.min_test_days)}. At the 95% default,
              the statistical significance level is 5%.
            </p>
          </div>
          <div>
            <h3>Likely range</h3>
            <p>
              The browser runs {formatInteger(forecast.simulation_runs)} seeded
              simulations of this {formatDays(scenario.program.horizon_days)}{" "}
              plan. Each simulation draws win or no win for completed tests.
              “Likely” is the middle result; “conservative” and “upside” show
              lower and upper planning cases. This is modeled uncertainty, not
              historical data or a guarantee.
            </p>
          </div>
          <div>
            <h3>Roadmap</h3>
            <p>
              A page never runs two tests at once. New tests start at a pace of{" "}
              {formatInteger(scenario.program.launches_per_30_days)} every 30
              days, beginning with the available page that has the clearest
              supplied dollar opportunity.
            </p>
          </div>
          <div>
            <h3>Winner impact</h3>
            <p>
              A winner improves the page by the separate shipped-win lift and
              starts creating value after launch. It defaults to the detectable
              lift, but can be edited. Every later win builds on the
              already-improved conversion rate, so conversion and revenue gains
              compound. Tests without a winner leave the page unchanged.
            </p>
          </div>
          <div>
            <h3>Value boundary</h3>
            <p>
              Supplied value is counted once per incremental conversion. The
              model does not infer funnel relationships, retention, lifetime
              value, sales-cycle timing, costs, or ROI.
            </p>
          </div>
          <div>
            <h3>Readout cadence</h3>
            <p>
              Readouts occur every {formatDays(scenario.program.reporting_cadence_days)}.
              They are checkpoints only; tests may continue through them.
            </p>
          </div>
        </div>
      </details>

      <footer className="outlook-footer">
        <p>
          Planning model · Inputs and assumptions remain editable · Not a
          performance guarantee
        </p>
      </footer>
    </div>
  );
}
