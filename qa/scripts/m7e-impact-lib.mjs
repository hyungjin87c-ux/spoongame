// QA-003 M7e(경제 모델·선택지 영향 표기) 공용 라이브러리. 앱 코드는 건드리지 않고 브라우저로만 조작한다.
// 결과: qa/results/m5/cases.jsonl, 스크린샷: qa/screenshots/003/M5-<케이스ID>[-<접미>].png
// M4 공용(m4-lib)의 도구(실행·콘솔 수집·시드 고정·화면 열기)를 그대로 쓰고, 케이스·스크린샷·결과 위치만 M5로 바꾼다.
import fs from 'node:fs';
import path from 'node:path';
import { con, ROOT, PROD, DEV, GAME_KEY, SETTINGS_KEY, launch, sleep, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, newGameToLife, waitGuard, readRaw, saveJson, overflowX, whichScreen, bodyText, pickEra, readBirth, readDash, setRootFont, rand, VP, TOUCH, STD_VIEWPORTS, parseRgb } from './m4-lib.mjs';

export { con, ROOT, PROD, DEV, GAME_KEY, SETTINGS_KEY, launch, sleep, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, newGameToLife, waitGuard, readRaw, saveJson, overflowX, whichScreen, bodyText, pickEra, readBirth, readDash, setRootFont, rand, VP, TOUCH, STD_VIEWPORTS, parseRgb };

export const SHOT_DIR = path.join(ROOT, 'qa', 'screenshots', '003');
export const OUT = process.env.QA_OUT ? path.resolve(ROOT, process.env.QA_OUT) : path.join(ROOT, 'qa', 'results', 'm7e');
export const FIX = path.join(OUT, 'fixtures');
fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(FIX, { recursive: true });

export async function shot(page, id, suffix = '', opts = {}) {
  const name = `M7e-${id}${suffix ? '-' + suffix : ''}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: !!opts.full });
  return `qa/screenshots/003/${name}`;
}

export const CASES = process.env.QA_CASES || path.join(OUT, 'cases.jsonl');

/** 케이스 하나를 돌리고 결과를 cases.jsonl에 쌓는다. fn은 { verdict, actual, shots } 를 돌려준다. */
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

/** 케이스 기록을 직접 덧붙인다(집계 스크립트용) */
export function addCase(rec) {
  const full = { console: [], externalRequests: [], shots: [], at: new Date().toISOString(), ...rec };
  fs.appendFileSync(CASES, JSON.stringify(full) + '\n');
  console.log(`[${full.verdict}] ${full.id} ${full.title || ''} :: ${String(full.actual || '').slice(0, 300)}`);
}

export function appendJsonl(file, obj) {
  fs.appendFileSync(path.join(OUT, file), JSON.stringify(obj) + '\n');
}

/** 저장 원문(봉투)을 고쳐 새 원문으로. fn(data, env)가 data를 제자리에서 고친다. */
export function editSave(raw, fn) {
  const env = JSON.parse(raw);
  fn(env.data, env);
  return JSON.stringify(env);
}

/** 컨텍스트가 처음 열릴 때 저장소를 비우고 원문을 심는다(탭 새로고침 때는 다시 심지 않는다) */
export async function seedStorage(ctx, entries) {
  await ctx.addInitScript((es) => {
    try {
      if (!sessionStorage.getItem('__qa_seeded')) {
        localStorage.clear();
        for (const [k, v] of es) if (v !== null) localStorage.setItem(k, v);
        sessionStorage.setItem('__qa_seeded', '1');
      }
    } catch {}
  }, Object.entries(entries));
}

/** 만 원 금액 글자(「1억 2,000만 원」「−1,200만 원」「0원」)를 만 원 정수로. 읽을 수 없으면 null. */
export function parseMan(text) {
  if (text === null || text === undefined) return null;
  const t = String(text).replace(/\s+/g, ' ').trim();
  const neg = t.startsWith('−') || t.startsWith('-');
  const s = t.replace(/^[−-]/, '');
  if (!/원$/.test(s)) return null;
  if (/^[\d,]+원$/.test(s)) return (neg ? -1 : 1) * Math.round(Number(s.replace(/[,원]/g, '')) / 10000);
  let total = 0;
  const jo = /([\d,]+)조/.exec(s);
  const eok = /([\d,]+)억/.exec(s);
  const man = /([\d,]+)만/.exec(s);
  if (jo) total += Number(jo[1].replace(/,/g, '')) * 100_000_000;
  if (eok) total += Number(eok[1].replace(/,/g, '')) * 10_000;
  if (man) total += Number(man[1].replace(/,/g, ''));
  if (!jo && !eok && !man) return null;
  return neg ? -total : total;
}

/** 대시보드 한 시점의 화면 값을 읽는다: 상태 4개 meter, 자산 카드 3값, 영향 줄, 도움말 */
export const READ_DASH_M5 = () => {
  const q = (s) => document.querySelector(s);
  const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  const stats = {};
  for (const m of document.querySelectorAll('[data-stat]')) {
    const meter = m.querySelector('[role="meter"]');
    if (meter) stats[m.getAttribute('data-stat')] = Number(meter.getAttribute('aria-valuenow'));
  }
  const assets = q('[data-testid="assets"]')
    ? { net: tx(q('[data-testid="assets-net"]')), income: tx(q('[data-testid="assets-income"]')), debt: tx(q('[data-testid="assets-debt"]')) }
    : null;
  const panel = q('[data-testid="choice-panel"]');
  const choices = panel
    ? [...panel.querySelectorAll('.choice')].map((b) => ({
        testid: b.getAttribute('data-testid'),
        id: (b.getAttribute('data-testid') || '').replace('choice-', ''),
        label: tx(b.querySelector('.choice__label')),
        impact: [...b.querySelectorAll('.impact__item')].map((i) => ({
          key: i.getAttribute('data-key'),
          direction: i.getAttribute('data-direction'),
          steps: Number(i.getAttribute('data-steps')),
          shown: tx(i.querySelector('.impact__show')),
          sr: tx(i.querySelector('.sr-only')),
          tone: (i.querySelector('.impact__step')?.className || '').replace(/.*impact__step--/, ''),
          color: getComputedStyle(i.querySelector('.impact__step')).color,
        })),
        aria: b.getAttribute('aria-disabled'),
      }))
    : [];
  return {
    age: q('[data-testid="life-age"] b') ? parseInt(q('[data-testid="life-age"] b').textContent, 10) : null,
    screen: ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => q(`[data-testid="${id}"]`)) || 'unknown',
    stats,
    assets,
    assetsBasis: tx(q('[data-testid="assets-basis"]')),
    assetsNote: tx(q('[data-testid="assets-note"]')),
    choiceTitle: tx(q('[data-testid="choice-title"]')),
    choiceKey: panel ? panel.getAttribute('data-key') : null,
    choices,
    hint: tx(q('[data-testid="choice-hint"]')),
    paused: q('[data-testid="pause"]')?.getAttribute('data-paused') ?? null,
    logRows: document.querySelectorAll('[data-testid="log-row"]').length,
  };
};

export const hashFiles = async (dir) => {
  const { createHash } = await import('node:crypto');
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else files.push(p);
    }
  };
  walk(dir);
  files.sort();
  const h = createHash('sha256');
  for (const f of files) {
    h.update(path.relative(dir, f).replace(/\\/g, '/'));
    h.update('\0');
    h.update(fs.readFileSync(f));
    h.update('\0');
  }
  return { count: files.length, sha: h.digest('hex') };
};
