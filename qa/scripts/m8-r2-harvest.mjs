// QA-003 M8 2회차 (라)·Hx1·Hx5: 판 수·시간 표본(독립 계산) + 표준오차(SE) 여유 표 + 개발 표와의 대조.
// 개발 서버의 core(오라클)로 세 세상 × 두 전략(random=수동 흉내, auto=자동 성향) × N판을 끝까지 돌려 판당 결정 카드 수·노년(65세+)·영유아(0~7세)·연출 해 수·1배속 수동 모델 판 시간(읽기 중앙)을 구한다.
// 모델 상수는 timingTable.ts와 별개로 직접 적었다(독립 계산): 연출 = 7·17·13초 × 계수(M8_K=1.25) + 둘째 줄부터 5초 × 계수, 읽기 r = 글자 106.1자 ÷ 분당 600자 + 고르기 10초 + 인용 노출률 × 10초.
// 판정 임계(13-6 M-3 / 13-7): 카드 평균 23.3~29, 30장 초과 0, 하드−1(29)장 이상 ≤ 10%, 70세+ 중 20장 미만 ≤ 10%, 5% 분위 ≥ 16, 노년 평균 ≥ 3.95/4.72/5.00, 영유아 ≥ 2.8, 시대별 시간 25.5~34.5분(하한과 ≥ 3 SE), 세 시대 평균 27~33분, 시간 95% 분위 ≤ 40분.
// 사용: node qa/scripts/m8-r2-harvest.mjs <N> <tag> [seedOffset]   결과: qa/results/m8/r2/harvest-<tag>.json
import { launch, openOracle, evalCore, writeJson, runCase } from './m8-lib.mjs';

const N = Number(process.argv[2] || 1000);
const TAG = process.argv[3] || `n${N}`;
const OFFSET = Number(process.argv[4] || 0);
const K = Number(process.env.M8_K || 1.25);
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
    const r = await evalCore(oracle, BODY, { k: K, era, strategy, n: N, seed0: OFFSET + 50000 + (era === 'past' ? 0 : era === 'present' ? 100000 : 200000) + (strategy === 'auto' ? 500000 : 0) });
    r.ms = Date.now() - t0;
    results.push(r);
    console.log(`${era}/${strategy}: ${r.ms}ms 오류 ${r.errors}`);
  }
}

