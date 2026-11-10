/**
 * (작업용) faceV2Lib의 「현행」(variant cur, era 없음)이 src/assets/faces/faceLayers.ts#faceSvg와 바이트 그대로 같은지 — 시안의 「지금」 열이 구현과 같은 그림이라는 근거.
 *   node_modules/.bin/vite-node scripts/design/checkFaceV2Base.mjs
 */
import { AGE_GROUPS, faceSvg } from '../../src/assets/faces/faceLayers.ts';
import { faceV2Svg } from './faceV2Lib.mjs';

let same = 0;
let diff = 0;
for (const ag of AGE_GROUPS) for (const gender of ['female', 'male']) for (const tier of [1, 2, 3, 4, 5]) {
  const a = faceSvg({ ageGroup: ag.id, gender, tier });
  const b = faceV2Svg({ ageGroup: ag.id, gender, tier, variant: 'cur' });
  if (a === b) same++;
  else {
    diff++;
    if (diff <= 3) {
      let i = 0;
      while (i < a.length && a[i] === b[i]) i++;
      console.log('DIFF', ag.id, gender, tier, 'at', i, '\n  src:', a.slice(i - 40, i + 80), '\n  v2 :', b.slice(i - 40, i + 80));
    }
  }
}
console.log(`same ${same} / diff ${diff} (80조합)`);
process.exit(diff === 0 ? 0 : 1);
