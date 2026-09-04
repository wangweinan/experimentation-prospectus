import type {
  ClientScenario,
  PageFeasibility,
  PageInput,
  ProgramInputs,
  TestSizing,
  ValidationIssue,
} from "./types";
import { resolveValueModel, valuePerConversion } from "./value";

const MIN_PROBABILITY = 1e-12;
const MAX_PROBABILITY = 1 - MIN_PROBABILITY;
const NORMAL_A = [
  -39.69683028665376, 220.9460984245205, -275.9285104469687,
  138.357751867269, -30.66479806614716, 2.506628277459239,
];
const NORMAL_B = [
  -54.47609879822406, 161.5858368580409, -155.6989798598866,
  66.80131188771972, -13.28068155288572,
];
const NORMAL_C = [
  -0.007784894002430293, -0.3223964580411365, -2.400758277161838,
  -2.549732539343734, 4.374664141464968, 2.938163982698783,
];
const NORMAL_D = [
  0.007784695709041462, 0.3224671290700398, 2.445134137142996,
  3.754408661907416,
];

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

function addRangeIssue(
  issues: ValidationIssue[],
  path: string,
  value: number,
  min: number,
  max: number,
  label: string,
): void {
  if (!isFiniteNumber(value) || value < min || value > max) {
    issues.push({ path, message: `${label} must be between ${min} and ${max}.` });
  }
}

