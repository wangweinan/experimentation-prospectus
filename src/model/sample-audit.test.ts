import { describe, expect, it } from "vitest";

import { CLIENT_SCENARIOS, cloneScenario } from "../data/clients";
import { buildForecast } from "./forecast";
import { valuePerConversion } from "./value";

function round(value: number): number {
  return Math.round(value);
}

describe("supplied-client audit", () => {
  it("keeps every scenario valid, bounded, and reproducible", () => {
    const audit = CLIENT_SCENARIOS.map((source) => {
      const scenario = cloneScenario(source);
      const result = buildForecast(scenario);
      const maxLaunches =
        Math.floor(
          (scenario.program.horizon_days - Number.EPSILON) /
            (30 / scenario.program.launches_per_30_days),
        ) + 1;

      expect(result.validation_issues).toEqual([]);
      scenario.pages.forEach((page) => {
        expect(page.expected_winner_lift).toBe(page.min_detectable_lift);
        expect(valuePerConversion(page)).toBeCloseTo(
          page.revenue_per_conversion,
        );
      });
      expect(result.execution.tests.upside).toBeLessThanOrEqual(maxLaunches);
      expect(result.execution.tests.likely).toBeLessThanOrEqual(
        result.traffic_ceiling.tests.likely,
      );
      expect(
        result.representative_timeline.every(
          (test) => test.end_day <= scenario.program.horizon_days,
        ),
      ).toBe(true);
      expect(result.with_plan_value.likely).toBeCloseTo(
        result.baseline_value + result.execution.incremental_value.likely,
      );
      expect(result.value_trajectory.at(-1)?.value).toEqual(
        result.execution.incremental_value,
      );

      return {
        company: scenario.company,
        reliable_tests: {
          conservative: result.execution.tests.conservative,
          likely: result.execution.tests.likely,
          upside: result.execution.tests.upside,
        },
        likely_winners: {
          conservative: result.execution.winners.conservative,
          likely: result.execution.winners.likely,
          upside: result.execution.winners.upside,
        },
        incremental_modeled_value: {
          conservative: round(result.execution.incremental_value.conservative),
          likely: round(result.execution.incremental_value.likely),
          upside: round(result.execution.incremental_value.upside),
        },
        traffic_supported_tests: result.traffic_ceiling.tests.likely,
      };
    });

    expect(audit).toMatchSnapshot();
  });
});
