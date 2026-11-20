import React, { useState } from 'react';
import {
  ChevronRight,
  Pencil,
  Trash2,
  UserPlus,
  Receipt,
  Scale,
  Check,
  X,
  Plus,
} from 'lucide-react';
import type { CurrencyCode, DocumentStore } from '../store/types';
import { getTrip, updateTrip, type TripSummaryDto } from '../api/trips';
import {
  addParticipant,
  deleteParticipant,
  listParticipants,
  updateParticipant,
  type ParticipantDto,
} from '../api/participants';
import { listExpenses, type ExpenseDto } from '../api/expenses';
import {
  CURRENCY_META,
  SUPPORTED_CURRENCIES,
  formatCurrencyAmount,
} from '../money/currency';
import { TopBar } from './TopBar';

interface TripHomeScreenProps {
  store: DocumentStore;
  tripId: number;
  onNavigate: (path: string) => void;
}

function formatReadableDate(isoDate: string): string {
  const parts = isoDate.split('-').map(Number);
  if (parts.length !== 3 || parts.some(Number.isNaN)) return isoDate;
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function TripHomeScreen({
  store,
  tripId,
  onNavigate,
}: TripHomeScreenProps) {
  const loadState = () => {
    const tRes = getTrip(store, tripId);
    const pRes = listParticipants(store, tripId);
    const eRes = listExpenses(store, tripId);
    return {
      trip: tRes.ok ? tRes.data : null,
      participants: pRes.ok ? pRes.data.participants : [],
      expenses: eRes.ok ? eRes.data.expenses : [],
    };
  };

  const initial = loadState();
  const [trip, setTrip] = useState<TripSummaryDto | null>(initial.trip);
  const [participants, setParticipants] = useState<ParticipantDto[]>(
    initial.participants
  );
  const [expenses, setExpenses] = useState<ExpenseDto[]>(initial.expenses);

  // Edit trip state
  const [editingTrip, setEditingTrip] = useState(false);
  const [editTripName, setEditTripName] = useState(initial.trip?.name ?? '');
  const [editTripCurrency, setEditTripCurrency] = useState<CurrencyCode>(
    initial.trip?.currency ?? 'INR'
  );
  const [tripError, setTripError] = useState<string | null>(null);

  // Add participant state
  const [newFriendName, setNewFriendName] = useState('');
  const [participantError, setParticipantError] = useState<string | null>(null);

  // Inline rename participant state
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const refresh = () => {
    const next = loadState();
    setTrip(next.trip);
    setParticipants(next.participants);
    setExpenses(next.expenses);
  };

  if (!trip) {
    return (
      <div className="min-h-screen bg-[#F6F7F5] text-[#141715]">
        <TopBar
          onNavigate={onNavigate}
          navLinks={[{ label: 'All Trips', href: '/' }]}
          backTo={{ label: 'Back to all trips', href: '/' }}
        />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="text-xl font-bold text-[#141715]">Trip not found</h1>
          <p className="mt-2 text-sm text-[#525A54]">
            This trip does not exist on this device.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="mt-6 min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-xl cursor-pointer"
          >
            Back to All Trips
          </button>
        </main>
      </div>
    );
  }

  const canChangeCurrency = trip.expenseCount === 0;
  const totalTripSpendMinor = expenses.reduce((sum, e) => sum + e.amountMinor, 0);

  const openEditTrip = () => {
    setEditTripName(trip.name);
    setEditTripCurrency(trip.currency);
    setTripError(null);
    setEditingTrip(true);
  };

  const handleSaveTripSettings = (e: React.FormEvent) => {
    e.preventDefault();
    setTripError(null);

    const payload: { name: string; currency?: CurrencyCode } = {
      name: editTripName,
    };
    if (canChangeCurrency) {
      payload.currency = editTripCurrency;
    }

    const res = updateTrip(store, trip.id, payload);
    if (!res.ok) {
      setTripError(res.body.error.message);
      return;
    }

    setEditingTrip(false);
    refresh();
  };

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    setParticipantError(null);

    const res = addParticipant(store, trip.id, { name: newFriendName });
    if (!res.ok) {
      setParticipantError(res.body.error.message);
      return;
    }

    setNewFriendName('');
    refresh();
  };

  const startRename = (p: ParticipantDto) => {
    setParticipantError(null);
    setRenamingId(p.id);
    setRenameValue(p.name);
  };

  const commitRename = (participantId: number) => {
    setParticipantError(null);
    const res = updateParticipant(store, trip.id, participantId, {
      name: renameValue,
    });
    if (!res.ok) {
      setParticipantError(res.body.error.message);
      return;
    }
    setRenamingId(null);
    setRenameValue('');
    refresh();
  };

  const handleRemoveParticipant = (p: ParticipantDto) => {
    setParticipantError(null);
    const res = deleteParticipant(store, trip.id, p.id);
    if (!res.ok) {
      setParticipantError(res.body.error.message);
      return;
    }
    refresh();
  };

  const personCountLabel =
    trip.participantCount === 1 ? '1 person' : `${trip.participantCount} people`;
  const expenseCountLabel =
    trip.expenseCount === 1 ? '1 expense' : `${trip.expenseCount} expenses`;

  return (
    <div className="min-h-screen bg-[#F6F7F5] text-[#141715] pb-24 lg:pb-12">
      <TopBar
        onNavigate={onNavigate}
        backTo={{ label: 'Back to all trips', href: '/' }}
        navLinks={[
          { label: 'All Trips', href: '/' },
          { label: trip.name, href: `/trips/${trip.id}`, active: true },
          { label: 'Settle', href: `/trips/${trip.id}/settle` },
        ]}
        primaryAction={{
          label: 'Add Expense',
          onClick: () => onNavigate(`/trips/${trip.id}/expense/new`),
          responsiveClass: 'hidden sm:inline-flex',
        }}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-7 sm:py-9">
        {/* Trip Header & Rename / Conditional Currency Controls */}
        <section aria-label="Trip overview" className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141715] text-balance">
                  {trip.name}
                </h1>
                {!editingTrip ? (
                  <button
                    type="button"
                    onClick={openEditTrip}
                    aria-label="Edit trip settings"
                    className="min-h-[36px] px-2.5 py-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-[#525A54] hover:text-[#141715] hover:bg-[#EAECE8] rounded-lg transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
                  >
                    <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                    Edit Trip
                  </button>
                ) : null}
              </div>

              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-[#525A54]">
                <span className="font-mono font-medium text-[#141715]">
                  {trip.currency} ({CURRENCY_META[trip.currency].symbol})
                </span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{personCountLabel}</span>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{expenseCountLabel}</span>
                {expenses.length > 0 ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[#2A302C]">
                      Total {formatCurrencyAmount(totalTripSpendMinor, trip.currency)}
                    </span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onNavigate(`/trips/${trip.id}/settle`)}
                className="min-h-[44px] px-4 py-2 inline-flex items-center gap-2 text-sm font-semibold text-[#141715] bg-white border border-[#D8DCD5] hover:bg-[#F1F3EF] rounded-xl transition-colors whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
              >
                <Scale className="w-4 h-4 text-[#14532D]" aria-hidden="true" />
                Settle Trip
              </button>
            </div>
          </div>

          {editingTrip ? (
            <form
              onSubmit={handleSaveTripSettings}
              noValidate
              className="mt-5 bg-white border border-[#E2E5DF] rounded-2xl p-5 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="edit-trip-name"
                    className="block text-sm font-medium text-[#2A302C] mb-1.5"
                  >
                    Trip name
                  </label>
                  <input
                    id="edit-trip-name"
                    type="text"
                    maxLength={60}
                    value={editTripName}
                    onChange={(e) => setEditTripName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-[#F6F7F5] border border-[#D8DCD5] rounded-xl text-[#141715] focus:bg-white focus:border-[#14532D] focus:outline-none focus:ring-2 focus:ring-[#14532D]/15"
                  />
                </div>

                <div>
                  <span
                    id="edit-currency-label"
                    className="block text-sm font-medium text-[#2A302C] mb-1.5"
                  >
                    Currency
                  </span>
                  {canChangeCurrency ? (
                    <div
                      role="radiogroup"
                      aria-labelledby="edit-currency-label"
                      className="grid grid-cols-4 gap-2"
                    >
                      {SUPPORTED_CURRENCIES.map((code) => {
                        const selected = editTripCurrency === code;
                        return (
                          <button
                            key={code}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={() => setEditTripCurrency(code)}
                            className={`min-h-[44px] px-2 rounded-xl border text-xs font-mono font-medium transition-colors cursor-pointer ${
                              selected
                                ? 'bg-[#14532D] text-white border-[#14532D]'
                                : 'bg-[#F6F7F5] text-[#2A302C] border-[#D8DCD5] hover:bg-[#ECEEE9]'
                            }`}
                          >
                            {CURRENCY_META[code].symbol} {code}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p
                      data-testid="currency-locked-note"
                      className="min-h-[44px] px-3.5 py-2.5 text-sm text-[#525A54] bg-[#F6F7F5] border border-[#E2E5DF] rounded-xl flex items-center"
                    >
                      {trip.currency} — locked once expenses are recorded
                    </p>
                  )}
                </div>
              </div>

              {tripError ? (
                <div
                  role="alert"
                  className="px-3.5 py-2.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#B91C1C]"
                >
                  {tripError}
                </div>
              ) : null}

              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  className="min-h-[42px] px-4 py-2 text-sm font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-xl transition-colors cursor-pointer"
                >
                  Save Trip
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingTrip(false);
                    setTripError(null);
                  }}
                  className="min-h-[42px] px-4 py-2 text-sm font-medium text-[#525A54] hover:text-[#141715] hover:bg-[#EEF0EC] rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </section>

        {/* Two-column desktop layout: Left = Expenses Ledger, Right = People */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Expenses Section */}
          <section aria-labelledby="expenses-heading" className="lg:col-span-7">
            <div className="flex items-center justify-between gap-4 mb-3">
              <h2
                id="expenses-heading"
                className="text-sm font-semibold text-[#3E4540]"
              >
                Expenses ({expenses.length})
              </h2>
            </div>

            {expenses.length === 0 ? (
              <div className="bg-white border border-[#E2E5DF] rounded-2xl p-8 text-center">
                <div className="w-11 h-11 rounded-full bg-[#EEF0EC] text-[#525A54] mx-auto flex items-center justify-center mb-4">
                  <Receipt className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-[#141715]">
                  No expenses recorded yet
                </h3>
                <p className="mt-1 text-sm text-[#525A54] max-w-sm mx-auto">
                  Add friends on this trip first, then log who paid and how each cost is split.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate(`/trips/${trip.id}/expense/new`)}
                  className="mt-5 min-h-[44px] px-5 py-2.5 text-sm font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-xl transition-colors cursor-pointer"
                >
                  Record First Expense
                </button>
              </div>
            ) : (
              <ul
                data-testid="expense-list"
                className="bg-white border border-[#E2E5DF] rounded-2xl divide-y divide-[#ECEEE9] overflow-hidden"
              >
                {expenses.map((expense) => {
                  const isPartial = expense.shares.length < participants.length;
                  const splitLabel = isPartial
                    ? `Shared by ${expense.shares.map((s) => s.name).join(', ')}`
                    : `Shared by all ${expense.shares.length}`;

                  return (
                    <li key={expense.id}>
                      <a
                        href={`/trips/${trip.id}/expense/${expense.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate(`/trips/${trip.id}/expense/${expense.id}`);
                        }}
                        className="group w-full min-h-[72px] px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#F9FAF8] active:bg-[#F1F3EF] transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#14532D]"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-semibold text-[#141715] group-hover:text-[#14532D] transition-colors truncate">
                            {expense.description}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs sm:text-sm text-[#525A54]">
                            <span>{formatReadableDate(expense.expenseDate)}</span>
                            <span aria-hidden="true">·</span>
                            <span>Paid by {expense.paidBy.name}</span>
                          </div>
                          <div className="mt-0.5 text-xs text-[#6E7771] truncate">
                            {splitLabel}
                            {expense.note ? ` · ${expense.note}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="font-mono font-semibold text-sm sm:text-base tabular-nums text-[#141715]">
                            {formatCurrencyAmount(expense.amountMinor, expense.currency)}
                          </span>
                          <ChevronRight
                            className="w-4 h-4 text-[#8A928C] group-hover:text-[#14532D] transition-colors"
                            aria-hidden="true"
                          />
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* People Section */}
          <section aria-labelledby="people-heading" className="lg:col-span-5">
            <div className="flex items-center justify-between mb-3">
              <h2
                id="people-heading"
                className="text-sm font-semibold text-[#3E4540]"
              >
                People on This Trip ({participants.length})
              </h2>
            </div>

            <div className="bg-white border border-[#E2E5DF] rounded-2xl overflow-hidden">
              <ul
                data-testid="participant-list"
                className="divide-y divide-[#ECEEE9]"
              >
                {participants.map((p) => {
                  const isRenaming = renamingId === p.id;

                  return (
                    <li
                      key={p.id}
                      className="px-4 py-2.5 min-h-[60px] flex items-center justify-between gap-2"
                    >
                      {isRenaming ? (
                        <div className="flex items-center gap-2 w-full">
                          <label
                            htmlFor={`rename-input-${p.id}`}
                            className="sr-only"
                          >
                            New name for {p.name}
                          </label>
                          <input
                            id={`rename-input-${p.id}`}
                            type="text"
                            maxLength={40}
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                commitRename(p.id);
                              } else if (e.key === 'Escape') {
                                setRenamingId(null);
                              }
                            }}
                            autoFocus
                            className="flex-1 min-w-0 min-h-[40px] px-3 text-sm bg-[#F6F7F5] border border-[#14532D] rounded-lg focus:outline-none"
                          />
                          <button
                            type="button"
                            aria-label={`Save name for ${p.name}`}
                            onClick={() => commitRename(p.id)}
                            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg bg-[#14532D] text-white hover:bg-[#0F3F22] cursor-pointer"
                          >
                            <Check className="w-4 h-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            aria-label="Cancel rename"
                            onClick={() => setRenamingId(null)}
                            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-[#525A54] hover:bg-[#EEF0EC] cursor-pointer"
                          >
                            <X className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <a
                            href={`/trips/${trip.id}/people/${p.id}`}
                            onClick={(e) => {
                              e.preventDefault();
                              onNavigate(`/trips/${trip.id}/people/${p.id}`);
                            }}
                            aria-label={`View ${p.name}'s expenses`}
                            className="group flex-1 min-w-0 min-h-[44px] flex items-center justify-between gap-2 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
                          >
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-[#141715] group-hover:text-[#14532D] transition-colors truncate">
                                {p.name}
                              </div>
                              <div className="text-xs text-[#6E7771] flex items-center gap-1.5">
                                {p.isOrganizer ? <span>Organizer</span> : <span>Participant</span>}
                                <span aria-hidden="true">·</span>
                                <span className="group-hover:text-[#14532D] transition-colors">
                                  View summary
                                </span>
                              </div>
                            </div>
                            <ChevronRight
                              className="w-4 h-4 text-[#8A928C] group-hover:text-[#14532D] shrink-0"
                              aria-hidden="true"
                            />
                          </a>

                          {!p.isUsed ? (
                            <div className="flex items-center gap-0.5 shrink-0 pl-1 border-l border-[#ECEEE9]">
                              <button
                                type="button"
                                aria-label={`Rename ${p.name}`}
                                onClick={() => startRename(p)}
                                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#525A54] hover:text-[#141715] hover:bg-[#EEF0EC] transition-colors cursor-pointer"
                              >
                                <Pencil className="w-4 h-4" aria-hidden="true" />
                              </button>

                              {!p.isOrganizer ? (
                                <button
                                  type="button"
                                  aria-label={`Remove ${p.name}`}
                                  onClick={() => handleRemoveParticipant(p)}
                                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#525A54] hover:text-[#B91C1C] hover:bg-[#FEF2F2] transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" aria-hidden="true" />
                                </button>
                              ) : null}
                            </div>
                          ) : null}
                        </>
                      )}
                    </li>
                  );
                })}
              </ul>

              {/* Add Friend Form */}
              <div className="p-4 bg-[#FAFBFA] border-t border-[#ECEEE9]">
                <form onSubmit={handleAddFriend} noValidate>
                  <label
                    htmlFor="add-friend-name"
                    className="block text-xs font-semibold text-[#3E4540] mb-1.5"
                  >
                    Add a friend to {trip.name}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="add-friend-name"
                      type="text"
                      maxLength={40}
                      placeholder="Friend's name"
                      value={newFriendName}
                      onChange={(e) => setNewFriendName(e.target.value)}
                      className="flex-1 min-w-0 min-h-[44px] px-3.5 py-2 text-sm bg-white border border-[#D8DCD5] rounded-xl text-[#141715] placeholder:text-[#8A928C] focus:border-[#14532D] focus:outline-none focus:ring-2 focus:ring-[#14532D]/15"
                    />
                    <button
                      type="submit"
                      className="min-h-[44px] px-4 py-2 inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" aria-hidden="true" />
                      Add
                    </button>
                  </div>

                  {participantError ? (
                    <div
                      role="alert"
                      className="mt-2.5 px-3 py-2 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-xs text-[#B91C1C]"
                    >
                      {participantError}
                    </div>
                  ) : null}
                </form>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Mobile thumb-zone action bar (height 64px; combined sticky height 120px < 15% of 844px) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-30 h-16 px-4 bg-white/95 backdrop-blur-md border-t border-[#E2E5DF] flex items-center gap-3">
        <button
          type="button"
          onClick={() => onNavigate(`/trips/${trip.id}/expense/new`)}
          className="flex-1 min-h-[44px] px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#14532D] active:scale-[0.98] rounded-xl transition-transform cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          Add Expense
        </button>
        <button
          type="button"
          onClick={() => onNavigate(`/trips/${trip.id}/settle`)}
          className="flex-1 min-h-[44px] px-4 inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#141715] bg-[#EEF0EC] active:scale-[0.98] rounded-xl transition-transform cursor-pointer"
        >
          <Scale className="w-4 h-4 text-[#14532D]" aria-hidden="true" />
          Settle
        </button>
      </div>
    </div>
  );
}
