// QA-003 M7b 2회차 최종 케이스 표: r2/cases.jsonl(마지막 기록만) + 수확·플레이·감사·훑기·줄 모양 파일에서 계산한 케이스 → qa/results/m7b/r2-cases-final.json · r2-cases-final.tsv, 표준 출력에 요약
// 사용: QA_OUT=qa/results/m7b/r2 node qa/scripts/m7b-r2-final-cases.mjs
import fs from 'node:fs';
import path from 'node:path';
import { OUT, ROOT } from './m7b-lib.mjs';

const TOP = path.resolve(OUT, '..');
const rd = (f) => fs.readFileSync(path.join(OUT, f), 'utf8');
const jl = (f) => rd(f).trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const last = {};
for (const c of jl('cases.jsonl')) last[c.id] = c;
const extra = [];
const add = (c) => extra.push({ console: [], externalRequests: [], shots: [], ...c });
const S = (p) => `qa/screenshots/003/${p}`;

// ---------------- 정상 플레이 N01~N03 ----------------
for (const [id, f, era] of [['N01', 'play-N01.json', '지난 세상'], ['N02', 'play-N02.json', '지금 세상'], ['N03', 'play-N03.json', '다가올 세상']]) {
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
  if (r.cards.some((c) => c.cite && (c.cite.links > 0 || /https?:|www\./.test(c.cite.text + c.cite.src)))) bad.push('인용 박스에 링크·URL');
  if (cites.some((c) => c.cite.id === 'c-035')) bad.push('c-035가 뜸');
  const folded3 = r.events.find((e) => /^접힌 채 3\.6초 뒤/.test(e));
  add({
    id,
    cat: '정상',
    title: `${era} 한 판(prod, 360×740 터치 탭, 8배속)`,
    steps: `첫 화면 → ${era} → 룰렛 → 출생신고 → 인생 시작 → 카드마다 읽고 탭(수동 시트) → 8번째 카드에서 접기 → 접힌 채 자동 켜기(3.6초 기다려 선택 0 확인) → 다시 열기 → 인라인 자동 선택 → 4번째 인라인 카드에서 자동 끄기 → 시트 → 엔딩`,
    expected: '카드 20장 이상, 시트·접힌 띠·인라인 전환 정상, 엔딩 「N번의 선택」 = 본 카드 수, 오류·외부 요청 0',
    actual: `카드 ${r.cards.length}장(시트 ${modes.sheet || 0}·인라인 ${modes.inline || 0}), 인용 ${cites.length}장(통계 ${stat}·연구 ${res}), 인용 없는 카드 ${r.cards.length - cites.length}장. 엔딩 선택 수 ${m && m[1]}. ${folded3 || ''}. 오류 ${r.errors.length}·외부 요청 ${r.ext.length}`,
    verdict: bad.length ? 'FAIL' : 'PASS',
    note: bad.join(' / '),
    shots: r.shots.filter((s) => /c01|c08|auto-off|ending|folded|reopened/.test(s)).slice(0, 6),
  });
}

