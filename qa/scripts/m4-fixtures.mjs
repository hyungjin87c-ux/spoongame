// QA-003 M4: 실제 게임을 개발 서버(시간 배율)로 돌려 나이·상태별 저장 원문(localStorage)을 뽑아 둔다. 감사 스크립트가 화면을 한 번에 그 상태로 열 때 쓴다.
// 사용: node qa/scripts/m4-fixtures.mjs [era...]   결과: qa/results/m4/saves/<era>-<tag>.json  ({ game: <raw>, age, screen })
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, readDash, sleep, DEV, OUT, GAME_KEY, con } from './m4-lib.mjs';

const dir = path.join(OUT, 'saves');
fs.mkdirSync(dir, { recursive: true });

const eras = process.argv.slice(2).length ? process.argv.slice(2) : ['past', 'present', 'future'];
const SEED = { past: 155, present: 229, future: 138 };
const ONLY = process.env.QA_ONLY_TARGETS ? process.env.QA_ONLY_TARGETS.split(',') : null;
const TARGETS_ALL = [
  ['infant', 0],
  ['age5', 5],
  ['age10', 10],
  ['age16', 16],
  ['age30', 30],
  ['age55', 55],
  ['age65', 65],
  ['age78', 78],
];
const TARGETS = ONLY ? TARGETS_ALL.filter(([t]) => ONLY.includes(t)) : TARGETS_ALL;

const browser = await launch();
for (const era of eras) {
  const ctx = await mkctx(browser, { viewport: { width: 1280, height: 800 } });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, SEED[era]);
  const p = await ctx.newPage();
  await openTitle(p, DEV, '?__timescale=30');
  await toRoulette(p, era);
  await skipToBirth(p);
  await birthToLife(p);
  const done = new Set();
  const save = async (tag, extra = {}) => {
    const raw = await p.evaluate((k) => localStorage.getItem(k), GAME_KEY);
    const d = await readDash(p).catch(() => ({}));
    fs.writeFileSync(path.join(dir, `${era}-${tag}.json`), JSON.stringify({ game: raw, age: d.age, screen: d.screen, ...extra }));
    console.log(era, tag, 'age', d.age, d.screen, raw ? raw.length : 0);
  };
  // 인생 0세 상태(출생 직후)
  await p.getByTestId('pause').click().catch(() => {});
  await sleep(200);
  if (!ONLY) await save('infant');
  done.add('infant');
  await p.getByTestId('pause').click().catch(() => {}); // 계속
  // 수동 진행 + 선택지는 첫 선택지
  let pendingSaved = false;
  const t0 = Date.now();
  for (;;) {
    const d = await readDash(p);
    if (d.screen === 'ending-screen') {
      if (!ONLY) await save('ending');
      break;
    }
    if (ONLY && TARGETS.every(([t]) => done.has(t))) break;
    if (Date.now() - t0 > 600000) throw new Error('시간 초과 ' + era);
    if (d.screen !== 'life-screen') {
      await sleep(100);
      continue;
    }
    if (d.hasChoice) {
      if (!ONLY && !pendingSaved && d.age >= 25) {
        await save('pending', { choiceTitle: d.choiceTitle });
        pendingSaved = true;
      }
      const btn = p.locator('[data-testid="choice-panel"] .choice').first();
      try {
        await p.waitForFunction(() => {
          const b = document.querySelector('[data-testid="choice-panel"] .choice');
          return b && b.getAttribute('aria-disabled') !== 'true';
        }, null, { timeout: 3000 });
        await btn.click({ timeout: 3000 });
      } catch {}
      await sleep(80);
      continue;
    }
    for (const [tag, age] of TARGETS) {
      if (done.has(tag) || d.age === null || d.age < age) continue;
      // 멈춘 상태로 저장
      await p.getByTestId('pause').click().catch(() => {});
      await sleep(250);
      const d2 = await readDash(p);
      if (d2.paused === 'true') {
        await save(tag);
        done.add(tag);
        await p.getByTestId('pause').click().catch(() => {});
      }
    }
    await sleep(60);
  }
  await ctx.close();
}
await browser.close();
console.log('console', JSON.stringify(con.take()).slice(0, 400));
