// QA 공용 라이브러리 (SPEC-001 M3 QA). 앱 코드는 건드리지 않고 브라우저로만 조작한다.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..', '..');
export const SHOT_DIR = path.join(ROOT, 'qa', 'screenshots', '001');
export const RES_DIR = path.join(ROOT, 'qa', 'results');
export const DEV = process.env.QA_DEV || 'http://localhost:5290';
export const PROD = process.env.QA_PROD || 'http://localhost:4290';
export const GAME_KEY = 'suzeo-game:save';
export const SETTINGS_KEY = 'suzeo-game:settings';

fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(RES_DIR, { recursive: true });

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch(opts = {}) {
  return chromium.launch({ headless: true, ...opts });
}

// ---------- 콘솔 수집 ----------
export class Con {
  constructor() {
    this.items = [];
  }
  attach(page, label = '') {
    page.on('console', (m) => {
      const t = m.type();
      if (t === 'error' || t === 'warning') this.items.push({ type: t, text: m.text().slice(0, 400), label });
    });
    page.on('pageerror', (e) => this.items.push({ type: 'pageerror', text: String(e && e.message ? e.message : e).slice(0, 400), label }));
    page.on('requestfailed', (r) => {
      const f = r.failure();
      this.items.push({ type: 'requestfailed', text: `${r.url().slice(0, 120)} ${f ? f.errorText : ''}`, label });
    });
  }
  take() {
    const a = this.items;
    this.items = [];
    return a;
  }
}
export const con = new Con();

/** 컨텍스트 생성 + 이후 열리는 모든 페이지에 콘솔 수집 부착 */
export async function mkctx(browser, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 740 }, locale: 'ko-KR', ...opts });
  ctx.on('page', (p) => con.attach(p, 'tab'));
  return ctx;
}

// ---------- 스크린샷 ----------
export async function shot(page, id, suffix = '', opts = {}) {
  const name = suffix ? `${id}-${suffix}.png` : `${id}.png`;
  const file = path.join(SHOT_DIR, name);
  await page.screenshot({ path: file, fullPage: !!opts.full });
  return `qa/screenshots/001/${name}`;
}

// ---------- 결과 기록 ----------
export function resultFile(group) {
  return path.join(RES_DIR, `${group}.jsonl`);
}

/** c: {id, cat, title, steps, expected, [flags]} ; fn -> {actual, verdict, shots?, note?} */
export async function runCase(group, c, fn) {
  con.take();
  const t0 = Date.now();
  let r;
  try {
    r = await fn();
  } catch (e) {
    r = { verdict: 'ERROR', actual: `스크립트 오류(제품 결함 아님일 수 있음): ${String(e && e.message ? e.message : e).slice(0, 500)}`, shots: [] };
  }
  const consoleItems = con.take();
  const rec = { ...c, ...r, console: consoleItems, ms: Date.now() - t0, at: new Date().toISOString() };
  fs.appendFileSync(resultFile(group), JSON.stringify(rec) + '\n');
  const tag = r.verdict === 'PASS' ? 'PASS' : r.verdict;
  console.log(`[${tag}] ${c.id} ${c.title} :: ${String(r.actual || '').slice(0, 200)}${consoleItems.length ? ` (console ${consoleItems.length})` : ''}`);
  return rec;
}

// ---------- 화면 조작 ----------
export const SCREEN_IDS = ['title-screen', 'era-screen', 'birth-screen', 'life-screen', 'ending-placeholder', 'superseded-screen', 'error-screen'];

/** 현재 화면 상태를 DOM에서 읽는다 */
export async function snap(page) {
  return page.evaluate(() => {
    const main = document.querySelector('main[data-testid]');
    const q = (s) => document.querySelector(s);
    const txt = (s) => (q(s) ? q(s).textContent.trim() : null);
    const root = document.documentElement;
    return {
      screen: main ? main.getAttribute('data-testid') : document.body.innerText.trim() === '' ? 'BLANK' : 'unknown',
      name: txt('[data-testid="life-name"]') || txt('[data-testid="birth-name"]'),
      age: txt('[data-testid="life-age"] strong'),
      stage: txt('[data-testid="life-stage"]'),
      speed: q('[data-speed][aria-pressed="true"]') ? q('[data-speed][aria-pressed="true"]').getAttribute('data-speed') : null,
      auto: q('[data-testid="auto"]') ? q('[data-testid="auto"]').getAttribute('aria-pressed') : null,
      hasChoice: !!q('[data-testid="choice-panel"]'),
      choiceTitle: txt('[data-testid="choice-title"]'),
      choiceKey: q('[data-testid="choice-panel"]') ? q('[data-testid="choice-panel"]').getAttribute('data-key') : null,
      notice: !!q('[data-testid="save-notice"]'),
      overflowX: root.scrollWidth > root.clientWidth,
      scrollW: root.scrollWidth,
      clientW: root.clientWidth,
      death: txt('[data-testid="ending-death"]'),
      bodyLen: document.body.innerText.length,
    };
  });
}

export async function waitScreen(page, id, timeout = 15000) {
  await page.waitForSelector(`main[data-testid="${id}"]`, { timeout });
}

export async function readRaw(page, key = GAME_KEY) {
  return page.evaluate((k) => localStorage.getItem(k), key);
}
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

/** 타이틀 → 시대 → 출생 → 인생 화면까지. era: past|present|future */
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

/** 설정(속도·자동)을 저장소에 직접 써 둔 뒤 페이지를 연다 */
export async function seedSettings(page, base, settings) {
  await page.goto(base + '/');
  await page.evaluate(([k, v]) => localStorage.setItem(k, v), [SETTINGS_KEY, JSON.stringify({ version: 1, data: settings })]);
}

/** 선택지 id 목록과 본문 길이 */
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

export function ymd() {
  return new Date().toISOString().slice(0, 10);
}
