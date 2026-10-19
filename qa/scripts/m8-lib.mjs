// QA-003 M8 공용: 환경(m8-env) 설정 뒤 M7c 공용 라이브러리를 다시 내보내고, M8 전용 도우미(시간 기록 심기·측정 관찰기·모델)를 더한다.
import './m8-env.mjs';
import fs from 'node:fs';
import path from 'node:path';
export * from './m7c-lib.mjs';
import { OUT, ROOT, GAME_KEY, SETTINGS_KEY, SAVE_VERSION, SETTINGS_VERSION, mkctx, TOUCH, sleep } from './m7c-lib.mjs';

export const SCR = process.env.QA_SCRATCH || '';

/** 모델 상수 (src/data/timingTable.ts — 30분 모드 계수 K(기본 1.2, 환경변수 M8_K로 바꾼다: 1.25), 줄 대기 5000ms × K, 1시간 모드 2.0). 독립 계산: HOLD_MS(7000·17000·13000 — 표 값은 계수와 무관) × K를 반올림 */
const K30 = Number(process.env.M8_K || 1.2);
export const MODEL = {
  short30: { k: K30, quiet: Math.round(7000 * K30), narrative: Math.round(17000 * K30), resolved: Math.round(13000 * K30), line: Math.round(5000 * K30), autoChoice: 3000 },
  long60: { k: 2.0, quiet: 14000, narrative: 34000, resolved: 26000, line: 10000, autoChoice: 3000 },
};
export const holdModel = (mode, kind, lines = 1) => {
  const m = MODEL[mode];
  const base = kind === 'quiet' ? m.quiet : kind === 'narrative' ? m.narrative : m.resolved;
  return kind === 'quiet' ? base : base + Math.max(0, lines - 1) * m.line;
};
/** 허용 오차 (content-M8 8-4 Q1): 하한 -2%, 상한 +3% + 0.25초 (타이머는 일찍 울리지 않는다) */
export const tol = (model) => ({ lo: model * 0.98, hi: model * 1.03 + 250 });

/**
 * 페이지 안 관찰기: 나이 숫자가 바뀐 시각·결정 카드가 뜨고 사라진 시각·엔딩 도착 시각을 performance.now()로 기록한다(MutationObserver — DOM이 바뀐 직후 마이크로태스크).
 * 타이머 지연(setInterval 50ms의 늦음)도 재서 환경의 흔들림을 함께 남긴다.
 */
export const OBSERVER_INIT = () => {
  const ev = (window.__ev = []);
  const lat = (window.__lat = { n: 0, sum: 0, max: 0, over50: 0, over100: 0 });
  let lastAge = null;
  let lastCard = false;
  let ended = false;
  const T = () => performance.now();
  const read = () => {
    const b = document.querySelector('[data-testid="life-age"] b');
    const age = b ? parseInt(b.textContent, 10) : null;
    if (age !== null && age !== lastAge) {
      ev.push({ t: T(), k: 'age', age });
      lastAge = age;
    }
    const card = !!document.querySelector('[data-testid="choice-panel"]');
    if (card !== lastCard) {
      ev.push({ t: T(), k: card ? 'card' : 'cardGone' });
      lastCard = card;
    }
    if (!ended && document.querySelector('[data-testid="ending-screen"]')) {
      ended = true;
      ev.push({ t: T(), k: 'ending' });
    }
  };
  const start = () => {
    new MutationObserver(read).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    read();
  };
  if (document.documentElement) start();
  else document.addEventListener('DOMContentLoaded', start);
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const late = now - last - 50;
    last = now;
    lat.n++;
    lat.sum += Math.max(0, late);
    if (late > lat.max) lat.max = late;
    if (late > 50) lat.over50++;
    if (late > 100) lat.over100++;
  }, 50);
};

/** 설정(배속·자동 모드 등)을 처음 한 번만 심고 새 판의 시드를 고정한 컨텍스트 */
export async function freshCtx(browser, { seed = null, settings = null, vp = { width: 360, height: 740 }, touch = true, observer = true, extraInit = null } = {}) {
  const ctx = await mkctx(browser, { viewport: vp, ...(touch ? TOUCH : {}) });
  await ctx.addInitScript(
    ([sk, sv]) => {
      try {
        if (!sessionStorage.getItem('__qa_cleaned')) {
          localStorage.clear();
          if (sv) localStorage.setItem(sk, sv);
          sessionStorage.setItem('__qa_cleaned', '1');
        }
      } catch {}
    },
    [SETTINGS_KEY, settings ? JSON.stringify({ version: SETTINGS_VERSION, data: { era: 'present', lifeLength: 'short30', bgm: { on: false, volume: 30 }, theme: 'system', speed: 1, autoMode: false, noteCards: true, ...settings } }) : ''],
  );
  if (seed !== null) {
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
  if (observer) await ctx.addInitScript(OBSERVER_INIT);
  if (extraInit) await ctx.addInitScript(extraInit);
  return ctx;
}

export const readSave = (page) =>
  page.evaluate((k) => {
    try {
      const raw = localStorage.getItem(k);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return { __bad: true };
    }
  }, GAME_KEY);

/** 탭을 숨기지 않고 저장 flush만 일으킨다: pagehide 이벤트(앱이 타이머 누적을 저장에 담아 쓴다) */
export async function flushPlay(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await sleep(60);
  const s = await readSave(page);
  return s && s.data ? s.data.play ?? null : null;
}

export function writeOut(file, obj) {
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(obj, null, 1));
}
export { OUT, ROOT };
