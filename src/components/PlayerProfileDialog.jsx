import { useEffect } from 'react';

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

export default function PlayerProfileDialog({ stat, tour, monthLabel, onClose }) {
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
        padding: '8px 10px',
        borderRadius: '6px',
        background: 'rgba(255,255,255,0.02)',
        marginBottom: '4px',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: '#e5e7eb', fontWeight: '600' }}>
          {t.name}
        </div>
        <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
          {t.opponent && <>vs {t.opponent} · </>}
          {t.score && <>{t.score} · </>}
          {levelLabel(t.level)}
        </div>
      </div>
      {SURFACE_META[t.surface] && (
        <span
          style={{
            fontSize: '10px', fontWeight: '700',
            padding: '2px 6px', borderRadius: '4px',
            background: SURFACE_META[t.surface].bg,
            color:      SURFACE_META[t.surface].color,
            letterSpacing: '0.3px', whiteSpace: 'nowrap',
          }}
        >
          {SURFACE_META[t.surface].short}
        </span>
      )}
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
          maxWidth: '540px',
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
            padding: '18px 20px 14px',
            borderBottom: '1px solid #2a2a3a',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: 'white' }}>
              {stat.name}
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', letterSpacing: '0.4px' }}>
              {tour.toUpperCase()} · {monthLabel} (YTD)
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: '6px',
              color: '#9ca3af', fontSize: '18px', lineHeight: 1,
              width: '32px', height: '32px', cursor: 'pointer',
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
            padding: '14px 20px',
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
            padding: '12px 20px',
            borderBottom: '1px solid #1e1e30',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', alignSelf: 'center', marginRight: '4px' }}>
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
                  fontSize: '11px', fontWeight: '700',
                  padding: '4px 8px', borderRadius: '6px',
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
        <div style={{ overflowY: 'auto', padding: '14px 20px 18px' }}>
          {stat.winsList.length > 0 && (
            <div style={{ marginBottom: stat.runnerUpList.length > 0 ? '14px' : 0 }}>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#fde68a', letterSpacing: '0.5px', marginBottom: '8px' }}>
                🏆 TITLES ({stat.winsList.length})
              </div>
              {stat.winsList.map((t, i) => renderEntry(t, `w-${i}`))}
            </div>
          )}
          {stat.runnerUpList.length > 0 && (
            <div>
              <div style={{ fontSize: '10px', fontWeight: '700', color: '#9ca3af', letterSpacing: '0.5px', marginBottom: '8px' }}>
                🥈 RUNNER-UP ({stat.runnerUpList.length})
              </div>
              {stat.runnerUpList.map((t, i) => renderEntry(t, `r-${i}`))}
            </div>
          )}
          {stat.winsList.length === 0 && stat.runnerUpList.length === 0 && (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
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
      <div style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '18px', fontWeight: '700', color: accent }}>
        {icon && <span style={{ fontSize: '14px', marginRight: '4px' }}>{icon}</span>}
        {value}
      </div>
    </div>
  );
}