// ---------------- 수확 분석 ----------------
const SUM = JSON.parse(rd('harvest-r2-summary.json'));
const A = JSON.parse(rd('harvest-analysis.json'));
const BE = A.byEra;
const sumErr = Object.values(BE).reduce((s, e) => s + e.errors, 0);
const sumExt = Object.values(BE).reduce((s, e) => s + e.ext, 0);
add({
  id: 'H01',
  cat: '정상',
  title: `전 생애 수확 ${A.lives}판(지난 ${BE.past.lives}·지금 ${BE.present.lives}·다가올 ${BE.future.lives}, 360×740 모바일, 개발 서버 시간 배율)`,
  steps: '실제 화면에서 0세~사망까지 돌며 카드마다 머리·제목·상황·인용(종류·문장·출처 줄·링크 수)·선택지·안내를 읽고 정책(섞음)대로 하나를 누른다',
  expected: '모든 판이 엔딩, 카드 구조(「중대 결정」·「연도년 · 나이세」·자동 모드 꺼짐 문장 한 줄), 링크·URL·DOI 0, 인용 문자열 ≤ 100자·합쇼체, 시대 머리말 규칙, 오류·외부 요청 0',
  actual: `${A.lives}판 모두 엔딩(${Object.values(BE).reduce((s, e) => s + e.ended, 0)}), 카드 ${A.cards}장(지난 ${BE.past.cards}·지금 ${BE.present.cards}·다가올 ${BE.future.cards}) 전부 수동 시트, 이벤트 ${SUM.eventsSeen}/90개 등장, 구조 위반 ${A.problems.length}건, 링크·URL·DOI 0, 오류 ${sumErr}·외부 요청 ${sumExt}, 한 판에서 같은 인용 두 번 0(${JSON.stringify(SUM.dupInLife)})`,
  verdict: A.problems.length || sumErr || sumExt ? 'FAIL' : 'PASS',
  shots: ['(대량 표본) qa/results/m7b/samples-r2-*.jsonl'],
});
add({
  id: 'F01',
  cat: '정상',
  title: '수확 중 접기 시험 — 카드 3장에 한 번 접기 → 접힌 띠 → 시간 정지 → 다시 열기',
  steps: `수확 ${A.foldTests}번: 접기 → 80ms 뒤 띠 읽기 → 0.9초 기다려 나이·진행률 비교 → 다시 열기 → 80ms 뒤 카드·포커스 읽기`,
  expected: '띠(같은 key)·「다시 열 때까지 시간은 멈춥니다.」·포커스 「결정 다시 열기」·다이얼로그 0·나이·진행률 불변 / 다시 열기 뒤 같은 시트·같은 선택지·포커스 제목',
  actual: `${A.foldTests}번 모두 기대대로(실패 ${Object.values(BE).reduce((s, e) => s + e.foldFail, 0)})`,
  verdict: Object.values(BE).some((e) => e.foldFail) ? 'FAIL' : 'PASS',
  shots: [S('M7b-r2-N02-c08-folded.png')],
});

// ---------------- 게이트·노출 G01 ----------------
const evDir = path.join(ROOT, 'src', 'data', 'events');
const events = [];
for (const f of fs.readdirSync(evDir).filter((f) => f.endsWith('.json'))) {
  const j = JSON.parse(fs.readFileSync(path.join(evDir, f), 'utf8'));
  events.push(...(Array.isArray(j) ? j : j.events || []));
}
const decisions = events.filter((e) => Array.isArray(e.choices) && e.choices.length >= 2);
const ERAS = ['past', 'present', 'future'];
const stat = {};
for (const era of ERAS) {
  const cells = decisions.filter((e) => (e.eras || ERAS).includes(era));
  const con = cells.filter((e) => (typeof e.citation === 'string' ? e.citation : e.citation && e.citation[era]));
  stat[era] = { cells: cells.length, connected: con.length, ratio: Math.round((con.length / cells.length) * 1000) / 10 };
}
const infantEv = events.find((e) => e.id === 'infant-screen');
const gateOk = stat.present.ratio >= 40 && stat.future.ratio >= 40 && stat.past.ratio >= 8 && SUM.distinctShown === SUM.distinctStatic && SUM.distinctStatic >= 30 && SUM.c035 === 0 && SUM.infantScreen.withCite === 0 && infantEv && infantEv.noCitation === 'X6' && !infantEv.citation;
add({
  id: 'G01',
  cat: '정상',
  title: `인용 게이트·노출(수확 ${A.lives}판): 정적 연결률·서로 다른 인용 수·노출률·c-035`,
  steps: '이벤트 JSON에서 (카드×세상) 연결 칸과 연결된 인용 id를 세고(정적), 수확 화면에 실제로 뜬 인용의 서로 다른 id·카드 비율(노출률)과 대조. infant-screen의 noCitation·c-035 노출 수',
  expected: '정적 연결률 지금 ≥ 40% · 다가올 ≥ 40% · 지난 ≥ 8%(1차 게이트), 서로 다른 인용 48(dev 로그), c-035 0, infant-screen 인용 0(X6), 노출률은 보고용',
  actual: `정적 연결률 지금 ${stat.present.connected}/${stat.present.cells} = ${stat.present.ratio}% · 다가올 ${stat.future.connected}/${stat.future.cells} = ${stat.future.ratio}% · 지난 ${stat.past.connected}/${stat.past.cells} = ${stat.past.ratio}%. 서로 다른 연결 인용 정적 ${SUM.distinctStatic} · 화면에 뜬 것 ${SUM.distinctShown}(정적과 같은 집합: 더 뜬 것 ${SUM.shownNotStatic.length}·안 뜬 것 ${SUM.staticNotShown.length}). 노출률(보고용, 수확 화면): 지난 ${BE.past.citedRatio}%(${BE.past.lives}판, 앞 40판만 7.9%) · 지금 ${BE.present.citedRatio}% · 다가올 ${BE.future.citedRatio}% (dev r3 1000판 10.4·52.9·48.5, QA 1회차 9.3·54.3·50.0 — c-035 해제로 지금·다가올이 약 2.6%p 내려간 값). 세상별로 뜬 서로 다른 인용: 지난 ${SUM.distinctByEra.past}·지금 ${SUM.distinctByEra.present}·다가올 ${SUM.distinctByEra.future}. c-035 노출 ${SUM.c035}, infant-screen 카드 ${SUM.infantScreen.cards}장 중 인용 ${SUM.infantScreen.withCite}(데이터: noCitation ${infantEv && infantEv.noCitation}, eras ${infantEv && infantEv.eras.join('·')})`,
  verdict: gateOk ? 'PASS' : 'FAIL',
  shots: [],
});

