import type { ShareRecord } from '../store/types';

export type EqualFillResult =
  | { ok: true; shares: ShareRecord[] }
  | { ok: false; message: string };

/**
 * Pure equal-fill helper used by the expense form before save.
 * Does not mutate any stored document.
 *
 * Rules from Tech Spec:
 * - Let n be the number of selected participants and amountMinor the expense total.
 * - If n is 0 or amountMinor < n, return validation message and no amounts (zero share disallowed).
 * - Each participant gets floor(amountMinor / n).
 * - The first (amountMinor % n) participants in selected order get +1 minor unit.
 */
export function calculateEqualFill(
  amountMinor: number,
  selectedParticipantIds: number[]
): EqualFillResult {
  const n = selectedParticipantIds.length;
  if (n === 0) {
    return {
      ok: false,
      message: 'Select at least one participant before filling equally.',
    };
  }

  if (!Number.isInteger(amountMinor) || amountMinor <= 0) {
    return {
      ok: false,
      message: 'Enter a valid expense amount greater than zero first.',
    };
  }

  if (amountMinor < n) {
    return {
      ok: false,
      message: `Amount is too small to split equally among ${n} people without a zero share.`,
    };
  }

  const baseShare = Math.floor(amountMinor / n);
  const remainder = amountMinor % n;

  const shares: ShareRecord[] = selectedParticipantIds.map((participantId, idx) => ({
    participantId,
    amountMinor: baseShare + (idx < remainder ? 1 : 0),
  }));

  return { ok: true, shares };
}
