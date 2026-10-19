// QA-003 M7c 2회차 콘텐츠 확인 (QA2-3): 실제 화면에서 수집한 질문(cards.json) · 데이터 파일(읽기만) · ④ 이별 변형 표본(broke-variant.json)을
// 형진 님·designer 결정(content-M7c 11-12 D2·D3·D5, copy.md 7-1)에서 QA가 손으로 적은 기대값과 대조해 케이스를 쌓는다. 앱 함수를 오라클로 쓰지 않는다.
// 사용: node qa/scripts/m7c-r2-content.mjs   (먼저 m7c-r2-cards.mjs, m7c-broke.mjs를 돌려 둘 것)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT, addCase } from './m7c-r2-lib.mjs';

const cards = JSON.parse(fs.readFileSync(path.join(OUT, 'cards.json'), 'utf8'));
const notes = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'notes.json'), 'utf8'));
const cites = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'citations.json'), 'utf8'));

// 기대값(copy.md 7-1 최종 · 마스터 결정 D2/D5)
const EXPECT = {
  Q1: '다섯 살 무렵을 떠올려 보면, {이름}에게 기억나는 장면이나 느낌이 있습니까?',
  Q1p: '다섯 살 무렵을 떠올려 보면, {이름}에게 기억나는 장면이나 느낌이 있습니까?',
  Q1f: '다섯 살 무렵을 떠올려 보면, {이름}에게 기억나는 장면이나 느낌이 있습니까?',
  Q2: '누군가가 부럽거나 샘이 났던 순간이 {이름}에게도 있습니까?',
  Q3a: '마음을 전했던 그때를 떠올려 보면, {이름}에게 남아 있는 장면이나 느낌이 있습니까?',
  Q3b: '처음 누군가에게 마음이 갔던 기억이 {이름}에게 있습니까?',
  Q4b: '함께하는 사람과 보낸 시간 가운데 {이름}에게 오래 남은 장면이 있습니까?',
  Q4c: '누군가를 만나 마음을 나누는 일에 대해, {이름}에게 떠오르는 생각이 있습니까?',
  Q5a: '몸이 아팠던 시간을 떠올려 보면, {이름}에게 남아 있는 마음이나 장면이 있습니까?',
  Q5b: '몸이 아팠던 시간을 떠올려 보면, {이름}에게 남아 있는 마음이나 장면이 있습니까?',
  Q6: '부모님이 예전보다 나이 들었다고 느낀 순간이 {이름}에게 있습니까?',
  Q7: '살아온 시간을 돌아보는 지금, {이름}에게 인생은 어떤 것처럼 느껴집니까?',
};
const MANUAL = '지금 {이름}의 마음에 남아 있는 장면이나 생각이 있습니까?';
const LABELS = { 'note-infant-memory': '영유아기 기억', 'note-teen-envy': '또래와 나', 'note-first-love': '첫사랑', 'note-youth-romance': '마음을 나누는 일', 'note-illness': '아팠던 시간', 'note-parents-aging': '부모님의 나이듦', 'note-midlife': '중년의 인생' };
const C037 = '어릴 때의 투자가 이후 투자의 효과와 이어져 있다고 봅니다.';
const HEADER = { present: '', past: '지금의 연구로는 ', future: '지금 기준으로는 ' };

