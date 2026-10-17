// QA-003 M3: 부모 돌봄·임종·동생 사건이 출생신고의 부모 나이·형제 순서와 맞는가 (개발 서버 ?__timescale, 8배속 자동 완주)
// 사용: node qa/scripts/m3-family.mjs <era> <startSeed> <count> [workers]
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, fixSeed, toRoulette, skipToBirth, birthToLife, lifeInfo, setSpeed, sleep, saveJson, DEV, VP, OUT } from './m3-lib.mjs';

const [era = 'present', startS = '1', countS = '100', workersS = '4'] = process.argv.slice(2);
const start = Number(startS);
const count = Number(countS);
const workers = Number(workersS);
const outFile = path.join(OUT, `family-${era}.jsonl`);
const browser = await launch();

function judge(sv) {
  const d = sv.data;
  const rep = d.birthReport;
  const bad = [];
  const evs = d.history.filter((h) => h.eventId);
  const oldest = Math.max(rep.mother.age, rep.father.age);
  const info = { seed: d.seed, birthOrder: rep.birthOrder, mother: rep.mother.age, father: rep.father.age, deathAge: d.death?.age ?? null, events: {} };
  for (const h of evs) {
    if (h.eventId === 'middle-parents-care') {
      const pa = oldest + h.age;
      info.events.care = { age: h.age, parentAge: pa };
      if (pa < 60 || pa > 100) bad.push(`부모 돌봄 사건(나이 ${h.age})에서 부모 나이 ${pa}`);
    }
    if (h.eventId === 'middle-parents-farewell') {
      const pa = oldest + h.age;
      info.events.farewell = { age: h.age, parentAge: pa };
      if (pa < 65 || pa > 100) bad.push(`부모 임종 사건(나이 ${h.age})에서 부모 나이 ${pa}`);
    }
    if (h.eventId === 'infant-new-sibling') {
      const ma = rep.mother.age + h.age;
      info.events.sibling = { age: h.age, motherAge: ma, order: rep.birthOrder };
      if (rep.birthOrder !== 1) bad.push(`동생이 생겼다 사건인데 형제 순서 ${rep.birthOrder}(첫째가 아님)`);
      if (ma > 45) bad.push(`동생이 생겼다 사건(나이 ${h.age})에서 어머니 나이 ${ma} > 45`);
    }
  }
  // 임종 뒤에 돌봄이 오거나 돌봄 후 임종 순서
  const care = info.events.care?.age;
  const fare = info.events.farewell?.age;
  if (care !== undefined && fare !== undefined && fare < care) bad.push(`임종(${fare}세)이 돌봄(${care}세)보다 먼저`);
  // 부모가 이미 사별한 플래그면 돌봄 사건이 없어야 한다
  if (d.flags.includes('parents_gone') && care !== undefined) {
    const idxGone = d.history.findIndex((h) => h.eventId === 'middle-parents-farewell');
    const idxCare = d.history.findIndex((h) => h.eventId === 'middle-parents-care');
    if (idxGone >= 0 && idxCare > idxGone) bad.push('사별 뒤에 돌봄 사건');
  }
  // 연표 첫 줄(출생신고 서술문)과 형제 순서
  const first = d.history[0];
  const ORD = ['', '첫째', '둘째', '셋째', '넷째', '다섯째 이상'];
  if (!first || !first.text.includes(`${ORD[rep.birthOrder]}입니다`)) bad.push(`연표 첫 줄 형제 순서 불일치: ${first?.text?.slice(-40)} vs ${ORD[rep.birthOrder]}`);
  return { info, bad };
}

async function play(seed) {
  const ctx = await mkctx(browser, { viewport: VP.d1280 });
  await fixSeed(ctx, seed);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 150)));
  try {
    await p.goto(DEV + '?__timescale=100');
    await p.waitForSelector('[data-testid="title-screen"]');
    await toRoulette(p, era);
    await skipToBirth(p);
    await birthToLife(p);
    await setSpeed(p, 8);
    await p.locator('[data-testid="auto"]').click();
    const t0 = Date.now();
    for (;;) {
      const i = await lifeInfo(p);
      if (i.screen === 'ending-screen') break;
      if (Date.now() - t0 > 90000) return { seed, error: 'timeout ' + JSON.stringify(i) };
      await sleep(150);
    }
    const sv = await saveJson(p);
    const r = judge(sv);
    return { seed, era, ...r, errs, hist: sv.data.history.length };
  } catch (e) {
    return { seed, error: String(e).slice(0, 200) };
  } finally {
    await ctx.close();
  }
}

fs.writeFileSync(outFile, '');
let idx = 0;
let done = 0;
const t0 = Date.now();
await Promise.all(
  Array.from({ length: workers }, async () => {
    for (;;) {
      const i = idx++;
      if (i >= count) return;
      const r = await play(start + i);
      fs.appendFileSync(outFile, JSON.stringify(r) + '\n');
      done++;
      if (r.error || r.bad?.length || r.errs?.length) console.log(`seed ${r.seed}: ${r.error ?? ''} ${r.bad?.join(' | ') ?? ''} ${r.errs?.join('|') ?? ''}`.slice(0, 300));
      if (done % 20 === 0) console.log(`... ${done}/${count} ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }),
);
await browser.close();
const rows = fs.readFileSync(outFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const n = (f) => rows.filter(f).length;
console.log(JSON.stringify({ era, games: rows.length, errors: n((r) => r.error), violations: n((r) => r.bad?.length), pageerrors: n((r) => r.errs?.length), care: n((r) => r.info?.events.care), farewell: n((r) => r.info?.events.farewell), sibling: n((r) => r.info?.events.sibling), first: n((r) => r.info?.birthOrder === 1), maxParent: Math.max(...rows.filter((r) => r.info).map((r) => Math.max(r.info.mother, r.info.father))) }));
