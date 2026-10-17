// QA-003 M5 표본 수확: 개발 서버(시간 배율)에서 실제 게임을 8배속으로 끝까지 돌리며, 선택지가 뜰 때마다 「저장 원문 + 화면의 영향 줄」을 기록하고 정책대로 선택해 계속한다.
// 이 기록(픽스처)을 나중에 m5-impact-match.mjs가 선택지마다 다시 불러 「표기 = 실제」를 대조한다.
// 사용: node qa/scripts/m5-harvest.mjs <era> <seedStart> <count> [policy: first|last|mix] [scale]
// 결과: qa/results/m5/samples-fix-<era>.jsonl (한 판이 한 줄: { era, seed, policy, fixtures[], ending, ageSeries[] })
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, waitGuard, DEV, OUT, sleep, READ_DASH_M5 } from './m5-lib.mjs';

const era = process.argv[2] || 'present';
const seedStart = Number(process.argv[3] || 1);
const count = Number(process.argv[4] || 5);
const policy = process.argv[5] || 'mix';
const scale = Number(process.argv[6] || 60);
const outFile = path.join(OUT, `samples-fix-${era}.jsonl`);

const DRIVER = async ({ policy, seed }) => {
  const SAVE = 'suzeo-game:save';
  const q = (s) => document.querySelector(s);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const out = { fixtures: [], ageSeries: [], ending: null, endingText: null, errors: [] };
  let lastAge = -1;
  let n = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 150000) {
    if (q('[data-testid="ending-screen"]')) {
      out.ending = localStorage.getItem(SAVE);
      out.endingText = document.body.innerText;
      break;
    }
    if (q('[data-testid="error-screen"]') || q('[data-testid="superseded-screen"]')) {
      out.errors.push('뜻밖의 화면 ' + (q('[data-testid="error-screen"]') ? 'error' : 'superseded'));
      break;
    }
    const panel = q('[data-testid="choice-panel"]');
    if (panel) {
      const btns = [...panel.querySelectorAll('.choice')];
      if (btns.length && btns.every((b) => b.getAttribute('aria-disabled') !== 'true')) {
        const dash = window.__readDash();
        out.fixtures.push({ raw: localStorage.getItem(SAVE), dash });
        let idx;
        if (policy === 'first') idx = 0;
        else if (policy === 'last') idx = btns.length - 1;
        else idx = (seed * 7 + n * 5 + dash.age) % btns.length;
        n++;
        btns[idx].click();
        await wait(80);
        continue;
      }
    }
    const age = q('[data-testid="life-age"] b') ? parseInt(q('[data-testid="life-age"] b').textContent, 10) : null;
    if (age !== null && age !== lastAge) {
      lastAge = age;
      const d = window.__readDash();
      out.ageSeries.push({ age, stats: d.stats, assets: d.assets });
    }
    await wait(12);
  }
  return out;
};

const browser = await launch();
for (let i = 0; i < count; i++) {
  const seed = seedStart + i;
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e.message).slice(0, 200)));
  p.on('console', (m) => {
    if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200));
  });
  try {
    await p.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
    await p.goto(`${DEV}?__timescale=${scale}`, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]', { timeout: 15000 });
    await toRoulette(p, era);
    await skipToBirth(p);
    await birthToLife(p);
    await waitGuard(p, 'pause');
    // 8배속
    await p.locator('[data-speed="8"]').click();
    const t0 = Date.now();
    const res = await p.evaluate(DRIVER, { policy, seed });
    const rec = { era, seed, policy, scale, ms: Date.now() - t0, errors: [...errors, ...res.errors], ...res };
    fs.appendFileSync(outFile, JSON.stringify(rec) + '\n');
    console.log(`${era} seed ${seed}: 선택지 ${res.fixtures.length}개, 엔딩 ${res.ending ? 'O' : 'X'}, ${Date.now() - t0}ms, 오류 ${rec.errors.length}`);
  } catch (e) {
    console.log(`${era} seed ${seed}: 실패 ${String(e.message).slice(0, 150)}`);
    fs.appendFileSync(outFile, JSON.stringify({ era, seed, policy, failed: String(e.message).slice(0, 300), errors }) + '\n');
  }
  await ctx.close();
}
await browser.close();
