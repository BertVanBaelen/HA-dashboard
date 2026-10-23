import { createHash } from 'node:crypto';
import { DOMParser, parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import { NEWS_SOURCES, NEWS_BIG_KEYWORDS } from '../shared/config.js';

const FEED_TTL = 10 * 60e3;
const MAX_AGE = 48 * 3600e3;
const ARTICLE_TTL = 6 * 3600e3;
const ARTICLE_CACHE_SIZE = 300;
const MIN_ARTICLE_TEXT = 350;
const TZ = 'Europe/Brussels';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

// Capitalised words that say nothing about the topic (sentence starters, months, days, ...)
const STOP = new Set(
  ('het een de dat die deze dit er maar ook nog toen want als bij voor van met over na in op om uit tot door zo nu wat wie waar hoe '
    + 'volgens daarna intussen ondertussen vandaag gisteren morgen nieuwe nieuw meer veel the and for with from after over this that '
    + 'what who how why when where his her their they she has have new says said live watch video update belgië belgische '
    + 'maandag dinsdag woensdag donderdag vrijdag zaterdag zondag januari februari maart april mei juni juli augustus september '
    + 'oktober november december monday tuesday wednesday thursday friday saturday sunday verenigde staten europese unie '
    + 'league cup champions premier amerikaanse britse nederlandse franse duitse russische chinese minister president premier '
    + 'koning prins regering kamer world news sport').split(' '),
);

const sha = (s) => createHash('sha1').update(s).digest('base64url').slice(0, 12);
const clean = (s) => (s ?? '').replace(/\s+/g, ' ').trim();
const dayKey = (ms) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: TZ });
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

async function get(url, timeout = 12000) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'nl-BE,nl;q=0.9,en;q=0.8' },
    signal: AbortSignal.timeout(timeout),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// ---- XML helpers -------------------------------------------------------------

const kids = (el, name) => [...(el?.children ?? [])].filter((c) => c.tagName.toLowerCase() === name);
const kid = (el, name) => kids(el, name)[0];
const txt = (el, name) => clean(kid(el, name)?.textContent);

