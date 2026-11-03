import React, { useEffect, useState } from 'react';
import { Container, Typography, Box, Button, TextField, Paper, Stack, MenuItem, Divider, IconButton, Switch, FormControlLabel, Dialog, DialogTitle, DialogContent, DialogActions, Pagination, InputAdornment } from '@mui/material';
import PetsIcon from '@mui/icons-material/Pets';
import ChildCareIcon from '@mui/icons-material/ChildCare';
import BoltIcon from '@mui/icons-material/Bolt';
import StarsIcon from '@mui/icons-material/Stars';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SearchIcon from '@mui/icons-material/Search';
import UpgradeIcon from '@mui/icons-material/Upgrade';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import FlashOnIcon from '@mui/icons-material/FlashOn';
import type { Card, CardCategory, Action, Effect, Trigger, TargetSelector } from '../../../shared/src/types';
import { api } from '../api';
import CardTemplate from '../components/CardTemplate';
import { AdminShell } from '../components/admin/AdminShell';
import { CARD_TYPE_LABELS, cardTypeColor } from '../constants/cardTypeColors';

// Legacy effect shape used by MVP UI; server route will normalize to new DSL
type LegacyEffect = {
  type: 'add' | 'destroy' | 'discard' | 'return' | 'swap' | 'steal' | 'give' | 'search' | 'prevent' | 'ignore' | 'cancel';
  trigger?: 'immediate' | 'on_play' | 'on_discard' | 'on_destroy' | 'on_turn_start' | 'on_turn_end' | 'while_in_stable' | 'when_other_plays' | 'after_resolve' | 'on_enter_stable' | 'on_sacrifice';
  target?: 'self' | 'opponent' | 'any' | 'all' | 'from_stable' | 'all_players';
  source?: 'hand' | 'deck' | 'discard' | 'stable' | 'any';
  destination?: 'hand' | 'deck' | 'discard' | 'stable' | 'any';
  card_type?: 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'any';
  quantity_affected?: number;
  affects?: 'self' | 'all' | 'others'; // for discard
  additional_data?: any;
};

