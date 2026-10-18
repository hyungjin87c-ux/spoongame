// QA-003 M7a 합쇼체 lint 블랙박스 점검 (vite-node: ./node_modules/.bin/vite-node qa/scripts/m7a-lint-probe.mjs)
// 앱 코드는 읽기만 한다(core의 lintEvent를 불러 문장 하나씩 넣어 본다). 새 이벤트(이행 목록 밖) 기준으로 걸려야 할 것은 걸리고 통과해야 할 것은 통과하는지.
// 결과: qa/results/m7a/lint-probe.json, 케이스 M7a-L01 (cases.jsonl)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintEvent } from '../../src/core/eventLint';
const RP = process.env.QA_RP || '';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'results', 'm7a');
const base = (over = {}) => ({ id: 'qa-probe-event', title: '프로브', text: '아이가 처음으로 웃었습니다. 어른들은 한참을 바라보았습니다.', stages: ['infant'], ageRange: { min: 1, max: 2 }, weight: 10, once: true, effects: { stats: { happiness: 1 } }, ...over });
const choice = (over = {}) => base({ effects: undefined, text: '아이가 울었습니다. 어른들이 의논했습니다.', choices: [{ id: 'a', label: '안아 준다', result: '아이를 안아 달랬습니다. 아이는 곧 잠들었습니다.', effects: { stats: { relationships: 1 } } }, { id: 'b', label: '지켜본다', result: '곁에서 지켜보았습니다. 아이는 스스로 그쳤습니다.', effects: { stats: { happiness: 1 } } }], ...over });
const rep = (n, ch = '가') => ch.repeat(n);

// [이름, 이벤트, 걸려야 하나]
const CASES = [
  ['기준: 합쇼체 서술 이벤트', base(), false],
  ['기준: 합쇼체 선택지 이벤트', choice(), false],
  ['해라체 본문(「~했다.」)', base({ text: '아이가 처음으로 웃었다. 어른들은 한참을 바라보았다.' }), true],
  ['해라체 한 문장만 섞임', base({ text: '아이가 처음으로 웃었습니다. 어른들은 한참을 바라보았다.' }), true],
  ['마침표 없는 합쇼체', base({ text: '아이가 처음으로 웃었습니다' }), true],
  ['해요체(「~했어요.」)', base({ text: '아이가 처음으로 웃었어요. 어른들은 기뻤어요.' }), true],
  ['「~죠.」 구어', base({ text: '아이가 처음으로 웃었습니다. 모두 기뻤죠.' }), true],
  ['옛 철자 「읍니다」(r3: 걸려야 함)', base({ text: '아이가 처음으로 웃었읍니다.' }), true],
  ['합쇼체 의문문(물음표)', base({ text: '아이가 웃었습니까?' }), true],
  ['느낌표', base({ text: '아이가 웃었습니다!' }), true],
  ['이모지', base({ text: '아이가 웃었습니다. 😀' }), true],
  ['말줄임표', base({ text: '아이가 웃었습니다…' }), true],
  ['선택지 결과가 해라체', choice({ choices: [{ id: 'a', label: '안아 준다', result: '아이를 안아 달랬다. 아이는 곧 잠들었다.', effects: { stats: { relationships: 1 } } }, { id: 'b', label: '지켜본다', result: '곁에서 지켜보았습니다. 아이는 스스로 그쳤습니다.', effects: { stats: { happiness: 1 } } }] }), true],
  ['큰따옴표 대사(합쇼체 서술)도 금지(r3 R-360)', base({ text: '아이가 "가자." 하고 말했습니다. 어른들이 웃었습니다.' }), true],
  ['대사로 해라체 서술 가리기(걸려야 함)', base({ text: '아이가 "가자." 하고 말했다.' }), true],
  ['대사 안 해요체(「그만 가요.」)', base({ text: '아이가 "그만 가요." 하고 말했습니다.' }), true],
  ['한자어 요 명사(「도움이 필요합니다.」) 통과', base({ text: '아이에게는 도움이 필요합니다. 어른들이 곁을 지켰습니다.' }), false],
  ['따옴표 짝 안 맞음', base({ text: '아이가 "가자 하고 말했습니다.' }), true],
  ['본문 74자(통과)', base({ text: `${rep(36)}입니다. ${rep(28)}입니다.` }), false],
  ['본문 75자 초과', base({ text: `${rep(36)}입니다. ${rep(30)}입니다.` }), true],
  ['제목 17자', base({ title: rep(17) }), true],
  ['제목 16자(통과)', base({ title: rep(16) }), false],
  ['라벨 25자', choice({ choices: [{ id: 'a', label: `${rep(23)}한다`, result: '아이를 안아 달랬습니다. 아이는 곧 잠들었습니다.', effects: { stats: { relationships: 1 } } }, { id: 'b', label: '지켜본다', result: '곁에서 지켜보았습니다. 아이는 스스로 그쳤습니다.', effects: { stats: { happiness: 1 } } }] }), true],
  ['라벨 끝에 마침표', choice({ choices: [{ id: 'a', label: '안아 준다.', result: '아이를 안아 달랬습니다. 아이는 곧 잠들었습니다.', effects: { stats: { relationships: 1 } } }, { id: 'b', label: '지켜본다', result: '곁에서 지켜보았습니다. 아이는 스스로 그쳤습니다.', effects: { stats: { happiness: 1 } } }] }), true],
  ['한 문장 53자', base({ text: `${rep(51)}입니다.` }), true],
  ['지난 세상 + 「어린이집」', base({ eras: ['past'], text: '아이는 어린이집에 다니기 시작했습니다.' }), true],
  ['지난 세상 + 「육아휴직」', base({ eras: ['past'], text: '어른이 육아휴직을 썼습니다.' }), true],
  ['지난 세상 + 「영어 유치원」', base({ eras: ['past'], stages: ['infant'], text: '아이는 영어 유치원에 다녔습니다.' }), true],
  ['지난 세상 + 「산후조리원」', base({ eras: ['past'], text: '어머니는 산후조리원에서 쉬었습니다.' }), true],
  ['시대 미지정 + 「어린이집」(지난 세상에도 일어남)', base({ text: '아이는 어린이집에 다니기 시작했습니다.' }), true],
  ['지금 세상 전용 + 「어린이집」(통과)', base({ eras: ['present'], text: '아이는 어린이집에 다니기 시작했습니다.' }), false],
  ['지금 세상 + 「아랫목」', base({ eras: ['present'], text: '식구가 아랫목에 모였습니다.' }), true],
  ['지난 세상 전용 + 「아랫목」(통과)', base({ eras: ['past'], text: '식구가 아랫목에 모였습니다.' }), false],
  ['지난 세상 + 「학습지」(허용)', base({ eras: ['past'], text: '아이는 학습지를 풀었습니다.' }), false],
  ['영유아 1인칭 「나는」', base({ text: '나는 처음으로 웃었습니다.' }), true],
  ['달력 연도', base({ text: '2026년에 아이가 웃었습니다.' }), true],
  ['URL', base({ text: '아이가 웃었습니다. https://example.com' }), true],
  ['금액 문장(3만 원)(r3: 걸려야 함)', base({ text: '아이 몫으로 3만 원을 썼습니다.' }), true],
  ['금액 문장(3억)', base({ text: '집값이 3억이라고 했습니다.' }), true],
  ['금액 문장(5달러)', base({ text: '아이는 5달러를 받았습니다.' }), true],
  ['「몇 만 원」(통과)', base({ text: '몇 만 원이 들었습니다. 어른들은 한숨을 쉬었습니다.' }), false],
  ['낫표 인용 「가자」', base({ text: '아이가 「가자」라고 말했습니다.' }), true],
  ['작은따옴표 인용', base({ text: '아이가 '+"'"+'가자'+"'"+'라고 말했습니다.' }), true],
  ['간접화법(통과)', base({ text: '아이는 가자고 말했습니다. 어른들이 웃었습니다.' }), false],
  ['마침표 바로 뒤에 한글이 붙음(R-371 ③)', base({ text: '아이가 웃었습니다.어른들이 바라보았습니다.' }), true],
  ['구어 명사 예외(「고요합니다」)(통과)', base({ text: '집 안은 고요합니다. 어른들이 곁을 지켰습니다.' }), false],
  ['7세 전용 school- 이벤트의 1인칭(R-371 ②)', base({ id: 'school-qa-probe', stages: ['school'], ageRange: { min: 7, max: 7 }, text: '나는 처음으로 학교에 갔습니다.' }), true],
  ['소수점(3.2kg)은 문장 끝이 아님', base({ text: '아이는 3.2kg으로 태어났습니다. 어른들은 기뻐했습니다.' }), 'either'],
];

