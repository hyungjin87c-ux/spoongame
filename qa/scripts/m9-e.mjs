// QA-003 M9 E군: 공통 뷰포트 11종 + 1920×1080 × 글자 100·150·200% — 화면별 가로 넘침·겹침·가려짐·가려진 포커스·낱말 끊김 감사.
// 사용: node qa/scripts/m9-e.mjs [화면,화면,...] [뷰포트이름,...]   화면: title,roulette,birth,dash-adult,dash-infant,decision,note-auto,note-manual,exit-ask,ending
// 화면 상태는 개발 서버 core(오라클)로 만들어 prod 번들에 심어 연다(M7c·M8과 같은 방식). 글자 크기는 html font-size를 바꿔 흉내 낸다(setRootFont).
// 결과: qa/results/m9/e/<화면>.jsonl (조합별 한 줄) + 케이스 E-<화면> 한 건(조합 수·문제 요약). 문제가 있는 조합의 샷은 화면당 대표 1장만 임시 폴더에 남긴다.
import fs from 'node:fs';
import path from 'node:path';
import { launch, openOracle, plainLife, pendingState, dueStateFor, openSeeded, evalCore, sleep, shot, addCase, setRootFont, STD_VIEWPORTS, SET_MANUAL, openManual, sheetReady, mkctx, fixSeed, TOUCH, PROD, toRoulette, skipToBirth, waitGuard, cleanStorageOnce, OUT } from './m7c-lib.mjs';
import { webkit } from 'playwright-core';
import { auditLayout, auditWords, auditFocus } from './m9-audit.mjs';
const WK = process.env.M9_BROWSER === 'webkit';
const PFX = process.env.M9_E_PREFIX || 'E-';
const CAT = process.env.M9_E_CAT || 'E 뷰포트·글자';
const FONTS_ENV = process.env.M9_E_FONTS ? process.env.M9_E_FONTS.split(',').map(Number) : null;

const WANT = (process.argv[2] || 'title,roulette,birth,dash-adult,dash-infant,decision,note-auto,note-manual,exit-ask,ending').split(',');
const VPF = process.argv[3] ? process.argv[3].split(',') : null;
const VPS = [...STD_VIEWPORTS, { name: '1920x1080', width: 1920, height: 1080 }].filter((v) => !VPF || VPF.includes(v.name));
const FONTS = FONTS_ENV || [100, 150, 200];
const FOCUS_FONTS = new Set([100, 200]);
const WORD_FONTS = new Set([100, 200]);

const browser = WK ? await webkit.launch({ headless: true }) : await launch();
const oracleBrowser = WK ? await launch() : browser; // 상태 만들기(오라클)는 늘 Chromium
const { page: oracle } = await openOracle(oracleBrowser);
const adult = await plainLife(oracle, { era: 'present', seed: 4242, age: 30, paused: true });
const infant = await plainLife(oracle, { era: 'present', seed: 4242, age: 2, paused: true });
const pend = await pendingState(oracle, { era: 'present', seed: 4242, minAge: 12, paused: true });
const due = await dueStateFor(oracle, 'note-infant-memory', { era: 'present', paused: true });
const ending = await evalCore(
  oracle,
  `for (let seed = 7; seed < 4000; seed++) {
     const s0 = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), 'present')));
     const r = core.playToEnd(s0, null);
     if (r.state.phase === 'ending') return { ...r.state, play: { hold: 910900, decide: 755999, fold: 123456, note: 777777, idle: 999999, offSpeed: 0, auto: 0, skips: 0, resumes: 3 } };
   }
   return null;`,
);
if (!adult || !infant || !pend || !due || !ending) throw new Error('상태 만들기 실패');

const openFresh = async (vp, steps) => {
  const ctx = await mkctx(browser, { viewport: { width: vp.width, height: vp.height }, ...(vp.touch ? TOUCH : {}) });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, 31);
  const p = await ctx.newPage();
  await p.goto(PROD, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
  if (steps >= 1) await toRoulette(p, 'present');
  if (steps >= 2) {
    await waitGuard(p, 'skip-roulette').catch(() => {});
    await p.getByTestId('skip-roulette').click();
    await p.waitForSelector('[data-testid="roulette-screen"][data-state="result"]', { timeout: 6000 });
    await sleep(400);
  }
  if (steps >= 3) {
    await waitGuard(p, 'to-birth');
    await p.getByTestId('to-birth').click();
    await p.waitForSelector('[data-testid="birth-screen"]', { timeout: 6000 });
    await sleep(500);
  }
  return { ctx, page: p };
};
const seeded = async (vp, state, wait = '[data-testid="life-screen"]') => openSeeded(browser, state, { vp: { width: vp.width, height: vp.height }, touch: !!vp.touch, settings: SET_MANUAL, wait });

