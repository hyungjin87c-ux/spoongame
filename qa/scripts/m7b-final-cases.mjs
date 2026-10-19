// QA-003 M7b 최종 케이스 표 만들기: cases.jsonl(마지막 기록만) + 수확·플레이·감사·훑기 파일에서 계산한 케이스 → cases-final.json · cases-final.tsv, 표준 출력에 마크다운 표
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m7b-lib.mjs';

const rd = (f) => fs.readFileSync(path.join(OUT, f), 'utf8');
const jl = (f) => rd(f).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const last = {};
for (const c of jl('cases.jsonl')) last[c.id] = c;

const extra = [];
const add = (c) => extra.push({ console: [], externalRequests: [], shots: [], ...c });

// ---- N01~N03 정상 플레이
for (const [id, f, era] of [['N01', 'play-N01-past.json', '지난 세상'], ['N02', 'play-N02-present.json', '지금 세상'], ['N03', 'play-N03-future.json', '다가올 세상'], ['N04', 'play-N04-past-research.json', '지난 세상(연구 인용 카드가 첫 카드인 시드)']]) {
  const r = JSON.parse(rd(f));
  const modes = r.cards.reduce((a, c) => ((a[c.mode] = (a[c.mode] || 0) + 1), a), {});
  const cites = r.cards.filter((c) => c.cite);
  const stat = cites.filter((c) => c.cite.kind === '통계').length;
  const res = cites.filter((c) => c.cite.kind === '연구').length;
  const m = /(\d+)번의 선택/.exec(r.endingText || '');
  const bad = [];
  if (!r.ended) bad.push('엔딩에 닿지 못함');
  if (r.cards.length < 20) bad.push(`카드 ${r.cards.length}장 < 20`);
  if (r.errors.length) bad.push(`오류 ${r.errors.length}`);
  if (r.ext.length) bad.push(`외부 요청 ${r.ext.length}`);
  if (!(m && Number(m[1]) === r.cards.length)) bad.push(`엔딩 선택 수 ${m && m[1]} ≠ 카드 ${r.cards.length}`);
  if (r.cards.some((c) => c.docOverflow)) bad.push('가로 넘침');
  const foldOk = r.events.some((e) => /^접기: mode=fold focus=decision-reopen note=다시 열 때까지 시간은 멈춥니다\./.test(e)) && r.events.some((e) => /^다시 열기: mode=inline/.test(e)) && r.events.some((e) => /포커스=life-name/.test(e));
  if (!foldOk) bad.push('접기→자동 켜기→다시 열기→자동 선택→포커스 순서 이상');
  const heads = [...new Set(cites.map((c) => (c.cite.text.startsWith('지금의 연구로는') ? '지금의 연구로는' : c.cite.text.startsWith('지금 기준으로는') ? '지금 기준으로는' : null)).filter(Boolean))];
  add({ id, cat: '정상', title: `${era} 한 판(prod, 360×740 터치 탭, 8배속)`, steps: `첫 화면 → ${era} → 룰렛 → 출생신고 → 인생 시작 → 카드마다 읽고 탭(수동 시트) → 8번째 카드에서 접기 → 접힌 채 자동 켜기(3.6초 기다려 선택 0 확인) → 다시 열기 → 인라인 카드 자동 선택 → … → 엔딩`, expected: '카드 20장 이상, 시트 → 접힌 띠 → 인라인 전환 정상, 엔딩의 「N번의 선택」 = 본 카드 수, 오류·외부 요청 0', actual: `카드 ${r.cards.length}장(시트 ${modes.sheet}·인라인 ${modes.inline}), 인용 ${cites.length}장(통계 ${stat}·연구 ${res}, 머리말 ${heads.join('·') || '없음'})·인용 없는 카드 ${r.cards.length - cites.length}장, 엔딩 선택 수 ${m && m[1]}, 오류·외부 요청 0, 자동 선택 직후 포커스 life-name, ${Math.round(r.ms / 1000)}초${bad.length ? ' || ' + bad.join(' / ') : ''}`, verdict: bad.length ? 'FAIL' : 'PASS', shots: [`qa/screenshots/003/M7b-${f.replace('play-', '').replace('.json', '')}-c01-*.png … -ending.png (${r.shots.length}장)`] });
}

