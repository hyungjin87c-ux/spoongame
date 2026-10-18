// QA-003 M7e 읽기용 덤프: 이벤트 JSON(읽기 전용)에서 본문·선택지·결과를 한 줄씩 뽑아 qa/results/m7e/events-dump.txt에 쓴다(사람이 전부 읽기 위한 자료).
// 화면에 실제로 나온 문장과의 대조는 m7e-analyze.mjs가 수확 표본에서 한다.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT } from './m7e-lib.mjs';

const files = ['infant', 'school', 'youth', 'middle', 'senior'];
const lines = [];
let n = 0;
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'events', f + '.json'), 'utf8'));
  const arr = Array.isArray(j) ? j : j.events || Object.values(j);
  for (const e of arr) {
    n++;
    const cond = [];
    if (e.eras) cond.push('eras=' + e.eras.join('/'));
    if (e.ageRange) cond.push(`age=${e.ageRange.min}~${e.ageRange.max}`);
    if (e.conditions) cond.push('cond=' + JSON.stringify(e.conditions));
    lines.push(`## ${e.id} 「${e.title}」 [${(e.stages || []).join(',')}] ${cond.join(' ')}`);
    lines.push(`본문: ${e.text}`);
    for (const c of e.choices || []) {
      lines.push(`  - (${c.id}) 라벨: ${c.label}${c.requires ? '  requires=' + JSON.stringify(c.requires) : ''}`);
      lines.push(`      결과: ${c.result}`);
    }
    if (e.bonuses) for (const b of e.bonuses) if (b.text || b.result) lines.push(`  bonus: ${JSON.stringify(b)}`);
  }
}
fs.writeFileSync(path.join(OUT, 'events-dump.txt'), lines.join('\n') + '\n');
console.log('이벤트', n, '줄', lines.length);
