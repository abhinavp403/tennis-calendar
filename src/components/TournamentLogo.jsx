import { useState, useRef } from 'react';
import dayjs from 'dayjs';

const LEVEL_STYLES = {
  2000: { bg: '#2e1065', border: '#a78bfa', text: '#ede9fe', glow: 'rgba(167,139,250,0.6)' },
  1000: { bg: '#7c2d0a', border: '#f59e0b', text: '#fde68a', glow: 'rgba(245,158,11,0.5)' },
  500:  { bg: '#1e3a8a', border: '#60a5fa', text: '#bfdbfe', glow: 'rgba(96,165,250,0.4)' },
  250:  { bg: '#1f2937', border: '#9ca3af', text: '#e5e7eb', glow: 'rgba(156,163,175,0.25)' },
};

const DATE_ICON = { start: '🏁', end: '🏆' };

function abbreviate(name) {
  // Use first letter of each significant word, max 3 chars
  return name
    .replace(/\b(Open|International|Tennis|Championships|Tournament|Classic)\b/gi, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0].toUpperCase())
    .join('')
    .slice(0, 3) || name.slice(0, 3).toUpperCase();
}

export default function TournamentLogo({ tournament }) {
  const [imgError, setImgError] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState({});
  const containerRef = useRef(null);

  const style = LEVEL_STYLES[tournament.level] ?? LEVEL_STYLES[250];
  const abbr = abbreviate(tournament.name);
  const logoSrc = `./logos/${tournament.logo}`;
  const isCompleted = tournament.winner && dayjs().isAfter(dayjs(tournament.end));

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const tooltipWidth = 210;
      const estimatedHeight = isCompleted ? 210 : 140;
      const showBelow = rect.top < estimatedHeight + 10;
      const alignRight = rect.right + tooltipWidth > window.innerWidth;

      setTooltipStyle({
        top: showBelow ? rect.bottom + 6 : rect.top - estimatedHeight - 6,
        left: alignRight ? rect.right - tooltipWidth : rect.left,
      });
    }
    setShowTooltip(true);
  };

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Logo or fallback badge */}
      {!imgError ? (
        <div style={{ position: 'relative', width: '36px', height: '36px' }}>
          <img
            src={logoSrc}
            alt={tournament.name}
            onError={() => setImgError(true)}
            style={{
              width: '36px',
              height: '36px',
              objectFit: 'contain',
              borderRadius: '6px',
              border: `1px solid ${style.border}`,
              backgroundColor: style.bg,
              padding: '2px',
              boxShadow: `0 0 8px ${style.glow}`,
            }}
          />
          <span
            style={{
              position: 'absolute',
              bottom: '-2px',
              right: '-2px',
              fontSize: '9px',
              lineHeight: 1,
            }}
          >
            {DATE_ICON[tournament.dateType]}
          </span>
        </div>
      ) : (
        <div
          style={{
            position: 'relative',
            width: '36px',
            height: '36px',
            borderRadius: '6px',
            backgroundColor: style.bg,
            border: `1px solid ${style.border}`,
            boxShadow: `0 0 8px ${style.glow}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
        >
          <span
            style={{
              fontSize: '8px',
              fontWeight: '700',
              color: style.text,
              letterSpacing: '0.5px',
              lineHeight: 1.1,
              textAlign: 'center',
            }}
          >
            {abbr}
          </span>
          <span style={{ fontSize: '9px', lineHeight: 1, marginTop: '1px' }}>
            {DATE_ICON[tournament.dateType]}
          </span>
        </div>
      )}

      {/* Tooltip — fixed positioning escapes overflow:auto clipping from parent */}
      {showTooltip && (
        <div
          style={{
            position: 'fixed',
            top: tooltipStyle.top,
            left: tooltipStyle.left,
            width: '210px',
            backgroundColor: '#1e2030',
            border: `1px solid ${style.border}`,
            borderRadius: '8px',
            padding: '10px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: '700', color: 'white', marginBottom: '4px' }}>
            {tournament.name}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>
            📍 {tournament.location}
          </div>
          <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>
            🎾 {tournament.surface}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span
              style={{
                fontSize: '10px',
                fontWeight: '700',
                color: style.text,
                backgroundColor: style.bg,
                border: `1px solid ${style.border}`,
                borderRadius: '4px',
                padding: '1px 5px',
              }}
            >
              {tournament.level === 2000 ? 'Grand Slam' : tournament.level}
            </span>
            <span style={{ fontSize: '11px', color: '#9ca3af' }}>
              {DATE_ICON[tournament.dateType]}{' '}
              {tournament.dateType === 'start' ? 'Tournament Start' : 'Final Day'}
            </span>
          </div>
          {isCompleted && (
            <div style={{ marginTop: '8px', borderTop: '1px solid #2a2a3a', paddingTop: '8px' }}>
              <div style={{ fontSize: '10px', color: '#6b7280', marginBottom: '4px', fontWeight: '600', letterSpacing: '0.5px' }}>
                FINAL RESULT
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <span style={{ fontSize: '11px' }}>🏆</span>
                <span style={{ fontSize: '11px', color: '#fde68a', fontWeight: '600' }}>{tournament.winner}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }}>
                <span style={{ fontSize: '11px' }}>🥈</span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{tournament.runner_up}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#d1d5db', fontFamily: 'monospace', fontWeight: '600' }}>
                {tournament.score}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
