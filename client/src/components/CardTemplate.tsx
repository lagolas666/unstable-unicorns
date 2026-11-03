import React, { useMemo, useRef } from 'react';
import { Box, Button, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { toPng } from 'html-to-image';
import { api } from '../api';
import { CARD_TYPE_COLORS } from '../constants/cardTypeColors';

export type CardTemplateProps = {
  name: string;
  type: string;
  description?: string;
  effects?: any[];
  imageUrl?: string;
  width?: number; // px, default 300
  onExportError?: (err: unknown) => void;
  hideExportButton?: boolean;
};

type TypeStyle = { header: string; frame: string };

/** Цвета типов берём из общего справочника, рамка совпадает с шапкой. */
const TYPE_STYLES: Record<string, TypeStyle> = Object.fromEntries(
  Object.entries(CARD_TYPE_COLORS).map(([kind, color]) => [kind, { header: color, frame: color }]),
);

export default function CardTemplate({ name, type, description, effects, imageUrl, width = 300, onExportError, hideExportButton }: CardTemplateProps) {
  // соотношение как у карточки: примерно 300x420
  const height = Math.round((width / 300) * 420);
  const ref = useRef<HTMLDivElement | null>(null);

  const style = TYPE_STYLES[type] || { header: '#eaeaea', frame: '#bdbdbd' }; // нейтральная карта

  const serverOrigin = useMemo(() => {
    try {
      const base = (api.defaults.baseURL as string) || '';
      // baseURL может быть относительным (/api) — тогда origin берём из адреса страницы
      return new URL(base || '/', window.location.href).origin;
    } catch {
      return window.location.origin;
    }
  }, []);

  const resolvedImageUrl = useMemo(() => {
    if (!imageUrl) return undefined;
    if (/^(https?:)?\/\//i.test(imageUrl) || imageUrl.startsWith('data:')) return imageUrl;
    // treat as server-relative path like /uploads/...
    return `${serverOrigin}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
  }, [imageUrl, serverOrigin]);

  const exportPng = async () => {
    if (!ref.current) return;
    try {
      const dataUrl = await toPng(ref.current, { cacheBust: true, pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `${name || 'card'}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      onExportError?.(err);
      console.error('Export PNG failed', err);
    }
  };

  // Краткая сводка по опциональности действий (если есть effects)
  const effectBadges = useMemo(() => {
    const acts: { kind: string; optional?: boolean }[] = [];
    if (Array.isArray(effects)) {
      for (const ef of effects) {
        if (ef && Array.isArray(ef.actions)) {
          for (const a of ef.actions) {
            if (!a || !a.kind) continue;
            // нормализуем
            acts.push({ kind: String(a.kind), optional: !!a.optional });
          }
        }
      }
    }
    if (!acts.length) return { opt: [] as string[], req: [] as string[] };
    const toLabel = (k: string) => {
      switch (k) {
        case 'destroy': return 'уничтожить';
        case 'steal': return 'украсть';
        case 'discard': return 'сбросить';
        case 'sacrifice': return 'пожертвовать';
        case 'move': return 'переместить';
        case 'return': return 'вернуть';
        case 'cancel': return 'отменить';
        case 'transfer': return 'переместить';
        case 'add': return 'взять/добавить';
        default: return k;
      }
    };
    const optSet = new Set<string>();
    const reqSet = new Set<string>();
    for (const a of acts) {
      const label = toLabel(a.kind);
      if (a.optional) optSet.add(label);
      else reqSet.add(label);
    }
    // Если действие встречается и как optional и как required, пометим как required (сильнее)
    for (const l of Array.from(optSet)) {
      if (reqSet.has(l)) optSet.delete(l);
    }
    return { opt: Array.from(optSet), req: Array.from(reqSet) };
  }, [effects]);

  return (
    <Stack spacing={1} alignItems="flex-start">
      <Box
        ref={ref}
        sx={{
          width,
          height,
          borderRadius: 2,
          bgcolor: '#ffffff',
          color: '#222',
          overflow: 'hidden',
          border: `2px solid ${style.frame}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Верхняя полоса с типом */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, bgcolor: style.header, borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
          <Box sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: type === 'ultimate_unicorn' ? '#f3f3f3' : '#7a7a7a' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, color: type === 'ultimate_unicorn' ? '#f3f3f3' : 'inherit' }}>
            {type}
          </Typography>
        </Box>

        {/* Заголовок */}
        <Box sx={{ px: 1.5, pt: 1 }}>
          <Typography variant="h6" sx={{ lineHeight: 1.2 }} noWrap>
            {name || 'Название карты'}
          </Typography>
        </Box>

        {/* Изображение */}
        <Box sx={{ flex: '0 0 auto', px: 1.5, pt: 1 }}>
          <Box
            sx={{
              width: '100%',
              height: Math.round(height * 0.42),
              borderRadius: 1,
              overflow: 'hidden',
              bgcolor: '#f3f3f3',
              border: '1px solid #eee',
            }}
          >
            {resolvedImageUrl ? (
              <Box component="img" src={resolvedImageUrl} alt={name} sx={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', backgroundColor: '#f3f3f3' }} />
            ) : (
              <Box sx={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                <Typography variant="caption">Изображение</Typography>
              </Box>
            )}
          </Box>
        </Box>

        {/* Описание */}
        <Box sx={{ px: 1.5, py: 1, mt: 'auto' }}>
          <Typography
            variant="body2"
            color="text.secondary"
            component="div"
            sx={{ whiteSpace: 'pre-wrap' }}
            dangerouslySetInnerHTML={{ __html: (description || 'Описание появится здесь').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>') }}
          />
          {(effectBadges.opt.length > 0 || effectBadges.req.length > 0) && (
            <Stack direction="row" spacing={0.5} sx={{ mt: 0.5, flexWrap: 'wrap' }}>
              {effectBadges.req.map((l) => (
                <Tooltip key={`req-${l}`} title="Обязательное действие" arrow>
                  <Chip label={l} size="small" color="warning" variant="filled" sx={{ height: 20 }} />
                </Tooltip>
              ))}
              {effectBadges.opt.map((l) => (
                <Tooltip key={`opt-${l}`} title="Действие можно пропустить" arrow>
                  <Chip label={`${l} (по желанию)`} size="small" color="success" variant="outlined" sx={{ height: 20 }} />
                </Tooltip>
              ))}
            </Stack>
          )}
        </Box>

        {/* Низ карточки (тонкая линия) */}
        <Box sx={{ mt: 'auto', borderTop: '1px solid #eee', p: 0.5, textAlign: 'center', color: '#aaa', fontSize: 10 }}>
          Демо-шаблон
        </Box>
      </Box>

      {!hideExportButton && (
        <Button size="small" variant="outlined" onClick={exportPng}>Скачать PNG</Button>
      )}
    </Stack>
  );
}
