// SPEC-005 최종 QA(2026-10-26) 공용 라이브러리. 앱 코드(src·tests·e2e)는 건드리지 않고 브라우저로만 조작한다.
// 결과: qa/results/005/cases.jsonl(원자료, 케이스 한 줄씩), 스크린샷: qa/screenshots/005/<케이스ID>.png (FAIL·RECORD만 촬영)
import { chromium, webkit } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const RES = path.join(ROOT, 'qa', 'results', '005');
export const SHOT_DIR = path.join(ROOT, 'qa', 'screenshots', '005');
export const DEV = process.env.QA_DEV || 'http://127.0.0.1:5391';
export const PROD = process.env.QA_PROD || 'http://127.0.0.1:4391';
export const GAME_KEY = 'suzeo-game:save';
export const SETTINGS_KEY = 'suzeo-game:settings';
export const SAVE_VERSION = 8;
export const SETTINGS_VERSION = 5;
fs.mkdirSync(RES, { recursive: true });
fs.mkdirSync(SHOT_DIR, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const launchChromium = (o = {}) => chromium.launch({ headless: true, ...o });
export const launchWebkit = (o = {}) => webkit.launch({ headless: true, ...o });

// ---------- 뷰포트 ----------
export const VP = {
  d1280: { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 },
  d1920: { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
  m360: { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
  m320: { viewport: { width: 320, height: 640 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 },
};

// ---------- 감시(콘솔·예외·외부 요청) ----------
export class Watch {
  constructor(label = '') {
    this.label = label;
    this.items = [];
    this.external = [];
  }
  attach(ctx) {
    const local = (u) => /^(http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/|data:|blob:|about:)/.test(u);
    ctx.on('request', (r) => {
      const u = r.url();
      if (!local(u)) this.external.push(u.slice(0, 120));
    });
    const hook = (p) => {
      p.on('console', (m) => {
        const t = m.type();
        if (t === 'error' || t === 'warning') this.items.push({ type: t, text: m.text().slice(0, 240) });
      });
      p.on('pageerror', (e) => this.items.push({ type: 'pageerror', text: String(e && e.message ? e.message : e).slice(0, 240) }));
      p.on('requestfailed', (r) => {
        const f = r.failure();
        this.items.push({ type: 'requestfailed', text: `${r.url().slice(0, 100)} ${f ? f.errorText : ''}` });
      });
      p.on('dialog', (d) => {
        this.items.push({ type: 'dialog', text: `${d.type()}: ${d.message().slice(0, 100)}` });
        d.dismiss().catch(() => {});
      });
    };
    ctx.pages().forEach(hook);
    ctx.on('page', hook);
    return this;
  }
  take() {
    const o = { console: this.items, external: this.external };
    this.items = [];
    this.external = [];
    return o;
  }
}

// ---------- 결과 기록 ----------
export const CASES = path.join(RES, 'cases.jsonl');
/** c: {id, area, title, steps, expected} + r: {actual, verdict: PASS|FAIL|RECORD|SKIP, shot?, evidence?} */
export function record(c, r) {
  const rec = { ...c, ...r, at: new Date().toISOString() };
  fs.appendFileSync(CASES, JSON.stringify(rec) + '\n');
  const mark = r.verdict === 'PASS' ? 'PASS  ' : r.verdict === 'FAIL' ? 'FAIL !!' : r.verdict;
  console.log(`[${mark}] ${c.id} ${c.title} :: ${String(r.actual ?? '').slice(0, 200)}`);
  return rec;
}
/** 케이스 실행: fn → {verdict, actual, shot?} ; 예외는 FAIL(스크립트 오류)가 아니라 ERROR로 남겨 재시험 대상으로 표시 */
export async function run(c, fn) {
  let r;
  try {
    r = await fn();
  } catch (e) {
    r = { verdict: 'ERROR', actual: `스크립트 오류: ${String(e && e.message ? e.message : e).slice(0, 300)}` };
  }
  return record(c, r);
}
export const ok = (actual, extra = {}) => ({ verdict: 'PASS', actual, ...extra });
export const bad = (actual, extra = {}) => ({ verdict: 'FAIL', actual, ...extra });
export const note = (actual, extra = {}) => ({ verdict: 'RECORD', actual, ...extra });
export const check = (cond, actualOk, actualBad, extra = {}) => (cond ? ok(actualOk, extra) : bad(actualBad, extra));

// ---------- 스크린샷 (FAIL·RECORD만) ----------
export async function shot(page, id, opts = {}) {
  const file = path.join(SHOT_DIR, `${id}.png`);
  const o = { path: file, fullPage: !!opts.full };
  if (opts.clip) o.clip = opts.clip;
  if (opts.locator) await opts.locator.screenshot({ path: file });
  else await page.screenshot(o);
  return `qa/screenshots/005/${id}.png`;
}

/** 미리 찍어 둔 버퍼를 FAIL·RECORD일 때만 파일로 남긴다 */
export function saveShot(buf, id) {
  fs.writeFileSync(path.join(SHOT_DIR, `${id}.png`), buf);
  return `qa/screenshots/005/${id}.png`;
}

// ---------- 페이지 도우미 ----------
/** 저장·설정을 첫 로드 전에 심는다. 같은 탭에서는 한 번만(새로고침해도 다시 심지 않는다 — sessionStorage 표식). 새 상태는 새 페이지(컨텍스트)에서. */
export async function seedPage(page, { game = null, settings = null, clear = false } = {}) {
  const token = `qa-${Math.random().toString(36).slice(2)}`;
  const payload = {
    token,
    game: game ? JSON.stringify({ version: SAVE_VERSION, data: game }) : null,
    settings: settings ? JSON.stringify({ version: SETTINGS_VERSION, data: settings }) : null,
    clear,
    gk: GAME_KEY,
    sk: SETTINGS_KEY,
  };
  await page.addInitScript((p) => {
    try {
      if (sessionStorage.getItem('qa-seeded') === p.token) return;
      sessionStorage.setItem('qa-seeded', p.token);
      if (p.clear) {
        localStorage.removeItem(p.gk);
        localStorage.removeItem(p.sk);
      }
      if (p.game !== null) localStorage.setItem(p.gk, p.game);
      if (p.settings !== null) localStorage.setItem(p.sk, p.settings);
    } catch {
      /* 저장소 불가 */
    }
  }, payload);
}

export const DEFAULT_SETTINGS = { era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system', noteCards: false, speed: 1, autoMode: false, gentle: false, notesSeen: '' };

/** 개발 서버의 실제 core 모듈로 상태를 만든다(오라클). 페이지는 DEV 주소에 열려 있어야 한다. body는 async 함수 본문: core·arg 사용, return. */
export async function oracle(page, body, arg = null) {
  return page.evaluate(
    `(async () => {
      const core = await import('/src/core/index.ts');
      const arg = ${JSON.stringify(arg)};
      return await (async () => { ${body} })();
    })()`,
  );
}
/** play 기록을 뺀다(앱 타이머가 실제 시간을 쌓으므로) 또는 0으로 붙인다 */
export function withoutPlay(s) {
  const { play: _p, ...rest } = s;
  return rest;
}
export function withPlay(s) {
  return { ...s, play: { hold: 0, decide: 0, fold: 0, note: 0, idle: 0, offSpeed: 0, auto: 0, skips: 0, resumes: 0 } };
}

export async function readSave(page) {
  const raw = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { __corrupt: true };
  }
}
export async function readSettings(page) {
  const raw = await page.evaluate((k) => localStorage.getItem(k), SETTINGS_KEY);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { __corrupt: true };
  }
}

export const screenOf = (page) =>
  page.evaluate(() => {
    const t = ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => document.querySelector(`[data-testid="${id}"]`));
    return t ?? (document.body.innerText.trim() === '' ? 'BLANK' : 'unknown');
  });

/** 입력 가드가 풀려 눌러도 되는가(aria-disabled 아님)를 기다린 뒤 누른다 */
export async function press(page, testId, opts = {}) {
  const loc = page.getByTestId(testId);
  await loc.waitFor({ state: 'visible', timeout: opts.timeout ?? 20000 });
  await page.waitForFunction((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`);
    return el && el.getAttribute('aria-disabled') !== 'true' && !el.disabled;
  }, testId, { timeout: opts.timeout ?? 20000 });
  await loc.click(opts.click ?? {});
}

/** 첫 화면에서 「태어나기」 → 룰렛 건너뛰기 → 출생신고 → 살아가기. era: past|present|future (이미 골라져 있으면 생략) */
export async function startLife(page, { era = null, skipRoulette = true } = {}) {
  await page.getByTestId('title-screen').waitFor({ timeout: 60000 });
  if (era) {
    const radio = page.getByTestId(`era-${era}`);
    await radio.scrollIntoViewIfNeeded();
    await radio.check();
  }
  await press(page, 'start-birth');
  await page.getByTestId('roulette-screen').waitFor({ timeout: 20000 });
  if (skipRoulette) {
    if ((await page.getByTestId('roulette-screen').getAttribute('data-state')) === 'spinning') await press(page, 'skip-roulette');
    await page.waitForFunction(() => document.querySelector('[data-testid="roulette-screen"]')?.getAttribute('data-state') === 'result', null, { timeout: 20000 });
  }
  await press(page, 'to-birth');
  await page.getByTestId('birth-screen').waitFor({ timeout: 20000 });
  await press(page, 'next-life');
  await page.getByTestId('life-screen').waitFor({ timeout: 20000 });
}

/** 인생 화면의 지금 상태 */
export const lifeSnap = (page) =>
  page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const t = (s) => q(s)?.textContent?.trim() ?? null;
    return {
      screen: q('[data-testid="life-screen"]') ? 'life' : q('[data-testid="ending-screen"]') ? 'ending' : q('[data-testid="title-screen"]') ? 'title' : 'other',
      age: Number((t('[data-testid="life-age"]') ?? '').replace(/[^\d]/g, '')) || 0,
      speed: q('[data-speed][aria-pressed="true"]')?.getAttribute('data-speed') ?? null,
      auto: q('[data-testid="auto"]')?.getAttribute('aria-pressed') ?? null,
      paused: q('[data-testid="pause"]')?.getAttribute('data-paused') ?? null,
      pauseText: t('[data-testid="pause"]'),
      choice: q('[data-testid="choice-panel"]') ? q('[data-testid="choice-panel"]').getAttribute('data-key') : null,
      parentCard: q('[data-testid="parent-card"]') ? q('[data-testid="parent-card"]').getAttribute('data-key') + '|' + q('[data-testid="parent-card"]').getAttribute('data-by') : null,
      noteOpen: !!q('[data-testid="note-sheet"]'),
      pct: t('[data-testid="year-pct"]'),
    };
  });

/** 가로 넘침·가장자리 밖 요소 */
export const overflowOf = (page) =>
  page.evaluate(() => {
    const root = document.documentElement;
    const vw = root.clientWidth;
    const offenders = [];
    for (const el of document.querySelectorAll('body *')) {
      if (el.closest('.sprite, .sr-only, [aria-hidden="true"] defs, svg defs')) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.position === 'fixed' && false) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 0.5 || r.left < -0.5) {
        if (el.closest('[hidden], [inert]') && false) continue;
        const c = typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : '';
        offenders.push(`${el.tagName}${c ? '.' + c : ''}${el.dataset.testid ? '#' + el.dataset.testid : ''}:${Math.round(r.left)}..${Math.round(r.right)}`);
      }
    }
    return { scrollW: root.scrollWidth, clientW: vw, over: root.scrollWidth - vw, offenders: offenders.slice(0, 8) };
  });

/** 인생 기록 줄의 나이 순서(위→아래) */
export const logAges = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="log-row"]')].map((li) => {
      const m = /^\s*(\d+)\s*세/.exec(li.innerText ?? '');
      return m ? Number(m[1]) : -1;
    }),
  );
export const nonIncreasing = (a) => a.every((v, i) => i === 0 || a[i - 1] >= v);

/** 하단·상단 고정 요소가 포커스된 요소를 가리는가(포커스된 요소 중심점의 최상위 요소가 그 요소(또는 안쪽)인가) */
export const focusHidden = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const r = a.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return null;
    const cx = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1);
    const cy = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1);
    const top = document.elementFromPoint(cx, cy);
    const visible = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    const covered = top !== null && !(a === top || a.contains(top) || top.contains(a));
    return { covered: visible && covered, by: covered && top ? `${top.tagName}.${(top.className || '').toString().split(' ')[0]}` : null, tag: `${a.tagName}${a.dataset.testid ? '#' + a.dataset.testid : ''}` };
  });

export function nowIso() {
  return new Date().toISOString();
}
export function summarize(arr) {
  const c = {};
  for (const r of arr) c[r.verdict] = (c[r.verdict] ?? 0) + 1;
  return c;
}

// ---------- 인-페이지 관찰기(부모 카드·결정 카드·기록 줄 순서·넘침) — page.addInitScript(QA_OBSERVER) 로 설치, window.__qa 에 쌓인다 ----------
export const QA_OBSERVER = () => {
  const w = window;
  w.__qa = { cards: [], picks: [], audits: [], notes: [], lastAge: -1, lastPc: null, lastCh: null };
  const t0 = performance.now();
  const ageNow = () => Number((document.querySelector('[data-testid="life-age"]')?.textContent ?? '').replace(/[^\d]/g, '')) || 0;
  const scan = () => {
    const q = w.__qa;
    const pc = document.querySelector('[data-testid="parent-card"]');
    const key = pc ? pc.getAttribute('data-key') : null;
    if (pc && key !== q.lastPc) {
      const a = document.activeElement;
      q.cards.push({
        t: Math.round(performance.now() - t0),
        key,
        by: pc.getAttribute('data-by'),
        age: ageNow(),
        chip: pc.querySelector('[data-testid="parent-chip"]')?.innerText ?? null,
        stamp: pc.querySelector('[data-testid="parent-stamp"]')?.innerText ?? null,
        label: pc.querySelector('[data-testid="parent-label"]')?.innerText ?? null,
        title: pc.querySelector('[data-testid="parent-title"]')?.innerText ?? null,
        hint: !!pc.querySelector('[data-testid="parent-hint"]'),
        buttons: pc.querySelectorAll('button').length,
        impact: pc.querySelector('.impact, [data-testid="impact"]')?.innerText?.slice(0, 120) ?? null,
        modal: !!pc.closest('[role="dialog"]'),
        focusIn: !!(a && pc.contains(a)),
        focusTag: a ? `${a.tagName}${a.dataset?.testid ? '#' + a.dataset.testid : ''}` : null,
        aboveLog: (() => { const l = document.querySelector('[data-testid="log"]'); return l ? pc.getBoundingClientRect().bottom <= l.getBoundingClientRect().top + 1 : null; })(),
      });
    }
    q.lastPc = key;
    const ch = document.querySelector('[data-testid="choice-panel"]');
    const ck = ch ? ch.getAttribute('data-key') : null;
    if (ch && ck !== q.lastCh) {
      q.picks.push({ t: Math.round(performance.now() - t0), key: ck, age: ageNow(), mode: ch.getAttribute('data-mode'), title: ch.querySelector('[data-testid="choice-title"]')?.innerText ?? '', n: ch.querySelectorAll('.choices-list button.choice').length });
    }
    q.lastCh = ck;
    const age = ageNow();
    if (age !== q.lastAge && document.querySelector('[data-testid="life-screen"]')) {
      q.lastAge = age;
      const rows = [...document.querySelectorAll('[data-testid="log-row"]')].map((li) => {
        const m = /^\s*(\d+)\s*세/.exec(li.innerText ?? '');
        return m ? Number(m[1]) : -1;
      });
      const inc = rows.every((v, i) => i === 0 || rows[i - 1] >= v);
      const root = document.documentElement;
      q.audits.push({ age, rows: rows.length, ordered: inc, first: rows[0], over: root.scrollWidth - root.clientWidth, topPx: document.querySelector('[data-testid="log-list"]')?.scrollTop ?? null });
    }
  };
  const start = () => {
    new MutationObserver(scan).observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true });
    scan();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
};
