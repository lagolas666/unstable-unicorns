/**
 * Оболочка экрана «Мастерская хаоса» (админка) по макетам 17:94815 / 17:94991.
 *
 * Почему оболочка отдельным компонентом: pages/Admin.tsx — 1666 строк вёрстки
 * конструктора карт, и обёртка вокруг них не должна его касаться. Оболочка
 * отвечает только за шапку, левый рельс разделов, блок администратора и
 * возврат в игру; содержимое приходит children.
 *
 * Данных о количестве колод, публикациях и «библиотека синхронизирована» из
 * макета здесь намеренно нет: REST /cards отдаёт только карты, про колоды
 * server/** ничего не знает.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { fonts, palette, radii, shadows, typeScale } from '../../theme/tokens';
import { usePalette } from '../../hooks/usePalette';
import { useThemeMode } from '../../hooks/useThemeMode';

/** Разделы админки по макету — только подписи навигации, переключения нет. */
const SECTIONS = ['Загрузка JSON', 'Конструктор карт', 'Колоды'] as const;

/** Подпись темы в шапке — режим берём из общего контекста, не из пропсов. */
const MODE_LABELS: Record<string, string> = {
  light: 'Радужная',
  dark: 'Мрачная',
};

export type AdminShellProps = {
  /** Заголовок экрана; по макету «МАСТЕРСКАЯ ХАОСА». */
  title?: string;
  /** Строка под заголовком: разделы через «·». */
  subtitle?: string;
  /** Кто работает — по макету «Серафина · администратор». */
  userName?: string;
  children: React.ReactNode;
};

function AdminShellInner({ title = 'Мастерская хаоса', subtitle, userName = 'Администратор', children }: AdminShellProps) {
  const pal = usePalette();
  const { mode } = useThemeMode();

  return (
    <div
      data-admin-shell="true"
      style={{
        minHeight: '100vh',
        background: pal.pageBg,
        fontFamily: fonts.body,
        color: palette.atlasInk,
      }}
    >
      {/* Шапка: тёмная полоса с золотым дисплейным заголовком */}
      <header
        style={{
          background: palette.atlasSurfaceDark,
          borderBottom: `1px solid ${palette.atlasBronze}`,
          padding: '18px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: 240 }}>
          <div
            style={{
              fontFamily: fonts.display,
              fontWeight: 700,
              fontSize: 30,
              lineHeight: 1.1,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: palette.atlasGoldText,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontFamily: fonts.body,
              fontSize: typeScale.tiny,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: palette.atlasLilac,
              marginTop: 4,
            }}
          >
            {subtitle || SECTIONS.join(' · ')}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            fontSize: typeScale.small,
            color: palette.atlasMutedDark,
          }}
        >
          <span data-admin-theme={mode}>Тема: {MODE_LABELS[mode] || mode}</span>
          <span
            data-admin-user={userName}
            style={{
              padding: '6px 12px',
              borderRadius: radii.pill ?? 999,
              border: `1px solid ${palette.atlasBronze}`,
              color: palette.atlasCream,
              fontWeight: 700,
            }}
          >
            {userName}
          </span>
          <Link
            to="/lobby"
            style={{
              color: palette.atlasGoldText,
              fontWeight: 800,
              textDecoration: 'none',
              letterSpacing: '0.04em',
            }}
          >
            ← Вернуться в игру
          </Link>
        </div>
      </header>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, flexWrap: 'wrap' }}>
        {/* Левый рельс разделов. Якоря — задел под будущее разделение экрана. */}
        <nav
          aria-label="Разделы мастерской"
          style={{
            width: 200,
            padding: '18px 0',
            borderRight: `1px solid ${palette.atlasBronze}`,
            background: pal.frame,
            alignSelf: 'stretch',
          }}
        >
          {SECTIONS.map((name, i) => (
            <div
              key={name}
              data-admin-nav={name}
              style={{
                padding: '9px 18px',
                fontSize: typeScale.small,
                fontWeight: i === 1 ? 800 : 600,
                color: i === 1 ? palette.atlasInk : pal.textMuted,
                borderLeft: `3px solid ${i === 1 ? palette.atlasViolet : 'transparent'}`,
              }}
            >
              {name}
            </div>
          ))}
        </nav>

        {/* Содержимое конструктора карт */}
        <main
          style={{
            flex: 1,
            minWidth: 320,
            background: palette.atlasPinkWood,
            boxShadow: shadows.card,
          }}
        >
          <div
            style={{
              margin: '16px',
              padding: 18,
              borderRadius: radii.lg ?? 18,
              border: `1px solid ${palette.atlasBronze}`,
              background: palette.atlasCream,
            }}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

/** React.memo: оболочка статична, перерисовывается только при смене темы. */
export const AdminShell = React.memo(AdminShellInner);
export default AdminShell;