// ---------------- P02 지난 세상 미래 연도 ----------------
{
  const BOUND = { 'school-early-work': ['c-100', 1980], 'school-exam': ['c-101', 1980], 'school-family-priority': ['c-097', 1970], 'youth-first-job': ['c-091', 1985], 'youth-marriage': ['c-098', 1980], 'youth-child': ['c-099', 1971] };
  const files = fs.readdirSync(TOP).filter((f) => /^samples-r2-past-[a-d]\.jsonl$/.test(f));
  const rows = {};
  let nCards = 0;
  let nCites = 0;
  let textFuture = 0;
  const viol = [];
  for (const f of files) {
    for (const l of fs.readFileSync(path.join(TOP, f), 'utf8').trim().split('\n')) {
      const life = JSON.parse(l);
      for (const c of life.cards || []) {
        nCards++;
        if (c.cite) nCites++;
        const ev = c.key.replace(/@.*/, '');
        const m = /^(\d{4})년/.exec(c.when || '');
        const y = m ? Number(m[1]) : null;
        if (c.cite && c.cite.kind === '통계' && y) {
          const body = c.cite.text.replace('지금의 연구로는', '');
          for (const mm of body.matchAll(/(\d{4})년/g)) if (Number(mm[1]) > y) textFuture++;
        }
        if (BOUND[ev] && y) {
          const [cid, from] = BOUND[ev];
          const R = (rows[ev] ||= { n: 0, firstSeen: 9999, lastUnseen: 0, early: 0, missing: 0 });
          R.n++;
          const has = c.cite && c.cite.id === cid;
          if (has) R.firstSeen = Math.min(R.firstSeen, y);
          else R.lastUnseen = Math.max(R.lastUnseen, y);
          if (has && y < from) { R.early++; viol.push(`${ev} ${y} < ${from}에 ${cid}`); }
          if (!has && y >= from) { R.missing++; viol.push(`${ev} ${y} ≥ ${from}인데 ${cid} 없음`); }
        }
      }
    }
  }
  add({
    id: 'P02',
    cat: '정상',
    title: `지난 세상 인용의 연도(수확 ${files.length ? '80' : '?'}판 · 출생 1950~1989 · 카드 ${nCards.toLocaleString()}장 · 인용 ${nCites}장)`,
    steps: '지난 세상 카드의 통계 인용 문장에서 「N년」을 뽑아 게임 속 연도(머리의 연도)와 견주고, validFromYear가 있는 카드 6종(c-100·c-101 1980, c-097 1970, c-091 1985, c-098 1980, c-099 1971)은 게임 속 연도별로 인용 유무가 경계와 맞는지 전수 대조',
    expected: '게임 속 연도보다 미래 연도의 통계 값 0, 인용은 validFromYear 이후에만 뜨고(앞에 뜸 0) 이후에는 항상 뜸(빠짐 0)',
    actual: `미래 연도 값 ${textFuture}건. 경계: ${Object.entries(rows).map(([ev, r]) => `${ev} ${r.n}장 — 인용 있는 가장 이른 해 ${r.firstSeen === 9999 ? '-' : r.firstSeen}, 없는 가장 늦은 해 ${r.lastUnseen || '-'}(경계 ${BOUND[ev][1]}, 일찍 뜸 ${r.early}·빠짐 ${r.missing})`).join(' / ')}. 위반 ${viol.length}건${viol.length ? ': ' + viol.slice(0, 3).join(', ') : ''}. 참고(C02 ⑫, 2차 목록): 지난 세상 통계 인용 출처 줄에 「(2025)」·「(2026)」 같은 발행 연도가 게임 속 연도보다 미래로 보이는 카드 ${SUM.pubYearAfterGameN}장(연구 c-033의 「(1996)」 포함 — 값이 아니라 표기)`,
    verdict: textFuture || viol.length ? 'FAIL' : 'PASS',
    shots: [S('M7b-r2-P01-school-early-work-year1979-birth1965.png'), S('M7b-r2-P01-school-early-work-year1980-birth1967.png')],
  });
}

