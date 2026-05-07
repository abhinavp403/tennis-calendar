import { useEffect } from 'react';

const LEVEL_STYLES = {
  2000: { bg: '#2e1065', border: '#a78bfa', text: '#ede9fe' },
  1500: { bg: '#2e1065', border: '#a78bfa', text: '#ede9fe' },
  1000: { bg: '#92400e', border: '#ca8a04', text: '#fde68a' },
  500:  { bg: '#1e3a5f', border: '#3b82f6', text: '#93c5fd' },
  250:  { bg: '#1f2937', border: '#6b7280', text: '#d1d5db' },
};

export default function MonthSummaryDialog({ monthLabel, completedTournaments, tour, onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const accentColor = tour === 'atp' ? '#0066cc' : '#be398d';

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
          maxWidth: '560px',
          maxHeight: '80vh',
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
          }}
        >
          <div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: 'white' }}>
              {monthLabel} — Results
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px' }}>
              {completedTournaments.length} tournament{completedTournaments.length !== 1 ? 's' : ''} completed
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

        {/* Tournament list */}
        <div style={{ overflowY: 'auto', padding: '12px 20px 20px' }}>
          {completedTournaments.length === 0 ? (
            <div style={{ color: '#6b7280', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
              No completed tournaments this month.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {completedTournaments.map(t => {
                const s = LEVEL_STYLES[t.level] ?? LEVEL_STYLES[250];
                return (
                  <div
                    key={t.id}
                    style={{
                      backgroundColor: '#1a1a24',
                      border: `1px solid ${s.border}`,
                      borderRadius: '8px',
                      padding: '12px 14px',
                    }}
                  >
                    {/* Tournament name + meta */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span
                        style={{
                          fontSize: '10px', fontWeight: '700',
                          color: s.text, backgroundColor: s.bg,
                          border: `1px solid ${s.border}`,
                          borderRadius: '4px', padding: '1px 6px',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {t.level}
                      </span>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: 'white' }}>
                        {t.name}
                      </span>
                      <span style={{ fontSize: '11px', color: '#6b7280', marginLeft: 'auto', whiteSpace: 'nowrap' }}>
                        🎾 {t.surface}
                      </span>
                    </div>

                    {/* Result rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', width: '20px', textAlign: 'center' }}>🏆</span>
                        <span style={{ fontSize: '13px', fontWeight: '600', color: '#fde68a', flex: 1 }}>
                          {t.winner}
                        </span>
                        <span
                          style={{
                            fontSize: '12px', fontFamily: 'monospace', fontWeight: '700',
                            color: 'white', backgroundColor: '#0f0f13',
                            border: '1px solid #2a2a3a', borderRadius: '4px',
                            padding: '2px 8px', whiteSpace: 'nowrap',
                          }}
                        >
                          {t.score}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', width: '20px', textAlign: 'center' }}>🥈</span>
                        <span style={{ fontSize: '13px', color: '#9ca3af', flex: 1 }}>
                          {t.runner_up}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
