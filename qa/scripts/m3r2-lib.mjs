// QA-003 M3(룰렛·출생신고) 공용 라이브러리. 앱 코드는 건드리지 않고 브라우저로만 조작한다.
// 결과: qa/results/m3/cases.jsonl, 스크린샷: qa/screenshots/003/M3-<케이스ID>[-<접미>].png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const SHOT_DIR = path.join(ROOT, 'qa', 'screenshots', '003');
export const OUT = path.join(ROOT, 'qa', 'results', 'm3r2');
export const PROD = process.env.QA_PROD || 'http://127.0.0.1:4799/spoongame/';
export const DEV = process.env.QA_DEV || 'http://127.0.0.1:5799/';
export const GAME_KEY = 'suzeo-game:save';
export const SETTINGS_KEY = 'suzeo-game:settings';

fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const launch = (opts = {}) => chromium.launch({ headless: true, ...opts });

export const VP = {
  m360: { width: 360, height: 740 },
  m320: { width: 320, height: 568 },
  m375: { width: 375, height: 812 },
  t768: { width: 768, height: 1024 },
  d1280: { width: 1280, height: 800 },
  d1024: { width: 1024, height: 768 },
  d1280low: { width: 1280, height: 620 },
};
export const TOUCH = { hasTouch: true, isMobile: true, deviceScaleFactor: 2 };

/** 공통 뷰포트 11종 (SPEC QM2-1 (a)) */
export const STD_VIEWPORTS = [
  { name: '320x568', width: 320, height: 568 },
  { name: '360x568', width: 360, height: 568 },
  { name: '360x740-touch', width: 360, height: 740, touch: true },
  { name: '375x812', width: 375, height: 812 },
  { name: '667x375-landscape', width: 667, height: 375 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '1024x768', width: 1024, height: 768 },
  { name: '1280x620', width: 1280, height: 620 },
  { name: '1280x800', width: 1280, height: 800 },
  { name: '640x400-zoom200', width: 640, height: 400, zoom: true },
  { name: '320x256-zoom400', width: 320, height: 256, zoom: true },
];

// ---------- 콘솔·네트워크 수집 ----------
export class Con {
  constructor() {
    this.items = [];
    this.requests = [];
  }
  attach(page, label = '') {
    page.on('console', (m) => {
      const t = m.type();
      if (t === 'error' || t === 'warning') this.items.push({ type: t, text: m.text().slice(0, 300), label });
    });
    page.on('pageerror', (e) => this.items.push({ type: 'pageerror', text: String(e && e.message ? e.message : e).slice(0, 300), label }));
    page.on('requestfailed', (r) => {
      const f = r.failure();
      this.items.push({ type: 'requestfailed', text: `${r.url().slice(0, 120)} ${f ? f.errorText : ''}`, label });
    });
    page.on('request', (r) => this.requests.push(r.url()));
    page.on('dialog', (d) => {
      this.items.push({ type: 'dialog', text: `${d.type()}: ${d.message().slice(0, 100)}`, label });
      d.dismiss().catch(() => {});
    });
  }
  take() {
    const a = this.items;
    this.items = [];
    return a;
  }
  takeRequests() {
    const a = this.requests;
    this.requests = [];
    return a;
  }
}
export const con = new Con();

export async function mkctx(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: VP.m360, locale: 'ko-KR', ...opts });
  ctx.on('page', (p) => con.attach(p, 'tab'));
  return ctx;
}

/** 새 판의 시드를 고정한다 — 앱이 시드를 뽑는 `crypto.getRandomValues(Uint32Array(1))`만 바꾼다(앱 코드는 그대로). */
export async function fixSeed(ctx, seed) {
  await ctx.addInitScript((s) => {
    const orig = crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues = (buf) => {
      if (buf instanceof Uint32Array && buf.length === 1) {
        buf[0] = s >>> 0;
        return buf;
      }
      return orig(buf);
    };
  }, seed);
}

/** 컨텍스트가 만들어질 때 저장소를 비운다(첫 로드 때만 — 새로고침에는 남겨 둔다). */
export async function cleanStorageOnce(ctx) {
  await ctx.addInitScript(() => {
    try {
      if (!sessionStorage.getItem('__qa_cleaned')) {
        localStorage.clear();
        sessionStorage.setItem('__qa_cleaned', '1');
      }
    } catch {}
  });
}

