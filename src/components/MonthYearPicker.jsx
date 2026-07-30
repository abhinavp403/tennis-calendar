import { useEffect, useRef, useState } from 'react';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const ITEM_H = 40;      // px per row
const VISIBLE = 5;      // rows shown (odd, so one is centered)
const PAD = ((VISIBLE - 1) / 2) * ITEM_H; // top/bottom padding so ends can center

// One slot-machine reel: a scroll-snapping column whose centered row is selected.
function Reel({ items, selectedIndex, onSelect, accent, width, render }) {
  const ref = useRef(null);
  const settle = useRef(null);

  // Land on the initial value (once).
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = selectedIndex * ITEM_H;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onScroll = () => {
    clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const idx = Math.max(0, Math.min(items.length - 1, Math.round(ref.current.scrollTop / ITEM_H)));
      if (idx !== selectedIndex) onSelect(idx);
    }, 90);
  };

  return (
    <div style={{ position: 'relative', width, height: VISIBLE * ITEM_H }}>
      {/* Center selection band */}
      <div
        style={{
          position: 'absolute', top: PAD, left: 0, right: 0, height: ITEM_H,
          borderTop: `1px solid ${accent}66`, borderBottom: `1px solid ${accent}66`,
          background: `${accent}14`, borderRadius: '6px', pointerEvents: 'none',
        }}
      />
      <div
        ref={ref}
        onScroll={onScroll}
        className="myp-reel"
        style={{ height: '100%', overflowY: 'scroll', scrollSnapType: 'y mandatory', scrollbarWidth: 'none' }}
      >
        <div style={{ height: PAD }} />
        {items.map((it, i) => {
          const dist = Math.abs(i - selectedIndex);
          return (
            <div
              key={i}
              onClick={() => ref.current?.scrollTo({ top: i * ITEM_H, behavior: 'smooth' })}
              style={{
                height: ITEM_H, scrollSnapAlign: 'center', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: dist === 0 ? '18px' : '15px',
                fontWeight: dist === 0 ? '700' : '500',
                color: dist === 0 ? 'white' : dist === 1 ? '#9ca3af' : '#4b5580',
                opacity: dist === 0 ? 1 : dist === 1 ? 0.85 : 0.45,
                transition: 'color .1s, opacity .1s, font-size .1s',
              }}
            >
              {render ? render(it) : it}
            </div>
          );
        })}
        <div style={{ height: PAD }} />
      </div>
    </div>
  );
}

// Slot-machine month/year jumper. `years` is the selectable list of years.
export default function MonthYearPicker({ currentDate, years, tour, onSelect, onClose }) {
  const accent = tour === 'atp' ? '#0066cc' : '#be398d';
  const [monthIdx, setMonthIdx] = useState(currentDate.month());
  const [yearIdx, setYearIdx] = useState(Math.max(0, years.indexOf(currentDate.year())));

  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        backgroundColor: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Hide the reels' scrollbars */}
      <style>{`.myp-reel::-webkit-scrollbar{display:none}`}</style>
      <div
        style={{
          backgroundColor: '#13131a', border: '1px solid #2a2a3a', borderRadius: '12px',
          width: '100%', maxWidth: '320px', boxShadow: '0 8px 40px rgba(0,0,0,0.8)',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px 12px', borderBottom: '1px solid #2a2a3a',
          }}
        >
          <div style={{ fontSize: '15px', fontWeight: '700', color: 'white' }}>Jump to month</div>
          <button
            onClick={onClose}
            style={{
              background: '#1a1a24', border: '1px solid #2a2a3a', borderRadius: '6px',
              color: '#9ca3af', fontSize: '18px', lineHeight: 1, width: '30px', height: '30px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#2a2a3a')}
            onMouseLeave={e => (e.currentTarget.style.background = '#1a1a24')}
          >
            ×
          </button>
        </div>

        {/* Reels */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', padding: '16px 20px' }}>
          <Reel items={MONTHS} selectedIndex={monthIdx} onSelect={setMonthIdx} accent={accent} width={150} />
          <Reel items={years} selectedIndex={yearIdx} onSelect={setYearIdx} accent={accent} width={96} />
        </div>

        {/* Jump */}
        <div style={{ padding: '4px 20px 18px' }}>
          <button
            onClick={() => onSelect(years[yearIdx], monthIdx)}
            style={{
              width: '100%', padding: '10px', borderRadius: '8px', cursor: 'pointer',
              background: accent, border: 'none', color: 'white', fontSize: '14px', fontWeight: '700',
              letterSpacing: '0.3px',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.1)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
          >
            Jump to {MONTHS[monthIdx]} {years[yearIdx]}
          </button>
        </div>
      </div>
    </div>
  );
}
