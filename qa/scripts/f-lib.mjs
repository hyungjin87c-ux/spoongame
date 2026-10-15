// 최종 QA(M6) 공용 라이브러리. 앱 코드는 건드리지 않고 브라우저로만 조작한다. 결과는 qa/results/final/, 스크린샷은 qa/screenshots/001/F-*.png
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const SHOT_DIR = path.join(ROOT, 'qa', 'screenshots', '001');
export const FIN = path.join(ROOT, 'qa', 'results', 'final');
export const DEV = process.env.QA_DEV || 'http://127.0.0.1:5290';
export const PROD = process.env.QA_PROD || 'http://127.0.0.1:4290';
export const GAME_KEY = 'suzeo-game:save';
export const SETTINGS_KEY = 'suzeo-game:settings';
export const FAST = '?__timescale=1000&__guard=0'; // 개발 전용 탐침: 내용·통계 확인용 (시간 실측에는 쓰지 않는다)

fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(FIN, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const launch = (opts = {}) => chromium.launch({ headless: true, ...opts });

// ---------- 콘솔 수집 ----------
export class Con {
  constructor() {
    this.items = [];
  }
  attach(page, label = '') {
    page.on('console', (m) => {
      const t = m.type();
      if (t === 'error' || t === 'warning') this.items.push({ type: t, text: m.text().slice(0, 300), label });
    });
    page.on('pageerror', (e) => this.items.push({ type: 'pageerror', text: String(e && e.message ? e.message : e).slice(0, 300), label }));
    page.on('requestfailed', (r) => {
      const f = r.failure();
      this.items.push({ type: 'requestfailed', text: `${r.url().slice(0, 100)} ${f ? f.errorText : ''}`, label });
    });
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
}
export const con = new Con();

export async function mkctx(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'ko-KR', ...opts });
  ctx.on('page', (p) => con.attach(p, 'tab'));
  return ctx;
}
export const MOBILE = { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 };
export const DESKTOP = { viewport: { width: 1280, height: 800 } };

