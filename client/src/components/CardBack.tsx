/**
 * CardBack — рубашка карты, нарисованная кодом (без картинки).
 *
 * Почему так, а не текстурой: исходник /textures/cardback.png — это снимок уже
 * повёрнутой карты (прозрачные углы, верх сдвинут относительно низа на 35 px),
 * поэтому внутри прямого прямоугольника рисунок выглядел наклонённым.
 * Вектор рисуется ровно по осям, масштабируется на любой размер колоды
 * (90×166 в стопке, 130×224 в конюшне) и перекрашивается палитрой активной темы.
 *
 * Компонент декоративный: aria-hidden, в табуляцию не попадает.
 * Новых цветов нет — только ключи TablePalette (камень и золото, одинаковые в обеих темах).
 */
import React from 'react';
import { radii } from '../theme/tokens';
import type { TablePalette } from '../theme/tablePalette';

export interface CardBackProps {
  /** Ширина карты в пикселях сцены */
  width: number;
  /** Высота карты в пикселях сцены */
  height: number;
  /** Палитра активной темы: камень рубашки, золото печати */
  pal: Pick<TablePalette, 'stone' | 'stoneDeep' | 'gold' | 'onFelt'>;
  /** Радиус скругления; по умолчанию радиус карт макета */
  radius?: number;
  /** Дополнительные стили внешнего прямоугольника (позиция, тень, zIndex) */
  style?: React.CSSProperties;
  /** Пометка для тестов и отладки: какой это слой стопки */
  dataPart?: string;
}

/** Узор рубашки строим из повторяющихся полос — они симметричны и не дают наклона. */
const HATCH = 'repeating-linear-gradient(45deg, rgba(255,255,255,0.055) 0px, rgba(255,255,255,0.055) 1px, transparent 1px, transparent 7px)';
const CROSS = 'repeating-linear-gradient(-45deg, rgba(255,255,255,0.045) 0px, rgba(255,255,255,0.045) 1px, transparent 1px, transparent 7px)';

function CardBackBase({ width, height, pal, radius = radii.md, style, dataPart = 'card-back' }: CardBackProps) {
  // Тень вызывающего отделяем от прочих стилей: если положить её после кромки
  // как есть, она затрёт boxShadow компонента и рамка рубашки исчезнет.
  const { boxShadow: outerShadow, ...restStyle } = style ?? {};
  // Печать в центре: круги и восемь лучей. Размер привязан к меньшей стороне,
  // чтобы на вытянутой карте колоды 90×166 печать не растягивалась.
  const seal = Math.round(Math.min(width, height) * 0.62);
  const r = seal / 2;
  const c = 50; // центр во viewBox 100×100
  return (
    <div
      data-part={dataPart}
      aria-hidden="true"
      style={{
        position: 'relative',
        width,
        height,
        boxSizing: 'border-box',
        borderRadius: radius,
        overflow: 'hidden',
        // Камень рубашки: градиент строго по вертикали. Диагональ (158deg) на
        // карте 90×166 читалась как поворот рисунка, а у стопки со сдвигом
        // по диагонали косые полосы складывались в «лестницу».
        // Вертикальный свет даёт горизонтальные полосы — это листы стопки, а не наклон.
        background: `linear-gradient(180deg, ${pal.stone} 0%, ${pal.stoneDeep} 100%)`,
        // Кромка: волосяная линия золотом по всему периметру плюс мягкая тень внутрь.
        // Раньше кольцо было цветом pal.stone — он совпадал с верхом градиента,
        // верхняя кромка сливалась и рамка выглядела перекошенной.
        // Тень вызывающего добавляется СЛЕДОМ, а не вместо: раньше проп style
        // затирал кромку, и у колоды рубашка оставалась без обводки вообще.
        boxShadow: [
          `inset 0 0 0 1px ${pal.gold}`,
          'inset 0 0 22px rgba(0,0,0,0.45)',
          outerShadow,
        ]
          .filter(Boolean)
          .join(', '),
        flexShrink: 0,
        ...restStyle,
      }}
    >
      {/* Плетение узора: два встречных штриха под 45° — симметрично, без визуального наклона */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `${HATCH}, ${CROSS}`,
          opacity: 0.9,
          pointerEvents: 'none',
        }}
      />
      {/* Золотая внутренняя рамка с отступом — как у печатной рубашки */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: Math.max(4, Math.round(width * 0.055)),
          // 1.5px, а не 1px: на карте 90×166 волосяная линия терялась
          // и прямые углы рамки не читались — это и давало ощущение скоса
          border: `1.5px solid ${pal.gold}`,
          borderRadius: Math.max(3, radius - 4),
          opacity: 0.55,
          pointerEvents: 'none',
        }}
      />
      {/* Печать-эмблема по центру */}
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 100 100"
        width={seal}
        height={seal}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
        }}
      >
        <g fill="none" stroke={pal.gold} strokeWidth="1.4" opacity="0.7">
          <circle cx={c} cy={c} r={r * 0.86} />
          <circle cx={c} cy={c} r={r * 0.62} strokeDasharray="4 5" opacity="0.8" />
          <circle cx={c} cy={c} r={r * 0.34} />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (Math.PI * 2 * i) / 8 - Math.PI / 2;
            return (
              <line
                key={i}
                x1={c + Math.cos(a) * r * 0.36}
                y1={c + Math.sin(a) * r * 0.36}
                x2={c + Math.cos(a) * r * 0.6}
                y2={c + Math.sin(a) * r * 0.6}
              />
            );
          })}
        </g>
        {/* Рог: ромб в сердцевине печати */}
        <path
          d={`M ${c} ${c - r * 0.26} L ${c + r * 0.16} ${c} L ${c} ${c + r * 0.26} L ${c - r * 0.16} ${c} Z`}
          fill={pal.onFelt}
          opacity="0.55"
        />
      </svg>
    </div>
  );
}

/** Рубашка одинакова при любых пропсах, кроме размеров и палитры — держим memo. */
const CardBack = React.memo(CardBackBase);
CardBack.displayName = 'CardBack';

export default CardBack;
