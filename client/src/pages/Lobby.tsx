/**
 * Лобби: список комнат, создание, вход и запуск игры.
 * Логика сетевых запросов и разметка карточки комнаты разделены:
 *   - здесь REST-вызовы /api/lobby/* и POST /api/game, состояние и ошибки;
 *   - разметка мест игроков — components/lobby/RoomCard.tsx и PlayerSeat.tsx,
 *     чтобы её можно было проверить в SSR без сети.
 *
 * Почему здесь нет socket-событий (задача 6c): комнаты лобби живут в
 * server/src/lobbyStore.ts, а игры — в server/src/gameStore.ts. Это РАЗНЫЕ
 * хранилища, поля gameId у комнаты нет, поэтому join_game по id комнаты дал бы
 * GAME_NOT_FOUND:
 *   - членство в комнате — REST /api/lobby/*;
 *   - запуск игры — POST /api/game и переход в /room/:gameId;
 *   - вся работа с игрой через сокеты — на странице GameRoom.
 *
 * Чего в этом экране намеренно нет: готовности игроков и настроек партии
 * (наборы карт, лимит руки). В макете 17:34903 они есть, но lobbyStore их не
 * хранит и routes/lobby.ts их не принимает — рисовать заглушки за данные нельзя.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Box, TextField } from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import type { CreateGameResponse, LobbyRoom } from '../types/socket';
import { getKnownNicknames, getNickname, getPlayerId, rememberNickname, setNickname } from '../utils/identity';
import { getServerOrigin } from '../utils/serverOrigin';
import { fonts, palette, radii, shadows, typeScale } from '../theme/tokens';
import { usePalette } from '../hooks/usePalette';
import { StoneButton } from '../components/ui';
import RoomCard from '../components/lobby/RoomCard';

/** Сколько игроков минимум нужно, чтобы создать игру в gameStore. */
const MIN_PLAYERS = 2;

/** Интервал обновления списка комнат, мс. */
const ROOMS_POLL_MS = 4000;