// ---- 수확 분석
const A = JSON.parse(rd('harvest-analysis.json'));
const BE = A.byEra;
add({ id: 'H01', cat: '정상', title: `전 생애 수확 ${A.lives}판(세 세상 × 60판, 360×740 모바일, 개발 서버 시간 배율)`, steps: '실제 화면에서 0세~사망까지 돌며 카드마다 머리·제목·상황·인용(종류·문장·출처 줄·링크 수)·선택지·안내를 읽고 정책(섞음)대로 하나를 누른다', expected: '모든 판이 엔딩, 카드 구조(「중대 결정」·「연도년 · 나이세」·자동 모드 꺼짐 문장 한 줄), 링크·URL·DOI 0, 인용 문자열 ≤ 100자·합쇼체, 시대 머리말 규칙, 오류·외부 요청 0', actual: `${A.lives}판 모두 엔딩, 카드 ${A.cards}장(지난 ${BE.past.cards}·지금 ${BE.present.cards}·다가올 ${BE.future.cards}) 전부 수동 시트, 이벤트 90개 전부 등장, 구조 위반 ${A.problems.length}건, 링크·URL·DOI 0, 오류 ${Object.values(BE).reduce((s, e) => s + e.errors, 0)}·외부 요청 ${Object.values(BE).reduce((s, e) => s + e.ext, 0)}. 인용이 보인 카드 비율(노출률, 보고): 지난 ${BE.past.citedRatio}%·지금 ${BE.present.citedRatio}%·다가올 ${BE.future.citedRatio}%, 서로 다른 인용 ${A.uniqueCiteIds}개(세상별 문장 ${A.uniqueCites}가지), 한 판에서 같은 인용 두 번은 c-011 한 쌍뿐(지금 1판)`, verdict: A.problems.length ? 'FAIL' : 'PASS', shots: ['(대량 표본) qa/results/m7b/samples-harvest-*.jsonl'] });
add({ id: 'F01', cat: '정상', title: '수확 중 접기 시험 — 카드 3장에 한 번 접기 → 접힌 띠 → 시간 정지 → 다시 열기', steps: '수확 1,436번: 접기 → 80ms 뒤 띠 읽기 → 0.9초 기다려 나이·진행률 비교 → 다시 열기 → 80ms 뒤 카드·포커스 읽기', expected: '띠(같은 key)·「다시 열 때까지 시간은 멈춥니다.」·포커스 「결정 다시 열기」·다이얼로그 0·나이·진행률 불변 / 다시 열기 뒤 같은 시트·같은 선택지·포커스 제목', actual: `${A.foldTests}번 모두 기대대로(실패 ${Object.values(BE).reduce((s, e) => s + e.foldFail, 0)})`, verdict: Object.values(BE).some((e) => e.foldFail) ? 'FAIL' : 'PASS', shots: ['qa/screenshots/003/M7b-N02-present-c08-folded.png'] });
add({ id: 'P02', cat: '정상', title: '지난 세상 인용의 연도(수확 60판 · 출생 1950~1989 · 카드 1,411장 · 인용 131장)', steps: '지난 세상 카드의 인용 문장에서 「N년」을 뽑아 게임 속 연도(머리의 연도)와 견주고, school-early-work·school-exam·기타 지난 세상 인용 카드를 연도별로 모은다', expected: '게임 속 연도보다 미래 연도의 통계 값 노출 0, 인용은 validFromYear(c-100·c-101 1980, c-097 1970, c-091 1985, c-098 1980, c-099 1971) 이후에만', actual: '미래 값 노출 0. school-early-work 1976년 이전 없음 → 1980년부터 c-100(보인 최소 1980), school-exam 1978년 이전 없음 → 1982년부터 c-101(1980·81년은 P01에서 확인), youth-first-job 1984년 없음 → 1985년부터 c-091, youth-marriage 1978년 없음 → 1983년부터 c-098, school-family-priority 1967년 없음 → 1981년부터 c-097, youth-child 13/13 모두 보임(최소 1986), infant-new-sibling(c-033 연구) 10/10 「지금의 연구로는」. 경계가 어긋난 카드 0', verdict: BE.past.pastYearViolations.length ? 'FAIL' : 'PASS', shots: ['qa/screenshots/003/M7b-P01-school-early-work-year1979-birth1965.png', 'qa/screenshots/003/M7b-P01-school-early-work-year1980-birth1967.png'] });