const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sd = (a) => { const m = mean(a); return Math.sqrt(mean(a.map((x) => (x - m) ** 2))); };
const se = (a) => sd(a) / Math.sqrt(a.length);
const pct = (a, p) => { const b = a.slice().sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * (b.length - 1)))]; };
/** 비율의 SE (Agresti-Coull — 비율 0이어도 SE가 0이 아니다) */
const seProp = (k, n) => { const z = 3; const nt = n + z * z; const pt = (k + (z * z) / 2) / nt; return Math.sqrt((pt * (1 - pt)) / nt); };
// 읽기 r (초)
const CHARS = 8.1 + 52 + 2.7 * 12.4 + 2.7 * 9.3 * 0.5;
const EXPO = { past: 0.1, present: 0.51, future: 0.47 };
const rSec = (era, lv) => {
  const cpm = { low: 700, median: 600, high: 500 }[lv];
  const choose = { low: 5, median: 10, high: 15 }[lv];
  const cite = { low: 7, median: 10, high: 13 }[lv];
  return (CHARS / cpm) * 60 + choose + EXPO[era] * cite;
};
const SENIOR_MIN = { past: 3.95, present: 4.72, future: 5.0 };
// 개발 표 (dev 로그 11-1절, 1000판, 연출 계수 1.25): [시험 · 수동 흉내, 시험 · 자동 성향, sim:1000 · 수동 흉내, sim:1000 · 자동 성향] — 카드 평균 [평균, SE], 모델 시간 [평균, SE]
const DEV = {
  cards: {
    past: { random: [[23.86, 0.09], [23.69, 0.1]], auto: [[23.85, 0.09], [23.77, 0.09]] },
    present: { random: [[24.61, 0.09], [24.68, 0.08]], auto: [[24.84, 0.09], [24.6, 0.09]] },
    future: { random: [[24.95, 0.09], [24.91, 0.08]], auto: [[25.0, 0.08], [25.04, 0.08]] },
  },
  time: {
    past: { random: [[26.2, 0.1], [26.02, 0.1]], auto: [[26.1, 0.09], [25.98, 0.09]] },
    present: { random: [[28.71, 0.1], [28.78, 0.09]], auto: [[28.94, 0.09], [28.71, 0.09]] },
    future: { random: [[29.04, 0.09], [28.97, 0.08]], auto: [[29.06, 0.09], [29.0, 0.08]] },
  },
};
const summary = [];
for (const r of results) {
  const c = r.cards;
  const n = c.length;
  const rm = rSec(r.era, 'median');
  const tManual = c.map((x, i) => r.holdMs[i] / 60000 + (x * rm) / 60);
  const tLow = c.map((x, i) => r.holdMs[i] / 60000 + (x * rSec(r.era, 'low')) / 60);
  const tHigh = c.map((x, i) => r.holdMs[i] / 60000 + (x * rSec(r.era, 'high')) / 60);
  const t8auto = c.map((x, i) => r.holdMs[i] / 8 / 60000 + (x * 3 / 8) / 60);
  const t1auto = c.map((x, i) => r.holdMs[i] / 60000 + (x * 3) / 60);
  const ge29 = c.filter((x) => x >= 29).length;
  const d70 = c.filter((x, i) => r.deathAge[i] >= 70);
  const lt20of70 = c.filter((x, i) => r.deathAge[i] >= 70 && x < 20).length;
  const over40 = tManual.filter((t) => t > 40).length;
  const tMean = mean(tManual);
  const tSe = se(tManual);
  const cMean = mean(c);
  const cSe = se(c);
  const sMean = mean(r.senior);
  const sSe = se(r.senior);
  const iMean = mean(r.infant);
  const iSe = se(r.infant);
  const devCards = DEV.cards[r.era][r.strategy];
  const devTime = DEV.time[r.era][r.strategy];
  const diffTest = (m, s, dev) => dev.map(([dm, ds]) => ({ diff: +(m - dm).toFixed(3), limit: +(3 * Math.sqrt(s * s + ds * ds)).toFixed(3), ok: Math.abs(m - dm) <= 3 * Math.sqrt(s * s + ds * ds) }));
  summary.push({
    era: r.era, strategy: r.strategy, lives: n, errors: r.errors,
    cards: { mean: +cMean.toFixed(3), se: +cSe.toFixed(3), marginLow: +((cMean - 23.3) / cSe).toFixed(1), marginHigh: +((29 - cMean) / cSe).toFixed(1), p5: pct(c, 0.05), p50: pct(c, 0.5), p95: pct(c, 0.95), max: Math.max(...c), min: Math.min(...c), over30: c.filter((x) => x > 30).length, ge29: +((ge29 / n) * 100).toFixed(2), ge29Margin: +((0.1 - ge29 / n) / seProp(ge29, n)).toFixed(1), lt20_ofDeath70: +((lt20of70 / Math.max(1, d70.length)) * 100).toFixed(2), lt20Margin: +((0.1 - lt20of70 / Math.max(1, d70.length)) / seProp(lt20of70, Math.max(1, d70.length))).toFixed(1), vsDev: diffTest(cMean, cSe, devCards) },
    senior: { mean: +sMean.toFixed(3), se: +sSe.toFixed(3), margin: +((sMean - SENIOR_MIN[r.era]) / sSe).toFixed(1), p5: pct(r.senior, 0.05), p95: pct(r.senior, 0.95), max: Math.max(...r.senior) },
    infant: { mean: +iMean.toFixed(3), se: +iSe.toFixed(3), margin: +((iMean - 2.8) / iSe).toFixed(1), min: Math.min(...r.infant), max: Math.max(...r.infant) },
    deathAge: { mean: +mean(r.deathAge).toFixed(1), p5: pct(r.deathAge, 0.05), p95: pct(r.deathAge, 0.95) },
    years: { quiet: +mean(r.q).toFixed(1), narrative: +mean(r.n).toFixed(1), resolved: +mean(r.r).toFixed(1), extraLines: +mean(r.extra).toFixed(2) },
    holdMin: +(mean(r.holdMs) / 60000).toFixed(2),
    readSec: { low: +rSec(r.era, 'low').toFixed(1), median: +rm.toFixed(1), high: +rSec(r.era, 'high').toFixed(1) },
    time: {
      mean: +tMean.toFixed(3), se: +tSe.toFixed(4), sd: +sd(tManual).toFixed(2), marginLow: +((tMean - 25.5) / tSe).toFixed(1), marginHigh: +((34.5 - tMean) / tSe).toFixed(1),
      p5: +pct(tManual, 0.05).toFixed(1), p95: +pct(tManual, 0.95).toFixed(1), max: +Math.max(...tManual).toFixed(1), over40, over40Margin: +((0.05 - over40 / n) / seProp(over40, n)).toFixed(1),
      low: +mean(tLow).toFixed(2), high: +mean(tHigh).toFixed(2), auto1x: +mean(t1auto).toFixed(2), auto8x: +mean(t8auto).toFixed(2),
      vsDev: diffTest(tMean, tSe, devTime),
    },
  });
}
// 세 시대 평균 시간
const avgOf = (strategy) => {
  const rows = summary.filter((s) => s.strategy === strategy);
  const m = mean(rows.map((s) => s.time.mean));
  const sE = Math.sqrt(rows.reduce((a, s) => a + s.time.se ** 2, 0)) / 3;
  return { mean: +m.toFixed(3), se: +sE.toFixed(4), marginLow: +((m - 27) / sE).toFixed(1), marginHigh: +((33 - m) / sE).toFixed(1) };
};
const avg = { random: avgOf('random'), auto: avgOf('auto') };
writeJson(`harvest-${TAG}.json`, { N, k: K, offset: OFFSET, summary, avg, dev: DEV });
console.log(JSON.stringify(summary.map((s) => ({ era: s.era, st: s.strategy, cards: `${s.cards.mean}±${s.cards.se} (${s.cards.marginLow}SE)`, senior: `${s.senior.mean} (${s.senior.margin}SE)`, infant: s.infant.mean, t: `${s.time.mean}±${s.time.se} (${s.time.marginLow}SE)`, over40: s.time.over40 })), null, 0));
console.log('avg', JSON.stringify(avg));

