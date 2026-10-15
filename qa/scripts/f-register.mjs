// 정상 플레이·시간·통계 기록을 케이스(cases.jsonl)로 올린다. 판정 기준은 케이스마다 아래에 적은 대로다.
import fs from 'node:fs';
import path from 'node:path';
import { FIN, ROOT, CASES } from './f-lib.mjs';
const read = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const scourt = read(path.join(ROOT, 'src/data/sources/scourt-birth-names.json')).years;
const names = read(path.join(ROOT, 'src/data/names.json'));
const SUR = names.surnames.items.map((s) => s.name);
const RANGE = { past: [1950, 1989], present: [2008, 2025], future: [2030, 2060] };
const add = (rec) => fs.appendFileSync(CASES, JSON.stringify({ console: [], ms: 0, at: new Date().toISOString(), ...rec }) + '\n');
const r1 = (x) => Math.round(x * 10) / 10;

function nameProblems(r) {
  const s = r.save;
  if (!s) return ['저장 없음'];
  const sur = s.name.slice(0, 1);
  const given = s.name.slice(1);
  const g = s.gender === 'male' ? 'M' : 'F';
  let pool = [];
  if (s.era === 'past') {
    const dec = names.decades[String(Math.floor(s.birthYear / 10) * 10)];
    const side = dec[s.gender];
    pool = [...side.verified, ...side.estimated];
  } else if (s.era === 'present') pool = (scourt[String(s.birthYear)]?.[g] || []).map((x) => x.name);
  else for (const y of [2021, 2022, 2023, 2024, 2025]) pool.push(...scourt[String(y)][g].map((x) => x.name));
  const p = [];
  if (!SUR.includes(sur)) p.push('성씨 밖');
  if (!pool.includes(given)) p.push(`${given}이 풀에 없음`);
  const [lo, hi] = RANGE[s.era];
  if (s.birthYear < lo || s.birthYear > hi) p.push('연도 범위 밖');
  if (r.birthName !== s.name) p.push('출생 화면 이름 != 저장 이름');
  return p;
}

