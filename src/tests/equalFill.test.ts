import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateEqualFill } from '../money/equalFill';

test('equal-fill splits evenly divisible amount', () => {
  const res = calculateEqualFill(1200, [10, 11, 12]);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.shares, [
    { participantId: 10, amountMinor: 400 },
    { participantId: 11, amountMinor: 400 },
    { participantId: 12, amountMinor: 400 },
  ]);
});

test('equal-fill gives extra minor units to the first selected participants and sums to total', () => {
  const res = calculateEqualFill(1000, [10, 11, 12]);
  assert.equal(res.ok, true);
  if (!res.ok) return;
  assert.deepEqual(res.shares, [
    { participantId: 10, amountMinor: 334 },
    { participantId: 11, amountMinor: 333 },
    { participantId: 12, amountMinor: 333 },
  ]);
  const sum = res.shares.reduce((acc, s) => acc + s.amountMinor, 0);
  assert.equal(sum, 1000);
  assert.equal(res.shares.every((s) => s.amountMinor > 0), true);

  const res2 = calculateEqualFill(1001, [10, 11, 12]);
  assert.equal(res2.ok, true);
  if (!res2.ok) return;
  assert.deepEqual(res2.shares, [
    { participantId: 10, amountMinor: 334 },
    { participantId: 11, amountMinor: 334 },
    { participantId: 12, amountMinor: 333 },
  ]);
});

test('equal-fill rejects empty selection or amount smaller than number of people', () => {
  const emptyRes = calculateEqualFill(1000, []);
  assert.equal(emptyRes.ok, false);

  const tooSmall = calculateEqualFill(2, [10, 11, 12]);
  assert.equal(tooSmall.ok, false);

  const exactMin = calculateEqualFill(3, [10, 11, 12]);
  assert.equal(exactMin.ok, true);
  if (!exactMin.ok) return;
  assert.deepEqual(exactMin.shares, [
    { participantId: 10, amountMinor: 1 },
    { participantId: 11, amountMinor: 1 },
    { participantId: 12, amountMinor: 1 },
  ]);
});
