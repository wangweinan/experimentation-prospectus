import { InfoTip } from "./InfoTip";
import type { Range, ValueTrajectoryPoint } from "../model/types";
import { formatCurrency, formatInteger } from "../ui/format";

const WIDTH = 960;
const HEIGHT = 390;
const MARGIN = { top: 24, right: 28, bottom: 54, left: 86 };

function niceCeiling(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const power = 10 ** Math.floor(Math.log10(value));
  const normalized = value / power;
  const nice =
    [1, 1.5, 2, 3, 5, 7.5, 10].find((candidate) => normalized <= candidate) ??
    10;
  return nice * power;
}

function pathFor(
  points: ValueTrajectoryPoint[],
  key: keyof Range,
  x: (day: number) => number,
  y: (value: number) => number,
): string {
  return points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(point.day).toFixed(2)} ${y(
          point.value[key],
        ).toFixed(2)}`,
    )
    .join(" ");
}

export function ValueTrajectory({
  points,
  horizonDays,
  simulationRuns,
}: {
  points: ValueTrajectoryPoint[];
  horizonDays: number;
  simulationRuns: number;
}) {
  const final = points.at(-1)?.value;
  const maxValue = niceCeiling(
    Math.max(...points.map((point) => point.value.upside), 0),
  );

  if (!final || final.upside <= 0) {
    return (
      <section className="trajectory-section section-rule" aria-labelledby="trajectory-title">
        <p className="eyebrow">Cumulative value path</p>
        <h2 id="trajectory-title">Add a direct value to plot the opportunity over time.</h2>
        <p className="section-intro">
          Testing capacity and page lift remain available without a dollar model.
        </p>
      </section>
    );
  }

  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (day: number): number =>
    MARGIN.left + (day / horizonDays) * plotWidth;
  const y = (value: number): number =>
    MARGIN.top + plotHeight - (value / maxValue) * plotHeight;
  const lowPath = pathFor(points, "conservative", x, y);
  const likelyPath = pathFor(points, "likely", x, y);
  const highPath = pathFor(points, "upside", x, y);
  const bandPath = [
    ...points.map((point, index) =>
      `${index === 0 ? "M" : "L"} ${x(point.day).toFixed(2)} ${y(
        point.value.upside,
      ).toFixed(2)}`,
    ),
    ...points
      .slice()
      .reverse()
      .map((point) =>
        `L ${x(point.day).toFixed(2)} ${y(point.value.conservative).toFixed(2)}`,
      ),
    "Z",
  ].join(" ");
  const yTicks = Array.from({ length: 5 }, (_, index) => (maxValue * index) / 4);
  const xTicks = Array.from({ length: 5 }, (_, index) => (horizonDays * index) / 4);

  return (
    <section className="trajectory-section section-rule" aria-labelledby="trajectory-title">
      <div className="section-heading section-heading--split">
        <div>
          <p className="eyebrow">
            Cumulative value path
            <InfoTip
              text={`At every client checkpoint, we rank cumulative value across ${formatInteger(
                simulationRuns,
              )} simulated plans. The lines connect the low (10th percentile), likely (median), and high (90th percentile) estimates.`}
            />
          </p>
          <h2 id="trajectory-title">How value builds after winners ship</h2>
        </div>
        <p className="trajectory-note">
          Calendar time →<br />
          cumulative added value ↑
        </p>
      </div>

      <div className="trajectory-estimates" aria-label="Final value estimates">
        <div>
          <span>Low · P10</span>
          <strong>{formatCurrency(final.conservative)}</strong>
          <small>conservative path</small>
        </div>
        <div className="trajectory-estimates__likely">
          <span>Likely · P50</span>
          <strong>{formatCurrency(final.likely)}</strong>
          <small>median path</small>
        </div>
        <div>
          <span>High · P90</span>
          <strong>{formatCurrency(final.upside)}</strong>
          <small>upside path</small>
        </div>
      </div>

      <div className="trajectory-scroll" tabIndex={0} aria-label="Scrollable cumulative value chart">
        <svg
          className="trajectory-chart"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-labelledby="trajectory-svg-title trajectory-svg-description"
        >
          <title id="trajectory-svg-title">
            Low, likely, and high cumulative incremental value over time
          </title>
          <desc id="trajectory-svg-description">
            The horizontal axis covers day zero through day {horizonDays}. The
            vertical axis shows cumulative incremental modeled value. The three
            paths are the 10th, 50th, and 90th percentiles across the seeded
            simulations.
          </desc>

          {yTicks.map((tick) => (
            <g key={tick}>
              <line
                className="trajectory-chart__grid"
                x1={MARGIN.left}
                x2={WIDTH - MARGIN.right}
                y1={y(tick)}
                y2={y(tick)}
              />
              <text
                className="trajectory-chart__axis-label"
                x={MARGIN.left - 12}
                y={y(tick) + 4}
                textAnchor="end"
              >
                {formatCurrency(tick)}
              </text>
            </g>
          ))}

          {xTicks.map((tick, index) => (
            <g key={tick}>
              <line
                className="trajectory-chart__tick"
                x1={x(tick)}
                x2={x(tick)}
                y1={HEIGHT - MARGIN.bottom}
                y2={HEIGHT - MARGIN.bottom + 6}
              />
              <text
                className="trajectory-chart__axis-label"
                x={x(tick)}
                y={HEIGHT - MARGIN.bottom + 24}
                textAnchor={
                  index === 0 ? "start" : index === xTicks.length - 1 ? "end" : "middle"
                }
              >
                {index === 0
                  ? "Start"
                  : index === xTicks.length - 1
                    ? `Day ${horizonDays}`
                    : `Month ${Math.round(tick / 30)}`}
              </text>
            </g>
          ))}

          <path className="trajectory-chart__band" d={bandPath} />
          <path className="trajectory-chart__line trajectory-chart__line--high" d={highPath} />
          <path className="trajectory-chart__line trajectory-chart__line--low" d={lowPath} />
          <path className="trajectory-chart__line trajectory-chart__line--likely" d={likelyPath} />

          {points.map((point) => (
            <circle
              key={point.day}
              className="trajectory-chart__point"
              cx={x(point.day)}
              cy={y(point.value.likely)}
              r={3.5}
            >
              <title>
                Day {point.day}: low {formatCurrency(point.value.conservative)},
                likely {formatCurrency(point.value.likely)}, high{" "}
                {formatCurrency(point.value.upside)}
              </title>
            </circle>
          ))}
        </svg>
      </div>

      <div className="trajectory-legend" aria-hidden="true">
        <span><i className="trajectory-legend__low" /> Low · P10</span>
        <span><i className="trajectory-legend__likely" /> Likely · P50</span>
        <span><i className="trajectory-legend__high" /> High · P90</span>
      </div>
      <p className="trajectory-caption">
        Pointwise estimates across {formatInteger(simulationRuns)} seeded
        simulations of this{" "}
        {horizonDays}-day plan. Value remains at zero until the first modeled
        winner finishes and ships.
      </p>
    </section>
  );
}
