// QA-003 M7c 최종 케이스 표: cases.jsonl의 케이스별 마지막 기록 + 플레이·표본 결과에서 합성한 케이스(N·I·C·SKIP·RECORD)를 모아 cases-final.json / cases-final.tsv / report-body.txt(그룹 표)를 만든다.
// 사용: node qa/scripts/m7c-final-cases.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT } from './m7c-lib.mjs';

const rd = (f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const last = new Map();
for (const l of fs.readFileSync(path.join(OUT, 'cases.jsonl'), 'utf8').split('\n').filter(Boolean)) {
  const r = JSON.parse(l);
  last.set(r.id, r);
}
const shotPath = (r) => (r.shots && r.shots.length ? r.shots[0] : '-');

// ---- 사람이 정한 판정 보정: 같은 사실을 마스터가 한눈에 보도록 FAIL → RECORD
const OVERRIDE = {
  A21f: { verdict: 'RECORD', why: '코드 포인트를 한 글자씩(keyboard.type) 넣으면 중간 상태의 끝에 매달린 ZWJ가 걷혀 가족 이모지가 3글자로 풀림(👨👩👧). 실제 이모지 키보드·붙여넣기는 시퀀스 전체를 한 번에 넣으므로 A03a(PASS)와 같은 경로에서 유지됨 — 실기기(M9)에서 이모지 키보드로 한 번 확인' },
};
const cases = [...last.values()].map((r) => {
  const o = OVERRIDE[r.id];
  return o ? { ...r, verdict: o.verdict, actual: `${o.why} (원 실행 결과: ${String(r.actual).slice(0, 160)})` } : r;
});

// ---- 정상 플레이 N01~N03
for (const [id, file, era] of [['N01', 'play-N01-past.json', '지난'], ['N02', 'play-N02-present.json', '지금'], ['N03', 'play-N03-future.json', '다가올']]) {
  const p = rd(file);
  const bad = [];
  const autos = p.autoSheets || [];
  const first = autos[0];
  if (autos.length < 5) bad.push(`자동 카드 ${autos.length}장 < 5`);
  if (!first || !first.cite || first.cite.id !== 'c-037') bad.push('① 인용(c-037) 없음');
  if (autos.slice(1).some((a) => a.cite)) bad.push('① 밖에 인용 박스가 뜸');
  const savedManual = (p.manual || []).filter((m) => m.action === 'save');
  if (savedManual.length < 3) bad.push(`수동 저장 ${savedManual.length}건 < 3`);
  if (autos.some((a) => a.focusAfter !== 'life-name')) bad.push('자동 카드 닫힌 뒤 포커스가 인생 제목이 아님');
  if ((p.manual || []).some((m) => m.focusAfter !== 'tool-note')) bad.push('수동 닫힌 뒤 포커스가 「생각 남기기」 버튼이 아님');
  if (!autos.some((a) => a.confirm)) bad.push('확인 단계를 안 거침');
  const actions = autos.map((a) => a.action);
  for (const need of ['save', 'skip-empty', 'skip-text-back-save', 'esc-text-discard']) if (!actions.includes(need)) bad.push(`동작 ${need} 없음`);
  if (!p.ended) bad.push('엔딩에 못 이름');
  if (!p.ending || p.ending.noteRows.length !== p.noteRowsAtEnd.length) bad.push('엔딩 연표의 나의 기록 줄 수 ≠ 저장');
  if (JSON.stringify(p.endingReloadNoteTexts) !== JSON.stringify(p.noteRowsAtEnd.map((x) => x.text))) bad.push('엔딩 새로고침 뒤 연표가 다름');
  if (p.afterRebirth.leftover.length) bad.push('다시 태어난 뒤 이전 글이 저장소에 남음');
  if (p.errors.length || p.ext.length) bad.push(`오류 ${p.errors.length}·외부 요청 ${p.ext.length}`);
  if (p.ending && p.ending.docOverflow) bad.push('엔딩 가로 넘침');
  cases.push({
    id,
    cat: '정상 플로우',
    title: `${era} 세상 한 판(360×740 터치, 8배속·다음 결정으로, 시드 ${p.seed})`,
    steps: '태어나기 → 인생 끝까지. 자동 기록 카드마다 응답을 바꿔 가며(저장·빈 2번·글+2번+확인+돌아가기+저장·글+Esc+확인+버림·이모지 글 저장·빈 1번 오류 후 저장) 처리, 결정 4·8·12·16번째 뒤 수동 「생각 남기기」 4건(저장 3·쓰다 버림 1), 엔딩 확인·새로고침·다시 태어나기',
    expected: '자동 카드 5장 이상(① 인용 있음, 나머지 없음), 수동 3건 이상 저장, 엔딩 연표에 나의 기록 줄, 새로고침 뒤 같음, 다시 태어나기 뒤 저장소에 이전 글 0',
    actual: bad.length ? `실패: ${bad.join(' | ')}` : `자동 시트 ${autos.length}장[${autos.map((a) => a.card.replace('note-', '')).join(',')}], 수동 ${savedManual.length}건 저장 + 1건 쓰다 버림, 기록 ${p.noteRowsAtEnd.length}줄 → 엔딩 연표 같은 ${p.ending.noteRows.length}줄, 새로고침 뒤 같음, 다시 태어난 뒤 저장소 키 ${p.afterRebirth.storageKeys.length}개(게임·설정)에 이전 글 0, 결정 ${p.decisions}번·${Math.round(p.ms / 1000)}초, 콘솔 오류 0·외부 요청 0`,
    verdict: bad.length ? 'FAIL' : 'PASS',
    shots: p.shots.slice(0, 2),
  });
}

// ---- 인생 불변
{
  const inv = rd('invariance-core.json');
  const coreOk = Object.values(inv).every((v) => v.same === v.n);
  cases.push({ id: 'I01', cat: '인생 불변', title: '같은 시드·같은 선택에서 「모두 쓴 판 / 모두 건너뛴 판 / 자동 모드(소비) 판」의 스탯·자산·플래그·seen(note- 제외)·rngState·연표(note 행 제외) 비교 — 세 세상 × 200판(오라클 core)', steps: '개발 서버 core를 브라우저에서 불러 시드 1000~1199를 세 방식으로 끝까지 진행', expected: '600판 모두 세 방식의 결과가 같음', actual: `past ${inv.past.same}/${inv.past.n} · present ${inv.present.same}/${inv.present.n} · future ${inv.future.same}/${inv.future.n} 동일 (첫 시험 한 번은 내 선택 정책이 반복 번호에 의존해 600판 모두 달랐고 정책을 「몇 번째 결정인가」로 고쳐 다시 돌림 — 도구 문제)`, verdict: coreOk ? 'PASS' : 'FAIL', shots: [] });
  let ok = true;
  const lines = [];
  for (const [e, s] of [['past', 41], ['past', 42], ['present', 51], ['present', 52], ['future', 61], ['future', 62]]) {
    const w = rd(`play-I-${e}-${s}-w.json`);
    const k = rd(`play-I-${e}-${s}-s.json`);
    const same = JSON.stringify(w.endState) === JSON.stringify(k.endState) && JSON.stringify(w.ending.meta) === JSON.stringify(k.ending.meta) && JSON.stringify(w.ending.nonNoteTimeline) === JSON.stringify(k.ending.nonNoteTimeline);
    if (!same) ok = false;
    lines.push(`${e}/${s}: ${same ? '같음' : '다름'}(기록 ${w.noteRowsAtEnd.length}줄 vs 0, 사망 ${w.endState.age}세)`);
  }
  cases.push({ id: 'I02', cat: '인생 불변', title: '실제 화면 표본: 같은 시드·같은 선택 정책으로 한 번은 카드 전부에 글을 쓰고(자동 7장·수동 4건) 한 번은 모두 건너뛰고 엔딩 비교 — 세 세상 × 2시드(12판)', steps: 'prod 360×740 터치, 8배속·다음 결정으로. 엔딩의 사망 나이·스탯·자산·플래그·seen(note- 제외)·출발선 막대·최종 스탯·연표(note 줄 제외) 비교', expected: '6쌍 모두 같음', actual: lines.join(' · '), verdict: ok ? 'PASS' : 'FAIL', shots: ['qa/screenshots/003/M7c-I-past-41-w-ending-top.png', 'qa/screenshots/003/M7c-I-past-41-s-ending-top.png'] });
}

// ---- 콘텐츠
{
  const c = rd('content.json');
  const lint = rd('lint.json');
  const viol = Object.values(c).reduce((a, v) => a + v.nViolations, 0);
  const lives = Object.values(c).reduce((a, v) => a + v.lives, 0);
  cases.push({ id: 'CQ01', cat: '콘텐츠', title: '카드 스케줄·전제 대조 — 세 세상 × 300판을 시트 멈춤 모드로 돌려 카드가 뜰 때마다 나이 창·변형·플래그·부모 나이·건강·본 이벤트를 QA가 따로 적은 규칙과 대조', steps: '오라클 core로 900판. 간격 ≥2년·한 해 ≤1장·종류당 1회·판당 ≤7장도 셈', expected: '전제 위반 0, 평균 카드 수가 기획 추정(6.0~7.0)', actual: `${lives}판 위반 ${viol}건. 사망 70세 이상 판의 평균 카드 수 past ${c.past.longMean.toFixed(2)} · present ${c.present.longMean.toFixed(2)} · future ${c.future.longMean.toFixed(2)}(최대 ${Math.max(c.past.maxPerLife, c.present.maxPerLife, c.future.maxPerLife)}장). 도달률 ①~⑦ present ${['infant-memory', 'teen-envy', 'first-love', 'youth-romance', 'parents-aging', 'midlife', 'illness'].map((k) => Math.round((c.present.cards['note-' + k] || 0) / 3) + '%').join('·')}`, verdict: viol === 0 ? 'PASS' : 'FAIL', shots: [] });
  const bad = lint.filter((o) => o.issues.length);
  cases.push({ id: 'CQ02', cat: '콘텐츠', title: '질문 11문장(카드 7종·변형 3·수동 1)의 독립 문구 점검 — S1 금지어·S2 캐묻는 낱말(왜·이유·때문·탓…)·S4 감정 낱말·끝맺음 「있습니까?/느껴집니까?」·? 한 개·느낌표·이모지·문장 길이(≤52, 이름 3자)·이름 뒤 조사', steps: 'src/data/notes.json을 QA가 따로 적은 낱말 목록으로 훑음', expected: '지적 0', actual: bad.length ? bad.map((o) => `${o.id}: ${o.issues.join(',')}`).join(' | ') : `문장 ${lint.length}개 지적 0 (길이 32~49자)`, verdict: bad.length ? 'FAIL' : 'PASS', shots: [] });
  const cards = rd('cards.json');
  cases.push({ id: 'CQ03', cat: '콘텐츠', title: '사람 눈 판독 — 실제 화면(360×740)에 뜬 질문 7종·변형·수동 질문 13장: 전제가 맞는가·무겁거나 캐묻는 느낌·안전 기준', steps: '각 카드·변형이 뜬 상태(플래그·부모 나이·건강·본 이벤트가 맞는 판)를 만들어 화면을 읽음(스크린샷 13장)', expected: '전제 일치, 병·가족·이별·시기 카드가 원인·증상·책임을 묻지 않음, 정답·평가를 요구하지 않음', actual: '13장 중 12장을 화면에서 읽음(④ 이별 변형은 어떤 판에서도 안 떠 화면 없음 — CQ04). ③ 「마음을 전했던 그때」는 first_love 판에만(플래그 없는 판에는 「처음 누군가에게 마음이 갔던 때」), ④ 「함께하는 사람과」는 has_partner 판에만, ⑤ 「몸이 아팠던 시간」은 사건 뒤·건강 ≤35 판에만, ⑥ 「부모님이 …」는 가까운 부모 한 분이 65세 이상·parents_gone 아닌 판에만. 질문은 모두 장면·느낌·순간 하나를 묻고 원인·잘잘못·병명·증상을 묻지 않으며 「있습니까?」로 끝나 「없다」도 답이 됨. 무거운 주제(⑤ 아팠던 시간 · ⑥ 부모님의 나이듦)도 서술이 아닌 「남아 있는 마음이나 장면」 한 가지만 묻고 69·73세에 뜬 ⑤도 담담함', verdict: 'PASS', shots: ['qa/screenshots/003/M7c-Q-infant-memory-default.png', 'qa/screenshots/003/M7c-Q-illness-event.png', 'qa/screenshots/003/M7c-Q-first-love-first_love.png'] });
}

// ---- 합성 RECORD·SKIP
const add = (r) => cases.push({ shots: [], ...r });
add({ id: 'CQ04', cat: '콘텐츠', title: '④ 연애의 기억 「헤어진 뒤에 지나온 시간을 떠올려 보면…」(broke_up 변형) 도달 수', steps: '세 세상 × 2,000판(오라클 core)에서 ④가 뜰 때 변형을 셈(m7c-broke.mjs)', expected: '(참고) 이별 변형이 이따금 뜸', actual: `카드 5,982장 중 이별 변형 0장(함께하는 사람과 ${728 + 530 + 473}장 · 기본 ${1263 + 1465 + 1523}장). broke_up 플래그가 켜지는 판은 617·505·438판이나 그 시점에 ④가 이미 소비됨(has_partner·jitter로 먼저 뜸) → 변형이 사실상 죽은 콘텐츠. 안전·기능 결함은 아님. 기획 판단: 변형 삭제 또는 ④ 시기 조정`, verdict: 'RECORD' });
  add({ id: 'CQ05', cat: '콘텐츠', title: '① 영유아기 기억 카드의 인용 c-037 문장(「이른 시기 투입이 이후 투입의 효과에 크게 영향을 준다고 봅니다」)', steps: '세 세상에서 ① 시트의 인용 박스를 읽음', expected: '(content-M7c S7) 연관 표현만, 결정론·자책 금지', actual: '첫 절은 「연관된다는 증거」(연관)인데 둘째 절 「크게 영향을 준다고 봅니다」는 인과·강한 표현이고 「이후 투입」은 일반 독자에게 낯선 말. 5세 기억을 묻는 바로 아래에 놓여 「이른 시기가 크게 좌우한다」로 읽힐 여지. 지난 세상 머리말 「지금의 연구로는」·다가올 세상 「지금 기준으로는」은 규칙대로(지금 세상은 머리말 없음). 데이터(citations.json) 문장 손질은 수집·designer 몫 — reviewer 콘텐츠 판독 대상', verdict: 'RECORD', shots: ['qa/screenshots/003/M7c-Q-infant-memory-future.png'] });
add({ id: 'CQ06', cat: '콘텐츠', title: '③ 기본 질문 「처음 누군가에게 마음이 갔던 때를 떠올려 보면, …에게 기억나는 장면이 있습니까?」의 전제', steps: 'first_love 플래그 없는 판(전체의 약 95%)에서 18~22세에 뜬 질문을 읽음', expected: '(S3) 전제하지 않음', actual: '끝은 「있습니까?」로 없다도 답이지만 앞절 「처음 누군가에게 마음이 갔던 때를 떠올려 보면」이 그런 때가 있었다고 기정한 말로 읽힘(교제·호감을 겪지 않은 사람). 이전 안(content-M7c 1-4)과 같은 한계로 designer가 한 번 검토 권고. 안전 문제는 아님', verdict: 'RECORD', shots: ['qa/screenshots/003/M7c-Q-first-love-default.png'] });
add({ id: 'K03', cat: '입력 가드', title: '확인 단계에서 「돌아가서 이어 쓰기」로 돌아온 직후 키보드 Enter — 다시 만들어진 1번·2번 버튼의 입력 가드 400ms 동안 아무 반응·안내가 없다', steps: '글을 쓰고 Esc → 확인 → Esc(돌아가기) → 300ms 뒤 Tab → 1번에서 Enter', expected: '(참고) 가드 중 입력은 무시(CM5)', actual: '무시됨(저장 0·시트 그대로) — 설계대로이나 키보드·스위치 사용자는 반응 없음에 당황할 수 있음. 500ms 뒤 Enter는 저장됨. 기능 결함 아님', verdict: 'RECORD' });
add({ id: 'U01', cat: '표시', title: '사용자 글은 음절 단위로 줄바꿈된다(「밑에/서」처럼 낱말 가운데서 끊김)', steps: '정상 문장 글의 인생 기록·엔딩 줄을 360폭에서 읽음', expected: '(content-M7c D4) 사용자 글은 word-break: normal — 낱말 끊김 감사에서 제외', actual: '설계대로(띄어쓰기 없는 긴 글이 넘치지 않게 전역 keep-all을 풂). 다만 평범한 한글 문장도 낱말 중간에서 끊겨 읽기에 거슬림(스크린샷). 결함 아님 — 취향·UX 의견', verdict: 'RECORD', shots: ['qa/screenshots/003/M7c-N01-past-ending-note-row.png'] });
add({ id: 'T01', cat: '문서', title: '문서 6-4절·QA 항목의 「이름 20자」 시험 조건', steps: '저장 검증(storage.ts#CHARACTER_NAME_PATTERN)과 대조', expected: '(참고)', actual: '이름은 한글 3~5자만 통과(NC-13). 「가장 긴 질문(이름 20자)」 시험은 도달 불가 — 5자로 대체해 T-longname 통과(폭 320·글자 200%). 문서 6-4·7-4의 이름 최대 길이 문구를 갱신 권고', verdict: 'RECORD' });
add({ id: 'X01', cat: '환경', title: '실기기 가상 키보드(iPhone Safari 16+·Android Chrome): 입력란 포커스에서 두 버튼이 보이는가·확대가 일어나지 않는가·배경이 움직이지 않는가', steps: '(해당 없음 — 이 환경은 Playwright Chromium 헤드리스)', expected: '(완료 기준) 형진 님·QA 한 번 확인 — M9', actual: '가짜 visualViewport 시험(V-*, K1~K7)과 입력란 글자 16px 단언으로 갈음. 실제 키보드·iOS 확대·주소창 변화는 못 봄', verdict: 'SKIP' });
add({ id: 'X02', cat: '환경', title: 'WebKit·Safari·실기기 이모지 키보드(ZWJ 시퀀스를 한 번에 넣는가)·IME 실조합', steps: '(해당 없음 — 브라우저를 새로 내려받지 않음)', expected: '-', actual: 'CDP imeSetComposition으로 조합 흉내(A19-ime1~3), 이모지 시퀀스는 insertText 한 번(A03)으로 갈음. 실기기 확인은 M9', verdict: 'SKIP' });

// ---- 증거 스크린샷이 비어 있는 케이스는 보충 스크린샷(M7c-<ID>.png)이 있으면 붙인다
for (const c of cases) {
  if (!c.shots || c.shots.length === 0) {
    const p = path.join(ROOT, 'qa', 'screenshots', '003', 'M7c-' + c.id + '.png');
    if (fs.existsSync(p)) c.shots = ['qa/screenshots/003/M7c-' + c.id + '.png'];
  }
}
// ---- 출력
cases.sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
fs.writeFileSync(path.join(OUT, 'cases-final.json'), JSON.stringify(cases, null, 1));
const tsv = ['ID\t분류\t제목\t절차\t기대\t실제\t판정\t스크린샷'];
const clean = (s) => String(s ?? '').replace(/[\t\n\r]+/g, ' ');
for (const c of cases) tsv.push([c.id, c.cat || '', clean(c.title), clean(c.steps), clean(c.expected), clean(c.actual), c.verdict, (c.shots || []).slice(0, 2).join(' ; ')].join('\t'));
fs.writeFileSync(path.join(OUT, 'cases-final.tsv'), tsv.join('\n'));
const cnt = {};
for (const c of cases) cnt[c.verdict] = (cnt[c.verdict] || 0) + 1;
console.log(`케이스 ${cases.length}건`, JSON.stringify(cnt));
for (const c of cases.filter((x) => x.verdict !== 'PASS')) console.log(`[${c.verdict}] ${c.id} ${String(c.title).slice(0, 80)} :: ${String(c.actual).slice(0, 160)}`);
