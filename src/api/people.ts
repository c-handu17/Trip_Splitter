import type { CurrencyCode, DocumentStore } from '../store/types';
import { sortExpensesNewestFirst } from './expenses';
import { notFound, ok, type ApiResult } from '../validation/errors';

export interface PaidExpenseRow {
  expenseId: number;
  expenseDate: string;
  description: string;
  amountMinor: number;
}

export interface AssignedShareRow {
  expenseId: number;
  expenseDate: string;
  description: string;
  shareMinor: number;
  expenseAmountMinor: number;
  paidBy: {
    id: number;
    name: string;
  };
}

export interface ParticipantSummaryDto {
  participant: {
    id: number;
    name: string;
    isOrganizer: boolean;
  };
  currency: CurrencyCode;
  totalPaidMinor: number;
  totalAssignedMinor: number;
  netMinor: number;
  paid: PaidExpenseRow[];
  assigned: AssignedShareRow[];
}

export function getParticipantSummary(
  store: DocumentStore,
  tripId: number,
  participantId: number
): ApiResult<ParticipantSummaryDto> {
  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }

  const participant = trip.participants.find((p) => p.id === participantId);
  if (!participant) {
    return notFound('Participant not found on this trip.');
  }

  const nameById = new Map(trip.participants.map((p) => [p.id, p.name]));
  const sortedExpenses = sortExpensesNewestFirst(trip.expenses);

  const paid: PaidExpenseRow[] = [];
  const assigned: AssignedShareRow[] = [];
  let totalPaidMinor = 0;
  let totalAssignedMinor = 0;

  for (const expense of sortedExpenses) {
    if (expense.paidByParticipantId === participantId) {
      paid.push({
        expenseId: expense.id,
        expenseDate: expense.expenseDate,
        description: expense.description,
        amountMinor: expense.amountMinor,
      });
      totalPaidMinor += expense.amountMinor;
    }

    for (const share of expense.shares) {
      if (share.participantId === participantId) {
        assigned.push({
          expenseId: expense.id,
          expenseDate: expense.expenseDate,
          description: expense.description,
          shareMinor: share.amountMinor,
          expenseAmountMinor: expense.amountMinor,
          paidBy: {
            id: expense.paidByParticipantId,
            name: nameById.get(expense.paidByParticipantId) ?? 'Unknown',
          },
        });
        totalAssignedMinor += share.amountMinor;
      }
    }
  }

  return ok({
    participant: {
      id: participant.id,
      name: participant.name,
      isOrganizer: participant.isOrganizer,
    },
    currency: trip.currency,
    totalPaidMinor,
    totalAssignedMinor,
    netMinor: totalPaidMinor - totalAssignedMinor,
    paid,
    assigned,
  });
}
