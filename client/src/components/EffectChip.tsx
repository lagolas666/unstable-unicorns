import React, { useMemo } from 'react';
import { Box, Tooltip } from '@mui/material';
import type { Action, Effect } from '../../../shared/src/types';

/**
 * EffectChip — чип эффекта карты. Формат «Взять 2», «Сбросить 1» и т.д.
 * Материал: Figma-макет «Эффект / Взять N». Nunito 13px 800, высота 18px,
 * скругление 8px, обводка 1px #93734A, два цвета текста.
 *
 * Свойства:
 *   action   — объект действия { kind, quantity, ... }
 *   trigger  — триггер (показывается в тултипе)
 *   theme    — 'rainbow' | 'dark'
 */

export type ChipTheme = 'rainbow' | 'dark';

export interface EffectChipProps {
  action: Action;
  trigger?: string;
  theme?: ChipTheme;
}

// ===== Дизайн чипов по Figma =====

interface ChipDesign {
  label: string;         // подпись с N — будет заменён на число
  description: string;
  group: string;
}

export const CHIP_DESIGNS: Record<string, ChipDesign> = {
  // Манипуляции с картами
  add:                { label: 'Взять N',       description: 'Из колоды в руку.',                    group: 'draw' },
  draw:               { label: 'Взять N',       description: 'Из колоды в руку.',                    group: 'draw' },
  draw_conditional:   { label: 'Добирать до…',  description: 'Добирать до условия.',                  group: 'draw' },
  discard:            { label: 'Сбросить N',    description: 'Из руки в сброс.',                      group: 'discard' },
  force_discard:      { label: 'Сбросить N',    description: 'Соперник сбрасывает.',                  group: 'discard' },
  mill_until:         { label: 'Сбросить до…',  description: 'Из колоды в сброс до условия.',         group: 'discard' },
  destroy:            { label: 'Уничтожить N',  description: 'Со стола в сброс.',                     group: 'destroy' },
  sacrifice:          { label: 'Пожертвовать N',description: 'Свою карту со стола в сброс.',          group: 'destroy' },
  return_to_hand:     { label: 'Вернуть в руку',description: 'Со стола обратно в руку.',              group: 'move' },
  steal:              { label: 'Украсть N',     description: 'Чужую карту себе.',                     group: 'steal' },
  move:               { label: 'Переместить',   description: 'Из одной зоны в другую.',               group: 'move' },
  transfer:           { label: 'Переместить',   description: 'Из одной зоны в другую.',               group: 'move' },
  give:               { label: 'Переместить',   description: 'Из одной зоны в другую.',               group: 'move' },
  return:             { label: 'Вернуть в руку',description: 'Со стола в руку.',                       group: 'move' },
  pull:               { label: 'Призвать',      description: 'Малыша из Яслей в стойло.',             group: 'move' },
  swap:               { label: 'Обменять',      description: 'Поменяться картами.',                    group: 'swap' },
  pass_hands:         { label: 'Передать',      description: 'Передать руку по кругу.',               group: 'move' },
  choose_players:     { label: 'Выб��ать',       description: 'Выбрать игрока.',                       group: 'target' },

  // Работа с колодой
  search:             { label: 'Найти карту',   description: 'Выбрать карту из колоды.',              group: 'deck' },
  peek:               { label: 'Посмотреть N',  description: 'Посмотреть верх колоды.',               group: 'deck' },
  reorder_top:        { label: 'Переставить',   description: 'Изменить порядок верха колоды.',        group: 'deck' },
  shuffle_deck:       { label: 'Перетасовать',  description: 'Перемешать колоду.',                    group: 'deck' },
  mega_shuffle:       { label: 'Мега-тасовка',  description: 'Вернуть все карты и перемешать.',       group: 'deck' },
  reveal:             { label: 'Показать',      description: 'Раскрыть карты.',                       group: 'deck' },

  // Отмена / защита
  cancel:             { label: 'Отменить',      description: 'Прервать действие соперника.',           group: 'cancel' },
  prevent:            { label: 'Защита',        description: 'Запретить уничтожение/эффект.',          group: 'immunity' },
  protect:            { label: 'Защита',        description: 'Запретить уничтожение/эффект.',          group: 'immunity' },
  ignore:             { label: 'Пропустить',    description: 'Проигнорировать эффект.',                group: 'cancel' },
  redirect_target:    { label: 'Перенаправить', description: 'Изменить цель.',                         group: 'cancel' },
  reactive_trigger:   { label: 'Реакция',       description: 'Срабатывает при реакции.',               group: 'cancel' },

  // Фазы
  skip_phase:         { label: 'Пропустить фазу',  description: 'Пропустить фазу хода.',              group: 'phase' },
  skip_turn:          { label: 'Пропустить ход',   description: 'Пропустить следующий ход.',          group: 'phase' },
  extra_action:       { label: 'Доп. действие',    description: 'Разыграть ещё карту.',               group: 'phase' },
  goto_end_turn:      { label: 'Завершить ход',  description: 'Немедленно завершить ход.',            group: 'phase' },

  // Лимиты
  limit_actions:      { label: 'Лимит действий',    description: 'Ограничить розыгрыш.',               group: 'limit' },
  restrict_action:    { label: 'Запрет на тип',     description: 'Запретить тип карт.',                group: 'limit' },
  modify_hand_limit:  { label: 'Изменить лимит',    description: 'Изменить лимит руки.',               group: 'limit' },
  modify_win_condition:{ label: 'Изменить правило', description: 'Изменить условие победы.',           group: 'flag' },
  modify_action:      { label: 'Изменить действие', description: 'Изменить действие.',                 group: 'flag' },
  set_flag:           { label: 'Флаг',              description: 'Установить флаг.',                   group: 'flag' },

  // Особые
  choice:             { label: 'Выберите',       description: 'Выберите из вариантов.',                group: 'special' },
  conditional_loop:   { label: 'Цикл',           description: 'Повторять до условия.',                group: 'special' },
  copy_effects:       { label: 'Копировать',     description: 'Скопировать эффект карты.',             group: 'special' },
  grant_immunity:     { label: 'Иммунитет',      description: 'Дать неуязвимость.',                   group: 'immunity' },
  immediate:          { label: 'Мгновенно',      description: 'Срабатывает сразу.',                    group: 'special' },
};

