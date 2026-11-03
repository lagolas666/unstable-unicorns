/**
 * Игровая комната: стол 1920×1080 по макету «Стол на четверых» (Figma 17:35029).
 *
 * События: join_game {gameId, playerId} | leave_game {gameId} | play_card | draw_card | end_turn
 * | react {kind, поля вида} | resolve_pending {gameId, playerId}.
 * Подписки: state_update, logs_update, pending_update.
 * Окно реакции живёт в components/NeighModal и закрывается только pending_update с null.
 * Сцена масштабируется по ширине контейнера (ResizeObserver), горизонтального скролла нет.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, List, ListItem, Typography } from '@mui/material';
import NeighModal from '../components/NeighModal';
import AwaitChoiceModal from '../components/AwaitChoiceModal';
import TableBackdrop from '../components/TableBackdrop';
import CardBack from '../components/CardBack';
import { ConnectionPill, StatBlock, StoneButton, ZoneLabel } from '../components/ui';
import { useGameSocket } from '../hooks/useSocket';
import type { CardInfo, LogEntry, ReactExtra } from '../types/socket';
import { PHASE_LABELS, isUnicornType, toGameView } from '../utils/gameView';
import { getKnownNicknames, getNickname, getPlayerId, rememberNickname } from '../utils/identity';
import { describeSocketError, isPendingActionUnavailable } from '../utils/socketErrors';
import { cardSizes, fonts, radii, shadows, tableLayout, typeScale } from '../theme/tokens';
import type { TablePalette } from '../theme/tablePalette';
import { usePalette } from '../hooks/usePalette';
import { CARD_TYPE_LABELS, cardTypeColor } from '../constants/cardTypeColors';
import { resolveCardImage } from '../utils/cardImage';
import { useCardImages } from '../hooks/useCardImages';
import { cardsCount } from '../utils/plural';

/** Размер сцены в координатах макета. */
const STAGE_W = tableLayout.width;
const STAGE_H = tableLayout.height;
/** Порог победы из макета: 7 единорогов в конюшне. */
const WIN_UNICORNS = 7;
/** Лимит руки из макета. */
const HAND_LIMIT = 7;

/**
 * Сервер требует игрока-цель (карты downgrade). Основной путь — поле ack.extra
 * (handlers.ts кладёт { needTargetPlayer, kind, options }); код TARGET_REQUIRED и
 * текст сообщения остаются страховкой для старых сборок сервера.
 */
function isTargetRequired(res: {
  code: string;
  message?: string;
  extra?: { needTargetPlayer?: boolean; needTargets?: boolean; kind?: string };
}): boolean {
  // Две формы ответа: socket-ack несёт needTargetPlayer, REST — needTargets + kind:'players'
  if (res.extra?.needTargetPlayer) return true;
  if (res.extra?.needTargets && res.extra?.kind === 'players') return true;
  if (res.code === 'TARGET_REQUIRED') return true;
  return res.code === 'BAD_REQUEST' && /target player/i.test(res.message || '');
}

/** Подпись записи журнала: время, тип и игрок, без разбора details. */
function logLine(entry: LogEntry, nicknames: Record<string, string>): string {
  const who = entry.playerId ? nicknames[entry.playerId] || entry.playerId : 'Система';
  const time = new Date(entry.t).toLocaleTimeString('ru-RU');
  return `${time} · ${entry.type} · ${who}`;
}

/** Абсолютное позиционирование в координатах сцены макета. */
function at(x: number, y: number, w: number, h: number, extra?: React.CSSProperties): React.CSSProperties {
  return { position: 'absolute', left: x, top: y, width: w, height: h, ...extra };
}

/** Масштаб сцены: ширина контейнера делится на 1920, высота следует за пропорцией. */
function useStageScale(ref: React.RefObject<HTMLDivElement>): number {
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setScale(el.clientWidth / STAGE_W);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return scale;
}

interface TableCardProps {
  /** Палитра активной темы: цвет рамки, лица и рубашки */
  pal: TablePalette;
  card?: CardInfo;
  name: string;
  width: number;
  height: number;
  faceDown?: boolean;
  onClick?: () => void;
  onHover?: (hovered: boolean) => void;
  style?: React.CSSProperties;
  dataMarker?: string;
}