const rows = [];
let bad = 0;
for (const [name, ev, expect] of CASES) {
  let msgs;
  try {
    msgs = lintEvent(ev);
  } catch (e) {
    msgs = [`예외: ${String(e.message).slice(0, 80)}`];
  }
  const flagged = msgs.length > 0;
  const ok = expect === 'either' ? true : flagged === expect;
  if (!ok) bad++;
  rows.push({ name, expect, flagged, ok, msgs: msgs.slice(0, 2).map((m) => m.slice(0, 90)) });
}
fs.writeFileSync(path.join(OUT, RP + 'lint-probe.json'), JSON.stringify(rows, null, 1));
const rec = {
  id: 'M7a-T10',
  cat: '문장',
  title: '합쇼체 lint 블랙박스 점검: 새 이벤트(이행 목록 밖)에서 해라체·해요체·마침표 없음·의문문·느낌표·이모지·시대 금지어·길이 초과·1인칭은 걸리고, 대사·한자어 「요」 명사·지난 세상 전용 아랫목·지금 세상 전용 어린이집은 통과',
  steps: `lintEvent에 문장 ${CASES.length}종을 하나씩 넣는다(앱 코드는 읽기만)`,
  expected: '걸려야 할 것은 걸리고 통과해야 할 것은 통과(금액·소수점은 기록만)',
  verdict: bad ? 'FAIL' : 'PASS',
  actual: bad ? rows.filter((r) => !r.ok).map((r) => `${r.name}: 기대 ${r.expect ? '걸림' : '통과'} 실제 ${r.flagged ? '걸림' : '통과'}`).join(' / ') : `${CASES.length}종 모두 기대대로. 기록만: ${rows.filter((r) => CASES.find((c) => c[0] === r.name)[2] === 'either').map((r) => `${r.name} → ${r.flagged ? '걸림 ' + (r.msgs[0] ?? '') : '통과'}`).join(' / ')}`,
  shots: [],
  console: [],
  externalRequests: [],
  at: new Date().toISOString(),
};
fs.appendFileSync(path.join(OUT, RP + 'cases.jsonl'), JSON.stringify(rec) + '\n');
console.log(`[${rec.verdict}] ${rec.id} :: ${rec.actual}`);
for (const r of rows) console.log(`${r.ok ? ' ' : '!'} ${r.name} → ${r.flagged ? '걸림' : '통과'} ${r.msgs[0] ?? ''}`);
