import { InfoTip } from "./InfoTip";
import type {
  PageInput,
  Range,
  ValueCompositionPoint,
  ValueTrajectoryPoint,
} from "../model/types";
import { formatCurrency, formatInteger } from "../ui/format";

const WIDTH = 960;
const HEIGHT = 410;
const MARGIN = { top: 24, right: 118, bottom: 54, left: 86 };
const PAGE_COLORS = [
  "#3b82f6",
  "#f59e0b",
  "#10b981",
  "#ec4899",
  "#06b6d4",
  "#8b5cf6",
  "#84cc16",
];

function niceCeiling(value: number): number {
  if (value <= 0) {
    return 1;
  }
  const power = 10 ** Math.floor(Math.log10(value));
  const normalized = value / power;
  return (
    ([1, 1.5, 2, 3, 5, 7.5, 10].find(
      (candidate) => normalized <= candidate,
    ) ?? 10) * power
  );
}

function linePath(
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

function areaPath(
  points: { day: number; lower: number; upper: number }[],
  x: (day: number) => number,
  y: (value: number) => number,
): string {
  return [
    ...points.map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(point.day).toFixed(2)} ${y(
          point.upper,
        ).toFixed(2)}`,
    ),
    ...points
      .slice()
      .reverse()
      .map(
        (point) =>
          `L ${x(point.day).toFixed(2)} ${y(point.lower).toFixed(2)}`,
      ),
    "Z",
  ].join(" ");
}

export function ValueTrajectory({
  points,
  composition,
  pages,
  horizonDays,
  simulationRuns,
}: {
  points: ValueTrajectoryPoint[];
  composition: ValueCompositionPoint[];
  pages: PageInput[];
  horizonDays: number;
  simulationRuns: number;
}) {
  const final = points.at(-1)?.value;
  if (!final || final.upside <= 0) {
    return (
      <section className="trajectory-section section-rule" aria-labelledby="trajectory-title">
        <p className="eyebrow">Cumulative value path</p>
        <h2 id="trajectory-title">Add a terminal value to plot the opportunity over time.</h2>
        <p className="section-intro">
          Testing capacity and page lift remain available without a dollar model.
        </p>
      </section>
    );
  }

  const maxValue = niceCeiling(final.upside);
  const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const x = (day: number): number =>
    MARGIN.left + (day / horizonDays) * plotWidth;
  const y = (value: number): number =>
    MARGIN.top + plotHeight - (value / maxValue) * plotHeight;
  const yTicks = Array.from(
    { length: 5 },
    (_, index) => (maxValue * index) / 4,
  );
  const xTicks = Array.from(
    { length: 5 },
    (_, index) => (horizonDays * index) / 4,
  );
  const bandPath = [
    ...points.map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${x(point.day).toFixed(2)} ${y(
          point.value.upside,
        ).toFixed(2)}`,
    ),
    ...points
      .slice()
      .reverse()
      .map(
        (point) =>
          `L ${x(point.day).toFixed(2)} ${y(
            point.value.conservative,
          ).toFixed(2)}`,
      ),
    "Z",
  ].join(" ");

  const compositionByDay = new Map(
    composition.map((point) => [point.day, point.page_values]),
  );
  const cumulativeByPoint = points.map(() => 0);
  const pageAreas = pages
    .map((page, pageIndex) => {
      const areaPoints = points.map((point, pointIndex) => {
        const pageValues = compositionByDay.get(point.day) ?? {};
        const representativeTotal = Object.values(pageValues).reduce(
          (total, value) => total + value,
          0,
        );
        const share =
          representativeTotal > 0
            ? (pageValues[page.id] ?? 0) / representativeTotal
            : 0;
        const lower = cumulativeByPoint[pointIndex];
        const upper = lower + point.value.likely * share;
        cumulativeByPoint[pointIndex] = upper;
        return { day: point.day, lower, upper };
      });
      const last = areaPoints.at(-1);
      return {
        page,
        color: PAGE_COLORS[pageIndex % PAGE_COLORS.length],
        areaPoints,
        finalContribution: (last?.upper ?? 0) - (last?.lower ?? 0),
      };
    })
    .filter((area) => area.finalContribution > 0);

  return (
    <section className="trajectory-section section-rule" aria-labelledby="trajectory-title">
      <div className="section-heading section-heading--split">
        <div>
          <p className="eyebrow">
            Cumulative value path
            <InfoTip
              text={`The shaded band spans P10–P90 across ${formatInteger(
                simulationRuns,
              )} simulations. The solid line is P50; stacked colors show its page mix.`}
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
          <small>conservative estimate</small>
        </div>
        <div className="trajectory-estimates__likely">
          <span>Likely · P50</span>
          <strong>{formatCurrency(final.likely)}</strong>
          <small>median estimate</small>
        </div>
        <div>
          <span>High · P90</span>
          <strong>{formatCurrency(final.upside)}</strong>
          <small>upside estimate</small>
        </div>
      </div>

      <div className="trajectory-scroll" tabIndex={0} aria-label="Scrollable cumulative value chart">
        <svg
          className="trajectory-chart"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Cumulative value from day zero to day ${horizonDays}, including low, likely, high, and page composition estimates.`}
        >
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
                  index === 0
                    ? "start"
                    : index === xTicks.length - 1
                      ? "end"
                      : "middle"
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

          <path d={bandPath} fill="#d3ddf5" fillOpacity={0.7} />
          {pageAreas.map((area) => (
            <path
              key={area.page.id}
              className="trajectory-chart__page-area"
              d={areaPath(area.areaPoints, x, y)}
              fill={area.color}
            />
          ))}
          <path
            d={linePath(points, "upside", x, y)}
            fill="none"
            stroke="#3933a8"
            strokeWidth={2}
            strokeDasharray="2 6"
            strokeLinecap="round"
          />
          <path
            d={linePath(points, "conservative", x, y)}
            fill="none"
            stroke="#9fc0ff"
            strokeWidth={2}
            strokeDasharray="5 6"
          />
          <path
            d={linePath(points, "likely", x, y)}
            fill="none"
            stroke="#5a52ec"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {points.map((point) => (
            <circle
              key={point.day}
              cx={x(point.day)}
              cy={y(point.value.likely)}
              r={3}
              fill="#fcfcff"
              stroke="#5a52ec"
              strokeWidth={1.5}
            >
              <title>
                Day {point.day}: Low {formatCurrency(point.value.conservative)},
                Likely {formatCurrency(point.value.likely)}, High{" "}
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
      <div className="trajectory-composition" aria-label="Likely value composition by page">
        <strong>Likely composition</strong>
        {pageAreas.map((area) => (
          <span key={area.page.id}>
            <i style={{ backgroundColor: area.color }} />
            {area.page.name}
          </span>
        ))}
      </div>
      <p className="trajectory-caption">
        P10–P90 range and P50 path across {formatInteger(simulationRuns)} seeded
        simulations. Colored areas stack to P50 using page shares from one
        representative near-median path.
      </p>
    </section>
  );
}