// ---- C-Q1: 실제 화면 질문 12종 + 수동 1종이 기대 문장과 글자까지 같다
{
  const bad = [];
  const rows = [];
  for (const c of cards) {
    if (!c.found && c.found !== undefined) continue;
    if (c.id === 'QM') {
      const t = c.onScreen.title;
      const nm = (t.match(/^지금 (.+?)의 마음에/) || [])[1];
      const ok = nm && t === MANUAL.replace('{이름}', nm);
      rows.push({ id: c.id, ok, title: t });
      if (!ok) bad.push({ id: c.id, title: t });
      continue;
    }
    const exp = EXPECT[c.id];
    if (!exp) {
      bad.push({ id: c.id, why: '기대값 없음(삭제된 변형인가?)' });
      continue;
    }
    const got = c.onScreen.title.split(c.charName).join('{이름}');
    const ok = got === exp && c.onScreen.title.includes(c.charName);
    rows.push({ id: c.id, ok, title: c.onScreen.title });
    if (!ok) bad.push({ id: c.id, got, exp });
  }
  const missing = Object.keys(EXPECT).filter((k) => !cards.some((c) => c.id === k && c.found !== false));
  addCase({ id: 'C-Q1', cat: '콘텐츠(2회차)', title: '실제 화면(360×740 터치)에 뜬 질문 12종 + 수동 질문이 copy.md 7-1 최종 문장과 글자까지 같다 (③ 기본 새 질문 포함)', steps: '카드별 전제를 만족하는 판을 만들어 시트를 열고 질문 제목을 읽어 {이름}을 캐릭터 이름으로 되돌려 비교', expected: '모두 같음, 상태를 못 찾은 변형 0', verdict: bad.length || missing.length ? 'FAIL' : 'PASS', actual: bad.length || missing.length ? `불일치 ${JSON.stringify(bad)} / 못 찾음 ${JSON.stringify(missing)}` : `${rows.length}/${rows.length}장 모두 기대와 같음 — ③ 기본: 「${cards.find((c) => c.id === 'Q3b').onScreen.title}」`, shots: cards.filter((c) => c.shot).map((c) => c.shot) });
}

// ---- C-Q2: ③ 기본 질문이 새 문장이고 옛 문장(「~떠올려 보면」 전제 꼴)이 아님 / P1 확인
{
  const q = cards.find((c) => c.id === 'Q3b');
  const bad = [];
  if (!q) bad.push('Q3b 없음');
  else {
    const t = q.onScreen.title;
    if (/떠올려 보면/.test(t)) bad.push('옛 꼴 「떠올려 보면」 잔존');
    if (!/있습니까\?$/.test(t)) bad.push('끝맺음 이상');
    const len = t.replace(q.charName, '가나다라마').length;
    if (len > 52) bad.push(`길이 ${len} > 52`);
  }
  addCase({ id: 'C-Q2', cat: '콘텐츠(2회차)', title: '③ 기본 질문(first_love 없는 판 약 95%)은 「처음 누군가에게 마음이 갔던 기억이 {이름}에게 있습니까?」 — 일이 있었다고 전제하지 않고 끝의 「있습니까?」가 묻는다 (CQ06 / R-408)', steps: '화면 읽기 + 옛 문장 잔존·끝맺음·길이(이름 5자 기준 ≤52)', expected: '새 문장, 옛 「떠올려 보면」 꼴 0', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : '「처음 누군가에게 마음이 갔던 기억이 {이름}에게 있습니까?」 — 33자(이름 5자 기준 35자), 전제 구 없음. 화면 읽기: 「~했던 기억이 있습니까」는 있었는지 자체를 묻는 열린 질문으로 읽힘', shots: q ? [q.shot] : [] });
}

// ---- C-LBL: 데이터(notes.json) 라벨 7종 + 수동 · ③④ 새 라벨
{
  const got = Object.fromEntries(notes.cards.map((c) => [c.id, c.topic]));
  const bad = Object.entries(LABELS).filter(([id, t]) => got[id] !== t);
  const manualOk = notes.manual.topic === '지금의 생각';
  const long = Object.entries(got).filter(([, t]) => t.length > 12);
  addCase({ id: 'C-LBL', cat: '콘텐츠(2회차)', title: '연표·인생 기록의 「나의 기록 · {라벨}」 — ③ 「첫사랑」 · ④ 「마음을 나누는 일」(D5 카드당 라벨 하나), 옛 라벨(「첫사랑의 추억」「연애의 기억」·「청년기 연애담」) 잔존 0', steps: 'src/data/notes.json 읽기(읽기만) + 기록 화면 라벨 확인은 정상 플레이(N01~N03)에서', expected: '라벨 7+1 모두 기대와 같음, ≤12자, 옛 라벨 0', verdict: bad.length || !manualOk || long.length ? 'FAIL' : 'PASS', actual: bad.length || !manualOk || long.length ? `불일치 ${JSON.stringify(bad)} 수동=${notes.manual.topic} 12자 초과 ${JSON.stringify(long)}` : `라벨 ${JSON.stringify(got)} / 수동 「${notes.manual.topic}」, 최장 ${Math.max(...Object.values(got).map((t) => t.length))}자`, shots: [] });
  const raw = JSON.stringify(notes);
  const stale = ['첫사랑의 추억', '연애의 기억', '청년기 연애담'].filter((w) => raw.includes(w));
  addCase({ id: 'C-LBL2', cat: '콘텐츠(2회차)', title: '옛 라벨 문자열이 데이터에 남지 않았다', steps: 'notes.json 전체 검색', expected: '0', verdict: stale.length ? 'FAIL' : 'PASS', actual: stale.length ? `잔존 ${stale}` : '잔존 0', shots: [] });
}

