import { useState } from 'react';
import dayjs from 'dayjs';
import DayCell from './DayCell.jsx';
import MonthSummaryDialog from './MonthSummaryDialog.jsx';
import RankingsDialog from './RankingsDialog.jsx';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar({ currentDate, tournaments, tour, rankingsData }) {
  const [showSummary, setShowSummary] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const monthStart = currentDate.startOf('month');
  const daysInMonth = currentDate.daysInMonth();
  const firstDayOfWeek = monthStart.day(); // 0=Sun … 6=Sat
  const today = dayjs();
  const todayStr = today.format('YYYY-MM-DD');

  // Tournaments that ended this month and have results
  const completedThisMonth = tournaments.filter(t =>
    t.winner &&
    dayjs(t.end).isBefore(today) &&
    dayjs(t.end).month() === currentDate.month() &&
    dayjs(t.end).year() === currentDate.year()
  ).sort((a, b) => (a.end > b.end ? 1 : -1));

  // Build date → [tournament, ...] map; tournaments appear only on their end date
  const tournamentsByDate = {};
  for (const t of tournaments) {
    if (!tournamentsByDate[t.end]) tournamentsByDate[t.end] = [];
    tournamentsByDate[t.end].push({ ...t, dateType: 'end' });
  }

  // Build grid cells: null = empty padding, object = a real day
  const cells = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => {
      const d = i + 1;
      const dateStr = currentDate.date(d).format('YYYY-MM-DD');
      return { day: d, dateStr, tournaments: tournamentsByDate[dateStr] ?? [] };
    }),
  ];

  // Pad to full 6-week grid so height stays consistent
  while (cells.length < 42) cells.push(null);

  const accentColor = tour === 'atp' ? '#0066cc' : '#be398d';
  const monthLabel = currentDate.format('MMMM YYYY');

  // Rankings: only show for fully completed months
  const monthEnd = currentDate.endOf('month');
  const isMonthComplete = monthEnd.isBefore(today);
  const monthKey = currentDate.format('YYYY-MM');
  const tourRankings = rankingsData?.[tour] ?? {};
  const rankings = tourRankings[monthKey] ?? null;

  // Previous month rankings for movement comparison
  const prevMonthKey = currentDate.subtract(1, 'month').format('YYYY-MM');
  const prevRankings = tourRankings[prevMonthKey] ?? null;

  return (
    <div className="w-full">
      {/* Day-of-week labels */}
      <div className="grid grid-cols-7 mb-2" style={{ gap: '4px' }}>
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            className="text-center text-xs font-semibold uppercase py-1 select-none"
            style={{ color: i === 0 || i === 6 ? '#5a5a80' : '#363660', letterSpacing: '0.5px' }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7" style={{ gap: '4px' }}>
        {cells.map((cell, i) =>
          cell === null ? (
            <div key={`pad-${i}`} style={{ minHeight: '100px' }} />
          ) : (
            <DayCell
              key={cell.dateStr}
              day={cell.day}
              dateStr={cell.dateStr}
              tournaments={cell.tournaments}
              isToday={cell.dateStr === todayStr}
              tour={tour}
            />
          )
        )}
      </div>

      {/* Month action buttons — side by side */}
      {(completedThisMonth.length > 0 || (isMonthComplete && rankings)) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '20px' }}>
          {completedThisMonth.length > 0 && (
            <button
              onClick={() => setShowSummary(true)}
              style={{
                background: 'transparent',
                border: `1px solid ${accentColor}`,
                borderRadius: '8px',
                color: accentColor,
                fontSize: '13px',
                fontWeight: '600',
                padding: '8px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `${accentColor}22`)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              📋 {monthLabel} Results ({completedThisMonth.length})
            </button>
          )}
          {isMonthComplete && rankings && (
            <button
              onClick={() => setShowRankings(true)}
              style={{
                background: 'transparent',
                border: `1px solid ${accentColor}`,
                borderRadius: '8px',
                color: accentColor,
                fontSize: '13px',
                fontWeight: '600',
                padding: '8px 20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `${accentColor}22`)}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              📊 {monthLabel} Rankings
            </button>
          )}
        </div>
      )}

      {showSummary && (
        <MonthSummaryDialog
          monthLabel={monthLabel}
          completedTournaments={completedThisMonth}
          tour={tour}
          onClose={() => setShowSummary(false)}
        />
      )}

      {showRankings && rankings && (
        <RankingsDialog
          monthLabel={monthLabel}
          rankings={rankings}
          prevRankings={prevRankings}
          tour={tour}
          onClose={() => setShowRankings(false)}
        />
      )}
    </div>
  );
}