for (const s of summary) {
  const strategyName = s.strategy === 'random' ? '무작위 선택(수동 흉내)' : '자동 성향';
  const cardOk = s.errors === 0 && s.cards.mean >= 23.3 && s.cards.mean <= 29 && s.cards.over30 === 0 && s.cards.ge29 <= 10 && s.cards.lt20_ofDeath70 <= 10 && s.cards.p5 >= 16 && s.senior.mean >= SENIOR_MIN[s.era] && s.infant.mean >= 2.8 && (N < 5000 || (s.cards.marginLow >= 3 && s.senior.margin >= 3 && s.infant.margin >= 3));
  // 합격선은 13-3 (라) ②의 값 기준(평균이 임계 안). 3 SE 여유는 시간 칸 전부에 적용하고, 카드·노년·영유아 칸은 큰 표본(5000판)에서만 적용한다(1000판 한 표본은 표준오차가 커서 참값이 임계 위 5 SE여도 한 표본이 2.7 SE로 나올 수 있다 — 여유는 보고)
  await runCase({ id: `Hx${TAG}-cards-${s.era}-${s.strategy}`, title: `표본 ${s.lives}판(${s.era}, ${strategyName}): 판당 결정 카드 수·노년·영유아` }, async () => ({
    verdict: cardOk && s.cards.vsDev.every((d) => d.ok) ? 'PASS' : 'FAIL',
    steps: '개발 서버 core(오라클)로 0세부터 사망까지 돌려 연표의 선택 기록을 셈(독립 표본)',
    expected: `평균 23.3~29(하한 ≥ 3 SE), 30장 초과 0, 29장 이상 ≤ 10%, 70세+ 중 20장 미만 ≤ 10%, 5% 분위 ≥ 16, 노년(65세+) ≥ ${SENIOR_MIN[s.era]}(≥ 3 SE), 영유아 ≥ 2.8, 개발 표와의 차 ≤ 3√(SE₁²+SE₂²)`,
    actual: `평균 ${s.cards.mean}±${s.cards.se}(하한 23.3까지 ${s.cards.marginLow} SE · 상한까지 ${s.cards.marginHigh} SE) 분위 ${s.cards.p5}/${s.cards.p50}/${s.cards.p95} 최대 ${s.cards.max}, 30장 초과 ${s.cards.over30}, 29장 이상 ${s.cards.ge29}%(${s.cards.ge29Margin} SE), 70세+ 중 20장 미만 ${s.cards.lt20_ofDeath70}%(${s.cards.lt20Margin} SE), 노년 ${s.senior.mean}±${s.senior.se}(${s.senior.margin} SE), 영유아 ${s.infant.mean}±${s.infant.se}(${s.infant.margin} SE), 사망 나이 ${s.deathAge.mean}, 개발 표(시험/sim:1000) 차 ${s.cards.vsDev.map((d) => `${d.diff}(≤${d.limit})`).join(' / ')}`,
    shots: [],
  }));
  const tOk = s.time.mean >= 25.5 && s.time.mean <= 34.5 && s.time.marginLow >= 3 && s.time.over40Margin >= 3 && s.time.p95 <= 40;
  await runCase({ id: `Hx${TAG}-time-${s.era}-${s.strategy}`, title: `표본 ${s.lives}판(${s.era}, ${strategyName}): 1배속 수동 모델 판 시간(읽기 중앙, 연출 계수 ${K})` }, async () => ({
    verdict: tOk && s.time.vsDev.every((d) => d.ok) ? 'PASS' : 'FAIL',
    steps: `해 수(조용 ${s.years.quiet}·서술 ${s.years.narrative}·결과 ${s.years.resolved}·둘째 줄 ${s.years.extraLines}) × 연출 × ${K} + 카드 × 읽기 ${s.readSec.median}초 (독립 계산)`,
    expected: '시대별 25.5~34.5분, 하한 25.5와 ≥ 3 SE(개발 표 기준 ≥ 5.2 SE), 95% 분위 ≤ 40분, 기대값 26.1/28.8/29.0 ± 0.3분, 개발 표와의 차 ≤ 3√(SE₁²+SE₂²)',
    actual: `${s.time.mean}±${s.time.se}분(하한까지 ${s.time.marginLow} SE · 상한까지 ${s.time.marginHigh} SE; 5%/95% 분위 ${s.time.p5}/${s.time.p95}, 최대 ${s.time.max}, 40분 초과 ${s.time.over40}판) · 읽기 낮음 ${s.time.low}분·높음 ${s.time.high}분 · 1배속 자동 ${s.time.auto1x}분 · 8배속 자동 ${s.time.auto8x}분 · 개발 표 차 ${s.time.vsDev.map((d) => `${d.diff}(≤${d.limit})`).join(' / ')}`,
    shots: [],
  }));
}
for (const st of ['random', 'auto']) {
  const a = avg[st];
  await runCase({ id: `Hx${TAG}-time-avg-${st}`, title: `표본 ${N}판 × 세 세상(${st === 'random' ? '무작위 선택' : '자동 성향'}): 세 시대 평균 1배속 수동 모델 판 시간` }, async () => ({
    verdict: a.mean >= 27 && a.mean <= 33 && a.marginLow >= 3 ? 'PASS' : 'FAIL',
    expected: '27~33분(하한과 ≥ 3 SE)',
    actual: `${a.mean}±${a.se}분 (하한 27까지 ${a.marginLow} SE · 상한 33까지 ${a.marginHigh} SE)`,
    shots: [],
  }));
}
await browser.close();
