import fs from 'node:fs';
import path from 'node:path';
import type { DocumentStore, TripSplitDocument } from './types';
import { createEmptyDocument, isValidDocumentShape } from './fileStore';

export interface FileSystemOps {
  existsSync: typeof fs.existsSync;
  mkdirSync: typeof fs.mkdirSync;
  readFileSync: typeof fs.readFileSync;
  writeFileSync: typeof fs.writeFileSync;
  renameSync: typeof fs.renameSync;
  unlinkSync: typeof fs.unlinkSync;
}

const defaultFsOps: FileSystemOps = {
  existsSync: fs.existsSync,
  mkdirSync: fs.mkdirSync,
  readFileSync: fs.readFileSync,
  writeFileSync: fs.writeFileSync,
  renameSync: fs.renameSync,
  unlinkSync: fs.unlinkSync,
};

/**
 * Atomic file store for trip-split.json (Node runtime / tests).
 * Writes to a temporary file first, then atomically renames over the target path
 * so a failed write or replace leaves the previous file bytes completely unchanged.
 */
export class NodeFileStore implements DocumentStore {
  private readonly filePath: string;
  private readonly fsOps: FileSystemOps;

  constructor(filePath: string, fsOps: FileSystemOps = defaultFsOps) {
    this.filePath = filePath;
    this.fsOps = fsOps;
  }

  readDocument(): TripSplitDocument {
    if (!this.fsOps.existsSync(this.filePath)) {
      const empty = createEmptyDocument();
      this.writeDocument(empty);
      return empty;
    }

    const raw = this.fsOps.readFileSync(this.filePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    if (!isValidDocumentShape(parsed)) {
      throw new Error('Invalid trip-split.json document structure');
    }
    return parsed;
  }

  writeDocument(doc: TripSplitDocument): void {
    const dir = path.dirname(this.filePath);
    if (!this.fsOps.existsSync(dir)) {
      this.fsOps.mkdirSync(dir, { recursive: true });
    }

    const tempPath = `${this.filePath}.tmp`;
    const serialized = JSON.stringify(doc, null, 2);

    this.fsOps.writeFileSync(tempPath, serialized, 'utf8');
    try {
      this.fsOps.renameSync(tempPath, this.filePath);
    } catch (err) {
      try {
        if (this.fsOps.existsSync(tempPath)) {
          this.fsOps.unlinkSync(tempPath);
        }
      } catch {
        // Ignore cleanup errors
      }
      throw err;
    }
  }
}
