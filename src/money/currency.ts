import type { CurrencyCode } from '../store/types';

export const SUPPORTED_CURRENCIES: readonly CurrencyCode[] = [
  'INR',
  'USD',
  'EUR',
  'GBP',
] as const;

export interface CurrencyMeta {
  code: CurrencyCode;
  symbol: string;
  name: string;
  minorDecimals: 2;
}

export const CURRENCY_META: Record<CurrencyCode, CurrencyMeta> = {
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', minorDecimals: 2 },
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', minorDecimals: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', minorDecimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', minorDecimals: 2 },
};

export function isValidCurrency(code: string): code is CurrencyCode {
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(code);
}

export type ParseAmountResult =
  | { ok: true; amountMinor: number }
  | { ok: false; message: string };

/**
 * Parses a major-unit string (e.g. "10.50", "1800", "0.25") into integer minor units.
 * Rejects empty strings, non-numeric inputs, negatives, zero, or > 2 decimal places.
 */
export function parseMajorToMinor(
  input: string,
  options?: { allowZero?: boolean }
): ParseAmountResult {
  const trimmed = input.trim();
  if (!trimmed) {
    return { ok: false, message: 'Amount is required.' };
  }

  // Strip optional leading currency symbols or commas only if user typed them neatly,
  // while rejecting signs, letters, or malformed decimals.
  const cleaned = trimmed.replace(/,/g, '');

  if (cleaned.startsWith('-')) {
    return { ok: false, message: 'Amount must be greater than zero.' };
  }

  if (!/^\d+(\.\d+)?$/.test(cleaned)) {
    return {
      ok: false,
      message: 'Enter a valid amount with up to two decimal places.',
    };
  }

  const [wholePart, fracPart = ''] = cleaned.split('.');
  if (fracPart.length > 2) {
    return {
      ok: false,
      message: 'Amount can have at most two decimal places.',
    };
  }

  const paddedFrac = fracPart.padEnd(2, '0');
  const whole = Number(wholePart);
  const frac = Number(paddedFrac);

  if (!Number.isSafeInteger(whole) || !Number.isSafeInteger(frac)) {
    return { ok: false, message: 'Amount is too large.' };
  }

  const amountMinor = whole * 100 + frac;
  if (!Number.isSafeInteger(amountMinor)) {
    return { ok: false, message: 'Amount is too large.' };
  }

  if (!options?.allowZero && amountMinor <= 0) {
    return { ok: false, message: 'Amount must be greater than zero.' };
  }

  return { ok: true, amountMinor };
}

/**
 * Formats integer minor units as a plain 2-decimal string (e.g. 1050 -> "10.50").
 * Uses integer division to avoid floating-point rounding drift.
 */
export function formatMinorToMajor(amountMinor: number): string {
  const negative = amountMinor < 0;
  const abs = Math.abs(Math.trunc(amountMinor));
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const formatted = `${whole}.${String(frac).padStart(2, '0')}`;
  return negative ? `-${formatted}` : formatted;
}

/**
 * Formats integer minor units with the trip currency symbol (e.g. ₹1,800.00 or $42.50).
 */
export function formatCurrencyAmount(
  amountMinor: number,
  currency: CurrencyCode,
  options?: { showSign?: boolean; plain?: boolean }
): string {
  const negative = amountMinor < 0;
  const abs = Math.abs(Math.trunc(amountMinor));
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  const symbol = CURRENCY_META[currency].symbol;

  const formattedWhole = options?.plain
    ? String(whole)
    : currency === 'INR'
      ? whole.toLocaleString('en-IN')
      : whole.toLocaleString('en-US');

  const sign = negative ? '-' : options?.showSign && amountMinor > 0 ? '+' : '';
  return `${sign}${symbol}${formattedWhole}.${frac}`;
}
