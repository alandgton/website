import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { MouseEvent } from 'react';
import { Briefcase, ChevronDown, ChevronUp, Home, Map, Zap, ZapOff } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { NeuralMeshBackground } from './NeuralMeshBackground';

interface SiteLink {
  label: string;
  slug: string;
  href: string;
  accentColor: string;
  icon: LucideIcon;
}

/** Sections linked from the landing page. Add new subpath sites here. */
const SITE_LINKS: SiteLink[] = [
  { label: 'Home', slug: 'home', href: '/home/', accentColor: '#f59e0b', icon: Home },
  { label: 'Work', slug: 'work', href: '/work/', accentColor: '#38bdf8', icon: Briefcase },
  { label: 'Garden Leave', slug: 'gardenleave', href: '/gardenleave/', accentColor: '#34d399', icon: Map },
];

const DEFAULT_INDEX = 1; // Work centered by default (Home above, Garden Leave below)
const ROW_HEIGHT_PX = 44;

export function LandingPage() {
  const [isAnimated, setIsAnimated] = useState<boolean>(false);
  const [activeIndex, setActiveIndex] = useState<number>(DEFAULT_INDEX);

  const wheelRef = useRef<HTMLDivElement | null>(null);
  const programmaticScrollUntilRef = useRef<number>(0);

  const activeLink = SITE_LINKS[activeIndex] ?? SITE_LINKS[DEFAULT_INDEX];

  const scrollToIndex = useCallback((nextIndex: number, behavior: ScrollBehavior = 'smooth') => {
    const clamped = Math.max(0, Math.min(SITE_LINKS.length - 1, nextIndex));
    setActiveIndex(clamped);

    const wheelEl = wheelRef.current;
    if (!wheelEl) return;

    programmaticScrollUntilRef.current = performance.now() + (behavior === 'smooth' ? 360 : 50);
    wheelEl.scrollTo({ top: clamped * ROW_HEIGHT_PX, behavior });
  }, []);

  // Position default selection ("Work") cleanly before first paint
  useLayoutEffect(() => {
    const wheelEl = wheelRef.current;
    if (wheelEl) {
      wheelEl.scrollTop = DEFAULT_INDEX * ROW_HEIGHT_PX;
    }
  }, []);

  // Keyboard navigation: Up/Down changes wheel selection, Enter navigates when body is focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        scrollToIndex(activeIndex - 1, 'smooth');
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        scrollToIndex(activeIndex + 1, 'smooth');
      } else if (e.key === 'Enter' && document.activeElement === document.body) {
        e.preventDefault();
        window.location.assign(activeLink.href);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, activeLink.href, scrollToIndex]);

  const handleWheelScroll = () => {
    const wheelEl = wheelRef.current;
    if (!wheelEl) return;
    if (performance.now() < programmaticScrollUntilRef.current) return;

    const snappedIndex = Math.max(
      0,
      Math.min(SITE_LINKS.length - 1, Math.round(wheelEl.scrollTop / ROW_HEIGHT_PX))
    );
    if (snappedIndex !== activeIndex) {
      setActiveIndex(snappedIndex);
    }
  };

  const handleOptionClick = (e: MouseEvent<HTMLAnchorElement>, index: number) => {
    // Allow Cmd/Ctrl/Shift/middle-click to open any option natively in a new tab
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }
    // Tapping a non-centered option scrolls it smoothly into the center slot;
    // tapping the already-centered option follows its href directly.
    if (index !== activeIndex) {
      e.preventDefault();
      scrollToIndex(index, 'smooth');
    }
  };

  const hasAbove = activeIndex > 0;
  const hasBelow = activeIndex < SITE_LINKS.length - 1;

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 selection:bg-sky-500/30 selection:text-sky-200 overflow-x-hidden">
      {/* Background Neural Mesh */}
      <NeuralMeshBackground isAnimated={isAnimated} />

      {/* Top Bar / Animation Controls */}
      <header className="relative z-20 flex justify-end p-4 sm:p-6">
        <button
          type="button"
          onClick={() => setIsAnimated(!isAnimated)}
          aria-pressed={isAnimated}
          className="flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900/70 px-3.5 py-1.5 text-xs font-mono text-slate-300 backdrop-blur-md transition-colors hover:border-sky-500/50 hover:text-sky-300 shadow-sm"
        >
          {isAnimated ? (
            <Zap className="h-3.5 w-3.5 text-sky-400 fill-sky-400" aria-hidden="true" />
          ) : (
            <ZapOff className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          )}
          <span>Animation: {isAnimated ? 'ON' : 'OFF'}</span>
          <span
            className={`inline-block h-2 w-2 rounded-full transition-colors ${
              isAnimated ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.8)]' : 'bg-slate-600'
            }`}
            aria-hidden="true"
          />
        </button>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 flex min-h-[calc(100vh-80px)] flex-col items-center justify-center px-6 -mt-8 text-center">
        {/* Soft radial vignette behind text and wheel */}
        <div className="pointer-events-none absolute inset-0 -z-10 flex items-center justify-center">
          <div className="h-[460px] w-[520px] rounded-full bg-slate-950/60 blur-3xl" />
        </div>

        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-center gap-5 sm:gap-5">
          {/* Prefix aligned vertically with the 180px drum center on desktop */}
          <h1 className="sm:h-[180px] flex items-center justify-center gap-2 text-4xl sm:text-5xl font-semibold tracking-tight text-slate-100 whitespace-nowrap">
            <span>Alan Ton</span>
            <span className="font-mono text-sky-400">@</span>
          </h1>

          {/* Scroll Wheel + Go CTA + subtle URL column */}
          <div className="flex flex-col items-center w-[220px] sm:w-[232px]">
            {/* Glassmorphic Thumb-Wheel Drum */}
            <nav
              aria-label="Choose destination"
              className="relative w-full rounded-2xl border border-slate-700/70 bg-slate-900/75 backdrop-blur-md shadow-xl shadow-black/40 overflow-hidden"
            >
              {/* Top scroll chevron bar */}
              <button
                type="button"
                onClick={() => scrollToIndex(activeIndex - 1, 'smooth')}
                disabled={!hasAbove}
                aria-label="Previous destination"
                className={`flex h-6 w-full items-center justify-center border-b border-slate-800/80 bg-slate-950/40 transition-colors ${
                  hasAbove
                    ? 'text-slate-300 hover:bg-slate-800/60 hover:text-white cursor-pointer'
                    : 'text-slate-700 cursor-default'
                }`}
              >
                <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              {/* 3-row unobstructed scroll viewport (3 * 44px = 132px) */}
              <div className="relative h-[132px]">
                {/* Vertical position dot rail inside left edge */}
                <div
                  className="absolute left-2.5 top-0 bottom-0 z-20 flex flex-col items-center justify-center gap-1.5"
                  aria-hidden="true"
                >
                  {SITE_LINKS.map((item, idx) => {
                    const isCurrent = idx === activeIndex;
                    return (
                      <button
                        key={item.slug}
                        type="button"
                        tabIndex={-1}
                        onClick={() => scrollToIndex(idx, 'smooth')}
                        className="w-1 rounded-full transition-all duration-150 cursor-pointer"
                        style={{
                          height: isCurrent ? '14px' : '6px',
                          backgroundColor: isCurrent ? activeLink.accentColor : 'rgba(148, 163, 184, 0.4)',
                        }}
                      />
                    );
                  })}
                </div>

                {/* Highlighted center selection band */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-1.5 top-[44px] h-[44px] rounded-xl border transition-colors duration-150"
                  style={{
                    backgroundColor: `${activeLink.accentColor}1c`,
                    borderColor: `${activeLink.accentColor}88`,
                  }}
                />

                {/* Scrollable snap drum */}
                <div
                  ref={wheelRef}
                  onScroll={handleWheelScroll}
                  className="wheel-scroll relative z-10 h-full overflow-y-auto"
                >
                  {/* Top & bottom spacers allow first/last items to center cleanly */}
                  <div className="h-[44px]" aria-hidden="true" />
                  {SITE_LINKS.map((item, idx) => {
                    const Icon = item.icon;
                    const isSelected = idx === activeIndex;
                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        onClick={(e) => handleOptionClick(e, idx)}
                        aria-current={isSelected ? 'true' : undefined}
                        className={`snap-center snap-always flex h-[44px] w-full items-center justify-center gap-2 px-5 text-[15px] transition-all duration-150 focus:outline-none focus-visible:ring-1 focus-visible:ring-sky-400/70 rounded-xl ${
                          isSelected
                            ? 'font-semibold scale-[1.03] opacity-100'
                            : 'font-medium text-slate-300 opacity-75 scale-[0.95] hover:opacity-100 hover:text-slate-100'
                        }`}
                        style={isSelected ? { color: item.accentColor } : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                        <span>{item.label}</span>
                      </a>
                    );
                  })}
                  <div className="h-[44px]" aria-hidden="true" />
                </div>
              </div>

              {/* Bottom scroll chevron bar */}
              <button
                type="button"
                onClick={() => scrollToIndex(activeIndex + 1, 'smooth')}
                disabled={!hasBelow}
                aria-label="Next destination"
                className={`flex h-6 w-full items-center justify-center border-t border-slate-800/80 bg-slate-950/40 transition-colors ${
                  hasBelow
                    ? 'text-slate-300 hover:bg-slate-800/60 hover:text-white cursor-pointer'
                    : 'text-slate-700 cursor-default'
                }`}
              >
                <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </nav>

            {/* Primary "Go" CTA directly below the scroll wheel */}
            <a
              href={activeLink.href}
              className="mt-3 flex h-11 w-full items-center justify-center rounded-xl text-sm sm:text-base font-semibold text-slate-950 transition-all hover:brightness-110 active:scale-[0.98]"
              style={{
                backgroundColor: activeLink.accentColor,
                boxShadow: `0 0 24px ${activeLink.accentColor}38`,
              }}
            >
              Go
            </a>

            {/* Subtle live alanton.at/<slug> readout */}
            <p className="mt-2.5 font-mono text-xs text-slate-400">
              alanton.at/
              <span style={{ color: activeLink.accentColor }}>{activeLink.slug}</span>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
