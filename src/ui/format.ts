import type { Range } from "../model/types";

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

export function formatInteger(value: number): string {
  return integerFormatter.format(Math.round(value));
}

export function formatCompactNumber(value: number): string {
  return compactNumberFormatter.format(value);
}

export function formatCurrency(value: number, compact = true): string {
  return (compact ? currencyFormatter : fullCurrencyFormatter).format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatDays(value: number): string {
  return `${formatInteger(value)} ${Math.round(value) === 1 ? "day" : "days"}`;
}

export function rangeText(
  range: Range,
  formatter: (value: number) => string,
): string {
  return `${formatter(range.conservative)}–${formatter(range.upside)}`;
}