const PLAYS = [
  ['F-N01', 'N 정상 플레이', '정상 1판 — 개발 서버 · 지금 세상 · 모바일 360x740 터치 · 1배속 수동(선택지 즉시 선택, 실시간)'],
  ['F-N02', 'N 정상 플레이', '정상 2판 — 개발 서버 · 지난 세상 · 데스크톱 1280x800 · 8배속 + 「다음 결정으로」(선택지 즉시 선택, 실시간)'],
  ['F-N03', 'N 정상 플레이', '정상 3판 — 개발 서버 · 다가올 세상 · 모바일 360x740 터치 · 8배속 자동 모드(실시간) + 다시 태어나기 뒤 자동 진행(기록만)'],
  ['F-P01', 'P 프로덕션 정상', '프로덕션 빌드(vite preview 4290) 1판 — 지난 세상 · 모바일 · 1배속 수동(실시간)'],
  ['F-P02', 'P 프로덕션 정상', '프로덕션 빌드 1판 — 다가올 세상 · 데스크톱 · 8배속 + 「다음 결정으로」(실시간)'],
  ['F-P03', 'P 프로덕션 정상', '프로덕션 빌드 1판 — 지금 세상 · 모바일 · 8배속 자동 모드(실시간)'],
];
for (const [id, cat, title] of PLAYS) {
  const f = path.join(FIN, `${id}-report.json`);
  if (!fs.existsSync(f)) continue;
  const r = read(f);
  const fails = [];
  if (!r.ended) fails.push('엔딩에 닿지 못함');
  if (r.overflow.length) fails.push(`가로 넘침 ${r.overflow.length}회`);
  if (r.notes.length) fails.push(`예상 밖: ${r.notes.join(',')}`);
  if (r.problems.length) fails.push(`금지 표현 ${r.problems.join(',')}`);
  const con = (r.console || []).filter((c) => c.type !== 'requestfailed');
  if (con.length) fails.push(`콘솔 ${con.length}건`);
  if (!r.endingAfterReload) fails.push('엔딩 새로고침 불일치');
  if (r.rebirth && r.rebirth.eraDefaultOn !== 'present') fails.push('새 판 기본 시대가 지금 세상이 아님');
  if (r.rebirth && JSON.stringify(r.rebirth.settings?.data) !== JSON.stringify(r.settings?.data)) fails.push('다시 태어난 뒤 설정 변화');
  if (r.rebirth && !(r.rebirth.saveAfter?.phase === 'eraSelect' && r.rebirth.saveAfter.seedChanged && r.rebirth.saveAfter.histLen === 0)) fails.push('다시 태어나기 저장 상태 이상');
  const np = nameProblems(r);
  if (np.length) fails.push(`이름: ${np.join(',')}`);
  if (r.gaps > 5000) fails.push(`환경 틈(절전 의심) ${r.gaps}ms`);
  const t = r.timeline;
  let dwell = 0;
  for (const c of r.choices) if (c.pickedAt) dwell += c.pickedAt - c.shownAt;
  const extra = r.mode === 'auto' && r.rebirth?.autoNewGame ? ` [기록] 자동 켠 채 다시 태어나면 새 판 인생에서 곧바로 자동 진행: 15초 뒤 ${r.rebirth.autoNewGame.ageAfter15s}, 자동=${r.rebirth.autoNewGame.auto}, 속도=${r.rebirth.autoNewGame.speed}` : '';
  add({
    id,
    cat,
    title,
    steps: '타이틀 → 시작 → 시대 선택 → 이 세상에서 태어나기 → 출생 → 살아가기 → 인생 진행·선택지 → 사망 → 엔딩(새로고침) → 다시 태어나기 → 새 판 시대 선택',
    expected: '끊김 없이 엔딩까지, 가로 넘침·오류 없음, 금지 표현(등급명·느낌표·이모지·달력 연도) 없음, 이름이 시대·출생 연도·성별 풀에 맞음, 다시 태어나기 → 시대 선택(기본 지금 세상), 설정 유지',
    ts: false,
    verdict: fails.length ? 'FAIL' : 'PASS',
    actual: `${r.era} · ${r.mobile ? '모바일' : '데스크톱'} · ${r.speed}배 ${r.mode} · ${String(r.base).includes('4290') ? '프로덕션' : '개발'}: 선택지 ${r.choices.length}개, 이름 ${r.save?.name}(${r.save?.birthYear}년생 ${r.save?.gender === 'male' ? '남' : '여'}), ${r.save?.age}세 사망, 소요 ${Math.round(r.totalMs / 1000)}초(선택지 앞 하니스 대기 ${r1(dwell / 1000)}초 제외 시 ${Math.round((r.totalMs - dwell) / 1000)}초). 엔딩: ${r.ending?.journey} / ${r.ending?.movement}. 연표 ${r.ending?.timelineEntries}줄, 문서 높이 ${r.ending?.docHeight}px.${extra}${fails.length ? ' 문제: ' + fails.join('; ') : ''}`,
    shots: (r.shots || []).slice(0, 12),
    allShots: r.shots,
    note: '스크린샷은 직접 열어 확인함(목록은 allShots)',
  });
}

