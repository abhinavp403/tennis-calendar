import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { countryFlag } from '../utils/flags.js';
import PointsInfoDialog, { InfoButton } from './PointsInfoDialog.jsx';

// Top 8 in the race qualify for the season-ending Finals.
const CUTOFF = 8;

const GROUPS = [
  { key: 'slam', label: () => 'Grand Slams' },
  { key: 'masters', label: tour => (tour === 'atp' ? 'Masters 1000' : 'WTA 1000') },
  { key: 'other', label: () => 'Best other results' },
];

const ROUND_COLORS = { W: '#fbbf24', F: '#e5e7eb', SF: '#c4c4d4', QF: '#9ca3af' };

// Where a player's race points came from, one line per event, in the
// Wikipedia table's order. "A" = skipped a mandatory event (counts as 0).
function Breakdown({ results, tour }) {
  return (
    <div
      style={{
        margin: '0 0 8px 36px', padding: '10px 15px',
        background: 'rgba(255,255,255,0.025)', border: '1px solid #1e1e30', borderRadius: '8px',
      }}
    >
      {GROUPS.map(({ key, label }) => {
        const rows = results.filter(r => r.group === key);
        if (rows.length === 0) return null;
        const subtotal = rows.reduce((s, r) => s + r.points, 0);
        return (
          <div key={key} style={{ padding: '5px 0' }}>
            <div
              style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '12px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', marginBottom: '2px',
              }}
            >
              <span>{label(tour).toUpperCase()}</span>
              <span style={{ fontFamily: 'monospace' }}>{subtotal.toLocaleString()}</span>
            </div>
            {rows.map((r, i) => {
              const absent = r.round === 'A';
              return (
                <div
                  key={i}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 65px 60px', alignItems: 'center',
                    fontSize: '14.5px', padding: '2px 0', opacity: absent ? 0.45 : 1,
                  }}
                >
                  <span style={{ color: '#c4c4d4', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {r.event}
                  </span>
                  <span
                    style={{
                      fontSize: '12.5px', fontWeight: '700', textAlign: 'center',
                      color: ROUND_COLORS[r.round] ?? '#6b7280',
                    }}
                  >
                    {absent ? 'Skipped' : r.round === 'W' ? '🏆 W' : r.round}
                  </span>
                  <span style={{ fontFamily: 'monospace', textAlign: 'right', color: r.round === 'W' ? '#fbbf24' : '#9ca3af' }}>
                    {r.points.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export default function RaceToFinalsDialog({ race, finals, tour, onClose }) {
  const [showInfo, setShowInfo] = useState(false);
  // Name of the player whose breakdown is open (one at a time).
  const [expanded, setExpanded] = useState(null);
  useEffect(() => {
    // Escape closes the points explainer first, if open.
    const handler = e => { if (e.key === 'Escape') (showInfo ? setShowInfo(false) : onClose()); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, showInfo]);

  const accentColor = tour === 'atp' ? '#3388ff' : '#e060aa';
  const players = race?.players ?? [];
  const leaderPts = players[0]?.points || 1;
  const cutoffPts = players.find(p => p.rank === CUTOFF)?.points;
  const firstOutPts = players.find(p => p.rank === CUTOFF + 1)?.points;

  const finalsLine = finals
    ? `${finals.name} · ${finals.location?.split(',')[0]} · ${dayjs(finals.start).format('MMM D')}–${dayjs(finals.end).format('MMM D')}`
    : null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '30px',
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
            padding: '22px 25px 18px',
            borderBottom: '1px solid #2a2a3a',
            flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: '21px', fontWeight: '700', color: 'white' }}>
              🏁 Race to the Finals
              <InfoButton onClick={() => setShowInfo(true)} />
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '2px' }}>
              {players.length > 0 ? `Top ${players.length} ` : ''}{tour.toUpperCase()} Singles
              {race?.asOf && <> · as of {dayjs(race.asOf).format('MMM D')}</>}
            </div>
            {finalsLine && (
              <div style={{ fontSize: '14px', color: accentColor, marginTop: '2px', fontWeight: '600' }}>
                {finalsLine}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: '6px',
              color: '#9ca3af', fontSize: '22.5px', lineHeight: 1,
              width: '38px', height: '38px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2a2a3a')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1a1a24')}
          >
            ×
          </button>
        </div>

        {players.length === 0 ? (
          <div style={{ padding: '40px 25px', textAlign: 'center', color: '#6b7280', fontSize: '16px' }}>
            Race standings aren't available yet.
          </div>
        ) : (
          <>
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '45px 1fr 80px 92px',
                padding: '12px 25px 8px',
                borderBottom: '1px solid #1e1e30',
                flexShrink: 0,
              }}
            >
              {['#', 'PLAYER', 'POINTS', 'GAP'].map((h, i) => (
                <span
                  key={h}
                  style={{
                    fontSize: '12.5px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px',
                    textAlign: i >= 2 ? 'right' : 'left',
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            <div style={{ overflowY: 'auto', padding: '5px 25px 15px' }}>
              {players.map(player => {
                const inside = player.rank <= CUTOFF;
                // Inside the cutoff: cushion over the first player out.
                // Outside: points still needed to reach #8.
                let gap = null;
                if (inside && firstOutPts != null) gap = { text: `+${(player.points - firstOutPts).toLocaleString()}`, color: '#34d399' };
                if (!inside && cutoffPts != null) gap = { text: `−${(cutoffPts - player.points).toLocaleString()}`, color: '#f87171' };
                const canExpand = player.results?.length > 0;
                const isOpen = canExpand && expanded === player.name;

                return (
                  <div key={player.rank}>
                    <div
                      onClick={canExpand ? () => setExpanded(isOpen ? null : player.name) : undefined}
                      title={canExpand ? (isOpen ? 'Hide breakdown' : 'Show where the points came from') : undefined}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '45px 1fr 80px 92px',
                        alignItems: 'center',
                        padding: '10px 0 8px',
                        opacity: inside || isOpen ? 1 : 0.6,
                        cursor: canExpand ? 'pointer' : 'default',
                      }}
                    >
                      <span style={{ fontSize: '16px', fontWeight: '800', color: inside ? accentColor : '#9ca3af' }}>
                        {player.rank}
                      </span>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <span
                            title={player.country}
                            style={{ fontSize: '16px', color: '#6b7280', fontWeight: '600', flexShrink: 0, width: '29px', textAlign: 'center' }}
                          >
                            {countryFlag(player.country) || player.country}
                          </span>
                          <span
                            title={player.full}
                            style={{
                              fontSize: '16px', fontWeight: inside ? '700' : '500',
                              color: inside ? 'white' : '#c4c4d4',
                              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            }}
                          >
                            {player.name}
                          </span>
                          {player.qualified && (
                            <span
                              title="Qualified for the Finals"
                              style={{
                                fontSize: '11px', fontWeight: '800', letterSpacing: '0.5px',
                                padding: '1px 8px', borderRadius: '999px',
                                background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                                border: '1px solid rgba(251,191,36,0.4)', flexShrink: 0,
                              }}
                            >
                              QUALIFIED
                            </span>
                          )}
                        </div>
                        {/* Events played and titles won, where the source table has them */}
                        {player.tournaments != null && (
                          <div style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>
                            {player.tournaments} event{player.tournaments === 1 ? '' : 's'}
                            {player.titles > 0 && (
                              <> · <span style={{ color: '#fbbf24' }}>{player.titles} title{player.titles === 1 ? '' : 's'}</span></>
                            )}
                            {canExpand && (
                              <span style={{ color: isOpen ? accentColor : '#4b5580', fontWeight: '600' }}>
                                {' · '}breakdown {isOpen ? '▴' : '▾'}
                              </span>
                            )}
                          </div>
                        )}
                        {/* Points bar, relative to the leader */}
                        <div style={{ height: '5px', borderRadius: '2px', background: '#1e1e30', marginRight: '8px' }}>
                          <div
                            style={{
                              width: `${(player.points / leaderPts) * 100}%`,
                              height: '100%', borderRadius: '2px',
                              background: player.qualified ? '#fbbf24' : inside ? accentColor : '#4b5580',
                            }}
                          />
                        </div>
                      </div>

                      <span style={{ fontSize: '15px', fontFamily: 'monospace', fontWeight: '600', color: '#e5e7eb', textAlign: 'right' }}>
                        {player.points.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '14px', fontFamily: 'monospace', fontWeight: '700', color: gap?.color, textAlign: 'right' }}>
                        {gap?.text}
                      </span>
                    </div>

                    {isOpen && <Breakdown results={player.results} tour={tour} />}

                    {/* Qualification cutoff line after #8 */}
                    {player.rank === CUTOFF && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0' }}>
                        <div style={{ flex: 1, borderTop: '2px dashed #f87171' }} />
                        <span style={{ fontSize: '12.5px', fontWeight: '800', color: '#f87171', letterSpacing: '0.6px' }}>
                          QUALIFICATION CUTOFF
                        </span>
                        <div style={{ flex: 1, borderTop: '2px dashed #f87171' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '12px 25px 18px', borderTop: '1px solid #1e1e30', fontSize: '13px', color: '#6b7280', lineHeight: 1.5, flexShrink: 0 }}>
              Top {CUTOFF} qualify. GAP shows each player's cushion over #{CUTOFF + 1}, or the points still needed to reach #{CUTOFF}.
              {' '}Exception: a {new Date().getFullYear()} Grand Slam champion ranked 8–20 takes the 8th spot.
            </div>
          </>
        )}
      </div>
      {showInfo && <PointsInfoDialog tour={tour} onClose={() => setShowInfo(false)} />}
    </div>
  );
}