// ---------- 스크린샷 ----------
export async function shot(page, id, suffix = '', opts = {}) {
  const name = `M3r2-${id}${suffix ? '-' + suffix : ''}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: !!opts.full });
  return `qa/screenshots/003/${name}`;
}

// ---------- 결과 기록 ----------
export const CASES = process.env.QA_CASES || path.join(OUT, 'cases.jsonl');
/** c: {id, cat, title, steps, expected} ; fn -> {actual, verdict: PASS|FAIL|RECORD|SKIP, severity?, shots?, note?} */
export async function runCase(c, fn) {
  con.take();
  con.takeRequests();
  const t0 = Date.now();
  let r;
  try {
    r = await fn();
  } catch (e) {
    r = { verdict: 'ERROR', actual: `스크립트 오류: ${String(e && e.stack ? e.stack : e).slice(0, 700)}`, shots: [] };
  }
  const consoleItems = con.take();
  const ext = con
    .takeRequests()
    .filter((u) => !/^(data:|blob:|about:)/.test(u))
    .filter((u) => {
      try {
        const h = new URL(u).hostname;
        return !(h === '127.0.0.1' || h === 'localhost');
      } catch {
        return true;
      }
    });
  const rec = { ...c, ...r, console: consoleItems, externalRequests: ext, ms: Date.now() - t0, at: new Date().toISOString() };
  fs.appendFileSync(CASES, JSON.stringify(rec) + '\n');
  console.log(`[${r.verdict}] ${c.id} ${c.title} :: ${String(r.actual || '').slice(0, 300)}${consoleItems.length ? ` (console ${consoleItems.length})` : ''}${ext.length ? ` (외부요청 ${ext.length})` : ''}`);
  return rec;
}

// ---------- 화면 조작 ----------
export async function openTitle(page, base = PROD, query = '') {
  await page.goto(base + query, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
}

/** 입력 가드(약 0.4초)가 풀릴 때까지 */
export async function waitGuard(page, testid) {
  await page.waitForFunction(
    (t) => {
      const b = document.querySelector(`[data-testid="${t}"]`);
      return b !== null && b.getAttribute('aria-disabled') !== 'true' && !b.disabled;
    },
    testid,
    { timeout: 6000 },
  );
}

export const readRaw = (page, key = GAME_KEY) => page.evaluate((k) => localStorage.getItem(k), key);

export async function saveJson(page) {
  const raw = await readRaw(page);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { __raw: raw.slice(0, 80) };
  }
}

export async function overflowX(page) {
  return page.evaluate(() => {
    const r = document.documentElement;
    return { overflow: r.scrollWidth > r.clientWidth, scrollW: r.scrollWidth, clientW: r.clientWidth };
  });
}

export const SCREENS = ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'];
export async function whichScreen(page) {
  return page.evaluate((ids) => {
    for (const id of ids) if (document.querySelector(`[data-testid="${id}"]`)) return id;
    return document.body.innerText.trim() === '' ? 'BLANK' : 'unknown';
  }, SCREENS);
}

export async function bodyText(page) {
  return page.evaluate(() => document.body.innerText);
}

/** 첫 화면에서 세상 고르기(라디오 카드) */
export async function pickEra(page, era) {
  await waitGuard(page, 'start-birth');
  const radio = page.locator(`[data-testid="era-${era}"]`);
  await radio.click();
  await sleep(120);
}

/** 첫 화면에서 「태어나기」를 눌러 룰렛 화면까지 */
export async function toRoulette(page, era = 'present') {
  if (era !== 'present') await pickEra(page, era);
  await waitGuard(page, 'start-birth');
  await page.getByTestId('start-birth').click();
  await page.waitForSelector('[data-testid="roulette-screen"]', { timeout: 8000 });
}

/** 룰렛 상태 읽기 */
export async function readRoulette(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const tx = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
    const scr = q('[data-testid="roulette-screen"]');
    const odds = (id) =>
      [...document.querySelectorAll(`[data-testid="${id}"] tr`)].map((tr) => ({
        name: tr.querySelector('th')?.textContent.trim(),
        pct: parseFloat(tr.querySelector('td')?.textContent),
        raw: tr.querySelector('td')?.textContent.trim(),
      }));
    const resultItem = (id) => {
      const it = q(`[data-testid="${id}"] [data-result="true"]`);
      return it ? it.textContent.replace(/\s+/g, ' ').trim() : null;
    };
    return {
      state: scr ? scr.getAttribute('data-state') : null,
      heading: tx('[data-testid="roulette-heading"]'),
      status: tx('[data-testid="roulette-status"]'),
      motionNote: tx('[data-testid="motion-note"]'),
      wealthReel: q('[data-testid="reel-wealth"]')?.getAttribute('data-state') ?? null,
      regionReel: q('[data-testid="reel-region"]')?.getAttribute('data-state') ?? null,
      wealthResult: resultItem('reel-wealth'),
      regionResult: resultItem('reel-region'),
      wealthOdds: odds('odds-wealth'),
      regionOdds: odds('odds-region'),
      wealthNote: tx('[data-testid="odds-wealth-note"]'),
      regionNote: tx('[data-testid="odds-region-note"]'),
      foot: tx('[data-testid="page-foot"]'),
      btn: q('[data-testid="skip-roulette"]') ? 'skip' : q('[data-testid="to-birth"]') ? 'to-birth' : null,
      btnText: (q('[data-testid="skip-roulette"]') || q('[data-testid="to-birth"]'))?.textContent.trim() ?? null,
      btnDisabled: (q('[data-testid="skip-roulette"]') || q('[data-testid="to-birth"]'))?.getAttribute('aria-disabled') ?? null,
    };
  });
}

/** 출생신고 읽기 */
export async function readBirth(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const tx = (s) => (q(s) ? q(s).textContent.replace(/\s+/g, ' ').trim() : null);
    const fields = {};
    for (const f of document.querySelectorAll('[data-testid^="birth-field-"]')) {
      const id = f.getAttribute('data-testid').replace('birth-field-', '');
      fields[id] = { label: f.querySelector('dt')?.textContent.trim(), value: f.querySelector('dd')?.textContent.replace(/\s+/g, ' ').trim() };
    }
    return {
      name: tx('[data-testid="birth-name"]'),
      sentence: tx('[data-testid="birth-sentence"]'),
      heading: tx('[data-testid="birth-heading"]'),
      head: tx('header, .site-head') ?? null,
      fields,
      peers: [...document.querySelectorAll('[data-testid="peer"]')].map((p) => ({
        name: p.querySelector('[data-testid="peer-name"]')?.textContent.trim(),
        gender: p.querySelector('[data-testid="peer-gender"]')?.textContent.trim(),
        place: p.querySelector('[data-testid="peer-place"]')?.textContent.replace(/\s+/g, ' ').trim(),
        chip: p.textContent.replace(/\s+/g, ' ').trim(),
      })),
      peersNote: tx('[data-testid="peers-card"] .card__note'),
      compareShown: !!q('[data-testid="compare-card"]'),
      compareRows: [...document.querySelectorAll('[data-testid="compare-row"]')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()),
      compareHead: [...document.querySelectorAll('[data-testid="compare-table"] thead th')].map((h) => h.textContent.trim()),
      compareNote: tx('[data-testid="compare-note"]'),
      lifeGap: tx('[data-testid="life-gap"]'),
      lifeGapSource: tx('[data-testid="life-gap-source"]'),
      foot: [...document.querySelectorAll('[data-testid="page-foot"] p')].map((p) => p.textContent.replace(/\s+/g, ' ').trim()),
      logoPresent: !!q('.site-head svg, header svg, [data-testid="site-head"]'),
      bodyText: document.body.innerText,
    };
  });
}

/** 룰렛을 건너뛰고 출생신고까지(건너뛰기 → 가드 대기 → 출생신고 보기) */
export async function skipToBirth(page) {
  await waitGuard(page, 'skip-roulette').catch(() => {});
  const s = await readRoulette(page);
  if (s.btn === 'skip') await page.getByTestId('skip-roulette').click();
  await page.waitForSelector('[data-testid="to-birth"]', { timeout: 4000 });
  await waitGuard(page, 'to-birth');
  await page.getByTestId('to-birth').click();
  await page.waitForSelector('[data-testid="birth-screen"]', { timeout: 4000 });
}

export async function birthToLife(page) {
  await waitGuard(page, 'next-life');
  await page.getByTestId('next-life').click();
  await page.waitForSelector('[data-testid="life-screen"]', { timeout: 6000 });
}

/** 색 문자열 rgb(...) → [r,g,b] */
export function parseRgb(s) {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(s);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

// ---------- 게임 진행 도우미 ----------
export async function lifeInfo(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const txt = (s) => (q(s) ? q(s).textContent.trim() : null);
    return {
      screen: ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => q(`[data-testid="${id}"]`)) || 'unknown',
      name: txt('[data-testid="life-name"]') || txt('[data-testid="birth-name"]') || txt('[data-testid="ending-name"]'),
      age: q('[data-testid="life-age"] strong') ? parseInt(q('[data-testid="life-age"] strong').textContent, 10) : null,
      speed: q('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed') ?? null,
      auto: q('[data-testid="auto"]')?.getAttribute('aria-pressed') ?? null,
      hasChoice: !!q('[data-testid="choice-panel"]'),
    };
  });
}

/** 인생 화면에서 조건을 만족할 때까지 진행(선택지가 뜨면 첫 선택지를 고른다). */
export async function driveLife(page, until, timeoutMs = 240000) {
  const t0 = Date.now();
  for (;;) {
    const info = await lifeInfo(page);
    if (until(info)) return info;
    if (Date.now() - t0 > timeoutMs) throw new Error(`driveLife 시간 초과 ${JSON.stringify(info)}`);
    if (info.screen === 'life-screen' && info.hasChoice && info.auto !== 'true') {
      const btn = page.locator('[data-testid="choice-panel"] .choice-list button').first();
      try {
        await page.waitForFunction(() => {
          const b = document.querySelector('[data-testid="choice-panel"] .choice-list button');
          return b && b.getAttribute('aria-disabled') !== 'true';
        }, null, { timeout: 3000 });
        await btn.click({ timeout: 3000 });
      } catch {}
    }
    await sleep(120);
  }
}

export async function setSpeed(page, n) {
  await page.waitForFunction(() => document.querySelector('[data-speed="1"]')?.getAttribute('aria-disabled') !== 'true');
  await page.locator(`[data-speed="${n}"]`).click();
}

/** 글자 크기 N%를 루트에 적용 */
export async function setRootFont(page, pct) {
  await page.evaluate((p) => {
    let st = document.getElementById('__qa_font');
    if (!st) {
      st = document.createElement('style');
      st.id = '__qa_font';
      document.head.appendChild(st);
    }
    st.textContent = p === 100 ? '' : `html { font-size: ${p}% !important; }`;
  }, pct);
}

// ---------- 룰렛 관찰 탐침 (페이지 안에서 시각·칸 순서를 기록, 앱 코드는 건드리지 않는다) ----------
/**
 * 「태어나기」 클릭 시각(t0)을 잡고, 릴의 data-state 변화 시각과 두 릴 가운데 칸의 글자 순서를 rAF마다 기록한다.
 * window.__qa = { t0, events:[{t,id,state}], seq:{wealth:[{t,text}], region:[{t,text}]} }
 */
export async function installRouletteProbe(ctx) {
  await ctx.addInitScript(() => {
    window.__qa = { t0: null, events: [], seq: { wealth: [], region: [] }, frames: 0, maxGap: 0 };
    const A = window.__qa;
    document.addEventListener(
      'click',
      (e) => {
        const b = e.target && e.target.closest && e.target.closest('[data-testid="start-birth"]');
        if (b && A.t0 === null) A.t0 = performance.now();
      },
      true,
    );
    const centerText = (testid) => {
      const reel = document.querySelector(`[data-testid="${testid}"]`);
      if (!reel) return null;
      const win = reel.querySelector('.reel__window');
      const wr = (win || reel).getBoundingClientRect();
      const cy = wr.top + wr.height / 2;
      let best = null;
      let bd = 1e9;
      for (const it of reel.querySelectorAll('.reel__item')) {
        const r = it.getBoundingClientRect();
        const d = Math.abs(r.top + r.height / 2 - cy);
        if (d < bd) {
          bd = d;
          best = it;
        }
      }
      return best ? { text: best.textContent.replace(/\s+/g, ' ').trim(), off: bd } : null;
    };
    let lastFrame = 0;
    const loop = (now) => {
      if (A.t0 !== null) {
        A.frames++;
        if (lastFrame) A.maxGap = Math.max(A.maxGap, now - lastFrame);
        lastFrame = now;
        for (const [k, id] of [['wealth', 'reel-wealth'], ['region', 'reel-region']]) {
          const c = centerText(id);
          if (c && c.off < 30) {
            const arr = A.seq[k];
            if (!arr.length || arr[arr.length - 1].text !== c.text) arr.push({ t: Math.round(now - A.t0), text: c.text });
          }
        }
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        const el = m.target;
        if (!(el instanceof Element)) continue;
        const id = el.getAttribute('data-testid');
        if (m.type === 'attributes' && m.attributeName === 'data-state') {
          A.events.push({ t: Math.round(performance.now() - (A.t0 ?? performance.now())), id, state: el.getAttribute('data-state') });
        }
      }
    });
    const start = () => mo.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-state'] });
    if (document.documentElement) start();
    else document.addEventListener('DOMContentLoaded', start);
  });
}

export const getProbe = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__qa)));
