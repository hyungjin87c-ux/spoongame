// QA-003 M7e 정상 플로우: prod 번들에서 한 판을 사람처럼 돈다(첫 화면 → 룰렛 → 출생신고 → 대시보드 0세~사망 → 엔딩).
// 배속 계획(speedPlan)대로 구간마다 1·2·4·8배속을 바꿔 가며, 결정 카드·인생 기록 줄·또래 칸·자산 카드·도움말을 읽어 기록하고 스크린샷을 남긴다. 끝나면 엔딩 새 화면을 글자 기대값(m7e-ending-lib)으로 판정한다.
// 사용: node qa/scripts/m7e-play.mjs <era> <seed> <tag> [speedPlan 예 0-6:2,7-39:2,40-99:8] [vp=m360|d1280] [pick=rot|first|last]
// 결과: qa/results/m7e/play-<tag>.json, samples-harvest-<era>-p<tag>.jsonl(분석기 입력과 같은 꼴), 스크린샷 M7e-N01-<tag>-*
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, cleanStorageOnce, openTitle, toRoulette, skipToBirth, birthToLife, readBirth, shot, sleep, con, OUT, PROD, TOUCH, VP, waitGuard, READ_DASH_M7E, readRaw } from './m7e-lib.mjs';
import { READ, judge } from './m7e-ending-lib.mjs';

const era = process.argv[2] || 'present';
const seed = Number(process.argv[3] || 1);
const tag = process.argv[4] || `${era}-${seed}`;
const plan = (process.argv[5] || '0-6:2,7-99:2').split(',').map((s) => {
  const [r, sp] = s.split(':');
  const [a, b] = r.split('-').map(Number);
  return { a, b, sp: Number(sp) };
});
const vpName = process.argv[6] || 'm360';
const pickMode = process.argv[7] || 'rot';
const ID = `N01-${tag}`;
const speedFor = (age) => (plan.find((x) => age >= x.a && age <= x.b) ?? plan[plan.length - 1]).sp;

const browser = await launch();
const ctx = await mkctx(browser, vpName === 'm360' ? { viewport: VP.m360, ...TOUCH } : { viewport: VP.d1280 });
await cleanStorageOnce(ctx);
await fixSeed(ctx, seed);
const p = await ctx.newPage();
await p.addInitScript(`window.__readDash = ${READ_DASH_M7E.toString()};`);
await p.addInitScript(() => {
  window.__snaps = [];
  const orig = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) {
    if (k === 'suzeo-game:save') {
      try {
        const d = JSON.parse(v).data;
        const sn = { age: d.age, ph: d.phase, fl: d.flags, dw: d.assets ? d.assets.dwelling : null, net: d.assets ? d.assets.net : null, pe: d.pending ? d.pending.key : null, hl: d.history.length };
        const sig = [sn.age, sn.ph, sn.fl.join(','), sn.dw, sn.pe, sn.hl].join('|');
        const last = window.__snaps[window.__snaps.length - 1];
        if (!last || last.sig !== sig) {
          sn.sig = sig;
          window.__snaps.push(sn);
        }
      } catch {}
    }
    return orig.apply(this, arguments);
  };
});
const read = () => p.evaluate(() => window.__readDash());

const sum = { era, seed, tag, plan, vpName, pickMode, errors: [], shots: [], decisions: [], logSeq: [], birth: null, ending: null, helps: {}, peersByAge: {}, assetsByAge: {} };
await openTitle(p, PROD);
await toRoulette(p, era);
await skipToBirth(p);
sum.birth = await readBirth(p);
sum.birth.bodyText = undefined;
await shot(p, ID, 'birth');
await birthToLife(p);
await sleep(150);
await waitGuard(p, 'pause');