export default function Admin() {
  const [name, setName] = useState('');
  const [type, setType] = useState<Card['type']>('unicorn');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [effects, setEffects] = useState<LegacyEffect[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  // Admin flags
  const [active, setActive] = useState<boolean>(true);
  const [deckCount, setDeckCount] = useState<number>(1);

  // Фильтры/поиск/сортировка/пагинация для списка карт
  const [q, setQ] = useState<string>('');
  const [filterType, setFilterType] = useState<'any' | CardCategory>('any');
  const [filterActive, setFilterActive] = useState<'any' | 'true' | 'false'>('any');
  const [sort, setSort] = useState<'name_asc' | 'name_desc' | 'type_asc' | 'type_desc'>('name_asc');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [total, setTotal] = useState<number>(0);

  // Загрузка списка карт (общая функция)
  const loadCards = async () => {
    try {
      const params: any = {
        limit: pageSize,
        offset: (page - 1) * pageSize,
      };
      if (q.trim()) params.q = q.trim();
      if (filterType !== 'any') params.type = filterType;
      if (filterActive !== 'any') params.active = filterActive === 'true';
      if (sort) {
        const sortMap: Record<string, string> = {
          name_asc: 'name',
          name_desc: '-name',
          type_asc: 'type',
          type_desc: '-type',
        };
        params.sort = sortMap[sort] || 'name';
      }

      const res = await api.get<Card[]>('/cards', { params });
      setCards(res.data);
      let headerTotal = Number((res as any).headers?.['x-total-count'] ?? (res as any).headers?.['X-Total-Count']);
      if (isNaN(headerTotal) || headerTotal < 0) {
        try {
          const cntParams: any = {};
          if (q.trim()) cntParams.q = q.trim();
          if (filterType !== 'any') cntParams.type = filterType;
          if (filterActive !== 'any') cntParams.active = filterActive === 'true';
          const cnt = await api.get<{ total: number }>('/cards/count', { params: cntParams });
          headerTotal = Number(cnt.data?.total ?? 0);
        } catch {}
      }
      setTotal(!isNaN(headerTotal) && headerTotal >= 0 ? headerTotal : res.data.length);
    } catch (e) {
      console.error('Failed to load cards', e);
    }
  };

  // Загружаем карты при монтировании и при изменении фильтров/пагинации (debounce для поиска)
  useEffect(() => {
    const t = setTimeout(() => {
      // при изменении фильтров сбрасывать на первую страницу
      // но если менялась только страница/размер/сорт, используем текущее значение
      loadCards();
    }, 300);
    return () => clearTimeout(t);
  }, [q, filterType, filterActive, page, pageSize, sort]);

  // Edit modal state
  const [editOpen, setEditOpen] = useState(false);
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [eName, setEName] = useState('');
  const [eType, setEType] = useState<Card['type']>('unicorn');
  const [eDescription, setEDescription] = useState('');
  const [eImageUrl, setEImageUrl] = useState('');
  const [eActive, setEActive] = useState<boolean>(true);
  const [eDeckCount, setEDeckCount] = useState<number>(1);
  // Effects editing (advanced JSON)
  const [eEffectsJson, setEEffectsJson] = useState<string>('[]');
  const [eEffectsError, setEEffectsError] = useState<string>('');

  // Modal visual DSL editor states (independent от формы создания)
  const [meVisualMode, setMeVisualMode] = useState<boolean>(false);
  const [meDslEffects, setMeDslEffects] = useState<Effect[]>([]);
  const [meCurrentGroupTrigger, setMeCurrentGroupTrigger] = useState<Trigger>('immediate');
  const [meCurrentGroupActions, setMeCurrentGroupActions] = useState<Action[]>([]);
  const [meActKind, setMeActKind] = useState<Action['kind']>('add');
  const [meActOptional, setMeActOptional] = useState<boolean>(false);
  const [meActRequirePrev, setMeActRequirePrev] = useState<boolean>(false);
  const [meActQuantity, setMeActQuantity] = useState<number>(1);
  const [meActSrcZone, setMeActSrcZone] = useState<'hand' | 'deck' | 'discard' | 'stable'>('deck');
  const [meActDstZone, setMeActDstZone] = useState<'hand' | 'deck' | 'discard' | 'stable'>('hand');
  const [meActFromZone, setMeActFromZone] = useState<'hand' | 'deck' | 'discard' | 'stable'>('hand');
  const [meActToZone, setMeActToZone] = useState<'hand' | 'deck' | 'discard' | 'stable'>('discard');
  const [meActScope, setMeActScope] = useState<'self' | 'opponent' | 'any_player' | 'all_players'>('self');
  const [meActAllowSelf, setMeActAllowSelf] = useState<boolean>(true);
  const [meActGroupFilter, setMeActGroupFilter] = useState<'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic'>('any');

  const meBuildSelector = (zone: 'hand' | 'deck' | 'discard' | 'stable', scope: 'self' | 'opponent' | 'any_player' | 'all_players', qty?: number): TargetSelector => ({
    scope,
    zone,
    ...(meActGroupFilter !== 'any' ? { filters: { card_group: meActGroupFilter as any } } : {}),
    ...(qty ? { quantity: { mode: 'exact', value: qty } } : {}),
    ...(scope === 'any_player' || scope === 'all_players' ? { allow_self: meActAllowSelf } : {}),
  });

  const meAddActionToCurrentGroup = () => {
    const qty = Math.max(1, Number(meActQuantity) || 1);
    let action: Action | null = null;
    if (meActKind === 'add') {
      action = { kind: 'add', source: meActSrcZone, destination: meActDstZone, quantity: { mode: 'exact', value: qty }, optional: meActOptional, requires_success_of_previous: meActRequirePrev } as any;
    } else if (meActKind === 'move' || meActKind === 'transfer' || meActKind === 'steal' || meActKind === 'give' || meActKind === 'return') {
      action = { kind: meActKind as any, from: meBuildSelector(meActFromZone, meActScope, qty), to: { scope: 'self', zone: meActToZone }, optional: meActOptional, requires_success_of_previous: meActRequirePrev } as any;
    } else if (meActKind === 'destroy' || meActKind === 'sacrifice' || meActKind === 'discard') {
      const zone = meActKind === 'discard' ? 'hand' : 'stable';
      action = { kind: meActKind as any, targets: meBuildSelector(zone, meActScope, qty), optional: meActOptional, requires_success_of_previous: meActRequirePrev } as any;
    } else if (meActKind === 'search' || meActKind === 'reveal') {
      action = { kind: meActKind as any, targets: meBuildSelector('deck', 'self', qty), optional: meActOptional, requires_success_of_previous: meActRequirePrev } as any;
    } else if (meActKind === 'shuffle_deck') {
      action = { kind: 'shuffle_deck', targets: { scope: 'self', zone: 'deck' }, optional: meActOptional, requires_success_of_previous: meActRequirePrev } as any;
    } else if (meActKind === 'swap') {
      action = { kind: 'swap', a: { scope: 'self', zone: 'stable', quantity: { mode: 'exact', value: 1 } } as any, b: { scope: 'opponent', zone: 'stable', quantity: { mode: 'exact', value: 1 } } as any } as any;
    }
    if (action) setMeCurrentGroupActions(prev => [...prev, action!]);
  };


  const meResetCurrentGroup = () => {
    setMeCurrentGroupTrigger('immediate');
    setMeCurrentGroupActions([]);
    setMeActKind('add');
    setMeActOptional(false);
    setMeActRequirePrev(false);
    setMeActQuantity(1);
    setMeActSrcZone('deck');
    setMeActDstZone('hand');
    setMeActFromZone('hand');
    setMeActToZone('discard');
    setMeActScope('self');
    setMeActAllowSelf(true);
    setMeActGroupFilter('any');
  };

  // DSL Effect Groups (multi-action chains)
  const [dslEffects, setDslEffects] = useState<Effect[]>([]);
  const [currentGroupTrigger, setCurrentGroupTrigger] = useState<Trigger>('immediate');
  const [currentGroupActions, setCurrentGroupActions] = useState<Action[]>([]);

  // Simple action builder inputs (context-sensitive)
  const [actKind, setActKind] = useState<Action['kind']>('add');
  const [actOptional, setActOptional] = useState<boolean>(false);
  const [actRequirePrev, setActRequirePrev] = useState<boolean>(false);
  const [actQuantity, setActQuantity] = useState<number>(1);
  const [actSrcZone, setActSrcZone] = useState<'hand' | 'deck' | 'discard' | 'stable'>('deck');
  const [actDstZone, setActDstZone] = useState<'hand' | 'deck' | 'discard' | 'stable'>('hand');
  const [actFromZone, setActFromZone] = useState<'hand' | 'deck' | 'discard' | 'stable'>('hand');
  const [actToZone, setActToZone] = useState<'hand' | 'deck' | 'discard' | 'stable'>('discard');
  const [actScope, setActScope] = useState<'self' | 'opponent' | 'any_player' | 'all_players'>('self');
  const [actAllowSelf, setActAllowSelf] = useState<boolean>(true);
  const [actGroupFilter, setActGroupFilter] = useState<'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic'>('any');

  // Требования к розыгрышу: набор стоимостей пожертвовать карты из своего стойла
  type SacrificeCost = { qty: number; group: 'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic' };
  const [costSacrificeEnabled, setCostSacrificeEnabled] = useState<boolean>(false);
  const [sacrificeCosts, setSacrificeCosts] = useState<SacrificeCost[]>([{ qty: 1, group: 'any' }]);

  // Требования к розыгрышу: сбросить из руки
  type DiscardCost = { qty: number; group: 'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic' };
  const [costDiscardEnabled, setCostDiscardEnabled] = useState<boolean>(false);
  const [discardCostsReq, setDiscardCostsReq] = useState<DiscardCost[]>([{ qty: 1, group: 'any' }]);

  // Визуальный редактор (создание)
  const [visualMode, setVisualMode] = useState<boolean>(false);

  // Effect builder state
  const [drawQty, setDrawQty] = useState<number>(1);
  const [destroyQty, setDestroyQty] = useState<number>(1);
  const [destroyScope, setDestroyScope] = useState<'self' | 'opponent' | 'any'>('any');
  const [destroyCardGroup, setDestroyCardGroup] = useState<'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic'>('any');

  // Additional builders
  const [discardQty, setDiscardQty] = useState<number>(1);
  const [discardAffects, setDiscardAffects] = useState<'self' | 'all' | 'others'>('self');
  const [returnQty, setReturnQty] = useState<number>(1);
  const [returnScope, setReturnScope] = useState<'self' | 'opponent' | 'any'>('any');
  const [returnDest, setReturnDest] = useState<'hand' | 'deck'>('hand');
  const [returnCardGroup, setReturnCardGroup] = useState<'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic'>('any');
  const [transferQty, setTransferQty] = useState<number>(1);
  const [transferCardGroup, setTransferCardGroup] = useState<'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic'>('any');
  const [swapCardGroup, setSwapCardGroup] = useState<'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic'>('any');
  // From discard to hand
  const [fromDiscardQty, setFromDiscardQty] = useState<number>(1);
  const [fromDiscardGroup, setFromDiscardGroup] = useState<'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic'>('any');
  // Search deck
  const [searchQty, setSearchQty] = useState<number>(1);
  const [searchGroup, setSearchGroup] = useState<'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic'>('unicorn');

  // Trigger selector for newly added effects (multi-select)
  const ALL_TRIGGERS: Exclude<LegacyEffect['trigger'], undefined>[] = [
    'immediate',
    'on_play',
    'on_enter_stable',
    'on_turn_start',
    'on_turn_end',
    'while_in_stable',
    'when_other_plays',
    'on_discard',
    'on_destroy',
    'on_sacrifice',
    'after_resolve',
  ];
  const [selectedTriggers, setSelectedTriggers] = useState<Exclude<LegacyEffect['trigger'], undefined>[]>(['immediate']);
  const TRIGGER_LABELS: Record<Trigger, string> = {
    immediate: 'Сразу',
    on_play: 'При розыгрыше',
    on_enter_stable: 'При входе в стойло',
    on_turn_start: 'В начале хода',
    on_turn_end: 'В конце хода',
    while_in_stable: 'Пока в стойле',
    when_other_plays: 'Когда другой разыгрывает',
    on_discard: 'При сбросе',
    on_destroy: 'При уничтожении',
    on_sacrifice: 'При пожертвовании',
    after_resolve: 'После разрешения',
    when_other_unicorn_would_be_sacrificed_or_returned: 'Когда чужого единорога жертвуют или возвращают',
    when_other_brings_baby_from_nursery: 'Когда другой забирает детёныша из Яслей',
  };
  // Русские метки для визуального редактора
  const ACTION_LABELS: Record<Action['kind'], string> = {
    add: 'Добавить/Выложить',
    move: 'Переместить',
    transfer: 'Передать',
    return: 'Вернуть',
    steal: 'Украсть',
    give: 'Подарить',
    discard: 'Сбросить',
    destroy: 'Уничтожить',
    sacrifice: 'Пожертвовать',
    search: 'Найти',
    reveal: 'Показать',
    shuffle_deck: 'Перетасовать колоду',
    swap: 'Обменять',
    reorder_top: 'Переупорядочить верх колоды',
    protect: 'Защитить',
    grant_immunity: 'Даровать иммунитет',
    prevent: 'Предотвратить',
    ignore: 'Игнорировать',
    cancel: 'Отменить',
    skip_phase: 'Пропустить фазу',
    extra_action: 'Доп. действие',
    limit_actions: 'Ограничить действия',
    modify_win_condition: 'Изменить условие победы',
    set_flag: 'Установить флаг',
  } as const;

  const ZONE_LABELS: Record<'hand' | 'deck' | 'discard' | 'stable' | 'field' | 'nursery' | 'any', string> = {
    hand: 'Рука',
    deck: 'Колода',
    stable: 'Стойло',
    field: 'Поле',
    nursery: 'Ясли',
    discard: 'Сброс',
    any: 'Любая зона',
  } as const;

  const SCOPE_LABELS: Record<'self' | 'opponent' | 'any_player' | 'all_players', string> = {
    self: 'Вы',
    opponent: 'Соперник',
    any_player: 'Любой игрок',
    all_players: 'Все игроки',
  } as const;

  const GROUP_LABELS: Record<'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic', string> = {
    unicorn: 'Единорог',
    upgrade: 'Улучшение',
    downgrade: 'Ухудшение',
    instant: 'Мгновенная',
    // non_unicorn: удалён из игры
    magic: 'Магия',
    any: 'Любая',
  } as const;

  // Build a TargetSelector from current inputs
  const buildSelector = (zone: 'hand' | 'deck' | 'discard' | 'stable', scope: 'self' | 'opponent' | 'any_player' | 'all_players', qty?: number): TargetSelector => ({
    scope,
    zone,
    ...(actGroupFilter !== 'any' ? { filters: { card_group: actGroupFilter as any } } : {}),
    ...(qty ? { quantity: { mode: 'exact', value: qty } } : {}),
    ...(scope === 'any_player' || scope === 'all_players' ? { allow_self: actAllowSelf } : {}),
  });

  // Add an action row into currentGroupActions based on actKind and inputs
  const addActionToCurrentGroup = () => {
    const qty = Math.max(1, Number(actQuantity) || 1);
    let action: Action | null = null;
    if (actKind === 'add') {
      action = {
        kind: 'add',
        source: actSrcZone,
        destination: actDstZone,
        quantity: { mode: 'exact', value: qty },
        optional: actOptional,
        requires_success_of_previous: actRequirePrev,
      } as Action;
    } else if (actKind === 'move' || actKind === 'transfer' || actKind === 'steal' || actKind === 'give' || actKind === 'return') {
      action = {
        from: buildSelector(actFromZone, actScope, qty),
        to: { scope: 'self', zone: actToZone },
      } as Action;
    } else if (actKind === 'destroy' || actKind === 'sacrifice' || actKind === 'discard') {
      // zone defaults: destroy/sacrifice -> stable, discard -> hand
      const zone = actKind === 'discard' ? 'hand' : 'stable';
      action = {
        targets: buildSelector(zone, actScope, qty),
      } as Action;
    } else if (actKind === 'search' || actKind === 'reveal') {
      action = {
      } as Action;
    } else if (actKind === 'shuffle_deck') {
      action = {
      } as Action;
    } else if (actKind === 'swap') {
      const filters = actGroupFilter !== 'any' ? { card_group: actGroupFilter as any } : undefined;
      action = {
        a: { scope: 'self', zone: 'stable', ...(filters ? { filters } : {}), quantity: { mode: 'exact', value: 1 } } as any,
        b: { scope: 'opponent', zone: 'stable', ...(filters ? { filters } : {}), quantity: { mode: 'exact', value: 1 } } as any,
      } as any;
    }
    if (action) setCurrentGroupActions(prev => [...prev, action!]);
  };

  const resetCurrentGroup = () => {
    setCurrentGroupTrigger('immediate');
    setCurrentGroupActions([]);
    setActKind('add');
    setActOptional(false);
    setActRequirePrev(false);
    setActQuantity(1);
    setActSrcZone('deck');
    setActDstZone('hand');
    setActFromZone('hand');
    setActToZone('discard');
    setActScope('self');
    setActAllowSelf(true);
    setActGroupFilter('any');
  };

  // Description controls
  const [description, setDescription] = useState('');
  const [autoDesc, setAutoDesc] = useState(true);

  // Импорт с wiki
  const [wikiUrl, setWikiUrl] = useState<string>('');
  const [wikiLoading, setWikiLoading] = useState<boolean>(false);
  const [wikiError, setWikiError] = useState<string>('');

  const handleImportFromWiki = async () => {
    const url = wikiUrl.trim();
    if (!url) return;
    setWikiError('');
    setWikiLoading(true);
    try {
      const res = await api.post<{ name: string; type: Card['type']; description: string; image: string; effects: any[]; source: string }>(
        '/import/wiki',
        { url }
      );
      const data = res.data as any;
      if (data?.name) setName(data.name);
      if (data?.type) setType(data.type);
      if (typeof data?.description === 'string') setDescription(data.description);
      if (typeof data?.image === 'string') setImageUrl(data.image);
      if (Array.isArray(data?.effects) && data.effects.length) {
        // Сервер уже возвращает DSL-эффекты
        setDslEffects(data.effects as any);
      }
      // Применяем требования к розыгрышу (стоимость)
      const costs = (data?.play_requirements?.costs ?? []) as any[];
      const sac = costs.find(c => c?.kind === 'sacrifice');
      if (sac) {
        setCostSacrificeEnabled(true);
        const qty = Math.max(1, Number(sac?.targets?.quantity?.value) || 1);
        const group = (sac?.targets?.filters?.card_group as any) || 'any';
        setSacrificeCosts([{ qty, group }]);
      }
      const disc = costs.find(c => c?.kind === 'discard');
      if (disc) {
        setCostDiscardEnabled(true);
        const dqty = Math.max(1, Number(disc?.targets?.quantity?.value) || 1);
        const dgroup = (disc?.targets?.filters?.card_group as any) || 'any';
        setDiscardCostsReq([{ qty: dqty, group: dgroup }]);
      }
    } catch (e: any) {
      setWikiError(e?.response?.data?.message || e?.message || 'Ошибка импорта');
    } finally {
      setWikiLoading(false);
    }
  };

  // Цвета берём из общего справочника типов, чтобы админка не расходилась с картами стола
  const typeMeta: Record<CardCategory, { label: string; color: string; icon: React.ReactNode }> = {
    baby_unicorn: { label: CARD_TYPE_LABELS.baby_unicorn, color: cardTypeColor('baby_unicorn'), icon: <ChildCareIcon /> as any },
    basic_unicorn: { label: CARD_TYPE_LABELS.basic_unicorn, color: cardTypeColor('basic_unicorn'), icon: <PetsIcon /> },
    magical_unicorn: { label: CARD_TYPE_LABELS.magical_unicorn, color: cardTypeColor('magical_unicorn'), icon: <StarsIcon /> },
    ultimate_unicorn: { label: CARD_TYPE_LABELS.ultimate_unicorn, color: cardTypeColor('ultimate_unicorn'), icon: <AutoAwesomeIcon /> },
    magic: { label: CARD_TYPE_LABELS.magic, color: cardTypeColor('magic'), icon: <FlashOnIcon /> },
    instant: { label: CARD_TYPE_LABELS.instant, color: cardTypeColor('instant'), icon: <BoltIcon /> },
    upgrade: { label: CARD_TYPE_LABELS.upgrade, color: cardTypeColor('upgrade'), icon: <UpgradeIcon /> },
    downgrade: { label: CARD_TYPE_LABELS.downgrade, color: cardTypeColor('downgrade'), icon: <ArrowDownwardIcon /> },
    unicorn: { label: CARD_TYPE_LABELS.unicorn, color: cardTypeColor('unicorn'), icon: <PetsIcon /> },
    // non_unicorn: удалён из игры
  } as any;

  const GROUP_LABELS_RU: Record<'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'magic', string> = {
    any: 'любую карту',
    unicorn: 'карту типа **Единорог**',
    upgrade: 'карту типа **Улучшение**',
    downgrade: 'карту типа **Ухудшение**',
    instant: 'карту типа **Мгновенная**',
    magic: 'карту типа **Магия**',
  };

  function effectToText(e: LegacyEffect): string {
    const prefixByTrigger: Record<string, string> = {
      immediate: '',
      on_play: '**При розыгрыше**: ',
      on_enter_stable: '**При входе в стойло**: ',
      on_turn_start: '**В начале хода**: ',
      on_turn_end: '**В конце хода**: ',
      while_in_stable: '**Пока в стойле**: ',
      when_other_plays: '**Когда другой игрок разыгрывает карту**: ',
      on_discard: '**При сбросе**: ',
      on_destroy: '**При уничтожении**: ',
      on_sacrifice: '**При пожертвовании**: ',
      after_resolve: '**После разрешения**: ',
      when_other_unicorn_would_be_sacrificed_or_returned: '**Когда единорога другого игрока жертвуют или возвращают в руку**: ',
      when_other_brings_baby_from_nursery: '**Когда другой игрок забирает детёныша единорога из Яслей**: ',
    };
    if (e.type === 'add' && e.source === 'deck' && e.destination === 'hand') {
      const n = e.quantity_affected || 1;
      return `${prefixByTrigger[e.trigger || 'immediate'] || ''}**Возьмите** ${n} карт${n > 1 ? 'ы' : 'у'} из колоды в **руку**.`;
    }
    if (e.type === 'destroy') {
      const who = e.target === 'self' ? 'у себя' : e.target === 'opponent' ? 'у соперника' : 'у любого игрока';
      const what = e.card_type && e.card_type !== 'any' ? GROUP_LABELS_RU[e.card_type] : '**карту**';
      const n = e.quantity_affected || 1;
      return `${prefixByTrigger[e.trigger || 'immediate'] || ''}**Уничтожьте** ${n} ${what}${n > 1 ? 'ы' : ''} ${who} в **стойле**.`;
    }
    if (e.type === 'discard') {
      const n = e.quantity_affected || 1;
      let who = 'вашей';
      if (e.affects === 'all') who = 'рук всех игроков';
      if (e.affects === 'others') who = 'рук всех других игроков';
      const base = e.affects && e.affects !== 'self' ? `**Сбросьте** ${n} карт${n > 1 ? 'ы' : 'у'} из ${who}.` : `**Сбросьте** ${n} карт${n > 1 ? 'ы' : 'у'} из вашей **руки**.`;
      return `${prefixByTrigger[e.trigger || 'immediate'] || ''}${base}`;
    }
    if (e.type === 'return') {
      const n = e.quantity_affected || 1;
      const who = e.target === 'opponent' ? 'у соперника' : e.target === 'self' ? 'у себя' : 'в любом стойле';
      const what = e.card_type && e.card_type !== 'any' ? GROUP_LABELS_RU[e.card_type] : '**карту**';
      const dest = e.destination === 'deck' ? 'в колоду' : 'в руку';
      return `${prefixByTrigger[e.trigger || 'immediate'] || ''}**Верните** ${n} ${what}${n > 1 ? 'ы' : ''} ${who} **${dest}**.`;
    }
    if (e.type === 'steal') {
      const n = e.quantity_affected || 1;
      const what = e.card_type && e.card_type !== 'any' ? GROUP_LABELS_RU[e.card_type] : '**карту**';
      return `${prefixByTrigger[e.trigger || 'immediate'] || ''}**Украдите** ${n} ${what}${n > 1 ? 'ы' : ''} из **стойла соперника** в своё **стойло**.`;
    }
    if (e.type === 'give') {
      const n = e.quantity_affected || 1;
      const what = e.card_type && e.card_type !== 'any' ? GROUP_LABELS_RU[e.card_type] : '**карту**';
      return `${prefixByTrigger[e.trigger || 'immediate'] || ''}**Передайте** ${n} ${what}${n > 1 ? 'ы' : ''} из вашего **стойла** сопернику.`;
    }
    if (e.type === 'swap') {
      const what = e.card_type && e.card_type !== 'any' ? GROUP_LABELS_RU[e.card_type] : '**карту**';
      return `${prefixByTrigger[e.trigger || 'immediate'] || ''}**Обменяйтесь** 1 ${what} между **стойлом соперника** и вашим.`;
    }
    if (e.type === 'search') {
      const n = e.quantity_affected || 1;
      const what = e.card_type && e.card_type !== 'any' ? GROUP_LABELS_RU[e.card_type] : '**карту**';
      return `${prefixByTrigger[e.trigger || 'immediate'] || ''}**Найдите** ${n} ${what}${n > 1 ? 'ы' : ''} в **колоде**.`;
    }
    return `${prefixByTrigger[e.trigger || 'immediate'] || ''}**${e.type}**`;
  }

  // Client-side legacy->DSL normalization for createCard
  function legacyToDslEffects(legacy: LegacyEffect[]): Effect[] {
    const out: Effect[] = [];
    for (const e of legacy) {
      const trigger = (e.trigger as Trigger) || 'immediate';
      if (e.type === 'add') {
        const qty = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : undefined;
        const src = (e.source || 'deck') as any;
        const dst = (e.destination || 'hand') as any;
        if (src === 'deck' && dst === 'hand') {
          out.push({ trigger, actions: [{ kind: 'add', source: src, destination: dst, quantity: qty } as any] });
        } else {
          const filters: any = {};
          if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
          out.push({
            trigger,
            actions: [
              {
                kind: 'move',
                from: { scope: 'self', zone: src, filters: Object.keys(filters).length ? filters : undefined, quantity: qty },
                to: { scope: 'self', zone: dst },
              } as any,
            ],
          });
        }
        continue;
      }
      if (e.type === 'destroy') {
        const filters: any = {};
        if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
        const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : undefined;
        if (e.target === 'self') {
          out.push({ trigger, actions: [{ kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', filters: Object.keys(filters).length ? filters : undefined, quantity } as any }] });
        } else {
          out.push({
            trigger,
            actions: [
              {
                kind: 'destroy',
                targets: {
                  scope: e.target === 'opponent' ? 'opponent' : 'any_player',
                  zone: 'stable',
                  filters: Object.keys(filters).length ? filters : undefined,
                  ...(e.target !== 'opponent' ? { allow_self: false } : {}),
                  quantity,
                },
              } as any,
            ],
          });
        }
        continue;
      }
      if (e.type === 'discard') {
        const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : { mode: 'exact', value: 1 };
        const affects = (e.affects as 'self' | 'all' | 'others') || 'self';
        const scope = affects === 'all' ? 'all_players' : affects === 'others' ? 'all_players' : 'self';
        const allow_self = affects === 'others' ? false : true;
        out.push({ trigger, actions: [{ kind: 'move', from: { scope, zone: 'hand', quantity, ...(scope !== 'self' ? { allow_self } : {}) } as any, to: { scope: 'self', zone: 'discard' } as any }] });
        continue;
      }
      if (e.type === 'return') {
        const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : { mode: 'exact', value: 1 };
        const filters: any = {};
        if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
        out.push({
          trigger,
          actions: [
            {
              kind: 'move',
              from: { scope: e.target === 'opponent' ? 'opponent' : e.target === 'self' ? 'self' : 'any_player', zone: 'stable', filters: Object.keys(filters).length ? filters : undefined, quantity } as any,
              to: { scope: 'self', zone: e.destination === 'deck' ? 'deck' : 'hand' } as any,
            } as any,
          ],
        });
        continue;
      }
      if (e.type === 'steal') {
        const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : { mode: 'exact', value: 1 };
        const filters: any = {};
        if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
        out.push({ trigger, actions: [{ kind: 'transfer', from: { scope: 'opponent', zone: 'stable', filters: Object.keys(filters).length ? filters : undefined, quantity } as any, to: { scope: 'self', zone: 'stable' } as any }] });
        continue;
      }
      if (e.type === 'give') {
        const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : { mode: 'exact', value: 1 };
        const filters: any = {};
        if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
        out.push({ trigger, actions: [{ kind: 'transfer', from: { scope: 'self', zone: 'stable', filters: Object.keys(filters).length ? filters : undefined, quantity } as any, to: { scope: 'opponent', zone: 'stable' } as any }] });
        continue;
      }
      if (e.type === 'swap') {
        const filters: any = {};
        if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
        out.push({ trigger, actions: [{ kind: 'swap', a: { scope: 'self', zone: 'stable', filters: Object.keys(filters).length ? filters : undefined, quantity: { mode: 'exact', value: 1 } } as any, b: { scope: 'opponent', zone: 'stable', filters: Object.keys(filters).length ? filters : undefined, quantity: { mode: 'exact', value: 1 } } as any }] });
        continue;
      }
      if (e.type === 'search') {
        const quantity = e.quantity_affected ? { mode: 'exact', value: e.quantity_affected } : { mode: 'exact', value: 1 };
        const filters: any = {};
        if (e.card_type && e.card_type !== 'any') filters.card_group = e.card_type;
        out.push({ trigger, actions: [{ kind: 'search', targets: { scope: 'self', zone: 'deck', filters: Object.keys(filters).length ? filters : undefined, quantity } as any }] });
        continue;
      }
      // fallback: ignore unknown
    }
    return out;
  }

  // Human-readable text for new DSL effects
  function dslEffectToText(ef: Effect): string {
    const prefixByTrigger: Record<Trigger, string> = {
      immediate: '',
      on_play: '**При розыгрыше**: ',
      on_enter_stable: '**При входе в стойло**: ',
      on_turn_start: '**В начале хода**: ',
      on_turn_end: '**В конце хода**: ',
      while_in_stable: '**Пока в стойле**: ',
      when_other_plays: '**Когда другой игрок разыгрывает карту**: ',
      on_discard: '**При сбросе**: ',
      on_destroy: '**При уничтожении**: ',
      on_sacrifice: '**При пожертвовании**: ',
      after_resolve: '**После разрешения**: ',
      when_other_unicorn_would_be_sacrificed_or_returned: '**Когда единорога другого игрока жертвуют или возвращают в руку**: ',
      when_other_brings_baby_from_nursery: '**Когда другой игрок забирает детёныша единорога из Яслей**: ',
    };
    const parts = ef.actions.map((a, idx) => {
      const then = idx > 0 ? 'затем ' : '';
      const opt = (a as any).optional ? 'можете ' : '';
      const fromSel = (a as any).from as any;
      const toSel = (a as any).to as any;
      const targets = (a as any).targets as any;
      const aSel = (a as any).a as any;
      const bSel = (a as any).b as any;
      const g = (sel?: any) => sel?.filters?.card_group as ('unicorn'|'upgrade'|'downgrade'|'instant'|'magic'|'any'|undefined);
      const qtyFrom = Math.max(1, Number(fromSel?.quantity?.value) || 1);
      const qtyTarg = Math.max(1, Number(targets?.quantity?.value) || 1);
      switch ((a as any).kind as any) {
        case 'add': {
          const src = (a as any).source as keyof typeof ZONE_LABELS;
          const dst = (a as any).destination as keyof typeof ZONE_LABELS;
          const n = Math.max(1, Number((a as any).quantity?.value) || 1);
          const what = n === 1 ? '1 карту' : `${n} карты`;
          return `${then}${opt}переместите ${what} из ${ZONE_LABELS[src]} в ${ZONE_LABELS[dst]}`;
        }
        case 'move':
        case 'transfer':
        case 'steal':
        case 'give':
        case 'return': {
          const group = g(fromSel);
          const what = `${qtyFrom === 1 ? '1' : qtyFrom} ${group && group !== 'any' ? GROUP_LABELS_RU[group] : 'карту'}`;
          const verb = (a as any).kind === 'return' ? 'верните' : (a as any).kind === 'give' ? 'передайте' : (a as any).kind === 'steal' ? 'украдите' : (a as any).kind === 'transfer' ? 'перенесите' : 'переместите';
          return `${then}${opt}${verb} ${what} из ${fromSel ? ZONE_LABELS[(fromSel.zone as keyof typeof ZONE_LABELS)] : 'зоны'} в ${toSel ? ZONE_LABELS[(toSel.zone as keyof typeof ZONE_LABELS)] : 'зону'}`;
        }
        case 'destroy': {
          const group = g(targets);
          const who = targets?.scope === 'opponent' ? 'в стойле соперника' : targets?.scope === 'self' ? 'в вашем стойле' : targets?.scope === 'all_players' ? 'во всех стойлах' : 'в любом стойле';
          const what = `${qtyTarg === 1 ? '1' : qtyTarg}${group && group !== 'any' ? ` ${GROUP_LABELS_RU[group]}` : ' карту'}`;
          return `${then}${opt}уничтожьте ${what} ${who}`;
        }
        case 'discard': {
          const group = g(targets);
          const who = targets?.scope === 'opponent' ? 'у соперника' : targets?.scope === 'self' ? 'у вас' : targets?.scope === 'all_players' ? 'у всех игроков' : 'у любого игрока';
          const what = `${qtyTarg === 1 ? '1' : qtyTarg}${group && group !== 'any' ? ` ${GROUP_LABELS_RU[group]}` : ' карту'}`;
          return `${then}${opt}сбросьте ${what} ${who}`;
        }
        case 'sacrifice': {
          const group = g(targets);
          const what = `${qtyTarg === 1 ? '1' : qtyTarg}${group && group !== 'any' ? ` ${GROUP_LABELS_RU[group]}` : ' карту'}`;
          return `${then}${opt}пожертвуйте ${what} в своём стойле`;
        }
        case 'search': {
          const group = g(targets);
          const what = group && group !== 'any' ? GROUP_LABELS_RU[group] : 'карту';
          return `${then}${opt}найдите ${qtyTarg} ${what} в колоде`;
        }
        case 'reveal': {
          const group = g(targets);
          const what = group && group !== 'any' ? GROUP_LABELS_RU[group] : 'карту';
          return `${then}${opt}покажите ${qtyTarg} ${what} из колоды`;
        }
        case 'shuffle_deck':
          return `${then}${opt}перемешайте колоду`;
        case 'swap': {
          const groupA = g(aSel);
          const what = groupA && groupA !== 'any' ? GROUP_LABELS_RU[groupA] : 'картой';
          return `${then}${opt}обменяйтесь 1 ${what} между стойлами`;
        }
        default:
          return `${then}${opt}${(a as any).kind}`;
      }
    });
    return `${prefixByTrigger[ef.trigger || 'immediate'] || ''}${parts.join('. ')}.`;
  }

  // Upload image handler for Admin page
  const handleUpload = async () => {
    if (!imageFile) return;
    const formData = new FormData();
    formData.append('image', imageFile);
    const res = await api.post<{ url: string }>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    setImageUrl(res.data.url);
  };

  const addDrawEffect = () => {
    const qty = Math.max(1, Number(drawQty) || 1);
    const toAdd = selectedTriggers.map(t => ({ type: 'add', source: 'deck', destination: 'hand', quantity_affected: qty, trigger: t } as LegacyEffect));
    setEffects(prev => [...prev, ...toAdd]);
  };

  const addDestroyStableEffect = () => {
    const qty = Math.max(1, Number(destroyQty) || 1);
    const toAdd = selectedTriggers.map(t => ({ type: 'destroy', target: destroyScope === 'opponent' ? 'opponent' : 'any', card_type: destroyCardGroup, quantity_affected: qty, trigger: t } as LegacyEffect));
    setEffects(prev => [...prev, ...toAdd]);
  };

  const addDiscardEffect = () => {
    const qty = Math.max(1, Number(discardQty) || 1);
    const toAdd = selectedTriggers.map(t => ({ type: 'discard', quantity_affected: qty, affects: discardAffects, trigger: t } as LegacyEffect));
    setEffects(prev => [...prev, ...toAdd]);
  };

  const addReturnEffect = () => {
    const qty = Math.max(1, Number(returnQty) || 1);
    const toAdd = selectedTriggers.map(t => ({ type: 'return', target: returnScope === 'self' ? 'self' : returnScope === 'opponent' ? 'opponent' : 'any', destination: returnDest, card_type: returnCardGroup, quantity_affected: qty, trigger: t } as LegacyEffect));
    setEffects(prev => [...prev, ...toAdd]);
  };

  const addStealEffect = () => {
    const qty = Math.max(1, Number(transferQty) || 1);
    const toAdd = selectedTriggers.map(t => ({ type: 'steal', card_type: transferCardGroup, quantity_affected: qty, trigger: t } as LegacyEffect));
    setEffects(prev => [...prev, ...toAdd]);
  };

  const addGiveEffect = () => {
    const qty = Math.max(1, Number(transferQty) || 1);
    const toAdd = selectedTriggers.map(t => ({ type: 'give', card_type: transferCardGroup, quantity_affected: qty, trigger: t } as LegacyEffect));
    setEffects(prev => [...prev, ...toAdd]);
  };

  const addSwapEffect = () => {
    const toAdd = selectedTriggers.map(t => ({ type: 'swap', card_type: swapCardGroup, trigger: t } as LegacyEffect));
    setEffects(prev => [...prev, ...toAdd]);
  };

  const addFromDiscardEffect = () => {
    const qty = Math.max(1, Number(fromDiscardQty) || 1);
    const toAdd = selectedTriggers.map(t => ({ type: 'add', source: 'discard', destination: 'hand', card_type: fromDiscardGroup, quantity_affected: qty, trigger: t } as LegacyEffect));
    setEffects(prev => [...prev, ...toAdd]);
  };

  const addSearchDeckEffect = () => {
    const qty = Math.max(1, Number(searchQty) || 1);
    const toAdd = selectedTriggers.map(t => ({ type: 'search', card_type: searchGroup, quantity_affected: qty, trigger: t } as LegacyEffect));
    setEffects(prev => [...prev, ...toAdd]);
  };

  // Sacrifice (destroy own stable card) builder
  const [sacrificeQty, setSacrificeQty] = useState<number>(1);
  const [sacrificeCardGroup, setSacrificeCardGroup] = useState<'any' | 'unicorn' | 'upgrade' | 'downgrade' | 'instant' | 'non_unicorn'>('any');
  const addSacrificeEffect = () => {
    const qty = Math.max(1, Number(sacrificeQty) || 1);
    const toAdd = selectedTriggers.map(t => ({ type: 'destroy', target: 'self', card_type: sacrificeCardGroup, quantity_affected: qty, trigger: t } as LegacyEffect));
    setEffects(prev => [...prev, ...toAdd]);
  };

  const createCard = async () => {
    const costs = [] as any[];
    if (costSacrificeEnabled) {
      for (const c of sacrificeCosts) {
        const qty = Math.max(1, Number(c.qty) || 1);
        const entry: any = {
          kind: 'sacrifice',
          targets: {
            scope: 'self',
            zone: 'stable',
            quantity: { mode: 'exact', value: qty },
          },
        };
        if (c.group && c.group !== 'any') {
          entry.targets.filters = { card_group: c.group };
        }
        costs.push(entry);
      }
    }

    if (costDiscardEnabled) {
      for (const c of discardCostsReq) {
        const qty = Math.max(1, Number(c.qty) || 1);
        const entry: any = {
          kind: 'discard',
          targets: {
            scope: 'self',
            zone: 'hand',
            quantity: { mode: 'exact', value: qty },
          },
        };
        if (c.group && c.group !== 'any') {
          entry.targets.filters = { card_group: c.group };
        }
        costs.push(entry);
      }
    }

    const body: any = {
      name,
      type,
      image: imageUrl,
      description: description,
      effects: (visualMode ? dslEffects : [...legacyToDslEffects(effects), ...dslEffects]) as any,
      active,
      deck_count: Math.max(0, Number(deckCount) || 0),
      ...(costs.length > 0
        ? {
            play_requirements: {
              costs,
            },
          }
        : {}),
    } as any;
    const res = await api.post<Card>('/cards', body);
    await loadCards();
    // reset
    setName('');
    setType('unicorn');
    setImageFile(null);
    setImageUrl('');
    setEffects([]);
    setDslEffects([]);
    // reset play requirements
    setCostSacrificeEnabled(false);
    setSacrificeCosts([{ qty: 1, group: 'any' }]);
    setCostDiscardEnabled(false);
    setDiscardCostsReq([{ qty: 1, group: 'any' }]);
    setActive(true);
    setDeckCount(1);
  };

  return (
    <AdminShell>
      <Container maxWidth="md" sx={{ py: 2 }}>
        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
          Конструктор карт
        </Typography>
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              label="Ссылка на Wiki"
              value={wikiUrl}
              onChange={e => setWikiUrl(e.target.value)}
              fullWidth
            />
            <Button variant="contained" disabled={wikiLoading || !wikiUrl.trim()} onClick={handleImportFromWiki}>
              {wikiLoading ? 'Импорт...' : 'Импорт из Wiki'}
            </Button>
          </Stack>
          {!!wikiError && (
            <Typography color="error" variant="body2">{wikiError}</Typography>
          )}
          <TextField label="Название" value={name} onChange={e => setName(e.target.value)} />
          <TextField select label="Тип" value={type} onChange={e => setType(e.target.value as CardCategory)}>
            {(
              [
                'baby_unicorn',
                'basic_unicorn',
                'magical_unicorn',
                'ultimate_unicorn',
                'magic',
                'instant',
                'upgrade',
                'downgrade',
                'unicorn',
                'non_unicorn',
              ] as CardCategory[]
            ).map(opt => (
              <MenuItem key={opt} value={opt}>
                {CARD_TYPE_LABELS[opt]}
              </MenuItem>
            ))}
          </TextField>

          <Box>
            <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files?.[0] || null)} />
            <Button onClick={handleUpload} disabled={!imageFile} sx={{ ml: 2 }} variant="outlined">
              Загрузить изображение
            </Button>
            {imageUrl && (
              <Box mt={1}>
                <img src={imageUrl.startsWith('http') ? imageUrl : `${new URL((api.defaults.baseURL as string) || '/', window.location.href).origin}${imageUrl}`} alt="preview" style={{ maxHeight: 120 }} />
              </Box>
            )}
          </Box>

          <Divider textAlign="left">Требования к розыгрышу</Divider>
          <Stack spacing={1}>
            <FormControlLabel
              control={<Switch checked={costSacrificeEnabled} onChange={(_, v) => setCostSacrificeEnabled(v)} />}
              label="Стоимость: пожертвовать из своего стойла"
            />
            {costSacrificeEnabled && (
              <Stack spacing={1}>
                {sacrificeCosts.map((c, idx) => (
                  <Stack key={idx} direction="row" spacing={2} alignItems="center">
                    <TextField
                      select
                      label="Тип карты"
                      size="small"
                      value={c.group}
                      onChange={e => {
                        const v = e.target.value as SacrificeCost['group'];
                        setSacrificeCosts(prev => prev.map((it, i) => (i === idx ? { ...it, group: v } : it)));
                      }}
                      sx={{ minWidth: 180 }}
                    >
                      <MenuItem value="any">Любая</MenuItem>
                      <MenuItem value="unicorn">Единорог</MenuItem>
                      <MenuItem value="upgrade">Улучшение</MenuItem>
                      <MenuItem value="downgrade">Ухудшение</MenuItem>
                      <MenuItem value="instant">Мгновенная</MenuItem>
                      <MenuItem value="non_unicorn">Не-единорог</MenuItem>
                    </TextField>
                    <TextField
                      type="number"
                      label="Кол-во"
                      size="small"
                      value={c.qty}
                      onChange={e => {
                        const v = Number(e.target.value);
                        setSacrificeCosts(prev => prev.map((it, i) => (i === idx ? { ...it, qty: v } : it)));
                      }}
                      inputProps={{ min: 1 }}
                      sx={{ width: 120 }}
                    />
                    <Button color="error" onClick={() => setSacrificeCosts(prev => prev.filter((_, i) => i !== idx))}>Удалить</Button>
                  </Stack>
                ))}

                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle2">Взять из сброса</Typography>
                  <TextField select label="Тип карты" size="small" value={fromDiscardGroup} onChange={e => setFromDiscardGroup(e.target.value as any)} sx={{ minWidth: 180 }}>
                    <MenuItem value="any">Любая</MenuItem>
                    <MenuItem value="unicorn">Единорог</MenuItem>
                    <MenuItem value="upgrade">Улучшение</MenuItem>
                    <MenuItem value="downgrade">Ухудшение</MenuItem>
                    <MenuItem value="instant">Мгновенная</MenuItem>
                    <MenuItem value="non_unicorn">Не-единорог</MenuItem>
                  </TextField>
                  <TextField
                    type="number"
                    label="Кол-во"
                    size="small"
                    value={fromDiscardQty}
                    onChange={e => setFromDiscardQty(Number(e.target.value))}
                    inputProps={{ min: 1 }}
                    sx={{ width: 120 }}
                  />
                  <Button variant="outlined" onClick={addFromDiscardEffect}>+ Добавить «из сброса»</Button>
                </Stack>

                <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
                  <Typography variant="subtitle2">Поиск в колоде</Typography>
                  <TextField select label="Тип карты" size="small" value={searchGroup} onChange={e => setSearchGroup(e.target.value as any)} sx={{ minWidth: 180 }}>
                    <MenuItem value="any">Любая</MenuItem>
                    <MenuItem value="unicorn">Единорог</MenuItem>
                    <MenuItem value="upgrade">Улучшение</MenuItem>
                    <MenuItem value="downgrade">Ухудшение</MenuItem>
                    <MenuItem value="instant">Мгновенная</MenuItem>
                    <MenuItem value="non_unicorn">Не-единорог</MenuItem>
                  </TextField>
                  <TextField
                    type="number"
                    label="Кол-во"
                    size="small"
                    value={searchQty}
                    onChange={e => setSearchQty(Number(e.target.value))}
                    inputProps={{ min: 1 }}
                    sx={{ width: 120 }}
                  />
                  <Button variant="outlined" onClick={addSearchDeckEffect}>+ Добавить «поиск в колоде»</Button>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" onClick={() => setSacrificeCosts(prev => [...prev, { qty: 1, group: 'any' }])}>+ Добавить требование</Button>
                  {sacrificeCosts.length === 0 && (
                    <Button onClick={() => setSacrificeCosts([{ qty: 1, group: 'any' }])}>Добавить первое</Button>
                  )}
                </Stack>
              </Stack>
            )}
          </Stack>

          <FormControlLabel
            control={<Switch checked={costDiscardEnabled} onChange={(_, v) => setCostDiscardEnabled(v)} />}
            label="Стоимость: сбросить из своей руки"
          />
          {costDiscardEnabled && (
            <Stack spacing={1}>
              {discardCostsReq.map((c, idx) => (
                <Stack key={`dc-${idx}`} direction="row" spacing={2} alignItems="center">
                  <TextField
                    select
                    label="Тип карты"
                    size="small"
                    value={c.group}
                    onChange={e => {
                      const v = e.target.value as DiscardCost['group'];
                      setDiscardCostsReq(prev => prev.map((it, i) => (i === idx ? { ...it, group: v } : it)));
                    }}
                    sx={{ minWidth: 180 }}
                  >
                    <MenuItem value="any">Любая</MenuItem>
                    <MenuItem value="unicorn">Единорог</MenuItem>
                    <MenuItem value="upgrade">Улучшение</MenuItem>
                    <MenuItem value="downgrade">Ухудшение</MenuItem>
                    <MenuItem value="instant">Мгновенная</MenuItem>
                    <MenuItem value="non_unicorn">Не-единорог</MenuItem>
                  </TextField>
                  <TextField
                    type="number"
                    label="Кол-во"
                    size="small"
                    value={c.qty}
                    onChange={e => {
                      const v = Number(e.target.value);
                      setDiscardCostsReq(prev => prev.map((it, i) => (i === idx ? { ...it, qty: v } : it)));
                    }}
                    inputProps={{ min: 1 }}
                    sx={{ width: 120 }}
                  />
                  <Button color="error" onClick={() => setDiscardCostsReq(prev => prev.filter((_, i) => i !== idx))}>Удалить</Button>
                </Stack>
              ))}

              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={() => setDiscardCostsReq(prev => [...prev, { qty: 1, group: 'any' }])}>+ Добавить требование</Button>
                {discardCostsReq.length === 0 && (
                  <Button onClick={() => setDiscardCostsReq([{ qty: 1, group: 'any' }])}>Добавить первое</Button>
                )}
              </Stack>
            </Stack>
          )}

          <Divider textAlign="left">Эффекты</Divider>
          <Typography variant="body2" color="text.secondary">
            Вы можете использовать визуальный редактор или быстрые пресеты ниже.
          </Typography>
          <FormControlLabel control={<Switch checked={visualMode} onChange={(_, v) => setVisualMode(v)} />} label="Визуальный редактор эффектов" />

          {visualMode && (
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <TextField select label="Триггер" value={currentGroupTrigger} onChange={e => setCurrentGroupTrigger(e.target.value as Trigger)} sx={{ minWidth: 220 }}>
                  {(['immediate','on_play','on_enter_stable','on_turn_start','on_turn_end','while_in_stable','when_other_plays','on_discard','on_destroy','on_sacrifice','after_resolve'] as Trigger[]).map(t => (
                    <MenuItem key={t} value={t}>{TRIGGER_LABELS[t]}</MenuItem>
                  ))}
                </TextField>
              </Stack>
              <Divider textAlign="left">Добавить действие</Divider>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <TextField select label="Действие" value={actKind} onChange={e => setActKind(e.target.value as any)} sx={{ minWidth: 200 }}>
                  {(['add','move','transfer','return','steal','give','discard','destroy','sacrifice','search','reveal','shuffle_deck','swap'] as Action['kind'][]).map(k => (
                    <MenuItem key={k as string} value={k as string}>{ACTION_LABELS[k]}</MenuItem>
                  ))}
                </TextField>
                <TextField type="number" label="Количество" value={actQuantity} onChange={e => setActQuantity(Number(e.target.value))} sx={{ width: 140 }} />
                <FormControlLabel control={<Switch checked={actOptional} onChange={(_, v) => setActOptional(v)} />} label="Опционально" />
                <FormControlLabel control={<Switch checked={actRequirePrev} onChange={(_, v) => setActRequirePrev(v)} />} label="После успеха" />
              </Stack>
              <Stack direction="row" spacing={2} flexWrap="wrap">
                <TextField select label="Источник" value={actSrcZone} onChange={e => setActSrcZone(e.target.value as any)} sx={{ width: 160 }}>
                  {(['hand','deck','discard','stable'] as const).map(z => (<MenuItem key={z} value={z}>{ZONE_LABELS[z]}</MenuItem>))}
                </TextField>
                <TextField select label="Назначение" value={actDstZone} onChange={e => setActDstZone(e.target.value as any)} sx={{ width: 160 }}>
                  {(['hand','deck','discard','stable'] as const).map(z => (<MenuItem key={z} value={z}>{ZONE_LABELS[z]}</MenuItem>))}
                </TextField>
                <TextField select label="Из зоны" value={actFromZone} onChange={e => setActFromZone(e.target.value as any)} sx={{ width: 160 }}>
                  {(['hand','deck','discard','stable'] as const).map(z => (<MenuItem key={z} value={z}>{ZONE_LABELS[z]}</MenuItem>))}
                </TextField>
                <TextField select label="В зону" value={actToZone} onChange={e => setActToZone(e.target.value as any)} sx={{ width: 160 }}>
                  {(['hand','deck','discard','stable'] as const).map(z => (<MenuItem key={z} value={z}>{ZONE_LABELS[z]}</MenuItem>))}
                </TextField>
                <TextField select label="Область" value={actScope} onChange={e => setActScope(e.target.value as any)} sx={{ width: 180 }}>
                  {(['self','opponent','any_player','all_players'] as const).map(s => (<MenuItem key={s} value={s}>{SCOPE_LABELS[s]}</MenuItem>))}
                </TextField>
                <FormControlLabel control={<Switch checked={actAllowSelf} onChange={(_, v) => setActAllowSelf(v)} />} label="Разрешить себя" />
                <TextField select label="Тип карты" value={actGroupFilter} onChange={e => setActGroupFilter(e.target.value as any)} sx={{ width: 200 }}>
                  {(['any','unicorn','upgrade','downgrade','instant','magic'] as const).map(g => (<MenuItem key={g} value={g}>{GROUP_LABELS[g]}</MenuItem>))}
                </TextField>
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" onClick={addActionToCurrentGroup}>Добавить действие в группу</Button>
                <Button variant="contained" onClick={() => {
                  if (!currentGroupActions.length) return;
                  setDslEffects(prev => [...prev, { trigger: currentGroupTrigger, actions: currentGroupActions } as any]);
                  resetCurrentGroup();
                }}>Добавить группу эффектов</Button>
              </Stack>
              {!!currentGroupActions.length && (
                <Typography variant="body2" color="text.secondary">Текущая группа: {currentGroupActions.length} действий</Typography>
              )}
              {dslEffects.length > 0 && (
                <Stack spacing={1}>
                  <Divider textAlign="left">Эффекты карты</Divider>
                  {dslEffects.map((ef, i) => (
                    <Paper key={i} sx={{ p: 1 }}>
                      <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                        <Box sx={{ flex: 1 }}>
                          <Typography variant="body2" component="div" dangerouslySetInnerHTML={{ __html: dslEffectToText(ef).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                        </Box>
                        <Button size="small" color="error" onClick={() => setDslEffects(prev => prev.filter((_, idx) => idx !== i))}>Удалить</Button>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          )}

          {!visualMode && (
          <>
          <Divider textAlign="left">Конструктор эффектов</Divider>
          <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Триггеры</Typography>
            <TextField
              select
              size="small"
              label="Когда срабатывает"
              SelectProps={{ multiple: true, renderValue: (vals) => (vals as string[]).map(v => TRIGGER_LABELS[v as keyof typeof TRIGGER_LABELS]).join(', ') }}
              value={selectedTriggers}
              onChange={e => setSelectedTriggers(typeof e.target.value === 'string' ? (e.target.value as any).split(',') : (e.target.value as any))}
              sx={{ minWidth: 360 }}
            >
              {ALL_TRIGGERS.map(t => (
                <MenuItem key={t} value={t}>{TRIGGER_LABELS[t]}</MenuItem>
              ))}
            </TextField>
            <Button size="small" variant="outlined" onClick={() => setSelectedTriggers(ALL_TRIGGERS)}>Выбрать все</Button>
            <Button size="small" onClick={() => setSelectedTriggers(['immediate'])}>Сбросить</Button>
          </Stack>
          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="subtitle2">Добор</Typography>
            <TextField
              type="number"
              label="Кол-во"
              size="small"
              value={drawQty}
              onChange={e => setDrawQty(Number(e.target.value))}
              inputProps={{ min: 1 }}
              sx={{ width: 120 }}
            />
            <Button variant="outlined" onClick={addDrawEffect}>
              + Добавить эффект добора
            </Button>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="subtitle2">Сброс</Typography>
            <TextField select label="Кто сбрасывает" size="small" value={discardAffects} onChange={e => setDiscardAffects(e.target.value as any)} sx={{ minWidth: 180 }}>
              <MenuItem value="self">Только вы</MenuItem>
              <MenuItem value="all">Все игроки</MenuItem>
              <MenuItem value="others">Все, кроме вас</MenuItem>
            </TextField>
            <TextField
              type="number"
              label="Кол-во"
              size="small"
              value={discardQty}
              onChange={e => setDiscardQty(Number(e.target.value))}
              inputProps={{ min: 1 }}
              sx={{ width: 120 }}
            />
            <Button variant="outlined" onClick={addDiscardEffect}>+ Добавить эффект сброса</Button>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2">Возврат</Typography>
            <TextField select label="Цель" size="small" value={returnScope} onChange={e => setReturnScope(e.target.value as any)} sx={{ minWidth: 140 }}>
              <MenuItem value="any">Любой</MenuItem>
              <MenuItem value="self">Себя</MenuItem>
              <MenuItem value="opponent">Соперник</MenuItem>
            </TextField>
            <TextField select label="Куда" size="small" value={returnDest} onChange={e => setReturnDest(e.target.value as any)} sx={{ minWidth: 140 }}>
              <MenuItem value="hand">В руку</MenuItem>
              <MenuItem value="deck">В колоду</MenuItem>
            </TextField>
            <TextField select label="Тип карты" size="small" value={returnCardGroup} onChange={e => setReturnCardGroup(e.target.value as any)} sx={{ minWidth: 180 }}>
              <MenuItem value="any">Любой</MenuItem>
              <MenuItem value="unicorn">Единорог</MenuItem>
              <MenuItem value="upgrade">Улучшение</MenuItem>
              <MenuItem value="downgrade">Ухудшение</MenuItem>
              <MenuItem value="instant">Мгновенная</MenuItem>
              <MenuItem value="non_unicorn">Не-единорог</MenuItem>
            </TextField>
            <TextField
              type="number"
              label="Кол-во"
              size="small"
              value={returnQty}
              onChange={e => setReturnQty(Number(e.target.value))}
              inputProps={{ min: 1 }}
              sx={{ width: 120 }}
            />
            <Button variant="outlined" onClick={addReturnEffect}>+ Добавить эффект возврата</Button>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2">Кража/Подарок</Typography>
            <TextField select label="Тип карты" size="small" value={transferCardGroup} onChange={e => setTransferCardGroup(e.target.value as any)} sx={{ minWidth: 180 }}>
              <MenuItem value="any">Любой</MenuItem>
              <MenuItem value="unicorn">Единорог</MenuItem>
              <MenuItem value="upgrade">Улучшение</MenuItem>
              <MenuItem value="downgrade">Ухудшение</MenuItem>
              <MenuItem value="instant">Мгновенная</MenuItem>
              <MenuItem value="non_unicorn">Не-единорог</MenuItem>
            </TextField>
            <TextField
              type="number"
              label="Кол-во"
              size="small"
              value={transferQty}
              onChange={e => setTransferQty(Number(e.target.value))}
              inputProps={{ min: 1 }}
              sx={{ width: 120 }}
            />
            <Button variant="outlined" onClick={addStealEffect}>+ Добавить эффект кражи</Button>
            <Button variant="outlined" onClick={addGiveEffect}>+ Добавить эффект подарка</Button>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <Typography variant="subtitle2">Обмен</Typography>
            <TextField select label="Тип карты" size="small" value={swapCardGroup} onChange={e => setSwapCardGroup(e.target.value as any)} sx={{ minWidth: 180 }}>
              <MenuItem value="any">Любой</MenuItem>
              <MenuItem value="unicorn">Единорог</MenuItem>
              <MenuItem value="upgrade">Улучшение</MenuItem>
              <MenuItem value="downgrade">Ухудшение</MenuItem>
              <MenuItem value="instant">Мгновенная</MenuItem>
              <MenuItem value="non_unicorn">Не-единорог</MenuItem>
            </TextField>
            <Button variant="outlined" onClick={addSwapEffect}>+ Добавить эффект обмена</Button>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="subtitle2">Уничтожение (только чужое стойло)</Typography>
            <TextField
              select
              label="Цель"
              size="small"
              value={destroyScope === 'self' ? 'opponent' : destroyScope}
              onChange={e => setDestroyScope(e.target.value as any)}
              sx={{ width: 160 }}
            >
              <MenuItem value="any">Любой игрок (кроме вас)</MenuItem>
              <MenuItem value="opponent">Соперник</MenuItem>
            </TextField>
            <TextField
              select
              label="Тип карты"
              size="small"
              value={destroyCardGroup}
              onChange={e => setDestroyCardGroup(e.target.value as any)}
              sx={{ width: 180 }}
            >
              <MenuItem value="any">Любая</MenuItem>
              <MenuItem value="unicorn">Единорог</MenuItem>
              <MenuItem value="upgrade">Улучшение</MenuItem>
              <MenuItem value="downgrade">Ухудшение</MenuItem>
              <MenuItem value="instant">Мгновенная</MenuItem>
              <MenuItem value="non_unicorn">Не-единорог</MenuItem>
            </TextField>
            <TextField
              type="number"
              label="Кол-во"
              size="small"
              value={destroyQty}
              onChange={e => setDestroyQty(Number(e.target.value))}
              inputProps={{ min: 1 }}
              sx={{ width: 120 }}
            />
            <Button variant="outlined" onClick={addDestroyStableEffect}>
              + Добавить эффект уничтожения
            </Button>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="subtitle2">Пожертвование (своё стойло)</Typography>
            <TextField
              select
              label="Тип карты"
              size="small"
              value={sacrificeCardGroup}
              onChange={e => setSacrificeCardGroup(e.target.value as any)}
              sx={{ width: 180 }}
            >
              <MenuItem value="any">Любая</MenuItem>
              <MenuItem value="unicorn">Единорог</MenuItem>
              <MenuItem value="upgrade">Улучшение</MenuItem>
              <MenuItem value="downgrade">Ухудшение</MenuItem>
              <MenuItem value="instant">Мгновенная</MenuItem>
              <MenuItem value="non_unicorn">Не-единорог</MenuItem>
            </TextField>
            <TextField
              type="number"
              label="Кол-во"
              size="small"
              value={sacrificeQty}
              onChange={e => setSacrificeQty(Number(e.target.value))}
              inputProps={{ min: 1 }}
              sx={{ width: 120 }}
            />
            <Button variant="outlined" onClick={addSacrificeEffect}>+ Добавить эффект пожертвования</Button>
          </Stack>
          </>
          )}

          <Divider textAlign="left">Выбранные эффекты</Divider>
          <Stack spacing={1}>
            {effects.length === 0 && <Typography color="text.secondary">Эффектов пока нет</Typography>}
            {effects.map((e, idx) => (
              <Paper key={`${idx}-${e.type}-${e.card_type ?? 'any'}-${e.quantity_affected ?? 0}`} sx={{ p: 1.5 }} variant="outlined">
                <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                  <Typography variant="body2">{effectToText(e)}</Typography>
                  <IconButton size="small" onClick={() => setEffects(prev => prev.filter((_, i) => i !== idx))}>
                    ✕
                  </IconButton>
                </Stack>
              </Paper>
            ))}
            {dslEffects.map((e, idx) => (
              <Paper key={`dsl-${idx}`} sx={{ p: 1.5 }} variant="outlined">
                <Stack direction="row" alignItems="center" spacing={1} justifyContent="space-between">
                  <Typography variant="body2">{dslEffectToText(e)}</Typography>
                  <IconButton size="small" onClick={() => setDslEffects(prev => prev.filter((_, i) => i !== idx))}>✕</IconButton>
                </Stack>
              </Paper>
            ))}
          </Stack>

          <Divider textAlign="left">Описание</Divider>
          <FormControlLabel
            control={<Switch checked={autoDesc} onChange={(_, v) => setAutoDesc(v)} />}
            label="Генерировать автоматически"
          />
          <TextField
            label="Описание карты"
            value={description}
            onChange={e => setDescription(e.target.value)}
            disabled={autoDesc}
            multiline
            minRows={2}
          />

          <Divider textAlign="left">Админ-поля</Divider>
          <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
            <FormControlLabel control={<Switch checked={active} onChange={(_, v) => setActive(v)} />} label="Активна" />
            <TextField
              type="number"
              label="Количество в колоде"
              value={deckCount}
              onChange={e => setDeckCount(Number(e.target.value))}
              inputProps={{ min: 0 }}
              sx={{ width: 220 }}
            />
          </Stack>

          <Button variant="contained" onClick={createCard} disabled={!name}>
            Создать карту
          </Button>
        </Stack>
      </Paper>

      <Typography variant="h6" gutterBottom>
        Превью карточки
      </Typography>
      <Box sx={{ mb: 3 }}>
        <CardTemplate
          name={name || 'Название карты'}
          type={type}
          description={(autoDesc ? (dslEffects.map(dslEffectToText).join('\n')) : description) || 'Описание появится здесь'}
          imageUrl={imageUrl}
          width={320}
          onExportError={(err) => console.error('PNG export error', err)}
        />
      </Box>

      <Typography variant="h6" gutterBottom>
        Карты
      </Typography>
      {/* Controls: search, filters, sorting, page size */}
      <Paper sx={{ p: 2, mb: 2 }} variant="outlined">
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <TextField
            label="Поиск"
            size="small"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            sx={{ minWidth: 260 }}
            InputProps={{ startAdornment: (
              <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
            ) }}
          />
          <TextField select label="Тип" size="small" value={filterType} onChange={(e) => { setFilterType(e.target.value as any); setPage(1); }} sx={{ minWidth: 200 }}>
            <MenuItem value="any">Все типы</MenuItem>
            {([
              'baby_unicorn','basic_unicorn','magical_unicorn','ultimate_unicorn','magic','instant','upgrade','downgrade','unicorn','non_unicorn',
            ] as CardCategory[]).map(opt => (
              <MenuItem key={opt} value={opt}>{CARD_TYPE_LABELS[opt]}</MenuItem>
            ))}
          </TextField>
          <TextField select label="Активна" size="small" value={filterActive} onChange={(e) => { setFilterActive(e.target.value as any); setPage(1); }} sx={{ minWidth: 160 }}>
            <MenuItem value="any">Все</MenuItem>
            <MenuItem value="true">Да</MenuItem>
            <MenuItem value="false">Нет</MenuItem>
          </TextField>
          <TextField select label="Сортировка" size="small" value={sort} onChange={(e) => { setSort(e.target.value as any); }} sx={{ minWidth: 200 }}>
            <MenuItem value="name_asc">Название ↑</MenuItem>
            <MenuItem value="name_desc">Название ↓</MenuItem>
            <MenuItem value="type_asc">Тип ↑</MenuItem>
            <MenuItem value="type_desc">Тип ↓</MenuItem>
          </TextField>
          <TextField select label="На странице" size="small" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} sx={{ width: 140 }}>
            {[5,10,20,50].map(s => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
          </TextField>
          <Box sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary">
            Найдено: {total} • Стр. {page} из {Math.max(1, Math.ceil(total / pageSize))}
          </Typography>
        </Stack>
      </Paper>

      <Stack spacing={1}>
        {cards.map((c, idx) => (
          <Paper key={c.id || `${c.name}-${(c as any)._id || Math.random()}` } sx={{ p: 2, cursor: 'pointer' }} onClick={() => {
            setEditIdx(idx);
            setEName(c.name);
            setEType(c.type);
            setEDescription(c.description || '');
            setEImageUrl(c.image || '');
            setEActive((c as any).active ?? true);
            setEDeckCount(Number((c as any).deck_count ?? 1));
            try { setEEffectsJson(JSON.stringify((c as any).effects ?? [], null, 2)); } catch { setEEffectsJson('[]'); }
            // init visual editor from existing effects
            setMeDslEffects(((c as any).effects as any) || []);
            meResetCurrentGroup();
            setMeVisualMode(false);
            setEditOpen(true);
          }}>
            <Stack direction="row" spacing={2} alignItems="center">
              <CardTemplate
                name={c.name}
                type={c.type as any}
                description={(((c as any).effects || []) as any[]).length ? (((c as any).effects as any[]).map(dslEffectToText).join('\n')) : (c.description || '')}
                imageUrl={(c as any).image}
                width={140}
                hideExportButton
              />
              <Box>
                <Typography>{c.name}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {CARD_TYPE_LABELS[c.type]} • эффектов: {c.effects?.length || 0}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        ))}
      </Stack>
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
        <Pagination
          color="primary"
          page={page}
          count={Math.max(1, Math.ceil(total / pageSize))}
          onChange={(_, p) => setPage(p)}
        />
      </Box>

      {/* Edit Modal */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Редактировать карту</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="subtitle2">Превью</Typography>
            <CardTemplate
              name={eName || 'Название карты'}
              type={eType}
              description={(meVisualMode ? (meDslEffects.map(dslEffectToText).join('\n')) : eDescription) || 'Описание появится здесь'}
              imageUrl={eImageUrl || undefined}
              width={320}
            />
            <Stack direction="row" spacing={2}>
              <TextField label="Название" value={eName} onChange={e => setEName(e.target.value)} sx={{ flex: 1 }} />
              <TextField select label="Тип" value={eType} onChange={e => setEType(e.target.value as CardCategory)} sx={{ width: 240 }}>
                {([
                  'baby_unicorn','basic_unicorn','magical_unicorn','ultimate_unicorn','magic','instant','upgrade','downgrade','unicorn','non_unicorn',
                ] as CardCategory[]).map(opt => (
                  <MenuItem key={opt} value={opt}>{CARD_TYPE_LABELS[opt]}</MenuItem>
                ))}
              </TextField>
            </Stack>
            <TextField label="Ссылка на изображение" value={eImageUrl} onChange={e => setEImageUrl(e.target.value)} />
            <TextField label="Описание" value={eDescription} onChange={e => setEDescription(e.target.value)} multiline minRows={3} />
            <Divider textAlign="left">Админ-поля</Divider>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <FormControlLabel control={<Switch checked={eActive} onChange={(_, v) => setEActive(v)} />} label="Активна" />
              <TextField type="number" label="Количество в колоде" value={eDeckCount} onChange={e => setEDeckCount(Number(e.target.value))} inputProps={{ min: 0 }} sx={{ width: 220 }} />
            </Stack>

            <Divider textAlign="left">Эффекты</Divider>
            <Typography variant="body2" color="text.secondary">
              Вы можете редактировать эффекты в виде JSON или включить визуальный редактор.
            </Typography>
            <FormControlLabel control={<Switch checked={meVisualMode} onChange={(_, v) => setMeVisualMode(v)} />} label="Визуальный редактор эффектов" />
            {!meVisualMode && (
            <TextField
              value={eEffectsJson}
              onChange={e => {
                const v = e.target.value;
                setEEffectsJson(v);
                try {
                  const obj = JSON.parse(v);
                  if (!Array.isArray(obj)) throw new Error('Ожидается массив');
                  setEEffectsError('');
                } catch (err: any) {
                  setEEffectsError(err?.message || 'Некорректный JSON');
                }
              }}
              multiline
              minRows={8}
              placeholder='[ { "trigger": "immediate", "actions": [ { "kind": "draw", ... } ] } ]'
              error={!!eEffectsError}
              helperText={eEffectsError || 'JSON массива эффектов'}
            />
            )}

            {meVisualMode && (
              <Stack spacing={2}>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <TextField select label="Триггер" value={meCurrentGroupTrigger} onChange={e => setMeCurrentGroupTrigger(e.target.value as Trigger)} sx={{ minWidth: 220 }}>
                    {(['immediate','on_play','on_enter_stable','on_turn_start','on_turn_end','while_in_stable','when_other_plays','on_discard','on_destroy','on_sacrifice','after_resolve'] as Trigger[]).map(t => (
                      <MenuItem key={t} value={t}>{TRIGGER_LABELS[t]}</MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Divider textAlign="left">Добавить действие</Divider>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <TextField select label="Действие" value={meActKind} onChange={e => setMeActKind(e.target.value as any)} sx={{ minWidth: 200 }}>
                    {(['add','move','transfer','return','steal','give','discard','destroy','sacrifice','search','reveal','shuffle_deck','swap'] as Action['kind'][]).map(k => (
                      <MenuItem key={k as string} value={k as string}>{ACTION_LABELS[k]}</MenuItem>
                    ))}
                  </TextField>
                  <TextField type="number" label="Количество" value={meActQuantity} onChange={e => setMeActQuantity(Number(e.target.value))} sx={{ width: 140 }} />
                  <FormControlLabel control={<Switch checked={meActOptional} onChange={(_, v) => setMeActOptional(v)} />} label="Опционально" />
                  <FormControlLabel control={<Switch checked={meActRequirePrev} onChange={(_, v) => setMeActRequirePrev(v)} />} label="После успеха" />
                </Stack>
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <TextField select label="Источник" value={meActSrcZone} onChange={e => setMeActSrcZone(e.target.value as any)} sx={{ width: 160 }}>
                    {(['hand','deck','discard','stable'] as const).map(z => (<MenuItem key={z} value={z}>{ZONE_LABELS[z]}</MenuItem>))}
                  </TextField>
                  <TextField select label="Назначение" value={meActDstZone} onChange={e => setMeActDstZone(e.target.value as any)} sx={{ width: 160 }}>
                    {(['hand','deck','discard','stable'] as const).map(z => (<MenuItem key={z} value={z}>{ZONE_LABELS[z]}</MenuItem>))}
                  </TextField>
                  <TextField select label="Из зоны" value={meActFromZone} onChange={e => setMeActFromZone(e.target.value as any)} sx={{ width: 160 }}>
                    {(['hand','deck','discard','stable'] as const).map(z => (<MenuItem key={z} value={z}>{ZONE_LABELS[z]}</MenuItem>))}
                  </TextField>
                  <TextField select label="В зону" value={meActToZone} onChange={e => setMeActToZone(e.target.value as any)} sx={{ width: 160 }}>
                    {(['hand','deck','discard','stable'] as const).map(z => (<MenuItem key={z} value={z}>{ZONE_LABELS[z]}</MenuItem>))}
                  </TextField>
                  <TextField select label="Область" value={meActScope} onChange={e => setMeActScope(e.target.value as any)} sx={{ width: 180 }}>
                    {(['self','opponent','any_player','all_players'] as const).map(s => (<MenuItem key={s} value={s}>{SCOPE_LABELS[s]}</MenuItem>))}
                  </TextField>
                  <FormControlLabel control={<Switch checked={meActAllowSelf} onChange={(_, v) => setMeActAllowSelf(v)} />} label="Разрешить себя" />
                  <TextField select label="Фильтр группы" value={meActGroupFilter} onChange={e => setMeActGroupFilter(e.target.value as any)} sx={{ width: 200 }}>
                    {(['any','unicorn','upgrade','downgrade','instant','magic'] as const).map(g => (<MenuItem key={g} value={g}>{GROUP_LABELS[g]}</MenuItem>))}
                  </TextField>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button variant="outlined" onClick={meAddActionToCurrentGroup}>Добавить действие в группу</Button>
                  <Button variant="contained" onClick={() => {
                    if (!meCurrentGroupActions.length) return;
                    setMeDslEffects(prev => [...prev, { trigger: meCurrentGroupTrigger, actions: meCurrentGroupActions } as any]);
                    meResetCurrentGroup();
                  }}>Добавить группу эффектов</Button>
                </Stack>
                {!!meCurrentGroupActions.length && (
                  <Typography variant="body2" color="text.secondary">Текущая группа: {meCurrentGroupActions.length} действий</Typography>
                )}
                {meDslEffects.length > 0 && (
                  <Stack spacing={1}>
                    <Divider textAlign="left">Эффекты карты</Divider>
                    {meDslEffects.map((ef, i) => (
                      <Paper key={i} sx={{ p: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" component="div" dangerouslySetInnerHTML={{ __html: dslEffectToText(ef).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }} />
                          </Box>
                          <Button size="small" color="error" onClick={() => setMeDslEffects(prev => prev.filter((_, idx) => idx !== i))}>Удалить</Button>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Отмена</Button>
          {editIdx !== null && (
            <Button color="error" onClick={async () => {
              const ok = window.confirm('Удалить эту карту? Это действие нельзя отменить.');
              if (!ok) return;
              const id = (cards[editIdx!] as any).id || (cards[editIdx!] as any)._id;
              await api.delete(`/cards/${id}`);
              await loadCards();
              setEditOpen(false);
            }}>Удалить</Button>
          )}
          <Button variant="contained" onClick={async () => {
            if (editIdx === null) return;
            const curr: any = cards[editIdx];
            const id = curr.id || curr._id;
            let parsedEffects = curr.effects;
            if (meVisualMode) {
              parsedEffects = meDslEffects;
            } else {
              try {
                const obj = JSON.parse(eEffectsJson);
                if (!Array.isArray(obj)) throw new Error('Effects JSON должен быть массивом');
                parsedEffects = obj;
              } catch (err: any) {
                setEEffectsError(err?.message || 'Некорректный JSON');
                return;
              }
            }
            const payload: any = {
              name: eName,
              type: eType,
              description: eDescription,
              image: eImageUrl,
              effects: parsedEffects,
              active: !!eActive,
              deck_count: Math.max(0, Number(eDeckCount) || 0),
            };
            await api.put(`/cards/${id}`, payload);
            await loadCards();
            setEditOpen(false);
          }}>Сохранить</Button>
        </DialogActions>
      </Dialog>
      </Container>
    </AdminShell>
  );
}
