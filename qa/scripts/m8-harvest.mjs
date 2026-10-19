// QA-003 M8 항목 5 — 판 수·시간 분포 표본(모델 확인): 개발 서버의 core(오라클)로 세 세상 × 두 전략 × N판을 끝까지 돌려
//  판당 결정 카드 수 분포(평균·분위·하드 상한 근접·초과), 노년(65세 이상)·영유아(0~7세) 선택지 수, 연출 해 수(조용·서술·결과·둘째 줄), 모델 판 시간(읽기 낮음·중앙·높음, 8배속 자동, 8배속+다음 결정으로)을 구한다.
// 모델 상수는 이 스크립트가 timingTable.ts와 별개로 직접 적었다(독립 계산): 연출 계수 1.2 × (7·17·13초) + 둘째 줄 6초, 읽기 r = 글자 106.1자 ÷ 분당 600자 + 고르기 10초 + 인용 노출률 × 10초.
// 사용: node qa/scripts/m8-harvest.mjs [N=1000]   결과: qa/results/m8/harvest.json
import { launch, openOracle, evalCore, writeJson, runCase } from './m8-lib.mjs';

const N = Number(process.argv[2] || 1000);
const browser = await launch();
const { page: oracle } = await openOracle(browser);

const BODY = `
  const K = arg.k, QUIET = 7000 * K, NARR = 17000 * K, RES = 13000 * K, LINE = 5000 * K;
  const out = { era: arg.era, strategy: arg.strategy, lives: arg.n, cards: [], senior: [], infant: [], deathAge: [], q: [], n: [], r: [], extra: [], holdMs: [], errors: 0, firstSeed: arg.seed0 };
  let rng = arg.seed0 >>> 0;
  const rnd = () => { rng = (rng + 0x6d2b79f5) >>> 0; let t = rng; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let i = 0; i < arg.n; i++) {
    try {
      let s = core.enterLife(core.enterBirth(core.beginBirth(core.createInitialState(arg.seed0 + i), arg.era)));
      let q = 0, n = 0, r = 0, extra = 0;
      const tally = (tick) => {
        if (tick.kind === 'quiet' || tick.kind === 'none') q++;
        else if (tick.kind === 'narrative') { n++; extra += Math.max(0, (tick.lines || 1) - 1); }
        else if (tick.kind === 'resolved') { r++; extra += Math.max(0, (tick.lines || 1) - 1); }
      };
      for (let g = 0; g < 4000 && s.phase === 'life'; g++) {
        let res;
        if (s.pending !== null) {
          if (arg.strategy === 'auto') res = core.autoResolveStep(s, s.pending.key);
          else { const ids = s.pending.choiceIds; res = core.resolveChoiceStep(s, s.pending.key, ids[Math.floor(rnd() * ids.length)]); }
        } else {
          const due = core.dueNote(s);
          if (due !== null) s = core.consumeNote(s, due);
          res = core.stepYear(s);
        }
        s = res.state;
        tally(res.tick);
      }
      const ch = s.history.filter((h) => h.kind === 'choice');
      out.cards.push(ch.length);
      out.senior.push(ch.filter((h) => h.age >= 65).length);
      out.infant.push(ch.filter((h) => h.age <= 7).length);
      out.deathAge.push(s.death ? s.death.age : -1);
      out.q.push(q); out.n.push(n); out.r.push(r); out.extra.push(extra);
      out.holdMs.push(q * QUIET + n * NARR + r * RES + extra * LINE);
    } catch (e) { out.errors++; out.lastError = String(e && e.message ? e.message : e).slice(0, 200); }
  }
  return out;
`;

