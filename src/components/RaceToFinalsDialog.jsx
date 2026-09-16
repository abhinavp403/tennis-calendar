import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { countryFlag } from '../utils/flags.js';
import PointsInfoDialog, { InfoButton } from './PointsInfoDialog.jsx';

// Top 8 in the race qualify for the season-ending Finals.
const CUTOFF = 8;

export default function RaceToFinalsDialog({ race, finals, tour, onClose }) {
  const [showInfo, setShowInfo] = useState(false);
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
              🏁 Race to the Finals
              <InfoButton onClick={() => setShowInfo(true)} />
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
              {players.length > 0 ? `Top ${players.length} ` : ''}{tour.toUpperCase()} Singles
              {race?.asOf && <> · as of {dayjs(race.asOf).format('MMM D')}</>}
            </div>
            {finalsLine && (
              <div style={{ fontSize: '11px', color: accentColor, marginTop: '2px', fontWeight: '600' }}>
                {finalsLine}
              </div>
            )}
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

        {players.length === 0 ? (
          <div style={{ padding: '32px 20px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
            Race standings aren't available yet.
          </div>
        ) : (
          <>
            {/* Table header */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '36px 1fr 64px 74px',
                padding: '10px 20px 6px',
                borderBottom: '1px solid #1e1e30',
                flexShrink: 0,
              }}
            >
              {['#', 'PLAYER', 'POINTS', 'GAP'].map((h, i) => (
                <span
                  key={h}
                  style={{
                    fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px',
                    textAlign: i >= 2 ? 'right' : 'left',
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            <div style={{ overflowY: 'auto', padding: '4px 20px 12px' }}>
              {players.map(player => {
                const inside = player.rank <= CUTOFF;
                // Inside the cutoff: cushion over the first player out.
                // Outside: points still needed to reach #8.
                let gap = null;
                if (inside && firstOutPts != null) gap = { text: `+${(player.points - firstOutPts).toLocaleString()}`, color: '#34d399' };
                if (!inside && cutoffPts != null) gap = { text: `−${(cutoffPts - player.points).toLocaleString()}`, color: '#f87171' };

                return (
                  <div key={player.rank}>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '36px 1fr 64px 74px',
                        alignItems: 'center',
                        padding: '8px 0 6px',
                        opacity: inside ? 1 : 0.6,
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: '800', color: inside ? accentColor : '#9ca3af' }}>
                        {player.rank}
                      </span>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                          <span
                            title={player.country}
                            style={{ fontSize: '13px', color: '#6b7280', fontWeight: '600', flexShrink: 0, width: '24px', textAlign: 'center' }}
                          >
                            {countryFlag(player.country) || player.country}
                          </span>
                          <span
                            title={player.full}
                            style={{
                              fontSize: '13px', fontWeight: inside ? '700' : '500',
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
                                fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px',
                                padding: '1px 6px', borderRadius: '999px',
                                background: 'rgba(251,191,36,0.15)', color: '#fbbf24',
                                border: '1px solid rgba(251,191,36,0.4)', flexShrink: 0,
                              }}
                            >
                              QUALIFIED
                            </span>
                          )}
                        </div>
                        {/* Points bar, relative to the leader */}
                        <div style={{ height: '4px', borderRadius: '2px', background: '#1e1e30', marginRight: '8px' }}>
                          <div
                            style={{
                              width: `${(player.points / leaderPts) * 100}%`,
                              height: '100%', borderRadius: '2px',
                              background: player.qualified ? '#fbbf24' : inside ? accentColor : '#4b5580',
                            }}
                          />
                        </div>
                      </div>

                      <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: '600', color: '#e5e7eb', textAlign: 'right' }}>
                        {player.points.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: '700', color: gap?.color, textAlign: 'right' }}>
                        {gap?.text}
                      </span>
                    </div>

                    {/* Qualification cutoff line after #8 */}
                    {player.rank === CUTOFF && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '6px 0' }}>
                        <div style={{ flex: 1, borderTop: '2px dashed #f87171' }} />
                        <span style={{ fontSize: '10px', fontWeight: '800', color: '#f87171', letterSpacing: '0.6px' }}>
                          QUALIFICATION CUTOFF
                        </span>
                        <div style={{ flex: 1, borderTop: '2px dashed #f87171' }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ padding: '10px 20px 14px', borderTop: '1px solid #1e1e30', fontSize: '10.5px', color: '#6b7280', lineHeight: 1.5, flexShrink: 0 }}>
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
