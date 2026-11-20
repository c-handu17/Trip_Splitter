import type { DocumentStore } from '../store/types';
import { calculateTripSettlement, type SettlementResult } from '../money/settlement';
import { notFound, ok, type ApiResult } from '../validation/errors';

export function getTripSettlement(
  store: DocumentStore,
  tripId: number
): ApiResult<SettlementResult> {
  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }

  // Pure calculation — never mutates or writes trip-split.json
  return ok(calculateTripSettlement(trip));
}