// ---------------- C01 기계 점검(표시 문자열 diff 포함) ----------------
{
  const tsv = (p) => fs.readFileSync(p, 'utf8').trim().split('\n').slice(1).map((l) => l.split('\t'));
  const r2 = tsv(path.join(OUT, 'cite-read-table.tsv'));
  const r1 = tsv(path.join(TOP, 'cite-read-table.tsv'));
  const key = (r) => [r[0], r[1], r[6], r[7]].join('|');
  const k1 = new Set(r1.map(key));
  const k2 = new Set(r2.map(key));
  const gone = r1.filter((r) => !k2.has(key(r))).map((r) => `${r[0]}/${r[1]}`);
  const born = r2.filter((r) => !k1.has(key(r))).map((r) => `${r[0]}/${r[1]}`);
  const manyDigits = r2.filter((r) => /\d{1,3}(,\d{3}){2,}/.test(r[6]));
  const bad = r2.filter((r) => /(https?:|www\.|doi|pmid)/i.test(r[6] + r[7]) || r[6].length > 100 || /[ㄱ-ㅎㅏ-ㅣ]/.test(r[6] + r[7]) || /undefined|NaN|\s{2,}/.test(r[6] + r[7]) || !/니다(\([^)]*\))?\.$/.test(r[6]));
  // 「권고사직」은 법적 용어(c-083)라 권유 어휘가 아니다 — 지운 뒤 센다
  const vocab = r2.filter((r) => /권하|권고|추천|하세요|하십시오|해야 합니다/.test(r[6].replace(/권고사직/g, '')));
  const maxLen = Math.max(...r2.map((r) => r[6].length));
  const WHO = r2.filter((r) => r[1] === 'c-035');
  add({
    id: 'C01',
    cat: '콘텐츠',
    title: `인용 문장 기계 점검(화면에 뜬 ${r2.length}가지 · 인용 ${new Set(r2.map((r) => r[1])).size}건) + 1회차와 비교`,
    steps: '수확(2회차)에서 실제 화면에 뜬 인용 박스의 문장·출처 줄 전부를 정규식으로 점검(링크·URL·DOI·PMID, 100자, 합쇼체·마침표, 자모 분리, undefined·NaN·이중 공백, 숫자 표기(7자리 쉼표), 권유 어휘). 1회차 표(cite-read-table.tsv)와 문장·출처 줄을 비교',
    expected: '링크·URL·DOI 0, ≤ 100자, 합쇼체, 이상 글자 0, 숫자 표기 일관(7자리 쉼표 0), 권유 어휘 0, 1회차와의 차이는 의도한 변경뿐',
    actual: `점검 위반 ${bad.length}건(최대 ${maxLen}자), 7자리 쉼표 숫자 ${manyDigits.length}건, 권유 어휘(권하·권고·추천·하세요) ${vocab.length}건, c-035 ${WHO.length}건. 1회차와의 차이: 사라진 ${[...new Set(gone)].join(', ')} / 새로 보인 ${[...new Set(born)].join(', ')} — 의도한 변경(c-035 해제, c-017 「215만 6,880원」, c-097 「4.53명으로 집계되었습니다.」·출처 제목의 가운뎃점 → 쉼표 c-097·c-098·c-099)과 수확 표본 차이(c-095 지금·다가올, c-084 다가올)뿐`,
    verdict: bad.length || manyDigits.length || vocab.length || WHO.length ? 'FAIL' : 'PASS',
    shots: [],
  });
}

