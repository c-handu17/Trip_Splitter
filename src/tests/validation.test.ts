import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryDocumentStore } from '../store/fileStore';
import {
  formatMinorToMajor,
  isValidCurrency,
  parseMajorToMinor,
} from '../money/currency';
import { createTrip, getTrip, listTrips, updateTrip } from '../api/trips';
import {
  addParticipant,
  deleteParticipant,
  listParticipants,
  updateParticipant,
} from '../api/participants';
import {
  createExpense,
  deleteExpense,
  getExpense,
  listExpenses,
  updateExpense,
} from '../api/expenses';
import { getParticipantSummary } from '../api/people';

test('currency validation and major/minor conversions', () => {
  assert.equal(isValidCurrency('INR'), true);
  assert.equal(isValidCurrency('USD'), true);
  assert.equal(isValidCurrency('EUR'), true);
  assert.equal(isValidCurrency('GBP'), true);
  assert.equal(isValidCurrency('JPY'), false);
  assert.equal(isValidCurrency(''), false);

  const parsed = parseMajorToMinor('10.50');
  assert.equal(parsed.ok, true);
  if (parsed.ok) assert.equal(parsed.amountMinor, 1050);

  assert.equal(formatMinorToMajor(1050), '10.50');
  assert.equal(formatMinorToMajor(5), '0.05');
  assert.equal(formatMinorToMajor(-1250), '-12.50');

  assert.equal(parseMajorToMinor('10.555').ok, false);
  assert.equal(parseMajorToMinor('0').ok, false);
  assert.equal(parseMajorToMinor('-5').ok, false);
  assert.equal(parseMajorToMinor('abc').ok, false);
});

test('trip create, list counts, rename, currency lock, and not_found', () => {
  const store = new MemoryDocumentStore();

  const badCurrency = createTrip(store, {
    name: 'Tokyo',
    currency: 'JPY',
    organizerName: 'Asha',
  });
  assert.equal(badCurrency.ok, false);
  if (!badCurrency.ok) assert.equal(badCurrency.body.error.code, 'validation_error');

  const emptyName = createTrip(store, {
    name: '   ',
    currency: 'USD',
    organizerName: 'Asha',
  });
  assert.equal(emptyName.ok, false);

  const created = createTrip(store, {
    name: '  Goa  ',
    currency: 'INR',
    organizerName: '  Asha  ',
  });
  assert.equal(created.ok, true);
  assert.equal(created.status, 201);
  if (!created.ok) return;
  assert.equal(created.data.trip.name, 'Goa');
  assert.equal(created.data.organizer.isOrganizer, true);

  const listRes = listTrips(store);
  assert.equal(listRes.ok, true);
  if (listRes.ok) {
    assert.equal(listRes.data.trips.length, 1);
    assert.equal(listRes.data.trips[0].participantCount, 1);
    assert.equal(listRes.data.trips[0].expenseCount, 0);
  }

  // Currency change succeeds while no expenses exist
  const changed = updateTrip(store, created.data.trip.id, {
    name: 'Goa 2026',
    currency: 'USD',
  });
  assert.equal(changed.ok, true);
  if (changed.ok) {
    assert.equal(changed.data.name, 'Goa 2026');
    assert.equal(changed.data.currency, 'USD');
  }

  // Add an expense -> currency change now returns 409 conflict
  const exp = createExpense(store, created.data.trip.id, {
    expenseDate: '2026-11-20',
    description: 'Snacks',
    amountMinor: 500,
    paidByParticipantId: created.data.organizer.id,
    shares: [{ participantId: created.data.organizer.id, amountMinor: 500 }],
  });
  assert.equal(exp.ok, true);

  const beforeBytes = store.getRawBytes();
  const locked = updateTrip(store, created.data.trip.id, { currency: 'EUR' });
  assert.equal(locked.ok, false);
  if (!locked.ok) {
    assert.equal(locked.status, 409);
    assert.equal(locked.body.error.code, 'conflict');
  }
  assert.equal(store.getRawBytes(), beforeBytes);

  // Rename still succeeds after expense exists
  const renamed = updateTrip(store, created.data.trip.id, { name: 'Goa Winter' });
  assert.equal(renamed.ok, true);

  // Missing trip returns 404
  const missing = getTrip(store, 9999);
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.body.error.code, 'not_found');
});

