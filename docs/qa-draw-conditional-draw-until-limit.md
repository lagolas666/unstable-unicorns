# Приёмка Бэкенда: `draw_conditional` (md 119) и `draw_until_limit` (md 127)

Тестировщик, 04.11.2026. Независимая проверка заявленного DONE.

## Что подтверждено

| Проверка | Результат |
|---|---|
| Гейт jest `--runInBand --ci --json` | EXIT=0, 35/35 сьютов, 389 passed, 3 skipped, 392 total |
| tsc `--noEmit` | EXIT=0, 0 ошибок |
| Слепки файлов | sha совпали с заявленными, U+FFFD=0, loneLF=0, BOM gameService.ts цел |
| `HAND_LIMIT_BASE` переехал в `game/config.ts` | да, 3 потребителя: executor.ts, gameService.ts (реэкспорт), routes/game.ts |
| `isActionPossible` при пустой колоде | отказ до открытия окна выбора — верно |
| md 119 ветка «провал» | карта уходит в руку, стойло пусто, доп. добор не срабатывает — верно |
| md 127 добор до лимита (базовый 7) | до лимита добирает — верно, но с перебором (см. BUG B) |

Проверка шла не только через `resolveActions`, но и через публичный `POST /api/game/:id/play`
на реальных картах `server/data/catalog.v2.json` (`rainbow_bridge_spell`, `unicornotopia_spell`).

## BUG A — Critical: `draw_until_limit` обходит лимит руки

**Баг:** «Единороготопия» (md 127) добирает карты сверх лимита руки: актор получает и свой добор до лимита, и «остальные игроки могут взять по 2», приписанные ему же.

**Шаги воспроизведения:**
1. `POST /api/game/test/create` — p1: рука `[unicornotopia_spell, u1, u2]`, колода 8 карт.
2. `POST /api/game/:id/play` с `cardId: "unicornotopia_spell"`.
3. Прочитать состояние: `GET /api/game/test/state/:id`.

**Ожидаемое поведение:** p1 добирает ровно до лимита — в руке 7 карт; из колоды уходит 5.
**Фактическое поведение:** в руке 9 карт, из колоды ушло 7, у p2 рука пуста.

**Причина:** ветка `draw` (`server/src/engine/executor.ts` L969-983) читает только
`targets.quantity` и **игнорирует `target_player`**. Второе действие эффекта md 127 —
`{ kind: 'draw', target_player: 'others', optional: true, target: { quantity: { value: 2 } } }` —
исполняется как добор самого актора. `optional: true` тоже не читается: выбора «брать / не брать» нет.
`getScopePlayers` в этой ветке не вызывается вовсе.

**Серьёзность:** Critical — ломает правило лимита руки (7 карт) и раздачу эффекта другим игрокам.

## BUG B — High: `draw_conditional` не различает `destination` и `sub_action`

**Баг:** «Радужный мост» (md 119) кладёт карту дополнительного добора в Конюшню, хотя по данным должна брать её в руку.

**Шаги воспроизведения:**
1. Создать игру: рука p1 `[rainbow_bridge_spell]`, колода снизу вверх `[magic, u2, u1]` — верх `u1` (единорог).
2. `POST /api/game/:id/play` с `cardId: "rainbow_bridge_spell"`.
3. Прочитать состояние.

**Ожидаемое поведение:** `u1` (подошла под условие) → Конюшня; `u2` — это обычный добор (`sub_action: 'draw'`) → рука.
**Фактическое поведение:** обе карты в Конюшне (`stable=["apprentice_unicorn","basic_unicorn_blue"]`), рука пуста.

**Причина:** данные карты содержат
`on_success: { destination: 'stable', sub_action: 'draw', sub_quantity: 1 }`.
Код (`executor.ts` L1925-1932) кладёт добор по успеху в `dcSuccessDest` — то есть в ту же
`destination`, что и проверенную карту, а поле `sub_action` не читает вообще (hits=0 по всему `src/**`).
Из-за этого единорог «приходит бесплатно в стойло», а не в руку — это меняет счёт к победе.

**Серьёзность:** High — искажает счёт единорогов в стойле и раздувает прогресс к победе.

## Замечания (не блокируют DONE)

1. `player.hand_limit`, на который ссылается комментарий в L1943, **никто в `src/**` не пишет**.
   `currentHandLimit()` (`gameService.ts` L188-198) считает лимит из `hand_limit_delta` карт в стойле
   и в `player` его не сохраняет. Мутация M3 «лимит игнорируется» ловит это только потому, что пробник
   выставляет `hand_limit` руками. Нужен либо перенос расчёта в движок, либо явное поле в состоянии.
2. Комментарий в L1943 утверждает, что сервисный слой выставляет `player.hand_limit` — это не так.
3. `sub_action` в `draw_conditional` не поддержан ни одним значением.

## Артефакты

- `server/_te_probe_bugs.js` — пробник через публичный REST, `VERDICT=FAIL failed=2`.
- `server/_te_probe_bugs.log` — лог с числами.
- `_te_jest_draw.js` / `_te_jest_draw.json` — гейт по стандарту `--json --outputFile`.
- `_te_verify_draw.js` — слепки sha/EOL/BOM/U+FFFD.
