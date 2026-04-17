import TournamentLogo from './TournamentLogo.jsx';

const TOUR_RING = {
  atp: '#3388ff',
  wta: '#e060aa',
};

const LEVEL_ACCENT = {
  2000: { border: '#7c3aed', glow: 'rgba(139,92,246,0.25)' },
  1000: { border: '#b45309', glow: 'rgba(245,158,11,0.15)' },
  500:  { border: '#1d4ed8', glow: 'rgba(59,130,246,0.12)' },
  250:  { border: '#374151', glow: 'rgba(107,114,128,0.08)' },
};

export default function DayCell({ day, dateStr, tournaments, isToday, tour }) {
  const ringColor = TOUR_RING[tour];

  // Pick the highest-level tournament for cell accent
  const topLevel = tournaments.reduce((max, t) => Math.max(max, t.level ?? 0), 0);
  const accent = LEVEL_ACCENT[topLevel];

  const hasTournament = tournaments.length > 0;
  const isWeekend = new Date(dateStr).getDay() === 0 || new Date(dateStr).getDay() === 6;

  const baseBg = isToday
    ? `linear-gradient(135deg, #0d1a33, #0a1428)`
    : hasTournament
    ? `linear-gradient(135deg, #14142a, #12122200)`
    : isWeekend
    ? '#111120'
    : '#13131f';

  return (
    <div
      style={{
        minHeight: '100px',
        background: baseBg,
        border: isToday
          ? `2px solid ${ringColor}`
          : hasTournament
          ? `1px solid ${accent.border}`
          : `1px solid ${isWeekend ? '#1c1c30' : '#1a1a2e'}`,
        borderRadius: '8px',
        padding: '6px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
        transition: 'all 0.15s',
        boxShadow: isToday
          ? `0 0 16px ${ringColor}44, inset 0 1px 0 ${ringColor}22`
          : hasTournament
          ? `0 0 8px ${accent.glow}`
          : 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = isToday ? ringColor : ringColor + '66';
        e.currentTarget.style.boxShadow = isToday
          ? `0 0 20px ${ringColor}55, inset 0 1px 0 ${ringColor}22`
          : `0 0 10px ${ringColor}22`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isToday
          ? ringColor
          : hasTournament
          ? accent.border
          : isWeekend ? '#1c1c30' : '#1a1a2e';
        e.currentTarget.style.boxShadow = isToday
          ? `0 0 16px ${ringColor}44, inset 0 1px 0 ${ringColor}22`
          : hasTournament
          ? `0 0 8px ${accent.glow}`
          : 'none';
      }}
    >
      {/* Day number */}
      <span
        style={{
          fontSize: '11px',
          fontWeight: isToday ? '800' : '500',
          color: isToday ? ringColor : isWeekend ? '#5a5a80' : '#4b5563',
          lineHeight: 1,
        }}
      >
        {day}
      </span>

      {/* Tournament logos */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', flex: 1, alignContent: 'flex-start' }}>
        {tournaments.map((t, idx) => (
          <TournamentLogo key={`${t.id}-${t.dateType}-${idx}`} tournament={t} />
        ))}
      </div>
    </div>
  );
}
