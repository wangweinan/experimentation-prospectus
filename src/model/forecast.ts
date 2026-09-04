import {
  assessPageFeasibility,
  calculateTestSizing,
  validateScenario,
} from "./statistics";
import { valuePerConversion } from "./value";
import type {
  ClientScenario,
  ForecastResult,
  ForecastSummary,
  PageForecast,
  PageInput,
  PageTrialResult,
  Range,
  ReadoutCheckpoint,
  TestRecord,
  TestSizing,
  TrialResult,
  ValueCompositionPoint,
  ValueTrajectoryPoint,
} from "./types";

export const DEFAULT_SIMULATION_RUNS = 1_000;

const EXECUTION_SALT = 0x8f1bbcdc;
const CEILING_SALT = 0x4a39b70d;
const EPSILON = 1e-9;

type RandomSource = () => number;
type SizingResolver = (page: PageInput, baselineRate: number) => TestSizing | null;

interface ActiveTest {
  start_day: number;
  end_day: number;
  won: boolean;
  baseline_before: number;
  test_number: number;
}

interface MutablePageState {
  input: PageInput;
  index: number;
  current_rate: number;
  last_value_day: number;
  incremental_conversions: number;
  tests: number;
  winners: number;
  active: ActiveTest | null;
  value_events: { day: number; value_per_day: number }[];
}

interface Candidate {
  state: MutablePageState;
  sizing: TestSizing;
  potential_value: number;
}

interface SimulationBundle {
  summary: ForecastSummary;
  representative_timeline: TestRecord[];
  representative_checkpoint_values: number[];
  value_trajectory: ValueTrajectoryPoint[];
  value_composition: ValueCompositionPoint[];
}

function emptyRange(): Range {
  return { conservative: 0, likely: 0, upside: 0 };
}

function emptySummary(pages: PageInput[]): ForecastSummary {
  return {
    tests: emptyRange(),
    winners: emptyRange(),
    incremental_value: emptyRange(),
    pages: pages.map((page) => ({
      page_id: page.id,
      tests: emptyRange(),
      winners: emptyRange(),
      relative_lift: emptyRange(),
      incremental_conversions: emptyRange(),
      incremental_value: emptyRange(),
    })),
  };
}

function createPageStates(pages: PageInput[]): MutablePageState[] {
  return pages.map((input, index) => ({
    input,
    index,
    current_rate: input.baseline_rate,
    last_value_day: 0,
    incremental_conversions: 0,
    tests: 0,
    winners: 0,
    active: null,
    value_events: [],
  }));
}

function funnelPageIds(scenario: ClientScenario): Set<string> {
  return new Set(
    scenario.funnel?.enabled
      ? scenario.funnel.stages.map((stage) => stage.page_id)
      : [],
  );
}

function funnelValuePerDay(
  scenario: ClientScenario,
  states: MutablePageState[],
  extraWinnerPageId?: string,
): number {
  const funnel = scenario.funnel;
  if (!funnel?.enabled || funnel.stages.length === 0) {
    return 0;
  }

  const stateById = new Map(states.map((state) => [state.input.id, state]));
  const firstPage = stateById.get(funnel.stages[0].page_id)?.input;
  const terminalPage = stateById.get(
    funnel.stages[funnel.stages.length - 1].page_id,
  )?.input;
  if (!firstPage || !terminalPage) {
    throw new Error("Funnel stages must reference modeled pages.");
  }

  const terminalEventsPerDay = funnel.stages.reduce(
    (volume, stage) => {
      const state = stateById.get(stage.page_id);
      if (!state) {
        throw new Error(`Missing funnel page "${stage.page_id}".`);
      }
      const winners =
        state.winners + (stage.page_id === extraWinnerPageId ? 1 : 0);
      const rate = Math.min(
        1 - EPSILON,
        stage.transition_rate *
          (1 + state.input.expected_winner_lift) ** winners,
      );
      return volume * rate;
    },
    firstPage.daily_visitors,
  );
  return terminalEventsPerDay * valuePerConversion(terminalPage);
}