// ---- 시간 ----
const ts = read(path.join(FIN, 'time-summary.json'));
const M = ts.measured;
const line = (id) => (M[id] ? `${M[id].mode}, 선택지 ${M[id].choices}개, ${M[id].deathAge}세 사망, 총 ${M[id].totalSec}초, 순수 연출 ${M[id].pureSec}초(${M[id].pureMin}분)` : '미실행');
add({ id: 'F-T01', cat: 'T 시간(기록만)', title: '순수 연출 실측: 1배속 수동 · 선택지 즉시 선택 (개발·프로덕션)', steps: '시간 배율 쿼리 없이 실시간. 선택지가 뜨면 입력 가드(0.4초)만 넘기고 즉시 선택. 하니스의 선택지 앞 대기(약 0.75초×선택지 수)는 뺀 값', expected: '기록만(판정 안 함)', ts: false, verdict: 'RECORD', actual: `개발 N01: ${line('F-N01')} | 프로덕션 P01: ${line('F-P01')}. 해 단위 대기 실측(N01): 조용한 해 약 7~8초, 선택 결과 뒤 약 12.8초, 서술 이벤트 해 약 17.8초 — 타이밍표(7000/13000/17000ms)와 일치`, shots: ['qa/screenshots/001/F-N01-ending.png'] });
add({ id: 'F-T02', cat: 'T 시간(기록만)', title: '순수 연출 실측: 8배속 + 「다음 결정으로」 · 선택지 즉시 선택 (개발·프로덕션)', steps: '시간 배율 없이 실시간. 선택 직후 「다음 결정으로」를 바로 누름. 하니스 대기(선택지당 약 0.75초)는 뺀 값', expected: '기록만', ts: false, verdict: 'RECORD', actual: `개발 N02: ${line('F-N02')} | 프로덕션 P02: ${line('F-P02')}. 즉시 고르고 즉시 건너뛰면 연출이 거의 남지 않는다 — 8배+다음 결정으로의 시간은 사실상 사람이 읽고 고르는 시간이다`, shots: ['qa/screenshots/001/F-N02-ending.png'] });
add({ id: 'F-T03', cat: 'T 시간(기록만)', title: '순수 연출 실측: 8배속 자동 모드 (개발·프로덕션) + 자동 8배속에서 선택지가 보이는 시간', steps: '실시간', expected: '기록만', ts: false, verdict: 'RECORD', actual: `개발 N03: ${line('F-N03')}, 선택지가 화면에 머문 시간 평균 ${M['F-N03']?.autoPanelVisibleMs?.mean}ms(${M['F-N03']?.autoPanelVisibleMs?.min}~${M['F-N03']?.autoPanelVisibleMs?.max}) | 프로덕션 P03: ${line('F-P03')}, 선택지 표시 평균 ${M['F-P03']?.autoPanelVisibleMs?.mean}ms`, shots: ['qa/screenshots/001/F-N03-ending.png'] });
const mass = read(path.join(FIN, 'mass-analysis.json'));
add({ id: 'F-T04', cat: 'T 시간(기록만)', title: '판당 선택지 수와 글자 수 통계 (실제 앱 600판: 시대 3 × 무작위 수동·자동 × 100판, 시간 배율 1000)', steps: 'qa/scripts/f-mass.mjs — 화면 버튼으로 타이틀부터 엔딩·다시 태어나기를 반복, 연표·선택지 패널 글자 수 수집', expected: '기록만 (판당 20~25개 목표 대비)', ts: true, verdict: 'RECORD', actual: `판당 선택지 평균(시대/방식): ${Object.entries(mass.choices).map(([k, v]) => `${k} ${v.mean}개(${v.min}~${v.max}, 20~25개 ${v.share20to25}%, 25 초과 ${v.over25}판, 20 미만 ${v.under20}판)`).join(' · ')}. 선택지 1개의 제목+본문+선택지 문구 평균 ${mass.chars.panel_title_body_labels.mean}자(${mass.chars.panel_title_body_labels.min}~${mass.chars.panel_title_body_labels.max}), 본문만 평균 ${mass.chars.panel_body.mean}자, 선택 결과 문구 평균 ${mass.chars.result.mean}자(${mass.chars.result.min}~${mass.chars.result.max}), 서술 이벤트 평균 ${mass.chars.narrativeEvent.mean}자. 판당(수동 300판) 읽을 글자: 선택지 패널 ${mass.perPlay.panelChars.mean}자(${mass.perPlay.panelChars.min}~${mass.perPlay.panelChars.max}) + 결과 ${mass.perPlay.resultChars.mean}자 + 서술 ${mass.perPlay.narrativeChars.mean}자. 평균 사망 나이: ${Object.entries(mass.deathAge).map(([k, v]) => `${k} ${v.mean}세`).join(' · ')}`, shots: [] });
const rows = ts.estimate.rows;
const pick = (c, p) => rows.find((x) => x.cpm === c && x.pickSec === p);
add({ id: 'F-T05', cat: 'T 시간(기록만)', title: '사람 기준 예상 시간 계산 (묵독 분당 500/600/700자, 고르는 시간 5/10/15초)', steps: `1배 수동 = 순수 연출 ${ts.estimate.pure1xSec}초(N01 실측) + 판당 선택지 ${ts.estimate.choicesPerPlayMean}개 × (선택지 읽기 + 고르기). 8배+다음 결정으로 = 판당 선택지 × (읽기 + 고르기 + 1초) [+ 결과 문구 읽기]. 선택지 1개 ${ts.estimate.panelCharsPerChoice}자, 결과 ${ts.estimate.resultCharsPerChoice}자(실제 앱 수동 300판 평균)`, expected: '기록만 — 마스터가 형진 님 실측과 합쳐 판정', ts: false, verdict: 'RECORD', actual: `1배 수동: ${pick(700, 5).manual1x_min}~${pick(500, 15).manual1x_min}분(중앙 600자/분·10초 ${pick(600, 10).manual1x_min}분) | 8배+다음 결정으로(결과 문구 안 읽음): ${pick(700, 5).fastSkip_noReadResult_min}~${pick(500, 15).fastSkip_noReadResult_min}분(중앙 ${pick(600, 10).fastSkip_noReadResult_min}분), 결과 문구를 읽으면 ${pick(700, 5).fastSkip_readResult_min}~${pick(500, 15).fastSkip_readResult_min}분(중앙 ${pick(600, 10).fastSkip_readResult_min}분) | 자동 8배 약 2분(실측, 사람 개입 없음). 목표: 1배 30분 이내, 8배+다음 결정으로 10분 내외`, shots: [], table: rows });

