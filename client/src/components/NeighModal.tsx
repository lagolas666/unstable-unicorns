/**
 * Окно реакций (Ржание и прочие): таймер до pending.expiresAt, кнопки по buildReactRows.
 * Изолированный компонент: без socket, всё через props.
 * Отказ сервера показывается внутри окна, окно не закрывается — закрывает pending_update с null.
 * Окно закрывается таймером до pending.expiresAt или реакцией. Esc и клик по фону не закрывают.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import type { GameState, PendingInfo, ReactExtra } from '../types/socket';
import { buildReactRows, isTargetField, type ReactField, type ReactGroup, type ReactRow } from '../utils/neighOptions';

export interface NeighModalProps {
  /** Окно реакции из pending_update; null — окна нет, модалка не рисуется. */
  pending: PendingInfo | null;
  /** Мой playerId. */
  mePlayerId: string | undefined;
  /** Состояние игры: руки, карты, игроки. */
  state: GameState | null;
  /** Никнеймы по playerId для подписей целей. */
  nicknames?: Record<string, string>;
  /** Текст отказа сервера (уже переведён), null — ошибки нет. */
  error?: string | null;
  /** Идёт запрос к серверу: кнопки блокируются. */
  busy?: boolean;
  /** Отправка реакции: kind и payload-поля. */
  onReact: (kind: string, extra: ReactExtra) => void;
  /** Пропуск реакции: кнопка видна не актору окна и закрывает окно через resolve_pending. */
  onSkip: () => void;
}

/** Подписи полей для селектов. */
const FIELD_LABEL: Record<ReactField, string> = {
  instantCardId: 'Карта',
  cardId: 'Карта',
  discardCardId: 'Сбросить',
  targetId: 'Цель',
  toTargetId: 'Новая цель',
  receiverPlayerId: 'Получатель',
};

/** Заголовки групп кнопок. */
const GROUP_TITLE: Record<ReactGroup, string> = {
  cancel: 'Отменить',
  defense: 'Защита и перенаправление',
  instant: 'Сыграть как мгновенную',
  effect: 'Вмешаться в эффект',
};

const GROUP_ORDER: ReactGroup[] = ['cancel', 'defense', 'instant', 'effect'];

export default function NeighModal({
  pending,
  mePlayerId,
  state,
  nicknames = {},
  error = null,
  busy = false,
  onReact,
  onSkip,
}: NeighModalProps) {
  // Таймер обновляется раз в 250 мс: достаточно для отображения секунд
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!pending) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [pending]);

  const rows = useMemo(() => buildReactRows(pending, mePlayerId, state), [pending, mePlayerId, state]);

  if (!pending || !state) return null;

  const expiresAt = typeof pending.expiresAt === 'number' ? pending.expiresAt : null;
  const remainingMs = expiresAt === null ? null : Math.max(0, expiresAt - now);
  const expired = remainingMs !== null && remainingMs <= 0;
  const seconds = remainingMs === null ? null : Math.ceil(remainingMs / 1000);
  const isActor = pending.actorId === mePlayerId;

  const cardName = (id: string): string => state.cards[id]?.name || id;
  const nickOf = (id: string): string => nicknames[id] || id;
  const sourceId = pending.kind === 'play' ? String(pending.cardId ?? '') : String(pending.sourceCardId ?? '');
  const title = pending.kind === 'play' ? `Розыгрыш карты: ${cardName(sourceId)}` : `Эффект карты: ${cardName(sourceId)}`;

  return (
    <Dialog open onClose={() => {}} aria-labelledby="neigh-modal-title" fullWidth maxWidth="sm">
      <DialogTitle id="neigh-modal-title">{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" gutterBottom role="timer" aria-live="polite">
          {seconds === null ? 'Время не задано' : expired ? 'Время ответа истекло' : `Осталось: ${seconds} с`}
        </Typography>

        {isActor ? (
          <Typography>Твой розыгрыш в окне реакции, ждём ответа оппонентов.</Typography>
        ) : rows.length === 0 ? (
          <Typography color="text.secondary">У тебя нет подходящих реакций. Окно закроется по таймеру.</Typography>
        ) : (
          GROUP_ORDER.map((group) => {
            const groupRows = rows.filter((r) => r.group === group);
            if (groupRows.length === 0) return null;
            return (
              <Box key={group} sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" gutterBottom>
                  {GROUP_TITLE[group]}
                </Typography>
                {groupRows.map((row) => (
                  <ReactRowView
                    key={row.kind}
                    row={row}
                    disabled={busy || expired}
                    cardName={cardName}
                    nickOf={nickOf}
                    onSubmit={(extra) => onReact(row.kind, extra)}
                  />
                ))}
              </Box>
            );
          })
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 1 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      {/* Пропуск реакции: кнопка у реагирующего, актору окна не показывается */}
      {!isActor && (
        <DialogActions data-testid="neigh-skip-action">
          <Button variant="text" size="small" disabled={busy} onClick={() => onSkip()}>
            Пропустить реакцию
          </Button>
        </DialogActions>
      )}
    </Dialog>
  );
}

interface ReactRowViewProps {
  row: ReactRow;
  disabled: boolean;
  cardName: (id: string) => string;
  nickOf: (id: string) => string;
  onSubmit: (extra: ReactExtra) => void;
}

/** Одна строка: кнопка вида реакции и селекты его полей. Выбор хранится локально. */
function ReactRowView({ row, disabled, cardName, nickOf, onSubmit }: ReactRowViewProps) {
  const [picked, setPicked] = useState<Partial<Record<ReactField, string>>>({});

  const listFor = (field: ReactField): string[] => (isTargetField(field) ? row.targets : row.cards);
  const valueOf = (field: ReactField): string => picked[field] ?? listFor(field)[0] ?? '';

  const submit = () => {
    const extra: ReactExtra = {};
    for (const field of row.fields) {
      extra[field] = valueOf(field);
    }
    onSubmit(extra);
  };

  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
      <Button variant="contained" size="small" disabled={disabled} onClick={submit}>
        {row.label}
      </Button>
      {row.fields.map((field) => (
        <TextField
          key={field}
          select
          size="small"
          label={FIELD_LABEL[field]}
          value={valueOf(field)}
          onChange={(e) => setPicked((p) => ({ ...p, [field]: e.target.value }))}
          disabled={disabled}
          sx={{ minWidth: 180 }}
        >
          {listFor(field).map((id) => (
            <MenuItem key={id} value={id}>
              {isTargetField(field) ? nickOf(id) : cardName(id)}
            </MenuItem>
          ))}
        </TextField>
      ))}
    </Box>
  );
}
