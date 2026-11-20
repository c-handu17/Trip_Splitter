import type { CurrencyCode, DocumentStore, TripRecord } from '../store/types';
import { isValidCurrency } from '../money/currency';
import {
  conflict,
  created,
  notFound,
  ok,
  validationError,
  type ApiResult,
} from '../validation/errors';

export interface TripSummaryDto {
  id: number;
  name: string;
  currency: CurrencyCode;
  participantCount: number;
  expenseCount: number;
  createdAt: string;
}

export interface CreateTripInput {
  name: string;
  currency: string;
  organizerName: string;
}

export interface CreateTripResponse {
  trip: {
    id: number;
    name: string;
    currency: CurrencyCode;
  };
  organizer: {
    id: number;
    name: string;
    isOrganizer: true;
  };
}

export interface UpdateTripInput {
  name?: string;
  currency?: string;
}

function toSummary(trip: TripRecord): TripSummaryDto {
  return {
    id: trip.id,
    name: trip.name,
    currency: trip.currency,
    participantCount: trip.participants.length,
    expenseCount: trip.expenses.length,
    createdAt: trip.createdAt,
  };
}

export function listTrips(store: DocumentStore): ApiResult<{ trips: TripSummaryDto[] }> {
  const doc = store.readDocument();
  const trips = [...doc.trips]
    .sort((a, b) => b.id - a.id)
    .map(toSummary);
  return ok({ trips });
}

export function createTrip(
  store: DocumentStore,
  input: CreateTripInput
): ApiResult<CreateTripResponse> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length === 0) {
    return validationError('Trip name is required.');
  }
  if (name.length > 60) {
    return validationError('Trip name must be 60 characters or fewer.');
  }

  const currency = typeof input.currency === 'string' ? input.currency.trim() : '';
  if (!isValidCurrency(currency)) {
    return validationError('Currency must be one of INR, USD, EUR, or GBP.');
  }

  const organizerName =
    typeof input.organizerName === 'string' ? input.organizerName.trim() : '';
  if (organizerName.length === 0) {
    return validationError('Your name (organizer) is required.');
  }
  if (organizerName.length > 40) {
    return validationError('Organizer name must be 40 characters or fewer.');
  }

  const doc = store.readDocument();
  const now = new Date().toISOString();

  const tripId = doc.nextId;
  doc.nextId += 1;
  const organizerId = doc.nextId;
  doc.nextId += 1;

  const newTrip: TripRecord = {
    id: tripId,
    name,
    currency,
    createdAt: now,
    participants: [
      {
        id: organizerId,
        name: organizerName,
        isOrganizer: true,
        createdAt: now,
      },
    ],
    expenses: [],
  };

  doc.trips.push(newTrip);
  store.writeDocument(doc);

  return created({
    trip: {
      id: tripId,
      name,
      currency,
    },
    organizer: {
      id: organizerId,
      name: organizerName,
      isOrganizer: true,
    },
  });
}

export function getTrip(
  store: DocumentStore,
  tripId: number
): ApiResult<TripSummaryDto> {
  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }
  return ok(toSummary(trip));
}

export function updateTrip(
  store: DocumentStore,
  tripId: number,
  input: UpdateTripInput
): ApiResult<TripSummaryDto> {
  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }

  let nextName = trip.name;
  if (input.name !== undefined) {
    const trimmed = typeof input.name === 'string' ? input.name.trim() : '';
    if (trimmed.length === 0) {
      return validationError('Trip name is required.');
    }
    if (trimmed.length > 60) {
      return validationError('Trip name must be 60 characters or fewer.');
    }
    nextName = trimmed;
  }

  let nextCurrency = trip.currency;
  if (input.currency !== undefined) {
    if (trip.expenses.length > 0) {
      return conflict('Currency cannot be changed once expenses have been added to this trip.');
    }
    const trimmedCurrency =
      typeof input.currency === 'string' ? input.currency.trim() : '';
    if (!isValidCurrency(trimmedCurrency)) {
      return validationError('Currency must be one of INR, USD, EUR, or GBP.');
    }
    nextCurrency = trimmedCurrency;
  }

  trip.name = nextName;
  trip.currency = nextCurrency;
  store.writeDocument(doc);

  return ok(toSummary(trip));
}
