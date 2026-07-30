import { useEffect, useRef, useState } from 'react';
import { countryFlag } from '../utils/flags.js';

// Accent-insensitive so "felix" matches "Félix".
const deburr = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Searches the current tour's Player Stats (YTD) leaderboard by name.
// Selecting a result opens that player's profile. `players` is the ranked
// stats array from buildPlayerStats — the same set the Player Stats dialog shows.
export default function PlayerSearch({ players, tour, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const rootRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isAtp = tour === 'atp';
  const accent = isAtp ? '#60b0ff' : '#f472b6';

  const nq = deburr(query.trim());
  // Match on the full name ("Carlos Alcaraz") or the abbreviated form
  // ("C. Alcaraz"), so first name, last name, and initial all work. fullName
  // comes from the data (winner_full / runner_up_full), falling back to the
  // abbreviated name. Keep leaderboard order so the best players surface first.
  const results = nq.length < 1 ? [] : (players ?? [])
    .filter(p => deburr(p.fullName).includes(nq) || deburr(p.name).includes(nq))
    .slice(0, 8);

  const select = p => {
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
    onSelect(p);
  };

  const onKeyDown = e => {
    if (!open || results.length === 0) {
      if (e.key === 'Escape') { setQuery(''); e.currentTarget.blur(); }
      return;
    }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => (i + 1) % results.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => (i - 1 + results.length) % results.length); }
    else if (e.key === 'Enter') { e.preventDefault(); select(results[Math.min(activeIdx, results.length - 1)]); }
    else if (e.key === 'Escape') { setQuery(''); setOpen(false); e.currentTarget.blur(); }
  };

  return (
    <div ref={rootRef} style={{ position: 'relative', width: '190px', flexShrink: 0 }}>
      <span
        style={{
          position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)',
          fontSize: '11px', color: '#4b5580', pointerEvents: 'none',
        }}
      >
        🎾
      </span>
      <input
        ref={inputRef}
        value={query}
        placeholder="Find player…"
        onChange={e => { setQuery(e.target.value); setOpen(true); setActiveIdx(0); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        style={{
          width: '100%',
          background: '#16162a',
          border: '1px solid #252540',
          borderRadius: '999px',
          color: '#e5e7eb',
          fontSize: '11px',
          fontWeight: '600',
          padding: '5px 10px 5px 26px',
          outline: 'none',
        }}
        onFocusCapture={e => (e.currentTarget.style.borderColor = '#3d3d70')}
        onBlurCapture={e => (e.currentTarget.style.borderColor = '#252540')}
      />

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9000,
            width: '300px', maxHeight: '320px', overflowY: 'auto',
            background: '#0c0c14', border: '1px solid #2a2a3a', borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            padding: '4px',
          }}
        >
          {results.length === 0 ? (
            <div style={{ fontSize: '11px', color: '#6b7280', padding: '10px 12px' }}>
              {nq.length < 1 ? 'Type a player name…' : 'No matching players in the YTD stats.'}
            </div>
          ) : (
            results.map((p, i) => (
              <div
                key={p.name}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={e => { e.preventDefault(); select(p); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
                  background: i === activeIdx ? 'rgba(255,255,255,0.06)' : 'transparent',
                }}
              >
                <span
                  style={{
                    fontSize: '11px', fontWeight: '800', color: accent,
                    width: '26px', textAlign: 'right', flexShrink: 0,
                  }}
                >
                  {p.rank}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {p.country && <span style={{ marginRight: '5px' }}>{countryFlag(p.country)}</span>}
                    {p.fullName}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                    🏆 {p.wins} · 🥈 {p.runnerUp} · {p.points.toLocaleString()} pts
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