export default function LobbyPage() {
  const pal = usePalette();
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [roomName, setRoomName] = useState('');
  const [nicknameInput, setNicknameInput] = useState<string>(() => getNickname());
  const [joinedRoom, setJoinedRoom] = useState<string | null>(null);
  const [createdGameId, setCreatedGameId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const playerId = useRef<string>(getPlayerId());
  const navigate = useNavigate();

  /** Список комнат — единственный периодический запрос, чтобы видеть новых игроков. */
  const fetchRooms = useCallback(async () => {
    try {
      const res = await fetch(`${getServerOrigin()}/api/lobby/rooms`);
      const data = await res.json();
      setRooms(Array.isArray(data) ? (data as LobbyRoom[]) : []);
    } catch {
      setError('Не удалось получить список комнат — сервер недоступен');
    }
  }, []);

  useEffect(() => {
    void fetchRooms();
    const timer = window.setInterval(() => void fetchRooms(), ROOMS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [fetchRooms]);

  const createRoom = async () => {
    if (!roomName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${getServerOrigin()}/api/lobby/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName.trim() }),
      });
      if (!res.ok) {
        setError('Не удалось создать комнату');
        return;
      }
      setRoomName('');
      await fetchRooms();
    } catch {
      setError('Не удалось создать комнату — сервер недоступен');
    } finally {
      setBusy(false);
    }
  };

  /** Вход в комнату: никнейм сохраняем локально, членство — через REST. */
  const joinRoom = useCallback(
    async (roomId: string) => {
      setBusy(true);
      setError(null);
      try {
        const nick = nicknameInput.trim() || 'Игрок';
        setNickname(nick);
        rememberNickname(playerId.current, nick);
        const res = await fetch(`${getServerOrigin()}/api/lobby/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId, playerId: playerId.current }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data?.error === 'Unable to join room' ? 'Комната заполнена' : 'Не удалось войти в комнату');
          return;
        }
        setJoinedRoom(roomId);
        await fetchRooms();
      } catch {
        setError('Не удалось войти в комнату — сервер недоступен');
      } finally {
        setBusy(false);
      }
    },
    [fetchRooms, nicknameInput]
  );

  /**
   * Запуск: создаём игру в gameStore для всех игроков комнаты и переходим в неё.
   * Старого события start_game на сервере нет — игра начинается созданием.
   */
  const startGame = useCallback(
    async (room: LobbyRoom) => {
      if (room.players.length < MIN_PLAYERS) {
        setError(`Нужно минимум ${MIN_PLAYERS} игрока в комнате. Сейчас: ${room.players.length}`);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        const res = await fetch(`${getServerOrigin()}/api/game`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ players: room.players.map((id) => ({ id })) }),
        });
        if (!res.ok) {
          setError('Не удалось создать игру на сервере');
          return;
        }
        const game = (await res.json()) as CreateGameResponse;
        // Отмечаем комнату как идущую — только для отображения в списке
        await fetch(`${getServerOrigin()}/api/lobby/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roomId: room.id }),
        }).catch(() => undefined);
        setCreatedGameId(game.id);
        navigate(`/room/${game.id}`);
      } catch {
        setError('Не удалось начать игру — сервер недоступен');
      } finally {
        setBusy(false);
      }
    },
    [navigate]
  );

  const shareLink = createdGameId ? `${window.location.origin}/room/${createdGameId}` : '';
  /** Известные никнеймы с этого браузера; у остальных игроков имени может не быть. */
  const nicknames = getKnownNicknames();

  /** Панель по макету: кремовая подложка, бронзовая рамка, радиус 18. */
  const panel: React.CSSProperties = {
    background: palette.atlasCream,
    borderRadius: 18,
    boxShadow: shadows.card,
    border: `1px solid ${palette.atlasBronze}`,
    padding: 20,
  };

  return (
    <Box sx={{ p: { xs: 1, md: 2 }, fontFamily: fonts.body, color: palette.atlasInk, maxWidth: 1120, mx: 'auto' }}>
      {/* Шапка лобби по макету 17:34903: дисплейный заголовок и фиолетовая подпись режима */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 40, lineHeight: 1.1, color: palette.atlasInk }}>
          Игровые комнаты
        </div>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: typeScale.tiny,
            fontWeight: 800,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: palette.atlasViolet,
            marginTop: 4,
          }}
        >
          Соберите компанию · {rooms.length} {rooms.length === 1 ? 'комната' : 'комнат'}
        </div>
      </div>

      {/* Создание комнаты и никнейм */}
      <div style={{ ...panel, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <TextField
          label="Ваш никнейм"
          value={nicknameInput}
          onChange={(e) => setNicknameInput(e.target.value)}
          size="small"
        />
        <TextField
          label="Название новой комнаты"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          size="small"
        />
        <StoneButton variant="primary" onClick={() => void createRoom()} disabled={busy || !roomName.trim()}>
          Создать комнату
        </StoneButton>
        <StoneButton variant="ghost" onClick={() => void fetchRooms()} disabled={busy}>
          Обновить список
        </StoneButton>
      </div>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: `${radii.md}px` }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Список комнат: карточка на каждую, места — отдельными строками */}
      {rooms.length === 0 ? (
        <div style={{ ...panel, textAlign: 'center' }}>
          <div style={{ fontFamily: fonts.display, fontSize: 24, fontWeight: 700 }}>Комнат пока нет</div>
          <div style={{ marginTop: 6, color: pal.textMuted }}>Создайте первую комнату, чтобы начать партию</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {rooms.map((r) => (
            <RoomCard
              key={r.id}
              pal={pal}
              room={r}
              mePlayerId={playerId.current}
              nicknames={nicknames}
              myNickname={nicknameInput}
              joined={joinedRoom === r.id}
              busy={busy}
              minPlayers={MIN_PLAYERS}
              onJoin={joinRoom}
              onStart={startGame}
            />
          ))}
        </div>
      )}

      {createdGameId && (
        <section
          style={{
            ...panel,
            marginTop: 24,
            borderTop: `3px solid ${pal.accent}`,
            boxShadow: shadows.card,
          }}
        >
          <div style={{ fontFamily: fonts.display, fontSize: 26, fontWeight: 700 }}>Игра создана</div>
          <div style={{ color: pal.textMuted, marginBottom: 12 }}>
            Ссылка для остальных игроков (id игры: {createdGameId})
          </div>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField value={shareLink} size="small" fullWidth inputProps={{ readOnly: true }} />
            <StoneButton variant="ghost" onClick={() => void navigator.clipboard?.writeText(shareLink)}>
              Скопировать
            </StoneButton>
            <StoneButton variant="primary" onClick={() => navigate(`/room/${createdGameId}`)}>
              Войти в игру
            </StoneButton>
          </Box>
        </section>
      )}

      <div style={{ marginTop: 20 }}>
        <Link to="/" style={{ color: pal.accent, fontWeight: 700 }}>
          ← На главную
        </Link>
      </div>
    </Box>
  );
}
