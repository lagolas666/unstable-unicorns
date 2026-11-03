/**
 * Окно выбора карты защитником (await_choice): force_discard, Puppetmaster.
 * Показывается только защитнику: playerId === chooserId из pending.
 * Закрыть окно нельзя: ни Esc, ни клик по фону, ни кнопкой. Окно снимается
 * выбором карты или таймером pending.expiresAt (сервер сам сбросит случайную карту).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogContent, DialogTitle, Typography } from '@mui/material';
import type { GameState, PendingInfo } from '../types/socket';

export interface AwaitChoiceModalProps {
  /** Окно из pending_update; показываем только kind === 'await_choice'. */
  pending: PendingInfo | null;
  /** Мой playerId: окно видит только chooserId. */
  mePlayerId: string | undefined;
  /** Состояние игры: карты (названия) и моя рука. */
  state: GameState | null;
  /** Никнеймы по playerId для подписи актора эффекта. */
  nicknames?: Record<string, string>;
  /** Текст отказа сервера для resolve_pending (уже переведён), null — ошибки нет. */
  error?: string | null;
  /** Идёт запрос к серверу: кнопки блокируются. */
  busy?: boolean;
  /** Выбор карты защитника: отправляет resolve_pending с cardId. */
  onPick: (cardId: string) => void;
}

function AwaitChoiceModal({
  pending,
  mePlayerId,
  state,
  nicknames = {},
  error = null,
  busy = false,
  onPick,
}: AwaitChoiceModalProps) {
  // Таймер обновляется раз в 250 мс, как в NeighModal
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!pending) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [pending]);

  const chooserId = typeof pending?.chooserId === 'string' ? pending.chooserId : null;
  const isOpen = pending?.kind === 'await_choice' && !!state && chooserId !== null && chooserId === mePlayerId;

  // Варианты: только карты из options, которые реально лежат в моей руке
  const options = useMemo<string[]>(() => {
    const raw: unknown[] = Array.isArray(pending?.options) ? (pending?.options as unknown[]) : [];
    const ids = raw.filter((x): x is string => typeof x === 'string');
    const me = state?.players?.find((p) => p.id === mePlayerId) as { hand?: string[] } | undefined;
    const hand = me && Array.isArray(me.hand) ? me.hand : null;
    return hand ? ids.filter((id) => hand.includes(id)) : ids;
  }, [pending, state, mePlayerId]);

  if (!isOpen || !state) return null;

  const expiresAt = typeof pending?.expiresAt === 'number' ? pending.expiresAt : null;
  const remainingMs = expiresAt === null ? null : Math.max(0, expiresAt - now);
  const expired = remainingMs !== null && remainingMs <= 0;
  const seconds = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const left = typeof pending?.remaining === 'number' ? pending.remaining : null;
  const cards = state.cards ?? {};
  const cardName = (id: string): string => cards[id]?.name || id;
  const actorName = typeof pending?.actorId === 'string' ? nicknames[pending.actorId] || pending.actorId : 'Соперник';
  const sourceName =
    typeof pending?.sourceCardId === 'string' ? cardName(pending.sourceCardId) : 'эффект';

  return (
    <Dialog
      open
      onClose={() => {}}
      disableEscapeKeyDown
      aria-labelledby="await-choice-title"
      fullWidth
      maxWidth="sm"
    >
      <DialogTitle id="await-choice-title">Выбор карты: {sourceName}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom role="timer" aria-live="polite">
          {seconds === null ? 'Время не задано' : expired ? 'Время выбора истекло' : `Осталось: ${seconds} с`}
        </Typography>
        <Typography gutterBottom>
          {actorName} вынуждает тебя сбросить карту из руки.
          {left !== null && left > 0 ? ` Ещё карт к сбросу: ${left}.` : ''}
        </Typography>

        {options.length === 0 ? (
          <Typography color="text.secondary">В руке нет подходящих карт. Окно закроется по таймеру.</Typography>
        ) : (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
            {options.map((id) => (
              <Button
                key={id}
                variant="outlined"
                color="error"
                disabled={busy || expired}
                onClick={() => onPick(id)}
              >
                {cardName(id)}
              </Button>
            ))}
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default React.memo(AwaitChoiceModal);
