/**
 * Русские формы числительных.
 *
 * В интерфейсе было «1 карт» и «41 карт» — по-русски так нельзя.
 * Дробные числа и числа от 11 до 14 требуют формы «карт», остальные
 * зависят от последней цифры.
 */

/** Выбрать форму слова для числа: forms = [одна, две, много]. */
export function pluralRu(count: number, forms: readonly [string, string, string]): string {
  const n = Math.abs(Math.trunc(count));
  const tail100 = n % 100;
  if (tail100 >= 11 && tail100 <= 14) return forms[2];
  const tail10 = n % 10;
  if (tail10 === 1) return forms[0];
  if (tail10 >= 2 && tail10 <= 4) return forms[1];
  return forms[2];
}

const CARD_FORMS = ['карта', 'карты', 'карт'] as const;

/** «1 карта», «3 карты», «41 карта», «12 карт». */
export function cardsCount(count: number): string {
  return `${count} ${pluralRu(count, CARD_FORMS)}`;
}