test('participants uniqueness per trip, rename/delete rules, and cross-trip isolation', () => {
  const store = new MemoryDocumentStore();
  const tripA = createTrip(store, { name: 'Trip A', currency: 'INR', organizerName: 'Asha' });
  const tripB = createTrip(store, { name: 'Trip B', currency: 'USD', organizerName: 'Asha' });
  if (!tripA.ok || !tripB.ok) return;

  const benA = addParticipant(store, tripA.data.trip.id, { name: 'Ben' });
  assert.equal(benA.ok, true);
  if (!benA.ok) return;

  // Duplicate case-insensitive rejected on same trip
  const dup = addParticipant(store, tripA.data.trip.id, { name: '  ben  ' });
  assert.equal(dup.ok, false);
  if (!dup.ok) assert.equal(dup.body.error.code, 'validation_error');

  // Same name allowed on different trip
  const benB = addParticipant(store, tripB.data.trip.id, { name: 'Ben' });
  assert.equal(benB.ok, true);

  // Unused organizer can be renamed, but never deleted
  const renameOrg = updateParticipant(store, tripA.data.trip.id, tripA.data.organizer.id, {
    name: 'Asha K',
  });
  assert.equal(renameOrg.ok, true);

  const delOrg = deleteParticipant(store, tripA.data.trip.id, tripA.data.organizer.id);
  assert.equal(delOrg.ok, false);
  if (!delOrg.ok) assert.equal(delOrg.body.error.code, 'conflict');

  // Unused friend can be renamed and deleted
  const ciaA = addParticipant(store, tripA.data.trip.id, { name: 'Cia' });
  if (!ciaA.ok) return;
  const renameCia = updateParticipant(store, tripA.data.trip.id, ciaA.data.id, { name: 'Ciara' });
  assert.equal(renameCia.ok, true);
  const delCia = deleteParticipant(store, tripA.data.trip.id, ciaA.data.id);
  assert.equal(delCia.ok, true);
  assert.equal(delCia.status, 204);

  // Use Ben on an expense -> rename and delete return conflict
  const exp = createExpense(store, tripA.data.trip.id, {
    expenseDate: '2026-11-20',
    description: 'Cab',
    amountMinor: 1000,
    paidByParticipantId: tripA.data.organizer.id,
    shares: [{ participantId: benA.data.id, amountMinor: 1000 }],
  });
  assert.equal(exp.ok, true);

  const beforeBytes = store.getRawBytes();
  const renameUsed = updateParticipant(store, tripA.data.trip.id, benA.data.id, { name: 'Benny' });
  assert.equal(renameUsed.ok, false);
  if (!renameUsed.ok) assert.equal(renameUsed.body.error.code, 'conflict');

  const deleteUsed = deleteParticipant(store, tripA.data.trip.id, benA.data.id);
  assert.equal(deleteUsed.ok, false);
  if (!deleteUsed.ok) assert.equal(deleteUsed.body.error.code, 'conflict');
  assert.equal(store.getRawBytes(), beforeBytes);

  // Participant from Trip B accessed via Trip A returns not_found
  if (benB.ok) {
    const cross = deleteParticipant(store, tripA.data.trip.id, benB.data.id);
    assert.equal(cross.ok, false);
    if (!cross.ok) assert.equal(cross.body.error.code, 'not_found');
  }

  const listA = listParticipants(store, tripA.data.trip.id);
  assert.equal(listA.ok, true);
  if (listA.ok) assert.equal(listA.data.participants.length, 2);
});

