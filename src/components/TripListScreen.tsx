import React, { useRef, useState } from 'react';
import { ChevronRight, Plus, Compass } from 'lucide-react';
import type { CurrencyCode, DocumentStore } from '../store/types';
import { createTrip, listTrips, type TripSummaryDto } from '../api/trips';
import { CURRENCY_META, SUPPORTED_CURRENCIES } from '../money/currency';
import { TopBar } from './TopBar';

interface TripListScreenProps {
  store: DocumentStore;
  onNavigate: (path: string) => void;
}

export function TripListScreen({ store, onNavigate }: TripListScreenProps) {
  const [trips, setTrips] = useState<TripSummaryDto[]>(() => {
    const res = listTrips(store);
    return res.ok ? res.data.trips : [];
  });

  const [tripName, setTripName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('INR');
  const [organizerName, setOrganizerName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [mobileFormOpen, setMobileFormOpen] = useState(false);

  const nameInputRef = useRef<HTMLInputElement>(null);

  const refreshTrips = () => {
    const res = listTrips(store);
    if (res.ok) setTrips(res.data.trips);
  };

  const focusCreateForm = () => {
    setMobileFormOpen(true);
    setTimeout(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 30);
  };

  const handleCreateTrip = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const res = createTrip(store, {
      name: tripName,
      currency,
      organizerName,
    });

    if (!res.ok) {
      setError(res.body.error.message);
      return;
    }

    setTripName('');
    setOrganizerName('');
    setMobileFormOpen(false);
    refreshTrips();
  };

  return (
    <div className="min-h-screen bg-[#F6F7F5] text-[#141715]">
      <TopBar
        onNavigate={onNavigate}
        navLinks={[{ label: 'All Trips', href: '/', active: true }]}
        primaryAction={{
          label: 'New Trip',
          onClick: focusCreateForm,
          responsiveClass: 'lg:hidden',
        }}
      />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#141715] text-balance">
            Your Trips
          </h1>
          <p className="mt-1.5 text-sm sm:text-base text-[#525A54]">
            Each trip keeps its own currency, friends, and shared expenses in one ledger.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left 7 columns: Trip list (strictly NO amounts per T-14) */}
          <section aria-labelledby="trips-heading" className="lg:col-span-7">
            <div className="flex items-center justify-between mb-3">
              <h2
                id="trips-heading"
                className="text-sm font-semibold text-[#3E4540]"
              >
                Saved Trips ({trips.length})
              </h2>
            </div>

            {trips.length === 0 ? (
              <div className="bg-white border border-[#E2E5DF] rounded-2xl p-8 text-center">
                <div className="w-11 h-11 rounded-full bg-[#EEF0EC] text-[#525A54] mx-auto flex items-center justify-center mb-4">
                  <Compass className="w-5 h-5" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-[#141715]">
                  No trips yet
                </h3>
                <p className="mt-1 text-sm text-[#525A54] max-w-sm mx-auto">
                  Create your first trip with a currency and your name to start recording shared expenses.
                </p>
                <button
                  type="button"
                  onClick={focusCreateForm}
                  className="mt-5 min-h-[44px] px-5 py-2.5 inline-flex items-center gap-2 text-sm font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] rounded-xl transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                  Create First Trip
                </button>
              </div>
            ) : (
              <ul
                data-testid="trip-list"
                className="bg-white border border-[#E2E5DF] rounded-2xl divide-y divide-[#ECEEE9] overflow-hidden"
              >
                {trips.map((trip) => {
                  const personLabel =
                    trip.participantCount === 1 ? '1 person' : `${trip.participantCount} people`;
                  const expenseLabel =
                    trip.expenseCount === 1 ? '1 expense' : `${trip.expenseCount} expenses`;

                  return (
                    <li key={trip.id}>
                      <a
                        href={`/trips/${trip.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          onNavigate(`/trips/${trip.id}`);
                        }}
                        className="group w-full min-h-[76px] px-5 py-4 flex items-center justify-between gap-4 hover:bg-[#F9FAF8] active:bg-[#F1F3EF] transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#14532D]"
                      >
                        <div className="min-w-0">
                          <div className="text-base font-semibold text-[#141715] group-hover:text-[#14532D] transition-colors truncate">
                            {trip.name}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-[#525A54]">
                            <span className="font-mono font-medium text-[#2A302C]">
                              {trip.currency}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{personLabel}</span>
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{expenseLabel}</span>
                          </div>
                        </div>

                        <ChevronRight
                          className="w-5 h-5 text-[#8A928C] group-hover:text-[#14532D] group-hover:translate-x-0.5 transition-all shrink-0"
                          aria-hidden="true"
                        />
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {/* Right 5 columns: New Trip form (always visible on desktop, expandable on mobile) */}
          <section
            aria-labelledby="create-trip-heading"
            className={`lg:col-span-5 ${mobileFormOpen ? 'block' : 'hidden lg:block'}`}
          >
            <div className="bg-white border border-[#E2E5DF] rounded-2xl p-6">
              <div className="flex items-center justify-between gap-4 mb-5">
                <div>
                  <h2
                    id="create-trip-heading"
                    className="text-lg font-semibold text-[#141715]"
                  >
                    Create a New Trip
                  </h2>
                  <p className="mt-0.5 text-xs text-[#525A54]">
                    Pick one currency for the whole trip and add yourself as organizer.
                  </p>
                </div>
                {mobileFormOpen ? (
                  <button
                    type="button"
                    onClick={() => setMobileFormOpen(false)}
                    className="lg:hidden min-h-[40px] px-3 text-xs font-medium text-[#525A54] hover:text-[#141715] rounded-lg cursor-pointer"
                  >
                    Close
                  </button>
                ) : null}
              </div>

              <form onSubmit={handleCreateTrip} noValidate className="space-y-4">
                <div>
                  <label
                    htmlFor="new-trip-name"
                    className="block text-sm font-medium text-[#2A302C] mb-1.5"
                  >
                    Trip name
                  </label>
                  <input
                    ref={nameInputRef}
                    id="new-trip-name"
                    name="tripName"
                    type="text"
                    maxLength={60}
                    placeholder="e.g. Manali Roadtrip"
                    value={tripName}
                    onChange={(e) => setTripName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[#F6F7F5] border border-[#D8DCD5] rounded-xl text-[#141715] placeholder:text-[#8A928C] focus:bg-white focus:border-[#14532D] focus:outline-none focus:ring-2 focus:ring-[#14532D]/15 transition-colors"
                  />
                </div>

                <div>
                  <span
                    id="currency-group-label"
                    className="block text-sm font-medium text-[#2A302C] mb-1.5"
                  >
                    Trip currency
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby="currency-group-label"
                    className="grid grid-cols-4 gap-2"
                  >
                    {SUPPORTED_CURRENCIES.map((code) => {
                      const meta = CURRENCY_META[code];
                      const selected = currency === code;
                      return (
                        <button
                          key={code}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setCurrency(code)}
                          className={`min-h-[44px] px-2 py-2 rounded-xl border text-sm font-medium transition-colors flex items-center justify-center gap-1 whitespace-nowrap cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D] ${
                            selected
                              ? 'bg-[#14532D] text-white border-[#14532D]'
                              : 'bg-[#F6F7F5] text-[#2A302C] border-[#D8DCD5] hover:bg-[#ECEEE9]'
                          }`}
                        >
                          <span>{meta.symbol}</span>
                          <span className="font-mono text-xs">{meta.code}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="new-trip-organizer"
                    className="block text-sm font-medium text-[#2A302C] mb-1.5"
                  >
                    Your name (organizer)
                  </label>
                  <input
                    id="new-trip-organizer"
                    name="organizerName"
                    type="text"
                    maxLength={40}
                    placeholder="e.g. Asha"
                    value={organizerName}
                    onChange={(e) => setOrganizerName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2.5 text-sm bg-[#F6F7F5] border border-[#D8DCD5] rounded-xl text-[#141715] placeholder:text-[#8A928C] focus:bg-white focus:border-[#14532D] focus:outline-none focus:ring-2 focus:ring-[#14532D]/15 transition-colors"
                  />
                </div>

                {error ? (
                  <div
                    role="alert"
                    className="px-3.5 py-2.5 rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#B91C1C]"
                  >
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="w-full min-h-[46px] px-4 py-2.5 text-sm font-semibold text-white bg-[#14532D] hover:bg-[#0F3F22] active:scale-[0.99] rounded-xl transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
                >
                  Create Trip
                </button>
              </form>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
