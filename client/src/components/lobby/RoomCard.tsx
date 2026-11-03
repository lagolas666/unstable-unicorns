import React from 'react';
import { Chip } from '@mui/material';
import type { LobbyRoom } from '../../types/socket';
import { fonts, palette, radii, shadows, typeScale } from '../../theme/tokens';
import type { TablePalette } from '../../theme/tablePalette';
import { StoneButton, ZoneLabel } from '../ui';
import PlayerSeat from './PlayerSeat';

export type RoomCardProps = {
  /** Палитра активной темы */
  pal: TablePalette;
  /** Комната из REST /api/lobby/rooms */
  room: LobbyRoom;
  /** Свой id: чтобы подписать «Вы» и не предлагать вход самому себе */
  mePlayerId: string;
  /** Известные никнеймы id → имя; чужие игроки без имени показываются по id */
  nicknames: Record<string, string>;
  /** Свой никнейм для подписи, если он не сохранён в общем словаре */
  myNickname?: string;
  /** Я уже вошёл в эту комнату */
  joined?: boolean;
  /** Идёт запрос — кнопки блокируются */
  busy?: boolean;
  /** Минимум игроков для старта */
  minPlayers: number;
  onJoin: (roomId: string) => void;
  onStart: (room: LobbyRoom) => void;
};

/**
 * RoomCard — карточка комнаты лобби: имя, счётчик мест, места игроков, вход и старт.
 * Готовность игроков не рисуем: lobbyStore её не хранит (см. комментарий в Lobby.tsx).
 * Вынесено из страницы, чтобы проверять разметку отдельно от сетевых запросов.
 */
function RoomCardBase({
  pal,
  room,
  mePlayerId,
  nicknames,
  myNickname,
  joined,
  busy,
  minPlayers,
  onJoin,
  onStart,
}: RoomCardProps) {
  const canStart = room.players.length >= minPlayers && room.status === 'waiting';
  // Показываем все места комнаты, даже пустые: так видно, сколько людей ещё ждём
  const seats = Math.max(room.maxPlayers, room.players.length);

  return (
    <section
      aria-label={`Комната ${room.name}`}
      data-room-id={room.id}
      style={{
        background: palette.atlasCream,
        borderRadius: 18,
        boxShadow: shadows.card,
        border: `1px solid ${palette.atlasBronze}`,
        padding: 20,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 700, lineHeight: 1.1, color: palette.atlasInk }}>{room.name}</div>
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: typeScale.small,
              fontWeight: 800,
              letterSpacing: '0.04em',
              color: palette.atlasViolet,
            }}
          >
            Игроки {room.players.length}/{room.maxPlayers} · {room.status === 'waiting' ? 'ожидание' : 'идёт игра'}
          </div>
        </div>
        {joined && (
          <Chip
            label="Вы в комнате"
            size="small"
            data-testid="room-joined-badge"
            sx={{ bgcolor: pal.accent, color: pal.cardFace, fontFamily: fonts.body, fontWeight: 800 }}
          />
        )}
        <StoneButton variant="ghost" onClick={() => onJoin(room.id)} disabled={busy}>
          {joined ? 'Переподключиться' : 'Войти'}
        </StoneButton>
        <StoneButton
          variant="stone"
          onClick={() => onStart(room)}
          disabled={busy || !canStart}
          hint={canStart ? undefined : `нужно от ${minPlayers}`}
        >
          Начать игру
        </StoneButton>
      </div>

      <ZoneLabel title="За столом" counter={`${room.players.length}/${room.maxPlayers}`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {Array.from({ length: seats }, (_, i) => {
          const pid = room.players[i];
          if (!pid) {
            return <PlayerSeat key={`empty-${i}`} pal={pal} name="Свободное место" caption="Ждём игрока" empty />;
          }
          const isMe = pid === mePlayerId;
          const name = nicknames[pid] || (isMe ? myNickname?.trim() || 'Вы' : `Игрок ${pid.slice(0, 6)}`);
          return <PlayerSeat key={pid} pal={pal} name={name} caption={isMe ? 'Вы' : 'Игрок в комнате'} />;
        })}
      </div>
    </section>
  );
}

/** Карточка перерисовывается только при смене комнаты или темы. */
export default React.memo(RoomCardBase);