function valueAtDay(state: MutablePageState, day: number): number {
  return state.value_events.reduce(
    (total, event) =>
      total + event.value_per_day * Math.max(0, day - event.day),
    0,
  );
}

function potentialValueForWinner(
  scenario: ClientScenario,
  states: MutablePageState[],
  state: MutablePageState,
  deploymentDay: number,
): number {
  const remainingDays = Math.max(
    0,
    scenario.program.horizon_days - deploymentDay,
  );
  if (funnelPageIds(scenario).has(state.input.id)) {
    return (
      (funnelValuePerDay(scenario, states, state.input.id) -
        funnelValuePerDay(scenario, states)) *
      remainingDays
    );
  }
  return (
    state.input.daily_visitors *
    state.current_rate *
    state.input.expected_winner_lift *
    valuePerConversion(state.input) *
    remainingDays
  );
}

function accrueIncrementalConversions(
  state: MutablePageState,
  throughDay: number,
): void {
  const elapsed = Math.max(0, throughDay - state.last_value_day);
  const incrementalRate = state.current_rate - state.input.baseline_rate;
  state.incremental_conversions +=
    state.input.daily_visitors * incrementalRate * elapsed;
  state.last_value_day = throughDay;
}

function completeTest(
  state: MutablePageState,
  active: ActiveTest,
  timeline: TestRecord[] | null,
  states: MutablePageState[],
  scenario: ClientScenario,
): void {
  let baselineAfter = active.baseline_before;
  state.tests += 1;

  if (active.won) {
    const inFunnel = funnelPageIds(scenario).has(state.input.id);
    const funnelBefore = inFunnel
      ? funnelValuePerDay(scenario, states)
      : 0;
    accrueIncrementalConversions(state, active.end_day);
    state.winners += 1;
    baselineAfter =
      active.baseline_before * (1 + state.input.expected_winner_lift);
    state.current_rate = baselineAfter;
    state.value_events.push({
      day: active.end_day,
      value_per_day: inFunnel
        ? funnelValuePerDay(scenario, states) - funnelBefore
        : (baselineAfter - active.baseline_before) *
          state.input.daily_visitors *
          valuePerConversion(state.input),
    });
  }

  if (timeline) {
    timeline.push({
      page_id: state.input.id,
      test_number: active.test_number,
      start_day: active.start_day,
      end_day: active.end_day,
      won: active.won,
      baseline_before: active.baseline_before,
      baseline_after: baselineAfter,
    });
  }

  state.active = null;
}

function finishTrial(
  states: MutablePageState[],
  horizonDays: number,
  timeline: TestRecord[],
  checkpointDays: number[],
): TrialResult {
  const checkpointPageValues = checkpointDays.map((day) =>
    states.map((state) => valueAtDay(state, day)),
  );
  const pages: PageTrialResult[] = states.map((state) => {
    accrueIncrementalConversions(state, horizonDays);
    return {
      page_id: state.input.id,
      tests: state.tests,
      winners: state.winners,
      final_rate: state.current_rate,
      relative_lift: state.current_rate / state.input.baseline_rate - 1,
      incremental_conversions: state.incremental_conversions,
      incremental_value: valueAtDay(state, horizonDays),
    };
  });

  timeline.sort(
    (left, right) =>
      left.start_day - right.start_day ||
      left.end_day - right.end_day ||
      states.findIndex((state) => state.input.id === left.page_id) -
        states.findIndex((state) => state.input.id === right.page_id),
  );

  return {
    tests: pages.reduce((total, page) => total + page.tests, 0),
    winners: pages.reduce((total, page) => total + page.winners, 0),
    incremental_value: pages.reduce(
      (total, page) => total + page.incremental_value,
      0,
    ),
    pages,
    timeline,
    checkpoint_values: checkpointPageValues.map((pageValues) =>
      pageValues.reduce((total, value) => total + value, 0),
    ),
    checkpoint_page_values: checkpointPageValues,
  };
}

