// QA-003 M7c 2회차 최종 케이스 표: r2/cases.jsonl의 케이스별 마지막 기록 + 정상 플레이·표본 결과에서 합성한 케이스(N·I·CQ·RECORD·SKIP)를 모아
// qa/results/m7c/r2/cases-final.json / cases-final.tsv 로 만든다.
// 사용: node qa/scripts/m7c-r2-final-cases.mjs
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, OUT } from './m7c-r2-lib.mjs';

const rd = (f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const last = new Map();
for (const l of fs.readFileSync(path.join(OUT, 'cases.jsonl'), 'utf8').split('\n').filter(Boolean)) {
  const r = JSON.parse(l);
  last.set(r.id, r);
}
const RELPFX = 'qa/screenshots/003/M7c-r2-';

// ---- 사람이 정한 판정 보정
const OVERRIDE = {
  A21f: { verdict: 'RECORD', why: '코드 포인트를 한 글자씩(keyboard.type) 넣으면 중간 상태의 끝에 매달린 ZWJ가 걷혀 가족 이모지가 3글자로 풀림(1회차와 같은 결과, src 불변). 이모지 키보드·붙여넣기는 시퀀스를 한 번에 넣어 A03a(PASS)와 같은 경로 — 실기기 확인은 M9(1회차 RECORD 그대로 이월)' },
};
const cases = [...last.values()].map((r) => {
  const o = OVERRIDE[r.id];
  return o ? { ...r, verdict: o.verdict, actual: `${o.why} (실행 결과: ${String(r.actual).slice(0, 140)})` } : r;
});

// ---- 정상 플레이 N01~N03
for (const [id, file, era, eraKey] of [['N01', 'play-N01-past.json', '지난', 'past'], ['N02', 'play-N02-present.json', '지금', 'present'], ['N03', 'play-N03-future.json', '다가올', 'future']]) {
  const p = rd(file);
  const bad = [];
  const autos = p.autoSheets || [];
  const first = autos[0];
  const HDR = { past: '지금의 연구로는 ', present: '', future: '지금 기준으로는 ' }[eraKey];
  if (autos.length < 5) bad.push(`자동 카드 ${autos.length}장 < 5`);
  if (!first || !first.cite || first.cite.id !== 'c-037') bad.push('① 인용(c-037) 없음');
  else {
    const t = first.cite.text.replace(/^연구/, '');
    const body = t.slice(0, t.indexOf('Heckman('));
    if (body !== `${HDR}이른 시기의 환경이 성취와 연관된다는 증거를 정리한 경제학 논문으로, 어릴 때의 투자가 이후 투자의 효과와 이어져 있다고 봅니다.`) bad.push(`① 인용 문장·머리말 불일치 「${body}」`);
    if (body.length > 100) bad.push(`① 인용 ${body.length}자 > 100`);
  }
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
  // 새 문구: ③ 기본 질문·라벨(첫사랑)·옛 문구 잔존
  const q3 = autos.find((a) => a.card === 'note-first-love');
  if (q3 && !/(처음 누군가에게 마음이 갔던 기억이 .+에게 있습니까\?|마음을 전했던 그때를 떠올려 보면, .+에게 남아 있는 장면이나 느낌이 있습니까\?)$/.test(q3.title)) bad.push(`③ 질문 불일치 「${q3.title}」`);
  const labels = (p.ending ? p.ending.noteRows : []).map((x) => x.label);
  if (labels.some((l) => /첫사랑의 추억|연애의 기억/.test(l))) bad.push('옛 라벨이 엔딩에 보임');
  if (!labels.includes('나의 기록 · 첫사랑')) bad.push('엔딩 연표에 「나의 기록 · 첫사랑」 줄이 없음');
  if (autos.some((a) => /헤어진 뒤에/.test(a.title))) bad.push('삭제된 ④ 이별 변형 질문이 뜸');
  cases.push({
    id,
    cat: '정상 플로우',
    title: `${era} 세상 한 판(360×740 터치, 8배속·다음 결정으로, 시드 ${p.seed})`,
    steps: '태어나기 → 인생 끝까지. 자동 기록 카드마다 응답을 바꿔 가며(저장·빈 2번·글+2번+확인+돌아가기+저장·글+Esc+확인+버림·이모지 글 저장·빈 1번 오류 후 저장) 처리, 결정 4·8·12·16번째 뒤 수동 「생각 남기기」 4건(저장 3·쓰다 버림 1), 엔딩·새로고침·다시 태어나기. 모든 탭은 실제 터치 탭',
    expected: '자동 카드 5장 이상(① 인용 c-037 새 문장 + 세상별 머리말, 나머지 인용 0), 수동 3건 이상 저장, 엔딩 연표의 나의 기록 줄(③ 라벨 「첫사랑」), 새로고침 뒤 같음, 다시 태어나기 뒤 저장소에 이전 글 0, 콘솔 오류·외부 요청 0',
    actual: bad.length ? `실패: ${bad.join(' | ')}` : `자동 시트 ${autos.length}장[${autos.map((a) => a.card.replace('note-', '')).join(',')}], ① 인용 「…어릴 때의 투자가 이후 투자의 효과와 이어져 있다고 봅니다.」(머리말 ${HDR ? '「' + HDR.trim() + '」' : '없음'}), 수동 ${savedManual.length}건 저장 + 1건 쓰다 버림, 기록 ${p.noteRowsAtEnd.length}줄 → 엔딩 연표 같은 ${p.ending.noteRows.length}줄(라벨 ${[...new Set(labels.map((l) => l.replace('나의 기록 · ', '')))].join('·')}), 새로고침 뒤 같음, 다시 태어난 뒤 저장소 키 ${p.afterRebirth.storageKeys.length}개에 이전 글 0, 포커스(자동 닫힘 → 인생 제목, 수동 → 「생각 남기기」 버튼), 결정 ${p.decisions}번, 콘솔·외부 요청 0`,
    verdict: bad.length ? 'FAIL' : 'PASS',
    shots: p.shots.slice(0, 2).map((s) => s.replace('M7c-', 'M7c-r2-').replace('M7c-r2-r2-', 'M7c-r2-')),
  });
}

// ---- 인생 불변
{
  const inv = rd('invariance-core.json');
  const coreOk = Object.values(inv).every((v) => v.same === v.n);
  cases.push({ id: 'I01', cat: '인생 불변', title: '같은 시드·같은 선택에서 「모두 쓴 판 / 모두 건너뛴 판 / 자동 모드(소비) 판」의 스탯·자산·플래그·seen(note- 제외)·rngState·연표(note 행 제외) 비교 — 세 세상 × 200판(오라클 core)', steps: '개발 서버 core를 브라우저에서 불러 시드 1000~1199를 세 방식으로 끝까지 진행', expected: '600판 모두 같음', actual: Object.entries(inv).map(([e, v]) => `${e} ${v.same}/${v.n}`).join(' · '), verdict: coreOk ? 'PASS' : 'FAIL', shots: [] });
  let ok = true;
  const lines = [];
  for (const [e, s] of [['past', 41], ['present', 51], ['future', 61]]) {
    const w = rd(`play-I-${e}-${s}-w.json`);
    const k = rd(`play-I-${e}-${s}-s.json`);
    const same = JSON.stringify(w.endState) === JSON.stringify(k.endState) && JSON.stringify(w.ending.meta) === JSON.stringify(k.ending.meta) && JSON.stringify(w.ending.nonNoteTimeline) === JSON.stringify(k.ending.nonNoteTimeline);
    if (!same) ok = false;
    lines.push(`${e}/${s}: ${same ? '같음' : '다름'}(기록 ${w.noteRowsAtEnd.length}줄 vs 0, 사망 ${w.endState.age}세)`);
  }
  cases.push({ id: 'I02', cat: '인생 불변', title: '실제 화면 표본: 같은 시드·같은 선택 정책으로 한 번은 카드 전부에 글을 쓰고(자동·수동) 한 번은 모두 건너뛰고 엔딩 비교 — 세 세상 × 1시드(6판)', steps: 'prod 360×740 터치, 8배속·다음 결정으로. 엔딩의 사망 나이·스탯·자산·플래그·seen(note- 제외)·출발선 막대·최종 스탯·연표(note 줄 제외) 비교', expected: '3쌍 모두 같음', actual: lines.join(' · '), verdict: ok ? 'PASS' : 'FAIL', shots: [`${RELPFX}I-past-41-w-ending-top.png`, `${RELPFX}I-past-41-s-ending-top.png`] });
}

// ---- 콘텐츠 표본
{
  const c = rd('content.json');
  const viol = Object.values(c).reduce((a, v) => a + v.nViolations, 0);
  const lives = Object.values(c).reduce((a, v) => a + v.lives, 0);
  const means = Object.entries(c).map(([e, v]) => `${e} ${v.longMean.toFixed(2)}`).join(' · ');
  const meansOk = Object.values(c).every((v) => v.longMean >= 6.0 && v.longMean <= 7.0);
  const questions = new Set();
  for (const v of Object.values(c)) for (const [, qs] of Object.entries(v.questions || {})) for (const q of Object.keys(qs)) questions.add(q.replace(/[가-힣]{3}(에게도|에게|의)/, '{이름}$1').slice(0, 14));
  cases.push({ id: 'CQ01', cat: '콘텐츠', title: '카드 스케줄·전제 대조 — 세 세상 × 300판을 시트 멈춤 모드로 돌려 카드가 뜰 때마다 나이 창·변형(이별 변형 삭제 반영)·플래그·부모 나이·건강·본 이벤트를 QA가 따로 적은 규칙과 대조', steps: '오라클 core로 900판. 간격 ≥2년·한 해 ≤1장·종류당 1회·판당 ≤7장도 셈', expected: '전제 위반 0, 사망 70세 이상 판 평균 카드 수 6.0~7.0', actual: `${lives}판 위반 ${viol}, 사망 70세 이상 평균 ${means}`, verdict: viol === 0 && meansOk ? 'PASS' : 'FAIL', shots: [] });
}

// ---- 합성 RECORD·SKIP·정리
const add = (r) => cases.push({ shots: [], ...r });
{
  const k = ['K03a', 'K03b', 'K03c'].map((i) => last.get(i));
  const ok = k.every((x) => x && x.verdict === 'PASS');
  add({ id: 'K03', cat: '입력 가드', title: '(1회차 RECORD 종결) 확인에서 「돌아가서 이어 쓰기」 직후 Enter — 11-5의 세 단언(돌아간 직후 Enter = 입력란 줄바꿈 / 450ms 뒤 Tab→1번 Enter = 저장 / 400ms 안의 1번 눌림 = 저장 0)', steps: 'K03a~K03c', expected: '세 단언 모두 통과(D4: 그대로 둠)', actual: k.map((x) => `${x.id} ${x.verdict}`).join(' · '), verdict: ok ? 'PASS' : 'FAIL', shots: k.flatMap((x) => (x.shots || []).slice(0, 1)) });
}
add({ id: 'T01', cat: '문서', title: '(1회차 RECORD 종결) 이름 최대 5자 조건 — 정식 시험 조건', steps: 'T-longname: 이름을 5자로 바꾼 저장에서 가장 긴 질문 ③(first_love 변형)을 폭 320·글자 200% 등에서 열기. 질문 문장 길이는 C-LINT(이름 5자 기준 최장 48자 ≤ 52)', expected: '넘침 0', actual: `T-longname ${last.get('T-longname') ? last.get('T-longname').verdict : '(없음)'} · C-LINT ${last.get('C-LINT') ? last.get('C-LINT').verdict : '(없음)'} — 5자가 정식 조건으로 통과`, verdict: last.get('T-longname') && last.get('T-longname').verdict === 'PASS' && last.get('C-LINT') && last.get('C-LINT').verdict === 'PASS' ? 'PASS' : 'FAIL', shots: last.get('T-longname') ? (last.get('T-longname').shots || []).slice(0, 1) : [] });
{
  const vv = fs.readFileSync(path.join(OUT, 'vv.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const comp = vv.filter((r) => r.compact === 'true');
  const trunc = comp.filter((r) => r.title && r.title.truncated);
  add({ id: 'V-obs-title', cat: '관찰(RECORD)', title: 'compact(가상 키보드)에서 질문이 한 줄 줄임표로 줄어 읽을 수 있는 길이가 짧다 — 글자 200%·폭 320에서는 「지금 윤수호의 마…」처럼 한 줄에 아홉 글자 안팎', steps: '가짜 visualViewport 340~740의 compact 상태 ' + comp.length + '개의 질문 제목을 측정(m7c-r2-vv.mjs)', expected: '(D-88 설계) 질문이 sticky 한 줄(줄임표), 입력란·버튼과 겹치지 않음', actual: `설계대로 통과(한 줄 ${comp.filter((r) => r.title.oneLine).length}/${comp.length}, 입력란·1번·2번과 겹침 0, 보이는 영역 안 ${comp.filter((r) => r.title.inView).length}/${comp.length}). 관찰: 줄임표로 잘린 상태가 ${trunc.length}/${comp.length}개 — 질문의 끝(「…있습니까?」)은 compact에서 보이지 않고 compact가 풀려야(질문 제목·입력 영역 밖으로 포커스) 전체가 보인다. 큰 글자 사용자는 입력하는 동안 질문의 앞 몇 글자만 본다(접근 가능한 이름은 전체). 판단은 designer·마스터 몫(실기기 M9와 함께)`, verdict: 'RECORD', shots: [RELPFX + 'V-nocite-320-200-h340.png', RELPFX + 'V-cite-360-100-h340.png'] });
}
add({ id: 'X01', cat: '환경', title: '실기기 가상 키보드(iPhone Safari 16+·Android Chrome)·핀치/두 번 탭 확대·D-84(키보드가 내려간 뒤 머리가 잘려 보이는가)', steps: '(해당 없음 — 이 환경은 Playwright Chromium 헤드리스)', expected: '(완료 기준) 형진 님·QA 한 번 확인 — M9', actual: '가짜 visualViewport 시험(V-*, K1~K7)과 CDP 두 손가락 핀치(PZ-*)로 갈음. 실기기 확인은 M9로 이월(1회차와 같음)', verdict: 'SKIP' });
add({ id: 'X02', cat: '환경', title: 'WebKit·Safari·실기기 이모지 키보드·IME 실조합', steps: '(해당 없음 — 브라우저를 새로 내려받지 않음)', expected: '-', actual: 'CDP imeSetComposition으로 조합 흉내(A19-ime1~3), 이모지 시퀀스는 insertText 한 번(A03)으로 갈음. M9', verdict: 'SKIP' });

// 1회차 케이스 ID와의 대체 관계는 리포트 본문에 적는다(B07 → G-b07-*, B04c → L-40-*)
// ---- 증거 스크린샷이 비어 있는 케이스는 보충 스크린샷(M7c-r2-<ID>.png)이 있으면 붙인다
const allShots = fs.readdirSync(path.join(ROOT, 'qa', 'screenshots', '003')).filter((f) => f.startsWith('M7c-r2-'));
for (const c of cases) {
  if (!c.shots || c.shots.length === 0) {
    const ids = [c.id, c.id.replace(/-run2$/, '-run1')];
    for (const id of ids) {
      const exact = 'M7c-r2-' + id + '.png';
      const hits = allShots.includes(exact) ? [exact] : allShots.filter((f) => f.startsWith('M7c-r2-' + id + '-'));
      if (hits.length) {
        c.shots = hits.slice(0, 2).map((f) => RELPFX + f.slice('M7c-r2-'.length));
        break;
      }
    }
  }
}
cases.sort((a, b) => String(a.id).localeCompare(String(b.id), 'en', { numeric: true }));
fs.writeFileSync(path.join(OUT, 'cases-final.json'), JSON.stringify(cases, null, 1));
const tsv = ['ID\t분류\t제목\t절차\t기대\t실제\t판정\t스크린샷'];
const clean = (s) => String(s ?? '').replace(/[\t\n\r]+/g, ' ');
for (const c of cases) tsv.push([c.id, c.cat || '', clean(c.title), clean(c.steps), clean(c.expected), clean(c.actual), c.verdict, (c.shots || []).slice(0, 2).join(' ; ')].join('\t'));
fs.writeFileSync(path.join(OUT, 'cases-final.tsv'), tsv.join('\n'));
const cnt = {};
for (const c of cases) cnt[c.verdict] = (cnt[c.verdict] || 0) + 1;
console.log(`케이스 ${cases.length}건`, JSON.stringify(cnt));
for (const c of cases.filter((x) => x.verdict !== 'PASS')) console.log(`[${c.verdict}] ${c.id} ${String(c.title).slice(0, 80)} :: ${String(c.actual).slice(0, 200)}`);
// 단언 수 · 콘솔/외부 요청
let asserts = 0;
for (const c of cases) if (Array.isArray(c.checks)) asserts += c.checks.length;
const cons = cases.filter((c) => (c.console && c.console.length) || (c.externalRequests && c.externalRequests.length));
console.log('단언', asserts, '콘솔·외부 요청 있는 케이스', cons.map((c) => c.id).join(','));