function absolute(src, base) {
  if (!src || src.startsWith('data:') || /placeholder/i.test(src)) return null;
  try {
    const u = new URL(src, base);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

/** Turn article HTML into plain text blocks; the client renders these without {@html}. */
export function htmlToBlocks(html, base) {
  const { document } = parseHTML(`<!doctype html><html><body>${html}</body></html>`);
  const out = [];
  for (const el of document.body.querySelectorAll('p,h1,h2,h3,h4,li,blockquote,img')) {
    const tag = el.tagName.toLowerCase();
    if (tag === 'img') {
      const src = absolute(el.getAttribute('src') || el.getAttribute('data-src'), base);
      const cap = el.closest('figure')?.querySelector('figcaption');
      const caption = cap ? [...cap.childNodes].map((n) => clean(n.textContent)).filter(Boolean).join(' · ') : '';
      if (src && !out.some((b) => b.src === src)) out.push({ t: 'img', src, caption });
      continue;
    }
    if (el.parentElement?.closest('p,li,blockquote,h1,h2,h3,h4,figcaption')) continue;
    const text = clean(el.textContent);
    if (!text) continue;
    const t = tag === 'li' ? 'li' : tag === 'blockquote' ? 'quote' : tag.startsWith('h') ? 'h' : 'p';
    if (out.at(-1)?.text === text) continue;
    out.push({ t, text });
  }
  return out;
}

// ---- Feed parsing -------------------------------------------------------------

function parseFeed(src, xml) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml');
  const root = doc.documentElement;
  const channel = kid(root, 'channel') ?? root;
  const nodes = [...kids(channel, 'item'), ...kids(channel, 'entry')];
  const now = Date.now();
  const out = [];
  for (const n of nodes) {
    const title = txt(n, 'title');
    if (!title) continue;
    let url = '', image = null, bodyUrl = null, bodyHtml = null, summary = '';
    for (const l of kids(n, 'link')) {
      const href = l.getAttribute('href');
      const rel = l.getAttribute('rel') ?? 'alternate';
      if (!href) url ||= clean(l.textContent);
      else if (rel === 'alternate') url = href;
      else if (rel === 'enclosure' && l.getAttribute('type')?.startsWith('image')) image = href;
      else if (rel === 'self' && href.endsWith('.rss.xml')) bodyUrl = href;
    }
    image ??= kid(n, 'enclosure')?.getAttribute('url') ?? kid(n, 'media:thumbnail')?.getAttribute('url') ?? kid(n, 'media:content')?.getAttribute('url') ?? null;
    const desc = kid(n, 'summary') ?? kid(n, 'description');
    const raw = desc?.textContent ?? '';
    if (/<p[\s>]/i.test(raw)) {
      const blocks = htmlToBlocks(raw, url);
      summary = blocks.find((b) => b.t === 'p')?.text ?? '';
      if (src.body === 'feed') bodyHtml = raw;
    } else {
      summary = clean(raw.replace(/<[^>]+>/g, ' '));
    }
    const published = Date.parse(txt(n, 'published') || txt(n, 'pubdate') || txt(n, 'updated') || txt(n, 'dc:date'));
    if (!Number.isFinite(published) || now - published > MAX_AGE) continue;
    const guid = txt(n, 'guid') || txt(n, 'id') || url;
    const tags = [...kids(n, 'vrtns:nstag'), ...kids(n, 'category')].flatMap((c) => clean(c.textContent).split(/\s*[|/]\s*/)).filter(Boolean);
    const premium = txt(n, 'premium') === 'true';

    if (src.id === 'bbc') {
      url = url.replace(/\?.*$/, '');
      image = image?.replace(/\/standard\/\d+\//, '/standard/800/') ?? null;
    }
    const noBody = src.body === 'none' || premium || (src.id === 'bbc' && /\/(videos|live|sounds)\//.test(url));
    out.push({
      id: sha(`${src.id}|${guid}`),
      source: src.id,
      title,
      summary: summary === title ? '' : summary,
      url,
      image,
      published,
      tags: [...new Set(tags)],
      premium: premium || undefined,
      readable: !noBody,
      _bodyUrl: bodyUrl,
      _bodyHtml: bodyHtml,
    });
  }
  return out;
}

// ---- Importance ----------------------------------------------------------------

function keyTokens(text) {
  const tokens = new Set();
  for (const sentence of text.split(/(?<=[.!?:"“”])\s+/)) {
    const words = [...sentence.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)].map((m) => m[0]);
    words.forEach((w, i) => {
      if (i === 0 || w.length < 3 || !/^\p{Lu}/u.test(w)) return;
      const k = w.toLowerCase().replace(/['’]s$/, '');
      if (!STOP.has(k)) tokens.add(k);
    });
  }
  return tokens;
}

const shared = (a, b) => {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
};

const keywordRes = Object.fromEntries(
  Object.entries(NEWS_BIG_KEYWORDS).map(([id, words]) => [
    id,
    words.map((w) => ({ w, re: new RegExp(`(^|[^\\p{L}])${escapeRe(w)}([^\\p{L}]|$)`, w === w.toUpperCase() ? 'u' : 'iu') })),
  ]),
);

const sourceName = (id) => NEWS_SOURCES.find((s) => s.id === id)?.name ?? id;

/** Score every item: +2 per other source covering the same topic, +1 per big keyword. */
function annotate(all) {
  const df = new Map();
  for (const it of all) {
    it._tokens = keyTokens(`${it.title}. ${it.summary}`);
    it._words = new Set(it.title.toLowerCase().match(/\p{L}{4,}/gu)?.filter((w) => !STOP.has(w)) ?? []);
    for (const t of it._tokens) df.set(t, (df.get(t) ?? 0) + 1);
  }
  // Words that show up everywhere (Trump, Gaza, ...) don't prove two items are about the same story.
  const common = Math.max(6, all.length * 0.04);
  for (const it of all) it._tokens = new Set([...it._tokens].filter((t) => df.get(t) <= common));
  for (const it of all) {
    const covered = new Set();
    for (const o of all) {
      if (o.source === it.source || covered.has(o.source) || Math.abs(o.published - it.published) > 36 * 3600e3) continue;
      if (shared(it._tokens, o._tokens) >= 2) covered.add(o.source);
    }
    const text = `${it.title} ${it.summary} ${it.tags.join(' ')}`;
    const words = (keywordRes[it.source] ?? []).filter((k) => k.re.test(text)).map((k) => k.w);
    it._score = covered.size * 2 + words.length;
    it._why = [covered.size ? `Ook bij ${[...covered].map(sourceName).join(', ')}` : '', ...words.slice(0, 2)].filter(Boolean);
  }
}

// ---- Service ---------------------------------------------------------------------

export class News {
  constructor({ log = console } = {}) {
    this.log = log;
    this.feeds = new Map(); // source id -> { at, items, error }
    this.inflight = new Map();
    this.index = new Map(); // item id -> item (with private fields)
    this.articles = new Map(); // item id -> { at, data }
  }

  async run(op, args, prefs) {
    if (op === 'list') return this.list(prefs, !!args.force);
    if (op === 'article') return this.article(String(args.id ?? ''));
    throw new Error(`Onbekende nieuwsactie ${op}`);
  }

  refreshFeed(src, force) {
    const cached = this.feeds.get(src.id);
    if (cached && Date.now() - cached.at < (force ? 60e3 : FEED_TTL)) return cached;
    if (this.inflight.has(src.id)) return this.inflight.get(src.id);
    const p = get(src.feed)
      .then((xml) => {
        const items = parseFeed(src, xml);
        const entry = { at: Date.now(), items, error: null };
        this.feeds.set(src.id, entry);
        for (const it of items) this.index.set(it.id, it);
        return entry;
      })
      .catch((err) => {
        this.log.warn?.(`[news] ${src.id} feed failed: ${err.message}`);
        const entry = { at: Date.now() - FEED_TTL + 60e3, items: cached?.items ?? [], error: err.message };
        this.feeds.set(src.id, entry);
        return entry;
      })
      .finally(() => this.inflight.delete(src.id));
    this.inflight.set(src.id, p);
    return p;
  }

  async list(prefs, force) {
    const modes = prefs?.news?.sources ?? {};
    const mode = (s) => modes[s.id] ?? s.mode;
    // All feeds are fetched (shared cache) so "covered by another source" also works for sources that are switched off.
    const entries = await Promise.all(NEWS_SOURCES.map((s) => this.refreshFeed(s, force)));
    const all = entries.flatMap((e) => e.items);
    annotate(all);
    this.pruneIndex(all);

    const weight = Object.fromEntries(NEWS_SOURCES.map((s) => [s.id, s.weight]));
    const picked = [];
    for (const src of NEWS_SOURCES) {
      const m = mode(src);
      if (m === 'uit') continue;
      const items = all.filter((i) => i.source === src.id);
      if (m === 'alles') {
        picked.push(...items.map((i) => ({ ...i, big: i._score >= 2 })));
        continue;
      }
      const byDay = new Map();
      for (const i of items) if (i._score >= 1) byDay.set(dayKey(i.published), [...(byDay.get(dayKey(i.published)) ?? []), i]);
      for (const day of byDay.values()) {
        day.sort((a, b) => b._score - a._score || b.published - a.published);
        picked.push(...day.slice(0, src.perDay).map((i) => ({ ...i, big: true })));
      }
    }

    // Same story in several feeds: keep the one from the most important source.
    picked.sort((a, b) => weight[b.source] - weight[a.source] || b.readable - a.readable || b.published - a.published);
    const kept = [];
    for (const it of picked) {
      const dup = kept.some((k) => {
        if (k.source === it.source || Math.abs(k.published - it.published) > 24 * 3600e3) return false;
        const keys = shared(k._tokens, it._tokens);
        return keys >= 3 || (keys >= 2 && shared(k._words, it._words) >= 2);
      });
      if (!dup) kept.push(it);
    }
    const rank = (i) => i.published + weight[i.source] * 3600e3 + (i.big ? 2 * 3600e3 : 0);
    kept.sort((a, b) => rank(b) - rank(a));

    return {
      items: kept.map(({ _bodyUrl, _bodyHtml, _tokens, _words, _score, _why, ...it }) => ({ ...it, why: it.big ? _why : [] })),
      errors: NEWS_SOURCES.flatMap((s, i) => (entries[i].error && mode(s) !== 'uit' ? [{ source: s.id, error: entries[i].error }] : [])),
      fetchedAt: Math.min(...entries.map((e) => e.at)),
    };
  }

  pruneIndex(all) {
    if (this.index.size < 2000) return;
    const live = new Set(all.map((i) => i.id));
    for (const id of this.index.keys()) if (!live.has(id)) this.index.delete(id);
  }

  async article(id) {
    const hit = this.articles.get(id);
    if (hit && Date.now() - hit.at < ARTICLE_TTL) return hit.data;
    const it = this.index.get(id);
    if (!it) throw new Error('Dit artikel is niet meer beschikbaar');
    if (!it.readable) return { readable: false, blocks: [] };
    if (this.inflight.has(`a:${id}`)) return this.inflight.get(`a:${id}`);
    const p = this.extract(it)
      .then((blocks) => {
        const ignore = new Set([clean(it.title), clean(it.summary)].filter(Boolean));
        blocks = blocks.filter((b) => !ignore.has(b.text));
        // Drop leading metadata lines (date, "3 min" reading time, author) before the first real paragraph.
        const first = blocks.findIndex((b) => b.t === 'p' && b.text.length >= 60);
        if (first > 0) blocks = blocks.filter((b, i) => i >= first || b.t === 'img' || b.text.length >= 40);
        blocks = blocks.slice(0, 250);
        const textLen = blocks.reduce((n, b) => n + (b.t === 'img' ? 0 : b.text.length), 0);
        const data = textLen >= MIN_ARTICLE_TEXT ? { readable: true, blocks } : { readable: false, blocks: [] };
        this.articles.set(id, { at: Date.now(), data });
        if (this.articles.size > ARTICLE_CACHE_SIZE) this.articles.delete(this.articles.keys().next().value);
        return data;
      })
      .catch((err) => {
        this.log.warn?.(`[news] article ${it.source} ${it.url} failed: ${err.message}`);
        return { readable: false, blocks: [], error: err.message };
      })
      .finally(() => this.inflight.delete(`a:${id}`));
    this.inflight.set(`a:${id}`, p);
    return p;
  }

  async extract(it) {
    const src = NEWS_SOURCES.find((s) => s.id === it.source);
    if (src.body === 'feed' && it._bodyHtml) return htmlToBlocks(it._bodyHtml, it.url);
    if (src.body === 'vrt' && it._bodyUrl) {
      const doc = new DOMParser().parseFromString(await get(it._bodyUrl), 'text/xml');
      const entry = kid(doc.documentElement, 'entry');
      const html = kid(entry, 'content')?.textContent ?? '';
      if (html) return htmlToBlocks(html, it.url);
    }
    const { document } = parseHTML(await get(it.url, 15000));
    const parsed = new Readability(document).parse();
    return parsed?.content ? htmlToBlocks(parsed.content, it.url) : [];
  }
}
