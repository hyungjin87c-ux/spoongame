// 2회차 마무리 기록: 부모 사건 정합(F01)·하단 표기(D07)·이름 대조(D08)·WebKit(X03)·기록(RECORD). cases.jsonl에 이어 쓴다.
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m3r2-lib.mjs';
const BIG = process.env.QA_BIG || OUT;
const CASES = path.join(OUT, 'cases.jsonl');
const add = (rec) => fs.appendFileSync(CASES, JSON.stringify({ at: new Date().toISOString(), console: [], externalRequests: [], ms: 0, ...rec }) + '\n');
const P = (era) => fs.readFileSync(path.join(BIG, `samples-${era}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));

for (const era of ['present', 'past', 'future']) {
  const r = fs.readFileSync(path.join(BIG, `family-${era}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const ok = r.filter((x) => x.info);
  const ev = (k) => ok.map((x) => x.info.events[k]).filter(Boolean);
  const mm = (a, g) => (a.length ? `${Math.min(...a.map(g))}~${Math.max(...a.map(g))}` : '-');
  const bad = r.filter((x) => x.error || x.bad?.length || x.errs?.length);
  add({ id: `M3-F01-${era}`, cat: '정합', title: `${era}: 부모 돌봄·임종 사건이 부모 나이와, 「동생이 생겼다」가 첫째·어머니 나이와 맞는가 — 8배속 자동 ${r.length}판`, steps: '개발 서버 ?__timescale=100, 룰렛→출생신고→인생 8배속 자동 완주 후 저장의 사건 기록을 출생신고의 부모 나이·형제 순서와 대조', expected: '위반 0',
    verdict: bad.length ? 'FAIL' : 'PASS', severity: '높음', actual: bad.length ? `위반 ${bad.length}판 ${JSON.stringify(bad.slice(0, 2)).slice(0, 300)}` : `${r.length}판 위반 0·예외 0 — 돌봄 ${ev('care').length}건(부모 나이 ${mm(ev('care'), (e) => e.parentAge)}세)·임종 ${ev('farewell').length}건(${mm(ev('farewell'), (e) => e.parentAge)}세)·동생 ${ev('sibling').length}건(어머니 ${mm(ev('sibling'), (e) => e.motherAge)}세, 모두 첫째)`, shots: [] });
}
{
  const bad = [];
  const per = [];
  for (const era of ['present', 'past', 'future']) {
    const rows = P(era);
    const want = era === 'present' ? 4 : 5;
    const lens = [...new Set(rows.map((r) => r.birth.foot.length))];
    if (lens.length !== 1 || lens[0] !== want) bad.push(`${era}: 하단 표기 줄 수 ${lens} (기대 ${want})`);
    if (!rows.every((r) => r.birth.logoPresent)) bad.push(`${era}: 헤더 로고 없는 판`);
    per.push(`${era} ${rows.length}판 ${want}줄`);
  }
  add({ id: 'M3-D07', cat: '표본', title: '출생신고 하단 표기·헤더 게임명(640판)', steps: '표본 640판의 하단 표기 줄 수와 헤더 로고', expected: '지금 4줄·지난/다가올 5줄, 로고 있음', verdict: bad.length ? 'FAIL' : 'PASS', severity: '낮음', actual: bad.length ? bad.join(' / ') : `위반 0 (${per.join(', ')}, 헤더 로고 전부)`, shots: [] });
}
{
  const nc = JSON.parse(fs.readFileSync(path.join(OUT, 'names-check.json'), 'utf8').toString());
  add({ id: 'M3-D08', cat: '표본', title: '이름 3,200명 원자료(법원 상위 이름 현황·연대 풀·성씨·금지 이름) 직접 대조', steps: '표본 640판의 주인공·또래 이름을 원자료 JSON과 대조', expected: '불일치 0', verdict: nc.bad.length ? 'FAIL' : 'PASS', severity: '중간', actual: nc.bad.length ? `불일치 ${nc.bad.length}` : `${nc.total.toLocaleString('en')}명 모두 일치(금지 이름 0)`, shots: [] });
}
add({ id: 'M3-X03', cat: '환경', title: 'WebKit(iOS Safari) 확인', steps: '설치된 Playwright 브라우저 확인(내려받지 않음)', expected: '-', verdict: 'SKIP', actual: 'WebKit 미설치(Chromium만 있음) → 미확인(내려받지 않음)', shots: [] });
const REC = [
  ['M3-O11', '글자 125%+ 넓은 화면의 비교 표 쌓기', '비교 카드를 컨테이너 질의(카드 내용 폭 35rem)로 쌓기 때문에 글자 125% 이상이면 1024·1280폭에서도 표가 한 행 한 덩어리로 쌓인다(1회차는 폭 640 이상이면 표). 글자 100%는 1회차와 같다(M3-C11b 22조합). 쌓인 모습은 읽히지만 「전체 평균」「이 가정 형편」 두 칸이 650px 안에서 멀리 떨어져 듬성해 보인다(qa/screenshots/003/M3r2-peek-compare-1280-125.png). 의도된 변경(QM3-1)'],
  ['M3-O12', '글자 200%의 unavoidable 근접 사례', '허용(한 줄보다 긴 낱말)으로 측정된 것 중 한 줄보다 겨우 2~6px 긴 것이 있다: 「제주특별자치도」 252px vs 246px(폭 320 · 서술문), 「강원/전북특별자치도」 252 vs 246, 「전남광주통합특별시」 288 vs 286(폭 360 · 「태어난 곳」 칸). 규칙상 허용이지만 서류 본문 안쪽 여백을 좁은 폭에서 조금 줄이면 없앨 수 있다(개발 로그 10절 남은 문제 1과 같은 지적). 글자 100%에서는 0'],
  ['M3-O13', '룰렛 결과 상태 문장의 줄바꿈', '폭 360 · 글자 200%에서 「다이아몬드수저(상위 / 3% 안쪽) 전남광주」처럼 구간 표현이 「(상위」와 「3% 안쪽)」으로 갈라진다. 낱말 끊김·숫자 단위 분리는 아니라 규칙 위반은 아니지만 읽기에 어색하다'],
  ['M3-O14', 'A01 터치 20연타의 타이밍 의존', '터치 20번이 이 PC에서 346ms 걸릴 때도, 660~930ms 걸릴 때도 있다. 입력 가드가 400ms라 가드가 풀린 뒤에 들어간 탭은 「건너뛰기」를 정당하게 누른다(가드 해제 466ms 뒤 수락 기록). 앱 결함이 아니라 측정 환경의 변동이라 M3-A01t(가드 안에 끝난 연타만 유효)로 나눠 판정했다. 앱 회귀 아님'],
  ['M3-O15', '긴 이름과 도장', '정상 플레이의 이름은 3글자뿐이라 도장과 겹치지 않는다(132조합). 변조 저장의 20자 이름·4글자 이름은 도장과 겹친다(33건, 글자 그대로·가로 넘침 0). 변조 한정이라 기록만'],
  ['M3-O16', '1회차 기록의 현재 상태', 'M3-O02(도장 대비 3.72:1)는 4.97:1로 해소. M3-O05(또래 안내의 없는 기능)는 해소(0건). M3-O07 중 비교 표 안내의 어체 혼용은 해소, 「동수저(하위 25%와 상위 45% 사이)」·「딱 중간쯤」·「하위 약 N% 또래 사이에서」는 M7e 이월로 남음. M3-O04(엔딩 외모 숫자)·O01(뒤로가기)·O06(미래 달 출생)은 명세대로 그대로'],
];
for (const [id, title, actual] of REC) add({ id, cat: '기록', title, steps: '-', expected: '-', verdict: 'RECORD', actual, shots: [] });
console.log('recorded');
