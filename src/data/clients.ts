import type { ClientScenario, ProgramInputs } from "../model/types";

const DEFAULT_ADVANCED = {
  power_target: 0.8,
  min_test_days: 14,
  launches_per_30_days: 4,
} as const;

function program(
  inputs: Omit<
    ProgramInputs,
    "power_target" | "min_test_days" | "launches_per_30_days"
  >,
): ProgramInputs {
  return { ...inputs, ...DEFAULT_ADVANCED };
}

export const CLIENT_SCENARIOS: readonly ClientScenario[] = [
  {
    id: "brightpath",
    company: "BrightPath",
    context:
      "Mid-market e-learning platform selling individual course enrolments at $49.",
    program: program({
      horizon_days: 365,
      reporting_cadence_days: 30,
      win_rate: 0.2,
      confidence_target: 0.95,
    }),
    pages: [
      ["homepage", "Homepage", 5200, 0.038, 49, 0.08],
      [
        "course-project-management",
        "Course: Project Management Fundamentals",
        1800,
        0.071,
        49,
        0.06,
      ],
      [
        "course-excel",
        "Course: Data Analysis with Excel",
        1400,
        0.065,
        49,
        0.06,
      ],
      [
        "course-leadership",
        "Course: Leadership Essentials",
        920,
        0.058,
        49,
        0.05,
      ],
      [
        "course-python",
        "Course: Python for Beginners",
        870,
        0.082,
        49,
        0.05,
      ],
      [
        "course-communication",
        "Course: Business Communication",
        640,
        0.049,
        49,
        0.05,
      ],
      [
        "course-long-tail",
        "All other course pages (combined)",
        3100,
        0.041,
        49,
        0.07,
      ],
    ].map(([id, name, visitors, rate, value, lift]) => ({
      id: String(id),
      name: String(name),
      conversion_name: "course purchase",
      daily_visitors: Number(visitors),
      baseline_rate: Number(rate),
      revenue_per_conversion: Number(value),
      min_detectable_lift: Number(lift),
      expected_winner_lift: Number(lift),
      value_model: { kind: "one_time", amount: 49 },
    })),
  },
  {
    id: "meridian",
    company: "Meridian",
    context:
      "Consumer fitness app with a $12.99 monthly subscription and a web-to-app funnel.",
    program: program({
      horizon_days: 365,
      reporting_cadence_days: 7,
      win_rate: 0.2,
      confidence_target: 0.95,
    }),
    pages: [
      {
        id: "homepage",
        name: "Homepage",
        conversion_name: "subscription sign-up",
        daily_visitors: 11000,
        baseline_rate: 0.044,
        revenue_per_conversion: 12.99,
        min_detectable_lift: 0.08,
        expected_winner_lift: 0.08,
        value_model: {
          kind: "subscription",
          monthly_amount: 12.99,
          months_counted: 1,
        },
      },
      {
        id: "sign-up",
        name: "Sign-up page",
        conversion_name: "completed subscription sign-up",
        daily_visitors: 4800,
        baseline_rate: 0.57,
        revenue_per_conversion: 12.99,
        min_detectable_lift: 0.04,
        expected_winner_lift: 0.04,
        value_model: {
          kind: "subscription",
          monthly_amount: 12.99,
          months_counted: 1,
        },
      },
    ],
  },
  {
    id: "novadash",
    company: "NovaDash",
    context:
      "Mid-market project management SaaS with a freemium, web-to-product motion.",
    program: program({
      horizon_days: 365,
      reporting_cadence_days: 30,
      win_rate: 0.2,
      confidence_target: 0.95,
    }),
    pages: [
      {
        id: "homepage",
        name: "Homepage",
        conversion_name: "visitor who starts sign-up",
        daily_visitors: 9400,
        baseline_rate: 0.048,
        revenue_per_conversion: 0,
        min_detectable_lift: 0.08,
        expected_winner_lift: 0.08,
      },
      {
        id: "pricing",
        name: "Pricing page",
        conversion_name: "free-trial start",
        daily_visitors: 700,
        baseline_rate: 0.018,
        revenue_per_conversion: 79,
        min_detectable_lift: 0.03,
        expected_winner_lift: 0.03,
        value_model: {
          kind: "expected",
          expected_value: 79,
          timing_note: "Paid conversion happens later inside the product",
        },
      },
      {
        id: "sign-up",
        name: "Sign-up form",
        conversion_name: "completed sign-up",
        daily_visitors: 4500,
        baseline_rate: 0.61,
        revenue_per_conversion: 0,
        min_detectable_lift: 0.04,
        expected_winner_lift: 0.04,
      },
    ],
  },
  {
    id: "stackform",
    company: "Stackform",
    context:
      "B2B developer tooling company with a demo-led sales motion and a 75-day cycle.",
    program: program({
      horizon_days: 365,
      reporting_cadence_days: 30,
      win_rate: 0.15,
      confidence_target: 0.95,
    }),
    pages: [
      {
        id: "homepage",
        name: "Homepage",
        conversion_name: "visitor who reaches the demo flow",
        daily_visitors: 1800,
        baseline_rate: 0.031,
        revenue_per_conversion: 0,
        min_detectable_lift: 0.07,
        expected_winner_lift: 0.07,
      },
      {
        id: "demo-request",
        name: "Demo request page",
        conversion_name: "demo request",
        daily_visitors: 620,
        baseline_rate: 0.074,
        revenue_per_conversion: 588,
        min_detectable_lift: 0.06,
        expected_winner_lift: 0.06,
        value_model: {
          kind: "lead",
          contract_value: 4200,
          close_rate: 0.14,
          sales_cycle_days: 75,
        },
      },
    ],
  },
  {
    id: "thornfield",
    company: "Thornfield & Co",
    context:
      "Mid-market apparel retailer with a product-to-checkout bottleneck.",
    program: program({
      horizon_days: 365,
      reporting_cadence_days: 14,
      win_rate: 0.25,
      confidence_target: 0.95,
    }),
    pages: [
      {
        id: "homepage",
        name: "Homepage",
        conversion_name: "visitor who reaches a product page",
        daily_visitors: 18000,
        baseline_rate: 0.031,
        revenue_per_conversion: 0,
        min_detectable_lift: 0.1,
        expected_winner_lift: 0.1,
      },
      {
        id: "product",
        name: "Product page",
        conversion_name: "visitor who starts checkout",
        daily_visitors: 9400,
        baseline_rate: 0.042,
        revenue_per_conversion: 0,
        min_detectable_lift: 0.06,
        expected_winner_lift: 0.06,
      },
      {
        id: "checkout",
        name: "Checkout",
        conversion_name: "completed order",
        daily_visitors: 860,
        baseline_rate: 0.69,
        revenue_per_conversion: 185,
        min_detectable_lift: 0.03,
        expected_winner_lift: 0.03,
        value_model: { kind: "one_time", amount: 185 },
      },
    ],
  },
];

export const DEFAULT_CLIENT_ID = "thornfield";

export function cloneScenario(scenario: ClientScenario): ClientScenario {
  return {
    ...scenario,
    program: { ...scenario.program },
    pages: scenario.pages.map((page) => ({ ...page })),
  };
}

export function getScenario(id: string): ClientScenario {
  const scenario =
    CLIENT_SCENARIOS.find((candidate) => candidate.id === id) ??
    CLIENT_SCENARIOS.find((candidate) => candidate.id === DEFAULT_CLIENT_ID);

  if (!scenario) {
    throw new Error("No experimentation client scenarios are available.");
  }

  return cloneScenario(scenario);
}
