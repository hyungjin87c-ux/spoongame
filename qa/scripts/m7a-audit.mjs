// QA-003 M7a 접근성·레이아웃 감사. 모드 3개: layout(가로 넘침·낱말 끊김·h1 한 줄·영향 줄 칸), focus(Tab 순회에서 고정 요소에 가려지는 포커스, CM10), pixel(렌더 픽셀 대비 5모드).
// 사용: node qa/scripts/m7a-audit.mjs <layout|focus|pixel> <states,comma> [fonts=100,150,200] [workers=3]
// 상태 = qa/results/m7a/saves/<이름>.json (m7a-saves.mjs가 만듦). 결과: qa/results/m7a/audit-<모드>.jsonl, pixel은 pixel.json
import fs from 'node:fs';
import path from 'node:path';
import { launch, sleep, OUT, mkctx, PROD, GAME_KEY, SETTINGS_KEY, setRootFont, SHOT_DIR } from './m7a-lib.mjs';
import { WB_AUDIT, H1_AUDIT } from './m3r2-wb.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const mode = process.argv[2] || 'layout';
const states = (process.argv[3] || 'log2').split(',');
const fonts = (process.argv[4] || '100,150,200').split(',').map(Number);
const workers = Number(process.argv[5] || 3);
const SAVES = path.join(OUT, RP + 'saves');
const outFile = path.join(OUT, RP + `audit-${mode}${process.env.OUT_SUFFIX || ''}.jsonl`);
if (!process.env.QA_APPEND) fs.writeFileSync(outFile, '');

const VPS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x568', width: 360, height: 568 },
  { name: '360x740-touch', width: 360, height: 740, touch: true },
  { name: '375x812', width: 375, height: 812 },
  { name: '667x375-landscape', width: 667, height: 375 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x620', width: 1280, height: 620 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '640x400-zoom200', width: 640, height: 400 },
  { name: '320x256-zoom400', width: 320, height: 256 },
];
const isEnding = (st) => st.startsWith('ending');
const wantsCard = (st) => st.startsWith('card-');
const SETTINGS_FAST = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system' } });

export async function openSave(browser, state, { vp, font = 100, ctxOpts = {}, settingsRaw = null }) {
  const opts = { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? { hasTouch: true, isMobile: true, deviceScaleFactor: 2 } : {}), ...ctxOpts };
  const ctx = await mkctx(browser, opts);
  const raw = fs.readFileSync(path.join(SAVES, `${state}.json`), 'utf8');
  await ctx.addInitScript(
    ([k, v, sk, sv]) => {
      try {
        if (!sessionStorage.getItem('__qa_seeded')) {
          localStorage.clear();
          localStorage.setItem(k, v);
          localStorage.setItem(sk, sv);
          sessionStorage.setItem('__qa_seeded', '1');
        }
      } catch {}
    },
    [GAME_KEY, raw, SETTINGS_KEY, settingsRaw || SETTINGS_FAST],
  );
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector(`[data-testid="${isEnding(state) ? 'ending-screen' : 'life-screen'}"]`, { timeout: 15000 });
  if (wantsCard(state)) {
    await page.waitForSelector('[data-testid="choice-panel"]', { timeout: 30000 });
    await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 8000 }).catch(() => {});
  } else if (!isEnding(state)) {
    await sleep(300);
  }
  await sleep(300);
  if (font !== 100) await setRootFont(page, font);
  if (process.env.MUT_CSS) await page.addStyleTag({ content: process.env.MUT_CSS });
  await sleep(250);
  return { ctx, page };
}

