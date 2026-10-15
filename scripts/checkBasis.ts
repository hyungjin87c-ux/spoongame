import { readFileSync, writeFileSync } from 'node:fs';
import { buildBasisDoc } from './basisDoc';
import { buildLifeDataCsv, LIFE_ROWS } from './lifeDataCsv';
import statsJson from '../src/data/koreaStats.json';
import citationsJson from '../src/data/citations.json';

/**
 * 근거 문서·CSV를 JSON에서 다시 만들어 저장소 파일과 같은지 확인한다 (검수 R-148).
 *  - `npm run check:basis` : 다르면 어디가 다른지 보이고 종료 코드 1 (문서만 고치거나 JSON만 고친 어긋남을 잡는다)
 *  - `npm run gen:basis`   : 문서를 다시 써서 맞춘다 (JSON이나 scripts/basisDoc.ts·scripts/lifeDataCsv.ts를 고친 뒤)
 * 네트워크 요청이나 외부 입력은 없다.
 */

const TARGETS: Array<{ path: string; build: () => string }> = [
  { path: 'docs/data/events-stats-basis.md', build: () => buildBasisDoc(statsJson, citationsJson, LIFE_ROWS.length) },
  { path: 'docs/data/korea-life-data-sources.csv', build: () => buildLifeDataCsv() },
];

function firstDiff(a: string, b: string): string {
  const al = a.split('\n');
  const bl = b.split('\n');
  const n = Math.max(al.length, bl.length);
  for (let k = 0; k < n; k++) {
    if (al[k] !== bl[k]) return `${k + 1}번째 줄\n  저장소: ${(al[k] ?? '(없음)').slice(0, 160)}\n  생성기: ${(bl[k] ?? '(없음)').slice(0, 160)}`;
  }
  return '(줄은 같고 줄바꿈·끝 글자가 다름)';
}

const write = process.argv.includes('--write');
let failed = 0;
for (const t of TARGETS) {
  const expected = t.build();
  let actual: string | null = null;
  try {
    actual = readFileSync(t.path, 'utf-8');
  } catch {
    actual = null;
  }
  if (actual === expected) {
    console.log(`일치: ${t.path}`);
    continue;
  }
  if (write) {
    writeFileSync(t.path, expected, 'utf-8');
    console.log(`다시 씀: ${t.path}`);
    continue;
  }
  failed++;
  console.log(`불일치: ${t.path} — ${actual === null ? '파일 없음' : firstDiff(actual, expected)}`);
}
if (failed > 0) {
  console.log(`\n${failed}개 파일이 JSON·생성기와 다릅니다. 원인을 확인한 뒤 \`npm run gen:basis\`로 다시 만드세요.`);
  process.exit(1);
}
