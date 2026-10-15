import { looksPmf, looksTopPercent } from '../../src/core/birth';
import { LOOKS_TIER_MIN_SCORE, looksTierOf } from '../../src/assets/faces/faceLayers';

/**
 * 외모 점수 → 얼굴 단계 구간 점검 (SPEC-003 DS4, designer).
 *   npx vite-node scripts/design/checkFaceTiers.ts
 * 외모 분포(core/birth.ts#looksPmf)에서 각 단계에 걸리는 확률을 세고, 단계 경계가 looksTopPercent(출생 문구의 「상위 약 N%」)와 맞는지 확인한다.
 * 맞지 않으면 종료 코드 1.
 */
const pmf = looksPmf();
const share: number[] = [0, 0, 0, 0, 0, 0];
let bad = 0;
for (let looks = 0; looks <= 100; looks++) {
  const tier = looksTierOf(looks);
  share[tier] += pmf[looks] * 100;
  const p = looksTopPercent(looks);
  const expected = p <= 10 ? 5 : p <= 30 ? 4 : p <= 70 ? 3 : p <= 90 ? 2 : 1;
  if (tier !== expected) {
    bad++;
    console.error(`어긋남: 외모 ${looks}점 → 단계 ${tier}, looksTopPercent(상위 ${p}%) 기준은 ${expected}`);
  }
}
console.log(`단계 경계(최소 점수): ${LOOKS_TIER_MIN_SCORE.join(', ')}`);
for (let t = 1; t <= 5; t++) console.log(`  ${t}단계: ${share[t].toFixed(1)}%`);
console.log(bad === 0 ? '단계 구간이 looksTopPercent 백분위와 일치한다' : `불일치 ${bad}건`);
if (bad > 0) process.exit(1);
