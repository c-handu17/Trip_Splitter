import type { DocumentStore, TripSplitDocument } from './types';

export const DEFAULT_STORAGE_KEY = 'trip-split.json';

export function createEmptyDocument(): TripSplitDocument {
  return {
    nextId: 1,
    trips: [],
  };
}

export function cloneDocument(doc: TripSplitDocument): TripSplitDocument {
  return JSON.parse(JSON.stringify(doc)) as TripSplitDocument;
}

export function isValidDocumentShape(value: unknown): value is TripSplitDocument {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.nextId === 'number' &&
    Number.isInteger(candidate.nextId) &&
    candidate.nextId >= 1 &&
    Array.isArray(candidate.trips)
  );
}

/**
 * In-memory document store for pure tests and isolated runs.
 */
export class MemoryDocumentStore implements DocumentStore {
  private rawJson: string | null = null;

  constructor(initial?: TripSplitDocument) {
    if (initial) {
      this.rawJson = JSON.stringify(initial);
    }
  }

  readDocument(): TripSplitDocument {
    if (this.rawJson === null) {
      const empty = createEmptyDocument();
      this.rawJson = JSON.stringify(empty);
      return cloneDocument(empty);
    }
    return JSON.parse(this.rawJson) as TripSplitDocument;
  }

  writeDocument(doc: TripSplitDocument): void {
    const serialized = JSON.stringify(doc);
    this.rawJson = serialized;
  }

  getRawBytes(): string | null {
    return this.rawJson;
  }
}

/**
 * Browser localStorage-backed store persisting the full trip-split.json document.
 * Serializes and validates the complete JSON string before writing so failed writes
 * never corrupt existing data.
 */
export class BrowserLocalStorageStore implements DocumentStore {
  private readonly storageKey: string;
  private readonly storage: Pick<Storage, 'getItem' | 'setItem'>;

  constructor(
    storageKey: string = DEFAULT_STORAGE_KEY,
    storage: Pick<Storage, 'getItem' | 'setItem'> = window.localStorage
  ) {
    this.storageKey = storageKey;
    this.storage = storage;
  }

  readDocument(): TripSplitDocument {
    const raw = this.storage.getItem(this.storageKey);
    if (!raw) {
      const empty = createEmptyDocument();
      this.writeDocument(empty);
      return cloneDocument(empty);
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      if (isValidDocumentShape(parsed)) {
        return cloneDocument(parsed);
      }
    } catch {
      // Corrupt payload falls back cleanly to a fresh empty document
    }
    const empty = createEmptyDocument();
    this.writeDocument(empty);
    return cloneDocument(empty);
  }

  writeDocument(doc: TripSplitDocument): void {
    const serialized = JSON.stringify(doc);
    // Validate JSON round-trip before replacing stored value
    JSON.parse(serialized);
    this.storage.setItem(this.storageKey, serialized);
  }
}
