import { useEffect, useState } from 'react';
import PlayerProfileDialog from './PlayerProfileDialog.jsx';
import { buildPlayerStats } from '../utils/playerStats.js';
import { countryFlag } from '../utils/flags.js';

const SURFACE_META = {
  Hard:          { short: 'Hard',   color: '#3b82f6', bg: 'rgba(59,130,246,0.15)' },
  'Indoor Hard': { short: 'Indoor', color: '#a78bfa', bg: 'rgba(167,139,250,0.15)' },
  Clay:          { short: 'Clay',   color: '#f97316', bg: 'rgba(249,115,22,0.15)' },
  Grass:         { short: 'Grass',  color: '#22c55e', bg: 'rgba(34,197,94,0.15)' },
};

export default function PlayerStatsDialog({ monthLabel, completedTournaments, tour, countryByName, onClose }) {
  // hoveredPlayer = null | { name, top, left, placeAbove }
  const [hoveredPlayer, setHoveredPlayer] = useState(null);
  // selectedPlayer = null | string (player name)
  const [selectedPlayer, setSelectedPlayer] = useState(null);

  const showTooltip = (e, stat) => {
    if (stat.winsList.length === 0 && stat.runnerUpList.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    // Rough estimate: 22px header + 18px per entry + 14px section gap if both lists present
    const estHeight =
      22 + stat.winsList.length * 18 + stat.runnerUpList.length * 18 +
      (stat.winsList.length > 0 && stat.runnerUpList.length > 0 ? 14 : 0) +
      24; // padding
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < estHeight + 16;
    // Keep the tooltip (maxWidth 320px) from overflowing the right viewport edge
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 328));
    setHoveredPlayer({
      name: stat.name,
      left,
      top: placeAbove ? rect.top - 6 : rect.bottom + 6,
      placeAbove,
    });
  };

  const hideTooltip = () => setHoveredPlayer(null);

  useEffect(() => {
    // When the profile drill-down is open, Escape closes only the profile
    // (the profile dialog has its own listener); otherwise close this dialog.
    const handler = e => { if (e.key === 'Escape' && !selectedPlayer) onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, selectedPlayer]);

  const accentColor = tour === 'atp' ? '#0066cc' : '#be398d';

  const levelLabel = level => {
    if (level === 2000) return 'Grand Slam';
    if (level === 1500) return 'Finals';
    if (level === 1000 || level === 500 || level === 250) return String(level);
    return level != null ? String(level) : '';
  };

  // Aggregate + rank players (level-weighted points). Shared with the header
  // player search so both surface an identical leaderboard.
  const stats = buildPlayerStats(completedTournaments, countryByName);

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
          maxWidth: '500px',
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
              {monthLabel} — Player Stats (YTD)
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
              {stats.length} player{stats.length !== 1 ? 's' : ''} — ranked by level-weighted points (YTD)
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

        {/* Table header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '34px 1fr 52px 74px 54px 58px',
            padding: '10px 20px 6px',
            borderBottom: '1px solid #1e1e30',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px' }}>#</span>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px' }}>PLAYER</span>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', textAlign: 'center' }}>WINS</span>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', textAlign: 'center' }}>RUNNER-UP</span>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', textAlign: 'center' }}>TOTAL</span>
          <span style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', textAlign: 'center' }}>PTS</span>
        </div>

        {/* Stats list */}
        <div style={{ overflowY: 'auto', padding: '4px 20px 16px' }}>
          {stats.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
              No players with tournament results this month.
            </div>
          ) : (
            stats.map((stat, idx) => (
              <div
                key={stat.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '34px 1fr 52px 74px 54px 58px',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: idx === stats.length - 1 ? 'none' : '1px solid #1a1a28',
                }}
              >
                {/* Rank */}
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    color: stat.wins > 0 ? accentColor : '#6b7280',
                  }}
                >
                  {stat.rank}
                </span>

                {/* Player name — hover for breakdown, click for full profile */}
                <span
                  onMouseEnter={e => showTooltip(e, stat)}
                  onMouseLeave={hideTooltip}
                  onClick={() => { hideTooltip(); setSelectedPlayer(stat.name); }}
                  style={{
                    fontSize: '13px',
                    fontWeight: stat.wins > 0 ? '600' : '500',
                    color: stat.wins > 0 ? 'white' : '#c4c4d4',
                    cursor: 'pointer',
                    width: 'fit-content',
                    textDecoration: 'underline',
                    textDecorationColor: 'transparent',
                    textUnderlineOffset: '3px',
                    transition: 'text-decoration-color 0.15s',
                  }}
                  onMouseOver={e => (e.currentTarget.style.textDecorationColor = accentColor)}
                  onMouseOut={e => (e.currentTarget.style.textDecorationColor = 'transparent')}
                >
                  {stat.country && (
                    <span style={{ marginRight: '6px', textDecoration: 'none' }}>{countryFlag(stat.country)}</span>
                  )}
                  {stat.name}
                </span>

                {/* Wins */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#fde68a' }}>🏆</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '700',
                      color: stat.wins > 0 ? accentColor : '#4b5580',
                    }}
                  >
                    {stat.wins}
                  </span>
                </div>

                {/* Runner-up */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>🥈</span>
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: '600',
                      color: stat.runnerUp > 0 ? '#e5e7eb' : '#4b5580',
                    }}
                  >
                    {stat.runnerUp}
                  </span>
                </div>

                {/* Total finals (wins + runner-ups) */}
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    textAlign: 'center',
                    color: stat.total > 0 ? '#9ca3af' : '#4b5580',
                  }}
                >
                  {stat.total}
                </span>

                {/* Points (level-weighted, the ranking key) */}
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    textAlign: 'center',
                    color: stat.points > 0 ? '#e5e7eb' : '#4b5580',
                  }}
                >
                  {stat.points.toLocaleString()}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Floating tooltip rendered outside the scroll container so it never clips */}
      {hoveredPlayer && (() => {
        const stat = stats.find(s => s.name === hoveredPlayer.name);
        if (!stat) return null;
        return (
          <div
            style={{
              position: 'fixed',
              left: hoveredPlayer.left,
              top: hoveredPlayer.top,
              transform: hoveredPlayer.placeAbove ? 'translateY(-100%)' : 'none',
              zIndex: 10001,
              backgroundColor: '#0c0c14',
              border: `1px solid ${accentColor}`,
              borderRadius: '8px',
              padding: '10px 12px',
              minWidth: '240px',
              maxWidth: '320px',
              boxShadow: '0 6px 24px rgba(0,0,0,0.7)',
              fontWeight: '500',
              pointerEvents: 'none',
            }}
          >
            {/* Surface specialization chips */}
            {(stat.wins > 0 || stat.runnerUp > 0) && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '8px' }}>
                {Object.entries(SURFACE_META).map(([key, meta]) => {
                  const w = stat.surfaceWins?.[key] || 0;
                  const f = stat.surfaceFinals?.[key] || 0;
                  if (f === 0) return null;
                  return (
                    <span
                      key={key}
                      style={{
                        fontSize: '10px', fontWeight: '700',
                        padding: '2px 6px', borderRadius: '4px',
                        background: meta.bg, color: meta.color,
                        letterSpacing: '0.3px',
                      }}
                    >
                      {meta.short} {w}{f > w ? `/${f}` : ''}
                    </span>
                  );
                })}
              </div>
            )}
            {stat.winsList.length > 0 && (
              <div style={{ marginBottom: stat.runnerUpList.length > 0 ? '8px' : 0 }}>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#fde68a', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  🏆 WINS ({stat.winsList.length})
                </div>
                {stat.winsList.map((t, i) => (
                  <div key={`w-${i}`} style={{ fontSize: '12px', color: '#e5e7eb', lineHeight: '1.5' }}>
                    {t.name}
                    {t.level != null && (
                      <span style={{ color: '#6b7280', fontWeight: '500' }}> · {levelLabel(t.level)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
            {stat.runnerUpList.length > 0 && (
              <div>
                <div style={{ fontSize: '10px', fontWeight: '700', color: '#9ca3af', letterSpacing: '0.5px', marginBottom: '4px' }}>
                  🥈 RUNNER-UP ({stat.runnerUpList.length})
                </div>
                {stat.runnerUpList.map((t, i) => (
                  <div key={`r-${i}`} style={{ fontSize: '12px', color: '#c4c4d4', lineHeight: '1.5' }}>
                    {t.name}
                    {t.level != null && (
                      <span style={{ color: '#6b7280', fontWeight: '500' }}> · {levelLabel(t.level)}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* Player profile drill-down */}
      {selectedPlayer && (() => {
        const stat = stats.find(s => s.name === selectedPlayer);
        if (!stat) return null;
        return (
          <PlayerProfileDialog
            stat={stat}
            tour={tour}
            monthLabel={monthLabel}
            onClose={() => setSelectedPlayer(null)}
          />
        );
      })()}
    </div>
  );
}
