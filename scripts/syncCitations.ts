import { readFileSync, writeFileSync } from 'node:fs';
import { EVENT_POOL } from '../src/data/events';
import { NOTE_CARDS } from '../src/data/noteCards';
import { usedByIndex } from '../src/core';
import { syncedCitationsText } from './syncCitationsLib';

/**
 * `src/data/citations.json`의 `usedBy`(인용 → 그 인용을 쓰는 이벤트)를 이벤트 JSON(과 기록 카드 `src/data/notes.json`, M7c)의 `citation`에서 다시 만들어 저장소 파일과 같은지 확인한다 (SPEC-003 M7b, 마스터 결정 M-5).
 *  - `npm run check:citations` : 다르면 어디가 다른지 보이고 종료 코드 1 (이벤트의 `citation`만 고치거나 `usedBy`만 고친 어긋남을 잡는다)
 *  - `npm run gen:citations`   : `usedBy`를 다시 써서 맞춘다 (이벤트 JSON의 `citation`/`noCitation`을 고친 뒤)
 * 사람이 `usedBy`를 쓰지 않는다 — `gen:basis`/`check:basis`와 같은 방식이다. 만드는 규칙은 `scripts/syncCitationsLib.ts`. 네트워크 요청이나 외부 입력은 없다.
 */

const PATH = 'src/data/citations.json';

function firstDiff(a: string, b: string): string {
  const al = a.split('\n');
  const bl = b.split('\n');
  const n = Math.max(al.length, bl.length);
  for (let k = 0; k < n; k++) {
    if (al[k] !== bl[k]) return `${k + 1}번째 줄\n  저장소: ${(al[k] ?? '(없음)').slice(0, 160)}\n  생성기: ${(bl[k] ?? '(없음)').slice(0, 160)}`;
  }
  return '(줄은 같고 줄바꿈·끝 글자가 다름)';
}

const actual = readFileSync(PATH, 'utf-8');
const expected = syncedCitationsText(actual, EVENT_POOL.events, NOTE_CARDS);
const linked = Object.keys(usedByIndex(EVENT_POOL.events, NOTE_CARDS)).length;
if (actual === expected) {
  console.log(`일치: ${PATH} — usedBy가 이벤트의 citation 역색인과 같다 (인용 ${linked}건이 카드에 연결됨)`);
} else if (process.argv.includes('--write')) {
  JSON.parse(expected); // 쓰기 전에 JSON이 깨지지 않았는지
  writeFileSync(PATH, expected, 'utf-8');
  console.log(`다시 씀: ${PATH} (인용 ${linked}건이 카드에 연결됨)`);
} else {
  console.log(`불일치: ${PATH} — ${firstDiff(actual, expected)}`);
  console.log('\n`usedBy`/`candidateEvents`가 이벤트의 citation 역색인과 다릅니다. 원인을 확인한 뒤 `npm run gen:citations`로 다시 만드세요.');
  process.exit(1);
}
