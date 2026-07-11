import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

const LEVEL_STYLES = {
  2000: { label: 'Grand Slam', color: '#a78bfa', glow: 'rgba(167,139,250,0.35)' },
  1500: { label: 'Finals',     color: '#a78bfa', glow: 'rgba(167,139,250,0.3)' },
  1000: { label: '1000',       color: '#f59e0b', glow: 'rgba(245,158,11,0.25)' },
  500:  { label: '500',        color: '#60a5fa', glow: 'rgba(96,165,250,0.2)' },
  250:  { label: '250',        color: '#8b8fa8', glow: 'rgba(139,143,168,0.12)' },
};

const SURFACE_COLORS = {
  Hard: '#3b82f6', 'Indoor Hard': '#a78bfa', Clay: '#f97316', Grass: '#22c55e',
};

function CardLogo({ tournament }) {
  const [imgError, setImgError] = useState(false);
  const style = LEVEL_STYLES[tournament.level] ?? LEVEL_STYLES[250];
  if (imgError || !tournament.logo) {
    return (
      <div
        style={{
          width: 34, height: 34, borderRadius: 8, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#1a1a2e', border: `1px solid ${style.color}55`,
          fontSize: '11px', fontWeight: '800', color: style.color,
        }}
      >
        {tournament.name.slice(0, 2).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={`./logos/${tournament.logo}`}
      alt=""
      onError={() => setImgError(true)}
      style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'contain', flexShrink: 0, background: '#ffffff0d' }}
    />
  );
}

export default function ChampionsWallDialog({ tournaments, tour, onClose }) {
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const accentColor = tour === 'atp' ? '#0066cc' : '#be398d';
  const today = dayjs();

  const completed = tournaments
    .filter(t => t.winner && dayjs(t.end).isBefore(today))
    .sort((a, b) => (a.end > b.end ? 1 : -1));

  // Season summary
  const titleCounts = {};
  for (const t of completed) titleCounts[t.winner] = (titleCounts[t.winner] ?? 0) + 1;
  const uniqueChampions = Object.keys(titleCounts).length;
  const [topChampion, topCount] = Object.entries(titleCounts).sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const slamWinners = completed.filter(t => t.level === 2000).map(t => t.winner);

  // Group by month
  const byMonth = {};
  for (const t of completed) {
    const key = dayjs(t.end).format('MMMM');
    (byMonth[key] ??= []).push(t);
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.7)',
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
          maxWidth: '820px',
          maxHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.85)',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 22px 14px',
            borderBottom: '1px solid #2a2a3a',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: '18px', fontWeight: '700', color: 'white' }}>
              🏆 Champions Wall — 2026
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', letterSpacing: '0.3px' }}>
              Every {tour.toUpperCase()} title winner of the season so far
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

        {/* Season summary strip */}
        <div
          style={{
            display: 'flex', flexWrap: 'wrap', gap: '18px',
            padding: '12px 22px',
            borderBottom: '1px solid #1e1e30',
            flexShrink: 0,
          }}
        >
          {[
            { label: 'TITLES DECIDED', value: completed.length },
            { label: 'UNIQUE CHAMPIONS', value: uniqueChampions },
            topChampion && { label: 'MOST TITLES', value: `${topChampion} (${topCount})` },
            slamWinners.length > 0 && { label: 'SLAM CHAMPIONS', value: [...new Set(slamWinners)].join(', ') },
          ].filter(Boolean).map(s => (
            <div key={s.label}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.6px' }}>{s.label}</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#e5e7eb', marginTop: '2px' }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Wall */}
        <div style={{ overflowY: 'auto', padding: '16px 22px 22px' }}>
          {completed.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>
              No completed tournaments yet — the wall fills in as the season unfolds.
            </div>
          ) : (
            Object.entries(byMonth).map(([month, list]) => (
              <div key={month} style={{ marginBottom: '18px' }}>
                <div
                  style={{
                    fontSize: '11px', fontWeight: '800', color: accentColor,
                    letterSpacing: '1.2px', textTransform: 'uppercase',
                    marginBottom: '10px', paddingBottom: '4px',
                    borderBottom: '1px solid #1e1e30',
                  }}
                >
                  {month}
                </div>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
                    gap: '10px',
                  }}
                >
                  {list.map(t => {
                    const lv = LEVEL_STYLES[t.level] ?? LEVEL_STYLES[250];
                    return (
                      <div
                        key={t.id}
                        style={{
                          border: `1px solid ${lv.color}44`,
                          borderRadius: '10px',
                          padding: '10px 12px',
                          background: 'rgba(255,255,255,0.02)',
                          boxShadow: `0 0 12px ${lv.glow}`,
                          display: 'flex', flexDirection: 'column', gap: '8px',
                        }}
                      >
                        {/* Top row: logo + name + tier */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                          <CardLogo tournament={t} />
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div style={{ fontSize: '12px', fontWeight: '700', color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.name}
                            </div>
                            <div style={{ fontSize: '10px', color: '#6b7280', marginTop: '1px' }}>
                              {dayjs(t.end).format('MMM D')}
                              {t.surface && (
                                <span style={{ color: SURFACE_COLORS[t.surface] ?? '#9ca3af' }}> · {t.surface}</span>
                              )}
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: '9px', fontWeight: '800', letterSpacing: '0.4px',
                              padding: '2px 7px', borderRadius: '999px', flexShrink: 0,
                              border: `1px solid ${lv.color}66`, color: lv.color,
                            }}
                          >
                            {lv.label}
                          </span>
                        </div>
                        {/* Champion */}
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: '800', color: 'white' }}>
                            🏆 {t.winner}
                          </div>
                          {t.runner_up && (
                            <div style={{ fontSize: '11px', color: '#8b8fa8', marginTop: '2px' }}>
                              def. {t.runner_up}{t.score ? ` · ${t.score}` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
