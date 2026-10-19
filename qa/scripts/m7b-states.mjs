// QA-003 M7b 카드 저장 만들기(오라클): 개발 서버의 core로 「특정 카드가 대기 중인」 저장을 만들어 qa/results/m7b/states/<이름>.json에 둔다.
// 사용: node qa/scripts/m7b-states.mjs   (끝나면 폴더는 지워도 된다 — 이 스크립트로 다시 만든다)
import fs from 'node:fs';
import path from 'node:path';
import { launch, mkctx, DEV, OUT, findCardState } from './m7b-lib.mjs';

export const STATES_DIR = path.join(OUT, 'states');
fs.mkdirSync(STATES_DIR, { recursive: true });

// [이름, 이벤트, 세상, 옵션]
const MANIFEST = [
  ['tutoring-present', 'school-tutoring', 'present', {}],
  ['tutoring-future', 'school-tutoring', 'future', {}],
  ['sibling-past', 'infant-new-sibling', 'past', {}],
  ['sibling-present', 'infant-new-sibling', 'present', {}],
  ['sibling-future', 'infant-new-sibling', 'future', {}],
  ['fever-present', 'infant-fever', 'present', {}],
  ['fever-past', 'infant-fever', 'past', {}],
  ['noise-present', 'infant-noise', 'present', {}],
  ['grandchildren-present', 'senior-grandchildren', 'present', {}],
  ['grandchildren-future', 'senior-grandchildren', 'future', {}],
  ['earlywork-past', 'school-early-work', 'past', {}],
  ['exam-past', 'school-exam', 'past', {}],
  ['exam-present', 'school-exam', 'present', {}],
  ['familyprio-past', 'school-family-priority', 'past', {}],
  ['firstjob-past', 'youth-first-job', 'past', {}],
  ['marriage-past', 'youth-marriage', 'past', {}],
  ['child-past', 'youth-child', 'past', {}],
  ['housing-present', 'youth-housing', 'present', { minChoices: 4 }],
  ['housing-future', 'youth-housing', 'future', { minChoices: 4 }],
  ['startup-present', 'youth-startup', 'present', {}],
  ['layoff-present', 'middle-layoff', 'present', {}],
  ['layoff-future', 'middle-layoff', 'future', {}],
  ['schoolcare-present', 'middle-child-school', 'present', {}],
  ['estate-present', 'senior-estate', 'present', {}],
  ['newdevice-present', 'senior-new-device', 'present', {}],
  ['moveeome-present', 'senior-move-home', 'present', {}],
  ['alone-present', 'senior-alone', 'present', {}],
  ['spousecare-present', 'senior-spouse-care', 'present', {}],
  ['friend-present', 'school-friend', 'present', {}], // 인용도 무인용 사유도 없는 2차 대기 카드
  ['farewell-present', 'middle-parents-farewell', 'present', {}], // X2
  ['puppy-past', 'school-puppy', 'past', {}],
  ['longlife-future', 'senior-long-life', 'future', {}],
];

if (process.argv[1] && process.argv[1].endsWith('m7b-states.mjs')) {
  const b = await launch();
  const ctx = await mkctx(b);
  const p = await ctx.newPage();
  await p.goto(DEV, { waitUntil: 'load' });
  await p.waitForSelector('[data-testid="title-screen"]');
  const only = process.argv[2];
  for (const [name, ev, era, opts] of MANIFEST) {
    if (only && !name.includes(only)) continue;
    const s = await findCardState(p, ev, era, opts);
    if (!s) {
      console.log(`${name}: 못 찾음`);
      continue;
    }
    fs.writeFileSync(path.join(STATES_DIR, `${name}.json`), JSON.stringify(s));
    console.log(`${name}: ${ev}/${era} age ${s.age} birth ${s.character.birthYear} 선택지 ${s.pending.choiceIds.length}`);
  }
  await b.close();
}
