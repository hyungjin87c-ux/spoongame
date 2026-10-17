// a11y1·family 결과 파일을 케이스로 기록(cases.jsonl에 이어 쓴다)
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m3-lib.mjs';
const CASES = path.join(OUT, 'cases.jsonl');
const add = (rec) => fs.appendFileSync(CASES, JSON.stringify({ at: new Date().toISOString(), console: [], externalRequests: [], ms: 0, ...rec }) + '\n');
const s = JSON.parse(fs.readFileSync(path.join(OUT, 'a11y1-summary.json'), 'utf8'));
const rows = fs.readFileSync(path.join(OUT, 'a11y1-rows.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const full = rows.filter((r) => r.line);
const chars = full.reduce((a, r) => a + r.line.chars, 0);
const maxBar = Math.max(...full.map((r) => r.bar?.ratio ?? 0));
const cm10Combos = rows.filter((r) => r.cm10 || r.stateAfter !== undefined).length;

add({ id: 'M3-C10', cat: '접근성', title: 'CM10 Tab·Shift+Tab 전체 순회에서 고정 띠에 가려진 포커스 0 — 공통 뷰포트 11종 × 글자 100·200% × 상태(룰렛 회전 중·룰렛 결과 4변형·출생신고 7변형)', steps: '독립 측정기(M2 N14b 방식): 고정/sticky 요소를 화면에서 자동 수집, 포커스 링 상자와의 겹침·화면 안·elementFromPoint, 조작 요소 집합 = 순회 도달 집합. 320x256 글자 200%는 마스터 확인 4에 따라 제외', expected: '가려진 포커스 0, 미도달 0', verdict: s.cm10.length ? 'FAIL' : 'PASS', severity: '중간(접근성)', actual: s.cm10.length ? s.cm10.slice(0, 6).join(' / ') : `${cm10Combos}개 조합에서 포커스 ${s.counts.steps}회 측정: 가려진 포커스 0·화면 밖 0·미도달 0. 순회에서 닿은 요소 ${s.counts.tabStops.join(', ')} (룰렛 회전 중 「건너뛰기」·결과 「출생신고 보기」·출생신고 「살아가기」 — 이 화면들의 조작 요소는 하단 띠 버튼 하나씩이라 Tab 정지점이 1개)`, shots: s.shots.slice(0, 3) });
add({ id: 'M3-C11', cat: '접근성', title: 'CM11 글자 크기 100·150·200%·확대 상당 뷰포트에서 가로 넘침 0px·잘림 0·기본 버튼 ≥ 44px·눌림 — 11 뷰포트 × 12 상태 + 회전 중', steps: `11 뷰포트 × 상태 12(룰렛 결과 4·출생신고 7 + 회전 중) × 글자 100·150·200%에서 documentElement.scrollWidth−clientWidth, 화면 밖 요소, 잘림, 띠 비율, 하단 버튼 높이·elementFromPoint`, expected: '넘침 0px, 잘림 0, 띠 ≤ 50%(넘으면 해제), 버튼 ≥ 44px·눌림', verdict: s.cm11.length ? 'FAIL' : 'PASS', severity: '중간(접근성)', actual: s.cm11.length ? s.cm11.slice(0, 6).join(' / ') : `${s.counts.combos}조합(출생신고 7변형·룰렛 결과 4변형·회전 중, 320x568·360x740 포함 11종) 가로 넘침 0px·잘림 0·화면 밖 요소 0. 하단 버튼 높이 ≥ 44px·눌림. 고정 띠 최대 ${Math.round(maxBar * 100)}%(320x256 글자 200%)`, shots: s.shots.filter((x) => /320x568-200|360x740-touch-200-birth-present-61|1280x800-100/.test(x)).slice(0, 3) });
add({ id: 'M3-L01', cat: '접근성', title: 'QM2-10·QM2-5 구분 기호(· / — ( ) , .)가 줄 끝·첫머리에 남지 않고 숫자+단위·날짜 묶음이 갈라지지 않는다', steps: `글자 하나씩 Range로 줄을 나눠 본문·헤더·띠 글자 ${chars.toLocaleString('ko-KR')}자(11 뷰포트 × 12 상태 × 글자 100·150·200%)를 점검`, expected: '줄 끝 · / — ( 0, 줄 첫머리 · / — ) , . 0, 기호만 남은 줄 0, 숫자-단위·날짜 갈라짐 0', verdict: s.line.some((x) => !x.includes('낱말 중간 끊김')) ? 'FAIL' : 'PASS', severity: '낮음', actual: s.line.some((x) => !x.includes('낱말 중간 끊김')) ? s.line.filter((x) => !x.includes('낱말 중간 끊김')).slice(0, 5).join(' / ') : `${chars.toLocaleString('ko-KR')}자·${s.counts.combos}조합에서 구분 기호 줄 끝·첫머리 0, 기호만 남은 줄 0, 숫자와 단위·날짜 갈라짐 0`, shots: [] });
const wb = s.line.filter((x) => x.includes('낱말 중간 끊김'));
add({ id: 'M3-L02', cat: '접근성', title: '낱말 중간 끊김은 허용 목록(글자 200% × 폭 320·360의 「전남광주통합특별시」)만', steps: '위 줄바꿈 감사에서 글자(한글·영숫자) 한 덩어리가 서로 다른 줄에 놓인 곳을 모두 센다', expected: '허용 목록 밖 0', verdict: wb.length ? 'FAIL' : 'PASS', severity: '낮음(글자 확대 한정)', actual: wb.length ? `허용 목록 밖 낱말 끊김 ${wb.length}곳(조합 단위) — 아래 「FAIL 상세」 표 참고. 허용 목록 낱말은 ${s.allowedBreaks.length}곳에서 목록대로 끊김` : '허용 목록 밖 0', shots: ['qa/screenshots/003/M3-C-360x740-touch-200-result-honam-FLAG.png', 'qa/screenshots/003/M3-C-320x568-200-birth-present-5-dirt-changwon-FLAG.png', 'qa/screenshots/003/M3-C-320x568-200-birth-present-4242-silver-FLAG.png', 'qa/screenshots/003/M3-C-320x568-100-result-honam-FLAG.png', 'qa/screenshots/003/M3-C-375x812-200-birth-present-229-diamond-honam-FLAG.png'] });
// 가족 정합
for (const era of ['present', 'past', 'future']) {
  const f = path.join(OUT, `family-${era}.jsonl`);
  const r = fs.readFileSync(f, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const ok = r.filter((x) => x.info);
  const ev = (k) => ok.map((x) => x.info.events[k]).filter(Boolean);
  const mm = (a, g) => (a.length ? `${Math.min(...a.map(g))}~${Math.max(...a.map(g))}` : '-');
  const bad = r.filter((x) => x.error || x.bad?.length || x.errs?.length);
  add({ id: `M3-F01-${era}`, cat: '정합', title: `${era}: 「부모 돌봄·임종」 사건이 부모 나이와, 「동생이 생겼다」가 첫째·어머니 나이와 맞는가 — 8배속 자동 ${r.length}판`, steps: '개발 서버 ?__timescale=100, 룰렛→출생신고→살아가기→8배속+자동→엔딩의 저장(연표)을 읽어 출생신고의 부모 나이·형제 순서와 사건 시점을 독립적으로 계산', expected: '돌봄 사건 때 나이 많은 부모 60~100세, 임종 65~100세, 동생 사건 = 첫째 + 어머니 ≤ 45세, 임종이 돌봄보다 먼저 아님, 연표 첫 줄 형제 순서 일치, 위반 0', verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? bad.slice(0, 3).map((x) => `seed${x.seed}: ${x.error ?? x.bad?.join('|') ?? x.errs?.join('|')}`).join(' / ') : `${r.length}판 완주·위반 0·pageerror 0. 돌봄 ${ev('care').length}건(부모 나이 ${mm(ev('care'), (x) => x.parentAge)}세), 임종 ${ev('farewell').length}건(${mm(ev('farewell'), (x) => x.parentAge)}세), 동생 ${ev('sibling').length}건(어머니 ${mm(ev('sibling'), (x) => x.motherAge)}세·모두 첫째·사건 나이 ${mm(ev('sibling'), (x) => x.age)}세), 최고 부모 나이 ${Math.max(...ok.map((x) => Math.max(x.info.mother, x.info.father)))}세(출생 때)`, shots: [] });
}
console.log('recorded');

// ---- 추가 기록: D07(하단 표기·헤더), WebKit SKIP, 기록(RECORD) 케이스 ----
const P = (era) => fs.readFileSync(path.join(OUT, `samples-${era}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
{
  const bad = [];
  const per = [];
  for (const era of ['present', 'past', 'future']) {
    const rows = P(era);
    const want = era === 'present' ? 4 : 5;
    const lens = [...new Set(rows.map((r) => r.birth.foot.length))];
    if (lens.length !== 1 || lens[0] !== want) bad.push(`${era}: 하단 표기 줄 수 ${lens} (기대 ${want})`);
    if (!rows.every((r) => r.birth.logoPresent)) bad.push(`${era}: 헤더 로고 없는 판`);
    if (era === 'past' && !rows.every((r) => r.birth.foot[0].startsWith('시·군·구 이름은 지금(2025년) 행정구역 이름이며'))) bad.push('past: 지역 표기 문구');
    if (era !== 'past' && !rows.every((r) => r.birth.foot[0].includes('2026년에 바뀐 시·도'))) bad.push(`${era}: 지역 개편 설계값 문구`);
    if (era === 'past' && !rows.every((r) => r.birth.foot[4].startsWith('지난 세상의'))) bad.push('past: 시대 보정 문구');
    if (era === 'future' && !rows.every((r) => r.birth.foot[4].startsWith('다가올 세상의'))) bad.push('future: 시대 보정 문구');
    if (era === 'present' && !rows.every((r) => !/지난 세상|다가올 세상/.test(r.birth.foot.join(' ')))) bad.push('present: 시대 보정 문구가 지금 세상에 보임');
    per.push(`${era} ${rows.length}판 줄 ${want}`);
  }
  add({ id: 'M3-D07', cat: '표본', title: '출생신고 하단 표기·헤더 게임명: 세 세상 640판 전부에서 통계 출처·설계값 고지·(지난·다가올) 시대 보정 한 줄, 헤더 로고', steps: '표본 640판의 하단 표기 줄과 헤더 로고 유무를 화면에서 읽어 대조', expected: '지금 세상 4줄(지역 개편 설계값·통계 출처·주거 근사·설계 보정), 지난·다가올 세상 5줄(+ 시대 보정 줄, 지난 세상은 시·군·구 이름 안내가 첫 줄), 모든 판 헤더에 로고', verdict: bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: bad.length ? bad.join(' / ') : per.join(', ') + ' — 하단 표기와 헤더 로고 불변식 위반 0', shots: [] });
}
add({ id: 'M3-X03', cat: '환경', title: 'WebKit(iOS Safari) 확인', steps: '설치된 Playwright 브라우저 확인(내려받지 않음)', expected: '-', verdict: 'SKIP', actual: 'WebKit 미설치(Chromium만 있음) → 미확인. 룰렛은 requestAnimationFrame + CSS transform(translate3d)이고 칸 높이는 rem 기반 CSS 변수라 Safari에서도 같은 경로지만, 주소창 접힘·safe-area 하단 띠는 실기기 확인 필요(형진 님 모바일)', shots: [] });
console.log('recorded 2');

// ---- 기록(RECORD) 케이스: 판정에 넣지 않는 관찰 ----
const REC = [
  ['M3-O01', '뒤로가기', '브라우저 뒤로가기는 앱을 떠난다(앱이 history 항목을 만들지 않음). 모바일에서 뒤로가기 제스처를 룰렛 도중에 누르면 사이트를 떠나고, 다시 열면 룰렛이 결과 상태로 복원된다(A05 — 저장돼 있어 손실 0). 「건너뛰기」·「출생신고 보기」 없이 한 번에 빠져나가 당황할 수 있는 모바일 동작'],
  ['M3-O02', '장식 도장 대비', '출생신고 도장 「접수」(aria-hidden 장식, 14px, 불투명도 0.85)의 라이트 모드 대비가 3.72:1(다크 6.5:1, 강제 색상 15:1). 장식이라 WCAG 예외에 해당하지만 DS3의 「텍스트-배경 쌍 전수 4.5:1」 기준으로는 미달로 읽힐 수 있다'],
  ['M3-O03', 'CPU 20배 느림', 'CDP CPU 스로틀 ×1/×6/×20에서 수저 릴 정지 5.45/5.75/7.50초(지역 4.25/4.54/5.94초), 프레임 간격 최대 17/333/2033ms. ×6은 4~6초 안(약간 초과 7.0초 이하), ×20은 극단 흉내라 판정에서 뺐다. 연출은 시계 기준이라 늦어져도 멈춘 채 남지 않고 결과는 같다'],
  ['M3-O04', '엔딩·옛 인생 화면의 외모 숫자', '엔딩 「최종 스탯」과 옛 인생 화면의 스탯 패널이 외모를 숫자(예: 「외모 53」)로 보인다. 출생신고·룰렛에는 원점수 0(640판 확인)이라 M3 범위는 충족하지만, SPEC 완료 기준 4의 「엔딩 어디에도 원점수 없음」과 충돌한다 — 엔딩·인생 화면 개편(M4)에서 풀어야 하는 항목으로 확인 필요. 같은 화면들은 게임명 헤더·로고도 없고 연표 0세 줄만 합쇼체, 나머지는 해라체(M4·M7e 예정)'],
  ['M3-O05', '또래 안내 문구가 약속하는 기능', '출생신고 「같은 해 태어난 사람들」 아래 안내가 「대시보드 오른쪽 칸에서 요즘 모습을 볼 수 있습니다」인데, M3를 main에 올리면 Pages의 인생 화면은 옛 화면이라 그 칸(VP4)이 없다. 형진 님이 안내대로 찾아보면 없다 — M4 배포 전까지 문구를 줄이거나 M4와 함께 배포할지 결정 필요'],
  ['M3-O06', '미래 달 출생', '지금 세상(2026년생)의 출생 월이 1~12월 가중 추첨이라(SPEC R1) 오늘(2026-10-16)보다 뒤인 11·12월 출생이 표본 240판 중 38판(16%)이다(「2026년 12월에 태어났습니다」). 명세대로지만 「올해 태어나는 아이」를 지금 플레이하는 사람에게는 아직 안 온 달이다'],
  ['M3-O07', '글 말투·읽힘', '(a) 비교 표 안내 한 문단이 「~입니다」와 「~이에요」를 섞는다(copy.md 3-2의 안내=해요·서류=합쇼 구분대로지만 한 문단 안에서는 흔들림) (b) 구간 문구 「동수저(하위 25%와 상위 45% 사이)」는 처음 읽으면 하위와 상위가 한 구간에 섞여 해석이 어렵다 (c) 외모 칸 「하위 약 24% 또래 사이에서」는 「또래」가 앞말에 붙어 읽힌다 (d) 「(3.1kg은 딱 중간쯤)」의 「딱」은 구어'],
  ['M3-O08', '확률표가 띠에 가림(모바일)', '360x740 룰렛에서 지역 확률표 16행 중 약 7행(여덟째 행은 반쯤)만 처음 화면에 보이고 나머지는 스크롤해야 한다(띠가 아래를 덮음, 스크롤하면 모두 보임·가림 0). 확률을 투명하게 보이려는 RL3의 효과가 모바일에서는 첫 화면에 절반만 닿는다'],
];
for (const [id, title, actual] of REC) add({ id, cat: '기록', title, steps: '-', expected: '-', verdict: 'RECORD', actual, shots: id === 'M3-O03' ? ['qa/screenshots/003/M3-A14-cpu20-result.png'] : id === 'M3-O02' ? ['qa/screenshots/003/M3-K01-light-birth-top-diamond.png'] : id === 'M3-O08' ? ['qa/screenshots/003/M3-V01-m360x740-roulette-result.png'] : id === 'M3-O04' ? ['qa/screenshots/003/M3-R01-present-ending.png'] : id === 'M3-O01' ? ['qa/screenshots/003/M3-A05-roulette-after-back-forward.png'] : [] });
console.log('recorded RECORDs');

// ---- 이름 풀 대조(D08)와 움직임 줄이기 기록 ----
{
  const nc = JSON.parse(fs.readFileSync(path.join(OUT, 'names-check.json'), 'utf8'));
  add({ id: 'M3-D08', cat: '표본', title: '이름 풀 100% 일치(EV7·VP3): 주인공·또래 이름이 원자료(법원 상위 출생신고 이름 현황 JSON)·연대 풀·성씨 목록과 일치, 금지 이름 0', steps: '표본 640판의 주인공 640명 + 또래 2,560명(총 3,200명)을 화면에서 읽어 `src/data/sources/scourt-birth-names.json`(지금 세상 = 2025년 남·여 상위 20, 다가올 세상 = 2021~2025 합집합)·`names.json` 연대 풀·성씨 목록·`forbiddenNames.json`과 QA 스크립트가 직접 대조', expected: '이름(성 제외)이 해당 세상·성별 풀에 있고 성씨가 목록에 있으며 금지 이름 0', verdict: nc.bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: nc.bad.length ? nc.bad.slice(0, 5).join(' / ') : `${nc.total.toLocaleString('ko-KR')}명(지금 ${nc.checked.present}·지난 ${nc.checked.past}·다가올 ${nc.checked.future}) 모두 풀 일치·성씨 목록 일치·금지 이름 0`, shots: [] });
  add({ id: 'M3-O09', cat: '기록', title: '움직임 줄이기에서 「후보 전체」', steps: '-', expected: '-', verdict: 'RECORD', actual: 'RL1의 「후보 전체를 보이고 결과만 강조」는 수저 릴 5칸(5종 전부)과 확률표(5종·16개 시·도 전부)로 충족되지만, 지역 릴은 결과 칸 앞뒤 2칸(5칸)만 보여 「후보 전체」는 아래 확률표에서만 보인다. 판정에 넣지 않음(확률표가 전체 후보를 보임)', shots: ['qa/screenshots/003/M3-N06-reduced-m360.png'] });
}
console.log('recorded D08/O09');