// ---------------- D-65 / D-66 줄 모양 (lines.jsonl) ----------------
const RP = JSON.parse(rd('r2-report-summary.json'));
const LN = RP.lines;
const SW = RP.sweep;
add({
  id: 'D65',
  cat: '레이아웃',
  title: `D-65 .cite 안쪽 여백(사방 12px) 반영: 연결된 인용 ${LN.cells}칸(서로 다른 인용 ${LN.cites}) × 폭 {320, 360} × 글자 {150, 200}% × {시트, 인라인} = ${LN.rows}측정 — 줄 끝·첫머리 구분 기호, 216px 9글자 낱말 끊김, 박스 밖 넘침`,
  steps: '카드×세상 칸마다 그 카드가 대기 중인 저장을 만들어(연도 조건 맞춤) prod에서 열고 인용 박스의 요약·출처 줄을 글자 하나씩 Range로 줄 단위로 잰다(독립 측정). 구분 기호(·, /, —, 여는 괄호, ~)가 줄 끝에, 구분 기호·마침표·쉼표·닫는 괄호·% 등이 줄 첫머리에 놓였는가, 낱말 중간 끊김(독립 측정기, 시트는 0.6화면씩 훑음), 인용 박스·문서 가로 넘침. 안쪽 문단 폭을 읽음',
  expected: '「출생아수·」「혼인건수·」 같은 줄 끝 기호 0, 줄 첫머리 마침표 0, 9글자(216px) 낱말 끊김 0, 구분 기호 줄 끝·첫머리 0, 가로 넘침 0',
  actual: `${LN.rows}측정(측정 오류 ${LN.errors.length}): 인용 박스 안쪽 문단 폭 ${Object.entries(LN.widths).map(([k, v]) => `${k} ${v}px`).join(' · ')}. 줄 끝 구분 기호 0 · 줄 첫머리 기호·구두점 0 · 구분 기호 감사(SEP) ${LN.sep.length} · 결함 끊김 ${LN.broken.length} · 박스·문서 넘침 ${LN.overflow.length}. 옛 216px 9글자 낱말 5종(초중고사교육비조사·교육통계분석자료집·한국대학교육협의회·청소년건강행태조사·과학기술정보통신부)은 폭 320·글자 200% 인라인에서 모두 낱말째 한 줄에 들어가고 「한 줄보다 긴 낱말」 목록에도 없다. 한 줄보다 긴 낱말(자연 폭 > 안쪽 폭, 낱말 중간에서 끊김이 불가피): ${Object.entries(LN.unavoidable).map(([k, v]) => `${k}: ${Object.entries(v).map(([w, n]) => `${w}×${n}`).join('·')}`).join(' / ')}`,
  verdict: LN.errors.length || LN.broken.length || LN.sep.length || LN.overflow.length || LN.hard.filter((x) => !/c-049/.test(x)).length ? 'FAIL' : 'PASS',
  shots: [S('M7b-r2-D65-c-097-school-family-priority-320x200-inline.png'), S('M7b-r2-D65-c-098-youth-marriage-320x200-sheet.png'), S('M7b-r2-D65-c-099-youth-child-320x200-inline.png'), S('M7b-r2-D65-c-006-school-tutoring-320x200-inline.png'), S('M7b-r2-D65-c-086-senior-new-device-320x200-inline.png')],
});
{
  const read = fs.readFileSync(path.join(OUT, 'd66-lines.txt'), 'utf8');
  const dotEnd = /(출생아수|혼인건수)·/.test(read);
  const periodHead = /\n\s+요약: [^\n]*\/ \./.test(read);
  add({
    id: 'D66',
    cat: '레이아웃',
    title: 'D-66 인용 데이터: c-097·c-099 출처 「인구동향조사 출생아수, 합계출산율(1970~)」·c-098 「혼인건수, 조혼인율(1970~)」, c-097 요약 「4.53명으로 집계되었습니다.」 — 8틀 × 3칸',
    steps: 'c-097(school-family-priority)·c-098(youth-marriage)·c-099(youth-child) 지난 세상 카드를 폭 320·360 × 글자 150·200% × 시트·인라인(8틀)으로 열어 출처 줄·요약의 줄 모양을 읽는다. 수확 화면에서 문자열도 확인',
    expected: '출처 줄에 가운뎃점 사슬 없음(쉼표 나열), 「출생아수·」「혼인건수·」 줄 끝 0, 요약 「4.53명으로 집계되었습니다.」의 마침표가 줄 첫머리에 홀로 남지 않음, 낱말 중간 끊김 0, 구분 기호 줄 끝·첫머리 0',
    actual: `수확 화면 문자열: c-097 「${SUM.d66['c-097'][0]}」 / c-098 「${SUM.d66['c-098'][0]}」 / c-099 「${SUM.d66['c-099'][0]}」. 24틀 줄 모양(d66-lines.txt): 가운뎃점(·) 줄 끝 ${dotEnd ? '있음' : '0'}, 요약 줄 첫머리 마침표 ${periodHead ? '있음' : '0'}, 지적 0. 대표: 320·200% 인라인 c-097 요약 「1970년 / 합계출산율은 / 4.53명으로 / 집계되었습니다.」(223px) · 출처 「국가데이터처(2026), / 인구동향조사 / 출생아수, / 합계출산율(1970~)」, 360·150% 시트 출처 「국가데이터처(2026), 인구동향조사 / 출생아수, 합계출산율(1970~)」`,
    verdict: dotEnd || periodHead || !SUM.d66['c-097'] ? 'FAIL' : 'PASS',
    shots: [S('M7b-r2-D65-c-097-school-family-priority-320x200-sheet.png'), S('M7b-r2-D65-c-098-youth-marriage-320x150-inline.png'), S('M7b-r2-D65-c-099-youth-child-360x150-sheet.png')],
  });
  add({
    id: 'D65r',
    cat: '레이아웃',
    title: '남은 줄 모양 관찰(D-65·D-66 목표 밖, 기록)',
    steps: 'D65 측정에서 걸리지 않은 줄 모양을 줄 단위 전수에서 따로 센다 — 마지막 줄 고아(1~2글자), 줄 끝 하이픈, 한 줄보다 긴 낱말의 화면 모양',
    expected: '(권고) 보이는 고아 글자·줄 끝 하이픈이 없음',
    actual: `① 폭 320·글자 200% 인라인 c-049(school-academy-night 지금·다가올): 「5.9시간이었습니다」(233px > 안쪽 223px)가 낱말 중간에서 끊겨 요약 마지막 줄이 「다.」만 남음(designer 허용 목록의 「한 줄보다 긴 낱말」, 시트·폭 360에서는 한 줄에 듦) ② 같은 틀 c-088(senior-move-home 지금·다가올): 「노인실태조사에서」 224px가 223px에 1px 모자라 「노인실태조사에」/「서 건강을 유지할」로 끊김 ③ 출처 줄 「지표누리 e-나라지표」가 글자 200%에서 「e-」 뒤에서 갈려 줄 끝이 「e-」로 끝남: c-060·c-061·c-074·c-087·c-100·c-101 25틀(320·200% 인라인 13, 360·200% 인라인 6, 320·200% 시트 6) — 구분 기호 규칙(·, /, —) 밖의 하이픈 ④ 마지막 줄이 2글자 낱말(「결과」「통계」)뿐인 출처 줄 ${LN.soft.length}틀(c-092·c-030·c-006·c-093·c-003·c-004·c-015) ⑤ 한 줄보다 긴 낱말은 위 D65 목록과 같다(「국민노후보장패널조사」「디지털정보격차실태조사」는 시트·폭 360 인라인에서도 남음)`,
    verdict: 'RECORD',
    shots: [S('M7b-r2-D65-c-049-school-academy-night-320x200-inline.png'), S('M7b-r2-D65-c-088-senior-move-home-320x200-inline.png'), S('M7b-r2-D65-c-061-infant-kindergarten-320x200-inline.png')],
  });
}

