#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Файл с картами
const jsonPath = path.join(__dirname, 'server', 'data', 'unicorns.json');
const outputPath = path.join(__dirname, 'server', 'data', 'unicorns.json');

// Загрузка JSON
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// Функция для перевода текста эффектов на русский (упрощённая версия)
function translateCardText(text) {
  if (!text) return text;
  let t = text;
  // Общие замены
  t = t.replace(/Choose another player\./g, 'Выбери другого игрока.');
  t = t.replace(/Choose any player\./g, 'Выбери любого игрока.');
  t = t.replace(/Choose a player\./g, 'Выбери игрока.');
  t = t.replace(/Each player/g, 'Каждый игрок');
  t = t.replace(/you may/g, 'ты можешь');
  t = t.replace(/you must/g, 'ты должен');
  t = t.replace(/you/g, 'ты');
  t = t.replace(/your/g, 'твоей');
  t = t.replace(/Your/g, 'Твоей');
  t = t.replace(/their/g, 'их');
  t = t.replace(/them/g, 'их');
  t = t.replace(/they/g, 'они');
  t = t.replace(/and/g, 'и');
  t = t.replace(/then/g, 'затем');
  t = t.replace(/instead/g, 'вместо');
  t = t.replace(/without triggering any of their effects/g, 'не вызывая их эффектов');
  t = t.replace(/without triggering any effects/g, 'не вызывая эффектов');
  t = t.replace(/triggering any of their effects/g, 'вызывая их эффекты');
  t = t.replace(/triggering any effects/g, 'вызывая эффекты');
  t = t.replace(/bring/g, 'положи');
  t = t.replace(/move/g, 'перемести');
  t = t.replace(/add/g, 'добавь');
  t = t.replace(/draw/g, 'добери');
  t = t.replace(/discard/g, 'сбрось');
  t = t.replace(/destroy/g, 'уничтожь');
  t = t.replace(/sacrifice/g, 'пожертвуй');
  t = t.replace(/return/g, 'верни');
  t = t.replace(/steal/g, 'укради');
  t = t.replace(/search/g, 'найди');
  t = t.replace(/shuffle/g, 'перемешай');
  t = t.replace(/look at/g, 'посмотри на');
  t = t.replace(/reveal/g, 'покажи');
  t = t.replace(/place/g, 'поставь');
  t = t.replace(/remove/g, 'убери');
  t = t.replace(/exchange/g, 'поменяй');
  t = t.replace(/swap/g, 'поменяй');
  t = t.replace(/skip/g, 'пропусти');
  t = t.replace(/gain/g, 'получи');
  t = t.replace(/lose/g, 'потеряй');
  t = t.replace(/pay/g, 'заплати');
  t = t.replace(/reduce/g, 'уменьши');
  t = t.replace(/increase/g, 'увеличь');
  t = t.replace(/set/g, 'установи');
  t = t.replace(/add/g, 'добавь');
  t = t.replace(/return/g, 'верни');
  t = t.replace(/from/g, 'из');
  t = t.replace(/to/g, 'в');
  t = t.replace(/into/g, 'в');
  t = t.replace(/on/g, 'на');
  t = t.replace(/in/g, 'в');
  t = t.replace(/at/g, 'в');
  t = t.replace(/of/g, '');
  t = t.replace(/the/g, '');
  t = t.replace(/a/g, '');
  t = t.replace(/an/g, '');
  t = t.replace(/card/g, 'карту');
  t = t.replace(/cards/g, 'карты');
  t = t.replace(/Card/g, 'Карта');
  t = t.replace(/Cards/g, 'Карты');
  t = t.replace(/hand/g, 'руку');
  t = t.replace(/Hand/g, 'Руку');
  t = t.replace(/deck/g, 'колоду');
  t = t.replace(/Deck/g, 'Колоду');
  t = t.replace(/discard pile/g, 'сброс');
  t = t.replace(/Discard Pile/g, 'Сброс');
  t = t.replace(/stable/g, 'стойло');
  t = t.replace(/Stable/g, 'Стойло');
  t = t.replace(/nursery/g, 'детская');
  t = t.replace(/Nursery/g, 'Детская');
  t = t.replace(/turn/g, 'ход');
  t = t.replace(/Turn/g, 'Ход');
  t = t.replace(/phase/g, 'фаза');
  t = t.replace(/Phase/g, 'Фаза');
  t = t.replace(/beginning of your turn/g, 'в начале твоего хода');
  t = t.replace(/end of your turn/g, 'в конце твоего хода');
  t = t.replace(/beginning of your turn/g, 'в начале твоего хода');
  t = t.replace(/end of your turn/g, 'в конце твоего хода');
  t = t.replace(/beginning of your turn/g, 'в начале твоего хода');
  t = t.replace(/end of your turn/g, 'в конце твоего хода');
  t = t.replace(/beginning of your turn/g, 'в начале твоего хода');
  t = t.replace(/end of your turn/g, 'в конце твоего хода');
  // Числа и диапазоны
  t = t.replace(/(\d+)/g, '$1');
  // Убираем лишние пробелы
  t = t.replace(/\s+/g, ' ').trim();
  // Первая буква заглавная
  if (t.length > 0) t = t[0].toUpperCase() + t.slice(1);
  return t;
}

// Перевод всех Card Texts
let translated = 0;
for (const item of data.items) {
  if (item['Card Texts']) {
    const original = item['Card Texts'];
    const translatedText = translateCardText(original);
    if (translatedText !== original) {
      item['Card Texts'] = translatedText;
      translated++;
    }
  }
}

// Сохранение
fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
console.log(`Переведено ${translated} карт из ${data.items.length}.`);
console.log('Файл сохранён:', outputPath);
