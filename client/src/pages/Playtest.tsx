import React, { useMemo, useRef, useState } from 'react';
import { Alert, Box, Button, Card as MUICard, CardContent, Grid, Snackbar, Stack, Tooltip, TextField, Typography, Chip, Dialog, DialogTitle, DialogContent, DialogActions, Switch, FormControlLabel, MenuItem, Select, InputLabel, FormControl } from '@mui/material';
import { api } from '../api';
import { emitWithAck } from '../hooks/useSocket';
import CardTemplate from '../components/CardTemplate';
import { io, Socket } from 'socket.io-client';
import Panel from '../components/Panel';
import { cardTypeColor } from '../constants/cardTypeColors';
import { AdminShell } from '../components/admin/AdminShell';

// Using shared axios instance from src/api.ts

type GameState = {
  players: Array<{
    id: string;
    deck: string[];
    hand: string[];
    discard: string[];
    stable: string[];
    nursery: string[];
    field: string[];
    action_points: number;
  }>;
  turn: { currentPlayerId: string; phase: 'begin_turn' | 'draw' | 'action' | 'end_turn' };
  cards: Record<string, { id: string; name: string; type: string; description?: string; image?: string; play_requirements?: any; effects?: any[] }>;
  deck?: string[];
  discard?: string[];
  /** Общая колода яслей; опционально — старые состояния приходят без поля. */
  nursery?: string[];
  /** Победитель партии; проставляет сервис при победе. */
  winnerId?: string;
};

type LogEntry = { t: number; type: 'draw' | 'play' | 'end' | 'react'; playerId: string; details?: any };