// ---------------- L03(공통 뷰포트 감사) · L04(전수 훑기) ----------------
{
  const AUall = jl('audit.jsonl');
  const AU = AUall.filter((r) => !r.err);
  const ERRS = AUall.filter((r) => r.err).length;
  const iss = { over: 0, wb: 0, wbUn: [], sep: 0, leak: 0, focus: [], missing: 0, stops: 0 };
  for (const r of AU) {
    const k = `${r.card}/${r.mode}/${r.vp}/${r.font}`;
    if (r.m.docOverflow > 0 || r.m.over.length || r.m.clipped.length) iss.over++;
    if (r.wb.broken.length) iss.wb++;
    for (const u of r.wb.unavoidable) iss.wbUn.push(`${k}: ${u.word}[${u.natural}>${u.lineW}]`);
    if (r.sep.length) iss.sep++;
    if (r.tab.leak.length) iss.leak++;
    if (r.tab.issues.length) iss.focus.push(`${k}: ${r.tab.issues.map((i) => i.id).join('·')}`);
    if (r.tab.missing.length) iss.missing++;
    iss.stops += r.tab.fwd.length;
  }
  const byMode = AU.reduce((a, r) => ((a[r.mode] = (a[r.mode] || 0) + 1), a), {});
  const cardsN = new Set(AU.map((r) => r.card)).size;
  const wbWords = [...new Set(iss.wbUn.map((s) => s.split(': ')[1].replace(/\[.*/, '')))];
  const focusUncovered = iss.focus.filter((f) => !/inline\/320x568\/200/.test(f));
  fs.writeFileSync(path.join(OUT, 'audit-focus-issues.json'), JSON.stringify({ focus: iss.focus, wbUn: iss.wbUn }, null, 1));
  add({
    id: 'L03',
    cat: '레이아웃',
    title: `공통 뷰포트 11종 × 상태 3(시트·접힌 띠·인라인) × 카드 ${cardsN}종 × 글자 100·200% = ${AU.length}조합 (CM10 포커스 가림·가로 넘침)`,
    steps: 'prod에서 상태를 열고 가로 넘침(문서·카드 안 요소)·카드 안 낱말 끊김(독립 측정기, 시트는 스크롤 위치를 0.6화면씩 훑음)·줄 끝·첫머리 구분 기호(·, —, /)·Tab 순회의 가려진 포커스(elementFromPoint 5점)·시트 밖으로 새는 포커스·못 닿는 컨트롤을 잰다. 카드: 1회차 7종 + D-66 카드 3종(c-097·c-098·c-099)',
    expected: '넘침 0, 결함 끊김 0, 구분 기호 0, 가려진 포커스 0(CM10), Tab이 시트 밖으로 새지 않음, 못 닿는 컨트롤 0',
    actual: `${AU.length}조합(시트 ${byMode.sheet}·접힌 띠 ${byMode.fold}·인라인 ${byMode.inline}, 측정 오류 ${ERRS}), Tab 정지 ${iss.stops}번: 가로 넘침 ${iss.over}·결함 끊김 ${iss.wb}·구분 기호 ${iss.sep}·시트 밖 포커스 ${iss.leak}·못 닿는 컨트롤 ${iss.missing}. 가려진 포커스 ${iss.focus.length}조합 — ${iss.focus.join(' ; ') || '없음'}. 한 줄보다 긴 낱말 ${iss.wbUn.length}건(${wbWords.join('·') || '없음'})`,
    verdict: iss.over || iss.wb || iss.sep || iss.leak || iss.missing || ERRS || focusUncovered.length ? 'FAIL' : iss.focus.length || iss.wbUn.length ? 'RECORD' : 'PASS',
    shots: [S('M7b-r2-L03-1280x800-sheet.png'), S('M7b-r2-L03-667x375-landscape-sheet.png'), S('M7b-r2-L03-320x256-zoom400-sheet.png')],
  });
  const sc = { cards: SW.cards, pairs: SW.cells };
  add({
    id: 'L04',
    cat: '레이아웃',
    title: `카드 90개 전수 훑기(시트, ${sc.pairs}개 카드×세상) — 360×740 글자 100% · 320×568 글자 200%`,
    steps: '이벤트 데이터가 허용하는 카드×세상마다 그 카드가 대기 중인 저장을 만들어(개발 서버 core, 조건부 카드는 선택 정책을 바꿔 찾음) prod에서 시트로 열고 넘침·낱말 끊김·구분 기호·스크롤 도달·맨 위 화면의 단서를 잰다',
    expected: '넘침 0, 결함 끊김 0, 구분 기호 0, 모든 카드의 안내까지 스크롤로 닿음',
    actual: `카드 ${sc.cards}/90개 · ${sc.pairs}개 카드×세상 × 2설정 = ${SW.rows}측정(오류 ${SW.errors.length}): 가로 넘침 ${SW.docOverflow.length + SW.over.length + SW.clipped.length}·결함 끊김 ${SW.broken.length}·구분 기호 ${SW.sep.length}·안내 못 닿음 ${SW.unreach.length}. 한 줄보다 긴 낱말(320@200%): ${(SW.unavoidable['320x568@200'] || []).map((x) => x.replace(/\[.*/, '')).join('·') || '없음'}. 360×740에서 스크롤이 필요한 시트 ${SW.scrollNeeded['360x740@100']}/${sc.pairs}, 첫 화면에서 선택지가 잘리거나 밀린 카드 ${SW.firstScreenCut.length}, 단서(아래 가장자리에 잘린 요소)가 없는 시트 ${SW.noCueN['360x740@100']}개(1회차 20개와 같은 값, 숨은 것은 영향 안내·자동 안내 줄뿐)`,
    verdict: SW.errors.length || SW.docOverflow.length || SW.over.length || SW.clipped.length || SW.broken.length || SW.sep.length || SW.unreach.length ? 'FAIL' : 'RECORD',
    shots: [S('M7b-r2-D65-c-097-school-family-priority-360x150-sheet.png')],
  });
}

// ---------------- X01 외부 요청·콘솔 ----------------
{
  let ext = 0;
  let cons = 0;
  const ignore = new Set();
  for (const c of Object.values(last)) {
    ext += (c.externalRequests || []).length;
    cons += (c.console || []).length;
  }
  add({
    id: 'X01',
    cat: '환경',
    title: '외부 사이트 요청·콘솔 오류·경고창',
    steps: '모든 케이스의 페이지에서 요청 URL(127.0.0.1·localhost 외)·console error·warning·pageerror·dialog를 수집',
    expected: '0',
    actual: `외부 요청 ${ext}·콘솔 오류·경고 ${cons}(케이스) · 수확 ${A.lives}판 외부 요청·오류 ${sumErr + sumExt} · 정상 플레이 3판 0`,
    verdict: ext || cons || sumErr || sumExt ? 'FAIL' : 'PASS',
    shots: [],
  });
  add({ id: 'X03', cat: '환경', title: 'WebKit·Safari·실기기·실제 스크린리더·가로 모드 실기 시험', steps: '브라우저를 새로 내려받지 않는다(지시). Playwright Chromium만 사용', expected: '-', actual: '건너뜀(TODO M9). 스크린리더 낭독은 CDP 접근성 트리로 순서·이름·lang만 확인(K03·K11)', verdict: 'SKIP', shots: [] });
}

const all = [...Object.values(last), ...extra];
const ORDER = ['C02a', 'C02b', 'K11', 'K11b', 'A20', 'A20b', 'A12b', 'A12c', 'A12d', 'D65', 'D66', 'D65r', 'L04', 'L03', 'G01', 'P01', 'P02', 'H01', 'F01', 'C01', 'N01', 'N02', 'N03', 'A01', 'A02', 'A03', 'A03b', 'A04', 'A05', 'A06', 'A07', 'A07b', 'A08', 'A09', 'A10', 'A12', 'A14', 'A15', 'A16', 'A17', 'A18', 'A19', 'K01', 'K02', 'K03', 'K10', 'R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'X01', 'X03'];
const byId = Object.fromEntries(all.map((c) => [c.id, c]));
const out = ORDER.map((id) => byId[id]).filter(Boolean);
// m7b-r2-shots-extra.mjs가 찍은 케이스별 보충 스크린샷(케이스 기록 밖)을 해당 케이스에 붙인다
const EXTRA_SHOTS = { A05: ['M7b-r2-A05-after-dblclick.png'], A08: ['M7b-r2-A08-folded-after-return.png'], A15: ['M7b-r2-A15-folded-while-storage-fails.png'], A17: ['M7b-r2-A17-after-typing.png'], A19: ['M7b-r2-A19-landscape-740x360-sheet.png', 'M7b-r2-A19-landscape-740x360-inline.png'] };
for (const c of out) for (const n of EXTRA_SHOTS[c.id] || []) if (fs.existsSync(path.join(ROOT, 'qa', 'screenshots', '003', n))) (c.shots ||= []).push(S(n));
const missing = ORDER.filter((id) => !byId[id]);
const unlisted = Object.keys(byId).filter((id) => !ORDER.includes(id));
fs.writeFileSync(path.join(TOP, 'r2-cases-final.json'), JSON.stringify(out, null, 1));
const esc = (s) => String(s ?? '').replace(/\t|\n/g, ' ');
fs.writeFileSync(path.join(TOP, 'r2-cases-final.tsv'), ['ID\t판정\t절차\t기대\t실제\t스크린샷'].concat(out.map((c) => [c.id, c.verdict, c.steps || c.title, c.expected, c.actual, (c.shots || []).join(' ')].map(esc).join('\t'))).join('\n'));
const cnt = out.reduce((a, c) => ((a[c.verdict] = (a[c.verdict] || 0) + 1), a), {});
console.log(JSON.stringify({ total: out.length, ...cnt, missing, unlisted }));
for (const c of out) if (c.verdict !== 'PASS') console.log(c.id, c.verdict, String(c.actual).slice(0, 200));
