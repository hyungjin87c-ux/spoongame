// QA-003 M9 P6 눈 판정용 촬영: WebKit과 Chromium에서 같은 화면의 수저 띠(은·금 광택)·수저 칩·슬라이드(기준 줄)를 임시 폴더에 찍는다.
// 저장소에는 남기지 않는다(마스터 결정 12-4 3 — 눈으로 보고 PASS면 지움, 어긋나면 RECORD로 qa/screenshots에 남김).
// 사용: node qa/scripts/m9-wk-visual.mjs <출력폴더>
import fs from 'node:fs';
import path from 'node:path';
import { webkit } from 'playwright-core';
import { launch, openOracle, plainLife, openSeeded, mkctx, cleanStorageOnce, fixSeed, sleep, SET_MANUAL, TOUCH, PROD } from './m7c-lib.mjs';

const out = path.resolve(process.argv[2] || 'wk-visual');
fs.mkdirSync(out, { recursive: true });
const chromium = await launch();
const wk = await webkit.launch({ headless: true });
const { page: oracle } = await openOracle(chromium);
const adult = await plainLife(oracle, { era: 'present', seed: 229, age: 30, paused: true });

for (const [engine, br] of [['wk', wk], ['cr', chromium]]) {
  for (const [vpName, vp, touch] of [['d1280', { width: 1280, height: 800 }, false], ['m360', { width: 360, height: 740 }, true]]) {
    const ctx = await mkctx(br, { viewport: vp, ...(touch ? TOUCH : {}) });
    await cleanStorageOnce(ctx);
    const p = await ctx.newPage();
    await p.goto(PROD, { waitUntil: 'load' });
    await p.waitForSelector('[data-testid="title-screen"]');
    await sleep(700);
    await p.screenshot({ path: path.join(out, `${engine}-${vpName}-title.png`) });
    const lineup = p.getByTestId('spoon-lineup');
    if (await lineup.count()) {
      await lineup.scrollIntoViewIfNeeded();
      await sleep(200);
      await lineup.screenshot({ path: path.join(out, `${engine}-${vpName}-spoon-lineup.png`) });
    }
    // 슬라이드: 처음 네 장을 넘겨 가며 캐러셀 영역을 찍는다(기준 줄)
    const car = p.getByTestId('carousel');
    if (await car.count()) {
      await car.scrollIntoViewIfNeeded();
      await sleep(250);
      for (let i = 0; i < 4; i++) {
        await car.screenshot({ path: path.join(out, `${engine}-${vpName}-slide${i + 1}.png`) });
        const next = p.getByTestId('carousel-next');
        if (await next.count()) await next.click().catch(() => {});
        await sleep(500);
      }
    }
    await ctx.close();
    // 대시보드의 수저 칩(프로필)
    const r = await openSeeded(br, adult, { vp, touch, settings: SET_MANUAL });
    await sleep(500);
    const prof = r.page.getByTestId('profile-card');
    if (await prof.count()) await prof.screenshot({ path: path.join(out, `${engine}-${vpName}-profile.png`) });
    await r.ctx.close();
  }
}
await wk.close();
await chromium.close();
console.log('찍음', fs.readdirSync(out).length, '장 →', out);
