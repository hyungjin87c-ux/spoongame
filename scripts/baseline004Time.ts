import { ERAS } from '../src/core';
import { HOLD_MS, LIFE_LENGTH_MODES } from '../src/data/timingTable';
import { extraLineMsFor, measureMany, summarize } from './timeReportLib';

/**
 * SPEC-004 GM0 기준선 5·6절: 판 길이(`report:time`과 같은 측정) + 연표 줄 시간 여유.
 * 실행: ./node_modules/.bin/vite-node scripts/baseline004Time.ts [판수=1000]
 *  · 판 길이는 `npm run report:time -- 1000`의 「현재 설정 — 판 시간 모델」 중앙 값을 소수 둘째 자리까지 다시 센 것이다(같은 시드·같은 함수).
 *  · 여유 = M24 판정 구간(세 시대 평균 27~35분, 시대별 25.5~36.5분)의 상단 − 지금 값.
 *  · 연표 한 줄의 시간 가정 세 가지: SPEC TL13의 4초▲ / 모델 상수로 계산한 「이미 사건이 있는 해에 줄 하나 더」 / 「조용한 해가 서술 해로 바뀜」.
 */
const lives = Number(process.argv[2] ?? 1000);
const mode = LIFE_LENGTH_MODES.short30;
const f = (n: number, d = 2) => n.toFixed(d);

const sums = ERAS.map((era) => summarize(era, 'short30', measureMany(era, lives, 'random', 'short30')));
const scale = mode.holdScale;
const extraLineSec = extraLineMsFor('short30') / 1000; // 둘째 줄부터 더하는 대기
const quietToNarrativeSec = ((HOLD_MS.narrative - HOLD_MS.quiet) * scale) / 1000; // 조용한 해가 서술 해가 될 때 늘어나는 대기
/** 결정 카드 1장이 더하는 시간(분) — content-M8 2-6절(spec-005-baseline 3절 인용): 카드 1장 ≈ 0.52분 */
const CARD_MIN = 0.52;

console.log(`# 판 길이 (1배속 수동, 읽기 중앙, 모드 ${mode.label}, ${lives}판, 시드 i×7919+13, 수동 흉내) — M24 구간: 세 시대 평균 ${mode.timeMin.modelLow}~${mode.timeMin.modelHigh}분, 시대별 ${mode.timeMin.modelLow - 1.5}~${mode.timeMin.modelHigh + 1.5}분`);
console.log(`연출 계수 ${scale} · 조용한 해 ${f((HOLD_MS.quiet * scale) / 1000)}초 · 서술 해 ${f((HOLD_MS.narrative * scale) / 1000)}초 · 한 줄 더할 때마다 +${f(extraLineSec)}초 · 조용한 해 → 서술 해 +${f(quietToNarrativeSec)}초`);
console.log('\n| 시대 | 사망 나이 | 조용한 해 수 q | 조용한 해 비율 | c_self · c_total | **중앙(분)** ± SE | 상한까지 여유(분) | 읽기 낮음 | 읽기 높음 |');
console.log('|---|---:|---:|---:|---|---:|---:|---:|---:|');
const meanMed = sums.reduce((a, s) => a + s.median.mean, 0) / sums.length;
const upperEra = mode.timeMin.modelHigh + 1.5;
for (const s of sums) {
  const se = s.median.se;
  console.log(`| ${s.era} | ${f(s.deathAge, 1)} | ${f(s.q, 1)} | ${f((s.q / s.deathAge) * 100, 0)}% | ${f(s.cSelf)} · ${f(s.c)} | **${f(s.median.mean)}** ± ${f(se, 2)} | ${f(upperEra - s.median.mean)} | ${f(s.low.mean)} | ${f(s.high.mean)} |`);
}
console.log(`\n세 시대 평균(중앙): **${f(meanMed)}분** — 평균 상단 ${mode.timeMin.modelHigh}분까지 여유 ${f(mode.timeMin.modelHigh - meanMed)}분, 하단 ${mode.timeMin.modelLow}분까지 ${f(meanMed - mode.timeMin.modelLow)}분`);

console.log('\n# 연표 줄 시간 여유 — 한 판에 넣을 수 있는 줄 수 (여유 ÷ 줄당 시간, 내림)');
console.log('| 시대 | 여유(분) | 줄당 4초(SPEC TL13▲) | 줄당 모델 상수 ' + f(extraLineSec) + '초(사건 있는 해에 한 줄 더) | 줄당 ' + f(quietToNarrativeSec) + '초(조용한 해가 서술 해로) | 섞어서 줄당 평균 | 섞은 값으로 |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
const rows = sums.map((s) => {
  const room = (upperEra - s.median.mean) * 60;
  const quietShare = s.q / s.deathAge;
  const blend = quietShare * quietToNarrativeSec + (1 - quietShare) * extraLineSec;
  return { era: s.era, room, quietShare, blend };
});
for (const r of rows) {
  console.log(`| ${r.era} | ${f(r.room / 60)} | ${Math.floor(r.room / 4)} | ${Math.floor(r.room / extraLineSec)} | ${Math.floor(r.room / quietToNarrativeSec)} | ${f(r.blend, 1)}초(조용한 해 ${f(r.quietShare * 100, 0)}%) | ${Math.floor(r.room / r.blend)} |`);
}
const roomAvg = (mode.timeMin.modelHigh - meanMed) * 60;
console.log(`| 세 시대 평균 기준 | ${f(roomAvg / 60)} | ${Math.floor(roomAvg / 4)} | ${Math.floor(roomAvg / extraLineSec)} | ${Math.floor(roomAvg / quietToNarrativeSec)} | - | - |`);
console.log(`\n결정 카드 1장 ≈ ${CARD_MIN}분(${f(CARD_MIN * 60, 0)}초)이므로 카드 1장을 덜어 내면 줄 ${f((CARD_MIN * 60) / 4, 1)}개(4초) / ${f((CARD_MIN * 60) / extraLineSec, 1)}개(${f(extraLineSec)}초) / ${f((CARD_MIN * 60) / quietToNarrativeSec, 1)}개(${f(quietToNarrativeSec)}초) 자리가 난다.`);
const gaps = sums.map((x) => `${x.era} 총 ${f(x.c - mode.cards.meanLow, 1)}장 · 본인 ${f(x.cSelf - mode.cardsSelf.meanLow, 1)}장`).join(' / ');
console.log(`카드 수 판정 하한(총 ${mode.cards.meanLow}장, 본인 ${mode.cardsSelf.meanLow}장)까지 덜어 낼 수 있는 장수: ${gaps}`);
