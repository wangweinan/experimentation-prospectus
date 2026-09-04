import { useState } from "react";

import { InfoTip } from "./InfoTip";
import { CLIENT_SCENARIOS } from "../data/clients";
import type {
  ClientScenario,
  PageFeasibility,
  PageInput,
  PageValueModel,
  ProgramInputs,
  ValidationIssue,
} from "../model/types";
import { assessPageFeasibility } from "../model/statistics";
import {
  describeValueModel,
  resolveValueModel,
  valuePerConversion,
} from "../model/value";
import {
  formatCompactNumber,
  formatCurrency,
  formatDays,
  formatInteger,
  formatPercent,
} from "../ui/format";

interface PlannerInputsProps {
  scenario: ClientScenario;
  selectedPresetId: string;
  dirty: boolean;
  issues: ValidationIssue[];
  onSelectPreset: (id: string) => void;
  onReset: () => void;
  onCompanyChange: (company: string) => void;
  onProgramChange: <K extends keyof ProgramInputs>(
    field: K,
    value: ProgramInputs[K],
  ) => void;
  onPageChange: <K extends keyof PageInput>(
    pageId: string,
    field: K,
    value: PageInput[K],
  ) => void;
  onAddPage: () => void;
  onRemovePage: (pageId: string) => void;
}

interface NumberFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  help?: string;
  tooltip: string;
  error?: string;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}

function NumberField({
  id,
  label,
  value,
  onChange,
  help,
  tooltip,
  error,
  min,
  max,
  step,
  prefix,
  suffix,
}: NumberFieldProps) {
  const descriptionId = `${id}-description`;
  return (
    <label className={`field ${error ? "field--error" : ""}`} htmlFor={id}>
      <span className="field__label">
        {label}
        <InfoTip text={tooltip} />
      </span>
      <span className="field__control">
        {prefix ? <span aria-hidden="true">{prefix}</span> : null}
        <input
          id={id}
          type="number"
          value={Number.isFinite(value) ? value : ""}
          min={min}
          max={max}
          step={step}
          aria-invalid={Boolean(error)}
          aria-describedby={help || error ? descriptionId : undefined}
          onChange={(event) => onChange(event.currentTarget.valueAsNumber)}
        />
        {suffix ? <span aria-hidden="true">{suffix}</span> : null}
      </span>
      {error ? (
        <span className="field__message" id={descriptionId}>
          {error}
        </span>
      ) : help ? (
        <span className="field__help" id={descriptionId}>
          {help}
        </span>
      ) : null}
    </label>
  );
}

function TextField({
  id,
  label,
  value,
  onChange,
  help,
  tooltip,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  help?: string;
  tooltip: string;
  error?: string;
}) {
  const descriptionId = `${id}-description`;
  return (
    <label className={`field ${error ? "field--error" : ""}`} htmlFor={id}>
      <span className="field__label">
        {label}
        <InfoTip text={tooltip} />
      </span>
      <input
        id={id}
        type="text"
        value={value}
        aria-invalid={Boolean(error)}
        aria-describedby={help || error ? descriptionId : undefined}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {error ? (
        <span className="field__message" id={descriptionId}>
          {error}
        </span>
      ) : help ? (
        <span className="field__help" id={descriptionId}>
          {help}
        </span>
      ) : null}
    </label>
  );
}