/** Карта на столе: лицом (цвет типа, название) или рубашкой. Без MUI, чтобы держать размеры макета. */
const TableCard = React.memo(function TableCard({
  pal,
  card,
  name,
  width,
  height,
  faceDown = false,
  onClick,
  onHover,
  style,
  dataMarker,
}: TableCardProps) {
  const color = cardTypeColor(card?.type);
  const interactive = Boolean(onClick);
  const typeLabel = card?.type ? CARD_TYPE_LABELS[card.type] ?? card.type : '';
  // Манифест общий на приложение (кэш в хуке), картинка — сначала из поля карты
  const manifest = useCardImages();
  const [imageBroken, setImageBroken] = useState(false);
  const imageUrl = resolveCardImage({ name: card?.name ?? name, image: card?.image }, manifest);
  // Битая ссылка не должна оставлять пустую рамку — падаем на текстовую заглушку
  const showImage = Boolean(imageUrl) && !imageBroken;
  return (
    <div
      data-marker={dataMarker}
      role={interactive ? 'button' : 'img'}
      tabIndex={interactive ? 0 : -1}
      aria-label={faceDown ? 'Закрытая карта' : name}
      title={faceDown ? undefined : name}
      onClick={onClick}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      onMouseEnter={onHover ? () => onHover(true) : undefined}
      onMouseLeave={onHover ? () => onHover(false) : undefined}
      style={{
        position: 'relative',
        width,
        height,
        boxSizing: 'border-box',
        borderRadius: radii.md,
        overflow: 'hidden',
        border: `2px solid ${faceDown ? pal.stone : color}`,
        background: faceDown
          ? `linear-gradient(160deg, ${pal.stoneDeep} 0%, ${pal.felt} 100%)`
          : pal.cardFace,
        boxShadow: shadows.card,
        cursor: interactive ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      {faceDown ? (
        /* Рубашка рисуется вектором: картинка макета была снимком наклонённой карты */
        <CardBack width={width} height={height} pal={pal} radius={radii.md} dataPart="table-card-back" />
      ) : (
        <>
          {/* Фон: лицо карты из макета (#fffefa), картинка поверх, если есть */}
          {showImage && (
            <img
              src={imageUrl}
              alt={name}
              draggable={false}
              onError={() => setImageBroken(true)}
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                userSelect: 'none',
                pointerEvents: 'none',
              }}
            />
          )}
          {/* Уголок категории: 44/200 ширины карты, цвет типа */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: Math.round(width * (44 / 200)),
              height: Math.round(width * (44 / 200)),
              background: color,
              borderBottomRightRadius: Math.round(width * 0.05),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#ffffff', fontSize: Math.round(width * 0.06), lineHeight: 1, fontFamily: fonts.body }}>
              ◆
            </span>
          </div>
          {/* Название по центру, Nunito 900 */}
          {!showImage && (
            <div
              style={{
                position: 'absolute',
                left: Math.round(width * (14 / 200)),
                right: Math.round(width * (14 / 200)),
                top: Math.round(height * 0.06),
                textAlign: 'center',
                fontFamily: fonts.body,
                fontWeight: 900,
                fontSize: Math.max(typeScale.micro, Math.round(width * (14 / 200))),
                lineHeight: 1.2,
                color: '#352a34',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
            >
              {name}
            </div>
          )}
          {/* Правило карты: только на крупных картах, на 80..130 px текст не читается */}
          {!showImage && card?.description && width >= 150 && (
            <div
              style={{
                position: 'absolute',
                left: Math.round(width * (14 / 200)),
                right: Math.round(width * (14 / 200)),
                top: Math.round(height * 0.58),
                bottom: Math.round(height * 0.16),
                fontFamily: fonts.body,
                fontWeight: 400,
                fontSize: Math.max(typeScale.micro, Math.round(width * (9 / 200))),
                lineHeight: 1.25,
                color: '#4b3a45',
                overflow: 'hidden',
              }}
            >
              {String(card.description).slice(0, 220)}
            </div>
          )}
          {/* Строка типа карты: цвет категории, Nunito 400 */}
          {!showImage && typeLabel && (
            <div
              style={{
                position: 'absolute',
                left: Math.round(width * (14 / 200)),
                right: Math.round(width * (14 / 200)),
                bottom: Math.round(height * 0.07),
                fontFamily: fonts.body,
                fontWeight: 400,
                fontSize: Math.max(typeScale.micro, Math.round(width * (9 / 200))),
                color: color,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {typeLabel}
            </div>
          )}
        </>
      )}
    </div>
  );
});

export default function GameRoom() {
  // Палитра активной темы: переключение «Радужная»/«Мрачная» перекрашивает стол сразу.
  const pal = usePalette();
  // В URL лежит id игры из gameStore (не id комнаты лобби)
  const { roomId } = useParams<{ roomId: string }>();
  const playerId = useMemo(() => getPlayerId(), []);
  const [nickname, setNickname] = useState<string>(() => getNickname());
  const [nicknames, setNicknames] = useState<Record<string, string>>(() => getKnownNicknames());
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [reactBusy, setReactBusy] = useState(false);
  // Карта, ожидающая выбора игрока-цели (downgrade), и текст отказа внутри окна
  const [targetPick, setTargetPick] = useState<{ cardId: string } | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);
  const [targetBusy, setTargetBusy] = useState(false);
  // Карта под курсором в веере руки: выезжает вверх
  const [hoverId, setHoverId] = useState<string | null>(null);
  // Карта под курсором в конюшне (своя и не-единороги): выезжает вверх
  const [hoverStableId, setHoverStableId] = useState<string | null>(null);
  // Не-единорог соперника под курсором: показываем полную карту
  const [hoverForeId, setHoverForeId] = useState<string | null>(null);

  const stageWrapRef = useRef<HTMLDivElement>(null);
  const scale = useStageScale(stageWrapRef);

  // Единый канал: соединение + join_game + подписки + действия с ack
  const game = useGameSocket(roomId, playerId);
  const view = useMemo(
    () => toGameView(game.state, { playerId, nicknames }),
    [game.state, playerId, nicknames]
  );

  const onNicknameChange = useCallback(
    (value: string) => {
      setNickname(value);
      rememberNickname(playerId, value);
      setNicknames(getKnownNicknames());
    },
    [playerId]
  );

  // Добор карты: доступен только в фазе начала хода (сервер проверит и вернёт WRONG_PHASE)
  const onDraw = useCallback(async () => {
    const res = await game.drawCard();
    if (res && !res.ok) setActionMessage(describeSocketError(res.code, res.message));
    else setActionMessage(null);
  }, [game]);

  const onEndTurn = useCallback(async () => {
    const res = await game.endTurn();
    if (res && !res.ok) setActionMessage(describeSocketError(res.code, res.message));
    else setActionMessage(null);
  }, [game]);

  // Розыгрыш карты из руки: картам downgrade нужна цель, поэтому клик открывает
  // окно выбора игрока, а не отправляет розыгрыш сразу (сервер ответит 409).
  const onPlayCard = useCallback(
    async (cardId: string) => {
      const cardType = game.state?.cards?.[cardId]?.type;
      if (cardType === 'downgrade') {
        setTargetError(null);
        setTargetPick({ cardId });
        return;
      }
      const res = await game.playCard({ cardId });
      if (res && !res.ok) {
        // Страховка: сервер всё же просит цель — открываем окно вместо общего текста
        if (isTargetRequired(res)) {
          setTargetError(null);
          setTargetPick({ cardId });
          return;
        }
        setActionMessage(describeSocketError(res.code, res.message));
      } else setActionMessage(null);
    },
    [game]
  );

  // Игрок выбран: повторяем розыгрыш с targetPlayerId; при отказе окно остаётся открытым
  const onPickTarget = useCallback(
    async (targetPlayerId: string) => {
      if (!targetPick) return;
      setTargetBusy(true);
      try {
        const res = await game.playCard({ cardId: targetPick.cardId, targetPlayerId });
        if (res && res.ok) {
          setTargetPick(null);
          setTargetError(null);
          setActionMessage(null);
        } else if (res) {
          setTargetError(describeSocketError(res.code, res.message));
        }
      } finally {
        setTargetBusy(false);
      }
    },
    [game, targetPick]
  );

  // Отмена: закрываем окно, ничего не отправляя
  const onCancelTarget = useCallback(() => {
    setTargetPick(null);
    setTargetError(null);
  }, []);

  // Реакция в окне: сервер сам рассылает state_update/pending_update, клиент только шлёт вид и поля.
  // Отказ сервера выводится внутри модалки, окно закрывает лишь pending_update с null.
  const onReact = useCallback(
    async (kind: string, extra: ReactExtra) => {
      setReactBusy(true);
      try {
        await game.react(kind, extra);
      } finally {
        setReactBusy(false);
      }
    },
    [game]
  );

  // Пропуск реакции (кнопка у реагирующего): закрывает окно через resolve_pending
  const onSkipReaction = useCallback(async () => {
    setReactBusy(true);
    try {
      await game.resolvePending();
    } finally {
      setReactBusy(false);
    }
  }, [game]);

  // Выбор карты защитником (await_choice): отправляем resolve_pending с cardId
  const onPickAwaitChoice = useCallback(
    async (cardId: string) => {
      setReactBusy(true);
      try {
        await game.resolvePending({ cardId });
      } finally {
        setReactBusy(false);
      }
    },
    [game]
  );

  const error = game.lastError;
  const reactionsUnavailable = isPendingActionUnavailable(error?.code);
  const isMyTurn = view?.currentPlayerId === playerId;
  // Сервер принимает draw_card только в фазе begin_turn до первого добора (иначе WRONG_PHASE),
  // поэтому кнопку гасим заранее, а не показываем ошибку после клика.
  const canDraw = isMyTurn && view?.phase === 'begin_turn' && !view?.hasDrawn;
  // Открытое окно реакции блокирует завершение хода: подпись объясняет причину
  const reactionOpen = game.pending != null;
  const canEnd = game.connected && isMyTurn && !reactionOpen;
  // Текст отказа для окна реакции: ошибка именно от react/resolve_pending
  const reactError =
    error && (error.event === 'react' || error.event === 'resolve_pending')
      ? describeSocketError(error.code, error.message)
      : null;

  // Данные стола из state: соперники, моя конюшня, карты
  const statePlayers = game.state?.players ?? [];
  const cards = game.state?.cards ?? {};
  const me = statePlayers.find((p) => p.id === playerId);
  const foes = statePlayers.filter((p) => p.id !== playerId).slice(0, 3);
  const hand = view?.myHand ?? [];
  const myStable = me?.stable ?? [];
  const myUnicorns = myStable.filter((id) => isUnicornType(cards[id]?.type));
  const myOther = myStable.filter((id) => !isUnicornType(cards[id]?.type));
  const nickOf = (id: string): string => nicknames[id] || id;

  if (!roomId) {
    return (
      <div style={{ padding: 16 }}>
        <Alert severity="error">Не указан идентификатор игры</Alert>
        <Link to="/lobby">← Вернуться в лобби</Link>
      </div>
    );
  }

  // Веер руки: карты перекрываются, крайние наклонены, центральная выше
  const handN = hand.length;
  const handMid = (handN - 1) / 2;
  const handSpan = handN > 1 ? Math.min(120, (633 - cardSizes.hand.width) / (handN - 1)) : 0;
  const handStartX = (633 - (cardSizes.hand.width + handSpan * Math.max(handN - 1, 0))) / 2;

  // Позиции конюшен соперников по макету (первые три соперника)
  const foeSlots = [
    { x: 100, y: 235, w: 350, h: 167 },
    { x: 700, y: 252, w: 520, h: 167 },
    { x: 1470, y: 235, w: 350, h: 167 },
  ];

  const phaseCells: Array<{ key: keyof typeof PHASE_LABELS }> = [
    { key: 'begin_turn' },
    { key: 'draw' },
    { key: 'action' },
    { key: 'end_turn' },
  ];

  // Подсказка в памятке: что сейчас можно сделать
  const memoText = (() => {
    if (!view) return 'Ждём данные от сервера.';
    if (!isMyTurn) return `Ход соперника: ${nickOf(view.currentPlayerId)}. Ждите.`;
    if (reactionOpen) return 'Идёт окно реакции. Ждём ответов оппонентов.';
    if (canDraw) return 'Возьмите карту из колоды или сыграйте карту из руки.';
    if (view.phase === 'action') return 'Сыграйте карту из руки или завершите ход.';
    return 'Ход переходит дальше.';
  })();

  const drawHint = !game.connected
    ? 'Нет связи с сервером'
    : !isMyTurn
      ? 'Сейчас не ваш ход'
      : view?.hasDrawn
        ? 'Карта уже добрана в этом ходу'
        : view?.phase !== 'begin_turn'
          ? 'Добор доступен только в начале хода'
          : 'Добрать карту из колоды';

  const endHint = !game.connected
    ? 'Нет связи с сервером'
    : !isMyTurn
      ? 'Сейчас не ваш ход'
      : reactionOpen
        ? 'Сначала разрешите реакции'
        : 'Завершить ход';

  return (
    <div>
      {/* Ошибки действий. PENDING_ACTION — «идёт окно реакции», а не поломка */}
      {error && !reactError && (
        <Alert
          severity={reactionsUnavailable ? 'info' : 'error'}
          sx={{ mb: 1 }}
          onClose={game.clearError}
        >
          {describeSocketError(error.code, error.message)}
          {!reactionsUnavailable && error.code === 'NO_ACK' && ' — проверьте, запущен ли сервер'}
        </Alert>
      )}
      {actionMessage && !error && (
        <Alert severity="warning" sx={{ mb: 1 }} onClose={() => setActionMessage(null)}>
          {actionMessage}
        </Alert>
      )}

      {/* Сцена стола 1920×1080, масштабируется по ширине контейнера */}
      <div
        ref={stageWrapRef}
        style={{ position: 'relative', width: '100%', height: STAGE_H * scale, overflow: 'hidden' }}
      >
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: STAGE_W,
            height: STAGE_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            background: pal.pageBg,
            fontFamily: fonts.body,
            color: pal.text,
          }}
        >
          {/* Многослойный фон стола: дерево, борт, кромка, сукно, печать, заклёпки */}
          <TableBackdrop pal={pal} />

          {/* Верхняя панель партии */}
          <div
            style={at(44, 22, 1832, 72, {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '0 20px',
              boxSizing: 'border-box',
              background: pal.cardFace,
              borderRadius: radii.lg,
              boxShadow: shadows.card,
            })}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 30, lineHeight: 1.1 }}>
                Неудержимые единорожки
              </div>
              <div
                style={{
                  fontFamily: fonts.mono,
                  fontSize: typeScale.tiny,
                  color: pal.accent,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {statePlayers.length || '—'} игрока · до {WIN_UNICORNS} единорогов · комната {roomId}
              </div>
            </div>
            <StatBlock label="Ход" value={view ? nickOf(view.currentPlayerId) : '—'} accent={isMyTurn ? pal.accent : undefined} />
            <StatBlock label="Фаза" value={view ? PHASE_LABELS[view.phase] : 'ожидание'} />
            <StatBlock
              label="Статус"
              value={
                view?.winnerId
                  ? `🏆 ${nickOf(view.winnerId)}`
                  : isMyTurn
                    ? '◆ Ваш ход'
                    : 'Ждём соперника'
              }
              accent={isMyTurn ? pal.accent : undefined}
            />
            <ConnectionPill online={game.connected} />
            <input
              aria-label="Никнейм"
              value={nickname}
              onChange={(e) => onNicknameChange(e.target.value)}
              style={{ width: 150, padding: '6px 8px', borderRadius: 8, border: `1px solid ${pal.gold}` }}
            />
            <Link to="/lobby" style={{ color: pal.accent, whiteSpace: 'nowrap' }}>
              ← В лобби
            </Link>
          </div>

          {/* Трекер фаз хода */}
          <div style={at(572, 155, 735, 72, { display: 'flex', gap: 6, alignItems: 'center' })}>
            {phaseCells.map((cell) => {
              const active = view?.phase === cell.key;
              return (
                <div
                  key={cell.key}
                  style={{
                    flex: 1,
                    height: 58,
                    borderRadius: radii.md,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: active ? pal.accent : pal.surfaceAlt,
                    color: active ? pal.cardFace : pal.onFelt,
                    fontWeight: 800,
                    fontSize: typeScale.body,
                    border: `1px solid ${active ? pal.accent : pal.border}`,
                  }}
                >
                  {PHASE_LABELS[cell.key]}
                </div>
              );
            })}
          </div>

          {/* Зона соперников: конюшни по кругу */}
          {foes.map((p, i) => {
            const slot = foeSlots[i];
            const foeStable = p.stable;
            const foeUnicorns = foeStable.filter((id) => isUnicornType(cards[id]?.type)).length;
            // Единороги соперника: веер без обрезки, не-единороги — плашками
            const foeUnis = foeStable.filter((id) => isUnicornType(cards[id]?.type));
            const foeOthers = foeStable.filter((id) => !isUnicornType(cards[id]?.type));
            const foeStep = foeUnis.length > 1 ? Math.min(cardSizes.foeStable.width, (slot.w - 20 - cardSizes.foeStable.width) / (foeUnis.length - 1)) : 0;
            return (
              <div
                key={p.id}
                style={at(slot.x, slot.y, slot.w, slot.h, {
                  borderRadius: 16,
                  background: pal.surfaceAlt,
                  border: `1px solid ${pal.border}`,
                  padding: 10,
                  boxSizing: 'border-box',
                  color: pal.onFelt,
                })}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 22 }}>{nickOf(p.id)}</span>
                  <span style={{ color: pal.accent, fontWeight: 900 }}>
                    {foeUnicorns}/{WIN_UNICORNS}
                  </span>
                </div>
                {/* Единороги соперника веером; не-единороги — плашки цветом эффекта, полная карта по ховеру */}
                <div style={{ position: 'relative', marginTop: 2, height: cardSizes.foeStable.height }}>
                  {foeUnis.map((id, j) => (
                    <TableCard dataMarker={'foe-stable:' + id}
                      pal={pal}
                      key={id}
                      card={cards[id]}
                      name={cards[id]?.name || id}
                      width={cardSizes.foeStable.width}
                      height={cardSizes.foeStable.height}
                      style={{ position: 'absolute', left: j * foeStep, top: 0 }}
                    />
                  ))}
                </div>
                {foeOthers.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2, height: 18 }}>
                    {foeOthers.map((id) => {
                      const c = cards[id];
                      const nm = c?.name || id;
                      return (
                        <div
                          key={id}
                          data-foe-chip={id}
                          title={nm}
                          onMouseEnter={() => setHoverForeId(id)}
                          onMouseLeave={() => setHoverForeId(null)}
                          style={{
                            position: 'relative',
                            background: cardTypeColor(c?.type),
                            color: pal.text,
                            borderRadius: 6,
                            padding: '0 6px',
                            fontSize: 11,
                            fontWeight: 700,
                            lineHeight: '18px',
                            maxWidth: 160,
                          }}
                        >
                          <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nm}</span>
                          {hoverForeId === id && c && (
                            <div data-foe-chip-popup={id} style={{ position: 'absolute', left: 0, top: '100%', marginTop: 2, zIndex: 60, pointerEvents: 'none' }}>
                              <TableCard pal={pal} card={c} name={nm} width={cardSizes.hand.width} height={cardSizes.hand.height} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ fontSize: typeScale.small, color: pal.onFeltMuted, marginTop: 4 }}>
                  Рука: {p.hand.length}
                  {view?.currentPlayerId === p.id ? ' · ◁ ходит' : ''}
                </div>
              </div>
            );
          })}

          {/* Общие стопки: колода и сброс */}
          <div style={at(800, 420, 126, 244)}>
            <ZoneLabel title="Колода" />
            <div style={{ position: 'relative', marginTop: 14, width: 126, height: 180 }}>
              {/* Стопка рубашек: три карты со сдвигом по диагонали. Рубашку рисует
                   CardBack вектором — картинка не нужна, поэтому рисунок идёт
                   ровно по осям карты и не косит. */}
              {[2, 1, 0].map((k) => (
                <CardBack
                  key={k}
                  width={cardSizes.deck.width}
                  height={cardSizes.deck.height}
                  pal={pal}
                  radius={radii.md}
                  dataPart="deck-card-back"
                  style={at(18 + k * 3, k * 3, cardSizes.deck.width, cardSizes.deck.height, {
                    boxShadow: shadows.card,
                    zIndex: 3 - k,
                  })}
                />
              ))}
            </div>
            <div style={{ marginTop: 6, fontSize: typeScale.body, fontWeight: 800 }}>
              {cardsCount(view?.deckCount ?? 0)}
            </div>
          </div>
          <div style={at(958, 420, 126, 244)}>
            <ZoneLabel title="Сброс" />
            <div style={{ position: 'relative', marginTop: 14, width: 126, height: 186 }}>
              {game.state?.discard && game.state.discard.length > 0 ? (
                <TableCard
                  pal={pal}
                  card={cards[game.state.discard[game.state.discard.length - 1]]}
                  name={cards[game.state.discard[game.state.discard.length - 1]]?.name || game.state.discard[game.state.discard.length - 1]}
                  width={cardSizes.discard.width}
                  height={cardSizes.discard.height}
                  style={{ position: 'absolute', left: 3, top: 0 }}
                />
              ) : (
                <div
                  style={at(3, 0, cardSizes.discard.width, cardSizes.discard.height, {
                    borderRadius: radii.md,
                    border: `2px dashed ${pal.border}`,
                    boxSizing: 'border-box',
                  })}
                />
              )}
            </div>
            <div style={{ marginTop: 6, fontSize: typeScale.body, fontWeight: 800 }}>
              {cardsCount(view?.discardCount ?? 0)}
            </div>
          </div>

          {/* Памятка: что сейчас можно сделать */}
          <div
            style={at(1180, 464, 230, 176, {
              borderRadius: 16,
              background: pal.cardFace,
              boxShadow: shadows.card,
              padding: 12,
              boxSizing: 'border-box',
            })}
          >
            <ZoneLabel title={view ? PHASE_LABELS[view.phase] : 'Ожидание'} />
            <div style={{ marginTop: 8, fontSize: typeScale.bodyLg, color: pal.text, lineHeight: 1.35 }}>
              {memoText}
            </div>
          </div>

          {/* Журнал партии */}
          <div
            style={at(100, 443, 350, 201, {
              borderRadius: 16,
              background: pal.cardFace,
              boxShadow: shadows.card,
              padding: 12,
              boxSizing: 'border-box',
              overflow: 'hidden',
            })}
          >
            <ZoneLabel title="Журнал партии" />
            <div style={{ marginTop: 8, height: 150, overflowY: 'auto' }}>
              {game.logs.length === 0 && (
                <div style={{ fontStyle: 'italic', color: pal.textMuted, fontSize: typeScale.body }}>
                  События пока отсутствуют…
                </div>
              )}
              {game.logs.slice(-30).map((entry, idx) => (
                <div
                  key={`${entry.t}-${idx}`}
                  style={{ fontFamily: fonts.mono, fontSize: typeScale.small, color: pal.text, marginBottom: 4 }}
                >
                  {logLine(entry, nicknames)}
                </div>
              ))}
            </div>
          </div>

          {/* Порядок хода */}
          <div
            style={at(1470, 460, 350, 101, {
              borderRadius: 16,
              background: pal.cardFace,
              boxShadow: shadows.card,
              padding: 12,
              boxSizing: 'border-box',
            })}
          >
            <ZoneLabel title="Порядок хода" />
            <div style={{ marginTop: 6, fontSize: typeScale.bodyLg, fontWeight: 800 }}>
              {statePlayers.map((p) => nickOf(p.id)).join(' → ') || '—'}
            </div>
          </div>

          {/* Своя зона: конюшня и подпись игрока */}
          <div
            style={at(86, 681, 185, 176, {
              color: pal.onFelt,
            })}
          >
            <ZoneLabel title="Ваша конюшня" />
            <div style={{ fontFamily: fonts.display, fontWeight: 700, fontSize: 26, marginTop: 6 }}>
              {nickOf(playerId)}
            </div>
            <div style={{ color: pal.accent, fontWeight: 900, marginTop: 4 }}>
              ◆ {myUnicorns.length}/{WIN_UNICORNS}
            </div>
            <div style={{ color: pal.onFeltMuted, fontSize: typeScale.body }}>
              Ещё {Math.max(WIN_UNICORNS - myUnicorns.length, 0)} до победы
            </div>
            {isMyTurn && (
              <div style={{ color: pal.accent, fontWeight: 800, fontSize: typeScale.body, marginTop: 4 }}>
                ● Ваш ход
              </div>
            )}
          </div>

          {/* Единороги в конюшне игрока: веер как в руке, ховер поднимает наведённую карту */}
          <div style={at(286, 697, 489, 221)}>
            {myUnicorns.map((id, i) => {
              const step = myUnicorns.length > 1 ? Math.min(142, (489 - cardSizes.ownStable.width) / (myUnicorns.length - 1)) : 0;
              const hovered = hoverStableId === id;
              return (
                <TableCard
                  pal={pal}
                  key={id}
                  card={cards[id]}
                  name={cards[id]?.name || id}
                  width={cardSizes.ownStable.width}
                  height={cardSizes.ownStable.height}
                  dataMarker={'own-stable:' + id}
                  onHover={(h) => setHoverStableId(h ? id : null)}
                  style={{
                    position: 'absolute',
                    left: i * step,
                    top: 0,
                    zIndex: hovered ? 50 : i + 1,
                    transform: `translateY(${hovered ? -26 : 0}px) scale(${hovered ? 1.08 : 1})`,
                    transition: 'transform 140ms ease',
                  }}
                />
              );
            })}
          </div>

          {/* Не-единороги в конюшне: вне счёта, наклонённый ряд с ховером */}
          {myOther.length > 0 && (
            <div data-my-other style={at(791, 698, 124, 201)}>
              {myOther.map((id, i) => {
                const n = myOther.length;
                const mid = (n - 1) / 2;
                const rot = n > 1 ? ((i - mid) / Math.max(mid, 1)) * 6 : 0;
                const step = n > 1 ? Math.min(cardSizes.foeStable.width * 0.7, (124 - cardSizes.foeStable.width) / (n - 1)) : 0;
                const hovered = hoverStableId === id;
                return (
                  <TableCard
                    pal={pal}
                    key={id}
                    card={cards[id]}
                    name={cards[id]?.name || id}
                    width={cardSizes.foeStable.width}
                    height={cardSizes.foeStable.height}
                    onHover={(h) => setHoverStableId(h ? id : null)}
                    style={{
                      position: 'absolute',
                      left: i * step,
                      top: 0,
                      zIndex: hovered ? 50 : i + 1,
                      transform: `rotate(${rot}deg) translateY(${hovered ? -26 : 0}px) scale(${hovered ? 1.08 : 1})`,
                      transition: 'transform 140ms ease',
                    }}
                  />
                );
              })}
              <div style={{ position: 'absolute', top: cardSizes.foeStable.height + 4, left: 0, fontSize: typeScale.small, color: pal.textMuted }}>
                Не считается · {myOther.length}
              </div>
            </div>
          )}

          {/* Счётчик руки и веер */}
          <div style={at(963, 681, 600, 22)}>
            <ZoneLabel title={`Ваша рука: ${handN}/${HAND_LIMIT}`} />
          </div>
          <div style={at(951, 709, 633, 270)}>
            {hand.length === 0 && (
              <div style={at(0, 90, 633, 40, { textAlign: 'center', color: pal.onFelt, fontStyle: 'italic' })}>
                Карт в руке нет
              </div>
            )}
            {hand.map((id, i) => {
              const offset = handN > 1 ? Math.abs(i - handMid) / Math.max(handMid, 1) : 0;
              const rot = handN > 1 ? ((i - handMid) / Math.max(handMid, 1)) * 8 : 0;
              const hovered = hoverId === id;
              return (
                <TableCard
                  pal={pal}
                  key={id}
                  card={cards[id]}
                  name={cards[id]?.name || id}
                  width={cardSizes.hand.width}
                  height={cardSizes.hand.height}
                  onClick={() => void onPlayCard(id)}
                  onHover={(h) => setHoverId(h ? id : null)}
                  style={{
                    position: 'absolute',
                    left: handStartX + i * handSpan,
                    top: offset * 18,
                    zIndex: hovered ? 50 : i + 1,
                    transform: `rotate(${rot}deg) translateY(${hovered ? -26 : 0}px) scale(${hovered ? 1.08 : 1})`,
                    transition: 'transform 140ms ease',
                  }}
                />
              );
            })}
          </div>

          {/* Управление ходом на столе */}
          <div
            style={at(1590, 723, 252, 197, {
              borderRadius: 16,
              background: pal.cardFace,
              boxShadow: shadows.card,
              padding: 12,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            })}
          >
            <div style={{ color: pal.accent, fontWeight: 800, fontSize: typeScale.bodyLg }}>
              Розыгрыш карты
            </div>
            <div style={{ color: pal.textMuted, fontSize: typeScale.body, lineHeight: 1.35 }}>{memoText}</div>
            <StoneButton
              variant="stone"
              disabled={!canDraw || !game.connected}
              onClick={() => void onDraw()}
              title={drawHint}
            >
              Взять карту
            </StoneButton>
            <StoneButton
              variant="primary"
              disabled={!canEnd}
              onClick={() => void onEndTurn()}
              title={endHint}
            >
              {reactionOpen && isMyTurn ? 'Завершить ход (ждём реакции)' : 'Завершить ход'}
            </StoneButton>
          </div>

          {/* Ошибки и победа поверх стола */}
          {view?.winnerId && (
            <div
              style={at(660, 470, 600, 60, {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: fonts.display,
                fontWeight: 700,
                fontSize: 36,
                color: pal.onFelt,
              })}
            >
              🏆 Победитель: {nickOf(view.winnerId)}
            </div>
          )}
        </div>
      </div>

      {/* Окно выбора игрока-цели: для downgrade и как страховка по отказу сервера */}
      <Dialog open={targetPick !== null} onClose={onCancelTarget} maxWidth="xs" fullWidth>
        <DialogTitle>Выберите игрока, к чьему стойлу прикрепить карту</DialogTitle>
        <DialogContent dividers>
          {targetPick && (
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Карта: {view?.cardName(targetPick.cardId) ?? targetPick.cardId}
            </Typography>
          )}
          {targetError && (
            <Alert severity="error" sx={{ mb: 1 }}>
              {targetError}
            </Alert>
          )}
          <List>
            {statePlayers.map((p) => (
              <ListItem key={p.id} disablePadding>
                <Button
                  fullWidth
                  variant="outlined"
                  sx={{ justifyContent: 'flex-start', mb: 1 }}
                  disabled={targetBusy}
                  onClick={() => void onPickTarget(p.id)}
                >
                  {nickOf(p.id)}
                  {p.id === playerId ? ' (вы)' : ''}
                </Button>
              </ListItem>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancelTarget} disabled={targetBusy}>
            Отмена
          </Button>
        </DialogActions>
      </Dialog>

      {/* Окно выбора карты защитником: отдельная модалка, без закрытия кнопкой и Esc */}
      <AwaitChoiceModal
        pending={game.pending}
        mePlayerId={playerId}
        state={game.state}
        nicknames={nicknames}
        error={reactError}
        busy={reactBusy}
        onPick={(id) => void onPickAwaitChoice(id)}
      />

      {/* Окно реакции: таймер до expiresAt, кнопки по pending.kind, отказ сервера внутри окна */}
      <NeighModal
        pending={game.pending?.kind === 'await_choice' ? null : game.pending}
        mePlayerId={playerId}
        state={game.state}
        nicknames={nicknames}
        error={reactError}
        busy={reactBusy}
        onReact={(kind, extra) => void onReact(kind, extra)}
        onSkip={() => void onSkipReaction()}
      />
    </div>
  );
}
