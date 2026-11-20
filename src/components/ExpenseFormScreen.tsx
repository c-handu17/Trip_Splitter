import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Divide,
  Trash2,
} from 'lucide-react';
import type { DocumentStore } from '../store/types';
import { getTrip } from '../api/trips';
import { listParticipants } from '../api/participants';
import {
  createExpense,
  deleteExpense,
  getExpense,
  updateExpense,
} from '../api/expenses';
import {
  CURRENCY_META,
  formatCurrencyAmount,
  formatMinorToMajor,
  parseMajorToMinor,
} from '../money/currency';
import { calculateEqualFill } from '../money/equalFill';
import { TopBar } from './TopBar';

interface ExpenseFormScreenProps {
  store: DocumentStore;
  tripId: number;
  expenseId?: number;
  onNavigate: (path: string) => void;
}

function getTodayIsoDate(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function ExpenseFormScreen({
  store,
  tripId,
  expenseId,
  onNavigate,
}: ExpenseFormScreenProps) {
  const isEditMode = expenseId !== undefined;

  const tripRes = getTrip(store, tripId);
  const participantsRes = listParticipants(store, tripId);
  const existingExpenseRes = isEditMode
    ? getExpense(store, tripId, expenseId)
    : null;

  const trip = tripRes.ok ? tripRes.data : null;
  const participants = participantsRes.ok ? participantsRes.data.participants : [];
  const existingExpense =
    existingExpenseRes && existingExpenseRes.ok ? existingExpenseRes.data : null;

  const [description, setDescription] = useState<string>(
    existingExpense ? existingExpense.description : ''
  );
  const [amountInput, setAmountInput] = useState<string>(
    existingExpense ? formatMinorToMajor(existingExpense.amountMinor) : ''
  );
  const [expenseDate, setExpenseDate] = useState<string>(
    existingExpense ? existingExpense.expenseDate : getTodayIsoDate()
  );
  const [paidByParticipantId, setPaidByParticipantId] = useState<number>(
    existingExpense
      ? existingExpense.paidBy.id
      : participants[0]?.id ?? 0
  );
  const [note, setNote] = useState<string>(existingExpense?.note ?? '');

  // Track which participants are included in shares and their major-unit input strings
  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    if (existingExpense) {
      return existingExpense.shares.map((s) => s.participantId);
    }
    return participants.map((p) => p.id);
  });

  const [shareInputs, setShareInputs] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    if (existingExpense) {
      for (const s of existingExpense.shares) {
        initial[s.participantId] = formatMinorToMajor(s.amountMinor);
      }
    }
    return initial;
  });

  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Live allocation math for immediate organizer feedback
  const liveTotals = useMemo(() => {
    const parsedTotal = parseMajorToMinor(amountInput);
    const totalMinor = parsedTotal.ok ? parsedTotal.amountMinor : null;

    let assignedMinor = 0;
    let hasInvalidShare = false;

    for (const pid of selectedIds) {
      const raw = shareInputs[pid] ?? '';
      if (!raw.trim()) {
        hasInvalidShare = true;
        continue;
      }
      const parsedShare = parseMajorToMinor(raw);
      if (parsedShare.ok) {
        assignedMinor += parsedShare.amountMinor;
      } else {
        hasInvalidShare = true;
      }
    }

    return {
      totalMinor,
      assignedMinor,
      hasInvalidShare,
      diffMinor: totalMinor !== null ? totalMinor - assignedMinor : null,
    };
  }, [amountInput, selectedIds, shareInputs]);

  if (!trip || (isEditMode && !existingExpense)) {
    return (
      <div className="min-h-screen bg-[#F6F7F5] text-[#141715]">
        <TopBar
          onNavigate={onNavigate}
          navLinks={[{ label: 'All Trips', href: '/' }]}
          backTo={{ label: 'Back', href: trip ? `/trips/${trip.id}` : '/' }}
        />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="text-xl font-bold text-[#141715]">
            {!trip ? 'Trip not found' : 'Expense not found'}
          </h1>
          <p className="mt-2 text-sm text-[#525A54]">
            The requested record could not be found on this trip.
          </p>
          <button
            type="button"
            onClick={() => onNavigate(trip ? `/trips/${trip.id}` : '/')}
            className="mt-6 min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-xl cursor-pointer"
          >
            {trip ? `Back to ${trip.name}` : 'Back to All Trips'}
          </button>
        </main>
      </div>
    );
  }

  const currencyMeta = CURRENCY_META[trip.currency];

  const toggleParticipant = (pid: number) => {
    setError(null);
    if (selectedSet.has(pid)) {
      setSelectedIds((prev) => prev.filter((id) => id !== pid));
    } else {
      // Keep participants in canonical trip order for predictable equal-fill remainder assignment
      const nextSet = new Set(selectedIds);
      nextSet.add(pid);
      setSelectedIds(
        participants.filter((p) => nextSet.has(p.id)).map((p) => p.id)
      );
    }
  };

  const handleSelectAll = () => {
    setError(null);
    setSelectedIds(participants.map((p) => p.id));
  };

  const handleClearSelection = () => {
    setError(null);
    setSelectedIds([]);
  };

  const handleEqualFill = () => {
    setError(null);
    const parsedTotal = parseMajorToMinor(amountInput);
    if (!parsedTotal.ok) {
      setError(parsedTotal.message);
      return;
    }

    const fillRes = calculateEqualFill(parsedTotal.amountMinor, selectedIds);
    if (!fillRes.ok) {
      setError(fillRes.message);
      return;
    }

    setShareInputs((prev) => {
      const next = { ...prev };
      for (const share of fillRes.shares) {
        next[share.participantId] = formatMinorToMajor(share.amountMinor);
      }
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedTotal = parseMajorToMinor(amountInput);
    if (!parsedTotal.ok) {
      setError(parsedTotal.message);
      return;
    }

    if (selectedIds.length === 0) {
      setError('Select at least one participant to share this expense.');
      return;
    }

    const shares: { participantId: number; amountMinor: number }[] = [];
    for (const pid of selectedIds) {
      const person = participants.find((p) => p.id === pid);
      const raw = shareInputs[pid] ?? '';
      const parsedShare = parseMajorToMinor(raw);
      if (!parsedShare.ok) {
        setError(
          `Enter a valid positive share amount for ${person?.name ?? 'selected participant'}.`
        );
        return;
      }
      shares.push({
        participantId: pid,
        amountMinor: parsedShare.amountMinor,
      });
    }

    const payload = {
      expenseDate,
      description,
      amountMinor: parsedTotal.amountMinor,
      paidByParticipantId,
      note: note.trim() === '' ? null : note,
      shares,
    };

    const res = isEditMode
      ? updateExpense(store, trip.id, expenseId, payload)
      : createExpense(store, trip.id, payload);

    if (!res.ok) {
      setError(res.body.error.message);
      return;
    }

    onNavigate(`/trips/${trip.id}`);
  };

  const handleDelete = () => {
    if (!isEditMode) return;
    const res = deleteExpense(store, trip.id, expenseId);
    if (!res.ok) {
      setError(res.body.error.message);
      return;
    }
    onNavigate(`/trips/${trip.id}`);
  };

  return (
    <div className="min-h-screen bg-[#F6F7F5] text-[#141715] pb-12">
      <TopBar
        onNavigate={onNavigate}
        backTo={{ label: `Back to ${trip.name}`, href: `/trips/${trip.id}` }}
        navLinks={[
          { label: 'All Trips', href: '/' },
          { label: trip.name, href: `/trips/${trip.id}` },
          { label: 'Settle', href: `/trips/${trip.id}/settle` },
        ]}
        primaryAction={{
          label: 'Back to Trip',
          onClick: () => onNavigate(`/trips/${trip.id}`),
          variant: 'secondary',
        }}
      />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-7 sm:py-9">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141715]">
              {isEditMode ? 'Edit Expense' : 'New Expense'}
            </h1>
            <p className="mt-1 text-sm text-[#525A54]">
              {trip.name} · Currency in{' '}
              <span className="font-mono font-medium text-[#141715]">
                {trip.currency} ({currencyMeta.symbol})
              </span>
            </p>
          </div>

          {isEditMode ? (
            <div className="shrink-0">
              {confirmingDelete ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="min-h-[40px] px-3.5 py-2 text-xs font-semibold text-white bg-[#B91C1C] hover:bg-[#991B1B] rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    Confirm Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="min-h-[40px] px-3 py-2 text-xs font-medium text-[#525A54] hover:bg-[#EAECE8] rounded-xl cursor-pointer whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="min-h-[40px] px-3.5 py-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#B91C1C] bg-white border border-[#FECACA] hover:bg-[#FEF2F2] rounded-xl transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  Delete Expense
                </button>
              )}
            </div>
          ) : null}
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-6">
          {/* Core Expense Facts */}
          <section
            aria-label="Expense details"
            className="bg-white border border-[#E2E5DF] rounded-2xl p-5 sm:p-6 space-y-5"
          >
            <div>
              <label
                htmlFor="expense-description"
                className="block text-sm font-medium text-[#2A302C] mb-1.5"
              >
                Description
              </label>
              <input
                id="expense-description"
                name="description"
                type="text"
                maxLength={120}
                placeholder="e.g. Sunset Dinner at Thalassa"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[#F6F7F5] border border-[#D8DCD5] rounded-xl text-[#141715] placeholder:text-[#8A928C] focus:bg-white focus:border-[#14532D] focus:outline-none focus:ring-2 focus:ring-[#14532D]/15"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="expense-amount"
                  className="block text-sm font-medium text-[#2A302C] mb-1.5"
                >
                  Amount ({trip.currency})
                </label>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-sm font-medium text-[#525A54]"
                  >
                    {currencyMeta.symbol}
                  </span>
                  <input
                    id="expense-amount"
                    name="amount"
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="w-full min-h-[44px] pl-8 pr-3.5 py-2.5 text-sm font-mono tabular-nums bg-[#F6F7F5] border border-[#D8DCD5] rounded-xl text-[#141715] placeholder:text-[#8A928C] focus:bg-white focus:border-[#14532D] focus:outline-none focus:ring-2 focus:ring-[#14532D]/15"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="expense-date"
                  className="block text-sm font-medium text-[#2A302C] mb-1.5"
                >
                  Date
                </label>
                <input
                  id="expense-date"
                  name="expenseDate"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 text-sm font-mono bg-[#F6F7F5] border border-[#D8DCD5] rounded-xl text-[#141715] focus:bg-white focus:border-[#14532D] focus:outline-none focus:ring-2 focus:ring-[#14532D]/15"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="expense-payer"
                className="block text-sm font-medium text-[#2A302C] mb-1.5"
              >
                Paid by
              </label>
              <select
                id="expense-payer"
                name="paidByParticipantId"
                value={paidByParticipantId}
                onChange={(e) => setPaidByParticipantId(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[#F6F7F5] border border-[#D8DCD5] rounded-xl text-[#141715] focus:bg-white focus:border-[#14532D] focus:outline-none focus:ring-2 focus:ring-[#14532D]/15"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.isOrganizer ? ' (Organizer)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="expense-note"
                  className="block text-sm font-medium text-[#2A302C]"
                >
                  Note (optional)
                </label>
                <span className="text-xs text-[#6E7771] tabular-nums">
                  {note.length}/200
                </span>
              </div>
              <input
                id="expense-note"
                name="note"
                type="text"
                maxLength={200}
                placeholder="e.g. Dinner included tip"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[#F6F7F5] border border-[#D8DCD5] rounded-xl text-[#141715] placeholder:text-[#8A928C] focus:bg-white focus:border-[#14532D] focus:outline-none focus:ring-2 focus:ring-[#14532D]/15"
              />
            </div>
          </section>

          {/* Custom Shares Section */}
          <section
            aria-labelledby="shares-heading"
            className="bg-white border border-[#E2E5DF] rounded-2xl p-5 sm:p-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2
                  id="shares-heading"
                  className="text-base font-semibold text-[#141715]"
                >
                  Who shares this expense?
                </h2>
                <p className="mt-0.5 text-xs text-[#525A54]">
                  Select only the friends included. The payer can be excluded if they did not share this cost.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="min-h-[38px] px-3 text-xs font-medium text-[#3E4540] bg-[#EEF0EC] hover:bg-[#E2E5DF] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="min-h-[38px] px-3 text-xs font-medium text-[#3E4540] bg-[#EEF0EC] hover:bg-[#E2E5DF] rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleEqualFill}
                  className="min-h-[38px] px-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-[#14532D] bg-[#14532D]/10 hover:bg-[#14532D]/15 rounded-lg transition-colors whitespace-nowrap cursor-pointer"
                >
                  <Divide className="w-3.5 h-3.5" aria-hidden="true" />
                  Fill Equally
                </button>
              </div>
            </div>

            <ul className="divide-y divide-[#ECEEE9] border-t border-b border-[#ECEEE9]">
              {participants.map((p) => {
                const included = selectedSet.has(p.id);
                const isPayer = p.id === paidByParticipantId;

                return (
                  <li
                    key={p.id}
                    className="py-3 min-h-[60px] flex items-center justify-between gap-4"
                  >
                    <label
                      htmlFor={`share-toggle-${p.id}`}
                      className="flex items-center gap-3 min-w-0 flex-1 min-h-[44px] cursor-pointer"
                    >
                      <input
                        id={`share-toggle-${p.id}`}
                        type="checkbox"
                        checked={included}
                        onChange={() => toggleParticipant(p.id)}
                        className="w-5 h-5 rounded border-[#C5CBC1] accent-[#14532D] cursor-pointer shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="text-sm font-semibold text-[#141715] block truncate">
                          {p.name}
                        </span>
                        <span className="text-xs text-[#6E7771]">
                          {isPayer ? 'Paid this expense' : 'Participant'}
                        </span>
                      </div>
                    </label>

                    <div className="w-36 sm:w-44 shrink-0">
                      {included ? (
                        <div className="relative">
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-xs text-[#525A54]"
                          >
                            {currencyMeta.symbol}
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            aria-label={`Share amount for ${p.name}`}
                            placeholder="0.00"
                            value={shareInputs[p.id] ?? ''}
                            onChange={(e) => {
                              setError(null);
                              setShareInputs((prev) => ({
                                ...prev,
                                [p.id]: e.target.value,
                              }));
                            }}
                            className="w-full min-h-[42px] pl-7 pr-3 py-2 text-sm font-mono tabular-nums text-right bg-[#F6F7F5] border border-[#D8DCD5] rounded-xl text-[#141715] focus:bg-white focus:border-[#14532D] focus:outline-none focus:ring-2 focus:ring-[#14532D]/15"
                          />
                        </div>
                      ) : (
                        <div className="text-right text-xs text-[#8A928C] pr-2">
                          Not included
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Live sum feedback */}
            <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm">
              <div className="text-[#525A54]">
                Assigned:{' '}
                <span className="font-mono font-semibold tabular-nums text-[#141715]">
                  {formatCurrencyAmount(liveTotals.assignedMinor, trip.currency)}
                </span>
                {liveTotals.totalMinor !== null ? (
                  <>
                    {' '}
                    of{' '}
                    <span className="font-mono font-semibold tabular-nums text-[#141715]">
                      {formatCurrencyAmount(liveTotals.totalMinor, trip.currency)}
                    </span>
                  </>
                ) : null}
              </div>

              {liveTotals.totalMinor !== null ? (
                liveTotals.diffMinor === 0 && !liveTotals.hasInvalidShare && selectedIds.length > 0 ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#14532D]">
                    <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                    Shares match expense total
                  </div>
                ) : liveTotals.diffMinor !== null && liveTotals.diffMinor > 0 ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#9A3412]">
                    <AlertCircle className="w-4 h-4" aria-hidden="true" />
                    {formatCurrencyAmount(liveTotals.diffMinor, trip.currency)} remaining to assign
                  </div>
                ) : liveTotals.diffMinor !== null && liveTotals.diffMinor < 0 ? (
                  <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B91C1C]">
                    <AlertCircle className="w-4 h-4" aria-hidden="true" />
                    {formatCurrencyAmount(Math.abs(liveTotals.diffMinor), trip.currency)} over expense total
                  </div>
                ) : null
              ) : null}
            </div>
          </section>

          {error ? (
            <div
              role="alert"
              className="px-4 py-3 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm font-medium text-[#B91C1C]"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => onNavigate(`/trips/${trip.id}`)}
              className="min-h-[46px] px-5 py-2.5 text-sm font-medium text-[#3E4540] bg-white border border-[#D8DCD5] hover:bg-[#F1F3EF] rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[46px] px-6 py-2.5 text-sm font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] active:scale-[0.99] rounded-xl transition-all cursor-pointer"
            >
              {isEditMode ? 'Save Changes' : 'Save Expense'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
