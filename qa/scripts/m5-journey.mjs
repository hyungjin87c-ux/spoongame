// QA-003 M5 정상 플로우: prod 번들에서 한 세상의 전 과정(첫 화면 → 룰렛 → 출생신고 → 대시보드 0세~사망 → 엔딩 → 다시 태어나기)을 사람처럼 돈다(8배속).
// 20세 전환 때 자산 카드가 나타나는지, 시대별 「지금 가치로 환산」 태그·도움말 문장, 엔딩 「최종 순자산」 줄, 선택지 영향 줄을 기록한다.
// 사용: node qa/scripts/m5-journey.mjs <era> <seed> [vp: m360|d1280] [mode: manual|auto]
// 결과: qa/results/m5/samples-journey-<tag>.jsonl, journey-<tag>.json, 스크린샷 M5-N0x-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, readBirth, shot, sleep, runCase, con, OUT, PROD, TOUCH, VP, waitGuard, READ_DASH_M5, parseMan, readRaw, GAME_KEY } from './m5-lib.mjs';

const era = process.argv[2] || 'present';
const seed = Number(process.argv[3] || 229);
const vpName = process.argv[4] || 'm360';
const mode = process.argv[5] || 'manual';
const tag = `${mode}-${era}-${seed}-${vpName}`;
const sampleFile = path.join(OUT, `samples-journey-${tag}.jsonl`);
fs.writeFileSync(sampleFile, '');

const browser = await launch();
const ctx = await mkctx(browser, vpName === 'm360' ? { viewport: VP.m360, ...TOUCH } : { viewport: VP.d1280 });
await cleanStorageOnce(ctx);
await fixSeed(ctx, seed);
const p = await ctx.newPage();
await p.addInitScript(`window.__readDash = ${READ_DASH_M5.toString()};`);
const read = () => p.evaluate(() => window.__readDash());

const summary = { era, seed, vpName, mode, errors: [], shots: [], ageSeries: [], decisions: [], flags: {} };
const ID = `N01-${mode}-${era}`;

await openTitle(p, PROD);
await toRoulette(p, era);
await skipToBirth(p);
summary.birth = await readBirth(p);
await birthToLife(p);
await sleep(150);
await waitGuard(p, 'pause');
if (mode === 'auto') await p.locator('[data-testid="auto"]').click();
await p.locator('[data-speed="8"]').click();

let pickN = 0;
let shotYoungChoice = false;
let shotAdultChoice = false;
let shot20 = false;
let helpDone = false;
let lastAge = -1;
let saw19 = null;
let saw20 = null;
const t0 = Date.now();
const seenDecisionKeys = new Set();

for (;;) {
  const s = await read();
  if (s.screen === 'ending-screen') break;
  if (s.screen !== 'life-screen') {
    summary.errors.push(`뜻밖의 화면 ${s.screen} age ${lastAge}`);
    break;
  }
  if (Date.now() - t0 > 240000) {
    summary.errors.push('시간 초과');
    break;
  }
  if (s.age !== lastAge) {
    lastAge = s.age;
    fs.appendFileSync(sampleFile, JSON.stringify({ age: s.age, stats: s.stats, assets: s.assets, note: s.assetsNote, basis: s.assetsBasis }) + '\n');
    summary.ageSeries.push({ age: s.age, assets: s.assets, hasCard: s.assets !== null });
    if (s.age === 19) saw19 = { note: s.assetsNote, assets: s.assets, basis: s.assetsBasis };
    if (s.age === 20 && !saw20) saw20 = { note: s.assetsNote, assets: s.assets, basis: s.assetsBasis, at: Date.now() - t0 };
  }
  // 20세 전환: 자산 카드가 나타난 모습
  if (s.age >= 20 && s.assets !== null && !shot20) {
    shot20 = true;
    await p.locator('[data-testid="assets-card"]').scrollIntoViewIfNeeded().catch(() => {});
    summary.shots.push(await shot(p, `N03-${era}`, `assets-card-age${s.age}-${vpName}`));
    // 도움말 펼침
    const det = p.locator('details', { has: p.locator('summary', { hasText: '상태와 자산의 뜻 보기' }) });
    if (await det.count()) {
      await det.locator('summary').click().catch(() => {});
      await sleep(150);
      summary.help = await det.first().evaluate((d) => ({ summary: d.querySelector('summary').textContent.trim(), body: d.textContent.replace(/\s+/g, ' ').trim(), open: d.open }));
      summary.shots.push(await shot(p, `N04-${era}`, `help-open-${vpName}`));
      helpDone = true;
      await det.locator('summary').click().catch(() => {});
    }
  }
  if (s.choices.length) {
    if (mode === 'auto') {
      // 자동 모드: 카드가 잠깐 떠 있는 동안의 영향 줄을 기록만 한다
      if (!seenDecisionKeys.has(s.choiceKey)) {
        seenDecisionKeys.add(s.choiceKey);
        summary.decisions.push({ age: s.age, title: s.choiceTitle, choices: s.choices.map((c) => ({ id: c.id, impact: c.impact.map((i) => i.shown) })), hint: s.hint });
      }
      await sleep(30);
      continue;
    }
    if (!seenDecisionKeys.has(s.choiceKey)) {
      seenDecisionKeys.add(s.choiceKey);
      if (!shotYoungChoice && s.assets === null && s.choices.some((c) => c.impact.length)) {
        shotYoungChoice = true;
        summary.shots.push(await shot(p, `N01-${era}`, `choice-young-${vpName}`));
        summary.shots.push(await shot(p, `N01-${era}`, `choice-young-full-${vpName}`, { full: true }));
      }
      if (!shotAdultChoice && s.assets !== null && s.choices.some((c) => c.impact.length >= 3)) {
        shotAdultChoice = true;
        summary.shots.push(await shot(p, `N01-${era}`, `choice-adult-${vpName}`));
        summary.shots.push(await shot(p, `N01-${era}`, `choice-adult-full-${vpName}`, { full: true }));
      }
    }
    await p.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 4000 }).catch(() => {});
    const idx = (pickN * 2 + s.age) % s.choices.length;
    pickN++;
    const pre = await read();
    summary.decisions.push({ age: s.age, title: s.choiceTitle, picked: s.choices[idx].id, choices: s.choices.map((c) => ({ id: c.id, impact: c.impact.map((i) => i.shown) })), hint: s.hint, assetsBefore: s.assets, statsBefore: s.stats });
    await p.locator(`[data-testid="choice-${s.choices[idx].id}"]`).click({ timeout: 3000 }).catch((e) => summary.errors.push(`선택 실패 ${s.age}: ${String(e.message).slice(0, 60)}`));
    await sleep(60);
    continue;
  }
  await sleep(40);
}

