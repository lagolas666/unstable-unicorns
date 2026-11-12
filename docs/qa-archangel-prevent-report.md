# QA: Единорог-Архангел — замена уничтожения на сброс не работает

Дата: 06.11.2026
Автор: Единорог Тестировщик
Сьют: `server/test/archangelPreventChoice.test.ts`
Статус: **1 из 2 красный на реальном дефекте** (A1 red, A2 зелёный)

## Что проверялось

Официальный текст (`UNICORNS.md`, п.78, `archangel_unicorn_ultimate`):

> «Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 3 карты. **Когда карта в вашей
> Конюшне должна быть ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, вы можете вместо этого СБРОСИТЬ карту.**
> Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ВЗЯТЬ
> дополнительную карту из КОЛОДЫ.»

В `data/catalog.v2.json` у карты **уже есть** корректные данные под это правило:

```json
{ "trigger": "on_would_be_destroyed_or_sacrificed", "optional": true,
  "actions": [ { "kind": "discard", ... quantity 1 },
               { "kind": "prevent", "prevented_action": "destroy_or_sacrifice" } ] }
```

## Баг 1 (Critical): защита Архангела не срабатывает ни на одной реальной карте

**Баг:** `ownerHasArchangel` сравнивает кириллическое имя карты с латинскими подстроками,
поэтому для настоящего «Единорога-Архангела» возвращает `false`. Карта уничтожается,
хотя по правилам владелец мог сбросить карту из руки.

**Шаги воспроизведения:**
1. Создать игру: P1 — в стойле `archangel_unicorn_ultimate` + запасной единорог, в руке `H_keep`; P2 — в руке `Smash` (destroy 1 по стойлу соперника).
2. P2 играет `Smash` в `ARCH` (`POST /api/game/:id/play` с `targets:[archangel_unicorn_ultimate]`).
3. `POST /api/game/:id/resolve_pending`.

**Ожидаемое поведение:** Архангел в стойле остался; `H_keep` остался в руке (владелец не
выбирал сброс). Либо движок открывает окно выбора, либо карта вообще не уничтожается без
решения владельца.

**Фактическое поведение:** Архангел уничтожен и ушёл в сброс, стойло содержит только `U_spare`.
Окно выбора не открывается, `H_keep` в руке не тронут (поскольку защита не сработала).
Вывод Jest:

```
Expected value: "archangel_unicorn_ultimate"
Received array: ["U_spare"]
```

**Серьёзность:** Critical — одна из 4 ultimates в игре не имеет своей ключевой механики.

**Причина (корень):** `server/src/engine/executor.ts`, `ownerHasArchangel` (L124-131):

```ts
const nameLower = String((c?.name || c?.Название || '')).toLowerCase();
if (nameLower.includes('archangel') && nameLower.includes('unicorn')) return true;
```

`name` у реальной карты — `"Единорог-Архангел"`, латиницы в нём нет, `includes('archangel')`
всегда `false`. Латинское имя лежит в поле `name_en`, которое код не читает.

## Масштаб (Critical): 161 карта каталога невидима для всех хардкодов по имени

`data/catalog.v2.json`: 329 карт, из них **161 с кириллическим `name`** и 168 с латинским.
Все проверки по `name` с латинскими подстроками дают `false` для кириллической половины.

Затронутые места в `executor.ts` (все три — один класс дефекта):

| Функция | Строки | Токены поиска | Карта в каталоге | Имя | Совпадает |
|---|---|---|---|---|---|
| `ownerHasArchangel` | L124-131 → вызовы L855, L961, L986 | `archangel` + `unicorn` | `archangel_unicorn_ultimate` | «Единорог-Архангел» | **нет** |
| `maybeInterceptMagicToHand` | L95-96 | `mystic` + `rainbow` + `unicorn` | — | — | **нет (ни одной карты с mystic в имени)** |
| `zombieKnightReturn` | L688-689 | `zombie` + `knight` + `unicorn` | `zombie_unicorn_magic` («Единорог-зомби», zombie_unicorn) | — | **нет** |

Отдельно: у `zombieKnightReturn` условие требует ещё и `knight`, но в каталоге карта зовётся
`zombie_unicorn_magic` / «Единорог-зомби» — совпадение невозможно даже теоретически, при
любом языке имён.

Побочный вывод: жёсткая привязка к латинице означает, что до сноса фолбэков начала хода
эти ветки случайно срабатывали **на малфь-картах** (`baby_archangel_unicorn`,
`name="Baby Archangel Unicorn"` — латиница), а не на самих ultimate-картах. Мои B1/B2 в
`turnStartFallback.test.ts` были зелёными именно на Малышах.

## Баг 2 (High): правило «вы можете» реализовано как безусловное действие

Даже если имя совпадёт, замена выполняется без выбора игрока (L855-859, L961-963, L986-988):

```ts
const hid = owner.hand.pop()!;
owner.discard.push(hid);
return true;   // цель не уничтожена, when_destroyed не триггерится
```

По правилам это опция владельца. В коде — принудительный сброс последней карты руки
(`hand.pop()`), без окна выбора и с подавлением `when_destroyed`, хотя данные каталога
описывают именно `optional: true`.

**Серьёзность:** High (сейчас маскируется Багом 1: до фикса имени эта ветка не исполняется).

## Баг 3 (High): данные каталога не исполняются — мёртвые триггеры и действия

Триггеры, которые есть в `catalog.v2.json`, но отсутствуют в `server/src/**`:

| Триггер | Эффектов | Исполняется |
|---|---|---|
| `while_in_stable` | 24 | нет в executor (только `unicornTypes.ts` для transforms_unicorn и импорт-скрипты) |
| `on_would_be_destroyed` | 4 | нет |
| `on_opponent_plays_unicorn` | 2 | нет |
| `on_would_be_destroyed_or_sacrificed` | 1 | нет (это правило Архангела) |
| `on_leave_stable` | 1 | нет |
| `on_any_unicorn_sacrificed_or_destroyed` | 1 | нет |
| `on_opponent_pull_baby`, `on_opponent_plays_upgrade_downgrade`, `on_opponent_plays_neigh`, `on_opponent_plays_spell`, `on_opponent_sacrifices`, `on_opponent_would_draw`, `on_opponent_unicorn_effect` | по 1 | нет |

Виды действий из каталога, отсутствующие в движке: `reactive_trigger` (10), `cancel` (9),
`prevent` (8), `choice` (5), `modify_action` (3), `scry` (2), `restrict_action` (2),
`force_play` (2), `copy_effects`, `conditional_loop`, `pass_hands`, `skip_turn`,
`redirect_target`, `choose_card_type`, `modify_hand_limit` — всего 16 видов.

`prevented_action` в `server/src/**` — **0 вхождений**. То есть блок `prevent` из данных
Архангела физически не может быть исполнен.

## Что нужно от Бэкенда (зона не моя, я не правлю `src/**`)

1. `on_would_be_destroyed_or_sacrificed` + `prevent` + `prevented_action` — исполнять из данных,
   с окном выбора владельца (`optional: true`).
2. Снести `ownerHasArchangel`, `maybeInterceptMagicToHand`, `zombieKnightReturn` как сравнения
   по имени; читать флаги/эффекты из данных.
3. Если по какой-то причине хардкод остаётся — сверять `name_en` ИЛИ `id`, не `name`.

## Приёмка

После фикса `A1` обязан позеленеть **без правки теста**. Если позеленеет только после
правки ожиданий — это BLOCKED, а не DONE.

`A2` (контроль: без Архангела карта действительно уничтожается) зелёный уже сейчас —
он гарантирует, что тест не «зелёный по любой причине».