// ---------- 스크린샷 ----------
export async function shot(page, id, suffix = '', opts = {}) {
  const tag = process.env.QA_TAG || '';
  const name = suffix ? `${tag}${id}-${suffix}.png` : `${tag}${id}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: !!opts.full });
  return `qa/screenshots/001/${name}`;
}

// ---------- 결과 기록 ----------
export const CASES = path.join(FIN, 'cases.jsonl');
/** c: {id, cat, title, steps, expected, [ts]} ; fn -> {actual, verdict: PASS|FAIL|RECORD|JUDGE|SKIP, shots?, note?} */
export async function runCase(c, fn) {
  con.take();
  const t0 = Date.now();
  let r;
  // 시스템 절전·시계 점프 감시: 1초마다 찍는 시각 간격이 벌어지면 기록
  let last = Date.now();
  let maxGap = 0;
  const hb = setInterval(() => {
    const n = Date.now();
    maxGap = Math.max(maxGap, n - last);
    last = n;
  }, 1000);
  try {
    r = await fn();
  } catch (e) {
    r = { verdict: 'ERROR', actual: `스크립트 오류: ${String(e && e.message ? e.message : e).slice(0, 400)}`, shots: [] };
  }
  clearInterval(hb);
  const consoleItems = con.take();
  const rec = { ...c, ...r, id: c.id + (process.env.QA_IDSUFFIX || ''), console: consoleItems, ms: Date.now() - t0, maxGapMs: maxGap, at: new Date().toISOString() };
  fs.appendFileSync(CASES, JSON.stringify(rec) + '\n');
  console.log(`[${r.verdict}] ${c.id} ${c.title} :: ${String(r.actual || '').slice(0, 220)}${consoleItems.length ? ` (console ${consoleItems.length})` : ''}${maxGap > 5000 ? ` !!gap ${maxGap}ms` : ''}`);
  return rec;
}

// ---------- 화면 조작 ----------
export async function snap(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main[data-testid]');
    const q = (s) => document.querySelector(s);
    const txt = (s) => (q(s) ? q(s).textContent.trim() : null);
    const root = document.documentElement;
    return {
      screen: main ? main.getAttribute('data-testid') : document.body.innerText.trim() === '' ? 'BLANK' : 'unknown',
      name: txt('[data-testid="life-name"]') || txt('[data-testid="birth-name"]') || txt('[data-testid="ending-name"]'),
      age: txt('[data-testid="life-age"] strong'),
      speed: q('[data-speed][aria-pressed="true"]') ? q('[data-speed][aria-pressed="true"]').getAttribute('data-speed') : null,
      auto: q('[data-testid="auto"]') ? q('[data-testid="auto"]').getAttribute('aria-pressed') : null,
      hasChoice: !!q('[data-testid="choice-panel"]'),
      choiceKey: q('[data-testid="choice-panel"]') ? q('[data-testid="choice-panel"]').getAttribute('data-key') : null,
      stage: txt('[data-testid="life-stage"]'),
      death: txt('[data-testid="ending-death"]'),
      bodyLen: document.body.innerText.length,
      choiceTitle: txt('[data-testid="choice-title"]'),
      notice: !!q('[data-testid="save-notice"]'),
      overflowX: root.scrollWidth > root.clientWidth,
      scrollW: root.scrollWidth,
      clientW: root.clientWidth,
    };
  });
}
export const waitScreen = (page, id, timeout = 15000) => page.waitForSelector(`main[data-testid="${id}"]`, { timeout });
export const readRaw = (page, key = GAME_KEY) => page.evaluate((k) => localStorage.getItem(k), key);
export async function readSave(page) {
  const raw = await readRaw(page);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { __corrupt: true, raw: raw.slice(0, 80) };
  }
}
export async function readSettings(page) {
  const raw = await readRaw(page, SETTINGS_KEY);
  try {
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return { __corrupt: true };
  }
}

/** 설정(속도·자동)을 저장소에 직접 써 둔 뒤 연다. base는 쿼리 없는 주소. */
export async function seedSettings(page, base, settings) {
  await page.goto(base + '/');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SETTINGS_KEY, JSON.stringify({ version: 1, data: settings })]);
}

/** 타이틀 → 시대 → 출생 → (인생 화면). era: past|present|future. 사람처럼 화면 버튼을 누른다. */
export async function toBirth(page, era = 'present') {
  await waitScreen(page, 'title-screen');
  await page.getByRole('button', { name: '시작' }).click();
  await waitScreen(page, 'era-screen');
  if (era !== 'present') await page.locator(`[data-era="${era}"]`).click();
  await page.getByTestId('confirm-era').click();
  await waitScreen(page, 'birth-screen');
}
export async function toLife(page, era = 'present') {
  await toBirth(page, era);
  await page.getByTestId('next-life').click();
  await waitScreen(page, 'life-screen');
}

export async function readChoice(page) {
  return page.evaluate(() => {
    const p = document.querySelector('[data-testid="choice-panel"]');
    if (!p) return null;
    return {
      key: p.getAttribute('data-key'),
      title: document.querySelector('[data-testid="choice-title"]').textContent.trim(),
      text: document.querySelector('[data-testid="choice-text"]').textContent.trim(),
      choices: [...p.querySelectorAll('.choice-list button')].map((b) => ({ id: b.getAttribute('data-testid'), label: b.textContent.trim() })),
    };
  });
}

// ---------- 저장 주입 ----------
export const SCHEMA_VERSION = 4;
const BIRTH_YEAR = { past: 1975, present: 2015, future: 2045 };
export function mkState(o = {}) {
  const era = o.era || 'present';
  const age = o.age ?? 0;
  const stats = { wealth: 50, education: 40, health: 70, happiness: 55, relationships: 55, ...(o.stats || {}) };
  const birthStats = { wealth: 50, education: 5, health: 80, happiness: 55, relationships: 55, ...(o.birthStats || {}) };
  const history = o.history ?? [{ age: 0, kind: 'stage', text: `${o.birthYear ?? BIRTH_YEAR[era]}년, ${(o.gender || 'male') === 'male' ? '남자아이' : '여자아이'}로 태어났다.` }];
  return {
    phase: o.phase || 'life',
    era,
    character: { name: o.name ?? '김민준', gender: o.gender || 'male', birthYear: o.birthYear ?? BIRTH_YEAR[era], parentWealth: o.pw ?? 3, parenting: o.parenting || 'free', looks: o.looks ?? 50 },
    stats,
    birthStats,
    age,
    history,
    flags: o.flags || [],
    seen: o.seen || {},
    pending: o.pending ?? null,
    lastChoiceAge: o.lastChoiceAge ?? null,
    death: o.death ?? null,
    seed: o.seed ?? 12345,
    rngState: o.rngState ?? 12345,
  };
}
export const envelope = (state, version = SCHEMA_VERSION) => JSON.stringify({ version, data: state });
/** 저장을 쓰고 (필요하면 설정도) 새로 연다. url은 쿼리 포함 가능 */
export async function inject(page, base, state, { settings, query = '', raw } = {}) {
  await page.goto(base + '/' + query);
  await page.evaluate(
    ([g, gv, s, sv]) => {
      localStorage.setItem(g, gv);
      if (sv !== null) localStorage.setItem(s, sv);
    },
    [GAME_KEY, raw ?? envelope(state), SETTINGS_KEY, settings ? JSON.stringify({ version: 1, data: settings }) : null],
  );
  await page.goto(base + '/' + query);
}
/** 선택지 대기 상태를 만든다: 이벤트 id·나이·선택지 id 목록 */
export function pendingOf(eventId, age, choiceIds) {
  return { eventId, key: `${eventId}@${age}`, age, choiceIds };
}

// ---------- 인페이지 자동 진행 ----------
/**
 * 인생 화면에서 선택지를 규칙대로 고르며 끝(엔딩)까지(또는 stopAt 이벤트가 뜰 때까지) 진행한다. 브라우저 안에서 돌아 빠르다.
 * o: {rules:{eventId: choiceId}, seed, stopAt:[eventId], passed:[key], skip, maxMs, maxChoices, strategy:'random'|'first'|'last'}
 * 반환: {done:'ending'|'stop'|'superseded-screen'|'error-screen'|'timeout', log:[{key,ev,age,title,text,labels,ids,pick}], at}
 */
export async function drive(page, o = {}) {
  return page.evaluate(async (o) => {
    const rnd = (() => {
      let a = (o.seed ?? 1) >>> 0;
      return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    })();
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const log = [];
    const t0 = performance.now();
    let lastKey = null;
    let lastKeyAt = 0;
    while (performance.now() - t0 < (o.maxMs ?? 120000)) {
      const main = document.querySelector('main[data-testid]');
      const id = main ? main.dataset.testid : 'none';
      if (id === 'ending-screen') return { done: 'ending', log };
      if (id === 'superseded-screen' || id === 'error-screen') return { done: id, log };
      if (id !== 'life-screen') {
        await sleep(5);
        continue;
      }
      const panel = document.querySelector('[data-testid="choice-panel"]');
      if (!panel) {
        if (o.skip) {
          const sk = document.querySelector('[data-testid="skip"]');
          if (sk && sk.getAttribute('aria-disabled') !== 'true') sk.click();
        }
        await sleep(2);
        continue;
      }
      const key = panel.dataset.key;
      const ev = key.split('@')[0];
      if (key === lastKey) {
        if (performance.now() - lastKeyAt > 3000) return { done: 'stuck', at: key, log };
        await sleep(3);
        continue;
      }
      if (o.stopAt && o.stopAt.includes(ev) && !(o.passed || []).includes(key)) return { done: 'stop', at: key, log };
      const btns = [...panel.querySelectorAll('.choice-list button')];
      const ids = btns.map((b) => b.dataset.testid.replace(/^choice-/, ''));
      let idx = -1;
      const rule = o.rules && o.rules[ev];
      if (rule !== undefined && ids.includes(rule)) idx = ids.indexOf(rule);
      else if (o.strategy === 'first') idx = 0;
      else if (o.strategy === 'last') idx = ids.length - 1;
      else idx = Math.floor(rnd() * ids.length);
      const btn = btns[idx];
      if (btn.getAttribute('aria-disabled') === 'true') {
        await sleep(20);
        continue;
      }
      log.push({
        key,
        ev,
        age: Number(key.split('@')[1]),
        title: panel.querySelector('[data-testid="choice-title"]').textContent.trim(),
        text: panel.querySelector('[data-testid="choice-text"]').textContent.trim(),
        labels: btns.map((b) => b.textContent.trim()),
        ids,
        pick: ids[idx],
      });
      btn.click();
      lastKey = key;
      lastKeyAt = performance.now();
      if (o.maxChoices && log.length >= o.maxChoices) return { done: 'maxChoices', log };
      await sleep(1);
    }
    return { done: 'timeout', log };
  }, o);
}
