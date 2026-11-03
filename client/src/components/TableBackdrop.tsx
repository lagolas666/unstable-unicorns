/**
 * TableBackdrop — многослойный фон игрового стола по макету «Стол на четверых».
 *
 * Слои взяты из Figma 17:35029 (origin кадра 25618,1260), координаты пересчитаны
 * от левого верхнего угла сцены 1920×1080:
 *   деревянный стол 0,0 1920×1080; лессировка дерева — тот же прямоугольник;
 *   резной борт 24,114 1872×918 r72; инкрустированная кромка 39,129 1842×888 r60;
 *   игровое сукно 53,143 1814×860 r48; магическая печать 659,252 602×602;
 *   кольцо печати 679,272 562×562; четыре заклёпки 28×28 по углам.
 *
 * Новых цветов здесь нет: всё берётся из палитры активной темы (TablePalette),
 * поэтому переключатель «Радужная» / «Мрачная» перекрашивает и фон.
 * Компонент декоративный: aria-hidden, в табуляцию не попадает.
 */
import React from 'react';
import { useThemeMode } from '../hooks/useThemeMode';

type TableBackdropProps = {
  /** Палитра активной темы стола */
  pal: {
    pageBg: string;
    frame: string;
    felt: string;
    accent: string;
    gold: string;
    /** Бронза: борт стола и границы конюшен */
    border: string;
  };
};

/** Абсолютное позиционирование слоя в координатах сцены. */
function box(left: number, top: number, width: number, height: number): React.CSSProperties {
  return { position: 'absolute', left, top, width, height, boxSizing: 'border-box' };
}

/** Точки по окружности печати: лучи и засечки. */
const SPOKES = Array.from({ length: 12 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 12 - Math.PI / 2;
  return { a, x1: 301 + Math.cos(a) * 168, y1: 301 + Math.sin(a) * 168, x2: 301 + Math.cos(a) * 246, y2: 301 + Math.sin(a) * 246 };
});

/** Засечки-капли на внешнем круге печати. */
const DOTS = Array.from({ length: 24 }, (_, i) => {
  const a = (Math.PI * 2 * i) / 24 - Math.PI / 2;
  return { cx: 301 + Math.cos(a) * 272, cy: 301 + Math.sin(a) * 272 };
});

function TableBackdropBase({ pal }: TableBackdropProps) {
  // Режим темы — из того же хука, что и остальной стол: по цветам палитры его не определить
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  return (
    <div data-part="table-backdrop" aria-hidden="true" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {/* Деревянный стол: текстура макета (public/textures/wood.png); pal.border — подложка на время загрузки */}
      <div
        data-part="table-wood"
        style={{
          ...box(0, 0, 1920, 1080),
          background: `${pal.border} url(/textures/wood.png) center / cover no-repeat`,
          // «Мрачная» тема притемняет дерево, иначе светлая текстура спорит с тёмным сукном
          filter: isDark ? 'brightness(0.5) saturate(0.85)' : 'none',
        }}
      />
      <div
        data-part="table-wash"
        style={{
          ...box(0, 0, 1920, 1080),
          background: 'radial-gradient(120% 92% at 50% 44%, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.34) 100%)',
        }}
      />

      {/* Резной борт */}
      <div
        data-part="table-bord"
        style={{
          ...box(24, 114, 1872, 918),
          borderRadius: 72,
          background: `linear-gradient(160deg, ${pal.border} 0%, ${pal.frame} 100%)`,
        }}
      />

      {/* Инкрустированная кромка */}
      <div
        data-part="table-inlay"
        style={{
          ...box(39, 129, 1842, 888),
          borderRadius: 60,
          background: pal.frame,
          boxShadow: 'inset 0 0 24px rgba(0,0,0,0.28)',
        }}
      />

      {/* Игровое сукно: цвет палитры + тайловая текстура ворса (public/textures/felt.png).
          Текстура серая и лежит поверх цвета в режиме overlay, поэтому обе темы
          получают ворс своего оттенка, а новых цветов в коде нет. */}
      <div
        data-part="table-felt"
        style={{
          ...box(53, 143, 1814, 860),
          borderRadius: 48,
          background: pal.felt,
          boxShadow: 'inset 0 0 60px rgba(0,0,0,0.45)',
        }}
      >
        <div
          data-part="table-felt-texture"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 48,
            backgroundImage: 'url(/textures/felt.png)',
            backgroundRepeat: 'repeat',
            backgroundSize: '128px 128px',
            mixBlendMode: 'overlay',
            opacity: isDark ? 0.5 : 0.62,
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Магическая печать по центру стола */}
      <svg
        data-part="table-seal"
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 602 602"
        style={{ ...box(659, 252, 602, 602), color: pal.accent, pointerEvents: 'none' }}
      >
        <g fill="none" stroke="currentColor">
          <circle cx="301" cy="301" r="289" strokeWidth="2" strokeDasharray="10 14" opacity="0.26" />
          <circle cx="301" cy="301" r="255" strokeWidth="1.5" opacity="0.2" />
          <circle cx="301" cy="301" r="164" strokeWidth="1.5" opacity="0.16" />
          <circle cx="301" cy="301" r="96" strokeWidth="1" opacity="0.14" />
          {SPOKES.map((s, i) => (
            <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} strokeWidth="1" opacity="0.14" />
          ))}
        </g>
        <g fill="currentColor" opacity="0.2">
          {DOTS.map((d, i) => (
            <circle key={i} cx={d.cx} cy={d.cy} r="2.5" />
          ))}
        </g>
      </svg>

      {/* Заклёпки по углам борта */}
      {[
        [41, 132],
        [1851, 132],
        [41, 988],
        [1851, 988],
      ].map(([left, top], i) => (
        <div
          key={i}
          data-part="table-rivet"
          style={{
            ...box(left, top, 28, 28),
            borderRadius: '50%',
            background: `radial-gradient(circle at 34% 30%, ${pal.gold} 0%, ${pal.frame} 78%)`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.45)',
          }}
        />
      ))}
    </div>
  );
}

export default React.memo(TableBackdropBase);
