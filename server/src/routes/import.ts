import express from 'express';
import type { Request, Response } from 'express';
import { load as cheerioLoad } from 'cheerio';
import { guessTypeFromText, saveImageToUploads } from '../utils/wiki';

const router = express.Router();

function isAllowedWikiUrl(urlStr: string) {
  try {
    const u = new URL(urlStr);
    return (
      u.hostname === 'unstablegameswiki.com' ||
      u.hostname.endsWith('.unstablegameswiki.com')
    );
  } catch {
    return false;
  }
}

// guessTypeFromText вынесен в utils/wiki

router.post('/wiki', async (req: Request, res: Response) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url || !isAllowedWikiUrl(url)) {
      return res.status(400).json({ message: 'Неверная ссылка: разрешены только unstablegameswiki.com' });
    }

    // Helper: resolve alternatives if the first request returns 404
    const buildAltCandidates = (u: URL): string[] => {
      const out: string[] = [];
      try {
        const isUGW = u.hostname === 'unstablegameswiki.com' || u.hostname.endsWith('.unstablegameswiki.com');
        if (!isUGW) return out;
        const origin = `${u.protocol}//${u.hostname}`;
        const looksIndex = /^\/index\.php$/i.test(u.pathname);
        const params = new URLSearchParams(u.search);
        let title = '';
        if (looksIndex) title = params.get('title') || '';
        else if (/^\/wiki\//.test(u.pathname)) title = decodeURIComponent(u.pathname.replace(/^\/wiki\//, ''));
        title = title || '';
        if (!title) return out;
        const noPrefix = title.replace(/^UU_\-_/, '');
        const variants = Array.from(new Set([
          // Original title variants
          `${origin}/wiki/${encodeURIComponent(title)}`,
          `${origin}/index.php?title=${encodeURIComponent(title)}`,
          `${origin}/w/index.php?title=${encodeURIComponent(title)}`,
          // No UU_-_ prefix
          `${origin}/wiki/${encodeURIComponent(noPrefix)}`,
          `${origin}/index.php?title=${encodeURIComponent(noPrefix)}`,
          `${origin}/w/index.php?title=${encodeURIComponent(noPrefix)}`,
          // Space variants
          `${origin}/wiki/${encodeURIComponent(title.replace(/_/g, ' '))}`,
          `${origin}/wiki/${encodeURIComponent(noPrefix.replace(/_/g, ' '))}`,
          // UU: namespace variant
          `${origin}/wiki/${encodeURIComponent('UU:' + noPrefix)}`,
          `${origin}/index.php?title=${encodeURIComponent('UU:' + noPrefix)}`,
          `${origin}/w/index.php?title=${encodeURIComponent('UU:' + noPrefix)}`,
        ]));
        variants.forEach(v => { if (!out.includes(v)) out.push(v); });
      } catch {}
      return out;
    };

    const trySearch = async (u: URL): Promise<string | null> => {
      try {
        const origin = `${u.protocol}//${u.hostname}`;
        // Prefer "w/index.php" if available, else fallback to "/index.php"
        const searchBase = `${origin}/w/index.php`;
        // Build query from title if exists; else from last path segment
        const params = new URLSearchParams(u.search);
        let q = params.get('title') || '';
        if (!q) {
          const seg = u.pathname.split('/').filter(Boolean).pop() || '';
          q = decodeURIComponent(seg);
        }
        if (!q) return null;
        const searchUrl = `${searchBase}?search=${encodeURIComponent(q)}&title=Special:Search`;
        const r = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8' } });
        if (!r.ok) return null;
        const html = await r.text();
        const $ = cheerioLoad(html);
        const first = $('.mw-search-result-heading a').first();
        const href = first.attr('href') || '';
        if (!href) return null;
        if (href.startsWith('http')) return href;
        if (href.startsWith('/')) return `${origin}${href}`;
        return `${origin}/wiki/${href}`;
      } catch { return null; }
    };

    // Простой retry для 503/сетевых ошибок
    const doFetch = async () => fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8'
      }
    });
    let resp = await doFetch().catch(() => null as any);
    if (!resp || resp.status === 503) {
      await new Promise(r => setTimeout(r, 600));
      resp = await doFetch().catch(() => null as any);
    }
    if (!resp.ok) {
      const status = resp.status || 502;
      // If 404: try alternative candidates and search
      if (status === 404) {
        try {
          const u = new URL(url);
          const alts = buildAltCandidates(u);
          for (const alt of alts) {
            const r2 = await fetch(alt, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8' } });
            if (r2.ok) {
              console.warn('[import/wiki] 404 fallback succeeded via', alt);
              resp = r2;
              break;
            }
          }
          if (!resp.ok) {
            const found = await trySearch(new URL(url));
            if (found) {
              const r3 = await fetch(found, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9,ru;q=0.8' } });
              if (r3.ok) {
                console.warn('[import/wiki] 404 resolved via search ->', found);
                resp = r3;
              }
            }
          }
        } catch {}
      }
      if (!resp.ok) {
        console.error('[import/wiki] Upstream responded not ok', { url, status: resp.status });
        return res.status(resp.status || 502).json({ message: `Не удалось получить страницу (${resp.status})` });
      }
    }
    const html = await resp.text();
    try {
      console.log('[import/wiki] fetched OK', { finalUrl: resp.url || url });
    } catch {}
    const $ = cheerioLoad(html);

    // Заголовок страницы
    const name = ($('#firstHeading').text() || $('h1').first().text() || '').trim();

    // Картинка: берём первое изображение из инфобокса; учитываем data-src и абсолютный URL
    let image = '';
    const infoboxImg = $('table.infobox img').first();
    image = infoboxImg.attr('src') || infoboxImg.attr('data-src') || '';
    if (!image) {
      const anyImg = $('img').first();
      image = anyImg.attr('src') || anyImg.attr('data-src') || '';
    }
    if (image && image.startsWith('//')) image = 'https:' + image;
    if (image && image.startsWith('/')) image = 'https://unstablegameswiki.com' + image;

    // Попробуем скачать изображение и сохранить в /uploads/wiki, чтобы избежать 403 при хотлинке
    if (image) {
      const saved = await saveImageToUploads(image).catch(() => '');
      if (saved) image = saved; // локальный URL типа /uploads/wiki/<file>
    }

    // Тип/описание: пробуем найти Card Text из инфобокса, тип сначала берём из инфобокса
    const pageText = $('body').text();
    let guessType = '' as string;
    // Попытка прочитать тип из инфобокса
    $('table.infobox tr').each((_, tr) => {
      if (guessType) return;
      const thText = $(tr).find('th').first().text().trim().toLowerCase();
      if (!thText) return;
      if (/(card\s*)?type/.test(thText)) {
        const tdText = $(tr).find('td').first().text().trim().toLowerCase();
        if (tdText.includes('ultimate unicorn')) guessType = 'ultimate_unicorn';
        else if (tdText.includes('magical unicorn')) guessType = 'magical_unicorn';
        else if (tdText.includes('basic unicorn')) guessType = 'basic_unicorn';
        else if (tdText.includes('baby unicorn')) guessType = 'baby_unicorn';
        // action types before generic unicorn
        else if (tdText.includes('instant')) guessType = 'instant';
        else if (tdText.includes('upgrade')) guessType = 'upgrade';
        else if (tdText.includes('downgrade')) guessType = 'downgrade';
        else if (/(^|\b)magic(\b|$)/.test(tdText)) guessType = 'magic';
        else if (tdText.includes('unicorn')) guessType = 'unicorn';
        else if (tdText) guessType = tdText as any;
      }
    });
    if (!guessType) guessType = guessTypeFromText(pageText);

    // 1) Попытка достать первую ячейку Card Text(s) из инфобокса
    let cardText = '';
    $('table.infobox tr').each((_, tr) => {
      if (cardText) return;
      const thText = $(tr).find('th').first().text().trim().toLowerCase();
      if (!thText) return;
      if (thText.includes('card text')) {
        // Берём только первый текст (если несколько), игнорируя локализационные заглушки
        const td = $(tr).find('td').first();
        const raw = td.html() || td.text();
        const parts = (raw || '')
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, ' ')
          .split(/\n|;|\.|\r/)
          .map(s => s.replace(/\s+/g, ' ').trim())
          .filter(Boolean);
        const pick = parts.find(p => !/will not be localized/i.test(p)) || '';
        cardText = pick || parts[0] || '';
      }
    });

    // 2) Если нет — ищем раздел "Card Text" в контенте
    if (!cardText) {
      const cardTextHeader = $("#Card_Text, span#Card_Text, span#Card_text").closest('h2, h3');
      if (cardTextHeader.length) {
        const parts: string[] = [];
        let el = cardTextHeader.next();
        while (el.length && !['H2','H3'].includes(el.prop('tagName') || '')) {
          if (el.is('p, li')) {
            const t = el.text().trim();
            if (t) parts.push(t);
          }
          el = el.next();
        }
        cardText = parts.join('\n').trim();
      }
    }

    // 2.5) Попробовать взять текст из инфобокса по полям Effect/Ability
    if (!cardText) {
      $('table.infobox tr').each((_, tr) => {
        if (cardText) return;
        const thText = $(tr).find('th').first().text().trim().toLowerCase();
        if (!thText) return;
        if (/(effect|ability|card ability|abilities)/.test(thText)) {
          const td = $(tr).find('td').first();
          const raw = td.html() || td.text();
          const parts = (raw || '')
            .replace(/<br\s*\/?>(?=\s*\w)/gi, '\n')
            .replace(/<[^>]+>/g, ' ')
            .split(/\n|;|\.|\r/)
            .map(s => s.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .filter(p => !/will not be localized/i.test(p));
          if (parts.length) cardText = parts[0];
        }
      });
    }

    // 2.6) Разделы Effect/Ability в контенте
    if (!cardText) {
      const header = $("h2, h3").filter((_, el) => /effect|ability/i.test($(el).text())).first();
      if (header && header.length) {
        const parts: string[] = [];
        let el = header.next();
        while (el.length && !['H2','H3'].includes(el.prop('tagName') || '')) {
          if (el.is('p, li')) {
            const t = el.text().trim();
            if (t) parts.push(t);
          }
          el = el.next();
        }
        cardText = parts.join('\n').trim();
      }
    }

    // 2.3) Секция «Card Texts» (некоторые страницы хранят текст карты здесь)
    if (!cardText) {
      const headers = $('h1, h2, h3');
      let idx = -1;
      headers.each((i, el) => {
        const ht = $(el).text().trim();
        if (/^card\s*texts?/i.test(ht)) idx = i;
      });
      if (idx >= 0) {
        const headerEl = headers.get(idx);
        // Соберём все <li> до следующего h1/h2/h3
        const sectionNodes: string[] = [];
        let next = $(headerEl).next();
        while (next.length) {
          const tag = (next.prop('tagName') || '').toString().toLowerCase();
          if (tag === 'h1' || tag === 'h2' || tag === 'h3') break;
          if (tag === 'ul' || tag === 'ol') {
            next.find('li').each((_, li) => sectionNodes.push($(li).text().trim()));
          }
          next = next.next();
        }
        const candidates = sectionNodes
          .map(t => t.replace(/^c&c\s*print[^:]*:\s*/i, '').trim())
          .filter(s => s.length >= 20);
        if (candidates.length) cardText = candidates[0];
      }
    }

    // 3) Аккуратный fallback: первый связный абзац, похожий на текст карты
    if (!cardText) {
      const candidates = $('div.mw-parser-output > p').toArray()
        .map(el => $(el).text().trim())
        .filter(Boolean)
        .filter(p => !/will not be localized/i.test(p))
        .filter(p => !/(kickstarter|backer|early design|campaign|prototype)/i.test(p))
        .filter(p => /\b(you|your|player|unicorn|stable|discard|destroy|sacrifice|return|choose|draw|hand|deck)\b/i.test(p))
        .filter(p => p.length >= 25 && p.length <= 400);
      if (candidates.length) cardText = candidates[0];
    }

    // Оригинальный английский текст пригодится для авто-эффектов
    let descriptionEn = cardText || '';
    // Очистка от вики-артефактов
    if (descriptionEn) {
      descriptionEn = descriptionEn
        .replace(/\[\[|\]\]/g, '')
        .replace(/\bcard\s*status:?\b.*$/i, '')
        .replace(/\bcardstatus:?\b.*$/i, '')
        .replace(/\btype:?\b.*$/i, '')
        // Удаляем лидирующие префиксы издание/версии, часто встречающиеся на вики
        .replace(/^c&c\s*print[^:]*:\s*/i, '')
        .replace(/^print[^:]*edition:\s*/i, '')
        .replace(/\s{2,}/g, ' ')
        .trim();
      // Если после чистки осталось совсем мало информативного текста — сбросим
      if (descriptionEn.length < 10) descriptionEn = '';
    }
    // Если вики скрывает текст локализационным плейсхолдером — подставим известный текст для конкретной карты (эвристика)
    if (/will not be localized/i.test(descriptionEn) && /valkyrie unicorn/i.test(name)) {
      descriptionEn = 'At the beginning of your turn, you may sacrifice a Unicorn card. If you do, choose a Unicorn card from the discard pile and bring it into your Stable.';
    }

    // Черновой парсинг эффектов (минимально) — по английскому тексту
    const effects: any[] = buildEffectsFromDescription(descriptionEn);

    // Попытаться уточнить тип по инфобоксу (строка Type: ...), если присутствует
    (function refineTypeFromInfobox() {
      let typeText = '';
      $('table.infobox tr').each((_, tr) => {
        const th = $(tr).find('th').first().text().trim().toLowerCase();
        if (!th) return;
        if (/^type\b/.test(th)) {
          typeText = $(tr).find('td').first().text().trim().toLowerCase();
        }
      });
      if (!typeText) return;
      const has = (s: string) => typeText.includes(s);
      // Подтипы единорогов
      if (has('baby')) { guessType = 'baby_unicorn'; return; }
      if (has('basic')) { guessType = 'basic_unicorn'; return; }
      if (has('magical')) { guessType = 'magical_unicorn'; return; }
      if (has('ultimate')) { guessType = 'ultimate_unicorn'; return; }
      // Action types раньше общего unicorn
      if (has('instant')) { guessType = 'instant'; return; }
      if (has('upgrade')) { guessType = 'upgrade'; return; }
      if (has('downgrade')) { guessType = 'downgrade'; return; }
      if (/(^|\b)magic(\b|$)/.test(typeText)) { guessType = 'magic'; return; }
      if (has('unicorn')) { guessType = 'unicorn'; return; }
    })();

    // Дополнительно: специфический паттерн для «в начале хода можете пожертвовать единорога, чтобы взять единорога из сброса в стойло»
    const t = descriptionEn.toLowerCase();
    const beginTurn = /at the (?:beginning|start) of your turn/.test(t);
    const maySacUnicorn = /may\s+sacrifice\s+(?:a\s+)?unicorn/.test(t);
    const takeUnicornFromDiscardToStable = /(choose|take|bring)\s+(?:a\s+)?unicorn\s+card?\s+from\s+the\s+discard\s+pile.*(into|to)\s+(?:your\s+)?stable/.test(t);
    if (beginTurn && maySacUnicorn && takeUnicornFromDiscardToStable) {
      effects.push({
        trigger: 'on_turn_start',
        actions: [
          { kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } }, optional: true },
          { kind: 'move', targets: { scope: 'self', zone: 'discard', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } }, to: { scope: 'self', zone: 'stable' }, requires_success_of_previous: true }
        ]
      });
    }

    // Выявление требований к розыгрышу: пожертвовать единорога / сбросить карту
    const playRequirements: any = {};
    const costs: any[] = [];
    // Поиск в инфобоксе: Play Requirement(s) / Entry Cost / Cost
    $('table.infobox tr').each((_, tr) => {
      const thText = $(tr).find('th').first().text().trim().toLowerCase();
      if (!thText) return;
      if (/play\s*requirement|entry\s*cost|cost/.test(thText)) {
        const tdText = $(tr).find('td').first().text().toLowerCase();
        if (/sacrifice\s+(?:a\s+)?unicorn/.test(tdText)) {
          costs.push({ kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } } });
        }
        const discMatch = tdText.match(/discard\s+(?:up to\s+)?(a|one|\d+)\s+card/);
        if (discMatch) {
          const n = discMatch[1] === 'a' || discMatch[1] === 'one' ? 1 : Math.max(1, parseInt(discMatch[1], 10) || 1);
          costs.push({ kind: 'discard', targets: { scope: 'self', zone: 'hand', quantity: { mode: 'exact', value: n } } });
        }
      }
    });
    // Если не нашли — эвристика из общего текста страницы
    if (!costs.length && /to\s+play\s+this\s+card.*sacrifice\s+(?:a\s+)?unicorn/.test(pageText.toLowerCase())) {
      costs.push({ kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } } });
    }
    if (!costs.length) {
      const pt = pageText.toLowerCase();
      const m = pt.match(/to\s+play\s+this\s+card.*?discard\s+(?:up to\s+)?(a|one|\d+)\s+card/);
      if (m) {
        const n = m[1] === 'a' || m[1] === 'one' ? 1 : Math.max(1, parseInt(m[1], 10) || 1);
        costs.push({ kind: 'discard', targets: { scope: 'self', zone: 'hand', quantity: { mode: 'exact', value: n } } });
      }
    }
    // Доп. эвристика: если на странице встречается Play Requirement и слово discard рядом
    if (!costs.length) {
      const lowered = pageText.toLowerCase().replace(/\s+/g, ' ');
      if (/play requirement/.test(lowered) && /discard/.test(lowered)) {
        costs.push({ kind: 'discard', targets: { scope: 'self', zone: 'hand', quantity: { mode: 'exact', value: 1 } } });
      }
    }
    // Если это Valkyrie Unicorn и стоимость не распознана — добавим пожертвование 1 единорога
    if (!costs.length && /valkyrie unicorn/i.test(name)) {
      costs.push({ kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } } });
    }
    // Если это Frankencorn — известно, что требуется сбросить 1 карту при розыгрыше
    if (/frankencorn/i.test(name) && !costs.some(c => c.kind === 'discard')) {
      costs.push({ kind: 'discard', targets: { scope: 'self', zone: 'hand', quantity: { mode: 'exact', value: 1 } } });
    }
    // Shadow Unicorn: добавим стоимость входа (как Entry Cost): пожертвовать 1 единорога
    if (/shadow\s*unicorn/i.test(name) && !costs.some(c => c.kind === 'sacrifice')) {
      costs.push({ kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } } });
    }
    if (costs.length) playRequirements.costs = costs;

    // Frankencorn: подставим корректный текст и специфический эффект, если исходный cardText пустой или выглядит как исторический/кикстартерный
    if (/frankencorn/i.test(name)) {
      const bad = /kickstarter|backer|early design|campaign|prototype/i;
      if (!descriptionEn || bad.test(descriptionEn)) {
        descriptionEn = "When another player plays a card, you may sacrifice this card. If you do, take that card into your hand and immediately play it.";
      }
      // Добавим эффект-перехват (примерная DSL)
      const intercept: any = {
        trigger: 'when_other_plays',
        actions: [
          { kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } }, optional: true },
          // модель перехвата: отменить и забрать карту в руку, затем разыграть
          { kind: 'cancel', optional: false, requires_success_of_previous: true },
          { kind: 'transfer', from: { scope: 'opponent', zone: 'hand', quantity: { mode: 'exact', value: 1 } }, to: { scope: 'self', zone: 'hand' }, requires_success_of_previous: true },
          { kind: 'add', source: 'hand', destination: 'stable', quantity: { mode: 'exact', value: 1 }, requires_success_of_previous: true }
        ]
      };
      // Не дублируем, если уже похожий есть
      const hasIntercept = effects.some(e => e.trigger === 'when_other_plays');
      if (!hasIntercept) effects.push(intercept);
    }

    // Patient Zero Unicorn: двойное пожертвование для всех, пока карта в игре
    if (/patient\s*zero\s*unicorn/i.test(name)) {
      const looksBad = /card\s*status|cardstatus|^type:/i.test((cardText || ''));
      if (!descriptionEn || looksBad) {
        descriptionEn = 'Each time any player (including you) would SACRIFICE a card, that player must SACRIFICE 2 cards instead.';
      }
      const hasDouble = effects.some(e => e.trigger === 'while_in_stable');
      if (!hasDouble) {
        effects.push({
          trigger: 'while_in_stable',
          actions: [
            { kind: 'set_flag', key: 'double_sacrifice_all_players', value: true }
          ]
        });
      }
    }

    // Pied Pipercorn: магический единорог, эффект перехвата малыша из Яслей за сброс 1 карты
    if (/pied\s*pipercorn/i.test(name)) {
      // Тип: принудительно магический единорог
      if (guessType === 'baby_unicorn' || guessType === 'unicorn') {
        guessType = 'magical_unicorn';
      }
      // Описание
      const desired = 'When another player tries to bring a Baby Unicorn card from the Nursery into their Stable, you may DISCARD a card, then bring that Baby Unicorn card into your Stable instead.';
      const looksBad = !descriptionEn || /card\s*status|^type:/i.test(descriptionEn);
      if (looksBad) descriptionEn = desired;
      // Эффект перехвата малыша
      const hasBabyIntercept = effects.some(e => e.trigger === 'when_other_brings_baby_from_nursery');
      if (!hasBabyIntercept) {
        effects.push({
          trigger: 'when_other_brings_baby_from_nursery',
          actions: [
            { kind: 'discard', targets: { scope: 'self', zone: 'hand', quantity: { mode: 'exact', value: 1 } }, optional: true },
            { kind: 'cancel', requires_success_of_previous: true },
            { kind: 'move', targets: { scope: 'global', zone: 'nursery', filters: { card_group: 'baby_unicorn' }, quantity: { mode: 'exact', value: 1 } }, to: { scope: 'self', zone: 'stable' }, requires_success_of_previous: true }
          ]
        });
      }
    }

    // Shadow Unicorn: корректные эффекты и зачистка неверного авто-эффекта
    if (/shadow\s*unicorn/i.test(name)) {
      // Если описания нет — подставим современную формулировку из «Card Texts»
      if (!descriptionEn) {
        descriptionEn = 'When this card enters your Stable, SACRIFICE a Unicorn card. When a Unicorn card in another player\'s Stable would be sacrificed or returned to a player\'s hand, you may DISCARD up to 2 cards. If you DISCARD 1 card, add that Unicorn card to your hand instead. If you DISCARD 2 cards, bring that Unicorn card directly into your Stable instead.';
      }
      // Удалим наивный авто-эффект про немедленный сброс, сгенерированный из фразы "DISCARD up to 2 cards"
      for (let i = effects.length - 1; i >= 0; i--) {
        const e = effects[i];
        const looksLikeImmediateDiscard = e?.trigger === 'immediate' && Array.isArray(e.actions) && e.actions.some((a: any) => (a?.kind === 'move' && a?.to?.zone === 'discard') || a?.kind === 'discard');
        if (looksLikeImmediateDiscard) effects.splice(i, 1);
      }
      // Эффект при входе: пожертвовать единорога
      const hasEnter = effects.some(e => e.trigger === 'on_enter_stable');
      if (!hasEnter) {
        effects.push({
          trigger: 'on_enter_stable',
          actions: [
            { kind: 'sacrifice', targets: { scope: 'self', zone: 'stable', filters: { card_group: 'unicorn' }, quantity: { mode: 'exact', value: 1 } } }
          ]
        });
      }
      // Эффект перехвата: уникорн другого игрока, который должен быть пожертвован или возвращён в руку
      const hasIntercept = effects.some(e => e.trigger === 'when_other_unicorn_would_be_sacrificed_or_returned');
      if (!hasIntercept) {
        effects.push({
          trigger: 'when_other_unicorn_would_be_sacrificed_or_returned',
          actions: [
            // Вариант 1: DISCARD 1 -> cancel -> move to your hand
            { kind: 'discard', optional: true, targets: { scope: 'self', zone: 'hand', quantity: { mode: 'exact', value: 1 } } },
            { kind: 'cancel', requires_success_of_previous: true },
            { kind: 'move', targets: { scope: 'event', entity: 'affected_card' }, to: { scope: 'self', zone: 'hand' }, requires_success_of_previous: true },
            // Вариант 2: DISCARD 2 -> cancel -> move to your stable
            { kind: 'discard', optional: true, targets: { scope: 'self', zone: 'hand', quantity: { mode: 'exact', value: 2 } } },
            { kind: 'cancel', requires_success_of_previous: true },
            { kind: 'move', targets: { scope: 'event', entity: 'affected_card' }, to: { scope: 'self', zone: 'stable' }, requires_success_of_previous: true }
          ]
        });
      }
    }

    // Эвристики флагов для модификаторов победы/лимита руки
    const flags: any = {};
    const dl = (descriptionEn || '').toLowerCase();
    // counts_as_two: "counts as two unicorns"
    if (/counts\s+as\s+(two|2)\s+unicorns?/.test(dl)) flags.counts_as_two = true;
    // transforms_unicorn: не считается единорогом/теряет статус
    if (/(does\s+not\s+count\s+as\s+(a\s+)?unicorn|is\s+not\s+considered\s+(a\s+)?unicorn|loses?\s+its\s+unicorn\s+status)/.test(dl)) flags.transforms_unicorn = true;
    // block_win_any: нельзя выиграть
    if (/(you|a\s+player)\s+cannot\s+win/.test(dl)) flags.block_win_any = true;
    // block_win_unicorn_type: нельзя выиграть, если у тебя есть X unicorn
    const typeMap: Record<string,string> = { baby: 'baby_unicorn', basic: 'basic_unicorn', magical: 'magical_unicorn', ultimate: 'ultimate_unicorn' };
    const mBlockType = dl.match(/cannot\s+win[^.]*if\s+you\s+have\s+(?:a|any)\s+(baby|basic|magical|ultimate)\s+unicorn/);
    if (mBlockType && typeMap[mBlockType[1]]) flags.block_win_unicorn_type = typeMap[mBlockType[1]];
    // hand_limit_delta: "increase/decrease your hand limit by N" или "your hand limit is N"
    const mHandInc = dl.match(/(increase|decrease)s?\s+your\s+hand\s+limit\s+by\s+(\d+)/);
    if (mHandInc) {
      const n = parseInt(mHandInc[2], 10) || 0;
      flags.hand_limit_delta = mHandInc[1] === 'increase' ? n : -n;
    }
    const mHandSet = dl.match(/your\s+hand\s+limit\s+(?:is|becomes)\s+(\d+)/);
    if (mHandSet) {
      const setTo = parseInt(mHandSet[1], 10) || 7;
      flags.hand_limit_delta = (setTo - 7);
    }
    // win_threshold_delta: "win with N unicorns" или "need N more unicorns to win"
    const mWinWith = dl.match(/win\s+with\s+(\d+)\s+unicorns?/);
    if (mWinWith) {
      const target = parseInt(mWinWith[1], 10) || 7;
      flags.win_threshold_delta = target - 7;
    }
    const mNeedMore = dl.match(/need\s+(\d+)\s+(?:more\s+)?unicorns?\s+to\s+win/);
    if (mNeedMore) {
      const extra = parseInt(mNeedMore[1], 10) || 0;
      flags.win_threshold_delta = (flags.win_threshold_delta ?? 0) + extra; // добавляем к возможному предыдущему
    }

    // Выполним перевод после всех эвристик (если настроено)
    const translated = await maybeTranslateNameAndDesc(name, descriptionEn);
    const outName = translated?.name || name;
    const outDescription = translated?.description || descriptionEn;

    return res.json({
      name: outName,
      type: guessType,
      description: outDescription,
      image,
      effects,
      play_requirements: Object.keys(playRequirements).length ? playRequirements : undefined,
      source: url,
      // Новые флаги — только если распознаны
      ...(flags.counts_as_two ? { counts_as_two: true } : {}),
      ...(flags.transforms_unicorn ? { transforms_unicorn: true } : {}),
      ...(flags.block_win_any ? { block_win_any: true } : {}),
      ...(flags.block_win_unicorn_type ? { block_win_unicorn_type: flags.block_win_unicorn_type } : {}),
      ...(typeof flags.hand_limit_delta === 'number' ? { hand_limit_delta: flags.hand_limit_delta } : {}),
      ...(typeof flags.win_threshold_delta === 'number' ? { win_threshold_delta: flags.win_threshold_delta } : {}),
    });
  } catch (e: any) {
    console.error('[import/wiki] Error during fetch/parse', e);
    return res.status(500).json({ message: e?.message || 'Ошибка импорта' });
  }
});