function simulateExecutionTrial(
  scenario: ClientScenario,
  random: RandomSource,
  resolveSizing: SizingResolver,
  captureTimeline: boolean,
  checkpointDays: number[],
): TrialResult {
  const states = createPageStates(scenario.pages);
  const timeline = captureTimeline ? [] : null;
  const horizon = scenario.program.horizon_days;
  const launchInterval = 30 / scenario.program.launches_per_30_days;

  const completeThrough = (day: number): void => {
    const due = states
      .filter(
        (state) =>
          state.active !== null && state.active.end_day <= day + EPSILON,
      )
      .sort(
        (left, right) =>
          left.active!.end_day - right.active!.end_day ||
          left.index - right.index,
      );
    due.forEach((state) =>
      completeTest(state, state.active!, timeline, states, scenario),
    );
  };

  for (
    let launchDay = 0;
    launchDay < horizon - EPSILON;
    launchDay += launchInterval
  ) {
    completeThrough(launchDay);

    const candidates: Candidate[] = [];
    states.forEach((state) => {
      if (state.active) {
        return;
      }
      const sizing = resolveSizing(state.input, state.current_rate);
      if (!sizing || launchDay + sizing.duration_days > horizon + EPSILON) {
        return;
      }
      const deploymentDay = launchDay + sizing.duration_days;
      candidates.push({
        state,
        sizing,
        potential_value: potentialValueForWinner(
          scenario,
          states,
          state,
          deploymentDay,
        ),
      });
    });

    candidates.sort(
      (left, right) =>
        right.potential_value - left.potential_value ||
        left.sizing.duration_days - right.sizing.duration_days ||
        left.state.index - right.state.index,
    );
    const selected = candidates[0];
    if (!selected) {
      continue;
    }

    selected.state.active = {
      start_day: launchDay,
      end_day: launchDay + selected.sizing.duration_days,
      won: random() < scenario.program.win_rate,
      baseline_before: selected.state.current_rate,
      test_number: selected.state.tests + 1,
    };
  }

  completeThrough(horizon);
  return finishTrial(states, horizon, timeline ?? [], checkpointDays);
}

function simulateCeilingTrial(
  scenario: ClientScenario,
  random: RandomSource,
  resolveSizing: SizingResolver,
  captureTimeline: boolean,
  checkpointDays: number[],
): TrialResult {
  const states = createPageStates(scenario.pages);
  const timeline = captureTimeline ? [] : null;
  const horizon = scenario.program.horizon_days;

  states.forEach((state) => {
    let startDay = 0;
    while (startDay < horizon - EPSILON) {
      const sizing = resolveSizing(state.input, state.current_rate);
      if (!sizing || startDay + sizing.duration_days > horizon + EPSILON) {
        break;
      }

      const active: ActiveTest = {
        start_day: startDay,
        end_day: startDay + sizing.duration_days,
        won: random() < scenario.program.win_rate,
        baseline_before: state.current_rate,
        test_number: state.tests + 1,
      };
      state.active = active;
      completeTest(state, active, timeline, states, scenario);
      startDay = active.end_day;
    }
  });

  return finishTrial(states, horizon, timeline ?? [], checkpointDays);
}

