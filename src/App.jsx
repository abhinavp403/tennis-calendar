import { useState, useEffect, useCallback } from 'react';
import dayjs from 'dayjs';
import Calendar from './components/Calendar.jsx';
import AppLogo from './components/AppLogo.jsx';
import TournamentSearch from './components/TournamentSearch.jsx';
import ChampionsWallDialog from './components/ChampionsWallDialog.jsx';
import { loadInitialData, loadData, getSyncTime, setSyncTime, triggerSync, isWebMode } from './dataSource.js';

function formatSyncTime(iso) {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return dayjs(iso).format('MMM D, h:mm A');
}

const SURFACE_FILTERS = [
  { key: 'All',          color: '#9ca3af' },
  { key: 'Hard',         color: '#3b82f6' },
  { key: 'Indoor Hard',  color: '#a78bfa', short: 'Indoor' },
  { key: 'Clay',         color: '#f97316' },
  { key: 'Grass',        color: '#22c55e' },
];

export default function App() {
  const [tour, setTour] = useState('atp');
  const [currentDate, setCurrentDate] = useState(dayjs());
  const [data, setData] = useState(() => loadInitialData());
  const [lastSynced, setLastSynced] = useState(() => getSyncTime());
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLabel, setSyncLabel] = useState(() => formatSyncTime(getSyncTime()));
  const [surfaceFilter, setSurfaceFilter] = useState('All');
  // Web mode starts with no data until the Gist fetch lands — show a skeleton meanwhile.
  const [isLoading, setIsLoading] = useState(() => isWebMode());
  // 'left' | 'right' | 'fade' — drives the month-change animation
  const [navDir, setNavDir] = useState('fade');
  // Tournament id to flash after a search jump
  const [flashId, setFlashId] = useState(null);
  const [showChampionsWall, setShowChampionsWall] = useState(false);

  const jumpToTournament = useCallback(t => {
    setTour(t.tour);
    setSurfaceFilter('All');
    setNavDir('fade');
    setCurrentDate(dayjs(t.end));
    setFlashId(t.id);
    setTimeout(() => setFlashId(null), 2600);
  }, []);

  // Web mode: fetch from the Gist on mount. Electron starts with data already populated.
  useEffect(() => {
    if (!isWebMode()) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await loadData();
        if (cancelled) return;
        setData(result);
        const now = new Date().toISOString();
        setSyncTime(now);
        setLastSynced(now);
        setSyncLabel(formatSyncTime(now));
      } catch (err) {
        console.error('Failed to load data from Gist:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Keep "X min ago" label fresh
  useEffect(() => {
    const interval = setInterval(() => setSyncLabel(formatSyncTime(lastSynced)), 30000);
    return () => clearInterval(interval);
  }, [lastSynced]);

  const handleRefresh = useCallback(async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await triggerSync();
      const result = await loadData();
      setData(result);
      const now = new Date().toISOString();
      setSyncTime(now);
      setLastSynced(now);
      setSyncLabel(formatSyncTime(now));
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  const tourTournaments = tour === 'atp' ? data.tournaments.atp : data.tournaments.wta;
  const tournaments = surfaceFilter === 'All'
    ? tourTournaments
    : tourTournaments.filter(t => t.surface === surfaceFilter);
  const rankingsData = data.rankings;

  // Upcoming tournaments: starting today through +7 days (current tour, ignores surface filter)
  const todayStr = dayjs().format('YYYY-MM-DD');
  const weekAheadStr = dayjs().add(7, 'day').format('YYYY-MM-DD');
  const upcoming = tourTournaments
    .filter(t => t.start >= todayStr && t.start <= weekAheadStr)
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 5);

  const prevMonth = () => { setNavDir('right'); setCurrentDate(d => d.subtract(1, 'month')); };
  const nextMonth = () => { setNavDir('left'); setCurrentDate(d => d.add(1, 'month')); };
  const goToToday = () => { setNavDir('fade'); setCurrentDate(dayjs()); };

  // Tab title + favicon follow the active tour
  useEffect(() => {
    document.title = `Tennis Calendar · ${tour.toUpperCase()}`;
    const color = tour === 'atp' ? '%230077ff' : '%23d93d99';
    const svg = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${color}"/><path d="M5 7 A 18 18 0 0 1 5 25 M27 7 A 18 18 0 0 0 27 25" stroke="white" stroke-width="2.2" fill="none"/></svg>`;
    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = svg;
  }, [tour]);

  const monthLabel = currentDate.format('MMMM YYYY');
  const isAtp = tour === 'atp';
  const isMinMonth = currentDate.year() === 2026 && currentDate.month() === 0;
  const accentColor = isAtp ? '#3388ff' : '#e060aa';

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: 'linear-gradient(135deg, #0a0a12 0%, #0d0d1a 40%, #0a0f1e 100%)',
        color: 'white',
      }}
    >
      {/* Header */}
      <header
        className="flex flex-wrap items-center justify-between gap-y-3 px-3 py-3 sm:px-6 sm:py-4"
        style={{
          background: 'linear-gradient(90deg, rgba(15,15,25,0.95) 0%, rgba(18,18,32,0.95) 100%)',
          borderBottom: '1px solid #1e2040',
          boxShadow: '0 2px 20px rgba(0,0,0,0.4)',
        }}
      >
        {/* Logo + ATP / WTA Toggle */}
        <div className="flex gap-3 items-center">
          <AppLogo size={38} />
          <div style={{ width: 1, height: 28, background: '#252545', margin: '0 2px' }} />
          <button
            onClick={() => setTour('atp')}
            className="px-5 py-2 rounded-full text-sm font-bold tracking-wider transition-all duration-200"
            style={{
              background: isAtp ? 'linear-gradient(135deg, #0055bb, #0077ff)' : '#16162a',
              color: isAtp ? 'white' : '#6b7280',
              border: isAtp ? '2px solid #3388ff' : '2px solid #252540',
              boxShadow: isAtp ? '0 0 16px rgba(0,119,255,0.4)' : 'none',
            }}
          >
            ATP
          </button>
          <button
            onClick={() => setTour('wta')}
            className="px-5 py-2 rounded-full text-sm font-bold tracking-wider transition-all duration-200"
            style={{
              background: !isAtp ? 'linear-gradient(135deg, #9c1a6a, #d93d99)' : '#16162a',
              color: !isAtp ? 'white' : '#6b7280',
              border: !isAtp ? '2px solid #e060aa' : '2px solid #252540',
              boxShadow: !isAtp ? '0 0 16px rgba(217,61,153,0.4)' : 'none',
            }}
          >
            WTA
          </button>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center gap-4">
          {!isMinMonth && (
            <button
              onClick={prevMonth}
              className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150"
              style={{
                background: '#16162a', border: '1px solid #252540', color: '#9ca3af',
                fontSize: '18px',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#252545'; e.currentTarget.style.color = 'white'; }}
              onMouseLeave={e => { e.currentTarget.style.background = '#16162a'; e.currentTarget.style.color = '#9ca3af'; }}
            >
              ‹
            </button>
          )}
          <span
            className="text-base w-32 sm:text-xl sm:w-44 font-semibold text-center select-none"
            style={{ color: 'white', letterSpacing: '0.5px' }}
          >
            {monthLabel}
          </span>
          <button
            onClick={nextMonth}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all duration-150"
            style={{
              background: '#16162a', border: '1px solid #252540', color: '#9ca3af',
              fontSize: '18px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#252545'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#16162a'; e.currentTarget.style.color = '#9ca3af'; }}
          >
            ›
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-1 rounded text-xs font-semibold transition-all duration-150"
            style={{
              background: '#16162a', border: '1px solid #252540', color: '#9ca3af',
              letterSpacing: '0.5px',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#252545'; e.currentTarget.style.color = 'white'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#16162a'; e.currentTarget.style.color = '#9ca3af'; }}
          >
            Today
          </button>
        </div>

        {/* Right: tour badge + sync */}
        <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 sm:gap-1 sm:min-w-[140px]">
          <span
            className="hidden sm:inline-block text-xs font-bold tracking-widest px-3 py-1 rounded-full"
            style={{
              background: isAtp
                ? 'linear-gradient(135deg, rgba(0,85,187,0.3), rgba(0,119,255,0.15))'
                : 'linear-gradient(135deg, rgba(156,26,106,0.3), rgba(217,61,153,0.15))',
              color: isAtp ? '#60b0ff' : '#f472b6',
              border: `1px solid ${isAtp ? 'rgba(51,136,255,0.5)' : 'rgba(224,96,170,0.5)'}`,
              boxShadow: isAtp ? '0 0 12px rgba(0,119,255,0.15)' : '0 0 12px rgba(217,61,153,0.15)',
            }}
          >
            {tour.toUpperCase()} TOUR
          </span>
          <div className="flex items-center gap-2">
            {syncLabel && (
              <span style={{ fontSize: '10px', color: '#4b5580' }}>
                {syncLabel}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isSyncing}
              title="Sync latest data"
              style={{
                background: 'none',
                border: 'none',
                color: isSyncing ? accentColor : '#4b5580',
                cursor: isSyncing ? 'default' : 'pointer',
                fontSize: '13px',
                padding: '2px 4px',
                borderRadius: '4px',
                transition: 'color 0.15s',
                animation: isSyncing ? 'spin 1s linear infinite' : 'none',
              }}
              onMouseEnter={e => { if (!isSyncing) e.currentTarget.style.color = accentColor; }}
              onMouseLeave={e => { if (!isSyncing) e.currentTarget.style.color = '#4b5580'; }}
            >
              ↻
            </button>
          </div>
        </div>
      </header>

      {/* Secondary toolbar: surface filter + upcoming-this-week */}
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 sm:px-6 py-2"
        style={{
          background: 'rgba(12,12,22,0.85)',
          borderBottom: '1px solid #16162a',
          minHeight: '44px',
        }}
      >
        {/* Surface filter */}
        <div className="flex items-center gap-1.5">
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.6px', marginRight: '4px' }}>
            SURFACE
          </span>
          {SURFACE_FILTERS.map(({ key, color, short }) => {
            const active = surfaceFilter === key;
            return (
              <button
                key={key}
                onClick={() => setSurfaceFilter(key)}
                style={{
                  fontSize: '11px', fontWeight: '700', letterSpacing: '0.3px',
                  padding: '4px 10px', borderRadius: '999px',
                  border: `1px solid ${active ? color : '#252540'}`,
                  background: active ? `${color}33` : '#16162a',
                  color: active ? color : '#9ca3af',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {short || key}
              </button>
            );
          })}
        </div>

        {/* Search / jump to tournament */}
        <TournamentSearch allData={data.tournaments} onJump={jumpToTournament} />

        {/* Champions Wall */}
        <button
          onClick={() => setShowChampionsWall(true)}
          style={{
            fontSize: '11px', fontWeight: '700', letterSpacing: '0.3px',
            padding: '4px 12px', borderRadius: '999px',
            border: '1px solid #252540', background: '#16162a',
            color: '#fbbf24', cursor: 'pointer', flexShrink: 0,
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#fbbf2466'; e.currentTarget.style.background = 'rgba(251,191,36,0.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#252540'; e.currentTarget.style.background = '#16162a'; }}
        >
          🏆 Champions
        </button>

        {/* Vertical divider (desktop only — sections stack on mobile) */}
        <div className="hidden sm:block" style={{ width: 1, height: 24, background: '#252545' }} />

        {/* Upcoming this week */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.6px', whiteSpace: 'nowrap' }}>
            UPCOMING
          </span>
          {upcoming.length === 0 ? (
            <span style={{ fontSize: '11px', color: '#3b3f55', fontStyle: 'italic' }}>
              Nothing in the next 7 days
            </span>
          ) : (
            <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', flex: 1 }}>
              {upcoming.map(t => {
                const days = dayjs(t.start).diff(dayjs(), 'day');
                const label = days <= 0 ? 'starts today' : days === 1 ? 'tomorrow' : `in ${days}d`;
                const surfaceColor = SURFACE_FILTERS.find(s => s.key === t.surface)?.color || '#9ca3af';
                return (
                  <span
                    key={t.id}
                    title={`${t.location} · ${t.surface}`}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: '6px',
                      fontSize: '11px', fontWeight: '600',
                      padding: '4px 10px', borderRadius: '6px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid #1e1e30',
                      color: '#e5e7eb',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: surfaceColor }} />
                    {t.name}
                    <span style={{ color: '#6b7280', fontWeight: '500' }}>· {label}</span>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Calendar */}
      <main className="flex-1 p-3 sm:p-6 overflow-auto">
        {isLoading ? (
          /* Skeleton: day-label row + 6-week shimmering grid while Gist data loads */
          <div className="w-full" aria-busy="true" aria-label="Loading tournament data">
            <div className="grid grid-cols-7 mb-2" style={{ gap: '4px' }}>
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i} className="skeleton-cell" style={{ height: '18px', animationDelay: `${i * 60}ms` }} />
              ))}
            </div>
            <div className="grid grid-cols-7" style={{ gap: '4px' }}>
              {Array.from({ length: 42 }, (_, i) => (
                <div key={i} className="skeleton-cell day-cell" style={{ animationDelay: `${(i % 7) * 60}ms` }} />
              ))}
            </div>
          </div>
        ) : (
          <div
            key={`${currentDate.format('YYYY-MM')}-${tour}`}
            className={navDir === 'left' ? 'month-enter-left' : navDir === 'right' ? 'month-enter-right' : 'month-enter-fade'}
          >
            <Calendar
              currentDate={currentDate}
              tournaments={tournaments}
              allTournaments={tourTournaments}
              tour={tour}
              rankingsData={rankingsData}
              flashId={flashId}
            />
          </div>
        )}
      </main>

      {showChampionsWall && (
        <ChampionsWallDialog
          tournaments={tourTournaments}
          tour={tour}
          onClose={() => setShowChampionsWall(false)}
        />
      )}

      {/* Legend */}
      <footer
        className="px-3 sm:px-6 py-3 flex flex-wrap items-center gap-3 sm:gap-6"
        style={{ borderTop: '1px solid #1e2040', background: 'rgba(10,10,20,0.8)' }}
      >
        <span className="text-xs font-semibold mr-2" style={{ color: '#4b5580', letterSpacing: '1px' }}>LEVEL</span>
        {[
          { color: '#a78bfa', glow: 'rgba(167,139,250,0.5)', label: 'Grand Slam' },
          { color: '#f59e0b', glow: 'rgba(245,158,11,0.4)', label: '1000' },
          { color: '#3b82f6', glow: 'rgba(59,130,246,0.4)', label: '500' },
          { color: '#8b8fa8', glow: 'rgba(139,143,168,0.3)', label: '250' },
        ].map(item => (
          <div key={item.label} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ background: item.color, boxShadow: `0 0 6px ${item.glow}` }}
            />
            <span className="text-xs font-semibold" style={{ color: item.color }}>{item.label}</span>
          </div>
        ))}
        <span className="text-xs ml-auto" style={{ color: '#4b5580' }}>🏆 Final Day</span>
      </footer>
    </div>
  );
}
