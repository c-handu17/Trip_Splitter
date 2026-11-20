import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDocumentStore } from '../store/fileStore';
import { createTrip } from '../api/trips';
import { addParticipant } from '../api/participants';
import { createExpense } from '../api/expenses';
import { getTripSettlement } from '../api/settlement';
import { formatSettlementPlainText } from '../money/settlement';
import { seedSampleTrips } from '../store/seedData';

test('settlement clears 4-person 8-expense fixture to zero and preserves file bytes', () => {
  const store = new MemoryDocumentStore();
  seedSampleTrips(store);

  const doc = store.readDocument();
  const goaTrip = doc.trips.find((t) => t.name === 'Goa Weekend');
  assert.ok(goaTrip);
  assert.equal(goaTrip.participants.length, 4);
  assert.equal(goaTrip.expenses.length, 8);

  const beforeBytes = store.getRawBytes();
  const res = getTripSettlement(store, goaTrip.id);
  const afterBytes = store.getRawBytes();

  // Settlement must never write back to the JSON document
  assert.equal(afterBytes, beforeBytes);
  assert.equal(res.ok, true);
  if (!res.ok) return;

  assert.equal(res.data.currency, 'INR');
  assert.equal(res.data.balances.length, 4);

  // Verify every net == totalPaid - totalAssigned and sums to 0 across group
  const netById = new Map<number, number>();
  let totalNegativeDebt = 0;
  for (const b of res.data.balances) {
    assert.equal(b.netMinor, b.totalPaidMinor - b.totalAssignedMinor);
    netById.set(b.participantId, b.netMinor);
    if (b.netMinor < 0) {
      totalNegativeDebt += Math.abs(b.netMinor);
    }
  }
  const sumNets = res.data.balances.reduce((acc, b) => acc + b.netMinor, 0);
  assert.equal(sumNets, 0);

  // Every payment is strictly debtor -> creditor, and payments sum to totalNegativeDebt
  let sumPayments = 0;
  for (const p of res.data.payments) {
    const fromInitial = res.data.balances.find((b) => b.participantId === p.fromParticipantId)!;
    const toInitial = res.data.balances.find((b) => b.participantId === p.toParticipantId)!;
    assert.ok(fromInitial.netMinor < 0, 'payer must have negative net');
    assert.ok(toInitial.netMinor > 0, 'recipient must have positive net');
    assert.ok(p.amountMinor > 0);
    sumPayments += p.amountMinor;

    netById.set(p.fromParticipantId, (netById.get(p.fromParticipantId) ?? 0) + p.amountMinor);
    netById.set(p.toParticipantId, (netById.get(p.toParticipantId) ?? 0) - p.amountMinor);
  }

  assert.equal(sumPayments, totalNegativeDebt);
  for (const [id, finalNet] of netById.entries()) {
    assert.equal(finalNet, 0, `participant ${id} net should be 0 after settlement`);
  }

  // Minimal payment bound: at most (nonZeroBalances - 1) payments
  const nonZeroCount = res.data.balances.filter((b) => b.netMinor !== 0).length;
  assert.ok(res.data.payments.length <= Math.max(0, nonZeroCount - 1));

  // Plain-text formatting includes every payment
  const text = formatSettlementPlainText(goaTrip.name, res.data);
  for (const p of res.data.payments) {
    assert.ok(text.includes(p.fromName));
    assert.ok(text.includes(p.toName));
  }
});

test('settlement omits zero-net participants from payments and sorts ties deterministically by participantId', () => {
  const store = new MemoryDocumentStore();
  const trip = createTrip(store, {
    name: 'Tie Test',
    currency: 'USD',
    organizerName: 'Alex',
  });
  assert.equal(trip.ok, true);
  if (!trip.ok) return;

  const tripId = trip.data.trip.id;
  const alexId = trip.data.organizer.id;
  const beth = addParticipant(store, tripId, { name: 'Beth' });
  const carl = addParticipant(store, tripId, { name: 'Carl' });
  const dana = addParticipant(store, tripId, { name: 'Dana' });
  const even = addParticipant(store, tripId, { name: 'Even' });
  if (!beth.ok || !carl.ok || !dana.ok || !even.ok) return;

  // Alex (+500) and Beth (+500) are tied creditors; Carl (-500) and Dana (-500) are tied debtors; Even is 0
  createExpense(store, tripId, {
    expenseDate: '2026-11-20',
    description: 'Tickets A',
    amountMinor: 500,
    paidByParticipantId: alexId,
    shares: [{ participantId: carl.data.id, amountMinor: 500 }],
  });
  createExpense(store, tripId, {
    expenseDate: '2026-11-20',
    description: 'Tickets B',
    amountMinor: 500,
    paidByParticipantId: beth.data.id,
    shares: [{ participantId: dana.data.id, amountMinor: 500 }],
  });
  // Even pays and shares same amount -> net 0
  createExpense(store, tripId, {
    expenseDate: '2026-11-20',
    description: 'Coffee',
    amountMinor: 300,
    paidByParticipantId: even.data.id,
    shares: [{ participantId: even.data.id, amountMinor: 300 }],
  });

  const res = getTripSettlement(store, tripId);
  assert.equal(res.ok, true);
  if (!res.ok) return;

  // Even is in balances with net 0, omitted from payments
  const evenBal = res.data.balances.find((b) => b.participantId === even.data.id);
  assert.ok(evenBal);
  assert.equal(evenBal.netMinor, 0);
  assert.equal(
    res.data.payments.some(
      (p) => p.fromParticipantId === even.data.id || p.toParticipantId === even.data.id
    ),
    false
  );

  // Deterministic tie-breaking: smaller participantId matched first
  assert.equal(res.data.payments.length, 2);
  assert.equal(res.data.payments[0].fromParticipantId, carl.data.id);
  assert.equal(res.data.payments[0].toParticipantId, alexId);
  assert.equal(res.data.payments[1].fromParticipantId, dana.data.id);
  assert.equal(res.data.payments[1].toParticipantId, beth.data.id);
});
