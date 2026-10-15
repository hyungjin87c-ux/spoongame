// 한 판의 선택지 수·사망 나이 분포 (플레이 시간 추정의 입력). 시간 배율 1000 사용 — 시간 실측이 아니라 "이벤트 수" 통계용.
import fs from 'node:fs';
import path from 'node:path';
import { DEV, RES_DIR, launch, mkctx, toLife, snap, readSave, readChoice, sleep, waitScreen } from './lib.mjs';
const N = Number(process.argv[2] || 15);
const browser = await launch();
const out = [];
for (const era of ['past', 'present', 'future']) {
  for (let i = 0; i < N; i++) {
    const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 } });
    const page = await ctx.newPage();
    await page.goto(DEV + '/?__timescale=1000');
    await toLife(page, era);
    await sleep(500);
    await page.locator('[data-speed="8"]').click();
    let choices = 0;
    const chars = [];
    for (let k = 0; k < 80; k++) {
      const s = await snap(page);
      if (s.screen === 'ending-placeholder') break;
      if (s.hasChoice) {
        const c = await readChoice(page);
        choices++;
        chars.push({ title: c.title, text: c.text.length, labels: c.choices.reduce((a, b) => a + b.label.length, 0), n: c.choices.length });
        await page.locator('.choice-list button').first().click();
        await sleep(60);
      } else {
        await page.getByTestId('skip').click({ timeout: 4000 }).catch(() => {});
        await sleep(60);
      }
    }
    const sv = await readSave(page);
    const h = sv.data.history;
    out.push({ era, choices, deathAge: sv.data.death ? sv.data.death.age : null, narrative: h.filter((x) => x.kind === 'event').length, chars });
    await ctx.close();
  }
}
fs.writeFileSync(path.join(RES_DIR, 'life-stats.json'), JSON.stringify(out, null, 1));
const by = {};
for (const o of out) (by[o.era] ||= []).push(o);
for (const [era, a] of Object.entries(by)) {
  const c = a.map((x) => x.choices);
  const d = a.map((x) => x.deathAge);
  const nar = a.map((x) => x.narrative);
  const avg = (v) => (v.reduce((p, q) => p + q, 0) / v.length).toFixed(1);
  console.log(era, 'N', a.length, '선택지 평균', avg(c), 'min', Math.min(...c), 'max', Math.max(...c), '| 사망 평균', avg(d), 'min', Math.min(...d), 'max', Math.max(...d), '| 서술 이벤트 평균', avg(nar));
}
await browser.close();
