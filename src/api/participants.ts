import type { DocumentStore, TripRecord } from '../store/types';
import {
  conflict,
  created,
  noContent,
  notFound,
  ok,
  validationError,
  type ApiResult,
} from '../validation/errors';

export interface ParticipantDto {
  id: number;
  tripId: number;
  name: string;
  isOrganizer: boolean;
  isUsed: boolean;
}

export function isParticipantUsedInTrip(trip: TripRecord, participantId: number): boolean {
  for (const expense of trip.expenses) {
    if (expense.paidByParticipantId === participantId) return true;
    for (const share of expense.shares) {
      if (share.participantId === participantId) return true;
    }
  }
  return false;
}

export function listParticipants(
  store: DocumentStore,
  tripId: number
): ApiResult<{ participants: ParticipantDto[] }> {
  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }

  const participants: ParticipantDto[] = trip.participants.map((p) => ({
    id: p.id,
    tripId: trip.id,
    name: p.name,
    isOrganizer: p.isOrganizer,
    isUsed: isParticipantUsedInTrip(trip, p.id),
  }));

  return ok({ participants });
}

export function addParticipant(
  store: DocumentStore,
  tripId: number,
  input: { name: string }
): ApiResult<ParticipantDto> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length === 0) {
    return validationError('Participant name is required.');
  }
  if (name.length > 40) {
    return validationError('Participant name must be 40 characters or fewer.');
  }

  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }

  const duplicate = trip.participants.some(
    (p) => p.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return validationError(`"${name}" is already on this trip.`);
  }

  const id = doc.nextId;
  doc.nextId += 1;

  trip.participants.push({
    id,
    name,
    isOrganizer: false,
    createdAt: new Date().toISOString(),
  });

  store.writeDocument(doc);

  return created({
    id,
    tripId: trip.id,
    name,
    isOrganizer: false,
    isUsed: false,
  });
}

export function updateParticipant(
  store: DocumentStore,
  tripId: number,
  participantId: number,
  input: { name: string }
): ApiResult<ParticipantDto> {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length === 0) {
    return validationError('Participant name is required.');
  }
  if (name.length > 40) {
    return validationError('Participant name must be 40 characters or fewer.');
  }

  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }

  const participant = trip.participants.find((p) => p.id === participantId);
  if (!participant) {
    return notFound('Participant not found on this trip.');
  }

  if (isParticipantUsedInTrip(trip, participantId)) {
    return conflict(
      'Cannot rename a participant who already paid or shares an expense on this trip.'
    );
  }

  const duplicate = trip.participants.some(
    (p) => p.id !== participantId && p.name.toLowerCase() === name.toLowerCase()
  );
  if (duplicate) {
    return validationError(`"${name}" is already on this trip.`);
  }

  participant.name = name;
  store.writeDocument(doc);

  return ok({
    id: participant.id,
    tripId: trip.id,
    name: participant.name,
    isOrganizer: participant.isOrganizer,
    isUsed: false,
  });
}

export function deleteParticipant(
  store: DocumentStore,
  tripId: number,
  participantId: number
): ApiResult<null> {
  const doc = store.readDocument();
  const trip = doc.trips.find((t) => t.id === tripId);
  if (!trip) {
    return notFound('Trip not found.');
  }

  const index = trip.participants.findIndex((p) => p.id === participantId);
  if (index === -1) {
    return notFound('Participant not found on this trip.');
  }

  const participant = trip.participants[index];
  if (participant.isOrganizer) {
    return conflict('The trip organizer cannot be removed.');
  }

  if (isParticipantUsedInTrip(trip, participantId)) {
    return conflict(
      'Cannot remove a participant who already paid or shares an expense on this trip.'
    );
  }

  trip.participants.splice(index, 1);
  store.writeDocument(doc);

  return noContent();
}
