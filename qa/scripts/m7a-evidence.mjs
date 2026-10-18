// QA-003 M7a FAIL 증거: 수확 때 문제가 보였던 판(시대·시드)을 같은 정책으로 다시 돌려 그 순간의 화면을 찍는다. 코드는 건드리지 않는다.
// 사용: node qa/scripts/m7a-evidence.mjs   (개발 서버 시간 배율 10, 수확과 같은 선택 정책 mix)
// 결과: 스크린샷 M7a-F1a·F1b·F2a·F2b-*.png, qa/results/m7a/evidence.json
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, toRoulette, skipToBirth, birthToLife, waitGuard, sleep, shot, DEV, OUT, READ_DASH_M7A, readBirth } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const TARGETS = [
  { id: 'F1a', era: 'present', seed: 197, event: 'infant-kindergarten', note: '재력 5단계(아주 넉넉한 가정) 3세 유치원 고르기 → 집에서 더 돌본다' },
  { id: 'F1b', era: 'present', seed: 111, event: 'infant-parental-leave', note: '재력 5단계 0세 일을 쉬는 한 해 → 한 사람이 일을 쉬고 돌본다' },
  { id: 'F2a', era: 'past', seed: 94, event: 'infant-moving', note: '자가(재력 3단계) 6세 이삿짐을 싸던 날 → 빚을 내어 작은 집을 산다' },
  { id: 'F2b', era: 'present', seed: 80, event: 'infant-moving', note: '자가(재력 3단계) 5세 이삿짐을 싸던 날 → 빚을 내어 작은 집을 산다' },
];
const browser = await launch();
const out = [];
for (const t of TARGETS) {
  const ctx = await mkctx(browser, { viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, t.seed);
  const p = await ctx.newPage();
  await p.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
  await p.goto(`${DEV}?__timescale=10`, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="title-screen"]');
  await toRoulette(p, t.era);
  await skipToBirth(p);
  const birth = await readBirth(p);
  const rec = { ...t, birthSentence: birth.sentence, housing: birth.fields.housing?.value, wealth: birth.fields.wealth?.value, shots: [] };
  if (t.id === 'F2a') {
    await p.evaluate(() => document.querySelector('[data-testid="birth-grid"]').scrollIntoView({ block: 'start', behavior: 'instant' }));
    await sleep(250);
    rec.shots.push(await shot(p, t.id, 'birth-report-housing'));
  }
  await birthToLife(p);
  await waitGuard(p, 'pause');
  await p.locator('[data-speed="8"]').click();
  let n = 0;
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > 90000) break;
    const d = await p.evaluate(() => window.__readDash());
    if (d.screen !== 'life-screen') break;
    if (d.choices.length && d.choices.every((c) => c.aria !== 'true')) {
      const idx = (t.seed * 7 + n * 5 + d.age) % d.choices.length;
      n++;
      const isTarget = (d.choiceKey || '').startsWith(t.event);
      if (isTarget) {
        await p.evaluate(() => document.querySelector('[data-testid="choice-panel"]').scrollIntoView({ block: 'start', behavior: 'instant' }));
        await sleep(250);
        rec.card = { key: d.choiceKey, choices: d.choices.map((c) => `${c.id}:${c.label}`), picked: d.choices[idx].id };
        rec.shots.push(await shot(p, t.id, 'card'));
      }
      await p.locator(`[data-testid="choice-${d.choices[idx].id}"]`).click({ timeout: 3000 });
      if (isTarget) {
        // 선택 뒤 인생 기록 마지막 줄을 읽고, 첫 줄(출생)과 함께 보이게 기록 영역 맨 위·맨 아래를 찍는다
        await sleep(600);
        const rows = await p.evaluate(() => [...document.querySelectorAll('[data-testid="log-row"]')].map((r) => r.textContent.replace(/\s+/g, ' ').trim()));
        rec.logFirst = rows[0];
        rec.logResult = rows.filter((r) => /선택:/.test(r)).slice(-1)[0];
        await p.evaluate(() => {
          document.querySelector('[data-testid="log"]').scrollIntoView({ block: 'start', behavior: 'instant' });
          const l = document.querySelector('[data-testid="log-list"]');
          l.scrollTo({ top: l.scrollHeight, behavior: 'instant' });
        });
        await sleep(300);
        rec.shots.push(await shot(p, t.id, 'log-result'));
        await p.evaluate(() => document.querySelector('[data-testid="log-list"]').scrollTo({ top: 0, behavior: 'instant' }));
        await sleep(300);
        rec.shots.push(await shot(p, t.id, 'log-birth-line'));
        break;
      }
      await sleep(80);
      continue;
    }
    await sleep(30);
  }
  out.push(rec);
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, RP + 'evidence.json'), JSON.stringify(out, null, 1));
for (const r of out) console.log(r.id, '|', r.wealth, '|', r.housing, '|', r.logFirst?.slice(0, 50), '|', r.logResult?.slice(0, 90));
await browser.close();