const eras = ['past', 'present', 'future'];
const results = [];
for (const era of eras) {
  for (const strategy of ['random', 'auto']) {
    const t0 = Date.now();
    const r = await evalCore(oracle, BODY, { k: Number(process.env.M8_K || 1.2), era, strategy, n: N, seed0: (process.env.M8_SEED_OFFSET ? Number(process.env.M8_SEED_OFFSET) : 0) + 50000 + (era === 'past' ? 0 : era === 'present' ? 100000 : 200000) + (strategy === 'auto' ? 500000 : 0) });
    r.ms = Date.now() - t0;
    results.push(r);
    console.log(`${era}/${strategy}: ${r.ms}ms 오류 ${r.errors}`);
  }
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const pct = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]; };
// 읽기 r (초): 106.1자 = 제목 8.1 + 본문 52 + 라벨 2.7×12.4 + 영향 줄 2.7×9.3×0.5
const CHARS = 8.1 + 52 + 2.7 * 12.4 + 2.7 * 9.3 * 0.5;
const EXPO = { past: 0.1, present: 0.51, future: 0.47 };
const rSec = (era, lv) => {
  const cpm = { low: 700, median: 600, high: 500 }[lv];
  const choose = { low: 5, median: 10, high: 15 }[lv];
  const cite = { low: 7, median: 10, high: 13 }[lv];
  return (CHARS / cpm) * 60 + choose + EXPO[era] * cite;
};
const summary = [];
for (const r of results) {
  const c = r.cards;
  const rm = rSec(r.era, 'median');
  const tManual = c.map((x, i) => r.holdMs[i] / 60000 + (x * rm) / 60);
  const tLow = c.map((x, i) => r.holdMs[i] / 60000 + (x * rSec(r.era, 'low')) / 60);
  const tHigh = c.map((x, i) => r.holdMs[i] / 60000 + (x * rSec(r.era, 'high')) / 60);
  const t8auto = c.map((x, i) => r.holdMs[i] / 8 / 60000 + (x * 3 / 8) / 60);
  const t8skip = c.map((x) => (x * rm + (x + 1) * 1) / 60);
  const t1auto = c.map((x, i) => r.holdMs[i] / 60000 + (x * 3) / 60);
  summary.push({
    era: r.era, strategy: r.strategy, lives: c.length, errors: r.errors,
    cards: { mean: +mean(c).toFixed(2), sd: +sd(c).toFixed(2), se: +(sd(c) / Math.sqrt(c.length)).toFixed(3), p5: pct(c, 0.05), p50: pct(c, 0.5), p95: pct(c, 0.95), max: Math.max(...c), min: Math.min(...c), over30: c.filter((x) => x > 30).length, ge29: +(c.filter((x) => x >= 29).length / c.length * 100).toFixed(2), lt20_ofDeath70: +(c.filter((x, i) => r.deathAge[i] >= 70 && x < 20).length / Math.max(1, c.filter((x, i) => r.deathAge[i] >= 70).length) * 100).toFixed(2) },
    senior: { mean: +mean(r.senior).toFixed(2), p5: pct(r.senior, 0.05), p95: pct(r.senior, 0.95), max: Math.max(...r.senior) },
    infant: { mean: +mean(r.infant).toFixed(2), min: Math.min(...r.infant), max: Math.max(...r.infant) },
    deathAge: { mean: +mean(r.deathAge).toFixed(1), p5: pct(r.deathAge, 0.05), p95: pct(r.deathAge, 0.95) },
    years: { quiet: +mean(r.q).toFixed(1), narrative: +mean(r.n).toFixed(1), resolved: +mean(r.r).toFixed(1), extraLines: +mean(r.extra).toFixed(2) },
    holdMin: +(mean(r.holdMs) / 60000).toFixed(2),
    readSec: { low: +rSec(r.era, 'low').toFixed(1), median: +rm.toFixed(1), high: +rSec(r.era, 'high').toFixed(1) },
    time: {
      manual1x_median: { mean: +mean(tManual).toFixed(2), p5: +pct(tManual, 0.05).toFixed(1), p95: +pct(tManual, 0.95).toFixed(1), max: +Math.max(...tManual).toFixed(1) },
      manual1x_low: +mean(tLow).toFixed(2),
      manual1x_high: +mean(tHigh).toFixed(2),
      auto1x: +mean(t1auto).toFixed(2),
      auto8x: { mean: +mean(t8auto).toFixed(2), p5: +pct(t8auto, 0.05).toFixed(2), p95: +pct(t8auto, 0.95).toFixed(2) },
      skip8x_ref: +mean(t8skip).toFixed(2),
    },
  });
}
const TAG = process.env.M8_HARVEST_TAG || '';
writeJson(`harvest${TAG ? '-' + TAG : ''}.json`, { N, summary });
console.log(JSON.stringify(summary.map((s) => ({ era: s.era, st: s.strategy, cards: s.cards, senior: s.senior.mean, infant: s.infant.mean, hold: s.holdMin, t: s.time.manual1x_median.mean, auto8: s.time.auto8x.mean })), null, 0));

// 판정(참고): 23.5~29, 하드(30) 초과 0, 하드−1 이상 ≤ 10%, 노년 ≥ 3.97/4.72/5.03, 영유아 ≥ 2.8, 세 시대 평균 27~33분·시대별 25.5~34.5분
const SENIOR_MIN = { past: 3.97, present: 4.72, future: 5.03 };
for (const s of summary) {
  const ok = s.errors === 0 && s.cards.mean >= 23.5 && s.cards.mean <= 29 && s.cards.over30 === 0 && s.cards.ge29 <= 10 && s.senior.mean >= SENIOR_MIN[s.era] && s.infant.mean >= 2.8 && s.time.manual1x_median.mean >= 25.5 && s.time.manual1x_median.mean <= 34.5;
  await runCase({ id: `H${TAG ? '-' + TAG : ''}-${s.era}-${s.strategy}`, title: `표본 ${s.lives}판 (${s.era}, ${s.strategy}): 카드 수·노년·영유아·모델 시간이 판정 구간 안` }, async () => ({
    verdict: ok ? 'PASS' : 'FAIL',
    actual: `카드 평균 ${s.cards.mean}(se ${s.cards.se}) 분위 ${s.cards.p5}/${s.cards.p50}/${s.cards.p95} 최대 ${s.cards.max} 초과(>30) ${s.cards.over30} 29이상 ${s.cards.ge29}% · 노년 ${s.senior.mean} · 영유아 ${s.infant.mean} · 사망 나이 ${s.deathAge.mean} · 1배속 수동 ${s.time.manual1x_median.mean}분(낮음 ${s.time.manual1x_low} 높음 ${s.time.manual1x_high}) · 8배속 자동 ${s.time.auto8x.mean}분 · 1배속 자동 ${s.time.auto1x}분`,
    shots: [],
  }));
}
await browser.close();