const MEASURE = () => {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const root = document.documentElement;
  const q = (s) => document.querySelector(s);
  const visible = (e) => {
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width <= 0 || r.height <= 0) return false;
    if (r.width <= 1.5 && r.height <= 1.5) return false;
    return true;
  };
  const over = [];
  for (const e of document.body.querySelectorAll('*')) {
    if (e.namespaceURI === 'http://www.w3.org/2000/svg' && e.tagName !== 'svg') continue;
    if (!visible(e)) continue;
    const r = e.getBoundingClientRect();
    let clipped = false;
    for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) {
      const cs = getComputedStyle(x);
      if (cs.overflowX !== 'visible') {
        clipped = true;
        break;
      }
    }
    if (clipped) continue;
    if (r.right > vw + 0.5 || r.left < -0.5) over.push(`${e.tagName.toLowerCase()}${e.getAttribute('data-testid') ? '[' + e.getAttribute('data-testid') + ']' : e.className && typeof e.className === 'string' ? '.' + e.className.split(' ')[0] : ''} ${Math.round(r.left)}~${Math.round(r.right)}`);
  }
  const card = { impactOut: [], choiceW: [], textClip: [] };
  for (const b of document.querySelectorAll('[data-testid="choice-panel"] .choice')) {
    const br = b.getBoundingClientRect();
    card.choiceW.push(Math.round(br.width));
    const body = b.querySelector('.choice__body');
    const bodyR = body ? body.getBoundingClientRect() : br;
    for (const it of b.querySelectorAll('.impact__item')) {
      const r = it.getBoundingClientRect();
      if (r.left < bodyR.left - 0.5 || r.right > bodyR.right + 0.5 || r.right > br.right + 0.5) card.impactOut.push(it.getAttribute('data-key') + ' ' + Math.round(r.left) + '~' + Math.round(r.right));
    }
    for (const e of b.querySelectorAll('*')) if (!e.classList.contains('sr-only') && !e.closest('.sr-only') && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible') card.textClip.push((e.className || e.tagName) + ' ' + e.scrollWidth + '>' + e.clientWidth);
  }
  // 글 상자(결정 카드 본문·인생 기록 줄·엔딩 연표 줄)가 자기 상자보다 넓은 글을 갖는가
  const textBoxes = [];
  for (const e of document.querySelectorAll('[data-testid="choice-text"], [data-testid="choice-title"], [data-testid="log-row"], [data-testid="timeline-entry"], [data-testid="ending-journey"], [data-testid="ending-movement"], [data-testid="ending-note"], [data-testid="birth-sentence"]')) {
    if (e.scrollWidth > e.clientWidth + 1) textBoxes.push((e.getAttribute('data-testid')) + ' ' + e.scrollWidth + '>' + e.clientWidth);
  }
  const logList = q('[data-testid="log-list"]');
  const logBox = logList ? (() => { const r = logList.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), scrollW: logList.scrollWidth, clientW: logList.clientWidth }; })() : null;
  const ctl = q('[data-testid="controls"]');
  const head = q('[data-testid="dash-head"]');
  return {
    vw,
    vh,
    docOverflow: root.scrollWidth - root.clientWidth,
    over: over.slice(0, 6),
    card,
    textBoxes,
    logBox,
    head: head ? { pos: getComputedStyle(head).position, h: Math.round(head.getBoundingClientRect().height) } : null,
    ctl: ctl ? { pos: getComputedStyle(ctl).position, h: Math.round(ctl.getBoundingClientRect().height) } : null,
    docH: root.scrollHeight,
  };
};

// 인생 기록 안쪽(스크롤 영역) 점검: 목록 끝까지 스크롤하며 마지막 줄이 온전한지, 줄 안 글이 상자를 넘지 않는지
const LOG_INNER = () => {
  const list = document.querySelector('[data-testid="log-list"]');
  if (!list) return null;
  const rows = [...list.querySelectorAll('[data-testid="log-row"]')];
  const out = { rows: rows.length, overW: [], lastVisible: null, sameAgeTwo: 0 };
  let prev = null;
  for (const r of rows) {
    if (r.scrollWidth > r.clientWidth + 1) out.overW.push(r.textContent.slice(0, 20) + ' ' + r.scrollWidth + '>' + r.clientWidth);
    const m = /^(\d+)\s*세/.exec(r.textContent.trim());
    if (m && prev === m[1]) out.sameAgeTwo++;
    prev = m ? m[1] : null;
  }
  list.scrollTo({ top: list.scrollHeight, behavior: 'instant' });
  const last = rows[rows.length - 1];
  if (last) {
    const lr = last.getBoundingClientRect();
    const br = list.getBoundingClientRect();
    out.lastTall = lr.height > list.clientHeight + 1;
    out.listH = list.clientHeight;
    out.lastH = Math.round(lr.height);
    out.lastVisible = out.lastTall ? (lr.bottom <= br.bottom + 1) : (lr.bottom <= br.bottom + 1 && lr.top >= br.top - 1);
  }
  return out;
};

