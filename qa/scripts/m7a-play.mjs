// QA-003 M7a 정상 플로우: prod 번들에서 한 판을 사람처럼 돈다(첫 화면 → 룰렛 → 출생신고 → 대시보드 0세~사망 → 엔딩).
// 0~7세는 느린 배속(1 또는 2)으로 지나며 인생 기록 줄·결정 카드·가족 카드를 읽어 기록하고 스크린샷을 남긴다. 8세부터는 빠르게(8배속) 끝까지.
// 사용: node qa/scripts/m7a-play.mjs <era> <seed> <tag> [slowSpeed=2] [vp=m360|d1280] [pick=rot|first|last]
// 결과: qa/results/m7a/play-<tag>.json, 스크린샷 M7a-N01-<tag>-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, readBirth, shot, sleep, con, OUT, PROD, TOUCH, VP, waitGuard, READ_DASH_M7A, readRaw } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const era = process.argv[2] || 'present';
const seed = Number(process.argv[3] || 1);
const tag = process.argv[4] || `${era}-${seed}`;
const slow = Number(process.argv[5] || 2);
const vpName = process.argv[6] || 'm360';
const pickMode = process.argv[7] || 'rot';
const ID = `N01-${tag}`;

const browser = await launch();
const ctx = await mkctx(browser, vpName === 'm360' ? { viewport: VP.m360, ...TOUCH } : { viewport: VP.d1280 });
await cleanStorageOnce(ctx);
await fixSeed(ctx, seed);
const p = await ctx.newPage();
await p.addInitScript(`window.__readDash = ${READ_DASH_M7A.toString()};`);
const read = () => p.evaluate(() => window.__readDash());

const sum = { era, seed, tag, slow, vpName, pickMode, errors: [], shots: [], years: {}, decisions: [], logSeq: [], birth: null, family: {}, ending: null };
await openTitle(p, PROD);
await toRoulette(p, era);
await skipToBirth(p);
sum.birth = await readBirth(p);
sum.birth.bodyText = undefined;
await birthToLife(p);
await sleep(150);
await waitGuard(p, 'pause');
await p.locator(`[data-speed="${slow}"]`).click();

let lastAge = -1;
let lastRows = 0;
let pickN = 0;
let fast = false;
let shots = { milestone: 0, two: 0, card: 0 };
const decisionKeys = new Set();
const t0 = Date.now();
const rowAge = (t) => {
  const m = /^(\d+)\s*세/.exec(t);
  return m ? Number(m[1]) : null;
};

for (;;) {
  const s = await read();
  if (s.screen === 'ending-screen') break;
  if (s.screen !== 'life-screen') {
    sum.errors.push(`뜻밖의 화면 ${s.screen} age ${lastAge}`);
    break;
  }
  if (Date.now() - t0 > 600000) {
    sum.errors.push('시간 초과');
    break;
  }
  if (!fast && s.age >= 8) {
    fast = true;
    await p.locator('[data-speed="8"]').click().catch(() => {});
  }
  if (s.age !== lastAge) {
    lastAge = s.age;
    sum.years[s.age] = { rows: s.logRows.slice(), family: s.family };
    if (s.age <= 8 || s.siblings.length) sum.family[s.age] = { siblings: s.siblings, text: s.family };
  }
  // 새 인생 기록 줄
  if (s.logRows.length !== lastRows) {
    const added = s.logRows.slice(lastRows);
    lastRows = s.logRows.length;
    sum.logSeq.push({ t: Date.now() - t0, age: s.age, added });
    if (s.age <= 8) {
      const ages = added.map(rowAge);
      const lastTwo = s.logRows.slice(-3);
      const sameYear = lastTwo.filter((r) => rowAge(r) === rowAge(lastTwo[lastTwo.length - 1])).length;
      if (sameYear >= 2 && shots.two < 3) {
        shots.two++;
        await sleep(200);
        sum.shots.push(await shot(p, ID, `two-lines-${shots.two}-age${rowAge(lastTwo[lastTwo.length - 1])}`));
      } else if (added.some((r) => /첫 예방접종|첫 걸음마|첫 말/.test(r)) && shots.milestone < 4) {
        shots.milestone++;
        await sleep(200);
        sum.shots.push(await shot(p, ID, `milestone-${shots.milestone}-age${s.age}`));
      }
    }
  }
  if (s.choices.length) {
    if (!decisionKeys.has(s.choiceKey)) {
      decisionKeys.add(s.choiceKey);
      await p.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 5000 }).catch(() => {});
      const fresh = await read();
      const idxPick = pickMode === 'first' ? 0 : pickMode === 'last' ? fresh.choices.length - 1 : (pickN + fresh.age) % fresh.choices.length;
      pickN++;
      sum.decisions.push({ age: fresh.age, key: fresh.choiceKey, title: fresh.choiceTitle, text: fresh.choiceText, choices: fresh.choices, hint: fresh.hint, picked: fresh.choices[idxPick].id, rowsBefore: fresh.logRows.slice(-3) });
      if (fresh.age <= 8 && shots.card < 6) {
        shots.card++;
        sum.shots.push(await shot(p, ID, `card-${shots.card}-${(fresh.choiceKey || '').replace(/[^a-z0-9@-]/gi, '_')}`));
      }
      await p.locator(`[data-testid="choice-${fresh.choices[idxPick].id}"]`).click({ timeout: 4000 }).catch((e) => sum.errors.push(`선택 실패 ${fresh.age}: ${String(e.message).slice(0, 60)}`));
      await sleep(80);
      // 선택 뒤 인생 기록 한 줄이 어떻게 붙었는지
      const after = await read();
      sum.decisions[sum.decisions.length - 1].rowsAfter = after.logRows.slice(-3);
      continue;
    }
    await sleep(40);
    continue;
  }
  await sleep(40);
}

// ---------- 엔딩 ----------
await sleep(400);
const end = await p.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  return {
    journey: tx(q('[data-testid="ending-journey"]')),
    timeline: [...document.querySelectorAll('[data-testid="timeline-entry"]')].map((e) => ({ kind: e.getAttribute('data-kind'), text: tx(e) })),
    text: document.body.innerText,
  };
});
sum.ending = end;
const raw = await readRaw(p);
try {
  const g = JSON.parse(raw).data;
  sum.final = { age: g.age, flags: g.flags, seen: g.seen, historyLen: g.history.length, history: g.history, death: g.death, tier: g.character.parentWealth, parenting: g.character.parenting, birthOrder: g.birthReport.birthOrder };
} catch (e) {
  sum.errors.push('저장 읽기 실패');
}
await p.locator('[data-testid="ending-timeline"]').scrollIntoViewIfNeeded().catch(() => {});
await sleep(150);
sum.shots.push(await shot(p, ID, 'ending-timeline'));
sum.shots.push(await shot(p, ID, 'ending-full', { full: true }));
sum.console = con.take();
sum.externalRequests = con
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
sum.ms = Date.now() - t0;
fs.writeFileSync(path.join(OUT, RP + `play-${tag}.json`), JSON.stringify(sum, null, 1));
console.log(`${tag}: 사망 ${sum.final?.age}세, 결정 ${sum.decisions.length}, 오류 ${sum.errors.length}, 콘솔 ${sum.console.length}, 외부요청 ${sum.externalRequests.length}, ${Math.round(sum.ms / 1000)}초`);
await browser.close();
