import React, { useMemo } from 'react';
import { BrowserLocalStorageStore } from './store/fileStore';
import { ensureBrowserSeeded } from './store/seedData';
import { useAppRouter } from './router';
import { TripListScreen } from './components/TripListScreen';
import { TripHomeScreen } from './components/TripHomeScreen';
import { ExpenseFormScreen } from './components/ExpenseFormScreen';
import { PersonSummaryScreen } from './components/PersonSummaryScreen';
import { SettleScreen } from './components/SettleScreen';

export default function App() {
  const store = useMemo(() => {
    const s = new BrowserLocalStorageStore();
    ensureBrowserSeeded(s);
    return s;
  }, []);

  const { route, navigate } = useAppRouter();

  switch (route.name) {
    case 'trip-list':
      return <TripListScreen store={store} onNavigate={navigate} />;

    case 'trip-home':
      return (
        <TripHomeScreen
          key={`trip-${route.tripId}`}
          store={store}
          tripId={route.tripId}
          onNavigate={navigate}
        />
      );

    case 'expense-new':
      return (
        <ExpenseFormScreen
          key={`expense-new-${route.tripId}`}
          store={store}
          tripId={route.tripId}
          onNavigate={navigate}
        />
      );

    case 'expense-detail':
      return (
        <ExpenseFormScreen
          key={`expense-${route.tripId}-${route.expenseId}`}
          store={store}
          tripId={route.tripId}
          expenseId={route.expenseId}
          onNavigate={navigate}
        />
      );

    case 'person-summary':
      return (
        <PersonSummaryScreen
          key={`person-${route.tripId}-${route.participantId}`}
          store={store}
          tripId={route.tripId}
          participantId={route.participantId}
          onNavigate={navigate}
        />
      );

    case 'settle':
      return (
        <SettleScreen
          key={`settle-${route.tripId}`}
          store={store}
          tripId={route.tripId}
          onNavigate={navigate}
        />
      );
  }
}
