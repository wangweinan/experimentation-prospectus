import { describe, expect, it } from "vitest";

import { getScenario } from "../data/clients";
import { buildForecast } from "./forecast";
import type { ClientScenario } from "./types";

function onePageScenario(overrides: Partial<ClientScenario> = {}): ClientScenario {
  return {
    id: "test",
    company: "Test account",
    context: "",
    program: {
      horizon_days: 30,
      reporting_cadence_days: 7,
      win_rate: 1,
      confidence_target: 0.95,
      power_target: 0.8,
      min_test_days: 14,
      launches_per_30_days: 1,
    },
    pages: [
      {
        id: "page",
        name: "Page",
        conversion_name: "purchase",
        daily_visitors: 100_000,
        baseline_rate: 0.1,
        revenue_per_conversion: 10,
        min_detectable_lift: 0.1,
        expected_winner_lift: 0.1,
      },
    ],
    ...overrides,
  };
}

describe("buildForecast", () => {
  it("is deterministic for the same inputs and seed derivation", () => {
    const scenario = getScenario("thornfield");
    expect(buildForecast(scenario, 200)).toEqual(buildForecast(scenario, 200));
  });

  it("does not let presentation-only cadence change modeled outcomes", () => {
    const first = getScenario("thornfield");
    const second = getScenario("thornfield");
    second.program.reporting_cadence_days = 30;

    const firstResult = buildForecast(first, 200);
    const secondResult = buildForecast(second, 200);
    expect(secondResult.execution).toEqual(firstResult.execution);
    expect(secondResult.representative_timeline).toEqual(
      firstResult.representative_timeline,
    );
  });

  it("does not redraw winner paths when only a one-page dollar value changes", () => {
    const first = onePageScenario();
    const second = onePageScenario();
    second.pages[0].revenue_per_conversion = 20;

    const firstResult = buildForecast(first, 200);
    const secondResult = buildForecast(second, 200);

    expect(secondResult.execution.tests).toEqual(firstResult.execution.tests);
    expect(secondResult.execution.winners).toEqual(firstResult.execution.winners);
    expect(secondResult.execution.pages[0].relative_lift).toEqual(
      firstResult.execution.pages[0].relative_lift,
    );
    expect(secondResult.execution.incremental_value.likely).toBeCloseTo(
      firstResult.execution.incremental_value.likely * 2,
    );
  });

  it("counts value only after a winner deploys", () => {
    const result = buildForecast(onePageScenario(), 20);

    expect(result.execution.tests.likely).toBe(1);
    expect(result.execution.winners.likely).toBe(1);
    expect(result.execution.incremental_value.likely).toBeCloseTo(160_000);
    expect(result.baseline_value).toBeCloseTo(3_000_000);
    expect(result.with_plan_value.likely).toBeCloseTo(3_160_000);
  });

  it("uses a separate shipped-winner lift without changing test sizing", () => {
    const scenario = onePageScenario();
    scenario.pages[0].expected_winner_lift = 0.2;

    const result = buildForecast(scenario, 20);
    expect(result.execution.tests.likely).toBe(1);
    expect(result.execution.pages[0].relative_lift.likely).toBeCloseTo(0.2);
    expect(result.execution.incremental_value.likely).toBeCloseTo(320_000);
  });

  it("turns reporting cadence into cumulative client checkpoints", () => {
    const result = buildForecast(onePageScenario(), 20);

    expect(result.readouts.map((readout) => readout.day)).toEqual([
      7, 14, 21, 28, 30,
    ]);
    expect(result.readouts[0]).toMatchObject({
      completed_tests: 0,
      active_tests: 1,
      shipped_winners: 0,
      incremental_value: 0,
    });
    expect(result.readouts[1]).toMatchObject({
      completed_tests: 1,
      active_tests: 0,
      shipped_winners: 1,
      incremental_value: 0,
    });
    expect(result.readouts[2].incremental_value).toBeCloseTo(70_000);
    expect(result.readouts.at(-1)?.incremental_value).toBeCloseTo(160_000);
    expect(result.value_trajectory.map((point) => point.day)).toEqual([
      0, 7, 14, 21, 28, 30,
    ]);
    expect(result.value_trajectory[0].value).toEqual({
      conservative: 0,
      likely: 0,
      upside: 0,
    });
    expect(result.value_trajectory.at(-1)?.value).toEqual(
      result.execution.incremental_value,
    );
  });

  it("compounds later winners and prevents overlapping tests on a page", () => {
    const scenario = onePageScenario();
    scenario.program.horizon_days = 60;
    scenario.program.launches_per_30_days = 30;

    const result = buildForecast(scenario, 20);
    const page = result.execution.pages[0];
    const records = result.representative_timeline;

    expect(page.tests.likely).toBe(4);
    expect(page.winners.likely).toBe(4);
    expect(page.relative_lift.likely).toBeCloseTo(0.4641);
    expect(page.incremental_value.likely).toBeCloseTo(1_083_040);
    expect(result.readouts.at(-1)?.incremental_value).toBeCloseTo(1_083_040);
    for (let index = 1; index < records.length; index += 1) {
      expect(records[index].start_day).toBeGreaterThanOrEqual(
        records[index - 1].end_day,
      );
    }
  });

  it("respects evenly spaced global launch opportunities", () => {
    const result = buildForecast(getScenario("thornfield"), 200);
    const starts = result.representative_timeline
      .map((record) => record.start_day)
      .sort((left, right) => left - right);

    for (let index = 1; index < starts.length; index += 1) {
      expect(starts[index] - starts[index - 1]).toBeGreaterThanOrEqual(7.5);
    }
    expect(
      result.representative_timeline.every(
        (record) => record.end_day <= 365,
      ),
    ).toBe(true);
  });

  it("does not assign dollar impact to pages with no supplied value", () => {
    const scenario = onePageScenario();
    scenario.pages[0].revenue_per_conversion = 0;

    const result = buildForecast(scenario, 20);
    expect(result.execution.incremental_value).toEqual({
      conservative: 0,
      likely: 0,
      upside: 0,
    });
    expect(result.execution.pages[0].relative_lift.likely).toBeGreaterThan(0);
  });

  it("keeps planning percentiles ordered and execution below the traffic ceiling", () => {
    const result = buildForecast(getScenario("brightpath"), 500);
    const { tests, winners, incremental_value: value } = result.execution;

    expect(tests.conservative).toBeLessThanOrEqual(tests.likely);
    expect(tests.likely).toBeLessThanOrEqual(tests.upside);
    expect(winners.conservative).toBeLessThanOrEqual(winners.likely);
    expect(winners.likely).toBeLessThanOrEqual(winners.upside);
    expect(value.conservative).toBeLessThanOrEqual(value.likely);
    expect(value.likely).toBeLessThanOrEqual(value.upside);
    expect(result.execution.tests.likely).toBeLessThanOrEqual(
      result.traffic_ceiling.tests.likely,
    );
  });

  it("models linked funnel stages against one terminal value", () => {
    const scenario = getScenario("thornfield");
    const result = buildForecast(scenario, 200);
    const finalComposition = result.value_composition.at(-1);
    const composedValue = Object.values(
      finalComposition?.page_values ?? {},
    ).reduce((total, value) => total + value, 0);

    expect(result.baseline_value).toBeCloseTo(40_069_335);
    expect(
      result.execution.pages.find((page) => page.page_id === "homepage")
        ?.incremental_value.upside,
    ).toBeGreaterThan(0);
    expect(
      result.execution.pages.find((page) => page.page_id === "product")
        ?.incremental_value.upside,
    ).toBeGreaterThan(0);
    expect(composedValue).toBeCloseTo(
      result.readouts.at(-1)?.incremental_value ?? 0,
    );
    expect(result.value_trajectory.at(-1)?.value).toEqual(
      result.execution.incremental_value,
    );
  });

  it("returns actionable validation issues instead of success-shaped output", () => {
    const scenario = onePageScenario();
    scenario.pages[0].daily_visitors = 0;

    const result = buildForecast(scenario, 20);
    expect(result.simulation_runs).toBe(0);
    expect(result.validation_issues).toContainEqual({
      path: "pages.0.daily_visitors",
      message: "Daily visitors must be greater than zero.",
    });
  });
});