// ---------- 엔딩 ----------
await sleep(300);
const end = await p.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const tx = (e) => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  const fn = q('[data-testid="final-net"]');
  return {
    finalNet: tx(fn),
    value: tx(q('[data-testid="final-net-value"]')),
    basis: tx(q('[data-testid="final-net-basis"]')),
    standing: tx(q('[data-testid="final-net-standing"]')),
    none: tx(q('[data-testid="final-net-none"]')),
    journey: tx(q('[data-testid="ending-journey"]')),
    movement: tx(q('[data-testid="ending-movement"]')),
    note: tx(q('[data-testid="ending-note"]')),
    hasWealthMeter: !!q('[data-stat="wealth"]'),
    hasOldWealthLabel: /재산\s*\d|집안 형편\s*\d/.test(document.body.innerText),
    meters: [...document.querySelectorAll('[data-stat]')].map((m) => m.getAttribute('data-stat')),
    labels: [...document.querySelectorAll('.final-net dt, .meter__label')].map((e) => tx(e)),
    timeline: [...document.querySelectorAll('[data-testid="timeline-entry"]')].map((e) => tx(e)),
    text: document.body.innerText,
  };
});
summary.end = { ...end, text: undefined, timeline: undefined, timelineN: end.timeline.length, inheritLines: end.timeline.filter((t) => /물려받았습니다/.test(t)) };
summary.shots.push(await shot(p, `N05-${era}`, `ending-top-${vpName}`));
summary.shots.push(await shot(p, `N05-${era}`, `ending-full-${vpName}`, { full: true }));
await p.locator('[data-testid="final-net"]').scrollIntoViewIfNeeded().catch(() => {});
summary.shots.push(await shot(p, `N05-${era}`, `ending-finalnet-${vpName}`));
summary.saw19 = saw19;
summary.saw20 = saw20;
summary.helpDone = helpDone;
summary.ms = Date.now() - t0;
const endSave = await readRaw(p);
summary.endSave = endSave ? { phase: JSON.parse(endSave).data.phase, assets: JSON.parse(endSave).data.assets, age: JSON.parse(endSave).data.age } : null;
// 다시 태어나기
await waitGuard(p, 'rebirth');
await p.getByTestId('rebirth').click();
await p.waitForSelector('[data-testid="title-screen"]', { timeout: 8000 }).catch(() => summary.errors.push('다시 태어나기 뒤 첫 화면 아님'));
summary.shots.push(await shot(p, `N01-${mode}-${era}`, `after-rebirth-${vpName}`));
summary.console = con.take();
summary.externalRequests = con
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
fs.writeFileSync(path.join(OUT, `journey-${tag}.json`), JSON.stringify(summary, null, 1));
console.log(JSON.stringify({ tag, ms: summary.ms, errors: summary.errors, saw19, saw20, help: summary.help?.summary, end: { value: end.value, basis: end.basis, standing: end.standing, none: end.none }, console: summary.console.length, ext: summary.externalRequests.length }, null, 1));
await browser.close();