function hashScenario(scenario: ClientScenario): number {
  const input = JSON.stringify({
    program: [
      scenario.program.horizon_days,
      scenario.program.win_rate,
      scenario.program.confidence_target,
      scenario.program.power_target,
      scenario.program.min_test_days,
      scenario.program.launches_per_30_days,
    ],
    pages: scenario.pages.map((page) => [
      page.id,
      page.daily_visitors,
      page.baseline_rate,
      page.min_detectable_lift,
    ]),
  });
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mixSeed(baseSeed: number, salt: number, trialIndex: number): number {
  let value = baseSeed ^ salt ^ Math.imul(trialIndex + 1, 0x9e3779b1);
  value ^= value >>> 16;
  value = Math.imul(value, 0x7feb352d);
  value ^= value >>> 15;
  value = Math.imul(value, 0x846ca68b);
  value ^= value >>> 16;
  return value >>> 0;
}

function mulberry32(seed: number): RandomSource {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function observedPercentile(values: number[], percentile: number): number {
  const ordered = values.slice().sort((left, right) => left - right);
  const index = Math.round((ordered.length - 1) * percentile);
  return ordered[index];
}

function summarizeRange(values: number[]): Range {
  return {
    conservative: observedPercentile(values, 0.1),
    likely: observedPercentile(values, 0.5),
    upside: observedPercentile(values, 0.9),
  };
}

function summarizeTrials(
  trials: TrialResult[],
  pages: PageInput[],
): ForecastSummary {
  const pageSummaries: PageForecast[] = pages.map((page, pageIndex) => {
    const results = trials.map((trial) => trial.pages[pageIndex]);
    return {
      page_id: page.id,
      tests: summarizeRange(results.map((result) => result.tests)),
      winners: summarizeRange(results.map((result) => result.winners)),
      relative_lift: summarizeRange(
        results.map((result) => result.relative_lift),
      ),
      incremental_conversions: summarizeRange(
        results.map((result) => result.incremental_conversions),
      ),
      incremental_value: summarizeRange(
        results.map((result) => result.incremental_value),
      ),
    };
  });

  return {
    tests: summarizeRange(trials.map((trial) => trial.tests)),
    winners: summarizeRange(trials.map((trial) => trial.winners)),
    incremental_value: summarizeRange(
      trials.map((trial) => trial.incremental_value),
    ),
    pages: pageSummaries,
  };
}

function representativeTrialIndex(
  trials: TrialResult[],
  summary: ForecastSummary,
): number {
  const testsScale = Math.max(1, summary.tests.likely);
  const winnersScale = Math.max(1, summary.winners.likely);
  const valueScale = Math.max(1, summary.incremental_value.likely);
  let selectedIndex = 0;
  let selectedDistance = Number.POSITIVE_INFINITY;

  trials.forEach((trial, index) => {
    const distance =
      Math.abs(trial.tests - summary.tests.likely) / testsScale +
      Math.abs(trial.winners - summary.winners.likely) / winnersScale +
      Math.abs(trial.incremental_value - summary.incremental_value.likely) /
        valueScale;
    if (distance < selectedDistance) {
      selectedDistance = distance;
      selectedIndex = index;
    }
  });

  return selectedIndex;
}

function runSimulation(
  scenario: ClientScenario,
  runs: number,
  baseSeed: number,
  salt: number,
  resolveSizing: SizingResolver,
  mode: "execution" | "ceiling",
  checkpointDays: number[],
): SimulationBundle {
  const simulate =
    mode === "execution" ? simulateExecutionTrial : simulateCeilingTrial;
  const trials = Array.from({ length: runs }, (_, trialIndex) =>
    simulate(
      scenario,
      mulberry32(mixSeed(baseSeed, salt, trialIndex)),
      resolveSizing,
      false,
      checkpointDays,
    ),
  );
  const summary = summarizeTrials(trials, scenario.pages);
  const representativeIndex = representativeTrialIndex(trials, summary);
  const representative = simulate(
    scenario,
    mulberry32(mixSeed(baseSeed, salt, representativeIndex)),
    resolveSizing,
    true,
    checkpointDays,
  );

  return {
    summary,
    representative_timeline: representative.timeline,
    representative_checkpoint_values: representative.checkpoint_values,
    value_trajectory: checkpointDays.map((day, checkpointIndex) => ({
      day,
      value: summarizeRange(
        trials.map((trial) => trial.checkpoint_values[checkpointIndex]),
      ),
    })),
    value_composition: checkpointDays.map((day, checkpointIndex) => ({
      day,
      page_values: Object.fromEntries(
        scenario.pages.map((page, pageIndex) => [
          page.id,
          representative.checkpoint_page_values[checkpointIndex][pageIndex],
        ]),
      ),
    })),
  };
}

function addToRange(range: Range, value: number): Range {
  return {
    conservative: range.conservative + value,
    likely: range.likely + value,
    upside: range.upside + value,
  };
}

function readoutDays(scenario: ClientScenario): number[] {
  const horizon = scenario.program.horizon_days;
  const cadence = scenario.program.reporting_cadence_days;
  const days: number[] = [];
  for (let day = cadence; day < horizon; day += cadence) {
    days.push(day);
  }
  days.push(horizon);
  return days;
}

function baselineValueForScenario(scenario: ClientScenario): number {
  const funnelIds = funnelPageIds(scenario);
  const funnelValue = scenario.funnel?.enabled
    ? funnelValuePerDay(scenario, createPageStates(scenario.pages)) *
      scenario.program.horizon_days
    : 0;
  const independentValue = scenario.pages
    .filter((page) => !funnelIds.has(page.id))
    .reduce(
      (total, page) =>
        total +
        page.daily_visitors *
          page.baseline_rate *
          valuePerConversion(page) *
          scenario.program.horizon_days,
      0,
    );
  return funnelValue + independentValue;
}

export function buildReadoutCheckpoints(
  scenario: ClientScenario,
  timeline: TestRecord[],
  checkpointValues: number[],
): ReadoutCheckpoint[] {
  const days = readoutDays(scenario);
  if (checkpointValues.length !== days.length) {
    throw new Error("Readout value count must match reporting checkpoints.");
  }

  return days.map((day, index) => ({
    day,
    completed_tests: timeline.filter((test) => test.end_day <= day).length,
    active_tests: timeline.filter(
      (test) => test.start_day <= day && test.end_day > day,
    ).length,
    shipped_winners: timeline.filter(
      (test) => test.won && test.end_day <= day,
    ).length,
    incremental_value: checkpointValues[index],
  }));
}

export function buildForecast(
  scenario: ClientScenario,
  simulationRuns = DEFAULT_SIMULATION_RUNS,
): ForecastResult {
  if (!Number.isInteger(simulationRuns) || simulationRuns < 1) {
    throw new RangeError("Simulation runs must be a positive whole number.");
  }

  const validationIssues = validateScenario(scenario);
  if (validationIssues.length > 0) {
    return {
      execution: emptySummary(scenario.pages),
      traffic_ceiling: emptySummary(scenario.pages),
      representative_timeline: [],
      readouts: [],
      value_trajectory: [],
      value_composition: [],
      feasibility: [],
      baseline_value: 0,
      with_plan_value: emptyRange(),
      validation_issues: validationIssues,
      simulation_runs: 0,
    };
  }

  const sizingCache = new Map<string, TestSizing | null>();
  const resolveSizing: SizingResolver = (page, baselineRate) => {
    const key = `${page.id}:${baselineRate.toPrecision(14)}`;
    if (sizingCache.has(key)) {
      return sizingCache.get(key) ?? null;
    }
    if (
      baselineRate * (1 + page.min_detectable_lift) >= 1 ||
      baselineRate * (1 + page.expected_winner_lift) >= 1
    ) {
      sizingCache.set(key, null);
      return null;
    }
    const sizing = calculateTestSizing(page, scenario.program, baselineRate);
    sizingCache.set(key, sizing);
    return sizing;
  };

  const baseSeed = hashScenario(scenario);
  const trajectoryDays = [0, ...readoutDays(scenario)];
  const execution = runSimulation(
    scenario,
    simulationRuns,
    baseSeed,
    EXECUTION_SALT,
    resolveSizing,
    "execution",
    trajectoryDays,
  );
  const ceiling = runSimulation(
    scenario,
    simulationRuns,
    baseSeed,
    CEILING_SALT,
    resolveSizing,
    "ceiling",
    [],
  );
  const baselineValue = baselineValueForScenario(scenario);

  return {
    execution: execution.summary,
    traffic_ceiling: ceiling.summary,
    representative_timeline: execution.representative_timeline,
    readouts: buildReadoutCheckpoints(
      scenario,
      execution.representative_timeline,
      execution.representative_checkpoint_values.slice(1),
    ),
    value_trajectory: execution.value_trajectory,
    value_composition: execution.value_composition,
    feasibility: assessPageFeasibility(scenario.pages, scenario.program),
    baseline_value: baselineValue,
    with_plan_value: addToRange(
      execution.summary.incremental_value,
      baselineValue,
    ),
    validation_issues: [],
    simulation_runs: simulationRuns,
  };
}
