import { describe, expect, it } from "vitest";

import { getScenario } from "../data/clients";
import {
  assessPageFeasibility,
  calculateAttainableLift,
  calculateTestSizing,
  inverseNormalCdf,
  validateScenario,
} from "./statistics";
import type { PageInput, ProgramInputs } from "./types";

const program: ProgramInputs = {
  horizon_days: 365,
  reporting_cadence_days: 30,
  win_rate: 0.2,
  confidence_target: 0.95,
  power_target: 0.8,
  min_test_days: 14,
  launches_per_30_days: 4,
};

const page: PageInput = {
  id: "reference",
  name: "Reference page",
  conversion_name: "purchase",
  daily_visitors: 1000,
  baseline_rate: 0.1,
  revenue_per_conversion: 50,
  min_detectable_lift: 0.1,
  expected_winner_lift: 0.1,
};

describe("inverseNormalCdf", () => {
  it("matches standard normal reference quantiles", () => {
    expect(inverseNormalCdf(0.975)).toBeCloseTo(1.9599639845, 7);
    expect(inverseNormalCdf(0.8)).toBeCloseTo(0.8416212336, 7);
  });

  it("rejects probabilities outside the open unit interval", () => {
    expect(() => inverseNormalCdf(0)).toThrow(RangeError);
    expect(() => inverseNormalCdf(1)).toThrow(RangeError);
  });
});

describe("calculateTestSizing", () => {
  it("matches an independently calculated two-proportion reference case", () => {
    const result = calculateTestSizing(page, program);

    expect(result.treatment_rate).toBeCloseTo(0.11);
    expect(result.sample_per_variant).toBe(14751);
    expect(result.total_sample).toBe(29502);
    expect(result.sample_days).toBe(30);
    expect(result.duration_days).toBe(30);
  });

  it("applies the minimum runtime when traffic satisfies the sample sooner", () => {
    const thornfield = getScenario("thornfield");
    const result = calculateTestSizing(thornfield.pages[0], thornfield.program);

    expect(result.total_sample).toBe(102876);
    expect(result.sample_days).toBe(6);
    expect(result.duration_days).toBe(14);
  });
});

describe("page feasibility", () => {
  it("identifies an underpowered page and solves its attainable lift", () => {
    const novadash = getScenario("novadash");
    const pricing = novadash.pages.find((candidate) => candidate.id === "pricing");
    expect(pricing).toBeDefined();

    const sizing = calculateTestSizing(pricing!, novadash.program);
    const attainable = calculateAttainableLift(pricing!, novadash.program);

    expect(sizing.duration_days).toBe(2759);
    expect(attainable).toBeCloseTo(0.08353627, 6);

    const feasibility = assessPageFeasibility(novadash.pages, novadash.program);
    expect(feasibility.find((item) => item.page_id === "pricing")).toMatchObject({
      testable_in_horizon: false,
    });
  });
});

describe("validateScenario", () => {
  it("accepts every supplied client scenario", () => {
    for (const id of [
      "brightpath",
      "meridian",
      "novadash",
      "stackform",
      "thornfield",
    ]) {
      expect(validateScenario(getScenario(id))).toEqual([]);
    }
  });

  it("reports impossible rates and invalid traffic without coercing them", () => {
    const invalid = getScenario("thornfield");
    invalid.pages[0].daily_visitors = 0;
    invalid.pages[0].baseline_rate = 0.99;
    invalid.pages[0].min_detectable_lift = 0.1;

    const paths = validateScenario(invalid).map((issue) => issue.path);
    expect(paths).toContain("pages.0.daily_visitors");
    expect(paths).toContain("pages.0.min_detectable_lift");
  });
});