const TAG_INTERACTIVE = () => {
  let n = 0;
  const out = [];
  for (const e of document.querySelectorAll('button, a[href], input:not([type="hidden"]), select, textarea, summary, [tabindex]')) {
    if (e.getAttribute('tabindex') === '-1' || e.disabled) continue;
    const cs = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (cs.display === 'none' || cs.visibility === 'hidden' || r.width < 2 || r.height < 2) continue;
    let hidden = false;
    for (let x = e; x; x = x.parentElement) if (x.hidden || getComputedStyle(x).display === 'none') hidden = true;
    if (hidden) continue;
    e.setAttribute('data-qa-i', String(n));
    out.push({ i: n, id: e.getAttribute('data-testid') || (e.textContent || '').trim().slice(0, 10) || e.tagName });
    n++;
  }
  return out;
};

const FOCUS_MEASURE = () => {
  const a = document.activeElement;
  if (!a || a === document.body || a === document.documentElement) return { none: true };
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const cs = getComputedStyle(a);
  const r = a.getBoundingClientRect();
  const ow = cs.outlineStyle !== 'none' ? parseFloat(cs.outlineWidth) || 0 : 0;
  const oo = cs.outlineStyle !== 'none' ? Math.max(parseFloat(cs.outlineOffset) || 0, 0) : 0;
  const g = ow + oo;
  const box = { l: r.left - g, t: r.top - g, r: r.right + g, b: r.bottom + g };
  const fixed = [];
  for (const e of document.body.querySelectorAll('*')) {
    const c = getComputedStyle(e);
    if (c.position !== 'fixed' && c.position !== 'sticky') continue;
    if (c.visibility === 'hidden' || parseFloat(c.opacity) === 0 || c.display === 'none') continue;
    const q = e.getBoundingClientRect();
    if (q.width < 2 || q.height < 2) continue;
    if (c.position === 'sticky' && !(q.top <= 1 || q.bottom >= vh - 1)) continue;
    if (c.pointerEvents === 'none' && e.textContent.trim() === '' && e.children.length === 0) continue;
    if (e.contains(a) || a.contains(e)) continue;
    fixed.push({ el: e.getAttribute('data-testid') || (typeof e.className === 'string' ? e.className.split(' ')[0] : '') || e.tagName, l: q.left, t: q.top, r: q.right, b: q.bottom });
  }
  let overlap = 0;
  const hit = [];
  for (const f of fixed) {
    const w = Math.min(box.r, f.r) - Math.max(box.l, f.l);
    const h = Math.min(box.b, f.b) - Math.max(box.t, f.t);
    if (w > 0.5 && h > 0.5) {
      overlap += w * h;
      hit.push(`${f.el}(${Math.round(f.t)}~${Math.round(f.b)}) vs 포커스 ${Math.round(box.t)}~${Math.round(box.b)}`);
    }
  }
  const topFix = fixed.filter((f) => f.t <= 1 && f.b < vh * 0.9).reduce((m, f) => Math.max(m, f.b), 0);
  const botFix = fixed.filter((f) => f.b >= vh - 1 && f.t > vh * 0.1).reduce((m, f) => Math.min(m, f.t), vh);
  const avail = botFix - topFix;
  const tall = r.height > avail || box.b - box.t > avail;
  let outside = false;
  if (!tall) outside = box.t < -0.5 || box.b > vh + 0.5 || box.l < -0.5 || box.r > vw + 0.5;
  else outside = box.t < topFix - 0.5 && r.bottom < topFix;
  const cx = Math.min(Math.max((Math.max(r.left, 0) + Math.min(r.right, vw)) / 2, 0), vw - 1);
  const top = Math.max(r.top, topFix);
  const bot = Math.min(r.bottom, botFix);
  const cy = (top + bot) / 2;
  let centerOk = true;
  if (bot - top > 2) {
    const el = document.elementFromPoint(cx, Math.min(Math.max(cy, 0), vh - 1));
    centerOk = !!el && (a === el || a.contains(el) || el.contains(a));
  }
  return {
    id: a.getAttribute('data-testid') || a.getAttribute('aria-label') || (a.textContent || '').trim().slice(0, 12) || a.tagName,
    qi: a.getAttribute('data-qa-i'),
    t: Math.round(box.t),
    b: Math.round(box.b),
    h: Math.round(r.height),
    overlap: Math.round(overlap),
    hit,
    outside,
    centerOk,
    tall,
    nFixed: fixed.length,
  };
};