// ===== Хелперы =====

function getQuantity(action: Action): number | null {
  const qty = (action as any)?.quantity?.value ?? (action as any)?.quantity ?? null;
  if (typeof qty === 'number' && qty >= 1) return qty;
  return null;
}

/** Разбить подпись: «Взять N» → labelPart='Взять ', showQty=true */
function splitLabel(labelTmpl: string, qty: number | null): { labelPart: string; showQty: boolean } {
  const idx = labelTmpl.indexOf('N');
  if (idx === -1 || qty === null) return { labelPart: labelTmpl.replace(/\s*N\s*/, '').trim(), showQty: false };
  return { labelPart: labelTmpl.slice(0, idx), showQty: true };
}

function buildTooltip(label: string, design: ChipDesign, trigger?: string, optional?: boolean): string {
  const parts: string[] = [label];
  if (design.description) parts.push(design.description);
  if (trigger) {
    const tmap: Record<string, string> = {
      immediate: 'Сразу', on_play: 'При розыгрыше', on_enter_stable: 'При входе в стойло',
      on_turn_start: 'В начале хода', on_turn_end: 'В конце хода', while_in_stable: 'Пока в стойле',
      when_other_plays: 'Когда другой разыгрывает', on_discard: 'При сбросе', on_destroy: 'При уничтожении',
      on_sacrifice: 'При пожертвовании', after_resolve: 'После разрешения',
    };
    parts.push(tmap[trigger] || trigger);
  }
  if (optional) parts.push('Можно пропустить');
  return parts.join(' · ');
}

// ===== EffectChip =====

export default function EffectChip({ action, trigger, theme = 'rainbow' }: EffectChipProps) {
  const kind = action?.kind;
  const fallback: ChipDesign = { label: kind || '?', description: '', group: 'special' };
  const design = CHIP_DESIGNS[kind] || fallback;
  const qty = getQuantity(action);
  const labelTmpl = design.label;
  const { labelPart, showQty } = splitLabel(labelTmpl, qty);
  const fullLabel = showQty ? `${labelPart}${qty}` : labelPart;

  const isDark = theme === 'dark';
  const bgColor = isDark ? 'rgba(53,39,24,0.9)' : 'rgba(245,228,202,0.85)';
  const textColor = isDark ? '#F5E4CA' : '#000000';
  const qtyColor = '#DAB878';

  const chip = (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 18,
        borderRadius: '8px',
        border: '1px solid #93734A',
        backgroundColor: bgColor,
        fontFamily: "'Nunito', sans-serif",
        fontSize: 13,
        fontWeight: 800,
        lineHeight: '13px',
        px: '6px',
        py: '2px',
        whiteSpace: 'nowrap',
        color: textColor,
        boxSizing: 'border-box',
      }}
    >
      <Box component="span" sx={{ color: textColor }}>{labelPart}</Box>
      {showQty && <Box component="span" sx={{ color: qtyColor, ml: '1px' }}>{qty}</Box>}
    </Box>
  );

  const tip = buildTooltip(fullLabel, design, trigger, action?.optional);
  return <Tooltip title={tip} arrow>{chip}</Tooltip>;
}

// ===== EffectChipsPanel =====

export function EffectChipsPanel({ effects, trigger, theme }: {
  effects: Effect[];
  trigger?: string;
  theme?: ChipTheme;
}) {
  const chips = useMemo(() => {
    if (!effects || effects.length === 0) return null;
    const els: React.ReactElement[] = [];
    for (const ef of effects) {
      const trig = ef.trigger || trigger;
      if (ef.actions) {
        for (const act of ef.actions) {
          if (act?.kind) {
            els.push(
              <EffectChip
                key={`${trig}-${act.kind}-${els.length}`}
                action={act}
                trigger={trig}
                theme={theme}
              />
            );
          }
        }
      }
    }
    return els.length > 0 ? els : null;
  }, [effects, trigger, theme]);

  if (!chips) return null;

  return (
    <Box sx={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
      {chips}
    </Box>
  );
}

// Re-export for convenience
export type { Action, Effect } from '../../../shared/src/types';