export function validateScenario(scenario: ClientScenario): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { program } = scenario;

  if (!scenario.company.trim()) {
    issues.push({ path: "company", message: "Add a company name." });
  }

  addRangeIssue(
    issues,
    "program.horizon_days",
    program.horizon_days,
    1,
    730,
    "Planning horizon",
  );
  addRangeIssue(
    issues,
    "program.reporting_cadence_days",
    program.reporting_cadence_days,
    1,
    Math.max(1, program.horizon_days),
    "Reporting cadence",
  );
  addRangeIssue(
    issues,
    "program.win_rate",
    program.win_rate,
    0,
    1,
    "Win rate",
  );
  addRangeIssue(
    issues,
    "program.confidence_target",
    program.confidence_target,
    0.5001,
    0.9999,
    "Confidence target",
  );
  addRangeIssue(
    issues,
    "program.power_target",
    program.power_target,
    0.5001,
    0.9999,
    "Power target",
  );
  addRangeIssue(
    issues,
    "program.min_test_days",
    program.min_test_days,
    1,
    Math.max(1, program.horizon_days),
    "Minimum test runtime",
  );
  addRangeIssue(
    issues,
    "program.launches_per_30_days",
    program.launches_per_30_days,
    1,
    30,
    "Launch capacity",
  );

  if (!Number.isInteger(program.horizon_days)) {
    issues.push({
      path: "program.horizon_days",
      message: "Planning horizon must be a whole number of days.",
    });
  }
  if (!Number.isInteger(program.reporting_cadence_days)) {
    issues.push({
      path: "program.reporting_cadence_days",
      message: "Reporting cadence must be a whole number of days.",
    });
  }
  if (!Number.isInteger(program.min_test_days)) {
    issues.push({
      path: "program.min_test_days",
      message: "Minimum test runtime must be a whole number of days.",
    });
  }
  if (!Number.isInteger(program.launches_per_30_days)) {
    issues.push({
      path: "program.launches_per_30_days",
      message: "Launch capacity must be a whole number.",
    });
  }

  if (scenario.pages.length === 0) {
    issues.push({ path: "pages", message: "Add at least one page to model." });
  }

  const seenIds = new Set<string>();
  scenario.pages.forEach((page, index) => {
    const basePath = `pages.${index}`;
    if (!page.id || seenIds.has(page.id)) {
      issues.push({
        path: `${basePath}.id`,
        message: "Each page needs a unique identifier.",
      });
    }
    seenIds.add(page.id);

    if (!page.name.trim()) {
      issues.push({ path: `${basePath}.name`, message: "Add a page name." });
    }
    if (!page.conversion_name.trim()) {
      issues.push({
        path: `${basePath}.conversion_name`,
        message: "Describe what counts as a conversion on this page.",
      });
    }
    if (!isFiniteNumber(page.daily_visitors) || page.daily_visitors <= 0) {
      issues.push({
        path: `${basePath}.daily_visitors`,
        message: "Daily visitors must be greater than zero.",
      });
    }
    if (
      !isFiniteNumber(page.baseline_rate) ||
      page.baseline_rate <= 0 ||
      page.baseline_rate >= 1
    ) {
      issues.push({
        path: `${basePath}.baseline_rate`,
        message: "Baseline conversion rate must be between 0% and 100%.",
      });
    }
    if (!page.value_model) {
      if (
        !isFiniteNumber(page.revenue_per_conversion) ||
        page.revenue_per_conversion < 0
      ) {
        issues.push({
          path: `${basePath}.revenue_per_conversion`,
          message: "Value per conversion cannot be negative.",
        });
      }
    } else {
      const valueModel = resolveValueModel(page);
      if (
        valueModel.kind === "one_time" &&
        (!isFiniteNumber(valueModel.amount) || valueModel.amount < 0)
      ) {
        issues.push({
          path: `${basePath}.value_model.amount`,
          message: "Revenue per purchase cannot be negative.",
        });
      }
      if (valueModel.kind === "subscription") {
        if (
          !isFiniteNumber(valueModel.monthly_amount) ||
          valueModel.monthly_amount < 0
        ) {
          issues.push({
            path: `${basePath}.value_model.monthly_amount`,
            message: "Monthly revenue cannot be negative.",
          });
        }
        if (
          !isFiniteNumber(valueModel.months_counted) ||
          valueModel.months_counted <= 0 ||
          valueModel.months_counted > 120
        ) {
          issues.push({
            path: `${basePath}.value_model.months_counted`,
            message: "Months counted must be greater than 0 and no more than 120.",
          });
        }
      }
      if (valueModel.kind === "lead") {
        if (
          !isFiniteNumber(valueModel.contract_value) ||
          valueModel.contract_value < 0
        ) {
          issues.push({
            path: `${basePath}.value_model.contract_value`,
            message: "Contract value cannot be negative.",
          });
        }
        if (
          !isFiniteNumber(valueModel.close_rate) ||
          valueModel.close_rate < 0 ||
          valueModel.close_rate > 1
        ) {
          issues.push({
            path: `${basePath}.value_model.close_rate`,
            message: "Close rate must be between 0% and 100%.",
          });
        }
        if (
          !Number.isInteger(valueModel.sales_cycle_days) ||
          valueModel.sales_cycle_days < 0 ||
          valueModel.sales_cycle_days > 730
        ) {
          issues.push({
            path: `${basePath}.value_model.sales_cycle_days`,
            message: "Sales cycle must be a whole number from 0 to 730 days.",
          });
        }
      }
      if (
        valueModel.kind === "expected" &&
        (!isFiniteNumber(valueModel.expected_value) ||
          valueModel.expected_value < 0)
      ) {
        issues.push({
          path: `${basePath}.value_model.expected_value`,
          message: "Expected value cannot be negative.",
        });
      }
    }
    if (!isFiniteNumber(valuePerConversion(page))) {
      issues.push({
        path: `${basePath}.value_model`,
        message: "Value inputs must produce a valid dollar amount.",
      });
    }
    if (
      !isFiniteNumber(page.min_detectable_lift) ||
      page.min_detectable_lift <= 0
    ) {
      issues.push({
        path: `${basePath}.min_detectable_lift`,
        message: "Minimum detectable lift must be greater than 0%.",
      });
    } else if (
      isFiniteNumber(page.baseline_rate) &&
      page.baseline_rate > 0 &&
      page.baseline_rate * (1 + page.min_detectable_lift) >= 1
    ) {
      issues.push({
        path: `${basePath}.min_detectable_lift`,
        message: "This lift would imply a conversion rate of 100% or more.",
      });
    }
    if (
      !isFiniteNumber(page.expected_winner_lift) ||
      page.expected_winner_lift <= 0
    ) {
      issues.push({
        path: `${basePath}.expected_winner_lift`,
        message: "Expected winner lift must be greater than 0%.",
      });
    } else if (
      isFiniteNumber(page.baseline_rate) &&
      page.baseline_rate > 0 &&
      page.baseline_rate * (1 + page.expected_winner_lift) >= 1
    ) {
      issues.push({
        path: `${basePath}.expected_winner_lift`,
        message: "This winner lift would imply a conversion rate of 100% or more.",
      });
    }
  });

  return issues;
}

