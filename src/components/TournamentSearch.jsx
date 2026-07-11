import { useEffect, useRef, useState } from 'react';
import dayjs from 'dayjs';

const levelLabel = level => {
  if (level === 2000) return 'Grand Slam';
  if (level === 1500) return 'Finals';
  return String(level);
};

// Searches both tours; selecting a result switches tour + month and flashes the cell.
export default function TournamentSearch({ allData, onJump }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef(null);
  const rootRef = useRef(null);

  // ⌘K / Ctrl+K focuses the search box
  useEffect(() => {
    const handler = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = e => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const q = query.trim().toLowerCase();
  const results = q.length < 2 ? [] : ['atp', 'wta'].flatMap(tour =>
    (allData?.[tour] ?? [])
      .filter(t => t.name.toLowerCase().includes(q) || (t.location ?? '').toLowerCase().includes(q))
      .map(t => ({ ...t, tour }))
  ).slice(0, 8);

  const select = t => {
    setQuery('');
    setOpen(false);
    inputRef.current?.blur();
    onJump(t);
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
    <div ref={rootRef} style={{ position: 'relative', width: '210px', flexShrink: 0 }}>
      <span
        style={{
          position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)',
          fontSize: '11px', color: '#4b5580', pointerEvents: 'none',
        }}
      >
        🔍
      </span>
      <input
        ref={inputRef}
        value={query}
        placeholder="Find tournament…  ⌘K"
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

      {open && results.length > 0 && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 9000,
            width: '300px', maxHeight: '320px', overflowY: 'auto',
            background: '#0c0c14', border: '1px solid #2a2a3a', borderRadius: '10px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
            padding: '4px',
          }}
        >
          {results.map((t, i) => {
            const isAtp = t.tour === 'atp';
            return (
              <div
                key={`${t.tour}-${t.id}`}
                onMouseEnter={() => setActiveIdx(i)}
                onMouseDown={e => { e.preventDefault(); select(t); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '8px 10px', borderRadius: '6px', cursor: 'pointer',
                  background: i === activeIdx ? 'rgba(255,255,255,0.06)' : 'transparent',
                }}
              >
                <span
                  style={{
                    fontSize: '9px', fontWeight: '800', letterSpacing: '0.5px',
                    padding: '2px 6px', borderRadius: '4px', flexShrink: 0,
                    background: isAtp ? 'rgba(0,119,255,0.18)' : 'rgba(217,61,153,0.18)',
                    color: isAtp ? '#60b0ff' : '#f472b6',
                  }}
                >
                  {t.tour.toUpperCase()}
                </span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#e5e7eb', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: '10px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.location} · {dayjs(t.start).format('MMM D')}–{dayjs(t.end).format('MMM D')} · {levelLabel(t.level)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
