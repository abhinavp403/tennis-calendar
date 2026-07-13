import { useState } from 'react';
import dayjs from 'dayjs';
import DayCell from './DayCell.jsx';
import MonthSummaryDialog from './MonthSummaryDialog.jsx';
import RankingsDialog from './RankingsDialog.jsx';
import PlayerStatsDialog from './PlayerStatsDialog.jsx';

import { rankingKeyDate } from '../utils/rankingKeys.js';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function Calendar({ currentDate, tournaments, allTournaments, tour, rankingsData, flashId }) {
  const [showSummary, setShowSummary] = useState(false);
  const [showRankings, setShowRankings] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const monthStart = currentDate.startOf('month');
  const daysInMonth = currentDate.daysInMonth();
  const firstDayOfWeek = monthStart.day(); // 0=Sun … 6=Sat
  const today = dayjs();
  const todayStr = today.format('YYYY-MM-DD');

  // Results and stats always reflect the full tour schedule, not the
  // surface-filtered grid view (`tournaments` drives only the day cells).
  const statsSource = allTournaments ?? tournaments;

  // Tournaments that ended this month and have results
  const completedThisMonth = statsSource.filter(t =>
    t.winner &&
    dayjs(t.end).isBefore(today) &&
    dayjs(t.end).month() === currentDate.month() &&
    dayjs(t.end).year() === currentDate.year()
  ).sort((a, b) => (a.end > b.end ? 1 : -1));

  // Cumulative: all tournaments completed from start of season through end of current month
  const seasonStart = currentDate.startOf('year');
  const monthEndDate = currentDate.endOf('month');
  const cumulativeTournaments = statsSource.filter(t =>
    t.winner &&
    dayjs(t.end).isBefore(today) &&
    dayjs(t.end).isSameOrAfter(seasonStart) &&
    dayjs(t.end).isSameOrBefore(monthEndDate)
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

  // Rankings can be keyed by month ("2026-06", legacy) or by the exact
  // Monday they reflect ("2026-07-13", bi-weekly). Show the latest snapshot
  // that falls within the displayed month; compare movement to the one before.
  const tourRankings = rankingsData?.[tour] ?? {};
  const sortedRankingKeys = Object.keys(tourRankings).sort(
    (a, b) => rankingKeyDate(a) - rankingKeyDate(b)
  );
  const monthSnapshotKeys = sortedRankingKeys.filter(k => {
    const d = rankingKeyDate(k);
    return d.getFullYear() === currentDate.year() && d.getMonth() === currentDate.month();
  });
  const activeRankingKey = monthSnapshotKeys.at(-1) ?? null;
  const rankings = activeRankingKey ? tourRankings[activeRankingKey] : null;
  const activeRankingIdx = activeRankingKey ? sortedRankingKeys.indexOf(activeRankingKey) : -1;
  const prevRankings = activeRankingIdx > 0 ? tourRankings[sortedRankingKeys[activeRankingIdx - 1]] : null;

  return (
    <div className="w-full">
      {/* Month action buttons — above the grid for visibility */}
      {(completedThisMonth.length > 0 || cumulativeTournaments.length > 0 || rankings) && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginBottom: '16px', flexWrap: 'wrap' }}>
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
          {cumulativeTournaments.length > 0 && (
            <button
              onClick={() => setShowStats(true)}
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
              📈 Player Stats (YTD)
            </button>
          )}
          {rankings && (
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
            <div key={`pad-${i}`} className="day-cell" style={{ padding: 0 }} />
          ) : (
            <DayCell
              key={cell.dateStr}
              day={cell.day}
              dateStr={cell.dateStr}
              tournaments={cell.tournaments}
              isToday={cell.dateStr === todayStr}
              tour={tour}
              flash={flashId != null && cell.tournaments.some(t => t.id === flashId)}
            />
          )
        )}
      </div>

      {showSummary && (
        <MonthSummaryDialog
          monthLabel={monthLabel}
          completedTournaments={completedThisMonth}
          tour={tour}
          onClose={() => setShowSummary(false)}
        />
      )}

      {showStats && (
        <PlayerStatsDialog
          monthLabel={monthLabel}
          completedTournaments={cumulativeTournaments}
          tour={tour}
          onClose={() => setShowStats(false)}
        />
      )}

      {showRankings && rankings && (
        <RankingsDialog
          monthLabel={monthLabel}
          rankings={rankings}
          prevRankings={prevRankings}
          allRankings={tourRankings}
          activeKey={activeRankingKey}
          tour={tour}
          onClose={() => setShowRankings(false)}
        />
      )}
    </div>
  );
}
