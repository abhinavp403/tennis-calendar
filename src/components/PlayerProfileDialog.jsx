import { useEffect } from 'react';
import { countryFlag } from '../utils/flags.js';

const SURFACE_META = {
  Hard:          { short: 'Hard',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  'Indoor Hard': { short: 'Indoor', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  Clay:          { short: 'Clay',   color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  Grass:         { short: 'Grass',  color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
};

const levelLabel = level => {
  if (level === 2000) return 'Grand Slam';
  if (level === 1500) return 'Finals';
  if (level === 1000 || level === 500 || level === 250) return String(level);
  return level != null ? String(level) : '';
};

// The app's tier colours (see the calendar legend): Grand Slam / Finals violet,
// 1000 amber, 500 blue, 250 grey.
const LEVEL_COLOR = { 2000: '#a78bfa', 1500: '#a78bfa', 1000: '#f59e0b', 500: '#3b82f6', 250: '#8b8fa8' };

// Shared look for the level and surface tags on each tournament row.
const tagStyle = (color, bg) => ({
  fontSize: '12px', fontWeight: '700',
  padding: '3px 8px', borderRadius: '4px',
  background: bg, color,
  letterSpacing: '0.3px', whiteSpace: 'nowrap',
});

// Age from an ISO date of birth, computed at display time so it never goes
// stale (profiles.json stores the date, not the age).
function ageFrom(dob) {
  const [y, m, d] = dob.split('-').map(Number);
  const now = new Date();
  let age = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) age--;
  return age;
}

function heightLabel(cm) {
  const totalIn = Math.round(cm / 2.54);
  return `${cm} cm (${Math.floor(totalIn / 12)}′${totalIn % 12}″)`;
}

// Basic facts from profiles.json (Wikipedia infobox + Wikidata). Every field
// is optional — a few players lack a turned-pro year or height — so show what exists.
// The full name isn't here — it's the dialog's title instead. Short facts are
// paired two to a row; long ones (`wide`) take a full row so they aren't cut off.
function profileDetails(profile) {
  if (!profile || profile.missing) return [];
  const items = [];
  if (profile.dob) {
    const born = new Date(`${profile.dob}T00:00:00`).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
    items.push({ label: 'Age', value: String(ageFrom(profile.dob)), title: `Born ${born}` });
  }
  if (profile.heightCm) items.push({ label: 'Height', value: heightLabel(profile.heightCm) });
  if (profile.turnedPro) items.push({ label: 'Turned pro', value: String(profile.turnedPro) });
  if (profile.careerTitles != null) items.push({ label: 'Career titles', value: String(profile.careerTitles) });
  if (profile.careerHigh) {
    const when = profile.careerHighDate
      ? ` (${new Date(`${profile.careerHighDate}T00:00:00`).toLocaleDateString('en', { month: 'short', year: 'numeric' })})`
      : '';
    items.push({ label: 'Career high', value: `No. ${profile.careerHigh}${when}` });
  }
  if (profile.plays) {
    const hand = profile.plays === 'left' ? 'Left-handed' : 'Right-handed';
    items.push({ label: 'Plays', value: profile.backhand ? `${hand}, ${profile.backhand} backhand` : hand, wide: true });
  }
  if (profile.birthplace) items.push({ label: 'Born in', value: profile.birthplace, wide: true });
  if (profile.coach) items.push({ label: 'Coach', value: profile.coach, wide: true });
  return items;
}

export default function PlayerProfileDialog({ stat, profile, tour, monthLabel, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const accentColor = tour === 'atp' ? '#0066cc' : '#be398d';
  const accentGlow  = tour === 'atp' ? 'rgba(0,102,204,0.25)' : 'rgba(190,57,141,0.25)';

  // Best surface = max of surfaceWins. Tie-breaker: most finals overall.
  const bestSurface = Object.entries(stat.surfaceWins)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0];

  // Win rate in finals
  const winRate = stat.total > 0 ? Math.round((stat.wins / stat.total) * 100) : 0;

  const renderEntry = (t, key) => (
    <div
      key={key}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        alignItems: 'center',
        gap: '8px',
        padding: '11px 14px',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.02)',
        marginBottom: '4px',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '15.5px', color: '#e5e7eb', fontWeight: '600' }}>
          {t.name}
        </div>
        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>
          {[t.opponent && `vs ${t.opponent}`, t.score].filter(Boolean).join(' · ')}
        </div>
      </div>
      {/* Level, then surface — same tag style, each in its own colour */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        {levelLabel(t.level) && (
          <span style={tagStyle(LEVEL_COLOR[t.level] ?? '#8b8fa8', `${LEVEL_COLOR[t.level] ?? '#8b8fa8'}26`)}>
            {levelLabel(t.level)}
          </span>
        )}
        {SURFACE_META[t.surface] && (
          <span style={tagStyle(SURFACE_META[t.surface].color, SURFACE_META[t.surface].bg)}>
            {SURFACE_META[t.surface].short}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10002,
        backgroundColor: 'rgba(0,0,0,0.7)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: '#13131a',
          border: `1px solid ${accentColor}`,
          borderRadius: '12px',
          width: '100%',
          maxWidth: '700px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: `0 8px 40px rgba(0,0,0,0.9), 0 0 0 1px ${accentGlow}`,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
            padding: '24px 28px 18px',
            borderBottom: '1px solid #2a2a3a',
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
            <div style={{ fontSize: '27px', fontWeight: '700', color: 'white' }}>
              {stat.country && <span style={{ marginRight: '8px' }}>{countryFlag(stat.country)}</span>}
              {/* Full name when we have it ("Félix Auger-Aliassime"), else the abbreviated one */}
              {profile?.full ?? stat.name}
            </div>
            {profileDetails(profile).length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '7px 24px', marginTop: '14px', fontSize: '15px' }}>
                {profileDetails(profile).map(item => (
                  <div
                    key={item.label}
                    title={item.title}
                    style={item.wide ? { gridColumn: '1 / -1' } : { whiteSpace: 'nowrap' }}
                  >
                    <span style={{ color: '#6b7280' }}>{item.label}:</span>{' '}
                    <span style={{ color: '#e5e7eb', fontWeight: '600' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: '6px',
              color: '#9ca3af', fontSize: '22px', lineHeight: 1,
              width: '38px', height: '38px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2a2a3a')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1a1a24')}
          >
            ×
          </button>
        </div>

        {/* Summary stats row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            padding: '18px 28px',
            borderBottom: '1px solid #1e1e30',
            flexShrink: 0,
          }}
        >
          <Stat label="Titles" value={stat.wins} accent={accentColor} icon="🏆" />
          <Stat label="Finals"  value={stat.total} accent="#e5e7eb" icon="🎾" />
          <Stat label="Win %"   value={`${winRate}%`} accent={winRate >= 50 ? accentColor : '#9ca3af'} />
          <Stat
            label="Best Surface"
            value={bestSurface ? (SURFACE_META[bestSurface]?.short || bestSurface) : '—'}
            accent={bestSurface ? SURFACE_META[bestSurface]?.color : '#6b7280'}
          />
        </div>

        {/* Surface breakdown chips */}
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '6px',
            padding: '14px 28px',
            borderBottom: '1px solid #1e1e30',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '12px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', alignSelf: 'center', marginRight: '4px' }}>
            BY SURFACE
          </span>
          {Object.entries(SURFACE_META).map(([key, meta]) => {
            const w = stat.surfaceWins[key] || 0;
            const f = stat.surfaceFinals[key] || 0;
            const dim = f === 0;
            return (
              <span
                key={key}
                style={{
                  fontSize: '13px', fontWeight: '700',
                  padding: '5px 10px', borderRadius: '6px',
                  background: dim ? 'rgba(255,255,255,0.02)' : meta.bg,
                  color: dim ? '#3b3f55' : meta.color,
                  letterSpacing: '0.3px',
                }}
              >
                {meta.short} {w}{f > w ? ` / ${f}` : ''}
              </span>
            );
          })}
        </div>

        {/* Tournament lists */}
        <div style={{ overflowY: 'auto', padding: '18px 28px 24px' }}>
          {stat.winsList.length > 0 && (
            <div style={{ marginBottom: stat.runnerUpList.length > 0 ? '14px' : 0 }}>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#fde68a', letterSpacing: '0.5px', marginBottom: '8px' }}>
                🏆 TITLES ({stat.winsList.length})
              </div>
              {stat.winsList.map((t, i) => renderEntry(t, `w-${i}`))}
            </div>
          )}
          {stat.runnerUpList.length > 0 && (
            <div>
              <div style={{ fontSize: '12.5px', fontWeight: '700', color: '#9ca3af', letterSpacing: '0.5px', marginBottom: '8px' }}>
                🥈 RUNNER-UP ({stat.runnerUpList.length})
              </div>
              {stat.runnerUpList.map((t, i) => renderEntry(t, `r-${i}`))}
            </div>
          )}
          {stat.winsList.length === 0 && stat.runnerUpList.length === 0 && (
            <div style={{ color: '#6b7280', fontSize: '15px', textAlign: 'center', padding: '24px 0' }}>
              No final appearances yet.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent, icon }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '12px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: '700', color: accent }}>
        {icon && <span style={{ fontSize: '18px', marginRight: '4px' }}>{icon}</span>}
        {value}
      </div>
    </div>
  );
}
