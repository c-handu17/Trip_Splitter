import React from 'react';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, ChevronRight } from 'lucide-react';
import type { DocumentStore } from '../store/types';
import { getTrip } from '../api/trips';
import { getParticipantSummary } from '../api/people';
import { formatCurrencyAmount } from '../money/currency';
import { TopBar } from './TopBar';

interface PersonSummaryScreenProps {
  store: DocumentStore;
  tripId: number;
  participantId: number;
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

export function PersonSummaryScreen({
  store,
  tripId,
  participantId,
  onNavigate,
}: PersonSummaryScreenProps) {
  const tripRes = getTrip(store, tripId);
  const summaryRes = getParticipantSummary(store, tripId, participantId);

  const trip = tripRes.ok ? tripRes.data : null;
  const summary = summaryRes.ok ? summaryRes.data : null;

  if (!trip || !summary) {
    return (
      <div className="min-h-screen bg-[#F6F7F5] text-[#141715]">
        <TopBar
          onNavigate={onNavigate}
          navLinks={[{ label: 'All Trips', href: '/' }]}
          backTo={{ label: 'Back', href: trip ? `/trips/${trip.id}` : '/' }}
        />
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
          <h1 className="text-xl font-bold text-[#141715]">Participant not found</h1>
          <p className="mt-2 text-sm text-[#525A54]">
            This person does not exist on the selected trip.
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

  const netPositive = summary.netMinor > 0;
  const netNegative = summary.netMinor < 0;

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
          label: 'Settle Trip',
          onClick: () => onNavigate(`/trips/${trip.id}/settle`),
        }}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-7 sm:py-9">
        <div className="mb-7">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141715]">
            {summary.participant.name}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-[#525A54]">
            <span>{trip.name}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono font-medium text-[#2A302C]">
              {summary.currency}
            </span>
            {summary.participant.isOrganizer ? (
              <>
                <span aria-hidden="true">·</span>
                <span>Organizer</span>
              </>
            ) : null}
          </div>
        </div>

        {/* 3-Column Financial Summary Strip */}
        <section
          aria-label="Balance totals"
          className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8"
        >
          <div className="bg-white border border-[#E2E5DF] rounded-2xl p-5">
            <div className="text-xs font-medium text-[#525A54]">Total Paid</div>
            <div
              data-testid="person-total-paid"
              className="mt-2 text-2xl font-mono font-semibold tabular-nums text-[#141715]"
            >
              {formatCurrencyAmount(summary.totalPaidMinor, summary.currency)}
            </div>
            <div className="mt-1 text-xs text-[#6E7771]">
              Across {summary.paid.length}{' '}
              {summary.paid.length === 1 ? 'expense' : 'expenses'}
            </div>
          </div>

          <div className="bg-white border border-[#E2E5DF] rounded-2xl p-5">
            <div className="text-xs font-medium text-[#525A54]">Total Assigned</div>
            <div
              data-testid="person-total-assigned"
              className="mt-2 text-2xl font-mono font-semibold tabular-nums text-[#141715]"
            >
              {formatCurrencyAmount(summary.totalAssignedMinor, summary.currency)}
            </div>
            <div className="mt-1 text-xs text-[#6E7771]">
              Across {summary.assigned.length}{' '}
              {summary.assigned.length === 1 ? 'share' : 'shares'}
            </div>
          </div>

          <div className="bg-white border border-[#E2E5DF] rounded-2xl p-5">
            <div className="text-xs font-medium text-[#525A54]">
              Net Balance (Paid − Assigned)
            </div>
            <div
              data-testid="person-net-balance"
              className={`mt-2 text-2xl font-mono font-semibold tabular-nums ${
                netPositive
                  ? 'text-[#14532D]'
                  : netNegative
                    ? 'text-[#B91C1C]'
                    : 'text-[#141715]'
              }`}
            >
              {formatCurrencyAmount(summary.netMinor, summary.currency, {
                showSign: true,
              })}
            </div>
            <div
              data-testid="person-net-label"
              className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold ${
                netPositive
                  ? 'text-[#14532D]'
                  : netNegative
                    ? 'text-[#B91C1C]'
                    : 'text-[#525A54]'
              }`}
            >
              {netPositive ? (
                <>
                  <ArrowDownLeft className="w-3.5 h-3.5" aria-hidden="true" />
                  Owed to {summary.participant.name}
                </>
              ) : netNegative ? (
                <>
                  <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                  Owed by {summary.participant.name}
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                  All even
                </>
              )}
            </div>
          </div>
        </section>

        {/* Two-column ledger breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Paid by person */}
          <section aria-labelledby="paid-heading">
            <h2
              id="paid-heading"
              className="text-sm font-semibold text-[#3E4540] mb-3"
            >
              Paid by {summary.participant.name} ({summary.paid.length})
            </h2>

            {summary.paid.length === 0 ? (
              <div className="bg-white border border-[#E2E5DF] rounded-2xl p-6 text-sm text-[#6E7771]">
                {summary.participant.name} has not paid for any expenses on this trip.
              </div>
            ) : (
              <ul className="bg-white border border-[#E2E5DF] rounded-2xl divide-y divide-[#ECEEE9] overflow-hidden">
                {summary.paid.map((row) => (
                  <li key={row.expenseId}>
                    <a
                      href={`/trips/${trip.id}/expense/${row.expenseId}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(`/trips/${trip.id}/expense/${row.expenseId}`);
                      }}
                      className="group min-h-[64px] px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F9FAF8] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#141715] group-hover:text-[#14532D] truncate">
                          {row.description}
                        </div>
                        <div className="mt-0.5 text-xs text-[#6E7771]">
                          {formatReadableDate(row.expenseDate)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-sm font-semibold tabular-nums text-[#141715]">
                          {formatCurrencyAmount(row.amountMinor, summary.currency)}
                        </span>
                        <ChevronRight
                          className="w-4 h-4 text-[#8A928C] group-hover:text-[#14532D]"
                          aria-hidden="true"
                        />
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Assigned shares */}
          <section aria-labelledby="assigned-heading">
            <h2
              id="assigned-heading"
              className="text-sm font-semibold text-[#3E4540] mb-3"
            >
              Assigned to {summary.participant.name} ({summary.assigned.length})
            </h2>

            {summary.assigned.length === 0 ? (
              <div className="bg-white border border-[#E2E5DF] rounded-2xl p-6 text-sm text-[#6E7771]">
                No expense shares are assigned to {summary.participant.name} on this trip.
              </div>
            ) : (
              <ul className="bg-white border border-[#E2E5DF] rounded-2xl divide-y divide-[#ECEEE9] overflow-hidden">
                {summary.assigned.map((row) => (
                  <li key={row.expenseId}>
                    <a
                      href={`/trips/${trip.id}/expense/${row.expenseId}`}
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigate(`/trips/${trip.id}/expense/${row.expenseId}`);
                      }}
                      className="group min-h-[64px] px-5 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F9FAF8] transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-[#141715] group-hover:text-[#14532D] truncate">
                          {row.description}
                        </div>
                        <div className="mt-0.5 text-xs text-[#6E7771] flex flex-wrap items-center gap-x-1.5">
                          <span>{formatReadableDate(row.expenseDate)}</span>
                          <span aria-hidden="true">·</span>
                          <span>Paid by {row.paidBy.name}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            Bill {formatCurrencyAmount(row.expenseAmountMinor, summary.currency)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-sm font-semibold tabular-nums text-[#141715]">
                          {formatCurrencyAmount(row.shareMinor, summary.currency)}
                        </span>
                        <ChevronRight
                          className="w-4 h-4 text-[#8A928C] group-hover:text-[#14532D]"
                          aria-hidden="true"
                        />
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
