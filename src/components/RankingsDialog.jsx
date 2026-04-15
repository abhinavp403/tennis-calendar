import { useEffect } from 'react';

export default function RankingsDialog({ monthLabel, rankings, prevRankings, tour, onClose }) {
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
              Top 32 {tour.toUpperCase()} Singles
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
