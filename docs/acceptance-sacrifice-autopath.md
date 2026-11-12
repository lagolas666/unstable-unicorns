# Приёмка: автопроход sacrifice и мутации exclude_self

Дата: 06.11.2026. Приёмщик: Аналитик. Отчёт для Даниила.

## 1. Что принято

`server/test/sacrificeAutoPathExcludeSelf.test.ts` — красный тест A1 на ветку автопрохода sacrifice
(executor.ts L979) с флагом `exclude_self`. Тест предъявлен Тестировщиком, проверен мной лично.

Файл: 5074 байта, sha256 `32187ede…b4b07e8`, кодировка чистая (U+FFFD=0, U+0402–040F=0, CP1251-пары=0),
EOL — LF, и это норма для этого каталога: из 44 .ts в `server/test/` 28 файлов на LF, 15 на CRLF.

## 2. Мои мутации (не предъявленные агентом)

### M-E1b — гашение самой проверки exclude_self
- Файл: `server/src/engine/executor.ts`, строка 203, `hits=1`.
- Мутант: `… && card.id === sourceId && false) return false;`
- `tsc --noEmit` EXIT=0 — мутация не ломает сборку типов, вердикт зачётный.
- Гейт: 44 сьюта, 458 тестов, **3 красных**:
  - `sacrificeAutoPathExcludeSelf.test.ts :: A1`
  - `excludeSelf.test.ts :: E1`
  - `enterHook.test.ts :: D4`
- Откат: sha `1b0fae26…fc30ce`, BYTE_IDENTICAL=true.

### M-D — таймер окна `hand_limit` снова выбирает карту за игрока
- Файл: `server/src/gameService.ts`, строка 72, `hits=1`.
- `tsc --noEmit` EXIT=0.
- Гейт: **1 красный** — `bug01HandLimitTimer.test.ts`, `Received: null` (окно закрылось само).
- Откат: sha `0d8a8b79…3b5416a1`, BYTE_IDENTICAL=true.
- Важно: раньше (запись #32) эта же мутация **выживала** — дыра закрыта стражем Тестировщика.

### Почему M-E1 в форме `false &&` в начале условия не зачёт
Она снимает narrowing по `card`: `TS18048 'card' is possibly 'undefined'`, 37 сьютов не компилируются,
`Tests: 93` вместо 458, `failed=0` при `exit=1`. Такой красный — артефакт сборки, а не проверки.
Гасить условие надо **в конце** строки, сохраняя обращения к `card`.

## 3. Чистый гейт (контроль после откатов)

```
JEST_EXIT=0
SUITES total=44 passed=44 failed=0
TESTS total=458 passed=455 failed=0 skipped=3
TSC_EXIT=0
```

## 4. Гигиена

- `server/test/`: 62 файла, пробников `_ts_*`/`_an_*` нет, фиктивных тестов с `expect(true).toBe(true)` нет.
- Кодировка пяти затронутых файлов: U+FFFD=0 везде; BOM только у `gameService.ts` (предсуществующий, гейт не ломает).
- Бэкапы `.prev*`/`.mutbak*` на месте (58 файлов) — удаление только после слова Даниила.

## 5. Остаток очереди Тестировщика

1. Красный тест на автогашение Гипнорогом.
2. Тестовый долг: A3/A5 (дефекты правил после перемотки) — намеренно красные в e2eSixPlayers.
