import type { CurrencyCode, DocumentStore, ExpenseRecord, TripRecord } from '../store/types';
import { validateExpenseInput, type ExpenseInput } from '../validation/expense';
import {
  created,
  noContent,
  notFound,
  ok,
  validationError,
  type ApiResult,
} from '../validation/errors';

export interface ExpenseShareDto {
  participantId: number;
  name: string;
  amountMinor: number;
}

export interface ExpenseDto {
  id: number;
  expenseDate: string;
  description: string;
  amountMinor: number;
  currency: CurrencyCode;
  paidBy: {
    id: number;
    name: string;
  };
  note: string | null;
  shares: ExpenseShareDto[];
}

function toExpenseDto(trip: TripRecord, expense: ExpenseRecord): ExpenseDto {
  const nameById = new Map(trip.participants.map((p) => [p.id, p.name]));
  return {
    id: expense.id,
    expenseDate: expense.expenseDate,
    description: expense.description,
    amountMinor: expense.amountMinor,
    currency: trip.currency,
    paidBy: {
      id: expense.paidByParticipantId,
      name: nameById.get(expense.paidByParticipantId) ?? 'Unknown',
    },
    note: expense.note,
    shares: expense.shares.map((s) => ({
      participantId: s.participantId,
      name: nameById.get(s.participantId) ?? 'Unknown',
      amountMinor: s.amountMinor,
    })),
  };
}

export function sortExpensesNewestFirst(expenses: ExpenseRecord[]): ExpenseRecord[] {
  return [...expenses].sort((a, b) => {
    if (b.expenseDate !== a.expenseDate) {
      return b.expenseDate.localeCompare(a.expenseDate);
    }
    return b.id - a.id;
  });
}

export function listExpenses(
  store: DocumentStore,
  tripId: number
): ApiResult<{ expenses: ExpenseDto[] }> {
  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }

  const expenses = sortExpensesNewestFirst(trip.expenses).map((e) =>
    toExpenseDto(trip, e)
  );
  return ok({ expenses });
}

export function createExpense(
  store: DocumentStore,
  tripId: number,
  input: ExpenseInput
): ApiResult<ExpenseDto> {
  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }

  const validation = validateExpenseInput(input, trip.participants);
  if (!validation.ok) {
    return validationError(validation.message);
  }

  const id = doc.nextId;
  doc.nextId += 1;

  const record: ExpenseRecord = {
    id,
    paidByParticipantId: validation.value.paidByParticipantId,
    expenseDate: validation.value.expenseDate,
    description: validation.value.description,
    amountMinor: validation.value.amountMinor,
    note: validation.value.note,
    createdAt: new Date().toISOString(),
    shares: validation.value.shares,
  };

  trip.expenses.push(record);
  store.writeDocument(doc);

  return created(toExpenseDto(trip, record));
}

export function getExpense(
  store: DocumentStore,
  tripId: number,
  expenseId: number
): ApiResult<ExpenseDto> {
  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }

  const expense = trip.expenses.find((e) => e.id === expenseId);
  if (!expense) {
    return notFound('Expense not found on this trip.');
  }

  return ok(toExpenseDto(trip, expense));
}

export function updateExpense(
  store: DocumentStore,
  tripId: number,
  expenseId: number,
  input: ExpenseInput
): ApiResult<ExpenseDto> {
  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }

  const index = trip.expenses.findIndex((e) => e.id === expenseId);
  if (index === -1) {
    return notFound('Expense not found on this trip.');
  }

  const validation = validateExpenseInput(input, trip.participants);
  if (!validation.ok) {
    return validationError(validation.message);
  }

  const existing = trip.expenses[index];
  const updated: ExpenseRecord = {
    id: existing.id,
    createdAt: existing.createdAt,
    paidByParticipantId: validation.value.paidByParticipantId,
    expenseDate: validation.value.expenseDate,
    description: validation.value.description,
    amountMinor: validation.value.amountMinor,
    note: validation.value.note,
    shares: validation.value.shares,
  };

  trip.expenses[index] = updated;
  store.writeDocument(doc);

  return ok(toExpenseDto(trip, updated));
}

export function deleteExpense(
  store: DocumentStore,
  tripId: number,
  expenseId: number
): ApiResult<null> {
  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }

  const index = trip.expenses.findIndex((e) => e.id === expenseId);
  if (index === -1) {
    return notFound('Expense not found on this trip.');
  }

  trip.expenses.splice(index, 1);
  store.writeDocument(doc);

  return noContent();
}
