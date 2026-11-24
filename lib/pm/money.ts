// Money helpers. Amounts are whole US dollars held as plain numbers, which is
// exact up to about $9 quadrillion.

const UNITS: [number, string][] = [
  [1e9, "B"],
  [1e6, "M"],
  [1e3, "K"],
];

/** Short form for tables and tiles: $1.25B, $350M, $12.5K, $950. */
export function formatMoney(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  const abs = Math.abs(amount);
  for (const [size, suffix] of UNITS) {
    if (abs >= size) {
      const scaled = abs / size;
      const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
      return `${sign}$${Number(scaled.toFixed(digits))}${suffix}`;
    }
  }
  return `${sign}$${Math.round(abs)}`;
}

/** Exact form: $1,250,000,000. */
export function formatMoneyFull(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${Math.round(Math.abs(amount)).toLocaleString("en-US")}`;
}

/**
 * Parses what a person types into an amount field: "1.2B", "350m", "12k",
 * "$1,250,000", "7 billion". Returns null when it isn't a non-negative amount.
 */
export function parseMoney(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/[$,\s]/g, "");
  if (!text) return null;
  const match = /^(\d+(?:\.\d+)?|\.\d+)(k|m|mm|b|bn|thousand|million|billion)?$/.exec(text);
  if (!match) return null;
  const scale: Record<string, number> = {
    k: 1e3,
    thousand: 1e3,
    m: 1e6,
    mm: 1e6,
    million: 1e6,
    b: 1e9,
    bn: 1e9,
    billion: 1e9,
  };
  const value = Math.round(Number(match[1]) * (match[2] ? scale[match[2]] : 1));
  return Number.isSafeInteger(value) ? value : null;
}
