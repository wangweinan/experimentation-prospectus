export interface ProgramInputs {
  horizon_days: number;
  reporting_cadence_days: number;
  win_rate: number;
  confidence_target: number;
  power_target: number;
  min_test_days: number;
  launches_per_30_days: number;
}

export type PageValueModel =
  | { kind: "none" }
  | { kind: "one_time"; amount: number }
  | {
      kind: "subscription";
      monthly_amount: number;
      months_counted: number;
    }
  | {
      kind: "lead";
      contract_value: number;
      close_rate: number;
      sales_cycle_days: number;
    }
  | {
      kind: "expected";
      expected_value: number;
      timing_note: string;
    };

export interface PageInput {
  id: string;
  name: string;
  conversion_name: string;
  daily_visitors: number;
  baseline_rate: number;
  revenue_per_conversion: number;
  min_detectable_lift: number;
  expected_winner_lift: number;
  value_model?: PageValueModel;
}

export interface ClientScenario {
  id: string;
  company: string;
  context: string;
  program: ProgramInputs;
  pages: PageInput[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface TestSizing {
  baseline_rate: number;
  treatment_rate: number;
  sample_per_variant: number;
  total_sample: number;
  sample_days: number;
  duration_days: number;
}

export interface PageFeasibility {
  page_id: string;
  sizing: TestSizing | null;
  testable_in_horizon: boolean;
  attainable_lift: number | null;
  issue: string | null;
}

export interface TestRecord {
  page_id: string;
  test_number: number;
  start_day: number;
  end_day: number;
  won: boolean;
  baseline_before: number;
  baseline_after: number;
}

export interface PageTrialResult {
  page_id: string;
  tests: number;
  winners: number;
  final_rate: number;
  relative_lift: number;
  incremental_conversions: number;
  incremental_value: number;
}

export interface TrialResult {
  tests: number;
  winners: number;
  incremental_value: number;
  pages: PageTrialResult[];
  timeline: TestRecord[];
  checkpoint_values: number[];
}

export interface Range {
  conservative: number;
  likely: number;
  upside: number;
}

export interface PageForecast {
  page_id: string;
  tests: Range;
  winners: Range;
  relative_lift: Range;
  incremental_conversions: Range;
  incremental_value: Range;
}

export interface ForecastSummary {
  tests: Range;
  winners: Range;
  incremental_value: Range;
  pages: PageForecast[];
}

export interface ReadoutCheckpoint {
  day: number;
  completed_tests: number;
  active_tests: number;
  shipped_winners: number;
  incremental_value: number;
}

export interface ValueTrajectoryPoint {
  day: number;
  value: Range;
}

export interface ForecastResult {
  execution: ForecastSummary;
  traffic_ceiling: ForecastSummary;
  representative_timeline: TestRecord[];
  readouts: ReadoutCheckpoint[];
  value_trajectory: ValueTrajectoryPoint[];
  feasibility: PageFeasibility[];
  baseline_value: number;
  with_plan_value: Range;
  validation_issues: ValidationIssue[];
  simulation_runs: number;
}