test('expense validation, payer outside/inside/sole sharer, edit, delete, and person summary', () => {
  const store = new MemoryDocumentStore();
  const tripA = createTrip(store, { name: 'Trip A', currency: 'INR', organizerName: 'Asha' });
  const tripB = createTrip(store, { name: 'Trip B', currency: 'INR', organizerName: 'Asha' });
  if (!tripA.ok || !tripB.ok) return;

  const benA = addParticipant(store, tripA.data.trip.id, { name: 'Ben' });
  if (!benA.ok) return;

  // Invalid date rejected
  const badDate = createExpense(store, tripA.data.trip.id, {
    expenseDate: '2026-02-30',
    description: 'Lunch',
    amountMinor: 500,
    paidByParticipantId: tripA.data.organizer.id,
    shares: [{ participantId: benA.data.id, amountMinor: 500 }],
  });
  assert.equal(badDate.ok, false);

  // Note > 200 rejected
  const longNote = createExpense(store, tripA.data.trip.id, {
    expenseDate: '2026-11-20',
    description: 'Lunch',
    amountMinor: 500,
    paidByParticipantId: tripA.data.organizer.id,
    note: 'x'.repeat(201),
    shares: [{ participantId: benA.data.id, amountMinor: 500 }],
  });
  assert.equal(longNote.ok, false);

  // Duplicate sharer, zero share, empty shares, cross-trip sharer rejected
  const dupSharer = createExpense(store, tripA.data.trip.id, {
    expenseDate: '2026-11-20',
    description: 'Lunch',
    amountMinor: 500,
    paidByParticipantId: tripA.data.organizer.id,
    shares: [
      { participantId: benA.data.id, amountMinor: 250 },
      { participantId: benA.data.id, amountMinor: 250 },
    ],
  });
  assert.equal(dupSharer.ok, false);

  const zeroShare = createExpense(store, tripA.data.trip.id, {
    expenseDate: '2026-11-20',
    description: 'Lunch',
    amountMinor: 500,
    paidByParticipantId: tripA.data.organizer.id,
    shares: [
      { participantId: benA.data.id, amountMinor: 500 },
      { participantId: tripA.data.organizer.id, amountMinor: 0 },
    ],
  });
  assert.equal(zeroShare.ok, false);

  const crossTripSharer = createExpense(store, tripA.data.trip.id, {
    expenseDate: '2026-11-20',
    description: 'Lunch',
    amountMinor: 500,
    paidByParticipantId: tripA.data.organizer.id,
    shares: [{ participantId: tripB.data.organizer.id, amountMinor: 500 }],
  });
  assert.equal(crossTripSharer.ok, false);

  // Payer outside shares + blank note becomes null
  const e1 = createExpense(store, tripA.data.trip.id, {
    expenseDate: '2026-11-18',
    description: 'Scooter',
    amountMinor: 1000,
    paidByParticipantId: tripA.data.organizer.id,
    note: '   ',
    shares: [{ participantId: benA.data.id, amountMinor: 1000 }],
  });
  assert.equal(e1.ok, true);
  if (!e1.ok) return;
  assert.equal(e1.data.note, null);

  // Payer inside shares
  const e2 = createExpense(store, tripA.data.trip.id, {
    expenseDate: '2026-11-19',
    description: 'Dinner',
    amountMinor: 2000,
    paidByParticipantId: benA.data.id,
    shares: [
      { participantId: tripA.data.organizer.id, amountMinor: 1200 },
      { participantId: benA.data.id, amountMinor: 800 },
    ],
  });
  assert.equal(e2.ok, true);
  if (!e2.ok) return;

  // Payer as sole sharer (same date as e2, newer id -> sorts first)
  const e3 = createExpense(store, tripA.data.trip.id, {
    expenseDate: '2026-11-19',
    description: 'Coffee',
    amountMinor: 300,
    paidByParticipantId: tripA.data.organizer.id,
    shares: [{ participantId: tripA.data.organizer.id, amountMinor: 300 }],
  });
  assert.equal(e3.ok, true);
  if (!e3.ok) return;

  // Expense on Trip B with same organizer name "Asha" should not leak into Trip A
  createExpense(store, tripB.data.trip.id, {
    expenseDate: '2026-11-20',
    description: 'Other Trip Expense',
    amountMinor: 99900,
    paidByParticipantId: tripB.data.organizer.id,
    shares: [{ participantId: tripB.data.organizer.id, amountMinor: 99900 }],
  });

  // Sort order: newest date first, then newest id
  const listed = listExpenses(store, tripA.data.trip.id);
  assert.equal(listed.ok, true);
  if (listed.ok) {
    assert.deepEqual(
      listed.data.expenses.map((e) => e.id),
      [e3.data.id, e2.data.id, e1.data.id]
    );
  }

  // Cross-trip get and delete return 404
  const wrongTripGet = getExpense(store, tripB.data.trip.id, e1.data.id);
  assert.equal(wrongTripGet.ok, false);
  if (!wrongTripGet.ok) assert.equal(wrongTripGet.body.error.code, 'not_found');

  // Person summary for Asha on Trip A: paid 1000 + 300 = 1300; assigned 1200 + 300 = 1500; net = -200
  const ashaSummary = getParticipantSummary(store, tripA.data.trip.id, tripA.data.organizer.id);
  assert.equal(ashaSummary.ok, true);
  if (ashaSummary.ok) {
    assert.equal(ashaSummary.data.totalPaidMinor, 1300);
    assert.equal(ashaSummary.data.totalAssignedMinor, 1500);
    assert.equal(ashaSummary.data.netMinor, -200);
    assert.equal(ashaSummary.data.paid.length, 2);
    assert.equal(ashaSummary.data.assigned.length, 2);
  }

  // Invalid patch leaves previous expense unchanged
  const badPatch = updateExpense(store, tripA.data.trip.id, e1.data.id, {
    expenseDate: '2026-11-18',
    description: 'Scooter Edited',
    amountMinor: 1000,
    paidByParticipantId: tripA.data.organizer.id,
    shares: [{ participantId: benA.data.id, amountMinor: 999 }],
  });
  assert.equal(badPatch.ok, false);
  const unchanged = getExpense(store, tripA.data.trip.id, e1.data.id);
  assert.equal(unchanged.ok, true);
  if (unchanged.ok) assert.equal(unchanged.data.description, 'Scooter');

  // Valid patch replaces shares
  const goodPatch = updateExpense(store, tripA.data.trip.id, e1.data.id, {
    expenseDate: '2026-11-18',
    description: 'Scooter Rental',
    amountMinor: 1000,
    paidByParticipantId: tripA.data.organizer.id,
    note: 'Updated note',
    shares: [
      { participantId: tripA.data.organizer.id, amountMinor: 500 },
      { participantId: benA.data.id, amountMinor: 500 },
    ],
  });
  assert.equal(goodPatch.ok, true);
  if (goodPatch.ok) {
    assert.equal(goodPatch.data.shares.length, 2);
    assert.equal(goodPatch.data.note, 'Updated note');
  }

  // Delete returns 204 and later get returns 404
  const deleted = deleteExpense(store, tripA.data.trip.id, e3.data.id);
  assert.equal(deleted.ok, true);
  assert.equal(deleted.status, 204);
  const afterDelete = getExpense(store, tripA.data.trip.id, e3.data.id);
  assert.equal(afterDelete.ok, false);
  if (!afterDelete.ok) assert.equal(afterDelete.body.error.code, 'not_found');
});