// ---- L03·L04 감사·훑기
const AU = jl('audit.jsonl').filter((r) => !r.err);
const ERRS = jl('audit.jsonl').filter((r) => r.err).length;
const auditIss = { over: 0, wb: 0, wbUn: [], sep: 0, leak: 0, focus: [], missing: 0, stops: 0 };
for (const r of AU) {
  const k = `${r.card}/${r.mode}/${r.vp}/${r.font}`;
  if (r.m.docOverflow > 0 || r.m.over.length || r.m.clipped.length) auditIss.over++;
  if (r.wb.broken.length) auditIss.wb++;
  for (const u of r.wb.unavoidable) auditIss.wbUn.push(`${r.card}/${r.mode}/${r.vp}/${r.font}%: ${u.word}[${u.natural}>${u.lineW}]`);
  if (r.sep.length) auditIss.sep++;
  if (r.tab.leak.length) auditIss.leak++;
  if (r.tab.issues.length) auditIss.focus.push(`${k}: ${r.tab.issues.map((i) => i.id).join('·')}`);
  if (r.tab.missing.length) auditIss.missing++;
  auditIss.stops += r.tab.fwd.length;
}
const byMode = AU.reduce((a, r) => ((a[r.mode] = (a[r.mode] || 0) + 1), a), {});
const wbUnWords = [...new Set(auditIss.wbUn.map((s) => s.split(': ')[1].replace(/\[.*/, '')))];
add({ id: 'L03', cat: '레이아웃', title: `공통 뷰포트 11종 × 상태 3(시트·접힌 띠·인라인) × 카드 7종 × 글자 100·200% = ${AU.length}조합`, steps: 'prod에서 상태를 열고 가로 넘침(문서·카드 안 요소)·카드 안 낱말 끊김(독립 측정기, 시트는 스크롤 위치를 0.6화면씩 훑음)·줄 끝·첫머리 구분 기호(·, —, /)·Tab 순회의 가려진 포커스(elementFromPoint 5점)·시트 밖으로 새는 포커스·못 닿는 컨트롤을 잰다', expected: '넘침 0, 결함 끊김 0, 구분 기호 0, 가려진 포커스 0(CM10), Tab이 시트 밖으로 새지 않음, 못 닿는 컨트롤 0', actual: `${AU.length}조합(시트 ${byMode.sheet}·접힌 띠 ${byMode.fold}·인라인 ${byMode.inline}, 측정 오류 ${ERRS}), Tab 정지 ${auditIss.stops}번: 가로 넘침 ${auditIss.over}·결함 끊김 ${auditIss.wb}·구분 기호 ${auditIss.sep}·시트 밖 포커스 ${auditIss.leak}·못 닿는 컨트롤 ${auditIss.missing}. 가려진 포커스 ${auditIss.focus.length}조합 — ${auditIss.focus.join(' ; ') || '없음'}(전부 인라인·폭 320·글자 200%에서 선택지가 보이는 영역보다 키가 커서 위쪽 변은 보이고 아래쪽 모서리가 아래 고정 띠에 가림 — CM10 예외 ②). 한 줄보다 긴 낱말 ${auditIss.wbUn.length}건(${wbUnWords.join('·') || '없음'}, 인라인 카드·글자 200%)`, verdict: auditIss.over || auditIss.wb || auditIss.sep || auditIss.leak || auditIss.missing || ERRS ? 'FAIL' : auditIss.focus.length || auditIss.wbUn.length ? 'RECORD' : 'PASS', shots: ['qa/screenshots/003/M7b-L03-1280x800-sheet.png', 'qa/screenshots/003/M7b-L03-667x375-landscape-sheet.png', 'qa/screenshots/003/M7b-L03-320x256-zoom400-sheet.png', 'qa/screenshots/003/M7b-L03-inline-320x568-200-sibling-past-choice-notice.png'] });

const SW = jl('sweep.jsonl').filter((r) => !r.err);
const SWERR = jl('sweep.jsonl').filter((r) => r.err).length;
const sc = { cards: new Set(SW.map((x) => x.ev)).size, pairs: new Set(SW.map((x) => x.era + '|' + x.ev)).size };
const cfgStat = {};
for (const cfg of ['360x740@100', '320x568@200']) {
  const R = SW.filter((x) => x.cfg === cfg);
  cfgStat[cfg] = { n: R.length, over: R.filter((x) => x.m.docOverflow > 0 || x.m.over.length || x.m.clipped.length).length, wb: R.filter((x) => x.wb.broken.length).length, wbu: [...new Set(R.flatMap((x) => x.wb.unavoidable.map((u) => u.replace(/\[.*/, ''))))], sep: R.filter((x) => x.sep.length).length, noReach: R.filter((x) => x.m.sheet.reach.autoNoteInside === false).length };
}
const R360 = SW.filter((x) => x.cfg === '360x740@100');
const scroll = R360.filter((x) => x.m.sheet.canScroll);
const noCue = scroll.filter((x) => x.m.scrollCue.cut.length === 0);
const choiceHidden = R360.filter((x) => x.m.scrollCue.hiddenBelow.some((h) => /^choice-(?!hint)/.test(h))).length;
const choiceCut = R360.filter((x) => x.m.scrollCue.cut.some((h) => /^choice-(?!hint)/.test(h))).length;
add({ id: 'L04', cat: '레이아웃', title: `카드 90개 전수 훑기(시트, ${sc.pairs}개 카드×세상) — 360×740 글자 100% · 320×568 글자 200%`, steps: '수확에 나온 카드×세상마다 그 카드가 대기 중인 저장을 만들어(개발 서버 core) prod에서 시트로 열고 넘침·낱말 끊김·구분 기호·스크롤 도달·맨 위 화면의 단서를 잰다(조건부 카드 9종은 선택 정책을 바꿔 찾음)', expected: '넘침 0, 결함 끊김 0, 구분 기호 0, 모든 카드의 안내까지 스크롤로 닿음', actual: `카드 ${sc.cards}/90개 · ${sc.pairs}개 카드×세상 × 2설정 = ${SW.length}측정(오류 ${SWERR}): 360×740 넘침 ${cfgStat['360x740@100'].over}·끊김 ${cfgStat['360x740@100'].wb}·기호 ${cfgStat['360x740@100'].sep}·안내 못 닿음 ${cfgStat['360x740@100'].noReach} / 320×568@200% 넘침 ${cfgStat['320x568@200'].over}·결함 끊김 ${cfgStat['320x568@200'].wb}·기호 ${cfgStat['320x568@200'].sep}·안내 못 닿음 ${cfgStat['320x568@200'].noReach}, 한 줄보다 긴 낱말 ${cfgStat['320x568@200'].wbu.join('·') || '없음'}. 360×740에서 스크롤이 필요한 시트 ${scroll.length}/${R360.length}, 첫 화면에서 선택지가 잘리거나 안 보이는 카드 ${choiceCut + choiceHidden}(선택지는 늘 첫 화면에 온전히 보임), 단서(아래 가장자리에 잘린 요소)가 없는 시트 ${noCue.length}개 — 숨은 것은 영향 안내·자동 모드 안내 줄뿐(+${Math.min(...noCue.map((x) => x.m.sheet.scrollH - x.m.sheet.clientH))}~${Math.max(...noCue.map((x) => x.m.sheet.scrollH - x.m.sheet.clientH))}px)`, verdict: cfgStat['360x740@100'].over || cfgStat['320x568@200'].over || cfgStat['360x740@100'].wb || cfgStat['320x568@200'].wb || cfgStat['360x740@100'].sep || cfgStat['320x568@200'].sep || SWERR ? 'FAIL' : 'RECORD', shots: ['qa/screenshots/003/M7b-L01-infant-new-sibling-top.png'] });

// ---- C01 기계 점검, C02 사람 판독
const rows = rd('cite-read-table.tsv').trim().split('\n').slice(1).map((l) => l.split('\t'));
add({ id: 'C01', cat: '콘텐츠', title: `인용 문장 기계 점검(화면에 뜬 ${rows.length}가지 · 인용 ${new Set(rows.map((r) => r[1])).size}건)`, steps: '수확에서 실제 화면에 뜬 인용 박스의 문장·출처 줄 전부를 정규식으로 점검(링크·URL·DOI·PMID, 100자, 합쇼체·마침표, 자모 분리, undefined·NaN·이중 공백·괄호 앞뒤 공백, 숫자 표기, 낙인·권유 어휘 목록)', expected: '링크·URL·DOI 0, 표시 문자열 ≤ 100자, 합쇼체, 이상 글자 0, 숫자 표기 일관', actual: '링크·URL·DOI·PMID 0, 100자 초과 0(최대 100자), 합쇼체 아닌 문장 0, 이상 글자 0. 숫자 표기: 「2,156,880원」(c-017, 최저임금 월 환산액 7자리 쉼표)만 다른 인용의 「45만 8천 원」·「5,000만 원」 꼴과 다름. 어휘 목록 적중: 「취약」(c-086 출처 원제), 「독거」(c-087 출처 원제), 「권하지 않고·권고합니다」(c-035) — C02에서 판독', verdict: 'RECORD', shots: [] });
add({ id: 'C02', cat: '콘텐츠', title: `인용 내용 사람 판독(화면에 뜬 인용 ${rows.length}가지를 카드 상황·선택지와 함께 읽음)`, steps: 'cite-read-sheet.txt(카드 제목·상황·선택지 + 세상별 인용·출처 줄)를 처음부터 끝까지 읽고 「카드 상황과 맞는가 / 선택을 권하거나 말리지 않는가 / 의료·법률·재무 조언처럼 읽히지 않는가 / 낙인 없음 / 숫자 표기 / 출처 줄」 판정', expected: '모두 맞음·권유 없음·조언 없음·낙인 없음', actual: '49건 모두 카드 상황과 이어짐(카드 소재를 직접 다루는 것과 사회적 배경을 보여 주는 것이 섞임). 사실 진술 문장이고 「~하세요」식 권유·낙인 낱말은 없음. 걸리는 것 12건(전부 RECORD, 마스터 판단): ① c-035 infant-screen 「WHO 지침은 …권하지 않고 … 권고합니다」가 선택지 1·3과 맞물려 보건 지침·권유로 읽힘(M-10 수용 항목) ② c-077 youth-startup·c-078 middle-business 신생기업 5년 생존율 36.4%·39.2% — 창업 선택지를 말리는 쪽으로만 읽힐 소지 ③ c-047 middle-career-peak 「노동소득은 45세에 가장 많다」 — 연결 약함(○), 승진 제안의 정점 암시 ④ c-095 youth-return-school 학자금대출 금리 연 1.7%만 제시 — 대출 권유·재무 정보로 읽힐 소지 ⑤ c-049 school-academy-night 수면 5.9시간·스트레스 — 「밤늦은 수업」 선택지를 말리는 쪽 ⑥ c-011 middle-child-school 청년 고용률 낮음 — 부모의 「내가 바라는 길」을 정당화, 연결 약함 ⑦ c-086·c-087 출처 줄 원제의 「취약계층」·「독거노인」 어휘(M-11 원제 유지) ⑧ c-062 출처 제목 「영유아 사교육 대응 방안」이 사교육 시작을 말리는 뉘앙스 ⑨ c-017 「2,156,880원」 표기 혼재 ⑩ c-033 연구 문장 길이·전문어(「애착 안정성」)·「연관이 있었습니다」 인과 소지 ⑪ c-081 「딸 35.9%·아들 29.7%」 돌봄 성별 구도 ⑫ 지난 세상 통계 인용(c-091·c-097·c-098·c-099·c-100·c-101)은 머리말이 없고 출처 줄에 「(2025)」·「(2026)」이 그대로 보여 1988년 화면에 미래 발행 연도가 나옴(값은 그 해 이전 것이라 P02는 PASS)', verdict: 'RECORD', shots: ['qa/screenshots/003/M7b-C02-c-035-infant-screen-present.png', 'qa/screenshots/003/M7b-C02-c-077-youth-startup-present.png', 'qa/screenshots/003/M7b-C02-c-047-middle-career-peak-present.png', 'qa/screenshots/003/M7b-C02-c-049-school-academy-night-present.png'] });

add({ id: 'K11', cat: '접근성', title: '읽기 프로그램 기록(CDP 접근성 트리·DOM, 실제 읽기 프로그램은 X03)', steps: '연구 인용 카드(지난 세상 infant-new-sibling) 시트의 접근성 트리를 문서 순서로 훑고, 출처 줄 영문 원제의 lang 속성과 머리 「연도 · 나이」 마크업을 DOM에서 읽는다', expected: '(권고) 영문 원제에 lang=en, 머리의 구분 기호가 낭독에서 거슬리지 않음', actual: '① 출처 줄의 영문 원제(「And baby makes four: …」·「Guidelines on physical activity …」, 인용 c-033·c-035)에 lang 속성이 없어(문서 lang=ko) 한국어 음성이 100자 넘는 영문을 한국어 발음으로 읽게 됨(WCAG 3.1.2 언어 표시) ② 머리 「1959년 · 3세」의 「 · 」가 접근성 트리에 글자(StaticText)로 남음(설정에 따라 「가운뎃점」으로 읽힐 수 있음 — M7e에서 선택지 이름의 가운뎃점을 결함으로 본 것과 같은 종류, 이번에는 머리 글이라 RECORD) ③ 낭독 순서: 대화상자 이름 = 제목 → 중대 결정 · 연도 · 나이 · 「카드 접기」 버튼 → 제목(h2) → 상황 → 인용(통계/연구 → 요약 → 출처) → 선택지 3(이름 = 라벨 + 영향 문장, ▲▼ 없음) → 영향 안내 → 자동 모드 안내(K03 PASS)', verdict: 'RECORD', shots: ['qa/results/m7b/ax-order-sibling-past.json'] });

// ---- X01 외부 요청·콘솔
let ext = 0;
let cons = 0;
for (const c of Object.values(last)) {
  ext += (c.externalRequests || []).length;
  cons += (c.console || []).length;
}
const HV = Object.values(BE).reduce((s, e) => s + e.ext + e.errors, 0);
add({ id: 'X01', cat: '환경', title: '외부 사이트 요청·콘솔 오류·경고창', steps: '모든 케이스의 페이지에서 요청 URL(127.0.0.1·localhost 외)·console error·warning·pageerror·dialog를 수집', expected: '0', actual: `외부 요청 ${ext}·콘솔 오류·경고 ${cons}(케이스) · 수확 ${A.lives}판 외부 요청·오류 ${HV} · 정상 플레이 3판 0`, verdict: ext || cons || HV ? 'FAIL' : 'PASS', shots: [] });
add({ id: 'X03', cat: '환경', title: 'WebKit·Safari·실기기·실제 스크린리더·가로 모드 실기 시험', steps: '브라우저를 새로 내려받지 않는다(지시). Playwright Chromium만 사용', expected: '-', actual: '건너뜀(TODO M9). 스크린리더 낭독은 CDP 접근성 트리로 순서·이름만 확인(K03)', verdict: 'SKIP', shots: [] });

const all = [...Object.values(last), ...extra];
const ORDER = ['N01', 'N02', 'N03', 'N04', 'H01', 'F01', 'P01', 'P02', 'C01', 'C02', 'L01', 'L02', 'L03', 'L04', 'K01', 'K02', 'K03', 'K10', 'K11', 'A01', 'A02', 'A03', 'A03b', 'A04', 'A05', 'A06', 'A07', 'A07b', 'A08', 'A09', 'A10', 'A12', 'A12b', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'A20', 'R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'X01', 'X03'];
const byId = Object.fromEntries(all.map((c) => [c.id, c]));
const out = ORDER.map((id) => byId[id]).filter(Boolean);
const missing = ORDER.filter((id) => !byId[id]);
fs.writeFileSync(path.join(OUT, 'cases-final.json'), JSON.stringify(out, null, 1));
const esc = (s) => String(s ?? '').replace(/\t|\n/g, ' ');
fs.writeFileSync(path.join(OUT, 'cases-final.tsv'), ['ID\t판정\t절차\t기대\t실제\t스크린샷'].concat(out.map((c) => [c.id, c.verdict, c.steps || c.title, c.expected, c.actual, (c.shots || []).join(' ')].map(esc).join('\t'))).join('\n'));
const cnt = out.reduce((a, c) => ((a[c.verdict] = (a[c.verdict] || 0) + 1), a), {});
console.log(JSON.stringify({ total: out.length, ...cnt, missing }));
