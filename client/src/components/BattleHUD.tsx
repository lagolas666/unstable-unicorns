import React from 'react'

type PlayerInfo = { id: string; nickname: string; unicorns?: number }
type BattleHUDProps = {
  roomId?: string
  players: PlayerInfo[]
  phase?: string
  currentTurn?: string
  winner?: string
}

export default function BattleHUD({ roomId, players, phase, currentTurn, winner }: BattleHUDProps) {
  return (
    <div style={{ margin: '12px 0' }}>
      <div className="battle-banner" style={{ display: 'inline-block' }}>Battle In Progress</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 8 }}>
        <span>Room: {roomId ?? '—'}</span>
        <span>Phase: {phase ?? '—'}</span>
        <span>Current turn: {currentTurn ?? '—'}</span>
        {winner && <span>Winner: {winner}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        {players.map(p => (
          <div key={p.id} style={{ padding: 6, border: '1px solid #ddd', borderRadius: 6, minWidth: 120, textAlign: 'center' }}>
            <div style={{ fontWeight: 600 }}>{p.nickname}</div>
            <div style={{ fontSize: 12, color: '#555' }}>Unicorns: {p.unicorns ?? 0}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
