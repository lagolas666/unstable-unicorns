1. Носорогорог (Rhinocorn)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете УНИЧТОЖИТЬ 1 карту с Единорогом. Если вы сделаете это, немедленно перейдите к последней фазе.

json
{
  "id": "rhinocorn_magic",
  "name": "Носорогорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете УНИЧТОЖИТЬ 1 карту с Единорогом. Если вы сделаете это, немедленно перейдите к последней фазе.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "destroy",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "skip_phase",
          "phase": "end"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок пока не связывает выполнение второй команды (skip_phase) с успехом первой (destroy). Кроме того, он может проигнорировать optional: true, и заставит игрока уничтожать карту.
🛠️ Задача для Бэкенда: Реализовать проверку requires_success_of_previous (если уничтожение удалось, делать пропуск фазы). Реализовать обработку optional: true (показывать кнопку "Отмена" игроку).

2. Утонченный нарвал (Refined Narwhal)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете получить случайную карту Бонус из колоды и добавить в свою руку. Если взяли карту, колода перетасуется.

json
{
  "id": "refined_narwhal_magic",
  "name": "Утонченный нарвал",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете получить случайную карту Бонус из колоды и добавить в свою руку. Если взяли карту, колода перетасуется.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "search",
          "target": {
            "scope": "self",
            "zone": "deck",
            "filters": { "card_group": "upgrade" },
            "quantity": { "value": 1 }
          },
          "destination": "hand"
        },
        {
          "kind": "shuffle_deck"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не умеет брать "случайную" карту (quantity.mode: random не работает). Он просто возьмет верхнюю карту колоды.
🛠️ Задача для Бэкенда: Добавить поддержку quantity.mode: "random" в действии search.

3. Коварный нарвал (Devious Narwhal)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете получить случайную карту Штраф из колоды и добавить в свою руку. Если взяли карту, колода перетасуется.

json
{
  "id": "devious_narwhal_magic",
  "name": "Коварный нарвал",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете получить случайную карту Штраф из колоды и добавить в свою руку. Если взяли карту, колода перетасуется.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "search",
          "target": {
            "scope": "self",
            "zone": "deck",
            "filters": { "card_group": "downgrade" },
            "quantity": { "value": 1 }
          },
          "destination": "hand"
        },
        {
          "kind": "shuffle_deck"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Аналогично карте №2, движок возьмет верхнюю карту, а не случайную.
🛠️ Задача для Бэкенда: Добавить поддержку quantity.mode: "random".

4. Нарвал-торпеда (Narwhal Torpedo)
Описание: Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ все Штрафы.

json
{
  "id": "narwhal_torpedo_magic",
  "name": "Нарвал-торпеда",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ все Штрафы.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "sacrifice",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "card_group": "downgrade" },
            "quantity": { "value": 99 } 
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: В спецификации указано, что движок читает только quantity.value и игнорирует quantity.mode: "all". Я поставил 99, чтобы убить всех. Если карт больше 99, останутся.
🛠️ Задача для Бэкенда: Внедрить поддержку quantity.mode: "all" или спец-флаг для "все карты".

5. Единорог-Черный рыцарь (Black Knight Unicorn)
Описание: Если одна из ваших карт с Единорогами будет целью УНИЧТОЖЕНИЯ, то взамен вы можете ПОЖЕРТВОВАТЬ эту карту.

json
{
  "id": "black_knight_unicorn_magic",
  "name": "Единорог-Черный рыцарь",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если одна из ваших карт с Единорогами будет целью УНИЧТОЖЕНИЯ, то взамен вы можете ПОЖЕРТВОВАТЬ эту карту.",
  "effects": [
    {
      "trigger": "when_destroyed", 
      "actions": [
        {
          "kind": "sacrifice",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "name": "Единорог-Черный рыцарь" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Это замещающий эффект (replacement effect). Движок не умеет перехватывать момент "карту собираются уничтожить". Триггер when_destroyed сработает только когда карта уже уничтожена, что делает её бесполезной.
🛠️ Задача для Бэкенда: Добавить новый триггер on_would_be_destroyed (срабатывает до применения эффекта уничтожения), который позволяет заменить цель уничтожения на эту карту (пожертвовать её).

6. Тучный единорог (Massive Unicorn)
Описание: Эта карта считается как за две карты Единорогов. Вы не можете играть Мгновенными картами пока этот единорог в Конюшне.

json
{
  "id": "massive_unicorn_magic",
  "name": "Тучный единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Эта карта считается как за две карты Единорогов. Вы не можете играть Мгновенными картами пока этот единорог в Конюшне.",
  "static_properties": {
    "counts_as_two": true,
    "blocks_instants_against_owner": true
  },
  "effects": []
}
⚠️ Предупреждение: Движок читает counts_as_two из leader.ts по имени карты (см. спецификацию, п. 2), но флаг blocks_instants_against_owner в JSON может быть проигнорирован, так как он обычно берется из canReactFlags.ts. Скорее всего, пока карта просто будет считаться за двух.
🛠️ Задача для Бэкенда: Убедиться, что флаг blocks_instants_against_owner из JSON блокирует окно реакции для оппонента. Проверить логику подсчета победы для counts_as_two.

7. Единорог-русалка (Mermaid Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете выбрать любого игрока. Верните карту из его Конюшни в те карты, которые у него на руках.

json
{
  "id": "mermaid_unicorn_magic",
  "name": "Единорог-русалка",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете выбрать любого игрока. Верните карту из его Конюшни в те карты, которые у него на руках.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "return",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          },
          "destination": "hand"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет. Движок поддерживает действие return и выбор цели (chosen). Единственный нюанс — игрок должен будет выбрать, какую именно карту вернуть, а choice (выбор карты из руки) движок пока не поддерживает.
🛠️ Задача для Бэкенда: Убедиться, что при target_player: "chosen" и quantity: 1 открывается окно выбора карты из стойла противника.

8. Единорог-зомби (Zombie Unicorn)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ одну карту с Единорогом и выбрать одну карту с Единорогом из колоды СБРОСА. Переместите ее в вашу Конюшню, затем немедленно перейдите к последней фазе вашего хода.

json
{
  "id": "zombie_unicorn_magic",
  "name": "Единорог-зомби",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ одну карту с Единорогом и выбрать одну карту с Единорогом из колоды СБРОСА. Переместите ее в вашу Конюшню, затем немедленно перейдите к последней фазе вашего хода.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "move",
          "target": {
            "scope": "self",
            "zone": "discard",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          },
          "destination": "stable"
        },
        {
          "kind": "skip_phase",
          "phase": "end"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Та же проблема с последовательностью, что и у Носорогорога.
🛠️ Задача для Бэкенда: Внедрить цепочки выполнения эффектов (если первый шаг не удался, прерывать цепочку).

9. Бензопиларог (Chainsaw Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете ПОЖЕРТВОВАТЬ у себя или УНИЧТОЖИТЬ у соперника одну карту БОНУС или ШТРАФ.

json
{
  "id": "chainsaw_unicorn_magic",
  "name": "Бензопиларог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете ПОЖЕРТВОВАТЬ у себя или УНИЧТОЖИТЬ у соперника одну карту БОНУС или ШТРАФ.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "choice",
          "options": [
            {
              "kind": "sacrifice",
              "target": {
                "scope": "self",
                "zone": "stable",
                "filters": { "card_group": ["upgrade", "downgrade"] },
                "quantity": { "value": 1 }
              }
            },
            {
              "kind": "destroy",
              "target": {
                "scope": "opponent",
                "zone": "stable",
                "filters": { "card_group": ["upgrade", "downgrade"] },
                "quantity": { "value": 1 }
              }
            }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок полностью игнорирует действие choice (см. спецификацию, п. 4). Эта карта не сработает вообще.
🛠️ Задача для Бэкенда: Реализовать экшен choice и интерфейс для выбора одного из вариантов игроком.

10. Крайне плодовитый единорог (Extremely Fertile Unicorn)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 1 карту. Если вы это сделаете, перетащите карту с Малышом единорогом из Яслей прямо в вашу Конюшню.

json
{
  "id": "fertile_unicorn_magic",
  "name": "Крайне плодовитый единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 1 карту. Если вы это сделаете, перетащите карту с Малышом единорогом из Яслей прямо в вашу Конюшню.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "pull",
          "target": {
            "scope": "self",
            "zone": "nursery", 
            "filters": { "subtype": "baby_unicorn" },
            "quantity": { "value": 1 }
          },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: В спецификации (п. 4) указано, что действие pull поддерживается, но не описано, как именно оно ищет карты в "Яслях" (Nursery).
🛠️ Задача для Бэкенда: Проверить, что экшен pull умеет искать карты по подтипу (baby_unicorn) и перемещать их из зоны nursery в stable.

11. Надоедливый летающий единорог (Annoying Flying Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете выбрать любого игрока. Этот игрок должен СБРОСИТЬ 1 карту. Если эта карта единорога будет ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, верните ее обратно в те карты, которые у вас на руках.

json
{
  "id": "annoying_flying_unicorn_magic",
  "name": "Надоедливый летающий единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете выбрать любого игрока. Этот игрок должен СБРОСИТЬ 1 карту. Если эта карта единорога будет ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, верните ее обратно в те карты, которые у вас на руках.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "force_discard",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        }
      ]
    },
    {
      "trigger": "when_destroyed",
      "actions": [
        {
          "kind": "return_to_hand",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "name": "Надоедливый летающий единорог" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не понимает триггер on_sacrifice (карта не вернется в руку, если ее принесут в жертву). Также нужно проверить, работает ли force_discard с target_player: "chosen".
🛠️ Задача для Бэкенда: Добавить триггер on_sacrifice (срабатывает при жертвовании). Проверить работу force_discard на выбранного игрока.

12. Очаровательный нарвал (Charming Narwhal)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете УКРАСТЬ 1 карту БОНУС у соперника.

json
{
  "id": "charming_narwhal_magic",
  "name": "Очаровательный нарвал",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете УКРАСТЬ 1 карту БОНУС у соперника.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "steal",
          "target_player": "chosen",
          "target": {
            "scope": "opponent",
            "zone": "stable",
            "filters": { "card_group": "upgrade" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет. Движок поддерживает steal и фильтр upgrade.

13. Единорог-Пчелиная королева (Queen Bee Unicorn)
Описание: Пока эта карта в вашем стойле, карты с типом Обычный единорог не могут быть добавлены в Конюшни любых игроков кроме вашей.

json
{
  "id": "queen_bee_unicorn_magic",
  "name": "Единорог-Пчелиная королева",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Пока эта карта в вашем стойле, карты с типом Обычный единорог не могут быть добавлены в Конюшни любых игроков кроме вашей.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "prevent",
          "prevented_action": "play",
          "target_player": "any",
          "target": {
            "scope": "any",
            "zone": "hand",
            "filters": { "card_group": "unicorn", "subtype": "basic" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: В спецификации (п. 3 и п. 4) четко указано, что триггер while_in_stable и действие prevent не поддерживаются движком. Карта будет просто лежать на столе и ничего не делать.
🛠️ Задача для Бэкенда: Реализовать триггер while_in_stable (пассивные ауры) и действие prevent для блокировки розыгрыша определенных карт.

14. Жадный летающий единорог (Greedy Flying Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, возьмите 1 карту из Колоды в свою руку. Если эта карта единорога будет ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, верните ее обратно к картам на руках.

json
{
  "id": "greedy_flying_unicorn_magic",
  "name": "Жадный летающий единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, возьмите 1 карту из Колоды в свою руку. Если эта карта единорога будет ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, верните ее обратно к картам на руках.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "draw",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "deck",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        }
      ]
    },
    {
      "trigger": "when_destroyed",
      "actions": [
        {
          "kind": "return_to_hand",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "name": "Жадный летающий единорог" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Та же проблема, что и у карты №11: нет триггера on_sacrifice.
🛠️ Задача для Бэкенда: Добавить триггер on_sacrifice.

15. Америрог (Ameri'corn)
Описание: Когда эта карта кладется в вашу Конюшню, выберите любого игрока. Получите 1 случайную карту из тех карт что у него на руках.

json
{
  "id": "americorn_magic",
  "name": "Америрог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, выберите любого игрока. Получите 1 случайную карту из тех карт что у него на руках.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "steal",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1, "mode": "random" }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Как указано в спецификации (п. 5), поле quantity.mode игнорируется движком. Он либо заберет первую карту, либо вообще сломается.
🛠️ Задача для Бэкенда: Добавить поддержку quantity.mode: "random" для карт в руке.

16. Магический которог (Magical Kitten)
Описание: Эта карта не может быть УНИЧТОЖЕНА. На данную карту не действуют любые эффекты карт с типом Заклинание.

json
{
  "id": "magical_kitten_magic",
  "name": "Магический которог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Эта карта не может быть УНИЧТОЖЕНА. На данную карту не действуют любые эффекты карт с типом Заклинание.",
  "cannot_be_destroyed": true,
  "immune": ["spell"],
  "effects": []
}
⚠️ Предупреждение: Согласно спецификации (п. 2), движок читает cannot_be_destroyed и массив immune[]. В теории должно сработать без проблем, если тип "Заклинание" в коде называется spell или magic_spell.

17. Ламарог (Llamacorn)
Описание: Когда эта карта кладется в вашу Конюшню, каждый игрок должен СБРОСИТЬ по 1 карте. Колода СБРОСА смешивается с КОЛОДОЙ карт.

json
{
  "id": "llamacorn_magic",
  "name": "Ламарог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, каждый игрок должен СБРОСИТЬ по 1 карте. Колода СБРОСА смешивается с КОЛОДОЙ карт.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "force_discard",
          "target_player": "all",
          "target": {
            "scope": "any",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "shuffle_deck",
          "target": {
            "scope": "any",
            "zone": "discard", 
            "filters": { "card_group": "any" },
            "quantity": { "value": 99 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: В спецификации не уточняется, умеет ли shuffle_deck забирать карты из сброса и подмешивать их в колоду. Скорее всего, он просто перемешает текущую колоду.
🛠️ Задача для Бэкенда: Убедиться, что shuffle_deck может принимать параметр источника (например, source: "discard") и перемещать карты из сброса в колоду перед тасовкой.

18. Акулорог (Shark Unicorn)
Описание: Когда эта карта кладется в вашу конюшню, вы можете ПОЖЕРТВОВАТЬ эту карту. Если вы это сделаете, УНИЧТОЖЬТЕ 1 карту с Единорогом у любого соперника.

json
{
  "id": "shark_unicorn_magic",
  "name": "Акулорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу конюшню, вы можете ПОЖЕРТВОВАТЬ эту карту. Если вы это сделаете, УНИЧТОЖЬТЕ 1 карту с Единорогом у любого соперника.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "sacrifice",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "name": "Акулорог" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "destroy",
          "target_player": "chosen",
          "target": {
            "scope": "opponent",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Та же проблема с цепочкой действий, что и у Носорогорога (Карта №1). Если игрок откажется жертвовать, движок всё равно может уничтожить чужого единорога.
🛠️ Задача для Бэкенда: Реализовать связку requires_success_of_previous (следующее действие выполняется только если предыдущее удалось).

19. Радужный единорог (Rainbow Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете поместить карту с Обычным единорогом из вашей руки в свою Конюшню.

json
{
  "id": "rainbow_unicorn_magic",
  "name": "Радужный единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете поместить карту с Обычным единорогом из вашей руки в свою Конюшню.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "add",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "unicorn", "subtype": "basic" },
            "quantity": { "value": 1 }
          },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок поддерживает add и фильтрацию по subtype: "basic". Должно сработать.

20. Уничтожитель единорогов (Unicorn Killer)
Описание: Если эта карта ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, вы можете УНИЧТОЖИТЬ 1 карту с Единорогом у любого соперника.

json
{
  "id": "unicorn_killer_magic",
  "name": "Уничтожитель единорогов",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, вы можете УНИЧТОЖИТЬ 1 карту с Единорогом у любого соперника.",
  "effects": [
    {
      "trigger": "when_destroyed",
      "optional": true,
      "actions": [
        {
          "kind": "destroy",
          "target_player": "chosen",
          "target": {
            "scope": "opponent",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Опять же, нет триггера on_sacrifice. Если карту принесут в жертву (например, Акулорогом), она не выстрелит.
🛠️ Задача для Бэкенда: Добавить триггер on_sacrifice.

21. Кукурузный рог (Corn Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, ВОЗЬМИТЕ 2 карты из колоды и СБРОСЬТЕ 1 из руки.

json
{
  "id": "corn_unicorn_magic",
  "name": "Кукурузный рог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, ВОЗЬМИТЕ 2 карты из колоды и СБРОСЬТЕ 1 из руки.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 2 } }
        },
        {
          "kind": "discard",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет. Базовые действия draw и discard поддерживаются. Единственный нюанс — движок должен дать игроку выбрать, какую именно карту сбросить.

22. Единорог-ангел (Angel Unicorn)
Описание: Когда эта карта находится в вашей Конюшне в начале вашего хода, вы можете ПОЖЕРТВОВАТЬ эту карту. Если вы это сделаете, то выберите карту с Единорогом из колоды СБРОСА и переместите ее в вашу Конюшню.

json
{
  "id": "angel_unicorn_magic",
  "name": "Единорог-ангел",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта находится в вашей Конюшне в начале вашего хода, вы можете ПОЖЕРТВОВАТЬ эту карту. Если вы это сделаете, то выберите карту с Единорогом из колоды СБРОСА и переместите ее в вашу Конюшню.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "sacrifice",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "name": "Единорог-ангел" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "move",
          "target": {
            "scope": "self",
            "zone": "discard",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Это классический пример, где нужна связка requires_success_of_previous. Если игрок откажется жертвовать (или не сможет), второе действие не должно выполняться. Движок пока выполнит оба действия подряд.
🛠️ Задача для Бэкенда: Реализовать последовательное выполнение (цепочку) действий с проверкой успеха предыдущего.

23. Величественный летающий единорог (Majestic Flying Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете выбрать карту с Единорогом из колоды СБРОСА и добавить ее в руку. Если эта карта будет ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, верните ее обратно в руку.

json
{
  "id": "majestic_flying_unicorn_magic",
  "name": "Величественный летающий единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете выбрать карту с Единорогом из колоды СБРОСА и добавить ее в руку. Если эта карта будет ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, верните ее обратно в руку.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "search",
          "target": {
            "scope": "self",
            "zone": "discard",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          },
          "destination": "hand"
        }
      ]
    },
    {
      "trigger": "when_destroyed",
      "actions": [
        {
          "kind": "return_to_hand",
          "target": {
            "scope": "self",
            "filters": { "name": "Величественный летающий единорог" }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет триггера on_sacrifice. Если карту принесут в жертву, она не вернется в руку. (См. задачу для бэкенда).
🛠️ Задача для Бэкенда: Добавить триггер on_sacrifice для отслеживания принесенных в жертву карт.

24. Магический летающий единорог (Magical Flying Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете выбрать карту ЗАКЛИНАНИЕ из колоды СБРОСА и добавить ее себе в руку. Если эта карта будет ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, верните ее обратно в руку.

json
{
  "id": "magical_flying_unicorn_magic",
  "name": "Магический летающий единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете выбрать карту ЗАКЛИНАНИЕ из колоды СБРОСА и добавить ее себе в руку. Если эта карта будет ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, верните ее обратно в руку.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "search",
          "target": {
            "scope": "self",
            "zone": "discard",
            "filters": { "card_group": "instant" },
            "quantity": { "value": 1 }
          },
          "destination": "hand"
        }
      ]
    },
    {
      "trigger": "when_destroyed",
      "actions": [
        {
          "kind": "return_to_hand",
          "target": {
            "scope": "self",
            "filters": { "name": "Магический летающий единорог" }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Тут две проблемы. Во-первых, нет триггера on_sacrifice. Во-вторых, в ТЗ и спецификации нет четкого разделения на "Заклинание" и "Мгновенная карта". Я использовал фильтр instant, но если в базе "Заклинания" имеют тип spell, этот фильтр нужно заменить.
🛠️ Задача для Бэкенда: Добавить триггер on_sacrifice. Уточнить и синхронизировать типы карт для "Заклинаний".

25. Единорог-феникс (Phoenix Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, СБРОСЬТЕ 1 карту. Если эта карта ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, перенесите ее обратно в вашу КОНЮШНЮ и СБРОСЬТЕ 1 карту, если у вас есть как минимум 1 карта на руках.

json
{
  "id": "phoenix_unicorn_magic",
  "name": "Единорог-феникс",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, СБРОСЬТЕ 1 карту. Если эта карта ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, перенесите ее обратно в вашу КОНЮШНЮ и СБРОСЬТЕ 1 карту, если у вас есть как минимум 1 карта на руках.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "discard",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        }
      ]
    },
    {
      "trigger": "when_destroyed",
      "actions": [
        {
          "kind": "move",
          "target": {
            "scope": "self",
            "zone": "discard",
            "filters": { "name": "Единорог-феникс" },
            "quantity": { "value": 1 }
          },
          "destination": "stable"
        },
        {
          "kind": "discard",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Проблема с условием "если у вас есть как минимум 1 карта на руках". Движок не проверяет условия (conditions). Если рука пуста, он попытается сбросить карту, что может вызвать ошибку или зависание.
🛠️ Задача для Бэкенда: Добавить триггер on_sacrifice. Реализовать проверку условий перед выполнением действия (например, if hand_size > 0).

26. Единорог-разрушитель (Sadistic Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, каждый игрок должен ПОЖЕРТВОВАТЬ 1 карту с Единорогом, если такая есть в Конюшне.

json
{
  "id": "sadistic_unicorn_magic",
  "name": "Единорог-разрушитель",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, каждый игрок должен ПОЖЕРТВОВАТЬ 1 карту с Единорогом, если такая есть в Конюшне.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "sacrifice",
          "target_player": "all",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок может «сломаться», если у кого-то из игроков нет единорогов в стойле (он попытается выбрать цель там, где их нет).
🛠️ Задача для Бэкенда: Добавить обработку пустых целей. Если у игрока нет единорогов, движок должен просто пропустить его.

27. Стремительно летящий единорог (Swift Flying Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете выбрать Мгновенную карту из колоды СБРОСА и добавить ее в руку. Если эта карта будет ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, верните ее в руку.

json
{
  "id": "swift_flying_unicorn_magic",
  "name": "Стремительно летящий единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете выбрать Мгновенную карту из колоды СБРОСА и добавить ее в руку. Если эта карта будет ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, верните ее в руку.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "search",
          "target": {
            "scope": "self",
            "zone": "discard",
            "filters": { "card_group": "instant" },
            "quantity": { "value": 1 }
          },
          "destination": "hand"
        }
      ]
    },
    {
      "trigger": "when_destroyed",
      "actions": [
        {
          "kind": "return_to_hand",
          "target": {
            "scope": "self",
            "filters": { "name": "Стремительно летящий единорог" }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Та же проблема, что и с картой №24 (нет on_sacrifice, возможная путаница с типами instant / spell).
🛠️ Задача для Бэкенда: Добавить триггер on_sacrifice. Проверить названия фильтров для Мгновенных карт.

28. Чарующий единорог (Alluring Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете СБРОСИТЬ 1 карту. Если вы сделали это, УКРАДИТЕ карту Единорога у соперника.

json
{
  "id": "alluring_unicorn_magic",
  "name": "Чарующий единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете СБРОСИТЬ 1 карту. Если вы сделали это, УКРАДИТЕ карту Единорога у соперника.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "steal",
          "target_player": "chosen",
          "target": {
            "scope": "opponent",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Опять нужна проверка "если вы сделали это" (requires_success_of_previous). Если игрок не сбросил карту, красть он не должен.
🛠️ Задача для Бэкенда: Реализовать связку действий (если сброс не удался, кража не происходит).

29. Череда удач (Lucky Streak)
Описание: Возьмите 2 карты из КОЛОДЫ, СБРОСЬТЕ 3 карты из руки, затем сыграйте ещё одну карту.

json
{
  "id": "lucky_streak_spell",
  "name": "Череда удач",
  "type": "spell",
  "description": "Возьмите 2 карты из КОЛОДЫ, СБРОСЬТЕ 3 карты из руки, затем сыграйте ещё одну карту.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 2 } }
        },
        {
          "kind": "discard",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 3 }
          }
        },
        {
          "kind": "extra_action",
          "action_type": "play"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: В спецификации (п. 4) указано, что extra_action поддерживается через case, но не описано, как именно он работает. Если движок просто даст "бонусное действие", это может сработать.
🛠️ Задача для Бэкенда: Убедиться, что после extra_action игроку снова открывается Фаза Розыгрыша (Play Phase) для розыгрыша еще одной карты.

30. Яд для единорогов (Unicorn Poison)
Описание: УНИЧТОЖЬТЕ 1 карту с Единорогом.

json
{
  "id": "unicorn_poison_spell",
  "name": "Яд для единорогов",
  "type": "spell",
  "description": "УНИЧТОЖЬТЕ 1 карту с Единорогом.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "destroy",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет. Эта карта идеально ложится на текущие возможности движка.

31. Лягание (Kick)
Описание: Выберите любого игрока. Верните 1 карту из его Конюшни в карты, которые у него на руках. Выбранный игрок должен СБРОСИТЬ 1 карту.

json
{
  "id": "kick_spell",
  "name": "Лягание",
  "type": "spell",
  "description": "Выберите любого игрока. Верните 1 карту из его Конюшни в карты, которые у него на руках. Выбранный игрок должен СБРОСИТЬ 1 карту.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "return",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          },
          "destination": "hand"
        },
        {
          "kind": "force_discard",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет. Движок поддерживает return и force_discard. Главное, чтобы force_discard заставлял именно выбранного игрока сбрасывать карту.

32. Наглое воровство (Bold Theft)
Описание: Выберите любого игрока, посмотрите и выберите 1 карту из тех что у него на руках, заберите её в свою руку.

json
{
  "id": "bold_theft_spell",
  "name": "Наглое воровство",
  "type": "spell",
  "description": "Выберите любого игрока, посмотрите и выберите 1 карту из тех что у него на руках, заберите её в свою руку.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "steal",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1, "is_player_choice": true }
          },
          "destination": "hand"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Для реализации этого нужен интерфейс, где игрок видит карты в руке противника и кликает на нужную. Движок должен поддержать флаг is_player_choice: true для зоны hand.
🛠️ Задача для Бэкенда: Убедиться, что окно выбора карты из руки противника работает корректно и скрывает карты после выбора.

33. Перенаправление (Redirection)
Описание: Переместите одну карту БОНУС или ШТРАФ, из Конюшни любого игрока в Конюшню любого другого играющего.

json
{
  "id": "redirection_spell",
  "name": "Перенаправление",
  "type": "spell",
  "description": "Переместите одну карту БОНУС или ШТРАФ, из Конюшни любого игрока в Конюшню любого другого играющего.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "move",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": ["upgrade", "downgrade"] },
            "quantity": { "value": 1 }
          },
          "destination_player": "chosen_other",
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Это сложная карта для движка. Сейчас селектор целей (TargetSelector) позволяет выбрать одного игрока. Здесь же нужно выбрать двух (у кого забираем и кому отдаем).
🛠️ Задача для Бэкенда: Добавить в Action поддержку поля destination_player (например, "chosen_other"), чтобы движок запрашивал вторую цель для перемещения карты.

34. Обмен единорогами (Unicorn Swap)
Описание: Переместите 1 карту с Единорогом из своей Конюшни в Конюшню любого другого игрока, затем УКРАДИТЕ 1 карту с Единорогом из его же Конюшни.

json
{
  "id": "unicorn_swap_spell",
  "name": "Обмен единорогами",
  "type": "spell",
  "description": "Переместите 1 карту с Единорогом из своей Конюшни в Конюшню любого другого игрока, затем УКРАДИТЕ 1 карту с Единорогом из его же Конюшни.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "give",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          },
          "destination_player": "chosen",
          "destination": "stable"
        },
        {
          "kind": "steal",
          "target_player": "chosen",
          "target": {
            "scope": "opponent",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Использует действие give, которое в спецификации есть, но логика его работы (особенно с целевым игроком) может быть сырой.
🛠️ Задача для Бэкенда: Проверить работу give и убедиться, что destination_player: "chosen" корректно передает карту оппоненту.

35. Целеноправленное уничтожение (Targeted Destruction)
Описание: ПОЖЕРТВУЙТЕ или УНИЧТОЖТЕ 1 карту БОНУС или ШТРАФ.

json
{
  "id": "targeted_destruction_spell",
  "name": "Целеноправленное уничтожение",
  "type": "spell",
  "description": "ПОЖЕРТВУЙТЕ или УНИЧТОЖТЕ 1 карту БОНУС или ШТРАФ.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "choice",
          "options": [
            {
              "kind": "sacrifice",
              "target_player": "self",
              "target": {
                "scope": "self",
                "zone": "stable",
                "filters": { "card_group": ["upgrade", "downgrade"] },
                "quantity": { "value": 1 }
              }
            },
            {
              "kind": "destroy",
              "target_player": "any",
              "target": {
                "scope": "any",
                "zone": "stable",
                "filters": { "card_group": ["upgrade", "downgrade"] },
                "quantity": { "value": 1 }
              }
            }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Та же проблема, что и у Бензопиларога (Карта 9). Экшен choice не поддерживается.
🛠️ Задача для Бэкенда: Реализовать экшен choice и интерфейс выбора одного из двух вариантов.

36. Кнопка сброса (Reset Button)
Описание: Каждый игрок должен ПОЖЕРТВОВАТЬ все карты ШТРАФ и БОНУС. Перетасуйте колоду СБРОС с игральной КОЛОДОЙ.

json
{
  "id": "reset_button_spell",
  "name": "Кнопка сброса",
  "type": "spell",
  "description": "Каждый игрок должен ПОЖЕРТВОВАТЬ все карты ШТРАФ и БОНУС. Перетасуйте колоду СБРОС с игральной КОЛОДОЙ.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "sacrifice",
          "target_player": "all",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": ["upgrade", "downgrade"] },
            "quantity": { "value": 99 }
          }
        },
        {
          "kind": "shuffle_deck",
          "target": {
            "scope": "any",
            "zone": "discard",
            "filters": { "card_group": "any" },
            "quantity": { "value": 99 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Та же проблема, что и у Ламарога (Карта 17) и Нарвала-торпеды (Карта 4). quantity.mode: "all" не работает (используем 99), а shuffle_deck не умеет подмешивать сброс в колоду.
🛠️ Задача для Бэкенда: Добавить quantity.mode: "all" и поддержку источника для shuffle_deck.

37. Нечестная сделка (Dirty Deal)
Описание: Поменяйтеся всеми картами на руке с картами на руке другого игрока.

json
{
  "id": "dirty_deal_spell",
  "name": "Нечестная сделка",
  "type": "spell",
  "description": "Поменяйтеся всеми картами на руке с картами на руке другого игрока.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "swap",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 99 }
          },
          "destination_player": "chosen",
          "destination": "hand"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нужно проверить, как движок обрабатывает обмен рук целиком. Если swap меняет только по одной карте, карта сработает неправильно.
🛠️ Задача для Бэкенда: Убедиться, что swap с zone: "hand" и quantity: 99 меняет руки игроков целиком.

38. Выгодная сделка (Good Deal)
Описание: ВОЗЬМИТЕ 3 карты из КОЛОДЫ и СБРОСЬТЕ 1 карту из руки.

json
{
  "id": "good_deal_spell",
  "name": "Выгодная сделка",
  "type": "spell",
  "description": "ВОЗЬМИТЕ 3 карты из КОЛОДЫ и СБРОСЬТЕ 1 карту из руки.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 3 } }
        },
        {
          "kind": "discard",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет. Базовые действия, должны работать.

39. Сверкающий торнадо (Glistening Tornado)
Описание: Верните 1 карту из каждой Конюшни в руку игроков.

json
{
  "id": "glistening_tornado_spell",
  "name": "Сверкающий торнадо",
  "type": "spell",
  "description": "Верните 1 карту из каждой Конюшни в руку игроков.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "return",
          "target_player": "all",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          },
          "destination": "hand"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Обычно target_player: "all" выполняет действие для всех. Но нужно проверить, выбирает ли игра по одной карте из каждой конюшни или просто берет первую попавшуюся из всех.
🛠️ Задача для Бэкенда: Убедиться, что target_player: "all" итеративно проходит по каждому игроку и заставляет его выбрать карту.

40. Уменьшитель единорогов (Unicorn Shrinker)
Описание: Выберите любого игрока. Переместите все его карты с Единорогами из Конюшни в стопку СБРОСА без активации эффектов. Затем переместите такое же количество карт с Малышами единорогами из ЯСЛЕЙ в Конюшню этого игрока.

json
{
  "id": "unicorn_shrinker_spell",
  "name": "Уменьшитель единорогов",
  "type": "spell",
  "description": "Выберите любого игрока. Переместите все его карты с Единорогами из Конюшни в стопку СБРОСА без активации эффектов. Затем переместите такое же количество карт с Малышами единорогами из ЯСЛЕЙ в Конюшню этого игрока.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "destroy",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 99 }
          },
          "bypass_triggers": true
        },
        {
          "kind": "pull",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "nursery",
            "filters": { "subtype": "baby_unicorn" },
            "quantity": { "value": "same_as_previous" }
          },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Это самая сложная карта на данный момент. Нужно две вещи: 1) отключить триггеры when_destroyed (чтобы карты не срабатывали при уничтожении) и 2) передать динамическое число в quantity (сколько уничтожили — столько и призвать).
🛠️ Задача для Бэкенда:

Реализовать флаг bypass_triggers: true для действия destroy (уничтожение без срабатывания эффектов).

Реализовать динамические переменные в quantity.value (например, "value": "$destroyed_count").

41. Мистический водоворот (Mystical Vortex)
Описание: Каждый игрок должен СБРОСИТЬ по 1 карте. Перетасуйте колоду СБРОСА с игральной КОЛОДОЙ.

json
{
  "id": "mystical_vortex_spell",
  "name": "Мистический водоворот",
  "type": "spell",
  "description": "Каждый игрок должен СБРОСИТЬ по 1 карте. Перетасуйте колоду СБРОСА с игральной КОЛОДОЙ.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "force_discard",
          "target_player": "all",
          "target": {
            "scope": "any",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "shuffle_deck",
          "target": {
            "scope": "any",
            "zone": "discard",
            "filters": { "card_group": "any" },
            "quantity": { "value": 99 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Проблемы те же, что и у Карты 36. force_discard для всех игроков может потребовать последовательного открытия окон выбора. shuffle_deck по-прежнему не умеет брать карты из сброса.
🛠️ Задача для Бэкенда: Добавить поддержку shuffle_deck с источником discard. Проверить, что force_discard для all заставляет каждого игрока по очереди выбрать карту.

42. Два-за-одного (Two-For-One)
Описание: ПОЖЕРТВУЙТЕ 1 карту, затем УНИЧТОЖТЕ 2 карты у соперников.

json
{
  "id": "two_for_one_spell",
  "name": "Два-за-одного",
  "type": "spell",
  "description": "ПОЖЕРТВУЙТЕ 1 карту, затем УНИЧТОЖТЕ 2 карты у соперников.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "sacrifice",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "destroy",
          "target_player": "chosen",
          "target": {
            "scope": "opponent",
            "zone": "stable",
            "filters": { "card_group": "any" },
            "quantity": { "value": 2 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Если игрок не сможет или не захочет жертвовать карту, движок всё равно перейдет ко второму действию и уничтожит 2 карты. Нужна проверка успеха предыдущего действия. Кроме того, нужно понять, может ли игрок выбрать 2 карты у разных соперников, или только у одного.
🛠️ Задача для Бэкенда: Внедрить requires_success_of_previous (если жертвоприношение не удалось — прервать цепочку). Проверить логику выбора нескольких целей (quantity > 1).

43. Встряска (Shake Up)
Описание: СБРОСЬТЕ эту карту и карты на руке. Перетасуйте колоду СБРОСА с игральной КОЛОДОЙ. Возьмите 5 карт из КОЛОДЫ.

json
{
  "id": "shake_up_spell",
  "name": "Встряска",
  "type": "spell",
  "description": "СБРОСЬТЕ эту карту и карты на руке. Перетасуйте колоду СБРОСА с игральной КОЛОДОЙ. Возьмите 5 карт из КОЛОДЫ.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "discard",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 99 }
          }
        },
        {
          "kind": "shuffle_deck",
          "target": {
            "scope": "any",
            "zone": "discard",
            "filters": { "card_group": "any" },
            "quantity": { "value": 99 }
          }
        },
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 5 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Здесь есть очень тонкий момент с таймингом. В большинстве движков разыгранная карта (сама "Встряска") попадает в сброс после полного разрешения её эффекта. Если движок сбросит её в начале, она тоже перемешается в колоду. Также не работает quantity.mode: "all" (используем 99) и shuffle_deck из сброса.
🛠️ Задача для Бэкенда: Уточнить тайминг попадания карты в сброс (до или после shuffle_deck). Реализовать shuffle_deck из сброса. Реализовать quantity.mode: "all".

44. Радужная аура (Rainbow Aura)
Описание: Пока эта карта в вашей конюшне ваши карты с Единорогами не могут быть УНИЧТОЖЕНЫ.

json
{
  "id": "rainbow_aura_upgrade",
  "name": "Радужная аура",
  "type": "upgrade",
  "description": "Пока эта карта в вашей конюшне ваши карты с Единорогами не могут быть УНИЧТОЖЕНЫ.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "prevent",
          "prevented_action": "destroy",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 99 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Триггер while_in_stable и действие prevent не поддерживаются движком. Эта карта будет абсолютно бесполезным куском картона на столе.
🛠️ Задача для Бэкенда: (Повтор задачи к Карте 13). Реализовать триггер while_in_stable (пассивные ауры) и действие prevent для блокировки уничтожения.

45. Радужная грива (Rainbow Mane)
Описание: Эта карта кладется в вашу Конюшню, только если в ней есть карта с типом Обычный единорог. Если эта карта находится в вашей Конюшне в начале вашего хода, то вы можете переместить 1 карту с типом Обычный единорог из своей руки прямо в вашу Конюшню.

json
{
  "id": "rainbow_mane_upgrade",
  "name": "Радужная грива",
  "type": "upgrade",
  "description": "Эта карта кладется в вашу Конюшню, только если в ней есть карта с типом Обычный единорог. Если эта карта находится в вашей Конюшне в начале вашего хода, то вы можете переместить 1 карту с типом Обычный единорог из своей руки прямо в вашу Конюшню.",
  "play_requirements": {
    "conditions": [
      {
        "type": "has_card",
        "target": { "scope": "self", "zone": "stable", "filters": { "subtype": "basic" } }
      }
    ]
  },
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "move",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "subtype": "basic" },
            "quantity": { "value": 1 }
          },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок полностью игнорирует play_requirements.conditions (согласно спецификации, п.2). Карту можно будет сыграть, даже если у вас нет обычных единорогов. Опциональность (optional: true) тоже пока не работает.
🛠️ Задача для Бэкенда: Реализовать проверку условий перед розыгрышем карты (play_requirements).

46. Двойной подскок (Double Jump)
Описание: Если эта карта находится в вашей Конюшне в начале хода, вы можете сыграть 2 карты в течении фазы ДЕЙСТВИЯ.

json
{
  "id": "double_jump_upgrade",
  "name": "Двойной подскок",
  "type": "upgrade",
  "description": "Если эта карта находится в вашей Конюшне в начале хода, вы можете сыграть 2 карты в течении фазы ДЕЙСТВИЯ.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "actions": [
        {
          "kind": "limit_actions",
          "target_player": "self",
          "action_type": "play",
          "limit": 2
        }
      ]
    }
  ]
}
⚠️ Предупреждение: В спецификации (п. 4) упоминается действие limit_actions, но не уточняется, работает ли оно как увеличение лимита (обычно лимит 1). Если движок настроен только на запрет, карта не сработает.
🛠️ Задача для Бэкенда: Проверить и доработать limit_actions, чтобы оно позволяло увеличивать количество розыгрышей до 2 в фазу Действия.

47. Сверкающая бомба (Sparkling Bomb)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, то вы можете ПОЖЕРТВОВАТЬ 1 любую карту. Если вы сделаете это, УНИЧТОЖЬТЕ 1 любую карту у соперника.

json
{
  "id": "sparkling_bomb_upgrade",
  "name": "Сверкающая бомба",
  "type": "upgrade",
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, то вы можете ПОЖЕРТВОВАТЬ 1 любую карту. Если вы сделаете это, УНИЧТОЖЬТЕ 1 любую карту у соперника.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "sacrifice",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "destroy",
          "target_player": "chosen",
          "target": {
            "scope": "opponent",
            "zone": "stable",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Классическая проблема с цепочкой. Если игрок откажется жертвовать карту, уничтожение всё равно произойдет.
🛠️ Задача для Бэкенда: Реализовать requires_success_of_previous (игрок не может уничтожить карту, если не пожертвовал свою).

48. Ритуал призыва (Summoning Ritual)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 2 карты с Единорогами. Если вы сделаете это, то переместите 1 карту с Единорогом из колоды СБРОСА в вашу конюшню.

json
{
  "id": "summoning_ritual_upgrade",
  "name": "Ритуал призыва",
  "type": "upgrade",
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 2 карты с Единорогами. Если вы сделаете это, то переместите 1 карту с Единорогом из колоды СБРОСА в вашу конюшню.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 2 }
          }
        },
        {
          "kind": "move",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "discard",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Опять нужна связка (если не сбросил 2 карты, то не призывает). Если в руке только 1 единорог, движок должен отменить действие.
🛠️ Задача для Бэкенда: Реализовать requires_success_of_previous и проверку количества карт перед сбросом.

49. Единорожье лассо (Unicorn Lasso)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете УКРАСТЬ 1 карту с Единорогом. В конце вашего хода верните украденную карту с Единорогом в ту Конюшню из которой вы ее украли.

json
{
  "id": "unicorn_lasso_upgrade",
  "name": "Единорожье лассо",
  "type": "upgrade",
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете УКРАСТЬ 1 карту с Единорогом. В конце вашего хода верните украденную карту с Единорогом в ту Конюшню из которой вы ее украли.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "steal",
          "target_player": "chosen",
          "target": {
            "scope": "opponent",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          },
          "set_flag": "stolen_by_lasso",
          "original_owner": "chosen"
        }
      ]
    },
    {
      "trigger": "on_turn_end",
      "actions": [
        {
          "kind": "return",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "tags": ["stolen_by_lasso"] },
            "quantity": { "value": 1 }
          },
          "destination_player": "$original_owner" 
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Это самая сложная карта из всех, что мы разбирали. Движку нужно запомнить, у кого именно была украдена карта (динамическая привязка к игроку), и вернуть её в конце хода. В спецификации нет механизма передачи динамических переменных между триггерами.
🛠️ Задача для Бэкенда: Реализовать систему "временных эффектов" (Temporary Effects). При краже нужно вешать на карту тег и запоминать её изначального владельца в стейте игры, чтобы триггер on_turn_end мог вернуть её обратно.

50. ЕЕЙ (NEEEIGH!)
Описание: Карты, которыми вы играете, не могут быть остановлены Мгновенными картами.

json
{
  "id": "neeeigh_upgrade",
  "name": "ЕЕЙ",
  "type": "upgrade",
  "description": "Карты, которыми вы играете, не могут быть остановлены Мгновенными картами.",
  "static_properties": {
    "blocks_neigh_for_others": true
  },
  "effects": []
}
⚠️ Предупреждение: Согласно спецификации (п.2), флаги вроде blocks_neigh_for_others берутся из хардкод-файла canReactFlags.ts по имени карты, а не из JSON. Если карты нет в этом файле, она не сработает.
🛠️ Задача для Бэкенда: Добавить карту "ЕЕЙ" (или neeeigh_upgrade) в canReactFlags.ts с флагом blocks_neigh_for_others: true.

51. Дополнительный хвост (Extra Tail)
Описание: Эта карта кладется в вашу Конюшню только если в ней есть карта с типом Обычный единорог. Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ВЗЯТЬ 1 дополнительную карту из колоды в начале хода.

json
{
  "id": "extra_tail_upgrade",
  "name": "Дополнительный хвост",
  "type": "upgrade",
  "description": "Эта карта кладется в вашу Конюшню только если в ней есть карта с типом Обычный единорог. Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ВЗЯТЬ 1 дополнительную карту из колоды в начале хода.",
  "play_requirements": {
    "conditions": [
      { "type": "has_card", "target": { "scope": "self", "zone": "stable", "filters": { "subtype": "basic" } } }
    ]
  },
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Как и Карта 45, условие play_requirements будет проигнорировано, и карту можно будет сыграть без обычного единорога.
🛠️ Задача для Бэкенда: Реализовать проверку условий при розыгрыше карты.

52A. Видеоняня (Baby Monitor)
Описание: Пока карта в вашей конюшне, ваши карты на руках видны всем игрокам.

json
{
  "id": "baby_monitor_downgrade",
  "name": "Видеоняня",
  "type": "downgrade",
  "description": "Пока карта в вашей конюшне, ваши карты на руках видны всем игрокам.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "set_flag",
          "target_player": "self",
          "flag": "reveal_hand",
          "value": true
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не поддерживает while_in_stable, поэтому флаг не установится. Даже если установится, нужен UI, который умеет показывать руку игрока другим.
🛠️ Задача для Бэкенда: Реализовать триггер while_in_stable и логику снятия флага reveal_hand при уходе карты со стола. Настроить передачу данных руки клиентам, если флаг активен.

52B. Разбитая конюшня (Broken Stable)
Описание: Пока карта в вашей конюшне, вы не можете разыгрывать карты БОНУС.

json
{
  "id": "broken_stable_downgrade",
  "name": "Разбитая конюшня",
  "type": "downgrade",
  "description": "Пока карта в вашей конюшне, вы не можете разыгрывать карты БОНУС.",
  "static_properties": {
    "play_restrictions": [
      { "type": "card_type", "value": "upgrade", "target": "self" }
    ]
  },
  "effects": []
}
⚠️ Предупреждение: В спецификации не указано, что движок динамически читает play_restrictions из JSON. Если он берет их из хардкода (как у Кота-Ворчуна), карта не сработает.
🛠️ Задача для Бэкенда: Научить движок при проверке возможности розыгрыша сканировать все карты на столе игрока на наличие play_restrictions.

53. Пандамониум (Pandamonium)
Описание: Пока карта в вашей конюшне, все ваши карты с Единорогами считаются Пандами. Эффекты применяемые к Единорогам не действуют на панд. Панды не считаются при победе.

json
{
  "id": "pandamonium_downgrade",
  "name": "Пандамониум",
  "type": "downgrade",
  "description": "Пока карта в вашей конюшне, все ваши карты с Единорогами считаются Пандами. Эффекты применяемые к Единорогам не действуют на панд. Панды не считаются при победе.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "set_flag",
          "target_player": "self",
          "flag": "transforms_unicorn",
          "value": "panda"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Согласно спецификации (п.2), движок читает transforms_unicorn в leader.ts. Если это статический флаг карты, он сработает. Если это должен быть динамический аура-эффект (меняющий всех юнитов), движок пока не умеет менять свойства других карт из JSON.
🛠️ Задача для Бэкенда: Убедиться, что transforms_unicorn работает как аура. Если юнит становится пандой, он должен перестать получать баффы единорогов и не идти в зачет победы.

54. Колючая проволка (Barbed Wire)
Описание: Пока карта в вашей конюшне, каждый раз, когда карта Единорог кладется или покидает вашу Конюшню, СБРОСЬТЕ 1 карту.

json
{
  "id": "barbed_wire_downgrade",
  "name": "Колючая проволка",
  "type": "downgrade",
  "description": "Пока карта в вашей конюшне, каждый раз, когда карта Единорог кладется или покидает вашу Конюшню, СБРОСЬТЕ 1 карту.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "reactive_trigger",
          "on_event": ["on_enter_stable", "on_leave_stable"],
          "condition": { "target_card_type": "unicorn", "target_zone": "self_stable" },
          "actions": [
            {
              "kind": "discard",
              "target_player": "self",
              "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 1 } }
            }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Тут две огромные проблемы. Во-первых, нет триггера on_leave_stable. Во-вторых, нет механизма reactive_trigger (когда одна карта слушает события других карт).
🛠️ Задача для Бэкенда: Добавить триггер on_leave_stable. Реализовать систему "Слушателей" (Listeners), чтобы эта карта могла вешать обработчик на вход/выход других карт и заставлять игрока сбрасывать карту.

55. Крошечная конюшня (Tiny Stable)
Описание: Пока карта в вашей конюшне, каждый раз, когда у вас появляется больше 5 карт с Единорогами в вашей Конюшне, ПОЖЕРТВУЙТЕ 1 карту с Единорогом.

json
{
  "id": "tiny_stable_downgrade",
  "name": "Крошечная конюшня",
  "type": "downgrade",
  "description": "Пока карта в вашей конюшне, каждый раз, когда у вас появляется больше 5 карт с Единорогами в вашей Конюшне, ПОЖЕРТВУЙТЕ 1 карту с Единорогом.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "reactive_trigger",
          "on_event": "on_enter_stable",
          "condition": {
            "operator": "AND",
            "rules": [
              { "type": "count_in_zone", "target": "self_stable", "card_group": "unicorn", "comparison": ">", "value": 5 }
            ]
          },
          "actions": [
            {
              "kind": "sacrifice",
              "target_player": "self",
              "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } }
            }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не умеет проверять условия (conditions). Он просто не увидит, что единорогов стало больше 5, и не заставит жертвовать.
🛠️ Задача для Бэкенда: Реализовать проверку count_in_zone и реагирование на изменение количества карт в зоне.

56. Замедление (Slowdown)
Описание: Пока карта в вашей конюшне, вы не можете играть Мгновенными картами.

json
{
  "id": "slowdown_downgrade",
  "name": "Замедление",
  "type": "downgrade",
  "description": "Пока карта в вашей конюшне, вы не можете играть Мгновенными картами.",
  "static_properties": {
    "play_restrictions": [
      { "type": "card_type", "value": "instant", "target": "self" }
    ]
  },
  "effects": []
}
⚠️ Предупреждение: Аналогично Карте 52B. Если движок не читает play_restrictions из JSON, игрок сможет играть Мгновенные карты.
🛠️ Задача для Бэкенда: Научить движок сканировать стол на наличие запретов (play_restrictions).

57. Садистский ритуал (Sadistic Ritual)
Описание: Пока карта в вашей конюшне, в начале вашего хода, ПОЖЕРТВУЙТЕ 1 карту, кроме этой, затем ВОЗЬМИТЕ 1 карту из КОЛОДЫ.

json
{
  "id": "sadistic_ritual_downgrade",
  "name": "Садистский ритуал",
  "type": "downgrade",
  "description": "Пока карта в вашей конюшне, в начале вашего хода, ПОЖЕРТВУЙТЕ 1 карту, кроме этой, затем ВОЗЬМИТЕ 1 карту из КОЛОДЫ.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "actions": [
        {
          "kind": "sacrifice",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "card_group": "any", "exclude_self": true },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Обязательное жертвоприношение (нет optional: true). Если у игрока нет других карт в стойле (только сам ритуал), движок может зависнуть.
🛠️ Задача для Бэкенда: Реализовать фильтр exclude_self (исключить саму карту из поиска целей). Добавить проверку, что если жертвовать нечего, то и добора не происходит.

58. Ослепляющий свет (Blinding Light)
Описание: Пока карта в вашей конюшне, эффекты Единорогов на вход в конюшню не срабатывают.

json
{
  "id": "blinding_light_downgrade",
  "name": "Ослепляющий свет",
  "type": "downgrade",
  "description": "Пока карта в вашей конюшне, эффекты Единорогов на вход в конюшню не срабатывают.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "prevent",
          "prevented_action": "on_enter_stable",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn" } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не поддерживает триггер while_in_stable и действие prevent. Эффекты единорогов при входе (как у Карты 2) всё равно сработают.
🛠️ Задача для Бэкенда: Реализовать "глушилку" триггеров. Перед тем как вызвать on_enter_stable у карты, движок должен проверить, нет ли на столе эффекта, блокирующего это событие.

59. Радужное лассо (Rainbow Lasso)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 3 карты, чтобы УКРАСТЬ единорога.

json
{
  "id": "rainbow_lasso_upgrade",
  "name": "Радужное лассо",
  "type": "upgrade",
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 3 карты, чтобы УКРАСТЬ единорога.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target_player": "self",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 3 } }
        },
        {
          "kind": "steal",
          "target_player": "chosen",
          "target": { "scope": "opponent", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Как всегда, нужна проверка успеха первого действия. Если игрок сбросит меньше 3 карт (например, у него в руке только 2), красть он не должен.
🛠️ Задача для Бэкенда: Внедрить requires_success_of_previous (цепочка действий).

60. Автомат с игрушками (Toy Vending Machine)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 1 карту, чтобы ВЗЯТЬ 1 карту из КОЛОДЫ.

json
{
  "id": "toy_vending_machine_upgrade",
  "name": "Автомат с игрушками",
  "type": "upgrade",
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 1 карту, чтобы ВЗЯТЬ 1 карту из КОЛОДЫ.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target_player": "self",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Если у игрока нет карт в руке, чтобы сбросить, эффект всё равно сработает, и он возьмет карту.
🛠️ Задача для Бэкенда: Связать цепочку: если не удалось сбросить (нет карт), добор отменяется.

61. Единорог-некромант (Necromancer Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете СБРОСИТЬ 2 карты единорога с руки, чтобы взять единорога из колоды СБРОСА и добавить его в свою конюшню.

json
{
  "id": "necromancer_unicorn_magic",
  "name": "Единорог-некромант",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете СБРОСИТЬ 2 карты единорога с руки, чтобы взять единорога из колоды СБРОСА и добавить его в свою конюшню.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "unicorn" }, "quantity": { "value": 2 } }
        },
        {
          "kind": "search",
          "target": { "scope": "self", "zone": "discard", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нужна цепочка requires_success_of_previous. Если игрок не сможет сбросить 2 карты (например, у него только 1), он не должен получить единорога из сброса.
🛠️ Задача для Бэкенда: Связка действий (если сброс не удался, поиск отменяется).

62. Единорог-оракул (Oracle Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, посмотрите 3 верхние карты в КОЛОДЕ и возьмите 1 из них в свою руку, а затем верните 2 другие карты наверх КОЛОДЫ в любом порядке.

json
{
  "id": "oracle_unicorn_magic",
  "name": "Единорог-оракул",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, посмотрите 3 верхние карты в КОЛОДЕ и возьмите 1 из них в свою руку, а затем верните 2 другие карты наверх КОЛОДЫ в любом порядке.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "reveal",
          "target": { "scope": "self", "zone": "deck_top", "quantity": { "value": 3 } }
        },
        {
          "kind": "move",
          "target": { "scope": "self", "zone": "revealed_cards", "quantity": { "value": 1, "is_player_choice": true } },
          "destination": "hand"
        },
        {
          "kind": "reorder_top",
          "target": { "scope": "self", "zone": "revealed_cards", "quantity": { "value": 2, "is_player_choice": true } },
          "destination": "deck_top"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Это сложная карта для UI. Движок должен уметь показать окно с 3 картами, дать игроку выбрать 1 в руку, а затем дать перетащить две оставшиеся карты в нужном порядке наверх колоды.
🛠️ Задача для Бэкенда: Реализовать UI-модалку "Сканирование" (Scry), где игрок видит N карт, выбирает 1 в руку и перетаскивает остальные в нужном порядке.

63. Единорог-темный ангел (Dark Angel Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете ПОЖЕРТВОВАТЬ карту единорога, чтобы взять из колоды СБРОСА единорога и добавить его в свою конюшню.

json
{
  "id": "dark_angel_unicorn_magic",
  "name": "Единорог-темный ангел",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете ПОЖЕРТВОВАТЬ карту единорога, чтобы взять из колоды СБРОСА единорога и добавить его в свою конюшню.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "search",
          "target": { "scope": "self", "zone": "discard", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Снова нужна связка действий. Если не пожертвовал, то не берет из сброса.
🛠️ Задача для Бэкенда: Реализовать requires_success_of_previous.

64. Конская артиллерия (Horse Artillery)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 2 карты, чтобы УНИЧТОЖИТЬ 1 карту Единорога.

json
{
  "id": "horse_artillery_upgrade",
  "name": "Конская артиллерия",
  "type": "upgrade",
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 2 карты, чтобы УНИЧТОЖИТЬ 1 карту Единорога.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 2 } }
        },
        {
          "kind": "destroy",
          "target_player": "chosen",
          "target": { "scope": "any", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Требуется проверка успеха сброса.
🛠️ Задача для Бэкенда: requires_success_of_previous.

65. Кофеиновый передоз (Caffeine Overdose)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ПОЖЕРТВОВАТЬ карту, чтобы взять 2 карты из КОЛОДЫ.

json
{
  "id": "caffeine_overdose_upgrade",
  "name": "Кофеиновый передоз",
  "type": "upgrade",
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ПОЖЕРТВОВАТЬ карту, чтобы взять 2 карты из КОЛОДЫ.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "any" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 2 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Снова связка.
🛠️ Задача для Бэкенда: requires_success_of_previous.

66. Матушка гусыня единорог (Mother Goose Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете взять Малыша Единорога из ЯСЛЕЙ и добавить его в свою Конюшню.

json
{
  "id": "mother_goose_unicorn_magic",
  "name": "Матушка гусыня единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете взять Малыша Единорога из ЯСЛЕЙ и добавить его в свою Конюшню.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "pull",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "nursery",
            "filters": { "subtype": "baby_unicorn" },
            "quantity": { "value": 1 }
          },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Убедиться, что зона nursery (Ясли) доступна для поиска и перемещения.
🛠️ Задача для Бэкенда: Проверить работу экшена pull для Яслей.

67. Поцелуй жизни (Kiss of Life)
Описание: Возьмите единорога из колоды СБРОСА и добавьте его в свою Конюшню.

json
{
  "id": "kiss_of_life_spell",
  "name": "Поцелуй жизни",
  "type": "spell",
  "description": "Возьмите единорога из колоды СБРОСА и добавьте его в свою Конюшню.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "search",
          "target": { "scope": "self", "zone": "discard", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет. Простая карта.

68. Вечно молодой единорог (Forever Young Unicorn)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, замените единорога в Конюшне любого игрока Малышом единорогом без активации эффектов. Замененного единорога положите в колоду СБРОСА.

json
{
  "id": "forever_young_unicorn_magic",
  "name": "Вечно молодой единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, замените единорога в Конюшне любого игрока Малышом единорогом без активации эффектов. Замененного единорога положите в колоду СБРОСА.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "actions": [
        {
          "kind": "destroy",
          "target_player": "chosen",
          "target": { "scope": "any", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } },
          "bypass_triggers": true
        },
        {
          "kind": "pull",
          "target_player": "chosen",
          "target": { "scope": "any", "zone": "nursery", "filters": { "subtype": "baby_unicorn" }, "quantity": { "value": 1 } },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Тут две проблемы. 1) Нужно bypass_triggers: true для уничтожения без срабатывания эффектов. 2) Движок должен положить малыша именно в стойло того игрока, у которого уничтожили единорога (destination_player: "chosen").
🛠️ Задача для Бэкенда: Реализовать флаг bypass_triggers и корректную передачу target_player на второе действие.

69. Геймерог (Gamericorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете положить карту БОНУС из своей руки в свою Конюшню.

json
{
  "id": "gamericorn_magic",
  "name": "Геймерог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете положить карту БОНУС из своей руки в свою Конюшню.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "add",
          "target_player": "self",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "upgrade" }, "quantity": { "value": 1 } },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет. Стандартное действие.

70. Единорог просто космос (Cosmic Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, замешайте карты в руках всех игроков, колоду СБРОСА и игральную КОЛОДУ. После этого каждый игрок берет 5 карт из КОЛОДЫ.

json
{
  "id": "cosmic_unicorn_magic",
  "name": "Единорог просто космос",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, замешайте карты в руках всех игроков, колоду СБРОСА и игральную КОЛОДУ. После этого каждый игрок берет 5 карт из КОЛОДЫ.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "mega_shuffle",
          "sources": ["all_hands", "discard", "deck"],
          "destination": "deck"
        },
        {
          "kind": "draw",
          "target_player": "all",
          "target": { "quantity": { "value": 5 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Экшена mega_shuffle (замешать всё в кучу) в движке нет. Обычный shuffle_deck не умеет собирать карты из рук и сброса.
🛠️ Задача для Бэкенда: Реализовать действие mega_shuffle, которое собирает указанные зоны (руки всех игроков, сброс, колода) в одну стопку, тасует её и раздает карты.

71. Единорог службы спасения (Rescue Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, каждый игрок ЖЕРТВУЕТ все карты ШТРАФ. СЛУЧАЙНАЯ карта БОНУС из КОЛОДЫ добавляется в вашу Конюшню.

json
{
  "id": "rescue_unicorn_magic",
  "name": "Единорог службы спасения",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, каждый игрок ЖЕРТВУЕТ все карты ШТРАФ. СЛУЧАЙНАЯ карта БОНУС из КОЛОДЫ добавляется в вашу Конюшню.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "sacrifice",
          "target_player": "all",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "downgrade" },
            "quantity": { "value": 99 }
          }
        },
        {
          "kind": "search",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "deck",
            "filters": { "card_group": "upgrade" },
            "quantity": { "value": 1, "mode": "random" }
          },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Проблемы с quantity.mode: "all" (используем 99) и quantity.mode: "random". Кроме того, итерация по всем игрокам для жертвоприношения может сломаться, если у кого-то нет штрафов.
🛠️ Задача для Бэкенда: Добавить поддержку random и all. Обработать пустые зоны при жертвоприношении.

72. Единорог-дрессировщик (Trainer Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете СБРОСИТЬ 2 карты, чтобы выбрать 2 Единорогов из стопки СБРОСА и добавить их к себе в руку.

json
{
  "id": "trainer_unicorn_magic",
  "name": "Единорог-дрессировщик",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете СБРОСИТЬ 2 карты, чтобы выбрать 2 Единорогов из стопки СБРОСА и добавить их к себе в руку.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 2 }
          }
        },
        {
          "kind": "search",
          "target": {
            "scope": "self",
            "zone": "discard",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 2, "is_player_choice": true }
          },
          "destination": "hand"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Как всегда, если игрок не сбросил 2 карты, поиск срабатывать не должен.
🛠️ Задача для Бэкенда: Внедрить requires_success_of_previous и выбор нескольких целей (quantity: 2).

73. Косплей единорога (Cosplay Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, выберите единорога в Конюшне любого другого игрока. Эта карта получает эффекты выбранной карты. Если выбранная вами карта единорога ПОЖЕРТВОВАНА, УНИЧТОЖЕНА или ВОЗВРАЩЕНА в руку, эта карта теряет свой эффект.

json
{
  "id": "cosplay_unicorn_magic",
  "name": "Косплей единорога",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, выберите единорога в Конюшне любого другого игрока. Эта карта получает эффекты выбранной карты. Если выбранная вами карта единорога ПОЖЕРТВОВАНА, УНИЧТОЖЕНА или ВОЗВРАЩЕНА в руку, эта карта теряет свой эффект.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "copy_effects",
          "target_player": "chosen",
          "target": {
            "scope": "opponent",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Это кошмар для движка. Нужно не просто скопировать массив effects, но и постоянно отслеживать (слушать) карту-источник, чтобы при её уходе со стола обнулить эффекты Косплея.
🛠️ Задача для Бэкенда: Реализовать экшен copy_effects. Добавить триггеры on_target_leave_stable, on_target_destroyed, on_target_sacrificed, чтобы отписываться от чужих эффектов.

74. Легендарный летающий единорог (Legendary Flying Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, каждый игрок должен СБРОСИТЬ карту. Если эта карта ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, верните ее в свою руку.

json
{
  "id": "legendary_flying_unicorn_magic",
  "name": "Легендарный летающий единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, каждый игрок должен СБРОСИТЬ карту. Если эта карта ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, верните ее в свою руку.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "force_discard",
          "target_player": "all",
          "target": {
            "scope": "any",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        }
      ]
    },
    {
      "trigger": "when_destroyed",
      "actions": [
        {
          "kind": "return_to_hand",
          "target": {
            "scope": "self",
            "filters": { "name": "Легендарный летающий единорог" }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет триггера on_sacrifice. Если её принесут в жертву, возврата в руку не будет.
🛠️ Задача для Бэкенда: Добавить триггер on_sacrifice.

75. Самый гордый единорог (Proudest Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, каждый игрок должен ОТДАТЬ вам карту из своей руки по своему выбору.

json
{
  "id": "proudest_unicorn_magic",
  "name": "Самый гордый единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, каждый игрок должен ОТДАТЬ вам карту из своей руки по своему выбору.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "give",
          "target_player": "all",
          "target": {
            "scope": "any",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1, "is_player_choice": true }
          },
          "destination_player": "self",
          "destination": "hand"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Игра должна по очереди дать каждому игроку выбрать карту для передачи. Это сложный асинхронный процесс.
🛠️ Задача для Бэкенда: Реализовать поочередный запрос выбора карты у каждого игрока (с таймером).

76. Самый рогатый единорог (Horniest Unicorn)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете переместить единорога из Конюшни любого игрока в вашу Конюшню. В конце вашего хода, переместите единорога обратно в его первоначальную Конюшню.

json
{
  "id": "horniest_unicorn_magic",
  "name": "Самый рогатый единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете переместить единорога из Конюшни любого игрока в вашу Конюшню. В конце вашего хода, переместите единорога обратно в его первоначальную Конюшню.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "steal",
          "target_player": "chosen",
          "target": {
            "scope": "opponent",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          },
          "set_flag": "stolen_by_horniest",
          "original_owner": "chosen"
        }
      ]
    },
    {
      "trigger": "on_turn_end",
      "actions": [
        {
          "kind": "return",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "tags": ["stolen_by_horniest"] },
            "quantity": { "value": 1 }
          },
          "destination_player": "$original_owner"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Та же проблема, что и у Лассо (Карта 49). Движок должен «запомнить» изначального владельца карты.
🛠️ Задача для Бэкенда: Реализовать систему "Временных эффектов" (Temporary Effects), которая хранит контекст и возвращает карты в конце хода.

77. Неуловимый оцелоторог (Elusive Ocelotcorn)
Описание: Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 2 карты Единорогов. Другие игроки не могут играть карты ОТМЕНЫ. Эту карту нельзя ОТМЕНИТЬ.

json
{
  "id": "elusive_ocelotcorn_ultimate",
  "name": "Неуловимый оцелоторог",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 2 карты Единорогов. Другие игроки не могут играть карты ОТМЕНЫ. Эту карту нельзя ОТМЕНИТЬ.",
  "static_properties": {
    "cannot_be_neighed": true,
    "blocks_neigh_for_others": true
  },
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "sacrifice",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 2 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Обязательное жертвоприношение (нет optional). Если у игрока нет 2 других единорогов, карта не должна быть сыграна. Флаги отмены должны быть в canReactFlags.ts.
🛠️ Задача для Бэкенда: Добавить проверку play_requirements (наличие 2 единорогов) и обновить canReactFlags.ts.

78. Единорог-Архангел (Archangel Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 3 карты. Когда карта в вашей Конюшне должна быть ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, вы можете вместо этого СБРОСИТЬ карту. Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ВЗЯТЬ дополнительную карту из КОЛОДЫ.

json
{
  "id": "archangel_unicorn_ultimate",
  "name": "Единорог-Архангел",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 3 карты. Когда карта в вашей Конюшне должна быть ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, вы можете вместо этого СБРОСИТЬ карту. Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ВЗЯТЬ дополнительную карту из КОЛОДЫ.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "sacrifice",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "card_group": "any", "exclude_self": true },
            "quantity": { "value": 3 }
          }
        }
      ]
    },
    {
      "trigger": "on_would_be_destroyed_or_sacrificed",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "prevent",
          "prevented_action": "destroy_or_sacrifice"
        }
      ]
    },
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Здесь задействован замещающий эффект (Replacement Effect), которого нет в движке. Движок не умеет перехватывать действие «до» его выполнения.
🛠️ Задача для Бэкенда: Реализовать триггер on_would_be_destroyed_or_sacrificed и действие prevent, которое отменяет исходное действие (уничтожение/жертву).

79. Хронорог (Chronocorn)
Описание: Когда эта карта кладется в вашу Конюшню, СБРОСЬТЕ карту. Эта карта может быть разыграна как Мгновенная карта.

json
{
  "id": "chronocorn_ultimate",
  "name": "Хронорог",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, СБРОСЬТЕ карту. Эта карта может быть разыграна как Мгновенная карта.",
  "static_properties": {
    "can_be_played_as_instant": true
  },
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "discard",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: В движке нет свойства, позволяющего разыгрывать карту Единорога в фазу Мгновенных карт (Instant Phase).
🛠️ Задача для Бэкенда: Реализовать флаг can_be_played_as_instant, чтобы карта появлялась в списке доступных действий во время окна реакции.

80. Гипнорог (Hypnocorn)
Описание: Когда другой игрок инициирует эффект карты Единорога, вы можете СБРОСИТЬ карту чтобы отменить этот эффект.

json
{
  "id": "hypnocorn_magic",
  "name": "Гипнорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда другой игрок инициирует эффект карты Единорога, вы можете СБРОСИТЬ карту чтобы отменить этот эффект.",
  "effects": [
    {
      "trigger": "on_opponent_unicorn_effect",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "cancel",
          "target": { "scope": "stack" }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет триггера on_opponent_unicorn_effect. Обычное окно отмены (Neigh) реагирует на любые карты, а тут нужно реагировать только на Единорогов и ценой сброса карты.
🛠️ Задача для Бэкенда: Добавить триггер on_opponent_unicorn_effect и интерфейс для сброса карты в качестве платы за отмену.

81. Девятихвостый лисорог (Nine-Tailed Foxicorn)
Описание: Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 2 карты Единорогов. Затем получите случайную карту Единорога из КОЛОДЫ и добавьте ее в свою Конюшню. Затем перетасуйте КОЛОДУ. Если эта карта ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, получите случайную карту Единорога из КОЛОДЫ и добавьте ее в свою Конюшню.

json
{
  "id": "nine_tailed_foxicorn_ultimate",
  "name": "Девятихвостый лисорог",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 2 карты Единорогов. Затем получите случайную карту Единорога из КОЛОДЫ и добавьте ее в свою Конюшню. Затем перетасуйте КОЛОДУ. Если эта карта ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, получите случайную карту Единорога из КОЛОДЫ и добавьте ее в свою Конюшню.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn", "exclude_self": true }, "quantity": { "value": 2 } }
        },
        {
          "kind": "search",
          "target": { "scope": "self", "zone": "deck", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1, "mode": "random" } },
          "destination": "stable"
        },
        {
          "kind": "shuffle_deck"
        }
      ]
    },
    {
      "trigger": "when_destroyed",
      "actions": [
        {
          "kind": "search",
          "target": { "scope": "self", "zone": "deck", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1, "mode": "random" } },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет триггера on_sacrifice (если карту принесут в жертву, она не призовет нового единорога). Не работает quantity.mode: "random". Нет проверки успеха жертвоприношения (если не пожертвовал 2 карты, всё равно призовет).
🛠️ Задача для Бэкенда: Добавить on_sacrifice. Реализовать random поиск. Внедрить requires_success_of_previous.

82. Единорог коварного искусства (Artful Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ карту Единорога. Если одна из ваших карт Единорогов должна быть УНИЧТОЖЕНА, вы можете вместо этого ПОЖЕРТВОВАТЬ карту БОНУС или ШТРАФ.

json
{
  "id": "artful_unicorn_ultimate",
  "name": "Единорог коварного искусства",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ карту Единорога. Если одна из ваших карт Единорогов должна быть УНИЧТОЖЕНА, вы можете вместо этого ПОЖЕРТВОВАТЬ карту БОНУС или ШТРАФ.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn", "exclude_self": true }, "quantity": { "value": 1 } }
        }
      ]
    },
    {
      "trigger": "on_would_be_destroyed",
      "optional": true,
      "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn" } },
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": ["upgrade", "downgrade"] }, "quantity": { "value": 1 } }
        },
        {
          "kind": "prevent",
          "prevented_action": "destroy"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Триггер on_would_be_destroyed и действие prevent в движке отсутствуют. Замещающий эффект не сработает.
🛠️ Задача для Бэкенда: Реализовать перехват уничтожения (on_would_be_destroyed) и возможность отменить его ценой другого действия.

83. Единорог-Путешественник во времени (Time Traveler Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 2 карты. Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете посмотреть 3 верхних карты в КОЛОДЕ и вернуть их в любом порядке.

json
{
  "id": "time_traveler_unicorn_ultimate",
  "name": "Единорог-Путешественник во времени",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 2 карты. Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете посмотреть 3 верхних карты в КОЛОДЕ и вернуть их в любом порядке.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "any", "exclude_self": true }, "quantity": { "value": 2 } }
        }
      ]
    },
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "reveal",
          "target": { "scope": "self", "zone": "deck_top", "quantity": { "value": 3 } }
        },
        {
          "kind": "reorder_top",
          "target": { "scope": "self", "zone": "revealed_cards", "quantity": { "value": 3, "is_player_choice": true } },
          "destination": "deck_top"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Требуется UI для сканирования (Scry) — показать 3 карты и дать игроку перетащить их в нужном порядке.
🛠️ Задача для Бэкенда: Реализовать UI-модалку "Сканирование" (Scry) для перестановки верхних карт колоды.

84. Единорог ученый-ядерщик (Nuclear Scientist Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ карту. Если одна из карт в вашей Конюшне должна быть УНИЧТОЖЕНА, вы можете вместо этого СБРОСИТЬ 2 карты.

json
{
  "id": "nuclear_scientist_unicorn_ultimate",
  "name": "Единорог ученый-ядерщик",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ карту. Если одна из карт в вашей Конюшне должна быть УНИЧТОЖЕНА, вы можете вместо этого СБРОСИТЬ 2 карты.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "any", "exclude_self": true }, "quantity": { "value": 1 } }
        }
      ]
    },
    {
      "trigger": "on_would_be_destroyed",
      "optional": true,
      "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "any" } },
      "actions": [
        {
          "kind": "discard",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 2 } }
        },
        {
          "kind": "prevent",
          "prevented_action": "destroy"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Аналогично Карте 82. Нет замещающего эффекта (on_would_be_destroyed).
🛠️ Задача для Бэкенда: Реализовать перехват уничтожения и возможность сбросить 2 карты вместо уничтожения.

85. Единорог-гейм мастер (Game Master Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, СБРОСЬТЕ свою руку. Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ВЗЯТЬ дополнительную карту из КОЛОДЫ. Предел вашей руки увеличен на 3 карты.

json
{
  "id": "game_master_unicorn_ultimate",
  "name": "Единорог-гейм мастер",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, СБРОСЬТЕ свою руку. Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ВЗЯТЬ дополнительную карту из КОЛОДЫ. Предел вашей руки увеличен на 3 карты.",
  "static_properties": {
    "modify_hand_limit": 3
  },
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "discard",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 99 } }
        }
      ]
    },
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не умеет динамически менять лимит руки (modify_hand_limit). quantity.mode: "all" не работает (используем 99).
🛠️ Задача для Бэкенда: Реализовать статический модификатор modify_hand_limit, который увеличивает лимит карт на руке (обычно 7) на указанное значение.

86. Прародитель единорогов (Progenitor Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ карту Единорога. Затем получите случайную карту Единорога из КОЛОДЫ и добавьте ее в свою Конюшню. Затем перетасуйте КОЛОДУ.

json
{
  "id": "progenitor_unicorn_ultimate",
  "name": "Прародитель единорогов",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ карту Единорога. Затем получите случайную карту Единорога из КОЛОДЫ и добавьте ее в свою Конюшню. Затем перетасуйте КОЛОДУ.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn", "exclude_self": true }, "quantity": { "value": 1 } }
        },
        {
          "kind": "search",
          "target": { "scope": "self", "zone": "deck", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1, "mode": "random" } },
          "destination": "stable"
        },
        {
          "kind": "shuffle_deck"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет requires_success_of_previous. Если не пожертвовал, всё равно призовет. Не работает random.
🛠️ Задача для Бэкенда: Связка действий и поддержка random.

87. Триумфальный единорог (Triumphant Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, СБРОСЬТЕ карту. Каждый раз, когда другой игрок разыгрывает ШТРАФ в вашу Конюшню, вы можете получить СЛУЧАЙНУЮ карту БОНУС из КОЛОДЫ и добавить её в свою Конюшню. После этого перемешайте КОЛОДУ.

json
{
  "id": "triumphant_unicorn_ultimate",
  "name": "Триумфальный единорог",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, СБРОСЬТЕ карту. Каждый раз, когда другой игрок разыгрывает ШТРАФ в вашу Конюшню, вы можете получить СЛУЧАЙНУЮ карту БОНУС из КОЛОДЫ и добавить её в свою Конюшню. После этого перемешайте КОЛОДУ.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "discard",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 1 } }
        }
      ]
    },
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "reactive_trigger",
          "on_event": "on_opponent_plays_downgrade_into_your_stable",
          "optional": true,
          "actions": [
            {
              "kind": "search",
              "target": { "scope": "self", "zone": "deck", "filters": { "card_group": "upgrade" }, "quantity": { "value": 1, "mode": "random" } },
              "destination": "stable"
            },
            {
              "kind": "shuffle_deck"
            }
          ]
        }
      ]
    }
  ]
}
⚠️ Предыдущее: Триггер on_opponent_plays_downgrade_into_your_stable отсутствует в движке. Система слушателей (reactive_trigger) не реализована.
🛠️ Задача для Бэкенда: Реализовать триггер, реагирующий на розыгрыш Штрафа оппонентом в вашу Конюшню.

88. Академирог (Acadecorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете переместить БОНУС из своей Конюшни в Конюшню другого игрока. Если вы сделали это, УКРАДИТЕ БОНУС из Конюшни этого игрока.

json
{
  "id": "acadecorn_magic",
  "name": "Академирог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете переместить БОНУС из своей Конюшни в Конюшню другого игрока. Если вы сделали это, УКРАДИТЕ БОНУС из Конюшни этого игрока.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "give",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "upgrade" }, "quantity": { "value": 1 } },
          "destination_player": "chosen",
          "destination": "stable"
        },
        {
          "kind": "steal",
          "target_player": "chosen",
          "target": { "scope": "opponent", "zone": "stable", "filters": { "card_group": "upgrade" }, "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нужна связка requires_success_of_previous. Если игрок не отдал свой Бонус, он не должен красть.
🛠️ Задача для Бэкенда: Реализовать цепочки действий.

89. Блезнецы-единороги (Twin Unicorns)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 1 карту. Если вы сделали это, разыграйте 2 карты в фазе действия.

json
{
  "id": "twin_unicorns_magic",
  "name": "Блезнецы-единороги",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 1 карту. Если вы сделали это, разыграйте 2 карты в фазе действия.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "limit_actions",
          "target_player": "self",
          "action_type": "play",
          "limit": 2
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет связки (если не сбросил, всё равно получит 2 действия). Действие limit_actions может быть не доработано для увеличения лимита.
🛠️ Задача для Бэкенда: Реализовать requires_success_of_previous и доработать limit_actions.

90. Дингорог (Dingocorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете вернуть всех Малышей единорогов из Конюшен каждого игрока в ЯСЛИ.

json
{
  "id": "dingocorn_magic",
  "name": "Дингорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете вернуть всех Малышей единорогов из Конюшен каждого игрока в ЯСЛИ.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "return",
          "target_player": "all",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "subtype": "baby_unicorn" },
            "quantity": { "value": 99 }
          },
          "destination": "nursery"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: quantity.mode: "all" не работает (используем 99). Нужно убедиться, что действие return умеет возвращать карты в зону nursery (Ясли).
🛠️ Задача для Бэкенда: Поддержка quantity.mode: "all". Проверка работы возврата в nursery.

91. Единорог взаимного гарантированного уничтожения (Mutually Assured Destruction Unicorn)
Описание: Если эта карта ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, каждый игрок должен ПОЖЕРТВОВАТЬ карту.

json
{
  "id": "mad_unicorn_magic",
  "name": "Единорог взаимного гарантированного уничтожения",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, каждый игрок должен ПОЖЕРТВОВАТЬ карту.",
  "effects": [
    {
      "trigger": "when_destroyed",
      "actions": [
        {
          "kind": "sacrifice",
          "target_player": "all",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет триггера on_sacrifice (если карту принесут в жертву, эффект не сработает). Движок должен корректно обрабатывать игроков, у которых нет карт для жертвоприношения.
🛠️ Задача для Бэкенда: Добавить триггер on_sacrifice. Добавить обработку пустых целей.

92. Единорог милосердия (Merciful Unicorn)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ВЗЯТЬ из КОЛОДЫ дополнительную карту. Если вы это сделали, каждый другой игрок может ВЗЯТЬ из КОЛОДЫ дополнительную карту.

json
{
  "id": "merciful_unicorn_magic",
  "name": "Единорог милосердия",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ВЗЯТЬ из КОЛОДЫ дополнительную карту. Если вы это сделали, каждый другой игрок может ВЗЯТЬ из КОЛОДЫ дополнительную карту.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 1 } }
        },
        {
          "kind": "draw",
          "target_player": "others",
          "target": { "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет параметра target_player: "others" (только self, opponent, any, all). Игра должна дать возможность каждому другому игроку решить, брать ли ему карту.
🛠️ Задача для Бэкенда: Добавить скоуп others (все, кроме себя). Реализовать асинхронный запрос действия (брать/не брать) от каждого игрока.

93. Единорог правосудия (Justice Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете переместить карту Единорога из Конюшни с наибольшим количеством Единорогов в Конюшню с наименьшим количеством Единорогов.

json
{
  "id": "justice_unicorn_magic",
  "name": "Единорог правосудия",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете переместить карту Единорога из Конюшни с наибольшим количеством Единорогов в Конюшню с наименьшим количеством Единорогов.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "move",
          "target_player": "max_unicorns",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          },
          "destination_player": "min_unicorns",
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не умеет динамически вычислять игроков с максимальным/минимальным количеством карт.
🛠️ Задача для Бэкенда: Добавить скоупы max_unicorns и min_unicorns для target_player.

94. Единорог предсказывающий судьбу (Fate Predicting Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете посмотреть 3 верхних карты КОЛОДЫ, переместить любое количество из них в СБРОС, а оставшиеся вернуть наверх КОЛОДЫ в любом порядке.

json
{
  "id": "fate_unicorn_magic",
  "name": "Единорог предсказывающий судьбу",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете посмотреть 3 верхних карты КОЛОДЫ, переместить любое количество из них в СБРОС, а оставшиеся вернуть наверх КОЛОДЫ в любом порядке.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "scry",
          "amount": 3,
          "allow_discard": true
        }
      ]
    }
  ]
}
⚠️ Предупреждение: В движке нет готового действия scry.
🛠️ Задача для Бэкенда: Создать комплексное действие scry, которое показывает N карт, позволяет отправить часть в сброс, а оставшиеся перетасовать наверх.

95. Единорог-алхимик (Alchemist Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете выбрать любого игрока. УНИЧТОЖЬТЕ карту единорога в Конюшне этого игрока, а затем НАЙДИТЕ случайную карту Единорога в КОЛОДЕ и добавьте ее в Конюшню этого игрока. Перетасуйте КОЛОДУ.

json
{
  "id": "alchemist_unicorn_magic",
  "name": "Единорог-алхимик",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете выбрать любого игрока. УНИЧТОЖЬТЕ карту единорога в Конюшне этого игрока, а затем НАЙДИТЕ случайную карту Единорога в КОЛОДЕ и добавьте ее в Конюшню этого игрока. Перетасуйте КОЛОДУ.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "destroy",
          "target_player": "chosen",
          "target": { "scope": "any", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } },
          "bypass_triggers": true
        },
        {
          "kind": "search",
          "target_player": "chosen",
          "target": { "scope": "any", "zone": "deck", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1, "mode": "random" } },
          "destination_player": "chosen",
          "destination": "stable"
        },
        {
          "kind": "shuffle_deck"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нужно запомнить chosen игрока для всех последующих действий. Также нужен random поиск и bypass_triggers.
🛠️ Задача для Бэкенда: Сделать передачу chosen игрока между действиями. Поддержка random и bypass_triggers.

96. Единорог-Капканщик (Trapper Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете СБРОСИТЬ карту. Если вы это сделали, положите ШТРАФ из руки в Конюшню любого игрока.

json
{
  "id": "trapper_unicorn_magic",
  "name": "Единорог-Капканщик",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете СБРОСИТЬ карту. Если вы это сделали, положите ШТРАФ из руки в Конюшню любого игрока.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "move",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "downgrade" }, "quantity": { "value": 1 } },
          "destination_player": "chosen",
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нужна связка (если не сбросил карту, нельзя положить Штраф).
🛠️ Задача для Бэкенда: requires_success_of_previous.

97. Единорог-Карманник (Pickpocket Unicorn)
Описание: Когда эта карта покидает вашу Конюшню, вы можете ВЫТЯНУТЬ случайную карту из руки любого другого игрока.

json
{
  "id": "pickpocket_unicorn_magic",
  "name": "Единорог-Карманник",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта покидает вашу Конюшню, вы можете ВЫТЯНУТЬ случайную карту из руки любого другого игрока.",
  "effects": [
    {
      "trigger": "on_leave_stable",
      "optional": true,
      "actions": [
        {
          "kind": "steal",
          "target_player": "chosen",
          "target": { "scope": "any", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 1, "mode": "random" } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Триггер on_leave_stable отсутствует в движке. Режим random тоже не работает.
🛠️ Задача для Бэкенда: Добавить on_leave_stable. Реализовать random.

98. Единорог-нулевой пациент (Patient Zero Unicorn)
Описание: Каждый раз, когда любой игрок ЖЕРТВУЕТ карту, вместо этого он должен ПОЖЕРТВОВАТЬ 2 карты.

json
{
  "id": "patient_zero_unicorn_magic",
  "name": "Единорог-нулевой пациент",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Каждый раз, когда любой игрок ЖЕРТВУЕТ карту, вместо этого он должен ПОЖЕРТВОВАТЬ 2 карты.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "modify_action",
          "action_type": "sacrifice",
          "target_player": "all",
          "modifier": { "quantity": 2 }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Замещающие эффекты (изменение стоимости) движком не поддерживаются. Жертвоприношение всегда будет требовать 1 карту.
🛠️ Задача для Бэкенда: Реализовать систему модификаторов (Modifiers), которая перехватывает запрос на жертвоприношение и меняет требуемое количество карт на 2.

99. Единорог-регулировщик (Traffic Cop Unicorn)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете переместить БОНУС или ШТРАФ из Конюшни любого игрока в Конюшню любого другого игрока. Если сделали это, пропустите фазу действия.

json
{
  "id": "traffic_cop_unicorn_magic",
  "name": "Единорог-регулировщик",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете переместить БОНУС или ШТРАФ из Конюшни любого игрока в Конюшню любого другого игрока. Если сделали это, пропустите фазу действия.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "move",
          "target_player": "chosen",
          "target": { "scope": "any", "zone": "stable", "filters": { "card_group": ["upgrade", "downgrade"] }, "quantity": { "value": 1 } },
          "destination_player": "chosen_other",
          "destination": "stable"
        },
        {
          "kind": "skip_phase",
          "phase": "play"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Требуется выбор двух игроков (chosen и chosen_other). Нужна связка (если перемещение не удалось, фаза не пропускается).
🛠️ Задача для Бэкенда: Внедрить выбор двух целей. Связка requires_success_of_previous.

100. Единорог-таран (Battering Ram Unicorn)
Описание: Эту карту нельзя отменить.

json
{
  "id": "battering_ram_unicorn_magic",
  "name": "Единорог-таран",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Эту карту нельзя отменить.",
  "static_properties": {
    "cannot_be_neighed": true
  },
  "effects": []
}
⚠️ Предупреждение: Как и с Картой 50, флаг cannot_be_neighed может браться из хардкод-файла canReactFlags.ts, а не из JSON.
🛠️ Задача для Бэкенда: Добавить карту в canReactFlags.ts с флагом cannot_be_neighed: true.

101. Единорог-шпион (Spy Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, выберите любого другого игрока. Этот игрок должен показать вам свою руку.

json
{
  "id": "spy_unicorn_magic",
  "name": "Единорог-шпион",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, выберите любого другого игрока. Этот игрок должен показать вам свою руку.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "reveal",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 99 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не поддерживает просмотр чужой руки. Механика reveal обычно работает только для колоды. Кроме того, используется quantity: 99 вместо mode: "all".
🛠️ Задача для Бэкенда: Реализовать логику reveal_hand (показать карты руки конкретного игрока только тому, кто сыграл карту).

102. Единорожий пророк (Prophet Unicorn)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете посмотреть 2 верхние карты КОЛОДЫ и вернуть их в том же порядке.

json
{
  "id": "prophet_unicorn_magic",
  "name": "Единорожий пророк",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете посмотреть 2 верхние карты КОЛОДЫ и вернуть их в том же порядке.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "peek",
          "target": {
            "scope": "self",
            "zone": "deck_top",
            "quantity": { "value": 2 }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Экшена peek (посмотреть, но не менять) нет. Есть только scry (который тоже нужно допиливать). Вернуть их "в том же порядке" значит, что игрок не должен иметь возможности их менять.
🛠️ Задача для Бэкенда: Реализовать действие peek (показать верхние N карт без возможности их перестановки или сброса).

103. Жертвенный овцерог (Sacrificial Lamb Unicorn)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ПОЖЕРТВОВАТЬ эту карту, чтобы СБРОСИТЬ всю руку и ВЗЯТЬ 5 карт из КОЛОДЫ.

json
{
  "id": "sacrificial_lamb_unicorn_magic",
  "name": "Жертвенный овцерог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете ПОЖЕРТВОВАТЬ эту карту, чтобы СБРОСИТЬ всю руку и ВЗЯТЬ 5 карт из КОЛОДЫ.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "sacrifice",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "name": "Жертвенный овцерог" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "discard",
          "target": {
            "scope": "self",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 99 }
          }
        },
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 5 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нужна связка действий (если не пожертвовал, то не сбрасываешь руку). И quantity.mode: "all" не работает (используем 99).
🛠️ Задача для Бэкенда: requires_success_of_previous. Поддержка quantity.mode: "all".

104. Ленивцерог (Sloth Unicorn)
Описание: Если эта карта находится в вашей Конюшне, эффекты на вход в Конюшню ваших Магических единорогов не активируются.

json
{
  "id": "sloth_unicorn_magic",
  "name": "Ленивцерог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне, эффекты на вход в Конюшню ваших Магических единорогов не активируются.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "prevent",
          "prevented_action": "on_enter_stable",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "subtype": "magic" }
          }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Триггер while_in_stable и prevent не поддерживаются. Эффект не сработает.
🛠️ Задача для Бэкенда: (Повтор задачи к Карте 58). Реализовать "глушилку" триггеров входа в стойло для определенных типов карт.

105. Лисичкорог (Foxicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете выбрать любого игрока. Этот игрок должен замешать всю свою руку в КОЛОДУ, а потом ВЗЯТЬ 3 карты из КОЛОДЫ.

json
{
  "id": "foxicorn_magic",
  "name": "Лисичкорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете выбрать любого игрока. Этот игрок должен замешать всю свою руку в КОЛОДУ, а потом ВЗЯТЬ 3 карты из КОЛОДЫ.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "move",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 99 }
          },
          "destination": "deck"
        },
        {
          "kind": "shuffle_deck",
          "target": { "scope": "any", "zone": "deck" }
        },
        {
          "kind": "draw",
          "target_player": "chosen",
          "target": { "quantity": { "value": 3 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: quantity.mode: "all" не работает (используем 99). shuffle_deck не умеет перемешивать карты, только что добавленные из руки в колоду (нужно убедиться, что они попадают в общую стопку до тасовки).
🛠️ Задача для Бэкенда: Поддержка quantity.mode: "all". Убедиться, что move + shuffle_deck работают в связке.

106. Мама единорог (Mama Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете СБРОСИТЬ карту. Если вы сделали это, возьмите карту Малыша единорога из ЯСЛЕЙ и добавьте ее в свою Конюшню.

json
{
  "id": "mama_unicorn_magic",
  "name": "Мама единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете СБРОСИТЬ карту. Если вы сделали это, возьмите карту Малыша единорога из ЯСЛЕЙ и добавьте ее в свою Конюшню.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "pull",
          "target_player": "self",
          "target": { "scope": "self", "zone": "nursery", "filters": { "subtype": "baby_unicorn" }, "quantity": { "value": 1 } },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Связка действий (если не сбросил, не берет Малыша).
🛠️ Задача для Бэкенда: requires_success_of_previous.

107. Нимфорог (Nymph Unicorn)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, каждый игрок, у которого в Конюшне нет карты Магического единорога, должен СБРОСИТЬ 1 карту.

json
{
  "id": "nymph_unicorn_magic",
  "name": "Нимфорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, каждый игрок, у которого в Конюшне нет карты Магического единорога, должен СБРОСИТЬ 1 карту.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "actions": [
        {
          "kind": "conditional_loop",
          "target_player": "all",
          "condition": {
            "type": "has_card",
            "target": { "scope": "self", "zone": "stable", "filters": { "subtype": "magic" } },
            "negate": true 
          },
          "actions": [
            {
              "kind": "force_discard",
              "target": { "scope": "any", "zone": "hand", "quantity": { "value": 1 } }
            }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не умеет делать циклы по игрокам с проверкой сложных условий (есть ли у них карта определенного типа).
🛠️ Задача для Бэкенда: Реализовать conditional_loop (цикл по всем игрокам с проверкой условия перед применением действия).

108. Нянярог (Nanny Unicorn)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете положить карту Малыша единорога из ЯСЛЕЙ в вашу Конюшню. Если вы сделали это, не разыгрывайте карту во время фазы действий этого хода.

json
{
  "id": "nanny_unicorn_magic",
  "name": "Нянярог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете положить карту Малыша единорога из ЯСЛЕЙ в вашу Конюшню. Если вы сделали это, не разыгрывайте карту во время фазы действий этого хода.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "pull",
          "target_player": "self",
          "target": { "scope": "self", "zone": "nursery", "filters": { "subtype": "baby_unicorn" }, "quantity": { "value": 1 } },
          "destination": "stable"
        },
        {
          "kind": "skip_phase",
          "phase": "play"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Связка (если не взял Малыша, фаза не пропускается).
🛠️ Задача для Бэкенда: requires_success_of_previous. Проверить, что skip_phase умеет пропускать именно фазу розыгрыша (Play Phase).

109. Параллельный вселеннорог (Parallel Universe Unicorn)
Описание: Каждый раз, когда любой игрок СБРАСЫВАЕТ карту, вместо этого он может ВЗЯТЬ карту, если не достиг предела своей руки.

json
{
  "id": "parallel_universe_unicorn_magic",
  "name": "Параллельный вселеннорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Каждый раз, когда любой игрок СБРАСЫВАЕТ карту, вместо этого он может ВЗЯТЬ карту, если не достиг предела своей руки.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "modify_action",
          "action_type": "discard",
          "target_player": "any",
          "replacement_action": "draw",
          "condition": "hand_limit_not_reached"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Замещающих эффектов и проверки лимита руки в движке нет.
🛠️ Задача для Бэкенда: Реализовать модификаторы (замену) действий. Если игрок сбрасывает карту, предложить ему альтернативу (взять карту), если его рука не переполнена.

110. Пегий дудочник (Pied Piper Unicorn)
Описание: Когда любой другой игрок пытается добавить Малыша единорога из ЯСЛЕЙ в свою Конюшню, вы можете СБРОСИТЬ карту. Если сделали это, добавьте эту карту Малыша единорога в свою конюшню.

json
{
  "id": "pied_piper_unicorn_magic",
  "name": "Пегий дудочник",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда любой другой игрок пытается добавить Малыша единорога из ЯСЛЕЙ в свою Конюшню, вы можете СБРОСИТЬ карту. Если сделали это, добавьте эту карту Малыша единорога в свою конюшню.",
  "effects": [
    {
      "trigger": "on_opponent_pull_baby",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "steal",
          "target": { "scope": "stack", "filters": { "subtype": "baby_unicorn" }, "quantity": { "value": 1 } },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Это очень сложный перехват. Движок не умеет реагировать на действие "в процессе". Нужно перехватить момент, когда оппонент тянет Малыша из Яслей, и переадресовать карту.
🛠️ Задача для Бэкенда: Реализовать триггер on_opponent_pull_baby (срабатывает до того, как карта попадет к оппоненту). Связать со сбросом карты как платой за перехват.

111. Передаривающий Единорог (Regifting Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете переложить ШТРАФ из своей Конюшни в Конюшню любого другого игрока.

json
{
  "id": "regifting_unicorn_magic",
  "name": "Передаривающий Единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете переложить ШТРАФ из своей Конюшни в Конюшню любого другого игрока.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        {
          "kind": "move",
          "target_player": "self",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "card_group": "downgrade" },
            "quantity": { "value": 1 }
          },
          "destination_player": "chosen",
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет. Движок поддерживает move и destination_player: "chosen".

112. Страшный единорог-пират (Scary Pirate Unicorn)
Описание: Каждый раз, когда любой игрок СБРАСЫВАЕТ любое количество карт, вместо этого он СБРАСЫВАЕТ в 2 раза больше.

json
{
  "id": "scary_pirate_unicorn_magic",
  "name": "Страшный единорог-пират",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Каждый раз, когда любой игрок СБРАСЫВАЕТ любое количество карт, вместо этого он СБРАСЫВАЕТ в 2 раза больше.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "modify_action",
          "action_type": "discard",
          "target_player": "any",
          "modifier": { "multiplier": 2 }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не поддерживает модификаторы действий (изменение количества). Сброс всегда будет равен указанному в карте числу.
🛠️ Задача для Бэкенда: Реализовать систему модификаторов (Modifiers), которые динамически пересчитывают параметры действий (например, quantity * 2), если на столе есть карта с таким эффектом.

113. Троянский единорог (Trojan Unicorn)
Описание: Когда любой другой игрок разыгрывает карту Единорога, вы можете ПОЖЕРТВОВАТЬ эту карту. Если вы сделали это, УКРАДИТЕ эту карту Единорога.

json
{
  "id": "trojan_unicorn_magic",
  "name": "Троянский единорог",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда любой другой игрок разыгрывает карту Единорога, вы можете ПОЖЕРТВОВАТЬ эту карту. Если вы сделали это, УКРАДИТЕ эту карту Единорога.",
  "effects": [
    {
      "trigger": "on_opponent_plays_unicorn",
      "optional": true,
      "actions": [
        {
          "kind": "sacrifice",
          "target": {
            "scope": "self",
            "zone": "stable",
            "filters": { "name": "Троянский единорог" },
            "quantity": { "value": 1 }
          }
        },
        {
          "kind": "steal",
          "target": {
            "scope": "stack",
            "filters": { "card_group": "unicorn" },
            "quantity": { "value": 1 }
          },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Триггер on_opponent_plays_unicorn не поддерживается движком. Кроме того, нужно перехватить карту прямо из «Стека» (Stack) розыгрыша до того, как она попадет к оппоненту.
🛠️ Задача для Бэкенда: Реализовать триггер on_opponent_plays_unicorn (реакция на розыгрыш). Добавить возможность перехвата карты из стека (прежде чем она войдет в стойло).

114. Благословение архангела (Archangel's Blessing)
Описание: ПОЖЕРТВУЙТЕ карту Единорога, БОНУС и ШТРАФ. Получите случайные карты Единорога и БОНУС и добавьте их в свою Конюшню.

json
{
  "id": "archangels_blessing_spell",
  "name": "Благословение архангела",
  "type": "spell",
  "description": "ПОЖЕРТВУЙТЕ карту Единорога, БОНУС и ШТРАФ. Получите случайные карты Единорога и БОНУС и добавьте их в свою Конюшню.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "upgrade" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "downgrade" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "search",
          "target": { "scope": "self", "zone": "deck", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1, "mode": "random" } },
          "destination": "stable"
        },
        {
          "kind": "search",
          "target": { "scope": "self", "zone": "deck", "filters": { "card_group": "upgrade" }, "quantity": { "value": 1, "mode": "random" } },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Игрок должен пожертвовать все три карты. Если у него нет хотя бы одной (например, нет Штрафа), карта не должна разыгрываться. Нужен play_requirements (проверка наличия всех трех типов). Поиск работает только если все три жертвы принесены (requires_success_of_previous).
🛠️ Задача для Бэкенда: Реализовать проверку play_requirements (наличие карт разных типов). Связать три жертвоприношения в одну цепочку.

115. Контролируемое уничтожение (Controlled Destruction)
Описание: УНИЧТОЖЬТЕ карту в Конюшне любого игрока. Любые эффекты карты при этом не активируются.

json
{
  "id": "controlled_destruction_spell",
  "name": "Контролируемое уничтожение",
  "type": "spell",
  "description": "УНИЧТОЖЬТЕ карту в Конюшне любого игрока. Любые эффекты карты при этом не активируются.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "destroy",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          },
          "bypass_triggers": true
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Используется флаг bypass_triggers: true (как в Карте 40), который нужно реализовать на бэкенде.
🛠️ Задача для Бэкенда: Убедиться, что флаг bypass_triggers работает и не вызывает when_destroyed у уничтоженной карты.

116. Рост (Growth)
Описание: ПОЖЕРТВУЙТЕ карту Малыша единорога, чтобы получить случайную карту Единорога в КОЛОДЕ и добавить ее в свою Конюшню. Перемешайте колоду.

json
{
  "id": "growth_spell",
  "name": "Рост",
  "type": "spell",
  "description": "ПОЖЕРТВУЙТЕ карту Малыша единорога, чтобы получить случайную карту Единорога в КОЛОДЕ и добавить ее в свою Конюшню. Перемешайте колоду.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "subtype": "baby_unicorn" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "search",
          "target": { "scope": "self", "zone": "deck", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1, "mode": "random" } },
          "destination": "stable"
        },
        {
          "kind": "shuffle_deck"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Связка действий (если не пожертвовал, поиск отменяется). random режим требует доработки.
🛠️ Задача для Бэкенда: requires_success_of_previous, поддержка random.

117. Карусель (Carousel)
Описание: Каждый игрок должен отдать все карты из своей руки предыдущему по ходу игроку.

json
{
  "id": "carousel_spell",
  "name": "Карусель",
  "type": "spell",
  "description": "Каждый игрок должен отдать все карты из своей руки предыдущему по ходу игроку.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "pass_hands",
          "direction": "previous",
          "quantity": { "value": 99 }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Экшена pass_hands нет. Движку нужно знать порядок хода, чтобы понять, кто «предыдущий» игрок, и одновременно переместить всех.
🛠️ Задача для Бэкенда: Реализовать действие pass_hands (передача всей руки по кругу в определенном направлении).

118. Поисковые работы (Excavation)
Описание: Переворачивайте по 1 карте из колоды в стопку СБРОСА, пока не найдете карту Единорога. Добавьте его в свою Конюшню.

json
{
  "id": "excavation_spell",
  "name": "Поисковые работы",
  "type": "spell",
  "description": "Переворачивайте по 1 карте из колоды в стопку СБРОСА, пока не найдете карту Единорога. Добавьте его в свою Конюшню.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "mill_until",
          "target": { "scope": "self", "zone": "deck", "filters": { "card_group": "unicorn" } },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Экшена mill_until (сбрасывать, пока не найдется Х) в движке нет.
🛠️ Задача для Бэкенда: Реализовать действие mill_until, которое берет верхнюю карту, сбрасывает её в discard и повторяет цикл, пока не найдет нужный тип карты.

119. Радужный мост (Rainbow Bridge)
Описание: ВОЗЬМИТЕ из КОЛОДЫ карту. Если это БОНУС, ШТРАФ или карта Единорога, добавьте ее в свою Конюшню и ВОЗЬМИТЕ ещё одну карту из КОЛОДЫ. Если любая другая карта, ВОЗЬМИТЕ её в свою руку.

json
{
  "id": "rainbow_bridge_spell",
  "name": "Радужный мост",
  "type": "spell",
  "description": "ВОЗЬМИТЕ из КОЛОДЫ карту. Если это БОНУС, ШТРАФ или карта Единорога, добавьте ее в свою Конюшню и ВОЗЬМИТЕ ещё одну карту из КОЛОДЫ. Если любая другая карта, ВОЗЬМИТЕ её в свою руку.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "draw_conditional",
          "target": { "scope": "self", "zone": "deck", "quantity": { "value": 1 } },
          "condition": { "card_group": ["unicorn", "upgrade", "downgrade"] },
          "on_success": { "destination": "stable", "sub_action": "draw", "sub_quantity": 1 },
          "on_fail": { "destination": "hand" }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не поддерживает условный добор (draw_conditional).
🛠️ Задача для Бэкенда: Реализовать действие draw_conditional (взять карту, проверить ее тип и перенаправить в разные зоны).

120. Весенняя уборка (Spring Cleaning)
Описание: СБРОСЬТЕ любое количество карт. Выберите столько игроков, сколько карт вы СБРОСИЛИ и УНИЧТОЖЬТЕ карту Единорога в Конюшне каждого из них.

json
{
  "id": "spring_cleaning_spell",
  "name": "Весенняя уборка",
  "type": "spell",
  "description": "СБРОСЬТЕ любое количество карт. Выберите столько игроков, сколько карт вы СБРОСИЛИ и УНИЧТОЖЬТЕ карту Единорога в Конюшне каждого из них.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "discard",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": "X", "mode": "up_to" } },
          "set_variable": "X"
        },
        {
          "kind": "destroy",
          "target_player": "chosen",
          "target": { "scope": "any", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": "$X" } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не поддерживает режим up_to (сбросить сколько хочешь). Он не умеет передавать динамическую переменную $X в количество целей.
🛠️ Задача для Бэкенда: Реализовать quantity.mode: "up_to" (игрок сам выбирает, сколько сбросить). Реализовать передачу переменных в quantity.value для выбора нескольких целей.

121. Временной парадокс (Temporal Paradox)
Описание: Верните по 1 карте из Конюшни каждого игрока в его руку. Затем ВОЗЬМИТЕ 1 карту из КОЛОДЫ.

json
{
  "id": "temporal_paradox_spell",
  "name": "Временной парадокс",
  "type": "spell",
  "description": "Верните по 1 карте из Конюшни каждого игрока в его руку. Затем ВОЗЬМИТЕ 1 карту из КОЛОДЫ.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "return",
          "target_player": "all",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "any" },
            "quantity": { "value": 1 }
          },
          "destination": "hand"
        },
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Для действия target_player: "all" движок должен последовательно дать каждому игроку выбрать карту для возврата. Если у кого-то нет карт, он должен пропускаться.
🛠️ Задача для Бэкенда: Убедиться, что return для all работает итеративно для каждого игрока.

122. Временной разлом (Time Rift)
Описание: Выберите любого игрока. Верните все карты из его Конюшни в его руку, а затем немедленно добавьте эти карты из его руки в его Конюшню с активацией всех эффектов карт в зависимости от вхождения в Конюшню.

json
{
  "id": "time_rift_spell",
  "name": "Временной разлом",
  "type": "spell",
  "description": "Выберите любого игрока. Верните все карты из его Конюшни в его руку, а затем немедленно добавьте эти карты из его руки в его Конюшню с активацией всех эффектов карт в зависимости от вхождения в Конюшню.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "return",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "stable",
            "filters": { "card_group": "any" },
            "quantity": { "value": 99 }
          },
          "destination": "hand"
        },
        {
          "kind": "move",
          "target_player": "chosen",
          "target": {
            "scope": "any",
            "zone": "hand",
            "filters": { "card_group": "any" },
            "quantity": { "value": 99 }
          },
          "destination": "stable",
          "triggers_effects": true
        }
      ]
    }
  ]
}
⚠️ Предупреждение: quantity.mode: "all" не работает (используем 99). Главная проблема: действие move в текущем движке не вызывает триггеры on_enter_stable (эффекты при входе).
🛠️ Задача для Бэкенда: Реализовать флаг triggers_effects: true для действия move. Поддержка quantity.mode: "all".

123. Точно не два единорога (Definitely Not Two Unicorns)
Описание: ВОЗЬМИТЕ карту из КОЛОДЫ. Затем разыграйте 2 карты с руки. Пропустите свой следующий ход.

json
{
  "id": "definitely_not_two_spell",
  "name": "Точно не два единорога",
  "type": "spell",
  "description": "ВОЗЬМИТЕ карту из КОЛОДЫ. Затем разыграйте 2 карты с руки. Пропустите свой следующий ход.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 1 } }
        },
        {
          "kind": "limit_actions",
          "target_player": "self",
          "action_type": "play",
          "limit": 2
        },
        {
          "kind": "skip_turn",
          "target_player": "self"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Действия skip_turn (пропуск следующего хода целиком) в движке нет. Есть только пропуск фаз.
🛠️ Задача для Бэкенда: Реализовать статус-эффект skip_turn (при следующей передаче хода этот игрок пропускается).

124. Единорожий черный рынок (Unicorn Black Market)
Описание: Выберите другого игрока. Выберите 2 карты из его руки и добавьте их в свою руку. Этот игрок может выбрать 1 карту из вашей руки и добавить в свою руку. Игрок не может выбрать карты, которые вы взяли у него.

json
{
  "id": "black_market_spell",
  "name": "Единорожий черный рынок",
  "type": "spell",
  "description": "Выберите другого игрока. Выберите 2 карты из его руки и добавьте их в свою руку. Этот игрок может выбрать 1 карту из вашей руки и добавить в свою руку. Игрок не может выбрать карты, которые вы взяли у него.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "steal",
          "target_player": "chosen",
          "target": { "scope": "any", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 2, "is_player_choice": true } }
        },
        {
          "kind": "steal",
          "target_player": "self",
          "target": { "scope": "any", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 1, "is_player_choice": true, "exclude_tags": ["stolen_this_turn"] } },
          "destination_player": "chosen"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Очень сложная асинхронность. Игрок 1 выбирает 2 карты, затем Игрок 2 выбирает 1 карту. Движок должен уметь ставить игру на паузу и ждать выбора второго игрока.
🛠️ Задача для Бэкенда: Реализовать цепочки асинхронных выборов от разных игроков. Добавить систему меток (тегов), чтобы второй игрок не мог выбрать только что украденные карты.

125. Единорожья ловушка (Unicorn Trap)
Описание: УКРАДИТЕ карту Единорога.

json
{
  "id": "unicorn_trap_spell",
  "name": "Единорожья ловушка",
  "type": "spell",
  "description": "УКРАДИТЕ карту Единорога.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "steal",
          "target_player": "chosen",
          "target": { "scope": "any", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет. Карта полностью поддерживается движком.

126. Единороги навсегда (Unicorns Forever)
Описание: Замешайте стопку СБРОСА и КОЛОДУ. Получите случайную карту Единорога из КОЛОДЫ и добавьте в свою конюшню. Каждый другой игрок может ВЗЯТЬ карту из КОЛОДЫ.

json
{
  "id": "unicorns_forever_spell",
  "name": "Единороги навсегда",
  "type": "spell",
  "description": "Замешайте стопку СБРОСА и КОЛОДУ. Получите случайную карту Единорога из КОЛОДЫ и добавьте в свою конюшню. Каждый другой игрок может ВЗЯТЬ карту из КОЛОДЫ.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "shuffle_deck",
          "target": { "scope": "any", "zone": "discard" }
        },
        {
          "kind": "search",
          "target_player": "self",
          "target": { "scope": "self", "zone": "deck", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1, "mode": "random" } },
          "destination": "stable"
        },
        {
          "kind": "draw",
          "target_player": "others",
          "optional": true,
          "target": { "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: shuffle_deck из сброса не работает. random поиск не работает. target_player: "others" не поддерживается.
🛠️ Задача для Бэкенда: Добавить все эти три механики.

127. Единороготопия (Unicornotopia)
Описание: ВОЗЬМИТЕ из КОЛОДЫ карты до предела своей руки. Остальные игроки могут ВЗЯТЬ по 2 карты из КОЛОДЫ.

json
{
  "id": "unicornotopia_spell",
  "name": "Единороготопия",
  "type": "spell",
  "description": "ВОЗЬМИТЕ из КОЛОДЫ карты до предела своей руки. Остальные игроки могут ВЗЯТЬ по 2 карты из КОЛОДЫ.",
  "effects": [
    {
      "trigger": "on_play",
      "actions": [
        {
          "kind": "draw_until_limit",
          "target_player": "self"
        },
        {
          "kind": "draw",
          "target_player": "others",
          "optional": true,
          "target": { "quantity": { "value": 2 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Действия draw_until_limit (добор до лимита) нет. Скоупа others нет.
🛠️ Задача для Бэкенда: Реализовать draw_until_limit (брать карты, пока рука не достигнет 7). Добавить скоуп others.

128. Пуленепробиваемый жилет (Bulletproof Vest)
Описание: Играйте эту карту, когда любой другой игрок пытается УНИЧТОЖИТЬ карту в вашей Конюшне. Отмените эффект уничтожения и ВОЗЬМИТЕ 1 карту из КОЛОДЫ.

json
{
  "id": "bulletproof_vest_instant",
  "name": "Пуленепробиваемый жилет",
  "type": "instant",
  "description": "Играйте эту карту, когда любой другой игрок пытается УНИЧТОЖИТЬ карту в вашей Конюшне. Отмените эффект уничтожения и ВОЗЬМИТЕ 1 карту из КОЛОДЫ.",
  "effects": [
    {
      "trigger": "on_would_be_destroyed",
      "actions": [
        {
          "kind": "cancel",
          "target": { "scope": "stack" }
        },
        {
          "kind": "draw",
          "target_player": "self",
          "target": { "quantity": { "value": 1 } }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Триггер on_would_be_destroyed не реализован. Окно реакции (Neigh) работает только как обычная отмена карты, а не как специфический перехват уничтожения.
🛠️ Задача для Бэкенда: Добавить триггер on_would_be_destroyed и специфический тип окна реакции для него.

129. Дестабилизировать (Destabilize)
Описание: Играйте эту карту, когда любой другой игрок пытается разыграть БОНУС или ШТРАФ. Выберите Конюшню, к которой добавится разыгранная карта.

json
{
  "id": "destabilize_instant",
  "name": "Дестабилизировать",
  "type": "instant",
  "description": "Играйте эту карту, когда любой другой игрок пытается разыграть БОНУС или ШТРАФ. Выберите Конюшню, к которой добавится разыгранная карта.",
  "effects": [
    {
      "trigger": "on_opponent_plays_upgrade_downgrade",
      "actions": [
        {
          "kind": "redirect_target",
          "new_target_player": "chosen"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет триггера реакции на Бонус/Штраф. Нет действия redirect_target (изменение цели карты, которая еще находится в стеке).
🛠️ Задача для Бэкенда: Добавить возможность изменения цели (Target) у карты, находящейся в стеке, до момента ее разрешения (Resolve).

130. Имитация (Simulation)
Описание: Играйте эту карту, когда любой другой игрок пытается разыграть карту Единорога. Добавьте карту Обычного единорога из вашей руки в вашу Конюшню.

json
{
  "id": "simulation_instant",
  "name": "Имитация",
  "type": "instant",
  "description": "Играйте эту карту, когда любой другой игрок пытается разыграть карту Единорога. Добавьте карту Обычного единорога из вашей руки в вашу Конюшню.",
  "effects": [
    {
      "trigger": "on_opponent_plays_unicorn",
      "actions": [
        {
          "kind": "add",
          "target_player": "self",
          "target": { "scope": "self", "zone": "hand", "filters": { "subtype": "basic" }, "quantity": { "value": 1 } },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Триггер on_opponent_plays_unicorn не реализован (как и в Карте 113).
🛠️ Задача для Бэкенда: Реализовать триггер on_opponent_plays_unicorn.

131. Отмена (Neigh) — ИСПРАВЛЕНО
Описание: Отмените активацию эффекта той карты и СБРОСЬТЕ ее.

json
{
  "id": "neigh_instant",
  "name": "Отмена",
  "type": "instant",
  "instant_subtype": "neigh",
  "description": "Играйте эту карту, когда любой другой игрок пытается сыграть свою карту. Отмените активацию эффекта той карты и СБРОСЬТЕ ее.",
  "static_properties": {
    "can_cancel": ["all"],
    "cannot_cancel": ["super_neigh"]
  },
  "effects": [
    {
      "trigger": "on_opponent_play",
      "actions": [
        {
          "kind": "cancel",
          "target": { "scope": "stack" }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Карта может отменить Перемотку (так как cannot_cancel содержит только super_neigh).

132. Супер отмена (Super Neigh) — ИСПРАВЛЕНО
Описание: Отмените активацию эффекта той карты и СБРОСЬТЕ ее. Эта карта не может быть отменена картами Отмены.

json
{
  "id": "super_neigh_instant",
  "name": "Супер отмена",
  "type": "instant",
  "instant_subtype": "super_neigh",
  "description": "Играйте эту карту, когда любой другой игрок пытается сыграть свою карту. Отмените активацию эффекта той карты и СБРОСЬТЕ ее. Эта карта не может быть отменена картами Отмены.",
  "static_properties": {
    "can_cancel": ["all", "neigh", "rewind"], 
    "cannot_cancel": ["super_neigh"],
    "immune_to_neigh": true 
  },
  "effects": [
    {
      "trigger": "on_opponent_play",
      "actions": [
        {
          "kind": "cancel",
          "target": { "scope": "stack" }
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Флаг immune_to_neigh: true защищает её от обычной Отмены. Она может отменить Перемотку, но не может отменить другую Супер Отмену.

133. Перемотка (Rewind) — ИСПРАВЛЕНО
Описание: Отмените активацию эффекта той карты и положите ее наверх КОЛОДЫ.

json
{
  "id": "rewind_instant",
  "name": "Перемотка",
  "type": "instant",
  "instant_subtype": "rewind",
  "description": "Играйте эту карту, когда любой другой игрок пытается сыграть свою карту. Отмените активацию эффекта той карты и положите ее наверх КОЛОДЫ.",
  "static_properties": {
    "can_cancel": ["all", "super_neigh"], 
    "cannot_cancel": []
  },
  "effects": [
    {
      "trigger": "on_opponent_play",
      "actions": [
        {
          "kind": "cancel",
          "target": { "scope": "stack" }
        },
        {
          "kind": "move",
          "target": { "scope": "stack" },
          "destination": "deck_top"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: У Перемотки нет иммунитетов. Её можно отменить обычной Отменой или Супер Отменой.

134. Контролируемый хаос (Controlled Chaos)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 2 карты, чтобы УНИЧТОЖИТЬ карту Единорога или получить случайную карту Единорога из КОЛОДЫ и добавить её в свою руку. Затем перемешайте колоду.

json
{
  "id": "controlled_chaos_upgrade",
  "name": "Контролируемый хаос",
  "type": "upgrade",
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 2 карты, чтобы УНИЧТОЖИТЬ карту Единорога или получить случайную карту Единорога из КОЛОДЫ и добавить её в свою руку. Затем перемешайте колоду.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 2 } }
        },
        {
          "kind": "choice",
          "options": [
            {
              "kind": "destroy",
              "target_player": "chosen",
              "target": { "scope": "any", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } }
            },
            {
              "kind": "search",
              "target": { "scope": "self", "zone": "deck", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1, "mode": "random" } },
              "destination": "hand"
            }
          ]
        },
        {
          "kind": "shuffle_deck"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Использует экшен choice (не поддерживается). Нужна связка (если не сбросил 2 карты, выбор не работает). random поиск не работает.
🛠️ Задача для Бэкенда: Реализовать choice, requires_success_of_previous, random поиск.

135. Дополнительная жизнь (Extra Life)
Описание: Если карта Единорога в любом стойле была ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, вы можете ПОЖЕРТВОВАТЬ этой картой. Если вы сделали это, перенесите эту карту Единорога из стопки СБРОСА в свою Конюшню.

json
{
  "id": "extra_life_upgrade",
  "name": "Дополнительная жизнь",
  "type": "upgrade",
  "description": "Если карта Единорога в любом стойле была ПОЖЕРТВОВАНА или УНИЧТОЖЕНА, вы можете ПОЖЕРТВОВАТЬ этой картой. Если вы сделали это, перенесите эту карту Единорога из стопки СБРОСА в свою Конюшню.",
  "effects": [
    {
      "trigger": "on_any_unicorn_sacrificed_or_destroyed",
      "optional": true,
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "name": "Дополнительная жизнь" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "move",
          "target": { "scope": "discard", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } },
          "destination": "stable"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Триггер on_any_unicorn_sacrificed_or_destroyed (глобальный перехват) отсутствует. Нужно запомнить, какая именно карта была уничтожена, чтобы перенести её.
🛠️ Задача для Бэкенда: Реализовать глобальные триггеры на события. Реализовать передачу контекста (какая карта ушла в сброс) в следующее действие.

136. Предвидение (Foresight)
Описание: Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете посмотреть 3 верхних карты колоды. Если вы сделали это, возьмите 1 из этих карт в руку, а остальные верните в КОЛОДУ и перемешайте КОЛОДУ. Затем пропустите фазу ДОБОРА.

json
{
  "id": "foresight_upgrade",
  "name": "Предвидение",
  "type": "upgrade",
  "description": "Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете посмотреть 3 верхних карты колоды. Если вы сделали это, возьмите 1 из этих карт в руку, а остальные верните в КОЛОДУ и перемешайте КОЛОДУ. Затем пропустите фазу ДОБОРА.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        {
          "kind": "scry",
          "amount": 3,
          "take_one_to_hand": true,
          "shuffle_rest": true
        },
        {
          "kind": "skip_phase",
          "phase": "draw"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нужен новый вариант scry (взять 1, остальное перемешать в колоду). Нужна связка действий (если отказался от просмотра, фаза не пропускается).
🛠️ Задача для Бэкенда: Расширить экшен scry (добавить опции take_one_to_hand и shuffle_rest). Связка requires_success_of_previous.

137. Стакан наполовину полон (Glass Half Full)
Описание: Каждый раз, когда в вашу Конюшню добавляется карта ШТРАФ, вы можете получить случайную карту БОНУС из КОЛОДЫ и добавить в свою Конюшню. Затем перемешайте КОЛОДУ.

json
{
  "id": "glass_half_full_upgrade",
  "name": "Стакан наполовину полон",
  "type": "upgrade",
  "description": "Каждый раз, когда в вашу Конюшню добавляется карта ШТРАФ, вы можете получить случайную карту БОНУС из КОЛОДЫ и добавить в свою Конюшню. Затем перемешайте КОЛОДУ.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "reactive_trigger",
          "on_event": "on_downgrade_enters_self_stable",
          "optional": true,
          "actions": [
            {
              "kind": "search",
              "target": { "scope": "self", "zone": "deck", "filters": { "card_group": "upgrade" }, "quantity": { "value": 1, "mode": "random" } },
              "destination": "stable"
            },
            {
              "kind": "shuffle_deck"
            }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Триггер on_downgrade_enters_self_stable отсутствует. Нет системы слушателей (reactive_trigger). random не работает.
🛠️ Задача для Бэкенда: Добавить триггер входа Штрафа в стойло. Реализовать систему слушателей.

138. Воображаемый другорог (Imaginary Friendicorn)
Описание: Если в вашей Конюшне есть карта Малыша единорога, то для победы вам нужно на 1 Единорога меньше.

json
{
  "id": "imaginary_friendicorn_upgrade",
  "name": "Воображаемый другорог",
  "type": "upgrade",
  "description": "Если в вашей Конюшне есть карта Малыша единорога, то для победы вам нужно на 1 Единорога меньше.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "condition": {
        "operator": "AND",
        "rules": [
          { "type": "has_card", "target": { "scope": "self", "zone": "stable", "filters": { "subtype": "baby_unicorn" } } }
        ]
      },
      "actions": [
        {
          "kind": "modify_win_condition",
          "target_player": "self",
          "modifier": -1
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Движок не проверяет условия (condition). Модификатор победы сработает, даже если Малыша нет.
🛠️ Задача для Бэкенда: Реализовать проверку условий в пассивных аурах (while_in_stable + condition) перед применением модификатора.

139. Протест (Protest) — ИСПРАВЛЕНО
Описание: Когда любой другой игрок пытается разыграть карту Отмены, вы можете СБРОСИТЬ карту... остановите разыгрывание...

json
{
  "id": "protest_upgrade",
  "name": "Протест",
  "type": "upgrade",
  "description": "Когда любой другой игрок пытается разыграть карту Отмены, вы можете СБРОСИТЬ карту. Если сделали это, остановите разыгрывание этой карты и верните карту Отмены в руку владельца. Этот игрок не может разыгрывать карты Отмены в этот ход.",
  "static_properties": {
    "can_cancel": ["super_neigh"]
  },
  "effects": [
    {
      "trigger": "on_opponent_plays_neigh",
      "optional": true,
      "actions": [
        {
          "kind": "discard",
          "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "cancel",
          "target": { "scope": "stack" }
        },
        {
          "kind": "return",
          "target": { "scope": "stack" },
          "destination": "hand"
        },
        {
          "kind": "restrict_action",
          "target_player": "opponent",
          "action_type": "play_neigh",
          "duration": "turn"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Это статический бонус, который работает как "Ловушка". Он перехватывает Супер Отмену (согласно вашему уточнению), заставляет сбросить карту и возвращает Отмену в руку.

140. Антимагический пузырь (Anti-Magic Bubble)
Описание: Когда эта карта добавляется в вашу Конюшню, ПОЖЕРТВУЙТЕ все карты ШТРАФ. Вы не можете играть карты ЗАКЛИНАНИЕ. Если в вашу Конюшню добавляется ШТРАФ, ПОЖЕРТВУЙТЕ эту карту.

json
{
  "id": "anti_magic_bubble_downgrade",
  "name": "Антимагический пузырь",
  "type": "downgrade",
  "description": "Когда эта карта добавляется в вашу Конюшню, ПОЖЕРТВУЙТЕ все карты ШТРАФ. Вы не можете играть карты ЗАКЛИНАНИЕ. Если в вашу Конюшню добавляется ШТРАФ, ПОЖЕРТВУЙТЕ эту карту.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "downgrade", "exclude_self": true }, "quantity": { "value": 99 } }
        }
      ]
    },
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "restrict_action",
          "target_player": "self",
          "action_type": "play_spell"
        },
        {
          "kind": "reactive_trigger",
          "on_event": "on_downgrade_enters_self_stable",
          "actions": [
            {
              "kind": "sacrifice",
              "target": { "scope": "self", "zone": "stable", "filters": { "name": "Антимагический пузырь" }, "quantity": { "value": 1 } }
            }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет while_in_stable. Нет запрета на типы карт (restrict_action). Нет слушателей для входа Штрафа.
🛠️ Задача для Бэкенда: Реализовать запрет на розыгрыш Заклинаний, пока эта карта на столе. Реализовать самоуничтожение при входе другого Штрафа.

141. Черная дыра (Black Hole)
Описание: Если эта карта в вашей Конюшне в начале вашего хода, ПОЖЕРТВУЙТЕ карту Магического единорога. Получите случайную карту Обычного единорога из КОЛОДЫ и добавьте в свою Конюшню. Перемешайте КОЛОДУ.

json
{
  "id": "black_hole_downgrade",
  "name": "Черная дыра",
  "type": "downgrade",
  "description": "Если эта карта в вашей Конюшне в начале вашего хода, ПОЖЕРТВУЙТЕ карту Магического единорога. Получите случайную карту Обычного единорога из КОЛОДЫ и добавьте в свою Конюшню. Перемешайте КОЛОДУ.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "actions": [
        {
          "kind": "sacrifice",
          "target": { "scope": "self", "zone": "stable", "filters": { "subtype": "magic" }, "quantity": { "value": 1 } }
        },
        {
          "kind": "search",
          "target": { "scope": "self", "zone": "deck", "filters": { "subtype": "basic" }, "quantity": { "value": 1, "mode": "random" } },
          "destination": "stable"
        },
        {
          "kind": "shuffle_deck"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Если у игрока нет Магического единорога, движок не должен заставлять его жертвовать что-то другое. Нужна проверка успеха первого действия. random поиск не работает.
🛠️ Задача для Бэкенда: Реализовать requires_success_of_previous, поддержку random.

142. Мозг замерз (Brain Freeze)
Описание: Вы не можете играть Мгновенными картами.

json
{
  "id": "brain_freeze_downgrade",
  "name": "Мозг замерз",
  "type": "downgrade",
  "description": "Вы не можете играть Мгновенными картами.",
  "static_properties": {
    "play_restrictions": [
      { "type": "card_type", "value": "instant", "target": "self" }
    ]
  },
  "effects": []
}
⚠️ Предупреждение: Движок не считывает play_restrictions из JSON для блокировки розыгрыша карт (берет из хардкода).
🛠️ Задача для Бэкенда: Научить движок динамически проверять play_restrictions у всех карт на столе.

143. Котострофа (Cata-strophe)
Описание: Все ваши единороги считаются кошками. (Действия такие же как и у панд)

json
{
  "id": "catastrophe_downgrade",
  "name": "Котострофа",
  "type": "downgrade",
  "description": "Все ваши единороги считаются кошками. (Действия такие же как и у панд)",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "set_flag",
          "target_player": "self",
          "flag": "transforms_unicorn",
          "value": "cat"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: while_in_stable не поддерживается. Если сработает, то флаг transforms_unicorn обычно статический, а не аура на других карт.
🛠️ Задача для Бэкенда: Реализовать пассивные ауры (while_in_stable). Добавить тип трансформации cat.

144. Зеленая трава на чужом лугу (Grass is Greener)
Описание: Если эта карта в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 3 карты. Если сделали это, ПОЖЕРТВУЙТЕ эту карту. Если не сделали, переместите карту Единорога из своей Конюшни в Конюшню любого другого игрока.

json
{
  "id": "grass_is_greener_downgrade",
  "name": "Зеленая трава на чужом лугу",
  "type": "downgrade",
  "description": "Если эта карта в вашей Конюшне в начале вашего хода, вы можете СБРОСИТЬ 3 карты. Если сделали это, ПОЖЕРТВУЙТЕ эту карту. Если не сделали, переместите карту Единорога из своей Конюшни в Конюшню любого другого игрока.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "actions": [
        {
          "kind": "choice",
          "options": [
            {
              "label": "Сбросить 3 карты",
              "actions": [
                { "kind": "discard", "target": { "scope": "self", "zone": "hand", "quantity": { "value": 3 } } },
                { "kind": "sacrifice", "target": { "scope": "self", "zone": "stable", "filters": { "name": "Зеленая трава на чужом лугу" }, "quantity": { "value": 1 } } }
              ]
            },
            {
              "label": "Отдать единорога",
              "actions": [
                { "kind": "move", "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } }, "destination_player": "chosen", "destination": "stable" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Требует реализации экшена choice с вложенными цепочками действий.
🛠️ Задача для Бэкенда: Реализовать choice.

145. Выдропокалипсис (Otter-pocalypse)
Описание: Все ваши единороги считаются выдрами. (Действия как у панд и котов)

json
{
  "id": "otter_pocalypse_downgrade",
  "name": "Выдропокалипсис",
  "type": "downgrade",
  "description": "Все ваши единороги считаются выдрами. (Действия как у панд и котов)",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "set_flag",
          "target_player": "self",
          "flag": "transforms_unicorn",
          "value": "otter"
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Аналогично Карте 143.
🛠️ Задача для Бэкенда: Реализовать пассивные ауры (while_in_stable). Добавить тип трансформации otter.

146. Выпас запрещен (No Grazing)
Описание: Когда эта карта добавляется в вашу Конюшню, ПОЖЕРТВУЙТЕ все карты ШТРАФ. Вы не можете играть карты Магических единорогов. Если в вашу Конюшню добавляется карта ШТРАФ, ПОЖЕРТВУЙТЕ эту карту.

json
{
  "id": "no_grazing_downgrade",
  "name": "Выпас запрещен",
  "type": "downgrade",
  "description": "Когда эта карта добавляется в вашу Конюшню, ПОЖЕРТВУЙТЕ все карты ШТРАФ. Вы не можете играть карты Магических единорогов. Если в вашу Конюшню добавляется карта ШТРАФ, ПОЖЕРТВУЙТЕ эту карту.",
  "static_properties": {
    "play_restrictions": [
      { "type": "card_subtype", "value": "magic", "target": "self" }
    ]
  },
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        { "kind": "sacrifice", "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "downgrade", "exclude_self": true }, "quantity": { "value": 99 } } }
      ]
    },
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "reactive_trigger",
          "on_event": "on_downgrade_enters_self_stable",
          "actions": [
            { "kind": "sacrifice", "target": { "scope": "self", "zone": "stable", "filters": { "name": "Выпас запрещен" }, "quantity": { "value": 1 } } }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет системы слушателей (reactive_trigger). play_restrictions не читается из JSON.
🛠️ Задача для Бэкенда: Реализовать слушатели событий. Добавить проверку play_restrictions (запрет по подтипу).

147. Похищение единорогов (Unicorn Kidnapping)
Описание: Если эта карта в вашей Конюшне в начале вашего хода, замешайте Единорога из своей Конюшни в КОЛОДУ, затем ВОЗЬМИТЕ карту из КОЛОДЫ. Если в какой-то момент у вас в Конюшне нет Единорогов, ПОЖЕРТВУЙТЕ эту карту.

json
{
  "id": "unicorn_kidnapping_downgrade",
  "name": "Похищение единорогов",
  "type": "downgrade",
  "description": "Если эта карта в вашей Конюшне в начале вашего хода, замешайте Единорога из своей Конюшни в КОЛОДУ, затем ВОЗЬМИТЕ карту из КОЛОДЫ. Если в какой-то момент у вас в Конюшне нет Единорогов, ПОЖЕРТВУЙТЕ эту карту.",
  "effects": [
    {
      "trigger": "on_turn_start",
      "actions": [
        { "kind": "move", "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } }, "destination": "deck" },
        { "kind": "shuffle_deck" },
        { "kind": "draw", "target_player": "self", "target": { "quantity": { "value": 1 } } }
      ]
    },
    {
      "trigger": "while_in_stable",
      "condition": {
        "rules": [
          { "type": "count_in_zone", "target": "self_stable", "card_group": "unicorn", "comparison": "==", "value": 0 }
        ]
      },
      "actions": [
        { "kind": "sacrifice", "target": { "scope": "self", "zone": "stable", "filters": { "name": "Похищение единорогов" }, "quantity": { "value": 1 } } }
      ]
    }
  ]
}
⚠️ Предупреждение: Условия (condition) в аурах не проверяются. Нет слушателей на изменение количества карт в стойле.
🛠️ Задача для Бэкенда: Реализовать проверку условий в while_in_stable (динамический триггер при изменении состояния зоны).

148. Налог на единорогов (Unicorn Tax)
Описание: Каждый раз, когда вы берете хотя бы 1 карту, СБРОСЬТЕ 1 карту.

json
{
  "id": "unicorn_tax_downgrade",
  "name": "Налог на единорогов",
  "type": "downgrade",
  "description": "Каждый раз, когда вы берете хотя бы 1 карту, СБРОСЬТЕ 1 карту.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "reactive_trigger",
          "on_event": "on_draw",
          "target_player": "self",
          "actions": [
            { "kind": "discard", "target": { "scope": "self", "zone": "hand", "filters": { "card_group": "any" }, "quantity": { "value": 1 } } }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет системы слушателей на событие добора карт (on_draw).
🛠️ Задача для Бэкенда: Реализовать reactive_trigger на событие on_draw.

149. Единорог 90 уровня (Level 90 Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 2 карты. Каждый раз когда вы УНИЧТОЖАЕТЕ карту, вы можете УНИЧТОЖИТЬ вторую карту.

json
{
  "id": "level_90_unicorn_ultimate",
  "name": "Единорог 90 уровня",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 2 карты. Каждый раз когда вы УНИЧТОЖАЕТЕ карту, вы можете УНИЧТОЖИТЬ вторую карту.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        { "kind": "sacrifice", "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "any", "exclude_self": true }, "quantity": { "value": 2 } } }
      ]
    },
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "reactive_trigger",
          "on_event": "on_self_destroys_card",
          "optional": true,
          "actions": [
            { "kind": "destroy", "target_player": "chosen", "target": { "scope": "any", "zone": "stable", "filters": { "card_group": "any" }, "quantity": { "value": 1 } } }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет слушателей на уничтожение карт именно этим игроком (on_self_destroys_card).
🛠️ Задача для Бэкенда: Реализовать триггер реакции на успешное уничтожение карты.

150. Франкенрог (Frankenunicorn)
Описание: Когда эта карта кладется в вашу Конюшню, СБРОСЬТЕ карту. Когда любой другой игрок пытается разыграть карту, вы можете ПОЖЕРТВОВАТЬ эту карту. Если вы сделали это, добавьте разыгрываемую карту в свою руку и немедленно разыграйте её.

json
{
  "id": "frankenunicorn_ultimate",
  "name": "Франкенрог",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, СБРОСЬТЕ карту. Когда любой другой игрок пытается разыграть карту, вы можете ПОЖЕРТВОВАТЬ эту карту. Если вы сделали это, добавьте разыгрываемую карту в свою руку и немедленно разыграйте её.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        { "kind": "discard", "target": { "scope": "self", "zone": "hand", "quantity": { "value": 1 } } }
      ]
    },
    {
      "trigger": "on_opponent_play",
      "optional": true,
      "actions": [
        { "kind": "sacrifice", "target": { "scope": "self", "zone": "stable", "filters": { "name": "Франкенрог" }, "quantity": { "value": 1 } } },
        { "kind": "steal", "target": { "scope": "stack" }, "destination": "hand" },
        { "kind": "force_play", "target": { "scope": "hand", "filters": { "name": "card_in_stack_name" } } }
      ]
    }
  ]
}
⚠️ Предупреждение: Самая сложная карта на перехват. Нужно перехватить карту из стека, положить в руку и заставить разыграть её вне фазы розыгрыша, игнорируя обычные ограничения.
🛠️ Задача для Бэкенда: Реализовать перехват из стека в руку. Реализовать экшен force_play (немедленный розыгрыш карты из руки).

151. Кошмарный единорог (Nightmare Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 3 карты. Если эта карта в вашей Конюшне в начале вашего хода, вы можете ВЫБРАТЬ карту Единорога из СБРОСА и добавить её в свою конюшню.

json
{
  "id": "nightmare_unicorn_ultimate",
  "name": "Кошмарный единорог",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ 3 карты. Если эта карта в вашей Конюшне в начале вашего хода, вы можете ВЫБРАТЬ карту Единорога из СБРОСА и добавить её в свою конюшню.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        { "kind": "sacrifice", "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "any", "exclude_self": true }, "quantity": { "value": 3 } } }
      ]
    },
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        { "kind": "search", "target": { "scope": "self", "zone": "discard", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1, "is_player_choice": true } }, "destination": "stable" }
      ]
    }
  ]
}
⚠️ Предупреждение: Обязательное жертвоприношение 3 карт при входе. Нужна проверка play_requirements (наличие 3 других карт), иначе карту нельзя разыграть.
🛠️ Задача для Бэкенда: Реализовать проверку play_requirements (количество карт в зоне).

152. Единорог-кукловод (Puppeteer Unicorn)
Описание: Когда карта кладется в вашу Конюшню, СБРОСЬТЕ карту. Каждый раз, когда вы СБРАСЫВАЕТЕ карту, вы можете выбрать 2 игроков. Каждый из них должен СБРОСИТЬ карту.

json
{
  "id": "puppeteer_unicorn_ultimate",
  "name": "Единорог-кукловод",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда карта кладется в вашу Конюшню, СБРОСЬТЕ карту. Каждый раз, когда вы СБРАСЫВАЕТЕ карту, вы можете выбрать 2 игроков. Каждый из них должен СБРОСИТЬ карту.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        { "kind": "discard", "target": { "scope": "self", "zone": "hand", "quantity": { "value": 1 } } }
      ]
    },
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "reactive_trigger",
          "on_event": "on_self_discard",
          "optional": true,
          "actions": [
            { "kind": "choose_players", "quantity": 2, "target": "any", "store_as": "chosen_players" },
            { "kind": "force_discard", "target_player": "$chosen_players", "target": { "scope": "any", "zone": "hand", "quantity": { "value": 1 } } }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Триггер on_self_discard (событие, когда этот игрок сбрасывает карту) отсутствует. Нет выбора нескольких игроков (choose_players).
🛠️ Задача для Бэкенда: Реализовать слушатель on_self_discard. Реализовать выбор нескольких игроков.

153. Теневой единорог (Shadow Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ карту Единорога. Когда любой другой игрок ЖЕРТВУЕТ карту Единорога или возвращает её в руку, вы можете СБРОСИТЬ до 2 карт. Если вы СБРОСИЛИ 1 карту, добавьте ту карту Единорога в свою руку. Если вы СБРОСИЛИ 2 карты, добавьте ту карту Единорога в свою Конюшню.

json
{
  "id": "shadow_unicorn_ultimate",
  "name": "Теневой единорог",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ карту Единорога. Когда любой другой игрок ЖЕРТВУЕТ карту Единорога или возвращает её в руку, вы можете СБРОСИТЬ до 2 карт. Если вы СБРОСИЛИ 1 карту, добавьте ту карту Единорога в свою руку. Если вы СБРОСИЛИ 2 карты, добавьте ту карту Единорога в свою Конюшню.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        { "kind": "sacrifice", "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn", "exclude_self": true }, "quantity": { "value": 1 } } }
      ]
    },
    {
      "trigger": "while_in_stable",
      "actions": [
        {
          "kind": "reactive_trigger",
          "on_event": "on_opponent_sacrifices_or_returns_unicorn",
          "optional": true,
          "actions": [
            {
              "kind": "choice",
              "options": [
                {
                  "label": "Сбросить 1 (взять в руку)",
                  "actions": [
                    { "kind": "discard", "target": { "scope": "self", "zone": "hand", "quantity": { "value": 1 } } },
                    { "kind": "move", "target": { "scope": "discard", "filters": { "card_group": "unicorn", "id": "$trigger_card_id" } }, "destination": "hand" }
                  ]
                },
                {
                  "label": "Сбросить 2 (взять в стойло)",
                  "actions": [
                    { "kind": "discard", "target": { "scope": "self", "zone": "hand", "quantity": { "value": 2 } } },
                    { "kind": "move", "target": { "scope": "discard", "filters": { "card_group": "unicorn", "id": "$trigger_card_id" } }, "destination": "stable" }
                  ]
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Кошмарный триггер on_opponent_sacrifices_or_returns_unicorn и передача контекста ($trigger_card_id) отсутствуют. Экшен choice отсутствует.
🛠️ Задача для Бэкенда: Реализовать перехват события (жертва/возврат единорога). Передавать ID карты, вызвавшей событие, в контекст следующего эффекта. Реализовать choice.

154. Единорог-жнец (Reaper Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ карту Единорога. Если эта карта в вашей Конюшне в начале вашего хода, вы можете ПОЖЕРТВОВАТЬ 1 карту Единорога, чтобы УНИЧТОЖИТЬ 2 карты Единорогов в любых Конюшнях.

json
{
  "id": "reaper_unicorn_ultimate",
  "name": "Единорог-жнец",
  "type": "unicorn",
  "subtype": ["ultimate"],
  "description": "Когда эта карта кладется в вашу Конюшню, ПОЖЕРТВУЙТЕ карту Единорога. Если эта карта в вашей Конюшне в начале вашего хода, вы можете ПОЖЕРТВОВАТЬ 1 карту Единорога, чтобы УНИЧТОЖИТЬ 2 карты Единорогов в любых Конюшнях.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        { "kind": "sacrifice", "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn", "exclude_self": true }, "quantity": { "value": 1 } } }
      ]
    },
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        { "kind": "sacrifice", "target": { "scope": "self", "zone": "stable", "filters": { "card_group": "unicorn", "exclude_self": true }, "quantity": { "value": 1 } } },
        { "kind": "destroy", "target_player": "chosen", "target": { "scope": "any", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 2, "is_player_choice": true } } }
      ]
    }
  ]
}
⚠️ Предупреждение: Нужна связка requires_success_of_previous (если не пожертвовал, не уничтожает).
🛠️ Задача для Бэкенда: requires_success_of_previous.

155. Единорого-предатель (Traitor Unicorn)
Описание: Когда эта карта кладется в вашу Конюшню, вы можете УНИЧТОЖИТЬ карту Единорога. Если эта карта будет УНИЧТОЖЕНА другим игроком, этот игрок может вместо этого УКРАСТЬ эту карту.

json
{
  "id": "traitor_unicorn_magic",
  "name": "Единорого-предатель",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Когда эта карта кладется в вашу Конюшню, вы можете УНИЧТОЖИТЬ карту Единорога. Если эта карта будет УНИЧТОЖЕНА другим игроком, этот игрок может вместо этого УКРАСТЬ эту карту.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "optional": true,
      "actions": [
        { "kind": "destroy", "target_player": "chosen", "target": { "scope": "any", "zone": "stable", "filters": { "card_group": "unicorn" }, "quantity": { "value": 1 } } }
      ]
    },
    {
      "trigger": "on_would_be_destroyed",
      "optional": true,
      "actions": [
        { "kind": "prevent", "prevented_action": "destroy" },
        { "kind": "steal", "target": { "scope": "stack" }, "destination_player": "source_player", "destination": "stable" }
      ]
    }
  ]
}
⚠️ Предупреждение: Нужен триггер on_would_be_destroyed, а также знание, кто именно пытается уничтожить карту (source_player), чтобы передать её этому игроку.
🛠️ Задача для Бэкенда: Передача контекста источника действия (source_player) в замещающий эффект.

156. Поглащение и отражение (Absorb and Reflect)
Описание: Играйте эту карту, когда любой другой игрок пытается сыграть карту ЗАКЛИНАНИЕ. Отмените активацию эффекта той карты и заберите ее в свою руку, а затем сразу разыграйте её.

json
{
  "id": "absorb_and_reflect_instant",
  "name": "Поглащение и отражение",
  "type": "instant",
  "description": "Играйте эту карту, когда любой другой игрок пытается сыграть карту ЗАКЛИНАНИЕ. Отмените активацию эффекта той карты и заберите ее в свою руку, а затем сразу разыграйте её.",
  "effects": [
    {
      "trigger": "on_opponent_plays_spell",
      "actions": [
        { "kind": "cancel", "target": { "scope": "stack" } },
        { "kind": "steal", "target": { "scope": "stack" }, "destination": "hand" },
        { "kind": "force_play", "target": { "scope": "hand", "filters": { "name": "card_in_stack_name" } } }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет триггера on_opponent_plays_spell. Нет перехвата из стека в руку. Нет force_play.
🛠️ Задача для Бэкенда: Добавить триггер. Реализовать перехват и немедленный розыгрыш.

157. Вмешательство (Intervention)
Описание: Играйте эту карту, когда любой другой игрок пытается ПОЖЕРТВОВАТЬ карту. Отмените это ПОЖЕРТВОВАНИЕ и выберите игрока. ПОЖЕРТВУЙТЕ или УНИЧТОЖТЕ карту в Конюшне этого игрока.

json
{
  "id": "intervention_instant",
  "name": "Вмешательство",
  "type": "instant",
  "description": "Играйте эту карту, когда любой другой игрок пытается ПОЖЕРТВОВАТЬ карту. Отмените это ПОЖЕРТВОВАНИЕ и выберите игрока. ПОЖЕРТВУЙТЕ или УНИЧТОЖТЕ карту в Конюшне этого игрока.",
  "effects": [
    {
      "trigger": "on_opponent_sacrifices",
      "actions": [
        { "kind": "cancel", "target": { "scope": "stack" } },
        {
          "kind": "choice",
          "options": [
            { "label": "Пожертвовать", "actions": [ { "kind": "sacrifice", "target_player": "chosen", "target": { "scope": "any", "zone": "stable", "quantity": { "value": 1 } } } ] },
            { "label": "Уничтожить", "actions": [ { "kind": "destroy", "target_player": "chosen", "target": { "scope": "any", "zone": "stable", "quantity": { "value": 1 } } } ] }
          ]
        }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет триггера on_opponent_sacrifices. Нет экшена choice.
🛠️ Задача для Бэкенда: Добавить триггер перехвата жертвоприношения. Реализовать choice.

158. Кошмарный пакт (Nightmare Pact)
Описание: Когда эта карта кладется в вашу Конюшню, выберите тип карт. Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете добавить карту выбранного типа из СБРОСА в свою Конюшню, а затем сразу перейти к последней стадии хода.

json
{
  "id": "nightmare_pact_upgrade",
  "name": "Кошмарный пакт",
  "type": "upgrade",
  "description": "Когда эта карта кладется в вашу Конюшню, выберите тип карт. Если эта карта находится в вашей Конюшне в начале вашего хода, вы можете добавить карту выбранного типа из СБРОСА в свою Конюшню, а затем сразу перейти к последней стадии хода.",
  "effects": [
    {
      "trigger": "on_enter_stable",
      "actions": [
        { "kind": "choose_card_type", "store_as": "pact_type" }
      ]
    },
    {
      "trigger": "on_turn_start",
      "optional": true,
      "actions": [
        { "kind": "search", "target": { "scope": "self", "zone": "discard", "filters": { "card_group": "$pact_type" }, "quantity": { "value": 1, "is_player_choice": true } }, "destination": "stable" },
        { "kind": "skip_phase", "phase": "end" }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет экшена choose_card_type (сохранение выбора игрока в переменную карты). Нет сохранения переменных между триггерами. Связка действий.
🛠️ Задача для Бэкенда: Реализовать сохранение переменных карты (карта помнит, что выбрал игрок).

159. Сундук с ловушкой (Mimic)
Описание: Играйте эту карту, когда любой другой игрок должен взять карту из КОЛОДЫ. Вместо того, чтобы брать карту, этот игрок СБРАСЫВАЕТ карту.

json
{
  "id": "mimic_instant",
  "name": "Сундук с ловушкой",
  "type": "instant",
  "description": "Играйте эту карту, когда любой другой игрок должен взять карту из КОЛОДЫ. Вместо того, чтобы брать карту, этот игрок СБРАСЫВАЕТ карту.",
  "effects": [
    {
      "trigger": "on_opponent_would_draw",
      "actions": [
        { "kind": "cancel", "target": { "scope": "stack" } },
        { "kind": "force_discard", "target_player": "source_player", "target": { "scope": "any", "zone": "hand", "quantity": { "value": 1 } } }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет триггера on_opponent_would_draw (перехват до того, как карта взята).
🛠️ Задача для Бэкенда: Добавить триггер реакции на добор карты оппонентом.

160. Единорог голода (Hunger Unicorn)
Описание: Предел руки каждого игрока равен 2 карты.

json
{
  "id": "hunger_unicorn_magic",
  "name": "Единорог голода",
  "type": "unicorn",
  "subtype": ["magic"],
  "description": "Предел руки каждого игрока равен 2 карты.",
  "effects": [
    {
      "trigger": "while_in_stable",
      "actions": [
        { "kind": "modify_hand_limit", "target_player": "all", "modifier": "set_to_2" }
      ]
    }
  ]
}
⚠️ Предупреждение: Нет while_in_stable. Текущий modify_hand_limit умеет только прибавлять, а не устанавливать абсолютное значение.
🛠️ Задача для Бэкенда: Научить modify_hand_limit устанавливать абсолютный лимит (set_to).

