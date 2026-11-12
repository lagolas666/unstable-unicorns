# Приёмка Аналитика: BUG-SWAP-05 (терминальный 409 при нуле кандидатов на swap)

Дата: 07.11.2026. Принимал: Единорог Аналитик. Принято по своим проверкам, а не по чужим отчётам.

## Что принималось

Отказ `409 { message: 'No opponent can swap cards', noSwapCandidates: true }` без `needTargets`,
без `options.players` и без текста `/target player/i`, когда у всех соперников зона обмена пуста.
Две точки: `gameService.ts` (путь `/play`) и `routes/game.ts` (`playWithTargets`).

## Сверка кода (читал сам)

| Файл | Точка | sha256 (12) | размер | CRLF | loneLF | U+FFFD | mojibake |
|---|---|---|---|---|---|---|---|
| `server/src/gameService.ts` | L726-731, `swapChoiceRequirement` L50-76 | `689fec226028` | 143359 | 2383 | 0 | 0 | 0 |
| `server/src/routes/game.ts` | L767-770 | `266a6b9774bc` | 63693 | 1161 | 0 | 0 | 0 |
| `server/test/swapTransport.test.ts` | T6 L180-214, T7 L217-235 | `4f9746c1…` | 11209 | 236 | 0 | 0 | 0 |

Откат мутаций по sha совпал с целевыми значениями: `MATCH_TARGET=true` до и после прогона.

## Мой гейт (не предъявленный агентом)

```
_an_b5_gate.js
SRC_HASH_BEFORE=3bc8aa292651fc4a
TSC_EXIT=0
JEST_EXIT=0
Test Suites: 53 passed, 53 total
Tests:       4 skipped, 491 passed, 495 total
FAIL_SUITES=0
SRC_HASH_AFTER=3bc8aa292651fc4a   (src не тронут прогоном)
Time: 30.814 s
```

Совпадает с новым baseline: 53 сьюта / 495 / 491 passed / 4 skipped, tsc 0.
`PASS test/swapTransport.test.ts` в логе, skipped-кейсов в сьюте нет.

## Мои мутации (не предъявленные Тестировщиком)

| # | Мутация | hits | Убито | RED | Откат |
|---|---|---|---|---|---|
| M1 | только сервис L731: вернуть `needTargets: true, kind:'players', options.players` | 1 | да | T6 | BYTE_IDENTICAL=true |
| M2 | только роут L769: вернуть ту же форму с `options.players` | 1 | да | T7 | BYTE_IDENTICAL=true |
| M3 | `swapChoiceRequirement`: снять фильтр по непустой зоне, кандидаты = все соперники | 1 | да | T3, T4, T6, T7 | BYTE_IDENTICAL=true |

M1 и M2 красят ровно свой кейс — расщепление независимое, кейсы не дублируют друг друга по охвату.
M3 ловит смысл фильтра: без него тест падает четырьмя кейсами.

## Проверка контракта с клиентом

- `client/src/pages/Playtest.tsx` L535: окно выбора открывается по `status===409 && data?.needTargets`,
  L552 — по `data?.needTargetPlayer`. Новая форма не несёт ни того, ни другого → окно не откроется,
  уйдёт `setError(data.message)` с текстом 'No opponent can swap cards'. Тупик «выбор невозможен»
  на клиенте не воспроизводится.
- `server/src/socket/handlers.ts` отдаёт `extra` в ack; ключа `noSwapCandidates` в `SocketAck` нет,
  поэтому socket-фронт увидит `BAD_REQUEST` + текст. Расхождение формы REST/socket для этого поля
  остаётся открытым (не блокирует: поведение одинаково — отказано без окна).

## Найденное при приёмке (не блокирует, вынесено в задачи)

1. **Расхождение фильтра кандидатов.** `swapChoiceRequirement` считает кандидатом любого соперника
   с непустой зоной (`zoneOf(p).length > 0`, L74), а `executor.swapOpponentCandidates` (L669) требует
   `countTargetsForOwners(...) > 0` — карту, проходящую `matchesFilter`. Для `dirty_deal_spell`
   фильтр `card_group:'any'` пропускает любую карту, поведение совпадает, поэтому приёмка не страдает.
   Но если появится swap с узким фильтром, сервис назовёт кандидатом соперника без подходящих карт:
   окно выбора откроется, выбор пройдёт guard сервиса, исполнитель вернёт `false` и сработает
   ветка L868 → 409 в окно выбора. Не тупик, но лишний круг. Правильнее привести сервис к тому же
   счёту по фильтру (сам фильтр живёт в `executor.ts`, наружу не отдаётся — нужен экспорт или
   перенос требования в движок).
2. **Текст отказа на английском** ('No opponent can swap cards') доезжает до игрока как сообщение
   об ошибке — в UI это единственная обратная связь.
3. **`needTargetPlayer` устарел.** `client/src/types/socket.ts` L117 и `Playtest.tsx` L552 ждут
   `needTargetPlayer` в корне тела, но `routes/game.ts` L773 отдаёт `needTargets: true` — форма
   из двух веток проверки на клиенте наполовину мёртвая.
4. **`options.players` при `candidates.length === 0`.** В прежнем поведении `needTargets` там был
   уже отфильтрованным списком, и пустой список был честным. Теперь списка нет вовсе — это и есть
   фикс, но UI должен показывать осмысленное «менять не с кем», а не сырой английский текст.

## Вердикт

Принято. Обе точки ведут себя одинаково, отказ терминальный, состояние не мутирует (карта в руке,
сброс пуст, AP 1), повтор с `targetPlayerId:'p2'` не даёт 200. Гейт 53/495/491/4, tsc 0.
