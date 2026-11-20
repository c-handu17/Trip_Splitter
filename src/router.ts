import { useCallback, useEffect, useState } from 'react';

export type AppRoute =
  | { name: 'trip-list' }
  | { name: 'trip-home'; tripId: number }
  | { name: 'expense-new'; tripId: number }
  | { name: 'expense-detail'; tripId: number; expenseId: number }
  | { name: 'person-summary'; tripId: number; participantId: number }
  | { name: 'settle'; tripId: number };

export function parseRoute(pathname: string): AppRoute {
  const clean = pathname.replace(/\/+$/, '') || '/';

  if (clean === '/') {
    return { name: 'trip-list' };
  }

  let match = /^\/trips\/(\d+)$/.exec(clean);
  if (match) {
    return { name: 'trip-home', tripId: Number(match[1]) };
  }

  match = /^\/trips\/(\d+)\/expense\/new$/.exec(clean);
  if (match) {
    return { name: 'expense-new', tripId: Number(match[1]) };
  }

  match = /^\/trips\/(\d+)\/expense\/(\d+)$/.exec(clean);
  if (match) {
    return {
      name: 'expense-detail',
      tripId: Number(match[1]),
      expenseId: Number(match[2]),
    };
  }

  match = /^\/trips\/(\d+)\/people\/(\d+)$/.exec(clean);
  if (match) {
    return {
      name: 'person-summary',
      tripId: Number(match[1]),
      participantId: Number(match[2]),
    };
  }

  match = /^\/trips\/(\d+)\/settle$/.exec(clean);
  if (match) {
    return { name: 'settle', tripId: Number(match[1]) };
  }

  return { name: 'trip-list' };
}

export function useAppRouter() {
  const [pathname, setPathname] = useState<string>(() =>
    typeof window !== 'undefined' ? window.location.pathname : '/'
  );

  useEffect(() => {
    const handlePopState = () => {
      setPathname(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((to: string) => {
    if (window.location.pathname !== to) {
      window.history.pushState({}, '', to);
      setPathname(to);
      window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    }
  }, []);

  const route = parseRoute(pathname);

  return { route, pathname, navigate };
}
