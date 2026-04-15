import { useState } from 'react';
import dayjs from 'dayjs';
import Calendar from './components/Calendar.jsx';
import staticTournamentData from '../data/tournaments.json';
import staticRankingsData from '../data/rankings.json';

// In Electron, use live data from disk (kept up-to-date by main process).
// In browser/dev, fall back to the bundled static import.
const tournamentData = window.electronAPI?.getTournaments() ?? staticTournamentData;
const rankingsData = window.electronAPI?.getRankings?.() ?? staticRankingsData;

export default function App() {
  const [tour, setTour] = useState('atp');
  const [currentDate, setCurrentDate] = useState(dayjs());

  const tournaments = tour === 'atp' ? tournamentData.atp : tournamentData.wta;

  const prevMonth = () => setCurrentDate(d => d.subtract(1, 'month'));
  const nextMonth = () => setCurrentDate(d => d.add(1, 'month'));
  const goToToday = () => setCurrentDate(dayjs());

  const monthLabel = currentDate.format('MMMM YYYY');
  const isAtp = tour === 'atp';
  const isMinMonth = currentDate.year() === 2026 && currentDate.month() === 0;

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
        className="flex items-center justify-between px-6 py-4"
        style={{
          background: 'linear-gradient(90deg, rgba(15,15,25,0.95) 0%, rgba(18,18,32,0.95) 100%)',
          borderBottom: '1px solid #1e2040',
          boxShadow: '0 2px 20px rgba(0,0,0,0.4)',
        }}
      >
        {/* ATP / WTA Toggle */}
        <div className="flex gap-2 items-center">
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
            className="text-xl font-semibold w-44 text-center select-none"
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

        {/* Right spacer with tour badge */}
        <div className="w-36 flex justify-end">
          <span
            className="text-xs font-bold tracking-widest px-3 py-1 rounded-full"
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
        </div>
      </header>

      {/* Calendar */}
      <main className="flex-1 p-6 overflow-auto">
        <Calendar currentDate={currentDate} tournaments={tournaments} tour={tour} rankingsData={rankingsData} />
      </main>

      {/* Legend */}
      <footer
        className="px-6 py-3 flex items-center gap-6"
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