function SelectField({
  id,
  label,
  value,
  tooltip,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  tooltip: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">
        {label}
        <InfoTip text={tooltip} />
      </span>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function isValueModelKind(value: string): value is PageValueModel["kind"] {
  return ["none", "one_time", "subscription", "lead", "expected"].includes(
    value,
  );
}

function ValueModelEditor({
  page,
  path,
  issues,
  onChange,
}: {
  page: PageInput;
  path: string;
  issues: ValidationIssue[];
  onChange: PlannerInputsProps["onPageChange"];
}) {
  const model = resolveValueModel(page);
  const setModel = (valueModel: PageValueModel): void =>
    onChange(page.id, "value_model", valueModel);
  const changeKind = (kind: PageValueModel["kind"]): void => {
    const currentValue =
      valuePerConversion(page) || page.revenue_per_conversion;
    switch (kind) {
      case "none":
        setModel({ kind: "none" });
        break;
      case "one_time":
        setModel({ kind: "one_time", amount: currentValue });
        break;
      case "subscription":
        setModel({
          kind: "subscription",
          monthly_amount: currentValue,
          months_counted: 1,
        });
        break;
      case "lead":
        setModel({
          kind: "lead",
          contract_value: currentValue > 0 ? currentValue * 10 : 1000,
          close_rate: 0.1,
          sales_cycle_days: 30,
        });
        break;
      case "expected":
        setModel({
          kind: "expected",
          expected_value: currentValue,
          timing_note: "",
        });
    }
  };

  return (
    <div className="value-model-editor">
      <SelectField
        id={`${page.id}-value-kind`}
        label="How does this conversion create value?"
        value={model.kind}
        tooltip="Choose the business model and we will show the exact arithmetic used for each conversion."
        options={[
          { value: "none", label: "No direct dollar value" },
          { value: "one_time", label: "One-time purchase" },
          { value: "subscription", label: "Subscription sign-up" },
          { value: "lead", label: "Sales lead or demo" },
          { value: "expected", label: "Pre-calculated expected value" },
        ]}
        onChange={(value) => {
          if (!isValueModelKind(value)) {
            throw new Error(`Unknown value model "${value}".`);
          }
          changeKind(value);
        }}
      />

      {model.kind === "none" ? (
        <p className="value-model-editor__empty">
          We’ll still project testing capacity and conversion lift, but we won’t
          invent a dollar value for this page.
        </p>
      ) : null}

      {model.kind === "one_time" ? (
        <NumberField
          id={`${page.id}-purchase-value`}
          label="Revenue per purchase"
          value={model.amount}
          tooltip="This amount is used once for every extra purchase created after a winning change launches."
          min={0}
          step={0.01}
          prefix="$"
          error={issueFor(issues, `${path}.value_model.amount`)}
          onChange={(amount) => setModel({ ...model, amount })}
        />
      ) : null}

      {model.kind === "subscription" ? (
        <div className="field-pair">
          <NumberField
            id={`${page.id}-monthly-value`}
            label="Monthly revenue per sign-up"
            value={model.monthly_amount}
            tooltip="The subscription price or average monthly revenue from one new customer."
            min={0}
            step={0.01}
            prefix="$"
            error={issueFor(issues, `${path}.value_model.monthly_amount`)}
            onChange={(monthly_amount) =>
              setModel({ ...model, monthly_amount })
            }
          />
          <NumberField
            id={`${page.id}-months-counted`}
            label="Months of value to count"
            value={model.months_counted}
            tooltip="How many paid months to count for each new subscriber. Use 1 when retention is unknown; use a longer period only with a defensible retention assumption."
            min={0.1}
            max={120}
            step={0.1}
            suffix="months"
            error={issueFor(issues, `${path}.value_model.months_counted`)}
            onChange={(months_counted) =>
              setModel({ ...model, months_counted })
            }
          />
        </div>
      ) : null}

      {model.kind === "lead" ? (
        <>
          <div className="field-pair">
            <NumberField
              id={`${page.id}-contract-value`}
              label="Average contract value"
              value={model.contract_value}
              tooltip="The average booked revenue when one sales lead becomes a customer."
              min={0}
              step={1}
              prefix="$"
              error={issueFor(issues, `${path}.value_model.contract_value`)}
              onChange={(contract_value) =>
                setModel({ ...model, contract_value })
              }
            />
            <NumberField
              id={`${page.id}-close-rate`}
              label="Lead-to-customer rate"
              value={model.close_rate * 100}
              tooltip="The share of leads that become paying customers. Contract value × this rate gives expected value per lead."
              min={0}
              max={100}
              step={1}
              suffix="%"
              error={issueFor(issues, `${path}.value_model.close_rate`)}
              onChange={(closeRate) =>
                setModel({ ...model, close_rate: closeRate / 100 })
              }
            />
          </div>
          <NumberField
            id={`${page.id}-sales-cycle`}
            label="Typical sales cycle"
            value={model.sales_cycle_days}
            tooltip="How long revenue usually takes to arrive after a lead converts. We show this timing clearly, but do not pretend it changes the lead's expected value."
            min={0}
            max={730}
            step={1}
            suffix="days"
            error={issueFor(issues, `${path}.value_model.sales_cycle_days`)}
            onChange={(sales_cycle_days) =>
              setModel({ ...model, sales_cycle_days })
            }
          />
        </>
      ) : null}

      {model.kind === "expected" ? (
        <>
          <NumberField
            id={`${page.id}-expected-value`}
            label="Expected value per conversion"
            value={model.expected_value}
            tooltip="Use this only when the business has already blended downstream conversion odds into one defensible value."
            min={0}
            step={0.01}
            prefix="$"
            error={issueFor(issues, `${path}.value_model.expected_value`)}
            onChange={(expected_value) =>
              setModel({ ...model, expected_value })
            }
          />
          <TextField
            id={`${page.id}-timing-note`}
            label="What should the client know?"
            value={model.timing_note}
            tooltip="A short note about timing or attribution, such as 'paid conversion happens later inside the product.'"
            onChange={(timing_note) => setModel({ ...model, timing_note })}
          />
        </>
      ) : null}

      <div className="value-formula">
        <span>Value used in the forecast</span>
        <strong>{formatCurrency(valuePerConversion(page), false)}</strong>
        <p>{describeValueModel(page)}</p>
      </div>
    </div>
  );
}

function issueFor(issues: ValidationIssue[], path: string): string | undefined {
  return issues.find((issue) => issue.path === path)?.message;
}

function PageEditor({
  page,
  index,
  initiallyOpen,
  feasibility,
  canRemove,
  issues,
  onChange,
  onRemove,
}: {
  page: PageInput;
  index: number;
  initiallyOpen: boolean;
  feasibility?: PageFeasibility;
  canRemove: boolean;
  issues: ValidationIssue[];
  onChange: PlannerInputsProps["onPageChange"];
  onRemove: (pageId: string) => void;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const path = `pages.${index}`;

  return (
    <details
      className="page-editor"
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>
        <span>
          <strong>{page.name || "Untitled page"}</strong>
          <small>
            {formatInteger(page.daily_visitors || 0)} daily visitors ·{" "}
            {formatPercent(page.baseline_rate || 0)}{" "}
            {page.conversion_name || "conversion"}
          </small>
        </span>
        <span className="page-editor__lift">
          Detect {formatPercent(page.min_detectable_lift || 0)} · Ship +
          {formatPercent(page.expected_winner_lift || 0)}
        </span>
      </summary>

      <div className="page-editor__body">
        <TextField
          id={`${page.id}-name`}
          label="Page name"
          value={page.name}
          tooltip="This is the name shown in the roadmap. It does not change the calculation."
          error={issueFor(issues, `${path}.name`)}
          onChange={(value) => onChange(page.id, "name", value)}
        />
        <TextField
          id={`${page.id}-conversion-name`}
          label="What counts as a conversion?"
          value={page.conversion_name}
          tooltip="Name the action behind the conversion rate, such as 'completed order,' 'subscription sign-up,' or 'demo request.'"
          error={issueFor(issues, `${path}.conversion_name`)}
          onChange={(value) => onChange(page.id, "conversion_name", value)}
        />
        <div className="field-pair">
          <NumberField
            id={`${page.id}-visitors`}
            label="Visitors per day"
            value={page.daily_visitors}
            tooltip="We divide the visitors needed for a reliable answer by this number. More visitors usually means a faster test."
            min={1}
            step={1}
            error={issueFor(issues, `${path}.daily_visitors`)}
            onChange={(value) => onChange(page.id, "daily_visitors", value)}
          />
          <NumberField
            id={`${page.id}-baseline`}
            label="Current conversion rate"
            value={page.baseline_rate * 100}
            tooltip="This is how often the page converts today. We use it as the starting point for test sizing and future wins."
            min={0.01}
            max={99.99}
            step={0.1}
            suffix="%"
            error={issueFor(issues, `${path}.baseline_rate`)}
            onChange={(value) => onChange(page.id, "baseline_rate", value / 100)}
          />
        </div>
        <NumberField
          id={`${page.id}-mde`}
          label="Smallest lift the test should detect"
          value={page.min_detectable_lift * 100}
          tooltip="We calculate visitors needed from this lift, today's rate, and the current confidence and power settings (95% / 80% by default). Then real daily traffic turns that sample into test days."
          min={0.1}
          step={0.1}
          suffix="%"
          help="Smaller lifts need more traffic and take longer."
          error={issueFor(issues, `${path}.min_detectable_lift`)}
          onChange={(value) =>
            onChange(page.id, "min_detectable_lift", value / 100)
          }
        />
        <NumberField
          id={`${page.id}-winner-lift`}
          label="Assumed lift when a test wins"
          value={page.expected_winner_lift * 100}
          tooltip="MDE controls how many visitors the test needs. This separate value controls the impact after a winner ships. It replaces the MDE as the winner effect—it is not added to it—and each win compounds on the improved page."
          min={0.1}
          step={0.1}
          suffix="%"
          help="Defaults to MDE, but may be higher or lower. It is not added to MDE."
          error={issueFor(issues, `${path}.expected_winner_lift`)}
          onChange={(value) =>
            onChange(page.id, "expected_winner_lift", value / 100)
          }
        />
        {Math.abs(page.expected_winner_lift - page.min_detectable_lift) >
        1e-12 ? (
          <button
            className="text-button winner-lift-reset"
            type="button"
            onClick={() =>
              onChange(
                page.id,
                "expected_winner_lift",
                page.min_detectable_lift,
              )
            }
          >
            Reset winner lift to MDE
          </button>
        ) : null}
        {feasibility?.sizing ? (
          <div className="traffic-check">
            <span>Traffic check</span>
            <strong>
              {formatCompactNumber(feasibility.sizing.total_sample)} visitors ·{" "}
              {formatDays(feasibility.sizing.duration_days)}
            </strong>
            <p>
              {feasibility.testable_in_horizon
                ? feasibility.sizing.sample_days <
                  feasibility.sizing.duration_days
                  ? `Traffic arrives in ${formatDays(
                      feasibility.sizing.sample_days,
                    )}; the shortest-test rule keeps the result trustworthy.`
                  : "This uses the page’s real daily traffic, current conversion rate, confidence, and power settings."
                : feasibility.attainable_lift
                  ? `The current target needs ${formatDays(
                      feasibility.sizing.duration_days,
                    )}. About ${formatPercent(
                      feasibility.attainable_lift,
                    )} is the smallest lift this traffic can reliably measure inside the plan.`
                  : "This traffic cannot complete a reliable test inside the current plan."}
            </p>
          </div>
        ) : null}
        <ValueModelEditor
          page={page}
          path={path}
          issues={issues}
          onChange={onChange}
        />
        {canRemove ? (
          <button
            className="text-button text-button--danger"
            type="button"
            onClick={() => onRemove(page.id)}
          >
            Remove page
          </button>
        ) : null}
      </div>
    </details>
  );
}

export function PlannerInputs({
  scenario,
  selectedPresetId,
  dirty,
  issues,
  onSelectPreset,
  onReset,
  onCompanyChange,
  onProgramChange,
  onPageChange,
  onAddPage,
  onRemovePage,
}: PlannerInputsProps) {
  const firstValuedPage = scenario.pages.findIndex(
    (page) => valuePerConversion(page) > 0,
  );
  const initiallyOpenPage = firstValuedPage >= 0 ? firstValuedPage : 0;
  const feasibilityByPage = new Map(
    issues.length === 0
      ? assessPageFeasibility(scenario.pages, scenario.program).map((item) => [
          item.page_id,
          item,
        ])
      : [],
  );

  return (
    <aside className="planner-rail" id="planning-inputs" aria-label="Planning inputs">
      <div className="planner-rail__sticky">
        <div className="rail-heading">
          <p className="eyebrow">Build the outlook</p>
          <span>
            {dirty ? <span className="edited-mark">Customized</span> : null}
            <a className="jump-link" href="#outlook">
              View outlook ↓
            </a>
          </span>
        </div>

        <label className="field" htmlFor="sample-account">
          <span className="field__label">
            Start with a sample client
            <InfoTip text="Choose any supplied client to load its real traffic and conversion assumptions. You can edit every field." />
          </span>
          <select
            id="sample-account"
            value={selectedPresetId}
            onChange={(event) => onSelectPreset(event.currentTarget.value)}
          >
            {CLIENT_SCENARIOS.map((client) => (
              <option key={client.id} value={client.id}>
                {client.company}
              </option>
            ))}
          </select>
        </label>

        <TextField
          id="company-name"
          label="Company"
          value={scenario.company}
          tooltip="This name appears throughout the shareable outlook. It does not change the forecast."
          error={issueFor(issues, "company")}
          onChange={onCompanyChange}
        />

        <div className="input-section">
          <div className="input-section__heading">
            <h2>Program assumptions</h2>
            {dirty ? (
              <button className="text-button" type="button" onClick={onReset}>
                Reset sample
              </button>
            ) : null}
          </div>
          <div className="field-pair">
            <NumberField
              id="horizon"
              label="How far ahead?"
              value={scenario.program.horizon_days}
              tooltip="The number of days in the plan. More time creates room to finish more tests and benefit from winners for longer."
              min={1}
              max={730}
              step={1}
              suffix="days"
              error={issueFor(issues, "program.horizon_days")}
              onChange={(value) => onProgramChange("horizon_days", value)}
            />
            <NumberField
              id="cadence"
              label="How often will you report?"
              value={scenario.program.reporting_cadence_days}
              tooltip="This controls how often the output shows completed tests, shipped wins, live tests, and value to date. It does not pause or restart a test."
              min={1}
              max={scenario.program.horizon_days}
              step={1}
              suffix="days"
              error={issueFor(issues, "program.reporting_cadence_days")}
              onChange={(value) =>
                onProgramChange("reporting_cadence_days", value)
              }
            />
          </div>
          <div className="field-pair">
            <NumberField
              id="win-rate"
              label="How often do tests win?"
              value={scenario.program.win_rate * 100}
              tooltip="If this is 25%, the model gives each completed test a 1-in-4 chance of producing a change worth shipping."
              min={0}
              max={100}
              step={1}
              suffix="%"
              help="Share of completed tests expected to ship a winner."
              error={issueFor(issues, "program.win_rate")}
              onChange={(value) => onProgramChange("win_rate", value / 100)}
            />
            <NumberField
              id="confidence"
              label="How sure before shipping?"
              value={scenario.program.confidence_target * 100}
              tooltip="This is how strong the evidence must be before calling a winner. The 95% default means a 5% significance level. Asking for more certainty needs more visitors."
              min={50.01}
              max={99.99}
              step={1}
              suffix="%"
              error={issueFor(issues, "program.confidence_target")}
              onChange={(value) =>
                onProgramChange("confidence_target", value / 100)
              }
            />
          </div>

          <details className="advanced-inputs">
            <summary>Fine-tune the model</summary>
            <div className="advanced-inputs__body">
              <NumberField
                id="power"
                label="Chance to spot a real lift"
                value={scenario.program.power_target * 100}
                tooltip="When the target improvement is truly there, this is the chance the test detects it. A higher chance needs more visitors."
                min={50.01}
                max={99.99}
                step={1}
                suffix="%"
                help="Chance of detecting the target lift when it is real."
                error={issueFor(issues, "program.power_target")}
                onChange={(value) =>
                  onProgramChange("power_target", value / 100)
                }
              />
              <NumberField
                id="minimum-runtime"
                label="Shortest test"
                value={scenario.program.min_test_days}
                tooltip="Even when traffic arrives quickly, a test runs at least this long so weekday patterns do not fool the result."
                min={1}
                max={scenario.program.horizon_days}
                step={1}
                suffix="days"
                help="Prevents high traffic from shortening tests below a full behavior cycle."
                error={issueFor(issues, "program.min_test_days")}
                onChange={(value) => onProgramChange("min_test_days", value)}
              />
              <NumberField
                id="launch-capacity"
                label="Tests your team can start"
                value={scenario.program.launches_per_30_days}
                tooltip="This is the practical delivery pace. We spread these starts across 30 days and compare them with what traffic could support."
                min={1}
                max={30}
                step={1}
                suffix="/ 30 days"
                help="New tests are spaced evenly across the month."
                error={issueFor(issues, "program.launches_per_30_days")}
                onChange={(value) =>
                  onProgramChange("launches_per_30_days", value)
                }
              />
            </div>
          </details>
        </div>

        <div className="input-section input-section--pages">
          <div className="input-section__heading">
            <div>
              <h2>Pages to optimize</h2>
              <p>{scenario.pages.length} modeled</p>
            </div>
            <button className="text-button" type="button" onClick={onAddPage}>
              + Add another page
            </button>
          </div>
          {issueFor(issues, "pages") ? (
            <p className="section-error">{issueFor(issues, "pages")}</p>
          ) : null}
          <div className="page-editor-list">
            {scenario.pages.map((page, index) => (
              <PageEditor
                key={`${scenario.id}-${page.id}`}
                page={page}
                index={index}
                initiallyOpen={index === initiallyOpenPage}
                feasibility={feasibilityByPage.get(page.id)}
                canRemove={scenario.pages.length > 1}
                issues={issues}
                onChange={onPageChange}
                onRemove={onRemovePage}
              />
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}
