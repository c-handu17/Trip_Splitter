export type CurrencyCode = 'INR' | 'USD' | 'EUR' | 'GBP';

export interface ShareRecord {
  participantId: number;
  amountMinor: number;
}

export interface ExpenseRecord {
  id: number;
  paidByParticipantId: number;
  expenseDate: string; // YYYY-MM-DD
  description: string;
  amountMinor: number;
  note: string | null;
  createdAt: string; // ISO-8601 UTC
  shares: ShareRecord[];
}

export interface ParticipantRecord {
  id: number;
  name: string;
  isOrganizer: boolean;
  createdAt: string; // ISO-8601 UTC
}

export interface TripRecord {
  id: number;
  name: string;
  currency: CurrencyCode;
  createdAt: string; // ISO-8601 UTC
  participants: ParticipantRecord[];
  expenses: ExpenseRecord[];
}

export interface TripSplitDocument {
  nextId: number;
  trips: TripRecord[];
}

export interface DocumentStore {
  readDocument(): TripSplitDocument;
  writeDocument(doc: TripSplitDocument): void;
}
