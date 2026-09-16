// Explains how tennis ranking points work. Opened from the ⓘ button in the
// Rankings and Race to the Finals dialogs; the parent owns the open state and
// its Escape handler closes this first.

const ROUNDS = ['W', 'F', 'SF', 'QF', 'R16'];

// 2026 points for reaching each round (W = champion, F = runner-up, …).
const POINTS = {
  atp: [
    { level: 'Grand Slam', color: '#a78bfa', pts: [2000, 1300, 800, 400, 200] },
    { level: 'Masters 1000', color: '#f59e0b', pts: [1000, 650, 400, 200, 100] },
    { level: '500', color: '#3b82f6', pts: [500, 330, 200, 100, 50] },
    { level: '250', color: '#8b8fa8', pts: [250, 165, 100, 50, 25] },
  ],
  wta: [
    { level: 'Grand Slam', color: '#a78bfa', pts: [2000, 1300, 780, 430, 240] },
    { level: 'WTA 1000', color: '#f59e0b', pts: [1000, 650, 390, 215, 120] },
    { level: '500', color: '#3b82f6', pts: [500, 325, 195, 108, 60] },
    { level: '250', color: '#8b8fa8', pts: [250, 163, 98, 54, 30] },
  ],
};

export function InfoButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="How ranking points work"
      style={{
        background: 'none', border: '1px solid #2a2a3a', borderRadius: '50%',
        color: '#6b7280', fontSize: '11px', fontWeight: '700', fontStyle: 'italic',
        fontFamily: 'Georgia, serif', width: '18px', height: '18px', lineHeight: 1,
        cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        marginLeft: '8px', verticalAlign: 'middle', padding: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.color = 'white'; e.currentTarget.style.borderColor = '#6b7280'; }}
      onMouseLeave={e => { e.currentTarget.style.color = '#6b7280'; e.currentTarget.style.borderColor = '#2a2a3a'; }}
    >
      i
    </button>
  );
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ fontSize: '10px', fontWeight: '700', color: '#4b5580', letterSpacing: '0.5px', marginBottom: '6px' }}>
        {title}
      </div>
      <div style={{ fontSize: '12.5px', color: '#c4c4d4', lineHeight: 1.55 }}>{children}</div>
    </div>
  );
}

export default function PointsInfoDialog({ tour, onClose }) {
  const accentColor = tour === 'atp' ? '#3388ff' : '#e060aa';
  const rows = POINTS[tour];
  const cell = { padding: '6px 4px', textAlign: 'right', fontFamily: 'monospace', fontSize: '12px' };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10001,
        backgroundColor: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          backgroundColor: '#13131a', border: '1px solid #2a2a3a', borderRadius: '12px',
          width: '100%', maxWidth: '500px', maxHeight: '85vh',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px 14px', borderBottom: '1px solid #2a2a3a', flexShrink: 0,
          }}
        >
          <div>
            <div style={{ fontSize: '17px', fontWeight: '700', color: 'white' }}>How ranking points work</div>
            <div style={{ fontSize: '11px', color: accentColor, marginTop: '2px', fontWeight: '600' }}>
              {tour.toUpperCase()} singles
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

        <div style={{ overflowY: 'auto', padding: '16px 20px 8px' }}>
          <Section title="THE BASICS">
            Players earn points for how far they get in each tournament. Bigger tournaments are worth
            more, and going further is worth more. You get the points for the round you <em>reach</em> —
            losing in the final still earns the runner-up points.
          </Section>

          <Section title="POINTS PER ROUND">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...cell, textAlign: 'left', fontFamily: 'inherit', fontSize: '10px', color: '#4b5580' }}>LEVEL</th>
                    {ROUNDS.map(r => (
                      <th key={r} style={{ ...cell, fontFamily: 'inherit', fontSize: '10px', color: '#4b5580' }}>{r}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => (
                    <tr key={row.level} style={{ borderTop: '1px solid #1e1e30' }}>
                      <td style={{ ...cell, textAlign: 'left', fontFamily: 'inherit', fontWeight: '700', color: row.color }}>
                        {row.level}
                      </td>
                      {row.pts.map((p, i) => (
                        <td key={i} style={{ ...cell, color: i === 0 ? 'white' : '#c4c4d4', fontWeight: i === 0 ? '700' : '500' }}>
                          {p.toLocaleString()}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
              W = champion · F = runner-up · SF / QF = lost in the semis / quarters · R16 = lost in the round of 16.
              Earlier rounds earn less. The season-ending {tour.toUpperCase()} Finals is worth up to 1,500 for an unbeaten champion.
            </div>
          </Section>

          <Section title="ONLY THE BEST RESULTS COUNT">
            A player's total is their best 18 results. The four Grand Slams and the biggest 1000-level
            events are mandatory — they count even if the player skips them (as zero), unless injured.
            The rest are filled by their best other results.
          </Section>

          <Section title="RANKINGS vs. THE RACE">
            <b style={{ color: 'white' }}>Rankings</b> cover the last 52 weeks. Points "drop off" a year
            after they're earned, so a player must defend last year's results to keep their ranking.
            <br />
            <b style={{ color: 'white' }}>The Race</b> uses the same points but only counts the current
            year — everyone starts at zero in January. The top 8 at the end of the season qualify for the Finals.
          </Section>

          <Section title="IN THIS APP">
            The Rankings and Race views show official points. <b style={{ color: 'white' }}>Player Stats (YTD)</b> uses
            a simpler score: it only counts titles and runner-ups in tour events shown on this calendar, so it
            won't match official totals.
          </Section>
        </div>
      </div>
    </div>
  );
}
