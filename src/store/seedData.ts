import type { DocumentStore } from './types';
import { createTrip } from '../api/trips';
import { addParticipant } from '../api/participants';
import { createExpense } from '../api/expenses';

const SEEDED_MARKER_KEY = 'trip-split.seeded.v1';

/**
 * Seeds two deterministic sample trips on a brand-new browser session:
 * 1. "Goa Weekend" (INR): 4 friends, 8 realistic expenses with >=3 partial subsets,
 *    >=3 unequal splits, and 1 expense where the payer is excluded from the shares.
 * 2. "Lisbon Escape" (EUR): 2 friends, 0 expenses so currency editing can be tested immediately.
 *
 * Uses the real API layer so every stored record obeys every invariant.
 */
export function seedSampleTrips(store: DocumentStore): void {
  const goaRes = createTrip(store, {
    name: 'Goa Weekend',
    currency: 'INR',
    organizerName: 'Asha',
  });
  if (!goaRes.ok) return;

  const goaId = goaRes.data.trip.id;
  const ashaId = goaRes.data.organizer.id;

  const benRes = addParticipant(store, goaId, { name: 'Ben' });
  const ciaRes = addParticipant(store, goaId, { name: 'Cia' });
  const devRes = addParticipant(store, goaId, { name: 'Dev' });
  if (!benRes.ok || !ciaRes.ok || !devRes.ok) return;

  const benId = benRes.data.id;
  const ciaId = ciaRes.data.id;
  const devId = devRes.data.id;

  // 1. All 4, equal split (₹12,000.00)
  createExpense(store, goaId, {
    expenseDate: '2026-11-15',
    description: 'Beach Villa Stay (2 Nights)',
    amountMinor: 1200000,
    paidByParticipantId: ashaId,
    note: 'Paid deposit + check-in balance at Candolim',
    shares: [
      { participantId: ashaId, amountMinor: 300000 },
      { participantId: benId, amountMinor: 300000 },
      { participantId: ciaId, amountMinor: 300000 },
      { participantId: devId, amountMinor: 300000 },
    ],
  });

  // 2. Partial group (3 people), unequal shares (₹2,450.00)
  createExpense(store, goaId, {
    expenseDate: '2026-11-15',
    description: 'Airport Taxi & Toll',
    amountMinor: 245000,
    paidByParticipantId: benId,
    note: 'Dev arrived on the later evening train',
    shares: [
      { participantId: ashaId, amountMinor: 85000 },
      { participantId: benId, amountMinor: 80000 },
      { participantId: ciaId, amountMinor: 80000 },
    ],
  });

  // 3. Partial group (2 people), payer OUTSIDE shares (₹1,800.00)
  createExpense(store, goaId, {
    expenseDate: '2026-11-16',
    description: 'Scooter Rentals (Ben & Cia)',
    amountMinor: 180000,
    paidByParticipantId: ashaId,
    note: 'Asha paid cash at rental desk; only Ben and Cia rode',
    shares: [
      { participantId: benId, amountMinor: 100000 },
      { participantId: ciaId, amountMinor: 80000 },
    ],
  });

  // 4. All 4, unequal shares (₹4,200.00)
  createExpense(store, goaId, {
    expenseDate: '2026-11-16',
    description: 'Thalassa Sunset Dinner',
    amountMinor: 420000,
    paidByParticipantId: ciaId,
    note: 'Includes 10% service charge; Dev skipped cocktails',
    shares: [
      { participantId: ashaId, amountMinor: 120000 },
      { participantId: benId, amountMinor: 120000 },
      { participantId: ciaId, amountMinor: 110000 },
      { participantId: devId, amountMinor: 70000 },
    ],
  });

  // 5. Partial group (2 people), equal shares (₹1,500.00)
  createExpense(store, goaId, {
    expenseDate: '2026-11-16',
    description: 'Kayaking in Sal Backwaters',
    amountMinor: 150000,
    paidByParticipantId: devId,
    note: null,
    shares: [
      { participantId: ashaId, amountMinor: 75000 },
      { participantId: devId, amountMinor: 75000 },
    ],
  });

  // 6. All 4, unequal shares (₹1,650.00)
  createExpense(store, goaId, {
    expenseDate: '2026-11-17',
    description: 'Artjuna Brunch & Coffee',
    amountMinor: 165000,
    paidByParticipantId: benId,
    note: 'Ben got extra takeaway bakery box',
    shares: [
      { participantId: ashaId, amountMinor: 35000 },
      { participantId: benId, amountMinor: 55000 },
      { participantId: ciaId, amountMinor: 40000 },
      { participantId: devId, amountMinor: 35000 },
    ],
  });

  // 7. Partial group (3 people), equal shares (₹900.00)
  createExpense(store, goaId, {
    expenseDate: '2026-11-17',
    description: 'Beach Shack Cold Drinks & Snacks',
    amountMinor: 90000,
    paidByParticipantId: devId,
    note: null,
    shares: [
      { participantId: benId, amountMinor: 30000 },
      { participantId: ciaId, amountMinor: 30000 },
      { participantId: devId, amountMinor: 30000 },
    ],
  });

  // 8. All 4, equal shares (₹3,200.00)
  createExpense(store, goaId, {
    expenseDate: '2026-11-18',
    description: 'Farewell Seafood Lunch at Gunpowder',
    amountMinor: 320000,
    paidByParticipantId: ashaId,
    note: 'Tip included',
    shares: [
      { participantId: ashaId, amountMinor: 80000 },
      { participantId: benId, amountMinor: 80000 },
      { participantId: ciaId, amountMinor: 80000 },
      { participantId: devId, amountMinor: 80000 },
    ],
  });

  // Second trip with 0 expenses to demonstrate multi-trip isolation & unlocked currency
  const lisbonRes = createTrip(store, {
    name: 'Lisbon Escape',
    currency: 'EUR',
    organizerName: 'Asha',
  });
  if (lisbonRes.ok) {
    addParticipant(store, lisbonRes.data.trip.id, { name: 'Marco' });
  }
}

export function ensureBrowserSeeded(store: DocumentStore): void {
  if (typeof window === 'undefined') return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get('empty') === '1') return;

    const alreadySeeded = window.localStorage.getItem(SEEDED_MARKER_KEY);
    if (!alreadySeeded) {
      const doc = store.readDocument();
      if (doc.trips.length === 0) {
        seedSampleTrips(store);
      }
      window.localStorage.setItem(SEEDED_MARKER_KEY, '1');
    }
  } catch {
    // Ignore storage access errors in restricted environments
  }
}
