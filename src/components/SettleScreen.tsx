import React, { useMemo, useState } from 'react';
import { ArrowRight, Check, CheckCircle2, Copy } from 'lucide-react';
import type { DocumentStore } from '../store/types';
import { getTrip } from '../api/trips';
import { getTripSettlement } from '../api/settlement';
import { formatCurrencyAmount } from '../money/currency';
import { formatSettlementPlainText } from '../money/settlement';
import { TopBar } from './TopBar';

interface SettleScreenProps {
  store: DocumentStore;
  tripId: number;
  onNavigate: (path: string) => void;
}

async function copyTextReliable(text: string): Promise<boolean> {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export function SettleScreen({
  store,
  tripId,
  onNavigate,
}: SettleScreenProps) {
  const [copied, setCopied] = useState(false);

  const tripRes = getTrip(store, tripId);
  const settlementRes = getTripSettlement(store, tripId);

  const trip = tripRes.ok ? tripRes.data : null;
  const settlement = settlementRes.ok ? settlementRes.data : null;

  const plainText = useMemo(() => {
    if (!trip || !settlement) return '';
    return formatSettlementPlainText(trip.name, settlement);
  }, [trip, settlement]);

  if (!trip || !settlement) {
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

  const totalTransferMinor = settlement.payments.reduce(
    (sum, p) => sum + p.amountMinor,
    0
  );

  const handleCopy = async () => {
    const ok = await copyTextReliable(plainText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F7F5] text-[#141715] pb-12">
      <TopBar
        onNavigate={onNavigate}
        backTo={{ label: `Back to ${trip.name}`, href: `/trips/${trip.id}` }}
        navLinks={[
          { label: 'All Trips', href: '/' },
          { label: trip.name, href: `/trips/${trip.id}` },
          { label: 'Settle', href: `/trips/${trip.id}/settle`, active: true },
        ]}
        primaryAction={{
          label: 'Back to Trip',
          onClick: () => onNavigate(`/trips/${trip.id}`),
          variant: 'secondary',
        }}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-7 sm:py-9">
        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141715] text-balance">
              Settlement Plan
            </h1>
            <p className="mt-1 text-sm text-[#525A54]">
              {trip.name} ·{' '}
              <span className="font-mono font-medium text-[#2A302C]">
                {settlement.currency}
              </span>{' '}
              · Fewest payments to bring every balance to zero
            </p>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="min-h-[44px] px-4 py-2 inline-flex items-center justify-center gap-2 text-sm font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] active:scale-[0.99] rounded-xl transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" aria-hidden="true" />
                Copied Settlement List
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" aria-hidden="true" />
                Copy Settlement List
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Hero: Suggested Payments List */}
          <section
            aria-labelledby="payments-heading"
            className="lg:col-span-6 space-y-4"
          >
            <div className="flex items-baseline justify-between">
              <h2
                id="payments-heading"
                className="text-sm font-semibold text-[#3E4540]"
              >
                Who Pays Whom ({settlement.payments.length}{' '}
                {settlement.payments.length === 1 ? 'payment' : 'payments'})
              </h2>
              {settlement.payments.length > 0 ? (
                <span className="text-xs font-mono tabular-nums text-[#525A54]">
                  Total {formatCurrencyAmount(totalTransferMinor, settlement.currency)}
                </span>
              ) : null}
            </div>

            {settlement.payments.length === 0 ? (
              <div className="bg-white border border-[#E2E5DF] rounded-2xl p-8 text-center">
                <div className="w-11 h-11 rounded-full bg-[#14532D]/10 text-[#14532D] mx-auto flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-[#141715]">
                  Everyone is settled up
                </h3>
                <p className="mt-1 text-sm text-[#525A54]">
                  All participant nets are zero. No payments are needed.
                </p>
              </div>
            ) : (
              <ol
                data-testid="settlement-payments"
                className="bg-white border border-[#E2E5DF] rounded-2xl divide-y divide-[#ECEEE9] overflow-hidden"
              >
                {settlement.payments.map((payment, idx) => (
                  <li
                    key={`${payment.fromParticipantId}-${payment.toParticipantId}`}
                    className="px-5 py-4 min-h-[72px] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-[#EEF0EC] text-[#3E4540] font-mono text-xs font-semibold inline-flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap text-sm sm:text-base font-semibold text-[#141715]">
                          <span>{payment.fromName}</span>
                          <ArrowRight
                            className="w-4 h-4 text-[#6E7771] shrink-0"
                            aria-hidden="true"
                          />
                          <span className="text-[#14532D]">{payment.toName}</span>
                        </div>
                        <div className="mt-0.5 text-xs text-[#6E7771]">
                          {payment.fromName} pays {payment.toName}
                        </div>
                      </div>
                    </div>

                    <div className="font-mono text-base sm:text-lg font-semibold tabular-nums text-[#141715] shrink-0">
                      {formatCurrencyAmount(payment.amountMinor, settlement.currency)}
                    </div>
                  </li>
                ))}
              </ol>
            )}

            {/* Plain text copy preview */}
            <div className="bg-white border border-[#E2E5DF] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-[#3E4540]">
                  Plain-text message preview
                </span>
                <span className="text-xs text-[#6E7771]">
                  Read-only calculation
                </span>
              </div>
              <pre
                data-testid="settlement-plain-text"
                className="text-xs font-mono text-[#2A302C] bg-[#F6F7F5] rounded-xl p-3.5 overflow-x-auto whitespace-pre-wrap leading-relaxed"
              >
                {plainText}
              </pre>
            </div>
          </section>

          {/* Right: Participant Balances Verification Table */}
          <section
            aria-labelledby="balances-heading"
            className="lg:col-span-6 space-y-4"
          >
            <div className="flex items-baseline justify-between">
              <h2
                id="balances-heading"
                className="text-sm font-semibold text-[#3E4540]"
              >
                Participant Balances ({settlement.balances.length})
              </h2>
              <span className="text-xs text-[#6E7771]">
                Net = Paid − Assigned
              </span>
            </div>

            <div className="bg-white border border-[#E2E5DF] rounded-2xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#ECEEE9] bg-[#FAFBFA] text-xs font-semibold text-[#525A54]">
                      <th scope="col" className="py-3 pl-5 pr-3">
                        Person
                      </th>
                      <th scope="col" className="py-3 px-3 text-right">
                        Paid
                      </th>
                      <th scope="col" className="py-3 px-3 text-right">
                        Assigned
                      </th>
                      <th scope="col" className="py-3 pl-3 pr-5 text-right">
                        Net
                      </th>
                    </tr>
                  </thead>
                  <tbody
                    data-testid="settlement-balances"
                    className="divide-y divide-[#ECEEE9] text-sm"
                  >
                    {settlement.balances.map((b) => {
                      const statusLabel =
                        b.netMinor > 0
                          ? 'Owed'
                          : b.netMinor < 0
                            ? 'Owes'
                            : 'Even';
                      const netColor =
                        b.netMinor > 0
                          ? 'text-[#14532D]'
                          : b.netMinor < 0
                            ? 'text-[#B91C1C]'
                            : 'text-[#525A54]';

                      return (
                        <tr
                          key={b.participantId}
                          className="hover:bg-[#F9FAF8] transition-colors"
                        >
                          <td className="py-3.5 pl-5 pr-3">
                            <a
                              href={`/trips/${trip.id}/people/${b.participantId}`}
                              onClick={(e) => {
                                e.preventDefault();
                                onNavigate(
                                  `/trips/${trip.id}/people/${b.participantId}`
                                );
                              }}
                              className="font-semibold text-[#141715] hover:text-[#14532D] hover:underline"
                            >
                              {b.name}
                            </a>
                            <div className={`text-xs ${netColor}`}>
                              {statusLabel}
                            </div>
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono text-xs sm:text-sm tabular-nums text-[#3E4540] whitespace-nowrap">
                            {formatCurrencyAmount(
                              b.totalPaidMinor,
                              settlement.currency
                            )}
                          </td>
                          <td className="py-3.5 px-3 text-right font-mono text-xs sm:text-sm tabular-nums text-[#3E4540] whitespace-nowrap">
                            {formatCurrencyAmount(
                              b.totalAssignedMinor,
                              settlement.currency
                            )}
                          </td>
                          <td
                            className={`py-3.5 pl-3 pr-5 text-right font-mono text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap ${netColor}`}
                          >
                            {formatCurrencyAmount(
                              b.netMinor,
                              settlement.currency,
                              { showSign: true }
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-5 py-3 bg-[#FAFBFA] border-t border-[#ECEEE9] text-xs text-[#6E7771]">
                Participants who are already even are included here and omitted from the payment list.
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
