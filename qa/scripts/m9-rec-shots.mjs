// QA-003 M9: 케이스 스크립트가 화면을 남기지 않은 RECORD 3건의 대표 샷을 임시 폴더에 M9-<케이스ID>.png로 찍는다(최종 표 생성이 FAIL·RECORD의 샷으로 저장소에 옮긴다).
//  CARRY-M4-O01  새로고침 직후 진행률 0%부터(대시보드 머리)
//  CARRY-M7e-O01 엔딩 막대의 마름모가 띠 바깥 2점 이내인 모호한 경계 한 판
//  EL-det-others 엔딩 연표의 이벤트 서술 줄에서 「그」가 줄 끝에 홀로 남은 한 줄(글자 100%, 320×568)
// 사용: node qa/scripts/m9-rec-shots.mjs
import path from 'node:path';
import { launch, openOracle, plainLife, openSeeded, evalCore, sleep, SET_MANUAL, SHOT_DIR, readCard } from './m7c-lib.mjs';
import { DET_AUDIT } from './m8-r2-det.mjs';
import { READ, judge } from './m7e-ending-lib.mjs';

const browser = await launch();
const { page: oracle } = await openOracle(browser);
const out = (id) => path.join(SHOT_DIR, `M9-${id}.png`);

// 1) CARRY-M4-O01
{
  const run = await plainLife(oracle, { era: 'present', seed: 4242, age: 20, paused: false, seenAll: true });
  const { ctx, page } = await openSeeded(browser, run, { vp: { width: 1280, height: 800 }, touch: false, settings: { ...SET_MANUAL, speed: 4 } });
  await page.waitForFunction(() => { const e = document.querySelector('[data-testid="year-progress"]'); return e && Number(e.getAttribute('aria-valuenow')) >= 40; }, null, { timeout: 15000, polling: 100 });
  await page.evaluate(() => window.dispatchEvent(new Event('pagehide')));
  await sleep(100);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('[data-testid="life-screen"]');
  await sleep(250);
  await page.screenshot({ path: out('CARRY-M4-O01'), clip: { x: 0, y: 0, width: 1280, height: 130 } });
  await ctx.close();
}

// 2) CARRY-M7e-O01 — 모호한 경계 한 판
{
  const sample = await evalCore(
    oracle,
    `const out = [];
     for (let seed = 1; out.length < 80 && seed < 4000; seed++) {
       const s0 = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed * 7 + 3), 'future')));
       const r = core.playToEnd(s0, null);
       if (r.state.phase !== 'ending' || r.state.death.age < 20) continue;
       out.push({ seed: seed * 7 + 3, tier: r.state.character.parentWealth, state: r.state });
     }
     return out;`,
  );
  let done = false;
  for (const it of sample) {
    const { ctx, page } = await openSeeded(browser, it.state, { vp: { width: 1280, height: 800 }, touch: false, settings: SET_MANUAL, wait: '[data-testid="ending-screen"]' });
    await sleep(150);
    const d = await page.evaluate(READ);
    const name = `ending-future-${it.seed}`;
    const j = judge(name, { [name]: { era: 'future', tier: it.tier } }, d);
    if (j.notes.some((x) => /경계 모호/.test(x))) {
      await page.getByTestId('ending-bar').scrollIntoViewIfNeeded();
      await sleep(200);
      const el = page.getByTestId('ending-journey-section');
      if (await el.count()) await el.screenshot({ path: out('CARRY-M7e-O01') });
      else await page.screenshot({ path: out('CARRY-M7e-O01') });
      console.log('O01 모호한 경계 샘플', name, j.notes.join(' | ').slice(0, 200));
      done = true;
    }
    await ctx.close();
    if (done) break;
  }
  if (!done) console.log('O01 모호한 경계를 못 찾음');
}

// 3) EL-det-others — 글자 100%, 320×568
{
  let done = false;
  for (const era of ['present', 'past', 'future']) {
    if (done) break;
    const sample = await evalCore(
      oracle,
      `const out = [];
       for (let seed = 1; out.length < 40 && seed < 3000; seed++) {
         const s0 = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), arg.era)));
         const r = core.playToEnd(s0, null);
         if (r.state.phase === 'ending') out.push(r.state);
       }
       return out;`,
      { era },
    );
    for (const st of sample) {
      const { ctx, page } = await openSeeded(browser, st, { vp: { width: 320, height: 568 }, touch: true, settings: SET_MANUAL, wait: '[data-testid="ending-screen"]' });
      await sleep(250);
      const r = await page.evaluate(DET_AUDIT, ['[data-testid="ending-screen"]']);
      const v = r.violations.find((x) => /timeline/.test(x.el) || x.context.length > 8);
      if (v) {
        await page.evaluate((c) => {
          const key = c.split(' ').slice(0, 2).join(' ');
          const e = [...document.querySelectorAll('[data-testid="timeline-entry"]')].find((x) => x.textContent.replace(/\s+/g, ' ').includes(key));
          if (e) e.scrollIntoView({ block: 'center', behavior: 'instant' });
        }, v.context);
        await sleep(250);
        await page.screenshot({ path: out('EL-det-others') });
        console.log('EL-det 샘플', era, JSON.stringify(v));
        done = true;
      }
      await ctx.close();
      if (done) break;
    }
  }
  if (!done) console.log('EL-det 샘플을 못 찾음');
}
await browser.close();
