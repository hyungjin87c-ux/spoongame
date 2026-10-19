// QA-003 M8 Q1 보충: 한 판을 끝까지 돌리지 않고, 새 판의 0세·1세 연출 대기를 종류별로 5회씩 실측한다(배포 번들, 시간 배율 없음, 360×740, 1배속).
// 0세→1세 걸음(오라클의 stepYear)의 종류·줄 수를 먼저 찾아 그 시드로 새 판을 시작한다 → 나이 0 구간 = 조용한 해(복원·시작 직후 tick 없음 8.4초), 나이 1 구간 = 그 걸음의 종류.
//  Q 조용한 해(1세 걸음이 조용) · N1 서술 1줄 · N2 서술 2줄 · N3 서술 3줄(1세 세 줄 해 32.4초). 결과 해(선택 뒤)는 완주 판에서 수백 번 잰다.
// 사용: node qa/scripts/m8-first-year.mjs [표본 수=5] [배속=1]   결과: qa/results/m8/first-year.json
import { launch, openOracle, evalCore, freshCtx, PROD, toRoulette, skipToBirth, birthToLife, sleep, writeJson, runCase, holdModel, MODEL } from './m8-lib.mjs';

const PER = Number(process.argv[2] || 5);
const SPEED = Number(process.argv[3] || 1);

const finder = await launch();
const { page: oracle } = await openOracle(finder);
// 시대별로 번갈아 종류마다 PER개 시드를 찾는다
const found = await evalCore(
  oracle,
  `const want = { Q: [], N1: [], N2: [], N3: [] };
   const eras = ['past', 'present', 'future'];
   for (let seed = 1; seed < 8000; seed++) {
     const era = eras[seed % 3];
     let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(seed), era)));
     const holds = [];
     for (let step = 0; step < 4; step++) {
       const due = core.dueNote(s);
       if (due !== null) s = core.consumeNote(s, due);
       const r = core.stepYear(s);
       if (r.tick.kind === 'choice' || r.tick.kind === 'death') break;
       const key = r.tick.kind === 'quiet' ? 'Q' : r.tick.lines >= 3 ? 'N3' : r.tick.lines === 2 ? 'N2' : 'N1';
       if (want[key].length < arg.per) want[key].push({ seed, era, step, kind: r.tick.kind, lines: r.tick.lines ?? 0, before: holds.slice() });
       holds.push({ kind: r.tick.kind, lines: r.tick.lines ?? 0 });
       s = r.state;
     }
     if (Object.values(want).every((a) => a.length >= arg.per)) break;
   }
   return want;`,
  { per: PER },
);
await finder.close();
writeJson('first-year-seeds.json', found);

const results = [];
async function one(tag, cfg) {
  const browser = await launch();
  const ctx = await freshCtx(browser, { seed: cfg.seed, settings: { era: cfg.era, speed: SPEED, autoMode: false, noteCards: false } });
  const page = await ctx.newPage();
  await page.goto(PROD, { waitUntil: 'load' });
  await page.waitForSelector('[data-testid="title-screen"]');
  await toRoulette(page, cfg.era);
  await skipToBirth(page);
  await birthToLife(page);
  // 목표 걸음 step(0부터): 나이 step+1이 처음 보이는 순간부터 다음 나이까지가 그 걸음의 연출 대기. 앞의 걸음들의 대기를 모델로 더해 기다린다.
  const need = (MODEL.short30.quiet + cfg.before.reduce((sum, h) => sum + holdModel('short30', h.kind === 'quiet' ? 'quiet' : 'narrative', h.lines), 0) + holdModel('short30', cfg.kind === 'quiet' ? 'quiet' : 'narrative', Math.max(1, cfg.lines))) / SPEED + 4000;
  await sleep(need);
  const ev = await page.evaluate(() => window.__ev.filter((e) => e.k === 'age' || e.k === 'card'));
  await browser.close();
  const ages = ev.filter((e) => e.k === 'age');
  const a0 = ages.find((a) => a.age === cfg.step + 1);
  const a1 = ages.find((a) => a.age === cfg.step + 2);
  const aq = ages.find((a) => a.age === 0);
  const cardAfter = a0 ? ev.find((e) => e.k === 'card' && e.t > a0.t) : null;
  const g1 = a0 && a1 ? a1.t - a0.t : a0 && cardAfter ? cardAfter.t - a0.t : null; // 다음 걸음이 결정 카드면 카드가 뜬 순간이 대기의 끝
  const g0 = ages.length >= 2 && ages[1].age === 1 && aq ? ages[1].t - aq.t : null;
  const card2 = ev.find((e) => e.k === 'card');
  return { tag, ...cfg, g0, g1, ages: ages.map((a) => a.age), card: !!card2 };
}

for (const key of ['Q', 'N1', 'N2', 'N3']) {
  const list = found[key];
  const batch = await Promise.all(list.map((c, i) => one(`${key}-${i}`, c)));
  results.push(...batch.map((b) => ({ key, ...b })));
  console.log(key, batch.map((b) => `${b.seed}:${b.g0 && Math.round(b.g0)}/${b.g1 && Math.round(b.g1)}`).join(' '));
}
writeJson('first-year.json', results);

const stat = (a) => ({ n: a.length, mean: Math.round(a.reduce((x, y) => x + y, 0) / a.length), min: Math.round(Math.min(...a)), max: Math.round(Math.max(...a)) });
const summary = {};
const q0 = results.map((r) => r.g0).filter((x) => x !== null);
summary[`age0-quiet(${MODEL.short30.quiet}ms)`] = { model: MODEL.short30.quiet / SPEED, ...stat(q0) };
for (const key of ['Q', 'N1', 'N2', 'N3']) {
  const rs = results.filter((r) => r.key === key && r.g1 !== null);
  if (!rs.length) continue;
  const model = holdModel('short30', key === 'Q' ? 'quiet' : 'narrative', key === 'N1' ? 1 : key === 'N2' ? 2 : key === 'N3' ? 3 : 1) / SPEED;
  summary[key] = { model, ...stat(rs.map((r) => r.g1)), n_total: results.filter((r) => r.key === key).length };
}
writeJson('first-year-summary.json', summary);
console.log(JSON.stringify(summary));
for (const [k, v] of Object.entries(summary)) {
  await runCase({ id: `Q1-${k}-x${SPEED}`, title: `연출 대기 실측(새 판 ${k}, ${SPEED}배속, 배포 번들 실제 시계): 모델 ${Math.round(v.model)}ms` }, async () => {
    const lo = v.model * 0.98;
    const hi = v.model * 1.03 + 250;
    const ok = v.min >= lo && v.max <= hi;
    return { verdict: ok ? 'PASS' : 'FAIL', actual: `n=${v.n} 평균 ${v.mean}ms [${v.min}~${v.max}] 허용 ${Math.round(lo)}~${Math.round(hi)}`, shots: [] };
  });
}
