// QA-003 M7a(영유아 0~7세 콘텐츠·합쇼체 lint) 공용 라이브러리. 앱 코드는 건드리지 않고 브라우저로만 조작한다.
// 결과: qa/results/m7a/cases.jsonl, 스크린샷: qa/screenshots/003/M7a-<케이스ID>[-<접미>].png
// M4 공용(m4-lib)의 도구(실행·콘솔 수집·시드 고정·화면 열기)를 그대로 쓰고, 케이스·스크린샷·결과 위치만 M7a로 바꾼다.
import fs from 'node:fs';
import path from 'node:path';
import { con, ROOT, PROD, DEV, GAME_KEY, SETTINGS_KEY, launch, sleep, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, newGameToLife, waitGuard, readRaw, saveJson, overflowX, whichScreen, bodyText, pickEra, readBirth, readDash, setRootFont, rand, VP, TOUCH, STD_VIEWPORTS, parseRgb } from './m4-lib.mjs';

export { con, ROOT, PROD, DEV, GAME_KEY, SETTINGS_KEY, launch, sleep, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, newGameToLife, waitGuard, readRaw, saveJson, overflowX, whichScreen, bodyText, pickEra, readBirth, readDash, setRootFont, rand, VP, TOUCH, STD_VIEWPORTS, parseRgb };

export const RP = process.env.QA_RP || '';
export const SHOT_PREFIX = process.env.QA_SHOT_PREFIX || 'M7a';
export const SHOT_DIR = path.join(ROOT, 'qa', 'screenshots', '003');
export const OUT = path.join(ROOT, 'qa', 'results', 'm7a');
fs.mkdirSync(SHOT_DIR, { recursive: true });
fs.mkdirSync(OUT, { recursive: true });

export async function shot(page, id, suffix = '', opts = {}) {
  const name = `${SHOT_PREFIX}-${id}${suffix ? '-' + suffix : ''}.png`;
  await page.screenshot({ path: path.join(SHOT_DIR, name), fullPage: !!opts.full });
  return `qa/screenshots/003/${name}`;
}

export const CASES = process.env.QA_CASES || path.join(OUT, RP + 'cases.jsonl');

/** 케이스 하나를 돌리고 결과를 cases.jsonl에 쌓는다. fn은 { verdict, actual, shots } 를 돌려준다. */
export async function runCase(c, fn) {
  con.take();
  con.takeRequests();
  const t0 = Date.now();
  let r;
  try {
    r = await fn();
  } catch (e) {
    // 오류 글에 내 컴퓨터의 경로가 섞여 저장소에 올라가지 않게 경로 꼴을 지운다(repoHygiene)
    const scrub = (t) => t.split(ROOT).join('<repo>').replace(/[A-Za-z]:[\\/][^\s)'"]*/g, '<path>').replace(/file:\/\/\/[^\s)'"]*/g, '<file>');
    r = { verdict: 'ERROR', actual: `스크립트 오류: ${scrub(String(e && e.stack ? e.stack : e)).slice(0, 700)}`, shots: [] };
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

/** 대시보드 한 시점의 화면 값을 읽는다: 나이·결정 카드(제목·본문·선택지·영향 줄)·인생 기록 줄·가족 카드·진행 상태 */
export const READ_DASH_M7A = () => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  const panel = q('[data-testid="choice-panel"]');
  const choices = panel
    ? [...panel.querySelectorAll('.choice')].map((b) => ({
        id: (b.getAttribute('data-testid') || '').replace('choice-', ''),
        label: tx(b.querySelector('.choice__label')),
        impact: [...b.querySelectorAll('.impact__item')].map((i) => tx(i.querySelector('.impact__show'))),
        aria: b.getAttribute('aria-disabled'),
        name: b.getAttribute('aria-label'),
      }))
    : [];
  return {
    age: q('[data-testid="life-age"] b') ? parseInt(q('[data-testid="life-age"] b').textContent, 10) : null,
    screen: ['title-screen', 'roulette-screen', 'birth-screen', 'life-screen', 'ending-screen', 'superseded-screen', 'error-screen'].find((id) => q(`[data-testid="${id}"]`)) || 'unknown',
    choiceTitle: tx(q('[data-testid="choice-title"]')),
    choiceText: tx(q('[data-testid="choice-text"]')),
    choiceKey: panel ? panel.getAttribute('data-key') : null,
    choices,
    hint: tx(q('[data-testid="choice-hint"]')),
    paused: q('[data-testid="pause"]')?.getAttribute('data-paused') ?? null,
    logRows: qa('[data-testid="log-row"]').map((r) => tx(r)),
    family: q('[data-testid="family-card"]') ? tx(q('[data-testid="family-card"]')) : null,
    siblings: qa('[data-testid="family-sibling"]').map((r) => tx(r)),
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