async function layoutJob(browser, j) {
  const { ctx, page } = await openSave(browser, j.st, { vp: j.vp, font: j.font });
  const m = await page.evaluate(MEASURE);
  const h1 = await page.evaluate(H1_AUDIT);
  // 인생 기록은 스크롤 영역이라 보이는 줄만 잰다 — 맨 위부터 맨 아래까지 훑으며 낱말 끊김을 모은다
  const hasLog = await page.evaluate(() => !!document.querySelector('[data-testid="log-list"]'));
  const positions = hasLog ? await page.evaluate(() => { const l = document.querySelector('[data-testid="log-list"]'); const n = Math.max(1, Math.ceil(l.scrollHeight / Math.max(1, l.clientHeight * 0.7))); return Array.from({ length: n + 1 }, (_, i) => Math.min(l.scrollHeight, Math.floor(i * l.clientHeight * 0.7))); }) : [null];
  const wbAll = { wordsN: 0, charsN: 0, broken: [], unavoidable: [], intended: 0, cats: {}, scrolls: positions.length };
  const seenBroken = new Set();
  for (const pos of positions) {
    if (pos !== null) await page.evaluate((y) => { document.querySelector('[data-testid="log-list"]').scrollTo({ top: y, behavior: 'instant' }); }, pos);
    await sleep(60);
    const wb = await page.evaluate(WB_AUDIT, { intended: ['다이아몬드수저'] });
    wbAll.wordsN = Math.max(wbAll.wordsN, wb.wordsN);
    wbAll.charsN = Math.max(wbAll.charsN, wb.charsN);
    wbAll.cats = wb.cats;
    for (const b of wb.broken) if (!seenBroken.has(b.word + b.where)) { seenBroken.add(b.word + b.where); wbAll.broken.push(b); }
    for (const b of wb.unavoidable) if (!seenBroken.has(b.word + b.where)) { seenBroken.add(b.word + b.where); wbAll.unavoidable.push(b); }
  }
  const logInner = await page.evaluate(LOG_INNER);
  await ctx.close();
  return { m, wb: wbAll, h1, logInner };
}

async function focusJob(browser, j) {
  const rec = { fwd: [], bwd: [], issues: [], interactive: 0, reached: 0, missing: [] };
  const { ctx, page } = await openSave(browser, j.st, { vp: j.vp, font: j.font });
  const inter = await page.evaluate(TAG_INTERACTIVE);
  rec.interactive = inter.length;
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
  });
  await sleep(100);
  const reached = new Set();
  const seen = [];
  for (let i = 0; i < inter.length + 6; i++) {
    await page.keyboard.press('Tab');
    await sleep(70);
    const m = await page.evaluate(FOCUS_MEASURE);
    if (m.none) break;
    rec.fwd.push(m.id);
    if (m.qi !== null) reached.add(Number(m.qi));
    if ((!m.tall && m.overlap > 0) || m.outside || !m.centerOk) rec.issues.push({ dir: 'fwd', ...m });
    if (m.tall && m.overlap > 0) rec.tallNotes = [...(rec.tallNotes ?? []), `${m.id} 링 ${m.t}~${m.b} ${(m.hit[0] ?? '').slice(0, 40)}`];
    seen.push(m.qi);
    if (seen.length > 1 && m.qi === seen[0]) break;
  }
  for (let i = 0; i < inter.length + 6; i++) {
    await page.keyboard.press('Shift+Tab');
    await sleep(70);
    const m = await page.evaluate(FOCUS_MEASURE);
    if (m.none) break;
    rec.bwd.push(m.id);
    if (m.qi !== null) reached.add(Number(m.qi));
    if ((!m.tall && m.overlap > 0) || m.outside || !m.centerOk) rec.issues.push({ dir: 'bwd', ...m });
  }
  rec.reached = reached.size;
  rec.missing = inter.filter((x) => !reached.has(x.i)).map((x) => x.id);
  await ctx.close();
  return rec;
}

