import type { CSSProperties } from "react";

import { InfoTip } from "./InfoTip";
import type {
  ClientScenario,
  ReadoutCheckpoint,
  TestRecord,
} from "../model/types";
import {
  formatCurrency,
  formatDays,
  formatInteger,
  formatPercent,
} from "../ui/format";

interface RunwayProps {
  scenario: ClientScenario;
  records: TestRecord[];
  readouts: ReadoutCheckpoint[];
}

function ReadoutStrip({
  readouts,
  cadence,
}: {
  readouts: ReadoutCheckpoint[];
  cadence: number;
}) {
  const hasValue = readouts.some((readout) => readout.incremental_value > 0);
  return (
    <div className="readout-plan">
      <div>
        <p className="eyebrow">
          Client update rhythm
          <InfoTip text="Changing the cadence changes these progress snapshots, not when a statistically reliable test finishes." />
        </p>
        <h3>
          {formatInteger(readouts.length)} updates, about every{" "}
          {formatDays(cadence)}
        </h3>
        <p>
          Each update shows what has finished, what has shipped, and what is
          still running on the representative likely path.
        </p>
      </div>
      <div className="readout-scroll" tabIndex={0} aria-label="Client readout checkpoints">
        <div className="readout-strip">
          {readouts.map((readout, index) => (
            <article key={readout.day}>
              <span>
                {index === readouts.length - 1 ? "Final" : `Update ${index + 1}`} ·
                Day {readout.day}
              </span>
              <strong>{readout.completed_tests} tests complete</strong>
              <p>
                {readout.shipped_winners} wins shipped · {readout.active_tests}{" "}
                live
              </p>
              <small>
                {hasValue
                  ? `${formatCurrency(readout.incremental_value)} value unlocked`
                  : "Dollar value not modeled"}
              </small>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Runway({ scenario, records, readouts }: RunwayProps) {
  const { horizon_days: horizon, reporting_cadence_days: cadence } =
    scenario.program;
  const checkpointCount = Math.floor(horizon / cadence);
  const labelEvery = Math.max(1, Math.ceil(checkpointCount / 12));
  const labels = Array.from({ length: checkpointCount }, (_, index) => {
    const number = index + 1;
    return {
      day: number * cadence,
      show: number % labelEvery === 0,
    };
  });

  if (records.length === 0) {
    return (
      <section className="runway-section section-rule" aria-labelledby="runway-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">12-month runway</p>
            <h2 id="runway-title">No completed tests fit this plan yet.</h2>
          </div>
        </div>
        <p className="empty-state">
          Increase traffic, target a larger detectable lift, extend the horizon,
          or raise launch capacity to create a reliable roadmap.
        </p>
        <ReadoutStrip
          readouts={readouts}
          cadence={scenario.program.reporting_cadence_days}
        />
      </section>
    );
  }

  return (
    <section className="runway-section section-rule" aria-labelledby="runway-title">
      <div className="section-heading section-heading--split">
        <div>
          <p className="eyebrow">12-month runway</p>
          <h2 id="runway-title">A representative likely path</h2>
        </div>
        <div className="runway-legend" aria-label="Runway legend">
          <span><i className="legend-swatch" /> Completed test</span>
          <span><i className="legend-swatch legend-swatch--winner" /> Winner deployed</span>
          <span><i className="legend-rule" /> Client readout</span>
        </div>
      </div>
      <p className="section-intro">
        Tests keep running through readout dates. Winners begin contributing only
        after their test completes.
      </p>

      <div className="runway-scroll" tabIndex={0} aria-label="Scrollable experiment runway">
        <div
          className="runway"
          style={
            {
              "--checkpoint-size": `${(cadence / horizon) * 100}%`,
            } as CSSProperties
          }
        >
          <div className="runway__axis" aria-hidden="true">
            <span style={{ left: "0%" }}>Day 0</span>
            {labels
              .filter((label) => label.show)
              .map((label) => (
                <span
                  key={label.day}
                  style={{ left: `${(label.day / horizon) * 100}%` }}
                >
                  D{label.day}
                </span>
              ))}
            <span className="runway__axis-end">{formatDays(horizon)}</span>
          </div>

          {scenario.pages.map((page) => {
            const pageRecords = records.filter(
              (record) => record.page_id === page.id,
            );
            return (
              <div className="runway__row" key={page.id}>
                <div className="runway__label">
                  <strong>{page.name}</strong>
                  <small>{pageRecords.length} tests</small>
                </div>
                <div className="runway__track">
                  {pageRecords.map((record) => {
                    const duration = record.end_day - record.start_day;
                    const label = `${page.name}, test ${record.test_number}: ${formatDays(
                      duration,
                    )}, ${record.won ? "winner deployed" : "no winner"}, baseline ${
                      formatPercent(record.baseline_before)
                    } to ${formatPercent(record.baseline_after)}`;
                    return (
                      <span
                        key={`${page.id}-${record.test_number}`}
                        className={`runway__test ${
                          record.won ? "runway__test--winner" : ""
                        }`}
                        style={{
                          left: `${(record.start_day / horizon) * 100}%`,
                          width: `${Math.max(
                            (duration / horizon) * 100,
                            0.7,
                          )}%`,
                        }}
                        role="img"
                        aria-label={label}
                        title={label}
                      >
                        <span aria-hidden="true">{record.test_number}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <ReadoutStrip
        readouts={readouts}
        cadence={scenario.program.reporting_cadence_days}
      />
    </section>
  );
}
