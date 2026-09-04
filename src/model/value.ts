import type { PageInput, PageValueModel } from "./types";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const percent = new Intl.NumberFormat("en-US", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function resolveValueModel(page: PageInput): PageValueModel {
  if (page.value_model) {
    return page.value_model;
  }
  return page.revenue_per_conversion > 0
    ? {
        kind: "expected",
        expected_value: page.revenue_per_conversion,
        timing_note: "Supplied expected value per conversion",
      }
    : { kind: "none" };
}

export function valuePerConversion(page: PageInput): number {
  const model = resolveValueModel(page);
  switch (model.kind) {
    case "none":
      return 0;
    case "one_time":
      return model.amount;
    case "subscription":
      return model.monthly_amount * model.months_counted;
    case "lead":
      return model.contract_value * model.close_rate;
    case "expected":
      return model.expected_value;
  }
}

export function describeValueModel(page: PageInput): string {
  const model = resolveValueModel(page);
  const outcome = page.conversion_name || "conversion";
  switch (model.kind) {
    case "none":
      return `No direct dollar value assigned to each ${outcome}.`;
    case "one_time":
      return `${currency.format(model.amount)} per ${outcome}.`;
    case "subscription": {
      const months = `${model.months_counted} ${
        model.months_counted === 1 ? "month" : "months"
      }`;
      return `${currency.format(model.monthly_amount)}/month × ${months} = ${currency.format(
        valuePerConversion(page),
      )} per ${outcome}.`;
    }
    case "lead":
      return `${currency.format(model.contract_value)} contract × ${percent.format(
        model.close_rate,
      )} close rate = ${currency.format(valuePerConversion(page))} per ${outcome}; typically realized after about ${
        model.sales_cycle_days
      } days.`;
    case "expected":
      return `${currency.format(model.expected_value)} expected value per ${outcome}${
        model.timing_note ? `; ${model.timing_note}` : ""
      }.`;
  }
}
