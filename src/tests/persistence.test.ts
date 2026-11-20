import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { NodeFileStore } from '../store/nodeFileStore';
import { createTrip } from '../api/trips';
import { addParticipant } from '../api/participants';
import { createExpense, getExpense } from '../api/expenses';

function makeTempFilePath(): { dir: string; filePath: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'trip-split-test-'));
  return { dir, filePath: path.join(dir, 'trip-split.json') };
}

test('missing file becomes an empty document with nextId 1 and no trips', () => {
  const { dir, filePath } = makeTempFilePath();
  try {
    const store = new NodeFileStore(filePath);
    const doc = store.readDocument();
    assert.deepEqual(doc, { nextId: 1, trips: [] });
    assert.equal(fs.existsSync(filePath), true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a saved document is returned unchanged by the next read', () => {
  const { dir, filePath } = makeTempFilePath();
  try {
    const store = new NodeFileStore(filePath);
    const created = createTrip(store, {
      name: 'Goa',
      currency: 'INR',
      organizerName: 'Asha',
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const friend = addParticipant(store, created.data.trip.id, { name: 'Ben' });
    assert.equal(friend.ok, true);
    if (!friend.ok) return;

    const exp = createExpense(store, created.data.trip.id, {
      expenseDate: '2026-11-20',
      description: 'Dinner',
      amountMinor: 180000,
      paidByParticipantId: created.data.organizer.id,
      note: 'Tip included',
      shares: [
        { participantId: created.data.organizer.id, amountMinor: 80000 },
        { participantId: friend.data.id, amountMinor: 100000 },
      ],
    });
    assert.equal(exp.ok, true);
    if (!exp.ok) return;

    // Fresh store instance reading same file
    const reopened = new NodeFileStore(filePath);
    const fetched = getExpense(reopened, created.data.trip.id, exp.data.id);
    assert.equal(fetched.ok, true);
    if (!fetched.ok) return;
    assert.equal(fetched.data.description, 'Dinner');
    assert.equal(fetched.data.amountMinor, 180000);
    assert.equal(fetched.data.note, 'Tip included');
    assert.equal(fetched.data.shares.length, 2);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a failed replace leaves the previous file bytes unchanged', () => {
  const { dir, filePath } = makeTempFilePath();
  try {
    const store = new NodeFileStore(filePath);
    createTrip(store, {
      name: 'Goa',
      currency: 'INR',
      organizerName: 'Asha',
    });
    const beforeBytes = fs.readFileSync(filePath, 'utf8');

    const failingStore = new NodeFileStore(filePath, {
      existsSync: fs.existsSync,
      mkdirSync: fs.mkdirSync,
      readFileSync: fs.readFileSync,
      writeFileSync: fs.writeFileSync,
      unlinkSync: fs.unlinkSync,
      renameSync: () => {
        throw new Error('Simulated disk replace failure');
      },
    });

    assert.throws(() => {
      failingStore.writeDocument({ nextId: 99, trips: [] });
    }, /Simulated disk replace failure/);

    const afterBytes = fs.readFileSync(filePath, 'utf8');
    assert.equal(afterBytes, beforeBytes);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a rejected expense does not change the file bytes', () => {
  const { dir, filePath } = makeTempFilePath();
  try {
    const store = new NodeFileStore(filePath);
    const created = createTrip(store, {
      name: 'Goa',
      currency: 'INR',
      organizerName: 'Asha',
    });
    assert.equal(created.ok, true);
    if (!created.ok) return;

    const beforeBytes = fs.readFileSync(filePath, 'utf8');

    const rejected = createExpense(store, created.data.trip.id, {
      expenseDate: '2026-11-20',
      description: 'Bad split',
      amountMinor: 1000,
      paidByParticipantId: created.data.organizer.id,
      shares: [{ participantId: created.data.organizer.id, amountMinor: 900 }],
    });
    assert.equal(rejected.ok, false);
    if (rejected.ok) return;
    assert.equal(rejected.body.error.code, 'validation_error');

    const afterBytes = fs.readFileSync(filePath, 'utf8');
    assert.equal(afterBytes, beforeBytes);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
