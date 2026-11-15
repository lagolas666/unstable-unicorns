/**
 * Таблица флагов реакций по точному имени карты.
 *
 * Источник истины по трём свойствам — правила Даниила:
 *  1) Супер Нет (cancelLevel 2) нельзя отменить обычным Neigh и Counter-Neigh,
 *     перемотка (rewind) её снимает;
 *  2) Элюсивный Окелотикорн в стойле запрещает ДРУГИМ играть отмены
 *     (Neigh, Super-Neigh, Counter-Neigh), себе не запрещает;
 *  3) бонус-запрет: владелец запрещает соперникам любые мгновенные карты против себя.
 *
 * Тексты в unicorns.json повреждены, поэтому флаги живут здесь, а не в данных вики.
 * Поле blocks_instants_against_owner намеренно НЕ заполнено: карта, дающая такое
 * свойство, ещё не названа Даниилом. Угадывать имя запрещено.
 */

export interface CanReactFlags {
  cannot_be_neighed?: boolean;
  blocks_neigh_for_others?: boolean;
  blocks_instants_against_owner?: boolean;
  blocks_neigh_against_owner?: boolean;
}

/** Ключ — имя карты в нижнем регистре, ровно как в базе карт. */
export const CAN_REACT_FLAGS: Record<string, CanReactFlags> = {
  'super neigh': { cannot_be_neighed: true },
  'super neigh (c&c)': { cannot_be_neighed: true },
  'neigh means neigh': { cannot_be_neighed: true },
  'yay': { blocks_neigh_against_owner: true },
};

/**
 * Накладывает флаги на карту по её имени. Поле b указано, чтобы не плодить any.
 * Возвращает тот же объект: вызывающая сторона заполняет state.cards на месте.
 */
export function applyCanReactFlags<T extends Record<string, any>>(card: T): T {
  if (!card || typeof card !== 'object') return card;
  // Каталог catalog.v2.json: у 161 карты name русское, английское имя в name_en.
  // Смотрим оба поля, иначе флаги cannot_be_neighed / blocks_neigh_for_others теряются молча.
  let flags = canReactFlagsForCardName(card.name);
  if (!hasAnyFlag(flags)) flags = canReactFlagsForCardName((card as any).name_en);
  for (const key of ['cannot_be_neighed', 'blocks_neigh_for_others', 'blocks_instants_against_owner', 'blocks_neigh_against_owner'] as Array<keyof CanReactFlags>) {
    if (card.static_properties?.[key] === true) (card as any)[key] = true;
  }
  for (const key of Object.keys(flags) as Array<keyof CanReactFlags>) {
    if (flags[key] === true) (card as any)[key] = true;
  }
  return card;
}

/**
 * Накладывает флаги на весь словарь карт (state.cards) и возвращает его же.
 * Одна строка на месте сборки словаря — единственная точка, где карты попадают в игру.
 */
export function applyCanReactFlagsToDict<T extends Record<string, any>>(dict: T): T {
  if (!dict || typeof dict !== 'object') return dict;
  for (const id of Object.keys(dict)) applyCanReactFlags(dict[id]);
  return dict;
}

/** Флаги по имени карты. Неизвестная карта — пустой объект, поведение не меняется. */
export function canReactFlagsForCardName(name: string | undefined | null): CanReactFlags {
  const key = String(name || '').trim().toLowerCase();
  return CAN_REACT_FLAGS[key] || {};
}

/** Есть ли в наборе хотя бы один включённый флаг. */
function hasAnyFlag(flags: CanReactFlags | undefined | null): boolean {
  if (!flags) return false;
  return Object.keys(flags).some((k) => (flags as any)[k] === true);
}