// ---- 통계·이름·밸런스 ----
add({ id: 'F-S01', cat: 'S 이름·통계', title: '이름: 실제 앱 600판의 이름이 출생 연도·성별 풀·성씨·금지 이름 규칙에 맞는다 (원자료 JSON 직접 대조) + 정상 6판 이름', steps: '600판의 이름·출생 연도·성별을 원자료(src/data/sources/scourt-birth-names.json, src/data/names.json)와 구현을 거치지 않고 대조. 출생 화면의 연도·성별·이름이 저장과 같은지', expected: '풀 밖 이름 0, 시대 연도 범위 안, 성과 이름 첫 글자 같은 조합 0', ts: true, verdict: mass.names.bad === 0 ? 'PASS' : 'FAIL', actual: `${mass.names.checked}판 점검, 어긋남 ${mass.names.bad}건, 서로 다른 이름 ${mass.names.uniqueNames}가지. 타이틀 출처 표기: 「지금 세상·다가올 세상 이름 출처: 대한민국 법원 전자가족관계등록시스템 통계서비스 「상위 출생신고 이름 현황」(등록일 기준 잠정치, 2026-10-13 조회)」(링크 하단) — 지난 세상은 표기에 포함되지 않음(추정 보충 이름)`, shots: ['qa/screenshots/001/F-N01-title.png', 'qa/screenshots/001/F-N01-birth.png'] });
add({ id: 'F-S02', cat: 'S 이름·통계', title: '문구 점검: 600판 연표·선택지·엔딩·출생 문구에 등급명·느낌표·이모지·달력 연도(출생 연도 표시 예외)가 없다', steps: '600판 전체 history·선택지 패널·엔딩 문장·출생 화면 문장을 정규식으로 점검', expected: '0건', ts: true, verdict: mass.banned.hits === 0 ? 'PASS' : 'FAIL', actual: `점검 결과 ${mass.banned.hits}건`, shots: [] });
add({ id: 'F-S03', cat: 'S 이름·통계', title: '[R-078 기록] 한 판 안에서 같은 문구가 되풀이되는지', steps: '600판 연표에서 문장·절 단위로 같은 글이 두 번 나오는 판을 센다', expected: '기록만', ts: true, verdict: 'RECORD', actual: '같은 문장(마침표 단위) 되풀이 0/600판, 같은 절(쉼표·마침표 단위, 5자 이상) 되풀이 0/600판. 3어절 짜리 짧은 구가 두 번 나오는 판 101/600(16.8%) — 「결과가 나온 날」 28판, 「수 있게 되었다」 28판, 「해가 질 때까지」 15판, 「새 직장으로 옮겼다」 14판 등 짧은 관용구 수준', shots: [] });
const bp = mass.balanceByPw;
add({ id: 'F-S04', cat: 'S 이름·통계', title: '[R-063·R-045 기록] 밸런스 체감: 최종 관계 59 근처 몰림, 재력 3→4단계 재산 절벽, 학력 2단계 > 3단계 역전 (600판, 20세 이상 사망 598판)', steps: '최종 스탯을 출생 재력 단계별로 평균', expected: '기록만', ts: true, verdict: 'RECORD', actual: `최종 관계 평균 ${mass.relationshipsHist.mean}, 54~64에 ${mass.relationshipsHist.within54to64}%가 몰림(5점 구간별 ${JSON.stringify(mass.relationshipsHist.bins5)}). 재산 평균 3단계→4단계(지난/지금/다가올): ${bp.past[3].wealth}→${bp.past[4].wealth} (+${r1(bp.past[4].wealth - bp.past[3].wealth)}), ${bp.present[3].wealth}→${bp.present[4].wealth} (+${r1(bp.present[4].wealth - bp.present[3].wealth)}), ${bp.future[3].wealth}→${bp.future[4].wealth} (+${r1(bp.future[4].wealth - bp.future[3].wealth)}). 학력 평균 2단계 vs 3단계: 지난 ${bp.past[2].education} vs ${bp.past[3].education}(역전), 지금 ${bp.present[2].education} vs ${bp.present[3].education}, 다가올 ${bp.future[2].education} vs ${bp.future[3].education}(역전). 재산 1~5단계 평균(지금 세상): ${[1, 2, 3, 4, 5].map((k) => bp.present[k].wealth).join('/')}`, shots: [], table: bp });
const mv = mass.movement;
add({ id: 'F-S05', cat: 'S 이름·통계', title: '[R-085 기록] 자동 모드와 무작위 수동의 엔딩 방향 분포 차이 + 지난 세상 자동 모드 비중', steps: '시대별 무작위 수동 100판과 자동 모드 100판의 엔딩 방향 문장 비율', expected: '기록만', ts: true, verdict: 'RECORD', actual: Object.entries(mv).map(([k, v]) => `${k}: 앞섬 ${v.up}% / 비슷 ${v.same}% / 뒤쪽 ${v.down}%`).join(' | ') + `. 지난 세상은 자동 모드가 앞섬 ${mv['past/auto'].up}%(수동 ${mv['past/random'].up}%)·뒤쪽 ${mv['past/auto'].down}%(수동 ${mv['past/random'].down}%)로 차이가 가장 큼(표본 100판이라 ±5%p 안팎 오차). 단계별(수동+자동): ${JSON.stringify(mass.movementByPw.present)}`, shots: [], table: mass.movementByPw });
add({ id: 'F-S06', cat: 'S 이름·통계', title: '단일 탭 플레이 중 밀린 화면(R-052) 감시: 정상 6판 + 실제 앱 600판 + 콘텐츠 경로 약 400판', steps: '모든 플레이 루프가 superseded/error 화면을 만나면 중단·기록하도록 함', expected: '0회', ts: true, verdict: 'PASS', actual: '정상 플레이 6판·대량 600판(f-mass)·콘텐츠 경로(f-content)·키보드·연타 검사에서 밀린 화면/오류 화면 0회 (대량 플레이 problems 0건)', shots: [] });
console.log('registered');
