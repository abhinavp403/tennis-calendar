import { useEffect } from 'react';

const SPARK_COLORS = ['#fbbf24', '#94a3b8', '#d97706']; // gold, silver, bronze

// Rankings keys are "YYYY-MM" (legacy monthly → month end) or "YYYY-MM-DD"
// (bi-weekly → exact date). Normalize for ordering and comparison.
function keyDate(key) {
  if (/^\d{4}-\d{2}$/.test(key)) {
    const [y, m] = key.split('-').map(Number);
    return new Date(y, m, 0);
  }
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Inline SVG line chart: the active snapshot's top-3 players' points across
// every earlier snapshot (monthly and bi-weekly), spaced evenly in order.
function RaceSparkline({ allRankings, activeKey, rankings }) {
  const activeDate = keyDate(activeKey);
  const keys = Object.keys(allRankings ?? {})
    .filter(k => keyDate(k) <= activeDate)
    .sort((a, b) => keyDate(a) - keyDate(b));
  if (keys.length < 2) return null; // one point is not a race

  const top3 = rankings.slice(0, 3);
  const series = top3.map(p => ({
    name: p.name,
    // Each entry: { points, wasTop3 } — hollow markers flag snapshots outside the top 3
    points: keys.map(k => {
      const row = allRankings[k]?.find(r => r.name === p.name);
      return row ? { points: row.points, wasTop3: row.rank <= 3 } : { points: null, wasTop3: false };
    }),
  }));

  const allValues = series.flatMap(s => s.points.map(e => e.points)).filter(v => v != null);
  if (allValues.length === 0) return null;
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const span = Math.max(max - min, 1);

  const W = 460, H = 88, PAD_X = 8, PAD_TOP = 8, PAD_BOTTOM = 18;
  const x = i => PAD_X + (i / (keys.length - 1)) * (W - PAD_X * 2);
  const y = v => PAD_TOP + (1 - (v - min) / span) * (H - PAD_TOP - PAD_BOTTOM);

  // Label first, last, and each month boundary to avoid crowding
  const labelFor = i => {
    const d = keyDate(keys[i]);
    if (i === 0 || i === keys.length - 1) return d.toLocaleString('en', { month: 'short' });
    if (keyDate(keys[i - 1]).getMonth() !== d.getMonth()) return d.toLocaleString('en', { month: 'short' });
    return null;
  };

  return (
    <div style={{ padding: '12px 20px 4px', borderBottom: '1px solid #1e1e30', flexShrink: 0 }}>
      <div style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', marginBottom: '6px' }}>
        RACE TO #1 — POINTS OVER TIME
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        {/* Time-axis labels */}
        {keys.map((k, i) => {
          const label = labelFor(i);
          if (!label) return null;
          return (
            <text
              key={k}
              x={x(i)}
              y={H - 4}
              textAnchor={i === 0 ? 'start' : i === keys.length - 1 ? 'end' : 'middle'}
              style={{ fontSize: '9px', fill: '#4b5580', fontWeight: 600 }}
            >
              {label}
            </text>
          );
        })}
        {/* Series lines + dots */}
        {series.map((s, si) => {
          const pts = s.points
            .map((e, i) => (e.points == null ? null : `${x(i)},${y(e.points)}`))
            .filter(Boolean)
            .join(' ');
          return (
            <g key={s.name}>
              <polyline
                points={pts}
                fill="none"
                stroke={SPARK_COLORS[si]}
                strokeWidth="2"
                strokeLinejoin="round"
                strokeLinecap="round"
                opacity={si === 0 ? 1 : 0.75}
              />
              {s.points.map((e, i) => {
                if (e.points == null) return null;
                const isLast = i === s.points.length - 1;
                // Hollow marker = snapshot spent outside the top 3
                return e.wasTop3 ? (
                  <circle key={i} cx={x(i)} cy={y(e.points)} r={isLast ? 3 : 1.8} fill={SPARK_COLORS[si]} />
                ) : (
                  <circle
                    key={i}
                    cx={x(i)} cy={y(e.points)} r={isLast ? 3 : 2.4}
                    fill="#13131a" stroke={SPARK_COLORS[si]} strokeWidth="1.4"
                  />
                );
              })}
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '6px 0 6px' }}>
        {series.map((s, si) => (
          <span key={s.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: '600', color: '#c4c4d4' }}>
            <span style={{ width: 10, height: 3, borderRadius: 2, background: SPARK_COLORS[si], display: 'inline-block' }} />
            {s.name}
            <span style={{ color: '#6b7280', fontFamily: 'monospace', fontSize: '10px' }}>
              {(s.points.at(-1)?.points ?? 0).toLocaleString()}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function RankingsDialog({ monthLabel, rankings, prevRankings, allRankings, activeKey, tour, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const accentColor = tour === 'atp' ? '#0066cc' : '#be398d';

  // Build a lookup from previous month: name → rank
  const prevByName = {};
  if (prevRankings) {
    for (const p of prevRankings) {
      prevByName[p.name] = p.rank;
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: '#13131a',
          border: '1px solid #2a2a3a',
          borderRadius: '12px',
          width: '100%',
          maxWidth: '520px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px 14px',
            borderBottom: '1px solid #2a2a3a',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: 'white' }}>
              {monthLabel} — Rankings
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
              Top {rankings.length} {tour.toUpperCase()} Singles
              {/^\d{4}-\d{2}-\d{2}$/.test(activeKey ?? '') && (
                <> · as of {keyDate(activeKey).toLocaleString('en', { month: 'short', day: 'numeric' })}</>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: '6px',
              color: '#9ca3af', fontSize: '18px', lineHeight: 1,
              width: '32px', height: '32px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2a2a3a')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1a1a24')}
          >
            ×
          </button>
        </div>

        {/* Race to #1 sparkline */}
        <RaceSparkline allRankings={allRankings} activeKey={activeKey} rankings={rankings} />

        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '36px 1fr 70px 40px',
            padding: '10px 20px 6px',
            borderBottom: '1px solid #1e1e30',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px' }}>#</span>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px' }}>PLAYER</span>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', textAlign: 'right' }}>POINTS</span>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', textAlign: 'center' }}>MOVE</span>
        </div>

        {/* Rankings list */}
        <div style={{ overflowY: 'auto', padding: '4px 20px 16px' }}>
          {rankings.map(player => {
            const prevRank = prevByName[player.name];
            const diff = prevRank != null ? prevRank - player.rank : null;

            let moveIcon = null;
            let moveColor = '#4b5580';
            if (diff === null) {
              moveIcon = 'NEW';
              moveColor = '#60a5fa';
            } else if (diff > 0) {
              moveIcon = `▲${diff}`;
              moveColor = '#34d399';
            } else if (diff < 0) {
              moveIcon = `▼${Math.abs(diff)}`;
              moveColor = '#f87171';
            } else {
              moveIcon = '—';
              moveColor = '#4b5580';
            }

            const isTop3 = player.rank <= 3;
            const isTop10 = player.rank <= 10;

            return (
              <div
                key={player.rank}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '36px 1fr 70px 40px',
                  alignItems: 'center',
                  padding: '7px 0',
                  borderBottom: player.rank === 10 || player.rank === 20
                    ? '1px solid #252540'
                    : '1px solid #1a1a28',
                }}
              >
                {/* Rank */}
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: isTop3 ? '800' : '600',
                    color: isTop3 ? accentColor : isTop10 ? '#e5e7eb' : '#9ca3af',
                  }}
                >
                  {player.rank}
                </span>

                {/* Player name + country */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#6b7280',
                      fontWeight: '600',
                      letterSpacing: '0.5px',
                      flexShrink: 0,
                      width: '28px',
                    }}
                  >
                    {player.country}
                  </span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: isTop3 ? '700' : '500',
                      color: isTop3 ? 'white' : isTop10 ? '#e5e7eb' : '#c4c4d4',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {player.name}
                  </span>
                </div>

                {/* Points */}
                <span
                  style={{
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    fontWeight: '600',
                    color: isTop10 ? '#e5e7eb' : '#9ca3af',
                    textAlign: 'right',
                  }}
                >
                  {player.points.toLocaleString()}
                </span>

                {/* Movement indicator */}
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '700',
                    color: moveColor,
                    textAlign: 'center',
                  }}
                >
                  {moveIcon}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
