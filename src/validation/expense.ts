import type { ParticipantRecord, ShareRecord } from '../store/types';

export interface ExpenseInput {
  expenseDate: string;
  description: string;
  amountMinor: number;
  paidByParticipantId: number;
  note?: string | null;
  shares: ShareRecord[];
}

export interface ValidatedExpenseInput {
  expenseDate: string;
  description: string;
  amountMinor: number;
  paidByParticipantId: number;
  note: string | null;
  shares: ShareRecord[];
}

export type ExpenseValidationResult =
  | { ok: true; value: ValidatedExpenseInput }
  | { ok: false; message: string };

/**
 * Validates that a YYYY-MM-DD string represents an actual calendar date
 * (rejects e.g. 2026-02-30, 2026-13-01, 2025-02-29).
 */
export function isValidCalendarDate(dateStr: string): boolean {
  if (typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Pure validation for creating or updating an expense and its shares.
 * Enforces every rule from the Trip Split PRD & Tech Spec:
 * - trimmed description 1-120 chars
 * - real calendar date (YYYY-MM-DD)
 * - positive integer amountMinor
 * - optional note trimmed 1-200 chars, otherwise null
 * - payer belongs to the same trip (payer does not need to be in shares)
 * - at least one share, unique participantIds belonging to same trip
 * - each share is a positive integer
 * - sum of shares equals amountMinor exactly
 */
export function validateExpenseInput(
  input: ExpenseInput,
  tripParticipants: ParticipantRecord[]
): ExpenseValidationResult {
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length === 0) {
    return { ok: false, message: 'Description is required.' };
  }
  if (description.length > 120) {
    return { ok: false, message: 'Description must be 120 characters or fewer.' };
  }

  const expenseDate = typeof input.expenseDate === 'string' ? input.expenseDate.trim() : '';
  if (!isValidCalendarDate(expenseDate)) {
    return { ok: false, message: 'Enter a valid calendar date (YYYY-MM-DD).' };
  }

  if (
    typeof input.amountMinor !== 'number' ||
    !Number.isInteger(input.amountMinor) ||
    input.amountMinor <= 0
  ) {
    return { ok: false, message: 'Expense amount must be greater than zero.' };
  }

  let normalizedNote: string | null = null;
  if (input.note !== undefined && input.note !== null) {
    if (typeof input.note !== 'string') {
      return { ok: false, message: 'Note must be text.' };
    }
    const trimmedNote = input.note.trim();
    if (trimmedNote.length > 200) {
      return { ok: false, message: 'Note must be 200 characters or fewer.' };
    }
    normalizedNote = trimmedNote.length > 0 ? trimmedNote : null;
  }

  const participantIds = new Set(tripParticipants.map((p) => p.id));

  if (
    typeof input.paidByParticipantId !== 'number' ||
    !Number.isInteger(input.paidByParticipantId) ||
    !participantIds.has(input.paidByParticipantId)
  ) {
    return { ok: false, message: 'Payer must be a participant on this trip.' };
  }

  if (!Array.isArray(input.shares) || input.shares.length === 0) {
    return { ok: false, message: 'Select at least one participant to share this expense.' };
  }

  const seenSharers = new Set<number>();
  const normalizedShares: ShareRecord[] = [];
  let sumMinor = 0;

  for (const share of input.shares) {
    if (
      !share ||
      typeof share.participantId !== 'number' ||
      !Number.isInteger(share.participantId)
    ) {
      return { ok: false, message: 'Each share must specify a valid participant.' };
    }
    if (!participantIds.has(share.participantId)) {
      return { ok: false, message: 'Every sharer must belong to this trip.' };
    }
    if (seenSharers.has(share.participantId)) {
      return { ok: false, message: 'A participant cannot appear more than once in shares.' };
    }
    if (
      typeof share.amountMinor !== 'number' ||
      !Number.isInteger(share.amountMinor) ||
      share.amountMinor <= 0
    ) {
      return { ok: false, message: 'Every share amount must be greater than zero.' };
    }
    seenSharers.add(share.participantId);
    normalizedShares.push({
      participantId: share.participantId,
      amountMinor: share.amountMinor,
    });
    sumMinor += share.amountMinor;
  }

  if (sumMinor !== input.amountMinor) {
    return { ok: false, message: 'Shares must add up to the expense amount.' };
  }

  return {
    ok: true,
    value: {
      expenseDate,
      description,
      amountMinor: input.amountMinor,
      paidByParticipantId: input.paidByParticipantId,
      note: normalizedNote,
      shares: normalizedShares,
    },
  };
}