if (mode === 'layout' || mode === 'focus') {
  const browser = await launch();
  const jobs = [];
  for (const st of states) for (const vp of VPS) for (const font of fonts) {
    if (mode === 'focus' && vp.name === '320x256-zoom400' && font === 200) continue;
    jobs.push({ st, vp, font });
  }
  let idx = 0;
  let done = 0;
  async function worker() {
    while (idx < jobs.length) {
      const j = jobs[idx++];
      let rec = { state: j.st, vp: j.vp.name, font: j.font };
      try {
        const r = mode === 'layout' ? await layoutJob(browser, j) : await focusJob(browser, j);
        rec = { ...rec, ...r };
      } catch (e) {
        rec.err = String(e.message).slice(0, 200);
      }
      fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
      done++;
      if (done % 20 === 0) console.log(`${done}/${jobs.length}`);
    }
  }
  await Promise.all(Array.from({ length: workers }, worker));
  await browser.close();
  console.log('DONE', done);
}

// ---------------- pixel ----------------
if (mode === 'pixel') {
  const RECTS = () => {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n;
    const parseBg = (e) => {
      for (let x = e; x; x = x.parentElement) {
        const c = getComputedStyle(x).backgroundColor;
        const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c);
        if (m && (m[4] === undefined || Number(m[4]) > 0)) return { el: x, css: c };
      }
      return { el: null, css: 'page' };
    };
    while ((n = w.nextNode())) {
      const t = n.textContent.trim();
      if (!t) continue;
      const pe = n.parentElement;
      if (!pe || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(pe.tagName)) continue;
      let hidden = false;
      for (let x = pe; x && x !== document.documentElement; x = x.parentElement) {
        const cs = getComputedStyle(x);
        if (cs.display === 'none' || (x === pe && cs.visibility === 'hidden') || x.hidden || (x.tagName === 'DETAILS' && !x.open && !pe.closest('summary'))) {
          hidden = true;
          break;
        }
        const r = x.getBoundingClientRect();
        if (x !== document.body && (cs.overflow !== 'visible' || cs.clip !== 'auto') && (r.width <= 1.5 || r.height <= 1.5)) {
          hidden = true;
          break;
        }
      }
      if (hidden) continue;
      const rg = document.createRange();
      rg.selectNodeContents(n);
      const cs = getComputedStyle(pe);
      for (const r of rg.getClientRects()) {
        if (r.width < 2 || r.height < 2) continue;
        let clipped = false;
        for (let x = pe; x && x !== document.body; x = x.parentElement) {
          const c2 = getComputedStyle(x);
          if (c2.overflowX === 'visible' && c2.overflowY === 'visible') continue;
          const b = x.getBoundingClientRect();
          const cx = r.left + r.width / 2;
          const cy = r.top + r.height / 2;
          if (cx < b.left || cx > b.right || cy < b.top || cy > b.bottom) {
            clipped = true;
            break;
          }
        }
        if (clipped) continue;
        const bg = parseBg(pe);
        const px = parseFloat(cs.fontSize);
        const btn = pe.closest('button,[aria-disabled]');
        out.push({
          text: t.slice(0, 24),
          punct: !/[가-힣A-Za-z0-9]/.test(t),
          x: r.left, y: r.top, w: r.width, h: r.height, fs: px,
          bold: parseInt(cs.fontWeight, 10) >= 700,
          disabledBtn: !!(btn && btn.getAttribute('aria-disabled') === 'true'),
          testid: (pe.closest('[data-testid]') || {}).getAttribute ? pe.closest('[data-testid]').getAttribute('data-testid') : null,
          boxBg: bg.css,
          color: cs.color,
        });
      }
    }
    return out;
  };
  const PIXELS = async ({ b64, dpr, rects }) => {
    const blob = await (await fetch('data:image/png;base64,' + b64)).blob();
    const bmp = await createImageBitmap(blob);
    const cv = document.createElement('canvas');
    cv.width = bmp.width;
    cv.height = bmp.height;
    const g = cv.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const L = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
    const ratio = (a, b) => { const la = L(a); const lb = L(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); };
    const res = [];
    for (const r of rects) {
      const x0 = Math.max(0, Math.floor(r.x * dpr));
      const y0 = Math.max(0, Math.floor(r.y * dpr));
      const x1 = Math.min(cv.width, Math.ceil((r.x + r.w) * dpr));
      const y1 = Math.min(cv.height, Math.ceil((r.y + r.h) * dpr));
      const w = x1 - x0;
      const h = y1 - y0;
      if (w < 2 || h < 2) { res.push(null); continue; }
      const d = g.getImageData(x0, y0, w, h).data;
      const hist = new Map();
      for (let i = 0; i < d.length; i += 4) {
        const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
        hist.set(k, (hist.get(k) || 0) + 1);
      }
      let bgK = 0; let bgN = -1;
      for (const [k, c] of hist) if (c > bgN) { bgN = c; bgK = k; }
      const bg = [(bgK >> 16) & 255, (bgK >> 8) & 255, bgK & 255];
      const total = w * h;
      let best = null;
      for (const [k, c] of hist) {
        if (k === bgK || c < (r.punct ? 1 : Math.max(4, total * 0.005))) continue;
        const col = [(k >> 16) & 255, (k >> 8) & 255, k & 255];
        const rr = ratio(col, bg);
        if (!best || rr > best.ratio) best = { ratio: rr, col, n: c };
      }
      res.push({ bg, ink: best ? best.col : null, ratio: best ? Math.round(best.ratio * 100) / 100 : 1, inkN: best ? best.n : 0, total });
    }
    return res;
  };
  const MODES = [
    ['light', {}],
    ['dark', { colorScheme: 'dark' }],
    ['manual-dark', { manualDark: true }],
    ['forced-light', { forcedColors: 'active', colorScheme: 'light' }],
    ['forced-dark', { forcedColors: 'active', colorScheme: 'dark' }],
  ];
  const browser = await launch();
  const helper = await browser.newPage();
  await helper.goto('about:blank');
  const darkSettings = JSON.stringify({ version: 3, data: { speed: 8, autoMode: false, era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'dark' } });
  const hex = (c) => (c ? '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('') : null);
  const all = []; const bad = []; const shots = [];
  let nRows = 0; let minOverall = 99;
  for (const [m, opts] of MODES) {
    for (const st of states) {
      const ctxOpts = { ...opts };
      delete ctxOpts.manualDark;
      const { ctx, page } = await openSave(browser, st, { vp: { width: 360, height: 740, touch: true }, ctxOpts, settingsRaw: opts.manualDark ? darkSettings : null });
      await sleep(600);
      const h = await page.evaluate(() => Math.ceil(Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)));
      await page.setViewportSize({ width: 360, height: Math.min(h + 4, 8000) });
      await sleep(500);
      await page.evaluate(() => window.scrollTo(0, 0));
      const rects = await page.evaluate(RECTS);
      const png = await page.screenshot({ type: 'png' });
      const px = await helper.evaluate(PIXELS, { b64: png.toString('base64'), dpr: 2, rects });
      const rows = rects.map((r, i) => ({ ...r, px: px[i] })).filter((r) => r.px);
      nRows += rows.length;
      const need = (r) => (r.fs >= 24 || (r.fs >= 18.66 && r.bold) ? 3 : 4.5);
      const fail = rows.filter((r) => r.px.ratio < need(r));
      const min = rows.reduce((mm, r) => Math.min(mm, r.px.ratio), 99);
      minOverall = Math.min(minOverall, min);
      if (fail.length) bad.push(`${m}/${st}: 미달 ${fail.length}건 ${JSON.stringify(fail.slice(0, 3).map((r) => `${r.text}(${r.testid ?? ''} ${r.px.ratio}:1 ${hex(r.px.ink)}/${hex(r.px.bg)} ${r.fs}px)`))}`);
      all.push({ mode: m, state: st, rows: rows.length, min, docH: h });
      if (process.env.PIXEL_SHOTS && process.env.PIXEL_SHOTS.split(',').includes(st)) {
        const name = `${SHOT_PREFIX}-K01-${m}-${st}.png`;
        fs.writeFileSync(path.join(SHOT_DIR, name), png);
        shots.push(`qa/screenshots/003/${name}`);
      }
      console.log(m, st, 'rows', rows.length, 'min', min);
      await ctx.close();
    }
  }
  fs.writeFileSync(path.join(OUT, RP + `pixel${process.env.OUT_SUFFIX || ''}.json`), JSON.stringify({ all, bad, shots, nRows, minOverall }, null, 1));
  console.log('PIXEL DONE', JSON.stringify({ combos: all.length, nRows, minOverall, bad: bad.slice(0, 5), shots }));
  await browser.close();
}