const SCREENS = {
  title: (vp) => openFresh(vp, 0),
  roulette: (vp) => openFresh(vp, 2),
  birth: (vp) => openFresh(vp, 3),
  'dash-adult': (vp) => seeded(vp, adult),
  'dash-infant': (vp) => seeded(vp, infant),
  decision: async (vp) => {
    const r = await seeded(vp, pend);
    await r.page.waitForSelector('[data-testid="choice-panel"]', { timeout: 6000 });
    await sleep(600);
    return r;
  },
  'note-auto': async (vp) => {
    const r = await seeded(vp, due);
    await sheetReady(r.page);
    return r;
  },
  'note-manual': async (vp) => {
    const r = await seeded(vp, adult);
    await r.page.waitForFunction(() => { const e = document.querySelector('[data-testid="tool-note"]'); return e && e.getAttribute('aria-disabled') !== 'true'; }, null, { timeout: 5000 });
    await openManual(r.page, { touch: !!vp.touch });
    return r;
  },
  'exit-ask': async (vp) => {
    const r = await seeded(vp, adult);
    await waitGuard(r.page, 'tool-exit');
    if (vp.touch) await r.page.getByTestId('tool-exit').tap();
    else await r.page.getByTestId('tool-exit').click();
    await r.page.waitForSelector('[data-testid="exit-ask"]', { timeout: 4000 });
    await sleep(400);
    return r;
  },
  ending: (vp) => seeded(vp, ending, '[data-testid="ending-screen"]'),
};

fs.mkdirSync(path.join(OUT, 'e'), { recursive: true });
for (const name of WANT) {
  if (!SCREENS[name]) continue;
  const outFile = path.join(OUT, 'e', `${name}.jsonl`);
  fs.writeFileSync(outFile, '');
  let combos = 0;
  let badCombos = 0;
  const kinds = { layout: 0, words: 0, focus: 0 };
  const samples = [];
  let firstShot = null;
  let focusStops = 0;
  const t0 = Date.now();
  for (const vp of VPS) {
    let ctx;
    let page;
    try {
      ({ ctx, page } = await SCREENS[name](vp));
    } catch (e) {
      combos++;
      badCombos++;
      const msg = `열기 실패 ${vp.name}: ${String(e.message).slice(0, 120)}`;
      samples.push(msg);
      fs.appendFileSync(outFile, JSON.stringify({ vp: vp.name, error: msg }) + '\n');
      continue;
    }
    for (const pct of FONTS) {
      if (vp.name === '320x256-zoom400' && pct === 200) continue; // M7b L03과 같은 제외: 브라우저 400% 확대 위에 글자 200%는 사실상 1600%(조합 수에서도 뺀다)
      await setRootFont(page, pct);
      await sleep(350);
      const rec = { screen: name, vp: vp.name, font: pct, problems: [] };
      const lay = await auditLayout(page);
      rec.problems.push(...lay.problems.map((x) => `[배치] ${x}`));
      if (lay.problems.length) kinds.layout++;
      if (WORD_FONTS.has(pct)) {
        const w = await auditWords(page, 'body');
        rec.problems.push(...w.problems.map((x) => `[낱말] ${x}`));
        if (w.problems.length) kinds.words++;
      }
      if (FOCUS_FONTS.has(pct)) {
        const f = await auditFocus(page, `${name} ${vp.name} ${pct}%`, vp.height);
        focusStops += f.stops;
        rec.problems.push(...f.problems.map((x) => `[포커스] ${x}`));
        if (f.problems.length) kinds.focus++;
        await page.evaluate(() => { window.scrollTo(0, 0); if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); });
      }
      combos++;
      if (rec.problems.length) {
        badCombos++;
        if (samples.length < 8) samples.push(`${vp.name}/${pct}%: ${rec.problems.slice(0, 2).join(' ; ').slice(0, 260)}`);
        if (!firstShot) {
          await setRootFont(page, pct);
          firstShot = await shot(page, `${PFX}${name}`, `${vp.name}-${pct}`);
        }
      }
      fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    }
    await ctx.close();
  }
  const secs = Math.round((Date.now() - t0) / 1000);
  addCase({
    id: `${PFX}${name}`,
    cat: CAT,
    title: `${WK ? 'WebKit · ' : ''}${name}: 공통 뷰포트 11종 + 1920×1080 × 글자 100·150·200% — 가로 넘침·겹침·가려짐(전 조합), 가려진 포커스·낱말 끊김(100·200%)`,
    steps: `prod 번들에 ${name} 상태를 열고 html 글자 크기를 100·150·200%로 바꾸며 m9-audit(배치·낱말·포커스 Tab·Shift+Tab 한 바퀴)로 잼`,
    expected: '모든 조합에서 가로 넘침 0, 겹친·가려진 글자 0, 가려진 포커스 0, 낱말 중간 끊김 0',
    actual: badCombos === 0 ? `${combos}조합 문제 0 (Tab 정지 ${focusStops}곳, ${secs}초)` : `${combos}조합 중 ${badCombos}조합에 문제 — 배치 ${kinds.layout} · 낱말 ${kinds.words} · 포커스 ${kinds.focus}. 예: ${samples.join(' || ')}`,
    verdict: badCombos === 0 ? 'PASS' : kinds.layout > 0 || kinds.focus > 0 ? 'FAIL' : WK ? 'RECORD' : 'FAIL', // WebKit에서 낱말·구분 기호만 어긋나면 모양 차이 → RECORD(마스터 12-4 4)
    shots: firstShot ? [firstShot] : [],
  });
}
await browser.close();
if (oracleBrowser !== browser) await oracleBrowser.close();
