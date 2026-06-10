import { useEffect, useState } from 'react';

export default function PlayerStatsDialog({ monthLabel, completedTournaments, tour, onClose }) {
  const [hoveredPlayer, setHoveredPlayer] = useState(null);

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const accentColor = tour === 'atp' ? '#0066cc' : '#be398d';

  const levelLabel = level => {
    if (level === 2000) return 'Grand Slam';
    if (level === 1500) return 'Finals';
    if (level === 1000 || level === 500 || level === 250) return String(level);
    return level != null ? String(level) : '';
  };

  // Aggregate player stats: name → {wins, runnerUp, winsList, runnerUpList}
  // Each list entry is {name, level} so the hover tooltip can show tier alongside title.
  const playerStats = {};
  for (const tournament of completedTournaments) {
    const entry = { name: tournament.name, level: tournament.level };
    if (tournament.winner) {
      if (!playerStats[tournament.winner]) {
        playerStats[tournament.winner] = { wins: 0, runnerUp: 0, winsList: [], runnerUpList: [] };
      }
      playerStats[tournament.winner].wins += 1;
      playerStats[tournament.winner].winsList.push(entry);
    }
    if (tournament.runner_up) {
      if (!playerStats[tournament.runner_up]) {
        playerStats[tournament.runner_up] = { wins: 0, runnerUp: 0, winsList: [], runnerUpList: [] };
      }
      playerStats[tournament.runner_up].runnerUp += 1;
      playerStats[tournament.runner_up].runnerUpList.push(entry);
    }
  }

  // Convert to array and sort by wins (desc), then by runner-up (desc)
  const stats = Object.entries(playerStats)
    .map(([name, data]) => ({
      name,
      wins: data.wins,
      runnerUp: data.runnerUp,
      total: data.wins + data.runnerUp,
      winsList: data.winsList,
      runnerUpList: data.runnerUpList,
    }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.runnerUp - a.runnerUp;
    });

  // Dense rank: ties (same wins AND runnerUp) share a rank number.
  // The next distinct row uses (index + 1).
  for (let i = 0; i < stats.length; i++) {
    if (i > 0 && stats[i].wins === stats[i - 1].wins && stats[i].runnerUp === stats[i - 1].runnerUp) {
      stats[i].rank = stats[i - 1].rank;
    } else {
      stats[i].rank = i + 1;
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
              {stats.length} player{stats.length !== 1 ? 's' : ''} — year-to-date cumulative
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
            gridTemplateColumns: '40px 1fr 60px 80px 60px',
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
                  gridTemplateColumns: '40px 1fr 60px 80px 60px',
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

                {/* Player name (with hover tooltip listing tournaments) */}
                <span
                  onMouseEnter={() => setHoveredPlayer(stat.name)}
                  onMouseLeave={() => setHoveredPlayer(null)}
                  style={{
                    position: 'relative',
                    fontSize: '13px',
                    fontWeight: stat.wins > 0 ? '600' : '500',
                    color: stat.wins > 0 ? 'white' : '#c4c4d4',
                    cursor: 'default',
                    width: 'fit-content',
                  }}
                >
                  {stat.name}
                  {hoveredPlayer === stat.name && (stat.winsList.length > 0 || stat.runnerUpList.length > 0) && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        marginTop: '6px',
                        zIndex: 20,
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
                  )}
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

                {/* Total */}
                <span
                  style={{
                    fontSize: '13px',
                    fontWeight: '600',
                    textAlign: 'center',
                    color: '#9ca3af',
                  }}
                >
                  {stat.total}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