let curSpeed = null;
const setSpeed = async (sp) => {
  if (curSpeed === sp) return;
  await p.locator(`[data-speed="${sp}"]`).click({ timeout: 3000 }).catch(() => {});
  curSpeed = sp;
};
let lastAge = -1;
let lastRows = 0;
let pickN = 0;
const decisionKeys = new Set();
const stageShots = { school: 0, youth: 0, middle: 0, senior: 0, infant: 0 };
const stageOf = (a) => (a <= 6 ? 'infant' : a <= 19 ? 'school' : a <= 39 ? 'youth' : a <= 64 ? 'middle' : 'senior');
const t0 = Date.now();
for (;;) {
  const s = await read();
  if (s.screen === 'ending-screen') break;
  if (s.screen !== 'life-screen') {
    sum.errors.push(`뜻밖의 화면 ${s.screen} age ${lastAge}`);
    break;
  }
  if (Date.now() - t0 > 1500000) {
    sum.errors.push('시간 초과');
    break;
  }
  await setSpeed(speedFor(s.age ?? 0));
  if (s.age !== lastAge) {
    lastAge = s.age;
    sum.peersByAge[s.age] = s.peersNow;
    if (s.assetsCard) sum.assetsByAge[s.age] = s.assetsCard;
    if (s.age === 8 || s.age === 20 || s.age === 45 || s.age === 70) {
      // 도움말·상태 카드: 접이식이라 글자는 열지 않아도 DOM에 있다
      sum.helps[s.age] = await p.evaluate(() => {
        const d = document.querySelector('details');
        return d ? { summary: d.querySelector('summary')?.textContent.trim(), text: d.textContent.replace(/\s+/g, ' ').trim() } : null;
      });
    }
  }
  if (s.logRows.length !== lastRows) {
    sum.logSeq.push({ t: Date.now() - t0, age: s.age, added: s.logRows.slice(lastRows) });
    lastRows = s.logRows.length;
  }
  if (s.choices.length) {
    if (!decisionKeys.has(s.choiceKey)) {
      decisionKeys.add(s.choiceKey);
      await p.waitForFunction(() => [...document.querySelectorAll('[data-testid="choice-panel"] .choice')].every((b) => b.getAttribute('aria-disabled') !== 'true'), null, { timeout: 6000 }).catch(() => {});
      const fresh = await read();
      const shareIdx = fresh.choices.findIndex((c) => c.id === 'share');
      const idx = pickMode === 'share' && shareIdx >= 0 ? shareIdx : pickMode === 'first' ? 0 : pickMode === 'last' ? fresh.choices.length - 1 : pickMode === 'mix' ? (seed * 7 + pickN * 5 + fresh.age) % fresh.choices.length : (pickN + fresh.age) % fresh.choices.length;
      pickN++;
      const st = stageOf(fresh.age);
      sum.decisions.push({ age: fresh.age, key: fresh.choiceKey, title: fresh.choiceTitle, text: fresh.choiceText, choices: fresh.choices, hint: fresh.hint, assetsCard: fresh.assetsCard, peersNow: fresh.peersNow, family: fresh.family, siblings: fresh.siblings, picked: fresh.choices[idx].id });
      if (stageShots[st] < 2 && fresh.age >= 7) {
        stageShots[st]++;
        sum.shots.push(await shot(p, ID, `card-${st}-${stageShots[st]}-age${fresh.age}`));
      }
      const isFarewell = /^middle-parents-farewell/.test(fresh.choiceKey);
      if (isFarewell) sum.shots.push(await shot(p, ID, `farewell-card-age${fresh.age}`));
      await p.locator(`[data-testid="choice-${fresh.choices[idx].id}"]`).click({ timeout: 4000 }).catch((e) => sum.errors.push(`선택 실패 ${fresh.age}: ${String(e.message).slice(0, 60)}`));
      await sleep(80);
      const after = await read();
      sum.decisions[sum.decisions.length - 1].rowsAfter = after.logRows.slice(-2);
      if (isFarewell) { await p.evaluate(() => { const rows = [...document.querySelectorAll('[data-testid="log-row"]')]; const row = rows.reverse().find((r) => /(장례를 치렀습니다|곁을 지켰습니다|늦게 도착했습니다)/.test(r.textContent)); if (row) row.scrollIntoView({ block: 'center', behavior: 'instant' }); }); await sleep(250); sum.shots.push(await shot(p, ID, `farewell-after-age${fresh.age}`)); }
      continue;
    }
    await sleep(40);
    continue;
  }
  await sleep(40);
}

// ---------- 엔딩 ----------
await sleep(500);
const d = await p.evaluate(READ);
const raw = await readRaw(p);
let g = null;
try {
  g = JSON.parse(raw).data;
} catch {
  sum.errors.push('저장 읽기 실패');
}
const tier = g ? g.character.parentWealth : null;
const j = judge(`ending-${era}-play`, { [`ending-${era}-play`]: { era, tier, variant: 'natural' } }, d);
sum.ending = { ...j, d: { era: d.era, span: d.span, death: d.death, choices: d.choices, journey: d.journey, movement: d.movement, legend: d.legend, label: d.bar?.label, finalNet: d.finalNet, looks: d.finalLooks }, finalNetValue: d.finalNetValue };
sum.final = g && { age: g.age, tier, net: g.assets ? g.assets.net : null, flags: g.flags, order: g.birthReport.birthOrder, death: g.death };
await p.evaluate(() => window.scrollTo(0, 0));
await sleep(150);
sum.shots.push(await shot(p, ID, 'ending-top'));
await p.evaluate(() => document.querySelector('[data-testid="ending-journey-section"]').scrollIntoView({ block: 'start', behavior: 'instant' }));
await sleep(200);
sum.shots.push(await shot(p, ID, 'ending-journey'));
await p.evaluate(() => document.querySelector('[data-testid="ending-stats"]').scrollIntoView({ block: 'start', behavior: 'instant' }));
await sleep(200);
sum.shots.push(await shot(p, ID, 'ending-stats'));
await p.evaluate(() => document.querySelector('[data-testid="ending-timeline"]').scrollIntoView({ block: 'start', behavior: 'instant' }));
await sleep(200);
sum.shots.push(await shot(p, ID, 'ending-timeline'));
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
const snaps = await p.evaluate(() => window.__snaps ?? []);
fs.writeFileSync(path.join(OUT, `play-${tag}.json`), JSON.stringify(sum, null, 1));
fs.appendFileSync(path.join(OUT, `samples-harvest-${era}-p${/\d+$/.exec(tag)?.[0] ?? '0'}.jsonl`), JSON.stringify({ era, seed, pickMode, source: 'play', errors: sum.errors, decisions: sum.decisions, snaps, final: g, endingText: d.timeline ? await p.evaluate(() => document.body.innerText) : null }) + '\n');
console.log(`${tag}: 사망 ${g?.age}세 재력 ${tier}, 결정 ${sum.decisions.length}, 엔딩 판정 ${j.f.length ? 'FAIL ' + j.f.join(' / ') : 'ok'}, 오류 ${sum.errors.length}, 콘솔 ${sum.console.length}, 외부요청 ${sum.externalRequests.length}, ${Math.round(sum.ms / 1000)}초`);
await browser.close();