// Примитивная генерация эффектов по ключевым словам
function buildEffectsFromDescription(text: string): any[] {
  const effects: any[] = [];
  const t = (text || '').toLowerCase();

  // Draw N cards
  const drawMatch = t.match(/draw\s+(?:up to\s+)?(\d+)\s+card/);
  if (drawMatch) {
    const n = Math.max(1, parseInt(drawMatch[1], 10) || 1);
    effects.push({ trigger: 'immediate', actions: [{ kind: 'add', source: 'deck', destination: 'hand', quantity: { mode: 'exact', value: n } }] });
  }

  // Discard N
  const discardMatch = t.match(/discard\s+(?:up to\s+)?(\d+)/);
  if (discardMatch) {
    const n = Math.max(1, parseInt(discardMatch[1], 10) || 1);
    effects.push({ trigger: 'immediate', actions: [{ kind: 'move', targets: { scope: 'self', zone: 'hand', quantity: { mode: 'exact', value: n } }, to: { scope: 'self', zone: 'discard' } }] });
  }

  // Destroy 1 (very naive)
  if (/destroy\s+(?:one|1)/.test(t)) {
    effects.push({ trigger: 'immediate', actions: [{ kind: 'destroy', targets: { scope: 'opponent', zone: 'stable', quantity: { mode: 'exact', value: 1 } } }] });
  }

  // Return to hand
  if (/return\s+.*\s+to\s+(?:your\s+)?hand/.test(t)) {
    effects.push({ trigger: 'immediate', actions: [{ kind: 'return', targets: { scope: 'self', zone: 'stable', quantity: { mode: 'exact', value: 1 } }, destination: { scope: 'self', zone: 'hand' } }] });
  }

  return effects;
}

