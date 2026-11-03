import React from 'react';
import { fonts, radii, typeScale } from '../../theme/tokens';
import type { TablePalette } from '../../theme/tablePalette';

/** Статус готовности. Сейчас лобби его не отдаёт — тогда подпись не рисуется. */
export type PlayerSeatStatus = 'ready' | 'not-ready';

export type PlayerSeatProps = {
  /** Палитра активной темы */
  pal: TablePalette;
  /** Показываемое имя: никнейм или id игрока */
  name: string;
  /** Подпись под именем: «Вы · хозяйка комнаты», «Приглашён по ссылке» */
  caption: string;
  /** Статус готовности; без него подпись статуса не выводится */
  status?: PlayerSeatStatus;
  /** Заполнять ли пустое место приглашением (для комнат, где ещё есть места) */
  empty?: boolean;
  /** Инициал для аватара; для пустого места — «+» */
  avatar?: string;
};

/** Цвет и текст статуса; null — статуса нет, к серверу его не придумываем. */
function statusOf(pal: TablePalette, status: PlayerSeatStatus | undefined, empty?: boolean) {
  if (empty) return { color: pal.textMuted, label: '○ Свободно' };
  if (status === 'ready') return { color: pal.accent, label: '✓ Готов' };
  if (status === 'not-ready') return { color: pal.textMuted, label: '○ Не готов' };
  return null;
}

/**
 * PlayerSeat — место игрока в лобби (17:34903, блок «За столом»).
 * Фон строки — pal.surfaceAlt: отдельного токена под полосу #f1e6f2 из макета
 * в палитре нет, а новый hex заводить нельзя.
 */
function PlayerSeatBase({ pal, name, caption, status, empty, avatar }: PlayerSeatProps) {
  const st = statusOf(pal, status, empty);
  return (
    <div
      data-seat={empty ? 'empty' : 'taken'}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        height: 92,
        padding: '0 14px',
        boxSizing: 'border-box',
        borderRadius: radii.sm,
        background: pal.surfaceAlt,
        border: `1px solid ${empty ? pal.border : 'transparent'}`,
        opacity: empty ? 0.7 : 1,
      }}
    >
      {/* Аватар 62×62: буква имени, без картинок — игроки их не загружают */}
      <div
        aria-hidden="true"
        style={{
          width: 62,
          height: 62,
          flex: '0 0 62px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: empty ? 'transparent' : pal.surface,
          border: `1px solid ${pal.border}`,
          fontFamily: fonts.display,
          fontSize: 26,
          fontWeight: 700,
          color: empty ? pal.textMuted : pal.text,
        }}
      >
        {avatar ?? (empty ? '+' : name.slice(0, 1).toUpperCase())}
      </div>

      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: 20,
            fontWeight: 800,
            color: empty ? pal.textMuted : pal.text,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
        <div
          style={{
            fontFamily: fonts.mono,
            fontSize: typeScale.body,
            color: pal.textMuted,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {caption}
        </div>
      </div>

      {st ? (
        <div
          style={{
            fontFamily: fonts.body,
            fontSize: typeScale.bodyLg,
            fontWeight: 700,
            color: st.color,
            whiteSpace: 'nowrap',
          }}
        >
          {st.label}
        </div>
      ) : null}
    </div>
  );
}

export default React.memo(PlayerSeatBase);
