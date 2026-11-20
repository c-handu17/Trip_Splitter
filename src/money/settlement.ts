import type { CurrencyCode, TripRecord } from '../store/types';
import { formatCurrencyAmount } from './currency';

export interface ParticipantBalance {
  participantId: number;
  name: string;
  totalPaidMinor: number;
  totalAssignedMinor: number;
  netMinor: number;
}

export interface SettlementPayment {
  fromParticipantId: number;
  fromName: string;
  toParticipantId: number;
  toName: string;
  amountMinor: number;
}

export interface SettlementResult {
  currency: CurrencyCode;
  balances: ParticipantBalance[];
  payments: SettlementPayment[];
}

/**
 * Pure balance & greedy minimal-payment settlement calculator.
 * Never mutates the trip or writes to storage.
 *
 * Tech Spec steps:
 * 1. Net for each participant is totalPaidMinor - totalAssignedMinor on this trip.
 * 2. Drop nets of zero from payment matching (kept in balances).
 * 3. Creditors (net > 0): sorted by net descending, then participantId ascending.
 * 4. Debtors (net < 0): sorted by abs(net) descending, then participantId ascending.
 * 5. While both lists have entries, transfer min(creditorRemaining, debtorRemaining),
 *    record payment, reduce both, remove anyone reaching zero.
 */
export function calculateTripSettlement(trip: TripRecord): SettlementResult {
  const paidByMap = new Map<number, number>();
  const assignedMap = new Map<number, number>();

  for (const p of trip.participants) {
    paidByMap.set(p.id, 0);
    assignedMap.set(p.id, 0);
  }

  for (const expense of trip.expenses) {
    paidByMap.set(
      expense.paidByParticipantId,
      (paidByMap.get(expense.paidByParticipantId) ?? 0) + expense.amountMinor
    );
    for (const share of expense.shares) {
      assignedMap.set(
        share.participantId,
        (assignedMap.get(share.participantId) ?? 0) + share.amountMinor
      );
    }
  }

  const balances: ParticipantBalance[] = trip.participants.map((p) => {
    const totalPaidMinor = paidByMap.get(p.id) ?? 0;
    const totalAssignedMinor = assignedMap.get(p.id) ?? 0;
    return {
      participantId: p.id,
      name: p.name,
      totalPaidMinor,
      totalAssignedMinor,
      netMinor: totalPaidMinor - totalAssignedMinor,
    };
  });

  const creditors = balances
    .filter((b) => b.netMinor > 0)
    .map((b) => ({
      participantId: b.participantId,
      name: b.name,
      remaining: b.netMinor,
    }))
    .sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      return a.participantId - b.participantId;
    });

  const debtors = balances
    .filter((b) => b.netMinor < 0)
    .map((b) => ({
      participantId: b.participantId,
      name: b.name,
      remaining: Math.abs(b.netMinor),
    }))
    .sort((a, b) => {
      if (b.remaining !== a.remaining) return b.remaining - a.remaining;
      return a.participantId - b.participantId;
    });

  const payments: SettlementPayment[] = [];
  let cIdx = 0;
  let dIdx = 0;

  while (cIdx < creditors.length && dIdx < debtors.length) {
    const creditor = creditors[cIdx];
    const debtor = debtors[dIdx];
    const transfer = Math.min(creditor.remaining, debtor.remaining);

    if (transfer > 0) {
      payments.push({
        fromParticipantId: debtor.participantId,
        fromName: debtor.name,
        toParticipantId: creditor.participantId,
        toName: creditor.name,
        amountMinor: transfer,
      });
      creditor.remaining -= transfer;
      debtor.remaining -= transfer;
    }

    if (creditor.remaining === 0) cIdx += 1;
    if (debtor.remaining === 0) dIdx += 1;
  }

  return {
    currency: trip.currency,
    balances,
    payments,
  };
}

/**
 * Formats the settlement payment list as crisp plain text suitable for copying
 * and pasting into a group chat or reading aloud.
 */
export function formatSettlementPlainText(
  tripName: string,
  settlement: SettlementResult
): string {
  const header = `${tripName} — Settlement (${settlement.currency})`;
  if (settlement.payments.length === 0) {
    return `${header}\nEveryone is settled up. No payments needed.`;
  }

  const lines = settlement.payments.map(
    (p, idx) =>
      `${idx + 1}. ${p.fromName} pays ${p.toName}: ${formatCurrencyAmount(
        p.amountMinor,
        settlement.currency
      )}`
  );

  return [header, ...lines].join('\n');
}
