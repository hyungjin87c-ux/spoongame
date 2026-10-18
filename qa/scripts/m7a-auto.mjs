// QA-003 M7a 보충 공격: 자동 모드와 「다음 결정으로」 연타로 0~8세를 지나며 마일스톤 3개가 각 한 번, once 이벤트 중복 0, 나이 단조, 멈춤 0.
// 사용: node qa/scripts/m7a-auto.mjs     결과: cases.jsonl (M7a-A06), 스크린샷 M7a-A06-*
import { launch, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, waitGuard, sleep, shot, runCase, PROD, TOUCH, VP, READ_DASH_M7A, GAME_KEY } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const browser = await launch();
const MS = ['infant-vaccine', 'infant-first-steps', 'infant-first-word'];

async function runOne(era, seed, mode) {
  const ctx = await mkctx(browser, { viewport: VP.m360, ...TOUCH });
  await cleanStorageOnce(ctx);
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  await p.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
  await openTitle(p, PROD);
  await toRoulette(p, era);
  await skipToBirth(p);
  await birthToLife(p);
  await waitGuard(p, 'pause');
  await p.locator('[data-speed="8"]').click();
  if (mode === 'auto') await p.locator('[data-testid="auto"]').click();
  const t0 = Date.now();
  let skips = 0;
  let stuck = false;
  let lastAge = -1;
  let lastChange = Date.now();
  for (;;) {
    const d = await p.evaluate(() => window.__readDash());
    if (d.screen !== 'life-screen' || d.age >= 9) break;
    if (d.age !== lastAge) {
      lastAge = d.age;
      lastChange = Date.now();
    }
    if (Date.now() - lastChange > 20000 && !d.choices.length) {
      stuck = true;
      break;
    }
    if (Date.now() - t0 > 120000) {
      stuck = true;
      break;
    }
    if (mode === 'skip') {
      if (d.choices.length && d.choices.every((c) => c.aria !== 'true')) await p.locator(`[data-testid="choice-${d.choices[0].id}"]`).click({ timeout: 2000 }).catch(() => {});
      else {
        // 다음 결정으로 연타(막 눌러 본다)
        for (let i = 0; i < 4; i++) {
          await p.getByTestId('skip').click({ timeout: 500, noWaitAfter: true }).catch(() => {});
          skips++;
        }
      }
    } else if (d.choices.length && mode === 'auto') {
      // 자동 모드가 알아서 고르는지 본다(사람은 안 누른다)
    }
    await sleep(60);
  }
  const g = JSON.parse(await p.evaluate((k) => localStorage.getItem(k), GAME_KEY)).data;
  const s = await shot(p, 'A06', `${mode}-${era}-${seed}`);
  await ctx.close();
  return { g, stuck, skips, shot: s };
}

await runCase({ id: 'M7a-A06', cat: '공격', title: '자동 모드와 「다음 결정으로」 연타로 0~8세 통과: 마일스톤 3개 각 한 번·once 이벤트 중복 0·연표 나이 단조·멈춤 0', steps: '세 시대 × (자동 모드 켜고 사람은 안 누름 / 선택지는 첫 번째 + 다음 결정으로를 한 번에 4번씩 연타) 8배속으로 9세까지', expected: '멈춤 없이 9세, 마일스톤 3개가 각 1줄, 같은 이벤트 id 줄이 2번 없음(반복 이벤트 제외), 나이 단조 증가' }, async () => {
  const bad = [];
  const notes = [];
  const shots = [];
  for (const [era, seed] of [['present', 14], ['past', 28], ['future', 5]]) {
    for (const mode of ['auto', 'skip']) {
      const r = await runOne(era, seed, mode);
      const h = r.g.history.filter((x) => x.age <= 8);
      const tag = `${era}/${mode}`;
      if (r.stuck) bad.push(`${tag}: 멈춤(나이 ${r.g.age})`);
      for (const id of MS) {
        const n = h.filter((x) => x.eventId === id).length;
        if (r.g.age >= 3 && n !== 1) bad.push(`${tag}: ${id} 줄 ${n}개`);
      }
      const byId = {};
      for (const x of h) if (x.eventId) byId[x.eventId] = (byId[x.eventId] ?? 0) + 1;
      const dup = Object.entries(byId).filter(([, n]) => n > 1).map(([id]) => id);
      if (dup.length) bad.push(`${tag}: 중복 이벤트 줄 ${dup}`);
      const mono = h.every((x, i) => i === 0 || x.age >= h[i - 1].age);
      if (!mono) bad.push(`${tag}: 연표 나이가 거꾸로`);
      notes.push(`${tag}: ${r.g.age}세까지 ${h.length}줄(선택 ${h.filter((x) => x.kind === 'choice').length}), 다음 결정으로 ${r.skips}번`);
      shots.push(r.shot);
    }
  }
  return { verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `6판 모두 정상. ${notes.join(' | ')}`, shots: shots.slice(0, 3) };
});
await browser.close();
