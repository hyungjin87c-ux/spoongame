// QA-003 M7c 콘텐츠 독립 점검(브라우저 없음): src/data/notes.json의 질문 7종·변형·수동 질문을 content-M7c 1-1(R7)·1-2(S1~S5) 기준으로 QA가 따로 적은 낱말 목록으로 훑는다.
// 사용: node qa/scripts/m7c-lint.mjs   결과: qa/results/m7c/lint.json
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT } from './m7c-lib.mjs';

const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'notes.json'), 'utf8'));
const FORBID_S1 = ['자살', '자해', '목숨', '죽', '학대', '폭행', '폭력', '구타', '성폭', '성추행', '강간', '트라우마', '사망', '유서', '극단'];
const FORBID_S2 = ['왜', '어째서', '이유', '때문', '탓', '잘못', '책임', '원인'];
const EMOTION = ['행복', '기쁨', '슬픔', '외로', '후회', '분노', '두려', '불안', '우울', '괴로', '화가', '상처', '고통', '아픔', '눈물', '그리움'];
const out = [];
const texts = [];
for (const c of j.cards) {
  texts.push({ id: c.id, kind: 'prompt', text: c.prompt });
  for (const v of c.variants || []) texts.push({ id: c.id, kind: 'variant', text: v.prompt });
}
texts.push({ id: 'manual', kind: 'manual', text: j.manual.prompt });
for (const t of texts) {
  const filled = t.text.replace(/\{이름\}/g, '가나다');
  const issues = [];
  for (const w of FORBID_S1) if (t.text.includes(w)) issues.push(`S1 금지어 「${w}」`);
  for (const w of FORBID_S2) if (t.text.includes(w)) issues.push(`S2 캐묻는 낱말 「${w}」`);
  for (const w of EMOTION) if (t.text.includes(w)) issues.push(`S4 감정 낱말 「${w}」`);
  if (!/(있습니까|느껴집니까)\?$/.test(t.text)) issues.push('S3 끝맺음이 「있습니까?/느껴집니까?」가 아님');
  if ((t.text.match(/\?/g) || []).length !== 1) issues.push('?가 한 개가 아님');
  if (/[!！]/.test(t.text)) issues.push('느낌표');
  if (/\p{Extended_Pictographic}/u.test(t.text)) issues.push('이모지');
  if (filled.length > 52) issues.push(`문장 길이 ${filled.length} > 52`);
  if (/\{이름\}(이|가|은|는|을|를)(?![가-힣])/.test(t.text) || /\{이름\}(이|가|은|는|을|를) /.test(t.text)) issues.push('이름 뒤 조사 이/가/은/는/을/를');
  if (/[가-힣]{2,}\s*(이다|였다|했다|한다)[\s.?]/.test(t.text)) issues.push('합쇼체 아님 의심');
  out.push({ ...t, len: filled.length, issues });
}
fs.writeFileSync(path.join(OUT, 'lint.json'), JSON.stringify(out, null, 1));
const bad = out.filter((o) => o.issues.length);
console.log(`문장 ${out.length}개, 지적 ${bad.length}개`);
for (const o of out) console.log(o.id, o.kind, o.len, o.issues.length ? o.issues.join(' / ') : 'OK', '|', o.text);