// Опциональный перевод: использует LibreTranslate, если задан TRANSLATE_API_URL
async function maybeTranslateNameAndDesc(name: string, descriptionEn: string): Promise<{ name: string; description: string } | null> {
  const apiUrl = process.env.TRANSLATE_API_URL; // напр. http://localhost:5000/translate
  const apiKey = process.env.TRANSLATE_API_KEY || '';
  const enabled = process.env.TRANSLATE_ENABLED === 'true' || !!apiUrl;
  if (!enabled || !apiUrl) return null;

  try {
    const headers: any = { 'Content-Type': 'application/json' };
    const bodyName: any = { q: name, source: 'en', target: 'ru', format: 'text' };
    const bodyDesc: any = { q: descriptionEn, source: 'en', target: 'ru', format: 'text' };
    if (apiKey) { bodyName.api_key = apiKey; bodyDesc.api_key = apiKey; }

    const [r1, r2] = await Promise.all([
      fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(bodyName) }),
      fetch(apiUrl, { method: 'POST', headers, body: JSON.stringify(bodyDesc) }),
    ]);
    const j1 = await r1.json().catch(() => ({} as any));
    const j2 = await r2.json().catch(() => ({} as any));
    const outName = (j1?.translatedText as string) || name;
    const outDesc = (j2?.translatedText as string) || descriptionEn;
    return { name: outName, description: outDesc };
  } catch (e) {
    console.warn('[import/wiki] translate failed, continue without translation');
    return null;
  }
}

export default router;

