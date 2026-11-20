import React from 'react';
import { ArrowLeft } from 'lucide-react';

export interface TopBarNavLink {
  label: string;
  href: string;
  active?: boolean;
}

export interface TopBarProps {
  onNavigate: (path: string) => void;
  navLinks?: TopBarNavLink[];
  backTo?: { label: string; href: string };
  primaryAction?: {
    label: string;
    onClick: () => void;
    variant?: 'primary' | 'secondary';
    responsiveClass?: string;
  };
}

export function TopBar({
  onNavigate,
  navLinks = [],
  backTo,
  primaryAction,
}: TopBarProps) {
  const actionStyle =
    primaryAction?.variant === 'secondary'
      ? 'text-[#2A302C] bg-white border border-[#D8DCD5] hover:bg-[#EEF0EC]'
      : 'text-white bg-[#14532D] hover:bg-[#0F3F22]';

  return (
    <header className="sticky top-0 z-30 h-14 bg-[#F6F7F5]/95 backdrop-blur-md border-b border-[#E2E5DF]">
      <div className="max-w-5xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-element brand wordmark (or mobile back + brand) */}
        <div className="flex items-center gap-2 min-w-0 shrink-0">
          {backTo ? (
            <a
              href={backTo.href}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(backTo.href);
              }}
              aria-label={backTo.label}
              className="sm:hidden -ml-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-[#3E4540] hover:text-[#141715] hover:bg-[#EAECE8] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D]"
            >
              <ArrowLeft className="w-5 h-5" aria-hidden="true" />
            </a>
          ) : null}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="text-lg font-bold tracking-tight text-[#141715] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D] rounded"
          >
            Trip Split
          </a>
        </div>

        {/* Zone 2: Clean single-line text navigation links */}
        <nav
          aria-label="Primary"
          className="hidden sm:flex items-center gap-6 text-sm font-medium min-w-0 py-1"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => {
                e.preventDefault();
                onNavigate(link.href);
              }}
              aria-current={link.active ? 'page' : undefined}
              className={`whitespace-nowrap shrink-0 max-w-[200px] truncate py-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D] ${
                link.active
                  ? 'text-[#141715] border-b-2 border-[#14532D]'
                  : 'text-[#525A54] hover:text-[#141715] border-b-2 border-transparent'
              }`}
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: 1 primary contextual action */}
        <div className="flex items-center shrink-0">
          {primaryAction ? (
            <button
              type="button"
              onClick={primaryAction.onClick}
              className={`min-h-[40px] px-4 py-2 text-sm font-semibold active:scale-[0.98] rounded-lg transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#14532D] cursor-pointer ${actionStyle} ${primaryAction.responsiveClass ?? ''}`}
            >
              {primaryAction.label}
            </button>
          ) : (
            <div className="w-2" aria-hidden="true" />
          )}
        </div>
      </div>
    </header>
  );
}