export default function Playtest() {
  const [gameId, setGameId] = useState<string>('');
  const [state, setState] = useState<GameState | null>(null);
  const [error, setError] = useState<string>('');
  const [seedTop, setSeedTop] = useState<string>('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [playerCount, setPlayerCount] = useState<number>(2);
  const [autoPoll, setAutoPoll] = useState<boolean>(true);
  const socketRef = useRef<Socket | null>(null);
  const [gameIdInput, setGameIdInput] = useState<string>('');
  const [shareLink, setShareLink] = useState<string>('');
  const [viewerId, setViewerId] = useState<string>('');
  const [pending, setPending] = useState<any>(null);
  const [socketStatus, setSocketStatus] = useState<{ connected: boolean; attempts: number }>({ connected: false, attempts: 0 });
  const [socketError, setSocketError] = useState<string>('');
  // Манифест изображений: name -> /cards/... путь из public
  const [imgManifest, setImgManifest] = useState<Record<string, string>>({});
  const [targetPick, setTargetPick] = useState<{
    open: boolean;
    cardId: string;
    kind: 'destroy' | 'steal' | 'discard' | 'sacrifice' | 'players' | string;
    candidates: string[];
    qty: number;
    selected: string[];
    playerCandidates?: string[];
    selectedPlayerId?: string;
  } | null>(null);

  const me = useMemo(() => (state ? state.players.find(p => p.id === state.turn.currentPlayerId) : null), [state]);

  async function createGame() {
    setError('');
    try {
      const seed = seedTop.split(',').map(s => s.trim()).filter(Boolean);
      const pc = Math.max(2, Math.min(12, Number(playerCount) || 2));
      const players: any[] = Array.from({ length: pc }, (_, i) => ({ id: `P${i + 1}` }));
      if (seed.length) (players[0] as any).seedTop = seed;
      const body: any = { players };
      const res = await api.post('/game', body);
      setGameId(res.data.id);
      setState(res.data.state);
      try { const lr = await api.get(`/game/${res.data.id}/logs`); setLogs(lr.data); } catch {}
      // Update URL with shareable ?game parameter
      const url = new URL(window.location.href);
      url.searchParams.set('game', res.data.id);
      window.history.replaceState({}, '', url.toString());
      setShareLink(url.toString());
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Ошибка создания игры');
    }
  }

  // Реакция: Hypnorog (сброс карты для отмены эффекта единорога)
  async function reactHypnorog() {
    if (!gameId || !pending) return;
    if (!reactorId || !hypnoDiscardId) { setError('Выберите реактора и карту для сброса'); return; }
    setError('');
    try {
      const body: any = { byPlayerId: reactorId, discardCardId: hypnoDiscardId };
      const res = await api.post(`/game/${gameId}/react/hypnorog`, body);
      setState(res.data?.state || state);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Hypnorog: реакция не удалась');
    }
  }

  // Проверка: является ли действие по kind опциональным у данной карты
  function isActionOptional(card: any, kind: string): boolean {
    const effs = (card?.effects || []) as any[];
    for (const ef of effs) {
      const trg = ef?.trigger;
      if (trg !== 'on_play' && trg !== 'immediate') continue;
      const acts = ef?.actions || [];
      for (const a of acts) {
        if (String(a?.kind) === String(kind) && !!a?.optional) return true;
      }
    }
    return false;
  }

  // UI helpers: подпись для действия эффекта

  function labelForStartEffect(ef: any): string {
    const acts = Array.isArray(ef?.actions) ? ef.actions : [];
    const a = acts[0] || {};
    const kind = String(a?.kind || '').toLowerCase();
    const base = kind === 'draw' ? 'Взять карту'
      : kind === 'destroy' ? 'Уничтожить цель'
      : kind === 'steal' ? 'Украсть карту'
      : kind === 'discard' ? 'Сбросить карту'
      : kind === 'sacrifice' ? 'Пожертвовать'
      : kind === 'move' ? 'Переместить'
      : 'Эффект начала хода';
    return base;
  }

  // Parse first destroy action quantity from card.effects
  function getDestroyQty(card: any): number {
    const effects = (card?.effects || []) as any[];
    const eff = effects.find(ef => (ef.trigger === 'on_play' || ef.trigger === 'immediate') && Array.isArray(ef.actions) && ef.actions.some((a: any) => a.kind === 'destroy'));
    if (!eff) return 0;
    const action = eff.actions.find((a: any) => a.kind === 'destroy');
    const qty = Number(action?.targets?.quantity?.value ?? 1);
    return Number.isFinite(qty) && qty > 0 ? qty : 1;
  }

  async function playTargeted(cardId: string) {
    if (!gameId || !state) return;
    setError('');
    const card = state.cards[cardId];
    const qty = getDestroyQty(card);
    if (!qty) {
      setError('У этой карты нет таргетируемого уничтожения');
      return;
    }
    try {
      const r = await api.get(`/game/${gameId}/targetOptions`, { params: { cardId, kind: 'destroy' } });
      const candidates = (r.data?.targets as string[]) || [];
      let playerCandidates: string[] | undefined;
      try {
        const rp = await api.get(`/game/${gameId}/targetOptions`, { params: { cardId, kind: 'destroy', mode: 'players' } });
        playerCandidates = (rp.data?.players as string[]) || undefined;
      } catch {}
      if (candidates.length === 0) {
        setError('Нет доступных целей');
        return;
      }
      // Open dialog for selection (support qty=1 for now)
      setTargetPick({ open: true, cardId, kind: 'destroy', candidates, qty, selected: [], playerCandidates });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Не удалось получить цели');
    }
  }

  async function confirmTargetedPlay() {
    if (!gameId || !targetPick) return;
    const { cardId, selected, qty, selectedPlayerId } = targetPick;
    if (selected.length < qty && !selectedPlayerId) { setError(`Выберите ${qty} цель(и)`); return; }
    setError('');
    // Понижение: цель — игрок-владелец стойла, отправляем обычный /play с targetPlayerId
    if (targetPick.kind === 'downgrade') {
      if (!selectedPlayerId) { setError('Выберите игрока-цель'); return; }
      try {
        const res = await api.post(`/game/${gameId}/play`, { cardId, targetPlayerId: selectedPlayerId });
        setState(res.data);
        try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
        setTargetPick(null);
      } catch (e: any) {
        setError(e?.response?.data?.message || e?.message || 'Не удалось понизить карту');
      }
      return;
    }
    try {
      const body: any = { cardId, targets: selected.slice(0, qty) };
      if (selectedPlayerId) body.targetPlayerId = selectedPlayerId;
      const res = await api.post(`/game/${gameId}/playWithTargets`, body);
      setState(res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
      setTargetPick(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Не удалось сыграть с целями');
    }
  }

  // Join existing game by ID
  async function joinExisting(idRaw?: string) {
    const id = (idRaw ?? gameIdInput).trim();
    if (!id) return;
    setError('');
    try {
      const res = await api.get(`/game/${id}`);
      setGameId(id);
      setState(res.data);
      try { const lr = await api.get(`/game/${id}/logs`); setLogs(lr.data); } catch {}
      const url = new URL(window.location.href);
      url.searchParams.set('game', id);
      window.history.replaceState({}, '', url.toString());
      setShareLink(url.toString());
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Игра не найдена');
    }
  }

  // Setup Socket.IO connection once on mount
  React.useEffect(() => {
    // Derive WS endpoint from API baseURL
    let base = (api as any)?.defaults?.baseURL as string | undefined;
    try {
      if (base) {
        // if ends with /api, strip it
        base = base.replace(/\/?api\/?$/, '');
      }
    } catch {}
    const endpoint = base || window.location.origin;
    const s = io(endpoint, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      timeout: 10000,
    });
    socketRef.current = s;
    // When connected, prefer realtime over polling
    s.on('connect', () => {
      // keep polling toggle user-controlled: do not force change, but suggest via console
      // console.info('Socket connected');
      setSocketStatus({ connected: true, attempts: 0 });
      setSocketError('');
    });
    s.on('disconnect', () => {
      // console.info('Socket disconnected');
      setSocketStatus(prev => ({ ...prev, connected: false }));
    });
    s.on('connect_error', (err: any) => {
      setSocketError(err?.message || 'Ошибка соединения');
    });
    // socket.io manager events
    (s as any).io?.on('reconnect_attempt', (attempt: number) => {
      setSocketStatus({ connected: false, attempts: attempt });
    });
    (s as any).io?.on('reconnect_failed', () => {
      setSocketError('Не удалось переподключиться');
    });
    // Handlers
    s.on('state_update', (payload: any) => {
      // server sometimes sends {id, state} on creation emit
      const st = payload?.players && payload?.turn ? payload : payload?.state || payload;
      if (st) setState(st);
    });
    s.on('logs_update', (entries: any[]) => {
      if (Array.isArray(entries)) setLogs(entries as any);
    });
    s.on('pending_update', (_pending: any) => {
      setPending(_pending);
    });
    return () => {
      try { s.disconnect(); } catch {}
      socketRef.current = null;
    };
  }, []);

  // Join/leave game room when gameId changes
  React.useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    if (gameId) {
      s.emit('join_game', { gameId });
    }
    return () => {
      if (gameId) {
        try { s.emit('leave_game', { gameId }); } catch {}
      }
    };
  }, [gameId]);

  // On mount: auto-join if URL has ?game
  React.useEffect(() => {
    const url = new URL(window.location.href);
    const gid = url.searchParams.get('game');
    if (gid && !gameId) {
      joinExisting(gid);
    }
  }, []);

  // Загрузка манифеста изображений из public/cards/manifest.json
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/cards/manifest.json', { cache: 'no-cache' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data && typeof data === 'object') {
          setImgManifest(data);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  // Получить url изображения карты: сначала card.image, иначе из манифеста по name
  function imageUrlFor(card?: any): string | undefined {
    if (!card) return undefined;
    if (card.image && typeof card.image === 'string') return card.image;
    const name = card.name;
    if (!name) return undefined;
    const fromRoot = (imgManifest as any)?.[name] || (imgManifest as any)?.examples?.[name];
    return typeof fromRoot === 'string' ? fromRoot : undefined;
  }

  // When state changes, set default viewerId once
  React.useEffect(() => {
    if (state && !viewerId) {
      // Default to first player in state
      setViewerId(state.players[0]?.id || '');
    }
  }, [state]);

  async function playWithWindow(cardId: string) {
    if (!gameId) return;
    setError('');
    try {
      const res = await api.post(`/game/${gameId}/playWithWindow`, { cardId });
      // server returns { pending, state }
      setState(res.data.state || res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Нельзя поставить ход в окно реакций');
    }
  }

  async function reactNeigh(byPlayerId?: string) {
    if (!gameId) return;
    setError('');
    try {
      const res = await api.post(`/game/${gameId}/react/neigh`, byPlayerId ? { byPlayerId } : {});
      setState(res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Нет pending розыгрыша или нельзя отменить');
    }
  }

  // Разрешение окна реакции — только через socket resolve_pending с playerId:
  // сервер закрывает окно лишь для его актора. Прежний REST /resolvePending без тела обходил проверку.
  async function resolvePending() {
    if (!gameId) return;
    setError('');
    const s = socketRef.current;
    if (!s) { setError('Нет соединения с сервером'); return; }
    if (!viewerId) { setError('Выберите игрока в поле «Я —»'); return; }
    const res = await emitWithAck(s, 'resolve_pending', { gameId, playerId: viewerId });
    if (!res) { setError('Сервер не ответил на resolve_pending'); return; }
    if (!res.ok) { setError(res.message || 'Нечего разрешать'); return; }
    if (res.state) setState(res.state as any);
    if (res.pending !== undefined) setPending(res.pending);
    if (res.logs) setLogs(res.logs as any);
  }

  async function passDraw() {
    // Партия окончена — действия игрока не уходят на сервер
    if (state?.winnerId) { setError('Партия окончена: победитель определён'); return; }
    if (!gameId) return;
    setError('');
    try {
      const res = await api.post(`/game/${gameId}/passDraw`);
      setState(res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Нельзя взять карту вместо действия');
    }
  }

  async function discard(cardId: string) {
    if (!gameId) return;
    setError('');
    try {
      const res = await api.post(`/game/${gameId}/discard`, { cardId });
      setState(res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Сброс невозможен сейчас');
    }
  }

  async function refresh() {
    if (!gameId) return;
    setError('');
    try {
      const res = await api.get(`/game/${gameId}`);
      setState(res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Ошибка обновления состояния');
    }
  }

  // Auto polling
  React.useEffect(() => {
    // If socket is connected, polling is optional (can be turned off by user)
    if (!gameId || !autoPoll) return;
    const id = setInterval(() => {
      refresh();
    }, 1000);
    return () => clearInterval(id);
  }, [gameId, autoPoll]);

  async function turnStart() {
    // Партия окончена — действия игрока не уходят на сервер
    if (state?.winnerId) { setError('Партия окончена: победитель определён'); return; }
    if (!gameId) return;
    setError('');
    try {
      const res = await api.post(`/game/${gameId}/turnStart`);
      setState(res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Ошибка эффектов начала хода');
    }
  }

  // Активировать опциональный on_turn_start эффект (кнопка на карте в стойле)
  async function activateTurnStart(sourceCardId: string, effectIdx: number) {
    if (!gameId) return;
    setError('');
    try {
      // Сначала убедимся, что промпты инициализированы
      try {
        const ts = await api.post(`/game/${gameId}/turnStart`);
        setState(ts.data?.state || ts.data);
      } catch {}
      const res = await api.post(`/game/${gameId}/turnStart/activate`, { sourceCardId, effectIdx });
      setState(res.data?.state || res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      const status = e?.response?.status;
      const msg = e?.response?.data?.message || e?.message || '';
      if (status === 400 || status === 404) {
        // Повторная попытка после явной инициации промптов
        try {
          const ts = await api.post(`/game/${gameId}/turnStart`);
          setState(ts.data?.state || ts.data);
          const res2 = await api.post(`/game/${gameId}/turnStart/activate`, { sourceCardId, effectIdx });
          setState(res2.data?.state || res2.data);
          try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
          return;
        } catch (e2: any) {
          setError(e2?.response?.data?.message || e2?.message || 'Эффект начала хода недоступен сейчас');
          return;
        }
      }
      setError(msg || 'Не удалось активировать эффект начала хода');
    }
  }

  async function draw(qty = 1, mode: 'official' | 'effect' = 'official') {
    // Партия окончена — действия игрока не уходят на сервер
    if (state?.winnerId) { setError('Партия окончена: победитель определён'); return; }
    if (!gameId) return;
    setError('');
    try {
      const res = await api.post(`/game/${gameId}/draw`, { qty, mode });
      setState(res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Ошибка взятия карты');
    }
  }

  function canPayCosts(card: any, meP: any, st: GameState): { ok: boolean; reason?: string } {
    const costs = (card?.play_requirements?.costs || []) as any[];
    for (const a of costs) {
      const kind = String(a.kind || '');
      if (kind === 'discard' || kind === 'sacrifice') {
        const sel = a.targets || {};
        const qty = Number(sel?.quantity?.value ?? 1);
        const zone = String(sel?.zone || (kind === 'discard' ? 'hand' : 'stable'));
        const group = sel?.filters?.card_group as string | undefined;
        const src = zone === 'hand' ? meP.hand : zone === 'stable' ? meP.stable : [];
        const candidates: string[] = [];
        for (const id of src) {
          const c = st.cards[id] as any;
          // simple group matcher similar to server
          const t = String(c?.type || '').toLowerCase();
          const isUni = ['baby_unicorn','basic_unicorn','magical_unicorn','ultimate_unicorn','unicorn'].includes(t);
          if (!group ||
              (group === 'unicorn' && isUni) ||
              (group === 'upgrade' && t === 'upgrade') ||
              (group === 'downgrade' && t === 'downgrade') ||
              (group === 'magic' && t === 'magic') ||
              (group === 'instant' && t === 'instant')) {
            candidates.push(id);
          }
        }
        if (candidates.length < qty) {
          const label = kind === 'discard' ? 'сброс' : 'жертву';
          return { ok: false, reason: `Недостаточно карт для ${label} (${candidates.length}/${qty})` };
        }
      }
    }
    return { ok: true };
  }

  async function play(cardId: string) {
    // Партия окончена — действия игрока не уходят на сервер
    if (state?.winnerId) { setError('Партия окончена: победитель определён'); return; }
    if (!gameId) return;
    setError('');
    try {
      const res = await api.post(`/game/${gameId}/play`, { cardId });
      setState(res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      // Перехват таргетинга: 409 from server with needTargets
      const status = e?.response?.status;
      const data = e?.response?.data;
      if (status === 409 && data?.needTargets) {
        const kind: 'destroy' | 'steal' | 'discard' | 'sacrifice' | 'players' | string = data?.kind || 'destroy';
        const candidates: string[] = (data?.options?.targets as string[]) || [];
        let playerCandidates: string[] | undefined;
        if (kind === 'players') {
          playerCandidates = (data?.options?.players as string[]) || [];
        } else {
          try {
            const rPlayers = await api.get(`/game/${gameId}/targetOptions`, { params: { cardId, kind, mode: 'players' } });
            playerCandidates = (rPlayers.data?.players as string[]) || undefined;
          } catch {}
        }
        const qty = kind === 'destroy' ? getDestroyQty(state!.cards[cardId]) : 1;
        setTargetPick({ open: true, cardId, kind, candidates, qty, selected: [], playerCandidates });
        return;
      }
      // Понижение (downgrade) требует игрока-цели: открываем окно выбора игрока
      if (status === 409 && data?.needTargetPlayer) {
        const players: string[] = (data?.options?.players as string[]) || [];
        setTargetPick({ open: true, cardId, kind: 'downgrade', candidates: [], qty: 0, selected: [], playerCandidates: players });
        return;
      }
      setError(data?.message || e?.message || 'Нельзя разыграть карту');
    }
  }

  async function endTurn() {
    // Партия окончена — действия игрока не уходят на сервер
    if (state?.winnerId) { setError('Партия окончена: победитель определён'); return; }
    if (!gameId) return;
    setError('');
    try {
      const res = await api.post(`/game/${gameId}/endTurn`);
      setState(res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Ошибка окончания хода');
    }
  }

  // Helpers: вычисления модификаторов
  function calcHandLimitFor(pId: string): number {
    if (!state) return 7;
    const p = state.players.find(pp => pp.id === pId);
    if (!p) return 7;
    let delta = 0;
    for (const cid of p.stable) {
      const c: any = state.cards[cid];
      if (!c) continue;
      const d = Number(c?.hand_limit_delta || 0);
      if (!Number.isNaN(d)) delta += d;
    }
    return Math.max(0, 7 + delta);
  }

  function calcWinThresholdFor(pId: string): number {
    if (!state) return 7;
    const p = state.players.find(pp => pp.id === pId);
    if (!p) return 7;
    let delta = 0;
    for (const cid of p.stable) {
      const c: any = state.cards[cid];
      if (!c) continue;
      const d = Number(c?.win_threshold_delta || 0);
      if (!Number.isNaN(d)) delta += d;
    }
    return Math.max(1, 7 + delta);
  }

  function countUnicornsFor(pId: string): number {
    if (!state) return 0;
    const p = state.players.find(pp => pp.id === pId);
    if (!p) return 0;
    let total = 0;
    for (const cid of p.stable) {
      const c: any = state.cards[cid];
      if (!c) continue;
      const transformed = !!c?.transforms_unicorn;
      if (transformed) continue;
      const t = c.type as string;
      const isUni = t === 'baby_unicorn' || t === 'basic_unicorn' || t === 'magical_unicorn' || t === 'ultimate_unicorn' || t === 'unicorn';
      if (isUni) total += c?.counts_as_two ? 2 : 1;
    }
    return total;
  }

  // Reaction selection state
  const [reactorId, setReactorId] = useState<string>('');
  const [instantId, setInstantId] = useState<string>('');
  // Доп. состояния для новых реакций
  const [redirectInstantId, setRedirectInstantId] = useState<string>('');
  const [interceptInstantId, setInterceptInstantId] = useState<string>('');
  const [redirectPick, setRedirectPick] = useState<{ open: boolean; candidates: string[]; selected?: string } | null>(null);
  const [interceptReceiverId, setInterceptReceiverId] = useState<string>('');
  // Hypnorog: выбор карты для сброса
  const [hypnoDiscardId, setHypnoDiscardId] = useState<string>('');
  // Дополнительные инстанты реакций
  const [rewindInstantId, setRewindInstantId] = useState<string>('');
  const [shieldInstantId, setShieldInstantId] = useState<string>('');
  // Таймер окна реакций
  const [pendingCountdownMs, setPendingCountdownMs] = useState<number>(0);

  // Обновление таймера каждую 0.25с, если есть pending с expiresAt
  React.useEffect(() => {
    let id: any;
    const tick = () => {
      try {
        const exp = Number((pending && (pending as any).expiresAt) || 0);
        if (exp > 0) {
          const ms = Math.max(0, exp - Date.now());
          setPendingCountdownMs(ms);
        } else {
          setPendingCountdownMs(0);
        }
      } catch {
        setPendingCountdownMs(0);
      }
    };
    tick();
    if (pending && (pending as any).expiresAt) {
      id = setInterval(tick, 250);
    }
    return () => { if (id) clearInterval(id); };
  }, [pending]);

  async function reactNeighWithSelection() {
    if (!gameId) return;
    setError('');
    try {
      const body: any = {};
      if (reactorId) body.byPlayerId = reactorId;
      if (instantId) body.instantCardId = instantId;
      const res = await api.post(`/game/${gameId}/react/neigh`, body);
      setState(res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Реакция не сработала');
    }
  }

  // Super Neigh — усиленная отмена
  async function reactSuperNeigh() {
    if (!gameId) return;
    setError('');
    try {
      const body: any = {};
      if (reactorId) body.byPlayerId = reactorId;
      if (instantId) body.instantCardId = instantId; // используем выбранный в блоке Neigh
      const res = await api.post(`/game/${gameId}/react/super_neigh`, body);
      setState(res.data?.state || state);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Super Neigh: реакция не сработала');
    }
  }

  // Rewind — ответ на супер-отмену/продление окна
  async function reactRewind() {
    if (!gameId) return;
    setError('');
    try {
      const body: any = {};
      if (reactorId) body.byPlayerId = reactorId;
      if (rewindInstantId) body.instantCardId = rewindInstantId;
      const res = await api.post(`/game/${gameId}/react/rewind`, body);
      setState(res.data?.state || state);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Rewind: реакция не сработала');
    }
  }

  // Shield — актёр защищает свою карту от отмен
  async function reactShield() {
    if (!gameId || !pending) return;
    setError('');
    try {
      const body: any = { byPlayerId: String(pending.actorId || '') };
      if (shieldInstantId) body.instantCardId = shieldInstantId;
      const res = await api.post(`/game/${gameId}/react/shield`, body);
      setState(res.data?.state || state);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Shield: реакция не сработала');
    }
  }

  // Реакция: Redirect (перенаправление цели уничтожения)
  async function openRedirectPick() {
    if (!gameId || !pending) return;
    setError('');
    try {
      const r = await api.get(`/game/${gameId}/targetOptions`, { params: { cardId: pending.cardId, kind: 'destroy' } });
      const candidates = (r.data?.targets as string[]) || [];
      if (!candidates.length) { setError('Нет доступных новых целей для перенаправления'); return; }
      setRedirectPick({ open: true, candidates });
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Не удалось получить цели для перенаправления');
    }
  }

  async function confirmRedirect() {
    if (!gameId || !pending || !reactorId || !redirectInstantId || !redirectPick?.selected) { setError('Выберите реактора, инстант и новую цель'); return; }
    setError('');
    try {
      const body = { byPlayerId: reactorId, instantCardId: redirectInstantId, toTargetId: redirectPick.selected } as any;
      const res = await api.post(`/game/${gameId}/react/redirect`, body);
      setState(res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
      setRedirectPick(null);
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Перенаправление не удалось');
    }
  }

  // Реакция: Intercept Steal (перехват кражи)
  async function reactIntercept() {
    if (!gameId || !pending || !reactorId || !interceptInstantId) { setError('Выберите реактора и инстант'); return; }
    const receiverId = interceptReceiverId || reactorId;
    setError('');
    try {
      const body = { byPlayerId: reactorId, instantCardId: interceptInstantId, receiverPlayerId: receiverId } as any;
      const res = await api.post(`/game/${gameId}/react/intercept_steal`, body);
      setState(res.data);
      try { const lr = await api.get(`/game/${gameId}/logs`); setLogs(lr.data); } catch {}
    } catch (e: any) {
      setError(e?.response?.data?.message || e?.message || 'Перехват не удался');
    }
  }

  return (
    <AdminShell
      subtitle="Отладочная панель · розыгрыш карт, реакции и журнал"
      userName="Тестировщик"
    >
      <Box>
      <Stack direction="row" spacing={2} sx={{ mb: 2 }} alignItems="center" flexWrap="wrap">
        <Button variant="contained" color="secondary" onClick={createGame}>Создать игру</Button>
        <TextField size="small" label="seedTop (через запятую)" value={seedTop} onChange={e => setSeedTop(e.target.value)} sx={{ minWidth: 320 }} />
        <TextField size="small" type="number" inputProps={{ min: 2, max: 12 }} label="Игроков (2-12)" value={playerCount}
          onChange={e => setPlayerCount(Math.max(2, Math.min(12, Number(e.target.value) || 2)))} sx={{ width: 160 }} />
        {/* Join existing */}
        <TextField size="small" label="ID игры" value={gameIdInput} onChange={e => setGameIdInput(e.target.value)} sx={{ width: 200 }} />
        <Button variant="contained" onClick={() => joinExisting()} disabled={!gameIdInput.trim()}>Подключиться</Button>
        {state && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel id="viewer-select">Я —</InputLabel>
            <Select labelId="viewer-select" label="Я —" value={viewerId} onChange={(e) => setViewerId(String(e.target.value))}>
              {state.players.map(p => (
                <MenuItem key={p.id} value={p.id}>{p.id}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Легенда чипов эффектов */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="caption" color="text.secondary">Легенда:</Typography>
          <Tooltip title="Обязательное действие" arrow>
            <Chip size="small" label="обязательное" color="warning" variant="filled" sx={{ height: 20 }} />
          </Tooltip>
          <Tooltip title="Действие можно пропустить" arrow>
            <Chip size="small" label="по желанию" color="success" variant="outlined" sx={{ height: 20 }} />
          </Tooltip>
        </Stack>

      {/* Dialog: pick targets (destroy/steal); поддержка выбора игрока-получателя при необходимости */}
      {targetPick?.open && state && (
        <Dialog open onClose={() => setTargetPick(null)} maxWidth="sm" fullWidth>
          <DialogTitle>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap' }}>
              <Typography component="span" variant="subtitle1">
                {(() => {
                  const label = targetPick.kind === 'steal'
                    ? 'Украсть'
                    : targetPick.kind === 'destroy'
                    ? 'Уничтожить'
                    : targetPick.kind === 'discard'
                    ? 'Сброс (стоимость)'
                    : targetPick.kind === 'sacrifice'
                    ? 'Пожертвовать (стоимость)'
                    : targetPick.kind === 'players'
                    ? 'Выбор игрока'
                    : targetPick.kind === 'downgrade'
                    ? 'Понижение — выбор игрока'
                    : 'Выбор целей';
                  return `Выбор целей — ${label}`;
                })()}
              </Typography>
              {state?.cards && targetPick?.cardId && isActionOptional(state.cards[targetPick.cardId], targetPick.kind) && (
                <Chip size="small" label="Действие по желанию" color="success" variant="outlined" />
              )}
            </Stack>
          </DialogTitle>
          <DialogContent dividers>
            {state?.cards && targetPick?.cardId && isActionOptional(state.cards[targetPick.cardId], targetPick.kind) && (
              <Typography variant="body2" color="success.main" sx={{ mb: 1 }}>
                Это действие опционально — вы можете закрыть окно, чтобы пропустить.
              </Typography>
            )}
            <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 1 }}>
              <Typography variant="body2">
                {(['discard','sacrifice'].includes(targetPick.kind)) ? 'Оплата стоимости — выбрать: ' : 'Нужно выбрать: '} {targetPick.qty}
              </Typography>
              <Typography variant="body2" color={(targetPick.selected?.length || 0) === targetPick.qty ? 'success.main' : 'text.primary'}>
                Выбрано: {targetPick.selected?.length || 0}
              </Typography>
            </Stack>
            {(() => {
              // Reverse index: cardId -> ownerId
              const cardOwner: Record<string, string> = {};
              for (const pl of state.players) {
                for (const cid of [...pl.stable, ...pl.hand, ...pl.discard, ...pl.nursery, ...pl.field]) {
                  cardOwner[cid] = pl.id;
                }
              }
              // Group candidates by owner
              const owners: Record<string, string[]> = {};
              const unknown: string[] = [];
              for (const cid of targetPick.candidates) {
                const owner = cardOwner[cid];
                if (owner) {
                  owners[owner] = owners[owner] || []; owners[owner].push(cid);
                } else unknown.push(cid);
              }
              const groups = [...Object.entries(owners), ...(unknown.length ? [["Прочее", unknown] as any] : [])];
              return (
                <Stack spacing={2}>
                  {groups.map(([pid, cids]) => (
                    <Box key={pid}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="subtitle2">{typeof pid === 'string' ? pid : 'Прочее'}</Typography>
                        <Chip size="small" label={`карт: ${cids.length}`} variant="outlined" />
                      </Stack>
                      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                        {cids.map((cid: string) => {
                          const selected = targetPick.selected.includes(cid);
                          const atCap = (targetPick.selected.length >= targetPick.qty) && !selected && targetPick.qty > 1;
                          return (
                            <Button key={cid}
                              variant={selected ? 'contained' : 'outlined'}
                              color={selected ? 'success' : 'primary'}
                              disabled={atCap}
                              onClick={() => {
                                setTargetPick(tp => {
                                  if (!tp) return tp;
                                  const sel = new Set(tp.selected);
                                  if (sel.has(cid)) {
                                    sel.delete(cid);
                                    return { ...tp, selected: Array.from(sel) };
                                  }
                                  if (tp.qty === 1) {
                                    return { ...tp, selected: [cid] };
                                  }
                                  if (sel.size >= tp.qty) {
                                    // не добавляем сверх лимита
                                    return tp;
                                  }
                                  sel.add(cid);
                                  return { ...tp, selected: Array.from(sel) };
                                });
                              }}
                            >{state.cards[cid]?.name || cid}</Button>
                          );
                        })}
                      </Stack>
                    </Box>
                  ))}
                </Stack>
              );
            })()}
            {targetPick.playerCandidates && targetPick.playerCandidates.length > 0 && (
              <Stack spacing={1} sx={{ mt: 2 }}>
                <Typography variant="body2">
                  Выберите игрока-цель (получателя){targetPick.selectedPlayerId ? ` — выбрано: ${targetPick.selectedPlayerId}` : ''}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                  {targetPick.playerCandidates.map(pid => (
                    <Button key={pid}
                      size="small"
                      variant={targetPick.selectedPlayerId === pid ? 'contained' : 'outlined'}
                      onClick={() => setTargetPick(tp => tp ? { ...tp, selectedPlayerId: pid } : tp)}
                    >{pid}</Button>
                  ))}
                </Stack>
              </Stack>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setTargetPick(null)}>Отмена</Button>
            <Button onClick={confirmTargetedPlay} variant="contained" disabled={((targetPick.selected?.length || 0) < targetPick.qty) && !targetPick.selectedPlayerId}>
              {(['discard','sacrifice'].includes(targetPick.kind)) ? 'Оплатить и сыграть' : (targetPick.kind === 'players' || targetPick.kind === 'downgrade' ? 'Выбрать игрока' : 'Сыграть')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
        <Button variant="contained" onClick={refresh} disabled={!gameId}>Обновить</Button>
        <Button variant="contained" color="secondary" onClick={() => draw(1, 'effect')} disabled={!gameId || !!state?.winnerId || state?.turn.phase !== 'begin_turn'}>Взять как эффект</Button>
        <Button variant="contained" color="secondary" onClick={() => draw(1, 'official')} disabled={!gameId || !!state?.winnerId || state?.turn.phase !== 'begin_turn'}>Взять карту</Button>
        <Button variant="contained" onClick={turnStart} disabled={!gameId || !!state?.winnerId || state?.turn.phase !== 'begin_turn'}>Эффекты начала хода</Button>
        {(() => {
          const limit = me ? calcHandLimitFor(me.id) : 7;
          const overLimit = me ? me.hand.length > limit : false;
          const need = me ? Math.max(0, me.hand.length - limit) : 0;
          return (
            <>
              {overLimit && (
                <Alert severity="warning" sx={{ my: 1 }}>
                  Превышен лимит руки: {me!.hand.length}/{limit}. Сбросьте {need} карт(у) перед окончанием хода. Кнопки "Сброс" под картами активны.
                </Alert>
              )}
              <Tooltip title={state?.winnerId ? 'Партия окончена — победитель определён' : overLimit ? `Нельзя закончить ход: превышен лимит руки (${limit})` : ''} arrow>
                <span>
                  <Button variant="contained" color="primary" onClick={endTurn} disabled={!gameId || !!state?.winnerId || overLimit}>Закончить ход</Button>
                </span>
              </Tooltip>
            </>
          );
        })()}
        <Tooltip title="Вместо розыгрыша взять 1 карту (тратит AP)" arrow>
          <span>
            <Button variant="contained" color="secondary" onClick={passDraw} disabled={!gameId || !!state?.winnerId || state?.turn.phase !== 'action' || (me?.action_points || 0) <= 0}>Пас + взять карту</Button>
          </span>
        </Tooltip>
        <Tooltip title="Разрешить ожидающий розыгрыш (если не отменён)" arrow>
          <span>
            <Button variant="contained" onClick={resolvePending} disabled={!gameId}>Resolve Pending</Button>
          </span>
        </Tooltip>
        {/* Блок реакции Neigh/Super Neigh с выбором */}
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2">Реактор:</Typography>
          <Stack direction="row" spacing={1}>
            {state?.players.filter(p => p.id !== state.turn.currentPlayerId).map(p => (
              <Button key={p.id} size="small" variant={reactorId === p.id ? 'contained' : 'outlined'} onClick={() => { setReactorId(p.id); setInstantId(''); }}>
                {p.id}
              </Button>
            ))}
          </Stack>
          {reactorId && (
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="body2">Инстант:</Typography>
              {(() => {
                const rp = state!.players.find(pp => pp.id === reactorId)!;
                const instIds = rp.hand.filter(id => {
                  const c: any = state!.cards[id];
                  return c && c.type === 'instant' && (c.instant_subtype === 'neigh' || c.instant_subtype === 'super_neigh');
                });
                return instIds.length ? instIds.map(id => (
                  <Button key={id} size="small" variant={instantId === id ? 'contained' : 'outlined'} onClick={() => setInstantId(id)}>
                    {state!.cards[id]?.name || id}
                  </Button>
                )) : <Typography variant="caption" color="text.secondary">— нет инстантов —</Typography>;
              })()}
              <Tooltip title="Neigh/Super Neigh: отменить pending; если не выбран инстант/реактор — авто выбор" arrow>
                <span>
                  <Button size="small" variant="contained" onClick={reactNeighWithSelection} disabled={!gameId}>Neigh</Button>
                </span>
              </Tooltip>
              <Tooltip title="Super Neigh: сильная отмена (если в руке есть Super Neigh)" arrow>
                <span>
                  <Button size="small" color="warning" variant="contained" onClick={reactSuperNeigh} disabled={!gameId}>Super Neigh</Button>
                </span>
              </Tooltip>
            </Stack>
          )}
        </Stack>
        <FormControlLabel control={<Switch checked={autoPoll} onChange={(e) => setAutoPoll(e.target.checked)} />} label="Автообновление" />
      </Stack>

      {state && detailsId && (
        <Dialog open onClose={() => setDetailsId(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Карточка</DialogTitle>
          <DialogContent dividers>
            {(() => {
              const c = state.cards[detailsId!];
              if (!c) return <Typography>Нет данных</Typography>;
              return (
                <Stack spacing={2}>
                  <CardTemplate
                    name={c.name}
                    type={c.type}
                    description={c.description || '—'}
                    effects={c.effects}
                    imageUrl={imageUrlFor(c)}
                    width={320}
                  />
                  {c.play_requirements && (
                    <>
                      <Typography variant="subtitle2" sx={{ mt: 1 }}>Требования к розыгрышу</Typography>
                      <pre style={{ margin: 0 }}>{JSON.stringify(c.play_requirements, null, 2)}</pre>
                    </>
                  )}
                  {c.effects && c.effects.length > 0 && (
                    <>
                      <Typography variant="subtitle2" sx={{ mt: 1 }}>Эффекты</Typography>
                      <pre style={{ margin: 0 }}>{JSON.stringify(c.effects, null, 2)}</pre>
                    </>
                  )}
                </Stack>
              );
            })()}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDetailsId(null)}>Закрыть</Button>
          </DialogActions>
        </Dialog>
      )}

      {state?.winnerId && (
        <Alert severity="success" sx={{ mb: 2 }}>
          🏆 Партия окончена. Победитель: {state.players.find(p => p.id === state.winnerId)?.id ?? state.winnerId}
        </Alert>
      )}

      {state && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
              <Typography variant="h6">Ходит: {state.turn.currentPlayerId}</Typography>
              <Chip label={`Фаза: ${state.turn.phase}`} color="info" variant="outlined" />
              <Tooltip title={socketError || (socketStatus.connected ? 'Соединение активно' : (socketStatus.attempts > 0 ? `Повторная попытка #${socketStatus.attempts}` : 'Офлайн'))}>
                <Chip label={`WS: ${socketStatus.connected ? 'online' : (socketStatus.attempts > 0 ? `retry #${socketStatus.attempts}` : 'offline')}`}
                      color={socketStatus.connected ? 'success' : 'default'}
                      variant={socketStatus.connected ? 'filled' : 'outlined'} />
              </Tooltip>
              {gameId && (
                <Tooltip title="Скопировать ссылку для присоединения">
                  <Button size="small" onClick={() => { const url = shareLink || `${window.location.origin}${window.location.pathname}?game=${gameId}`; navigator.clipboard.writeText(url); setShareLink(url); }}>
                    Копировать ссылку
                  </Button>
                </Tooltip>
              )}
              {me && (
                <>
                  <Chip label={`AP: ${me.action_points}`} color={me.action_points > 0 ? 'success' : 'default'} />
                  <Chip label={`Лимит руки: ${calcHandLimitFor(me.id)}`} variant="outlined" />
                  <Chip label={`Порог победы: ${calcWinThresholdFor(me.id)} (есть ${countUnicornsFor(me.id)})`} variant="outlined" />
                </>
              )}
              {'has_drawn' in (state.turn as any) && (
                <Chip label={`Добор сделан: ${((state.turn as any).has_drawn ? 'Да' : 'Нет')}`} variant="outlined" />
              )}
              {/* Shared piles */}
              <Chip label={`Колода: ${state.deck ? state.deck.length : 0}`}
                    variant="outlined" />
              <Chip label={`Сброс: ${typeof state.discard?.length === 'number' ? state.discard!.length : state.players.reduce((n, p) => n + (p.discard?.length || 0), 0)}`}
                    variant="outlined" />
              {/* Зону яслей на стол пока не рисуем — решено Аналитиком, только счётчик */}
              <Chip label={`Ясли: ${state.nursery?.length ?? 0}`} variant="outlined" />
              {state.winnerId && <Chip label="Партия окончена" color="success" />}
            </Stack>
          </Grid>
          {(() => {
            // Order players so that others go first in circular order starting after viewer, and viewer at bottom section separately
            const players = state.players;
            const vIdx = Math.max(0, players.findIndex(p => p.id === viewerId));
            const orderedOthers = players.filter(p => p.id !== viewerId);
            // rotate starting from next after viewerId
            const startIdx = (vIdx + 1) % players.length;
            const ring = [] as typeof players;
            for (let i = 0; i < players.length - 1; i++) {
              const idx = (startIdx + i) % players.length;
              const candidate = players[idx];
              if (candidate.id !== viewerId) ring.push(candidate);
            }

            return (
              <>
                {/* Others' stables section */}
                {ring.map(p => {
                  const isTurn = state.turn.currentPlayerId === p.id;
                  return (
                    <Grid key={p.id} item xs={12} sm={12} md={12} lg={12} xl={12}>
                      <Panel
                        title={<Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle1">{p.id}</Typography>
                          {isTurn && <Chip size="small" label="Ходит" color="info" />}
                        </Stack>}
                        right={<Chip size="small" label={`AP: ${p.action_points}`} color={p.action_points > 0 ? 'success' : 'default'} />}
                      >
                          <Typography variant="subtitle2" sx={{ mt: 1 }}>Стойло ({p.stable.length}):</Typography>
                          {(() => {
                            const ids = p.stable;
                            const upgrades = ids.filter(id => state.cards[id]?.type === 'upgrade');
                            const downgrades = ids.filter(id => state.cards[id]?.type === 'downgrade');
                            const unicornsRaw = ids.filter(id => {
                              const t = state.cards[id]?.type as any;
                              return t === 'baby_unicorn' || t === 'basic_unicorn' || t === 'magical_unicorn' || t === 'ultimate_unicorn' || t === 'unicorn';
                            });
                            const babies = unicornsRaw.filter(id => state.cards[id]?.type === 'baby_unicorn');
                            const others = unicornsRaw.filter(id => state.cards[id]?.type !== 'baby_unicorn');
                            const unicorns = [...babies, ...others];
                            return (
                              <Stack spacing={1} sx={{ pb: 1 }}>
                                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                                  {upgrades.map(id => (
                                    <Tooltip key={`up-${id}`} title={`${state.cards[id]?.name || id} — ${state.cards[id]?.type || '—'}`} arrow>
                                      <Box sx={{ mr: 1, cursor: 'pointer' }} onClick={() => setDetailsId(id)}>
                                        <CardTemplate name={state.cards[id]?.name || id} type={state.cards[id]?.type || '—'} description={state.cards[id]?.description || '—'} effects={state.cards[id]?.effects} imageUrl={imageUrlFor(state.cards[id])} width={220} hideExportButton />
                                      </Box>
                                    </Tooltip>
                                  ))}
                                  {upgrades.length === 0 && <Typography color="text.disabled" variant="caption">Бонусы: —</Typography>}
                                </Stack>
                                <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
                                  {downgrades.map(id => (
                                    <Tooltip key={`down-${id}`} title={`${state.cards[id]?.name || id} — ${state.cards[id]?.type || '—'}`} arrow>
                                      <Box sx={{ mr: 1, cursor: 'pointer' }} onClick={() => setDetailsId(id)}>
                                        <CardTemplate name={state.cards[id]?.name || id} type={state.cards[id]?.type || '—'} description={state.cards[id]?.description || '—'} effects={state.cards[id]?.effects} imageUrl={imageUrlFor(state.cards[id])} width={220} hideExportButton />
                                      </Box>
                                    </Tooltip>
                                  ))}
                                  {downgrades.length === 0 && <Typography color="text.disabled" variant="caption">Штрафы: —</Typography>}
                                </Stack>
                                <Stack direction="row" spacing={2} sx={{ overflowX: 'auto' }}>
                                  {unicorns.length === 0 && <Typography color="text.secondary">— единорогов нет —</Typography>}
                                  {unicorns.map(id => (
                                    <Tooltip key={`uni-${p.id}-${id}`} title={`${state.cards[id]?.name || id} — ${state.cards[id]?.type || '—'}`} arrow>
                                      <Box sx={{ mr: 1, cursor: 'pointer' }} onClick={() => setDetailsId(id)}>
                                        <CardTemplate name={state.cards[id]?.name || id} type={state.cards[id]?.type || '—'} description={state.cards[id]?.description || '—'} effects={state.cards[id]?.effects} imageUrl={imageUrlFor(state.cards[id])} width={220} hideExportButton />
                                      </Box>
                                    </Tooltip>
                                  ))}
                                </Stack>
                              </Stack>
                            );
                          })()}
                          <Typography variant="caption" color="text.secondary">Рука: {p.hand.length} карт(ы)</Typography>
                          {/* Per-player deck/discard hidden in shared deck mode */}
                      </Panel>
                    </Grid>
                  );
                })}

                {/* Viewer stable */}
                {(() => {
                  const p = state.players.find(pp => pp.id === viewerId) || state.players[0];
                  const isTurn = state.turn.currentPlayerId === p.id;
                  return (
                    <Grid key={`viewer-${p.id}`} item xs={12}>
                      <Panel
                        title={<Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle1">Моё стойло — {p.id}</Typography>
                          {isTurn && <Chip size="small" label="Мой ход" color="info" />}
                        </Stack>}
                        right={<Chip size="small" label={`AP: ${p.action_points}`} color={p.action_points > 0 ? 'success' : 'default'} />}
                      >
                          <Typography variant="subtitle2" sx={{ mt: 1 }}>Стойло ({p.stable.length}):</Typography>
                          {(() => {
                            const ids = p.stable;
                            const upgrades = ids.filter(id => state.cards[id]?.type === 'upgrade');
                            const downgrades = ids.filter(id => state.cards[id]?.type === 'downgrade');
                            const unicornsRaw = ids.filter(id => {
                              const t = state.cards[id]?.type as any;
                              return t === 'baby_unicorn' || t === 'basic_unicorn' || t === 'magical_unicorn' || t === 'ultimate_unicorn' || t === 'unicorn';
                            });
                            const babies = unicornsRaw.filter(id => state.cards[id]?.type === 'baby_unicorn');
                            const others = unicornsRaw.filter(id => state.cards[id]?.type !== 'baby_unicorn');
                            const unicorns = [...babies, ...others];
                            return (
                              <Stack spacing={1} sx={{ pb: 1 }}>
                                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                  {upgrades.map(id => (
                                    <Box key={`up-${id}`} sx={{ mr: 1 }} onClick={() => setDetailsId(id)}>
                                      <CardTemplate name={state.cards[id]?.name || id} type={state.cards[id]?.type || '—'} description={state.cards[id]?.description || '—'} effects={state.cards[id]?.effects} imageUrl={state.cards[id]?.image} width={220} hideExportButton />
                                    </Box>
                                  ))}
                                  {upgrades.length === 0 && <Typography color="text.disabled" variant="caption">Бонусы: —</Typography>}
                                </Stack>
                                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                                  {downgrades.map(id => (
                                    <Box key={`down-${id}`} sx={{ mr: 1 }} onClick={() => setDetailsId(id)}>
                                      <CardTemplate name={state.cards[id]?.name || id} type={state.cards[id]?.type || '—'} description={state.cards[id]?.description || '—'} effects={state.cards[id]?.effects} imageUrl={state.cards[id]?.image} width={220} hideExportButton />
                                    </Box>
                                  ))}
                                  {downgrades.length === 0 && <Typography color="text.disabled" variant="caption">Штрафы: —</Typography>}
                                </Stack>
                                <Stack direction="row" spacing={1} sx={{ overflowX: 'auto' }}>
                                  {unicorns.length === 0 && <Typography color="text.secondary">— единорогов нет —</Typography>}
                                  {unicorns.map(id => (
                                    <Stack key={`uni-self-${id}`} sx={{ mr: 1 }}>
                                      <Box onClick={() => setDetailsId(id)}>
                                        <CardTemplate name={state.cards[id]?.name || id} type={state.cards[id]?.type || '—'} description={state.cards[id]?.description || '—'} effects={state.cards[id]?.effects} imageUrl={state.cards[id]?.image} width={220} hideExportButton />
                                      </Box>
                                      {(() => {
                                        // Нижний футер с кнопками on_turn_start
                                        const card: any = state.cards[id];
                                        const effs = (card?.effects || []) as any[];
                                        const btns: JSX.Element[] = [];
                                        const isMyBegin = state.turn.currentPlayerId === p.id && state.turn.phase === 'begin_turn';
                                        effs.forEach((ef: any, idx: number) => {
                                          if (ef?.trigger === 'on_turn_start' && !!ef?.optional) {
                                            const opt = !!ef?.optional;
                                            const text = labelForStartEffect(ef) + (opt ? ' (опц.)' : '');
                                            btns.push(
                                              <Button key={`ots-${id}-${idx}`} size="small"
                                                onClick={() => activateTurnStart(id, idx)}
                                                variant="contained"
                                                disabled={!isMyBegin}
                                              >
                                                ▶ {text}
                                              </Button>
                                            );
                                          }
                                        });
                                        if (!btns.length) return null;
                                        const bg = cardTypeColor(card?.type);
                                        return (
                                          <Box sx={{ mt: 0.5, px: 1, py: 0.5, borderRadius: 1, bgcolor: bg, color: '#fff' }}>
                                            <Stack direction="row" spacing={1}>{btns}</Stack>
                                          </Box>
                                        );
                                      })()}
                                    </Stack>
                                  ))}
                                </Stack>
                              </Stack>
                            );
                          })()}
                        </Panel>
                    </Grid>
                  );
                })()}

                {/* Viewer hand at bottom with descriptions */}
                {(() => {
                  const p = state.players.find(pp => pp.id === viewerId) || state.players[0];
                  return (
                    <Grid key={`viewer-hand-${p.id}`} item xs={12}>
                      <Panel title={<>
                        Моя рука ({p.hand.length})
                      </>}>
                        <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ mt: 1 }}>
                          {p.hand.length === 0 && <Typography color="text.secondary">— пусто —</Typography>}
                          {p.hand.map(id => {
                            const card = state.cards[id];
                            const disabledPhase = state.turn.phase !== 'action' || state.turn.currentPlayerId !== p.id;
                            const disabledAp = (p.action_points || 0) <= 0;
                            const costCheck = canPayCosts(card, p, state);
                            const disabledCost = !costCheck.ok;
                            const disabled = disabledPhase || disabledAp || disabledCost;
                            const disabledReason = disabledPhase ? 'Недоступно: не ваш ход/фаза' : disabledAp ? 'Недоступно: нет AP' : disabledCost ? costCheck.reason || 'Нельзя оплатить стоимость' : '';
                            return (
                              <Stack key={id} spacing={0.75} alignItems="flex-start" sx={{ minWidth: 240 }}>
                                <Box onClick={() => setDetailsId(id)}>
                                  <CardTemplate name={card?.name || id} type={card?.type || '—'} description={card?.description || '—'} effects={card?.effects} imageUrl={imageUrlFor(card)} width={220} hideExportButton />
                                </Box>
                                <Stack direction="row" spacing={1}>
                                  <Tooltip title={disabled ? disabledReason : 'Сыграть карту'} arrow>
                                    <span>
                                      <Button size="small" variant="contained" onClick={() => play(id)} disabled={disabled}>Сыграть</Button>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title={disabled ? disabledReason : 'Сыграть с выбором цели (destroy)'} arrow>
                                    <span>
                                      <Button size="small" color="secondary" onClick={() => playTargeted(id)} disabled={disabled}>Таргет</Button>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title={disabled ? disabledReason : 'Сыграть с окном реакций'} arrow>
                                    <span>
                                      <Button size="small" onClick={() => playWithWindow(id)} disabled={disabled}>Окно реакций</Button>
                                    </span>
                                  </Tooltip>
                                  <Tooltip title={state.turn.phase === 'action' || state.turn.phase === 'end_turn' ? 'Сбросить карту' : 'Сброс недоступен в этой фазе'} arrow>
                                    <span>
                                      <Button size="small" color="warning" onClick={() => discard(id)} disabled={!(state.turn.phase === 'action' || state.turn.phase === 'end_turn')}>Сброс</Button>
                                    </span>
                                  </Tooltip>
                                </Stack>
                              </Stack>
                            );
                          })}
                        </Stack>
                      </Panel>
                    </Grid>
                  );
                })()}
              </>
            );
          })()}
        </Grid>
      )}

      {/* Logs Panel */}
      {gameId && (
        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12}>
            <Panel title={<Typography variant="subtitle1">Логи действий</Typography>}>
              <Stack spacing={0.5} sx={{ maxHeight: 220, overflow: 'auto' }}>
                  {logs.length === 0 && <Typography color="text.secondary">— пусто —</Typography>}
                  {logs.map((l, idx) => {
                    const time = new Date(l.t).toLocaleTimeString();
                    if (l.type === 'react') {
                      const kind = (l as any).details?.kind || 'react';
                      const canceled = (l as any).details?.canceled;
                      const instName = (l as any).details?.instant_name || (l as any).details?.instantCardName;
                      const instId = (l as any).details?.instantCardId;
                      if (kind === 'hypnorog' || kind === 'hypnorog:auto_cancel') {
                        const dId = (l as any).details?.discardCardId;
                        const src = (l as any).details?.source;
                        return (
                          <Typography key={idx} variant="body2">
                            [{time}] {l.playerId}: Hypnorog — сбросил {(dId && state?.cards[dId]?.name) || dId || 'карту'}{src ? `; источник: ${state?.cards[src]?.name || src}` : ''}{kind === 'hypnorog:auto_cancel' ? ' (авто)' : ''}
                          </Typography>
                        );
                      }
                      return (
                        <Typography key={idx} variant="body2">
                          [{time}] {l.playerId}: {kind}
                          {instName ? ` — ${instName}` : instId ? ` — ${instId}` : ''}
                          {canceled ? ` — отмена ${canceled}` : ''}
                        </Typography>
                      );
                    }
                    return (
                      <Typography key={idx} variant="body2">
                        [{time}] {l.playerId}: {l.type}
                        {l.details?.cardId ? ` — ${(l.details as any).name || l.details.cardId}` : ''}
                        {l.type === 'draw' && l.details?.mode ? ` (${l.details.mode}${l.details?.qty ? ` x${l.details.qty}` : ''})` : ''}
                      </Typography>
                    );
                  })}
              </Stack>
            </Panel>
          </Grid>
        </Grid>
      )}

      <Snackbar open={!!error} autoHideDuration={4000} onClose={() => setError('')} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setError('')} severity="error" variant="filled" sx={{ width: '100%' }}>
          {error}
        </Alert>
      </Snackbar>

      {/* Pending modal (play or turn_start_effect) with ability to react */}
      {pending && state && (
        <Dialog open onClose={() => setPending(null)} maxWidth="sm" fullWidth>
          <DialogTitle>
            {pending.kind === 'turn_start_effect' ? 'Ожидает: стартовый эффект единорога' : 'Ожидает: розыгрыш карты'}
          </DialogTitle>
          <DialogContent dividers>
            {(() => {
              const isTurnStart = pending.kind === 'turn_start_effect';
              const cid = isTurnStart ? (pending.sourceCardId as string) : (pending.cardId as string);
              const c = state.cards[cid];
              return (
                <Stack spacing={2}>
                  {/* Статусы окна и таймер */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" color="info" label={`Осталось: ${(pendingCountdownMs/1000).toFixed(1)}с`} />
                    {pending?.uncounterable && (
                      <Chip size="small" color="success" variant="outlined" label="Защищено щитом (uncounterable)" />
                    )}
                    {(pending?.cancelLevel || 0) > 0 && (
                      <Chip size="small" color="warning" variant="outlined" label={`Отменено уровня: ${pending.cancelLevel}`} />
                    )}
                  </Stack>
                  <Typography>Игрок: {pending.actorId}</Typography>
                  <CardTemplate name={c?.name || cid} type={c?.type || '—'} description={c?.description || '—'} effects={c?.effects} imageUrl={imageUrlFor(c)} width={320} />
                  {!isTurnStart && (
                    <Typography variant="body2" color="text.secondary">Вы можете отменить розыгрыш картой Neigh/Super Neigh</Typography>
                  )}
                  {/* Reactor/instant selection reused */}
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="body2">Реактор:</Typography>
                    <Stack direction="row" spacing={1}>
                      {state.players.filter(p => p.id !== state.turn.currentPlayerId).map(p => (
                        <Button key={p.id} size="small" variant={reactorId === p.id ? 'contained' : 'outlined'} onClick={() => { setReactorId(p.id); setInstantId(''); setRedirectInstantId(''); setInterceptInstantId(''); setHypnoDiscardId(''); }}>
                          {p.id}
                        </Button>
                      ))}
                    </Stack>
                  </Stack>
                  {reactorId && (
                    <Stack spacing={1}>
                      {/* Neigh picker (для pending.kind === 'play') */}
                      {!isTurnStart && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">Neigh:</Typography>
                          {(() => {
                            const rp = state!.players.find(pp => pp.id === reactorId)!;
                            const instIds = rp.hand.filter(id => {
                              const cc: any = state!.cards[id];
                              return cc && cc.type === 'instant' && (cc.instant_subtype === 'neigh' || cc.instant_subtype === 'super_neigh');
                            });
                            return instIds.length ? instIds.map(id => (
                              <Button key={id} size="small" variant={instantId === id ? 'contained' : 'outlined'} onClick={() => setInstantId(id)}>
                                {state!.cards[id]?.name || id}
                              </Button>
                            )) : <Typography variant="caption" color="text.secondary">— нет Neigh —</Typography>;
                          })()}
                          <Button size="small" variant="contained" onClick={reactNeighWithSelection} disabled={!gameId}>Neigh</Button>
                          <Button size="small" color="warning" variant="contained" onClick={reactSuperNeigh} disabled={!gameId}>Super Neigh</Button>
                        </Stack>
                      )}
                      {/* Hypnorog picker (для обоих типов pending) */}
                      <Stack spacing={1}>
                        <Typography variant="body2">Hypnorog: выберите карту в руке реактора для сброса</Typography>
                        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
                          {(() => {
                            const rp = state!.players.find(pp => pp.id === reactorId)!;
                            return rp.hand.length ? rp.hand.map(id => (
                              <Button key={id} size="small" variant={hypnoDiscardId === id ? 'contained' : 'outlined'} onClick={() => setHypnoDiscardId(id)}>
                                {state!.cards[id]?.name || id}
                              </Button>
                            )) : <Typography variant="caption" color="text.secondary">— рука пуста —</Typography>;
                          })()}
                        </Stack>
                        <Stack direction="row" spacing={1}>
                          {!isTurnStart && (
                            <Button size="small" variant="contained" onClick={reactNeighWithSelection} disabled={!gameId}>Neigh</Button>
                          )}
                          <Button size="small" color="warning" variant="contained" onClick={reactHypnorog} disabled={!gameId || !hypnoDiscardId}>Hypnorog</Button>
                        </Stack>
                      </Stack>
                      {/* Redirect picker */}
                      {!isTurnStart && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">Redirect (уничтожение):</Typography>
                          {(() => {
                            const rp = state!.players.find(pp => pp.id === reactorId)!;
                            const instIds = rp.hand.filter(id => {
                              const cc: any = state!.cards[id];
                              return cc && cc.type === 'instant' && cc.instant_subtype === 'redirect';
                            });
                            return instIds.length ? instIds.map(id => (
                              <Button key={id} size="small" variant={redirectInstantId === id ? 'contained' : 'outlined'} onClick={() => setRedirectInstantId(id)}>
                                {state!.cards[id]?.name || id}
                              </Button>
                            )) : <Typography variant="caption" color="text.secondary">— нет Redirect —</Typography>;
                          })()}
                          <Button size="small" onClick={openRedirectPick} disabled={!redirectInstantId}>Выбрать цель…</Button>
                        </Stack>
                      )}
                      {/* Intercept picker */}
                      {!isTurnStart && (
                        <Stack spacing={1}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2">Intercept (кража) — получатель:</Typography>
                            <Stack direction="row" spacing={1}>
                              {state.players.map(p => (
                                <Button key={p.id} size="small" variant={(interceptReceiverId || reactorId) === p.id ? 'contained' : 'outlined'} onClick={() => setInterceptReceiverId(p.id)}>
                                  {p.id}
                                </Button>
                              ))}
                            </Stack>
                          </Stack>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography variant="body2">Инстант Intercept:</Typography>
                            {(() => {
                              const rp = state!.players.find(pp => pp.id === reactorId)!;
                              const instIds = rp.hand.filter(id => {
                                const cc: any = state!.cards[id];
                                return cc && cc.type === 'instant' && cc.instant_subtype === 'intercept';
                              });
                              return instIds.length ? instIds.map(id => (
                                <Button key={id} size="small" variant={interceptInstantId === id ? 'contained' : 'outlined'} onClick={() => setInterceptInstantId(id)}>
                                  {state!.cards[id]?.name || id}
                                </Button>
                              )) : <Typography variant="caption" color="text.secondary">— нет Intercept —</Typography>;
                            })()}
                            <Button size="small" onClick={reactIntercept} disabled={!interceptInstantId}>Перехватить</Button>
                          </Stack>
                        </Stack>
                      )}
                      {/* Rewind picker */}
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2">Rewind:</Typography>
                        {reactorId ? (
                          (() => {
                            const rp = state!.players.find(pp => pp.id === reactorId)!;
                            const instIds = rp.hand.filter(id => {
                              const cc: any = state!.cards[id];
                              return cc && cc.type === 'instant' && cc.instant_subtype === 'rewind';
                            });
                            return instIds.length ? instIds.map(id => (
                              <Button key={id} size="small" variant={rewindInstantId === id ? 'contained' : 'outlined'} onClick={() => setRewindInstantId(id)}>
                                {state!.cards[id]?.name || id}
                              </Button>
                            )) : <Typography variant="caption" color="text.secondary">— нет Rewind —</Typography>;
                          })()
                        ) : <Typography variant="caption" color="text.secondary">— выберите реактора —</Typography>}
                        <Button size="small" onClick={reactRewind} disabled={!gameId}>Rewind</Button>
                      </Stack>

                      {/* Shield picker (только актёр) */}
                      {pending?.actorId && pending.actorId === viewerId && (
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="body2">Shield (актёр):</Typography>
                          {(() => {
                            const actor = state!.players.find(pp => pp.id === pending.actorId)!;
                            const instIds = actor.hand.filter(id => {
                              const cc: any = state!.cards[id];
                              return cc && cc.type === 'instant' && cc.instant_subtype === 'shield';
                            });
                            return instIds.length ? instIds.map(id => (
                              <Button key={id} size="small" variant={shieldInstantId === id ? 'contained' : 'outlined'} onClick={() => setShieldInstantId(id)}>
                                {state!.cards[id]?.name || id}
                              </Button>
                            )) : <Typography variant="caption" color="text.secondary">— нет Shield —</Typography>;
                          })()}
                          <Button size="small" color="success" variant="contained" onClick={reactShield} disabled={!gameId}>Shield</Button>
                        </Stack>
                      )}
                    </Stack>
                  )}
                </Stack>
              );
            })()}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setPending(null)}>Закрыть</Button>
            {!pending || pending.kind !== 'turn_start_effect' ? (
              <Button variant="contained" onClick={reactNeighWithSelection} disabled={!gameId}>Neigh</Button>
            ) : null}
            {/* Доп. быстрые реакции */}
            {!pending || pending.kind !== 'turn_start_effect' ? (
              <Button color="warning" variant="contained" onClick={reactSuperNeigh} disabled={!gameId}>Super Neigh</Button>
            ) : null}
            {!pending || pending.kind !== 'turn_start_effect' ? (
              <Button variant="outlined" onClick={reactRewind} disabled={!gameId}>Rewind</Button>
            ) : null}
            {pending?.actorId && pending.actorId === viewerId ? (
              <Button color="success" variant="contained" onClick={reactShield} disabled={!gameId}>Shield</Button>
            ) : null}
            {/* Для play pending оставляем ручное разрешение, для turn_start_effect — авто по таймеру */}
            {pending?.kind === 'play' && pending?.actorId === viewerId && (
              <Button color="success" onClick={resolvePending} disabled={!gameId}>Разрешить</Button>
            )}
          </DialogActions>
        </Dialog>
      )}
      {/* Dialog: выбор новой цели для Redirect */}
      {redirectPick?.open && state && (
        <Dialog open onClose={() => setRedirectPick(null)} maxWidth="sm" fullWidth>
          <DialogTitle>Перенаправление цели уничтожения</DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" sx={{ mb: 1 }}>Выберите новую цель:</Typography>
            <Stack spacing={1}>
              {redirectPick.candidates.map(cid => (
                <Button key={cid}
                  variant={redirectPick.selected === cid ? 'contained' : 'outlined'}
                  onClick={() => setRedirectPick(rp => rp ? { ...rp, selected: cid } : rp)}
                >{state.cards[cid]?.name || cid}</Button>
              ))}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRedirectPick(null)}>Отмена</Button>
            <Button onClick={confirmRedirect} variant="contained" disabled={!redirectPick.selected || !redirectInstantId || !reactorId}>Применить</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
    </AdminShell>
  );
}