// ---- C-Q4: ④ 이별 변형 0
{
  const c4 = notes.cards.find((c) => c.id === 'note-youth-romance');
  const variantsWhen = JSON.stringify((c4.variants || []).map((v) => v.when));
  const raw = JSON.stringify(notes);
  const brokeData = /broke_up|헤어진/.test(raw);
  const brokeFile = fs.existsSync(path.join(OUT, 'broke-variant.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'broke-variant.json'), 'utf8')) : null;
  const total = brokeFile ? Object.values(brokeFile).reduce((a, v) => a + v.broke, 0) : null;
  const cards4 = brokeFile ? Object.values(brokeFile).reduce((a, v) => a + v.cards, 0) : null;
  const partner = brokeFile ? Object.values(brokeFile).reduce((a, v) => a + v.partner, 0) : null;
  const def = brokeFile ? Object.values(brokeFile).reduce((a, v) => a + v.def, 0) : null;
  const bad = [];
  if (brokeData) bad.push('notes.json에 broke_up/「헤어진」 잔존');
  if (!brokeFile) bad.push('표본 파일 없음');
  else if (total !== 0) bad.push(`화면에 「헤어진 뒤에」 질문이 ${total}장 뜸`);
  const nVariants = (c4.variants || []).length;
  addCase({ id: 'C-Q4', cat: '콘텐츠(2회차)', title: '④ 「마음을 나누는 일」: 이별(broke_up) 변형 삭제(D2-A) — 데이터에 「헤어진」 0, 세 세상 × 2,000판에서 이 질문이 뜬 횟수 0, 변형은 교제·혼인 둘 + 기본', steps: 'notes.json 읽기(변형 when·「헤어진」 검색) + 오라클 표본 6,000판(core를 브라우저에서 불러 ④가 뜬 시점의 질문을 셈)', expected: '변형 문장 0, ④ 질문은 「함께하는 사람과 …」와 기본 둘뿐', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `④ 변형 when=${variantsWhen}(${nVariants}개), 데이터 검색 「헤어진」·broke_up 0, 표본 ④ ${cards4}장 중 이별 변형 ${total} · 함께하는 사람과 ${partner} · 기본 ${def}`, shots: [] });
}

// ---- C-LINT: 10문장 lint (이름 5자 기준)
{
  const FORBID_S1 = ['자살', '자해', '목숨', '죽', '학대', '폭행', '폭력', '구타', '성폭', '성추행', '강간', '트라우마', '사망', '유서', '극단'];
  const FORBID_S2 = ['왜', '어째서', '이유', '때문', '탓', '잘못', '책임', '원인'];
  const EMOTION = ['행복', '기쁨', '슬픔', '외로', '후회', '분노', '두려', '불안', '우울', '괴로', '상처', '고통', '아픔', '눈물', '그리움'];
  const texts = [];
  for (const c of notes.cards) {
    texts.push({ id: c.id, kind: 'prompt', text: c.prompt });
    for (const v of c.variants || []) texts.push({ id: c.id, kind: 'variant', text: v.prompt });
  }
  texts.push({ id: 'manual', kind: 'manual', text: notes.manual.prompt });
  const issues = [];
  for (const t of texts) {
    const filled = t.text.replace(/\{이름\}/g, '가나다라마');
    const is = [];
    for (const w of FORBID_S1) if (t.text.includes(w)) is.push(`S1 「${w}」`);
    for (const w of FORBID_S2) if (t.text.includes(w)) is.push(`S2 「${w}」`);
    for (const w of EMOTION) if (t.text.includes(w)) is.push(`S4 「${w}」`);
    if (!/(있습니까|느껴집니까)\?$/.test(t.text)) is.push('끝맺음');
    if ((t.text.match(/\?/g) || []).length !== 1) is.push('? 개수');
    if (/[!！]/.test(t.text) || /\p{Extended_Pictographic}/u.test(t.text)) is.push('느낌표/이모지');
    if (filled.length > 52) is.push(`길이 ${filled.length}`);
    if (/\{이름\}(이|가|은|는|을|를)(?![가-힣])/.test(t.text)) is.push('이름 뒤 조사');
    if (is.length) issues.push({ id: t.id, kind: t.kind, is });
  }
  const max = Math.max(...texts.map((t) => t.text.replace(/\{이름\}/g, '가나다라마').length));
  addCase({ id: 'C-LINT', cat: '콘텐츠(2회차)', title: '질문 문장 전체(카드 7 + 변형 + 수동)를 QA의 낱말 목록으로 훑기 — 이름을 5자로 셈(T01) · 10문장', steps: 'src/data/notes.json 읽기(읽기만)', expected: '문장 10개, 지적 0, 최장 ≤ 52자', verdict: issues.length || texts.length !== 10 ? 'FAIL' : 'PASS', actual: issues.length || texts.length !== 10 ? `문장 ${texts.length}개, 지적 ${JSON.stringify(issues)}` : `문장 ${texts.length}개, 지적 0, 최장 ${max}자(이름 5자 기준)`, shots: [] });
}

// ---- C-C037: ① 인용 c-037 문장 · 세 세상 머리말 · 100자
{
  const rows = [];
  const bad = [];
  for (const [id, era] of [['Q1', 'present'], ['Q1p', 'past'], ['Q1f', 'future']]) {
    const c = cards.find((x) => x.id === id);
    const txt = c.onScreen.cite.text;
    const src = txt.indexOf('Heckman(');
    const body = txt.slice('연구'.length, src); // 종류 라벨 뒤 ~ 출처 줄 앞 = 머리말 + 본문
    const hasHeader = HEADER[era];
    const expectedBody = `${HEADER[era]}이른 시기의 환경이 성취와 연관된다는 증거를 정리한 경제학 논문으로, ${C037}`;
    rows.push({ era, len: body.length, body });
    if (body !== expectedBody) bad.push(`${era}: 문장 불일치 「${body}」`);
    if (body.length > 100) bad.push(`${era}: ${body.length}자 > 100`);
    for (const w of ['투입', '영향을 준다', '크게']) if (txt.includes(w)) bad.push(`${era}: 「${w}」 잔존`);
    if (c.onScreen.cite.links !== 0) bad.push(`${era}: 인용 박스 안 링크 ${c.onScreen.cite.links}`);
  }
  const data = cites.citations ? cites.citations.find((c) => c.id === 'c-037') : (Array.isArray(cites) ? cites.find((c) => c.id === 'c-037') : null);
  addCase({ id: 'C-C037', cat: '콘텐츠(2회차)', title: '① 영유아기 기억의 인용 c-037 새 문장 — 둘째 절 「…어릴 때의 투자가 이후 투자의 효과와 이어져 있다고 봅니다.」, 세 세상 머리말(지금: 없음 · 지난: 지금의 연구로는 · 다가올: 지금 기준으로는), 표시 길이 ≤ 100자 (CQ05)', steps: '세 세상의 5세 ① 시트를 열어 인용 박스 글을 읽음(종류 라벨·출처 줄 제외)', expected: '기대 문장과 글자까지 같음, ≤100자, 「투입」·「영향을 준다」·「크게」 0', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' | ') : `세 세상 모두 기대 문장 — 표시 길이 지금 ${rows[0].len} · 지난 ${rows[1].len} · 다가올 ${rows[2].len}자(≤100)`, shots: ['Q-infant-memory-default', 'Q-infant-memory-past', 'Q-infant-memory-future'].map((n) => `qa/screenshots/003/M7c-r2-${n}.png`) });
}
console.log('콘텐츠 케이스 기록 완료');
