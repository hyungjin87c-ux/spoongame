// QA 탐색용 공용 도구 (qa/scripts/009 — 저장소 루트에서 `node qa/scripts/009/<파일>`로 돌린다, QA_BASE=개발 서버 주소). 저장 주입 규칙은 e2e/saves.ts 와 같다.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const REPO = fileURLToPath(new URL('../../..', import.meta.url));
const require = createRequire(REPO + '/package.json');
export const { chromium, webkit } = require('@playwright/test');

export const GAME_KEY = 'suzeo-game:save';
export const SETTINGS_KEY = 'suzeo-game:settings';
export const SAVE_VERSION = 9;
export const SETTINGS_VERSION = 6;
export const BASE = process.env.QA_BASE ?? 'http://localhost:5301';

const STATS = { education: 6, health: 70, happiness: 52, relationships: 54 };
const FRESH = { flags: [], seen: {}, pending: null, lastChoiceAge: null, death: null };

export function settingsEnvelope(over = {}) {
  return JSON.stringify({
    version: SETTINGS_VERSION,
    data: { generation: 'random', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system', noteCards: false, speed: 1, autoMode: false, ...over },
  });
}

export function report(over = {}) {
  return { month: 1, region: '서울', mother: { age: 30, job: 'clerk' }, father: { age: 33, job: 'professional' }, housing: 'own', birthWeightKg: 3.2, birthOrder: 1, ...over };
}

export function birthState({ seed, generation, wealth, birthYear, region = '서울', looks = 50, phase = 'roulette', lifeLength = 'short30', reportOver = {} }) {
  return {
    phase,
    generation,
    lifeLength,
    character: { name: '김민준', gender: 'male', birthYear, parentWealth: wealth, parenting: 'free', looks },
    stats: { ...STATS },
    birthStats: { ...STATS },
    age: 0,
    history: [],
    ...FRESH,
    assets: null,
    familyFund: 0,
    birthReport: report({ region, ...reportOver }),
    peerSeed: 424242,
    paused: false,
    seed,
    rngState: seed + 1,
  };
}

export async function inject(page, state, settings, target = '/') {
  await page.goto(BASE + '/');
  await page.waitForFunction((k) => localStorage.getItem(k) !== null, GAME_KEY);
  await page.evaluate(
    ([k, v, sk, sv]) => {
      localStorage.setItem(k, v);
      if (sv !== null) localStorage.setItem(sk, sv);
    },
    [GAME_KEY, JSON.stringify({ version: SAVE_VERSION, data: state }), SETTINGS_KEY, settings ? settingsEnvelope(settings) : null],
  );
  // 앱이 떠나며 덮어쓰지 않게: 같은 탭의 storage 이벤트로 "밀린 화면"을 만든 뒤 이동 (e2e/helpers.ts#stopAppSaving)
  for (let i = 0; i < 3; i++) {
    await page.evaluate((key) => window.dispatchEvent(new StorageEvent('storage', { key })), GAME_KEY);
    try {
      await page.getByTestId('superseded-screen').waitFor({ state: 'attached', timeout: 1000 });
      break;
    } catch {}
  }
  await page.goto(BASE + target);
}

export async function toLife(page) {
  await page.locator('[data-testid="roulette-screen"], [data-testid="birth-screen"], [data-testid="life-screen"]').first().waitFor({ state: 'visible' });
  if (await page.getByTestId('roulette-screen').isVisible()) {
    const st = await page.getByTestId('roulette-screen').getAttribute('data-state');
    if (st === 'spinning' || st === 'draw') await page.getByTestId('skip-roulette').click();
    await page.waitForFunction(() => { const b = document.querySelector('[data-testid="to-birth"]'); return b && !b.disabled && b.getAttribute('aria-disabled') !== 'true'; });
    await page.getByTestId('to-birth').click();
  }
  if (await page.getByTestId('life-screen').isVisible().catch(() => false)) return;
  await page.getByTestId('next-life').waitFor({ state: 'visible' });
  await page.waitForFunction(() => { const b = document.querySelector('[data-testid="next-life"]'); return b && !b.disabled && b.getAttribute('aria-disabled') !== 'true'; });
  await page.getByTestId('next-life').click();
  await page.getByTestId('life-screen').waitFor({ state: 'visible' });
}

export async function readSave(page) {
  const raw = await page.evaluate((k) => localStorage.getItem(k), GAME_KEY);
  return raw === null ? null : JSON.parse(raw);
}

/** 장면 카드의 현재 모습을 한 줄로 */
export async function sceneNow(page) {
  return page.evaluate(() => {
    const yr = document.querySelector('.scene__year time')?.textContent ?? '';
    const era = document.querySelector('#scene-era');
    const house = [...document.querySelectorAll('[data-testid="scene-house"] [data-layer="집"] [data-piece]')].map((e) => e.getAttribute('data-piece'));
    const bg = [...document.querySelectorAll('[data-testid="scene-house"] [data-layer="배경"] [data-piece]')].map((e) => e.getAttribute('data-piece'));
    const age = document.querySelector('[data-testid="life-age"]')?.textContent?.trim() ?? '';
    return {
      age,
      yr,
      era: era?.getAttribute('data-era') ?? null,
      kind: era?.getAttribute('data-kind') ?? null,
      dec: era?.getAttribute('data-dec') ?? null,
      empty: era?.getAttribute('data-empty') ?? null,
      hidden: era?.getAttribute('data-hidden') ?? null,
      eraName: era?.getAttribute('aria-label') ?? '',
      house,
      bg,
      art: document.querySelector('[data-testid="family-scene"]')?.getAttribute('data-scene-art') ?? null,
    };
  });
}

/** 멈춘 인생 중간 판(주입용): 나이마다 기록 줄 perAge개. e2e/family-scene.spec.ts#era1980 과 같은 모양 */
export function lifeAt({ seed = 20261013, generation = 'alpha', birthYear = 2016, age = 0, wealth = 3, region = '서울', perAge = 1, paused = true }) {
  const base = birthState({ seed, generation, wealth, birthYear, region, phase: 'life' });
  const history = [{ age: 0, kind: 'stage', text: `${birthYear}년 1월, ${region === '서울' ? '서울특별시' : region}의 평범한 가정에서 3.2kg 남자아이로 태어났습니다. 첫째입니다.` }];
  for (let a = 0; a <= age; a++) for (let j = 0; j < perAge; j++) if (!(a === 0 && j === 0)) history.push({ age: a, kind: 'event', text: `${a}세 ${j}번째 일입니다.`, eventId: `e${a}-${j}` });
  return { ...base, age, paused, history, stats: { education: 6, health: 70, happiness: 52, relationships: 54 } };
}
