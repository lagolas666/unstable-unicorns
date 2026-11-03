import React from 'react'

type TimelineStep = {
  turn: number;
  player: string;
  unicorns: number;
  phase: string;
  action?: string;
}

type Props = {
  timeline: TimelineStep[];
}

export default function TimelineView({ timeline }: Props) {
  if (!timeline || timeline.length === 0) return null
  return (
    <div style={{ marginTop: 12 }}>
      <div className="battle-banner" style={{ display: 'inline-block', marginBottom: 6 }}>Timeline</div>
      <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid #ddd', padding: 8, borderRadius: 6 }}>
        {timeline.map((t, i) => (
          <div key={i} style={{ fontFamily: 'monospace', fontSize: 12, padding: '2px 0' }}>
            Turn {t.turn}: {t.player} → Unicorns: {t.unicorns} | Phase: {t.phase}{t.action ? (' | ' + t.action) : ''}
          </div>
        ))}
      </div>
    </div>
  )
}