// Peter J. Acklam's rational approximation, accurate well beyond UI precision.
export function inverseNormalCdf(probability: number): number {
  if (probability <= 0 || probability >= 1 || !Number.isFinite(probability)) {
    throw new RangeError("Probability must be strictly between 0 and 1.");
  }

  const lower = 0.02425;
  const upper = 1 - lower;

  if (probability < lower) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (
      (((((NORMAL_C[0] * q + NORMAL_C[1]) * q + NORMAL_C[2]) * q +
        NORMAL_C[3]) *
        q +
        NORMAL_C[4]) *
        q +
        NORMAL_C[5]) /
      ((((NORMAL_D[0] * q + NORMAL_D[1]) * q + NORMAL_D[2]) * q +
        NORMAL_D[3]) *
        q +
        1)
    );
  }

  if (probability <= upper) {
    const q = probability - 0.5;
    const r = q * q;
    return (
      (((((NORMAL_A[0] * r + NORMAL_A[1]) * r + NORMAL_A[2]) * r +
        NORMAL_A[3]) *
        r +
        NORMAL_A[4]) *
        r +
        NORMAL_A[5]) *
      q /
      (((((NORMAL_B[0] * r + NORMAL_B[1]) * r + NORMAL_B[2]) * r +
        NORMAL_B[3]) *
        r +
        NORMAL_B[4]) *
        r +
        1)
    );
  }

  const q = Math.sqrt(-2 * Math.log(1 - probability));
  return -(
    (((((NORMAL_C[0] * q + NORMAL_C[1]) * q + NORMAL_C[2]) * q +
      NORMAL_C[3]) *
      q +
      NORMAL_C[4]) *
      q +
      NORMAL_C[5]) /
    ((((NORMAL_D[0] * q + NORMAL_D[1]) * q + NORMAL_D[2]) * q +
      NORMAL_D[3]) *
      q +
      1)
  );
}

export function calculateTestSizing(
  page: PageInput,
  program: ProgramInputs,
  baselineRate = page.baseline_rate,
): TestSizing {
  const treatmentRate = baselineRate * (1 + page.min_detectable_lift);
  if (
    baselineRate <= 0 ||
    baselineRate >= 1 ||
    treatmentRate <= baselineRate ||
    treatmentRate >= 1
  ) {
    throw new RangeError("Baseline and treatment rates must be valid probabilities.");
  }

  const alpha = 1 - program.confidence_target;
  const zAlpha = inverseNormalCdf(1 - alpha / 2);
  const zPower = inverseNormalCdf(program.power_target);
  const pooledRate = (baselineRate + treatmentRate) / 2;
  const absoluteDifference = treatmentRate - baselineRate;
  const nullVariance = Math.sqrt(2 * pooledRate * (1 - pooledRate));
  const alternativeVariance = Math.sqrt(
    baselineRate * (1 - baselineRate) +
      treatmentRate * (1 - treatmentRate),
  );
  const numerator = zAlpha * nullVariance + zPower * alternativeVariance;
  const samplePerVariant = Math.ceil(
    (numerator * numerator) / (absoluteDifference * absoluteDifference),
  );
  const totalSample = samplePerVariant * 2;
  const sampleDays = Math.ceil(totalSample / page.daily_visitors);

  return {
    baseline_rate: baselineRate,
    treatment_rate: treatmentRate,
    sample_per_variant: samplePerVariant,
    total_sample: totalSample,
    sample_days: sampleDays,
    duration_days: Math.max(sampleDays, program.min_test_days),
  };
}

export function calculateAttainableLift(
  page: PageInput,
  program: ProgramInputs,
): number | null {
  if (program.horizon_days < program.min_test_days) {
    return null;
  }

  const maxLift = MAX_PROBABILITY / page.baseline_rate - 1;
  if (maxLift <= 0) {
    return null;
  }

  const fits = (lift: number): boolean => {
    const sizing = calculateTestSizing(
      { ...page, min_detectable_lift: lift },
      program,
    );
    return sizing.duration_days <= program.horizon_days;
  };

  if (!fits(maxLift)) {
    return null;
  }

  let lower = MIN_PROBABILITY;
  let upper = maxLift;
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const midpoint = (lower + upper) / 2;
    if (fits(midpoint)) {
      upper = midpoint;
    } else {
      lower = midpoint;
    }
  }

  return upper;
}

export function assessPageFeasibility(
  pages: PageInput[],
  program: ProgramInputs,
): PageFeasibility[] {
  return pages.map((page) => {
    const sizing = calculateTestSizing(page, program);
    const testable = sizing.duration_days <= program.horizon_days;
    return {
      page_id: page.id,
      sizing,
      testable_in_horizon: testable,
      attainable_lift: testable ? page.min_detectable_lift : calculateAttainableLift(page, program),
      issue: testable
        ? null
        : `Needs ${sizing.duration_days.toLocaleString()} days at the current target lift.`,
    };
  });
}
