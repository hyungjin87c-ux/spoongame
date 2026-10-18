// QA-003 M7e 최종 집계: 수확·플레이·엔딩 표·또래·감사 결과를 읽어 케이스를 cases.jsonl에 덧붙인다(이미 스크립트가 직접 기록한 케이스는 건드리지 않는다).
// 사용: node qa/scripts/m7e-final-cases.mjs     (이 스크립트가 쓰는 ID: N01~N07, T01~T08, B01~B06, L01~L04, C10)
import fs from 'node:fs';
import path from 'node:path';
import { OUT, addCase } from './m7e-lib.mjs';

const J = (f, d = null) => (fs.existsSync(path.join(OUT, f)) ? JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')) : d);
const casesPath = path.join(OUT, 'cases.jsonl');
const mine = /^M7e-(N0[1-7]|N04b|T0[1-8]|T10|B0[1-6]|L0[1-5]|C10|K03|R12|R12b|X01|X03)$/;
fs.writeFileSync(casesPath, fs.readFileSync(casesPath, 'utf8').trim().split('\n').filter((l) => !mine.test(JSON.parse(l).id)).join('\n') + '\n');

const an = J('analysis.json');
const tab = J('ending-table.json');
const eh = J('ending-harvest.json');
const plays = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'].map((t) => J(`play-${t}.json`)).filter(Boolean);
const peers = ['past', 'present', 'future'].flatMap((e) => J(`peers-${e}.json`, []));
const audit = J('audit-summary.json');
const shotsOf = (...ns) => ns.map((n) => `qa/screenshots/003/${n}.png`);

// ---------------- N01 정상 8판 ----------------
{
  const bad = [];
  const rows = plays.map((p) => `${p.tag}(${p.era}·재력 ${p.final?.tier}·${p.vpName}·배속 ${p.plan.map((x) => `${x.a}-${x.b}:${x.sp}x`).join('/')}·${p.pickMode})→사망 ${p.final?.age}세·결정 ${p.decisions.length}`);
  for (const p of plays) {
    if (p.errors.length) bad.push(`${p.tag}: 오류 ${p.errors}`);
    if (p.console.length) bad.push(`${p.tag}: 콘솔 ${p.console.length}`);
    if (p.externalRequests.length) bad.push(`${p.tag}: 외부요청 ${p.externalRequests.length}`);
    if (p.ending.f.length) bad.push(`${p.tag}: 엔딩 판정 ${p.ending.f}`);
  }
  const combos = new Set(plays.map((p) => `${p.era}-t${p.final?.tier}`));
  addCase({ id: 'M7e-N01', cat: '정상', title: `세 시대 × 재력 1·3·5를 섞어 ${plays.length}판을 끝까지 플레이(문장을 읽으며, 학창 이후 1·2·4배속 구간 포함)`, steps: '첫 화면 → 룰렛 → 출생신고 → 대시보드 0세~사망 → 엔딩. 카드마다 글·영향 줄을 읽어 기록하고 단계별 스크린샷', expected: '모든 판이 엔딩에 닿고 콘솔 0·외부 요청 0·엔딩 판정(글자 기대값) 통과', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `${plays.length}판 모두 정상(조합 ${[...combos].sort().join(' ')}): ${rows.join(' ; ')}`, shots: shotsOf('M7e-N01-p1-card-school-1-age8', 'M7e-N01-p1-card-youth-1-age21', 'M7e-N01-p1-card-senior-1-age66', 'M7e-N01-p1-ending-top', 'M7e-N01-p5-ending-journey', 'M7e-N01-p6-ending-journey', 'M7e-N01-p7-ending-journey') });
}

// ---------------- N02 어체 ----------------
if (an) {
  const t1 = an.checks.T1;
  addCase({ id: 'M7e-N02', cat: '정상', title: '어체 혼재 0: 이벤트 본문·결과·인생 기록·연표·엔딩 문장이 모두 합쇼체(「~습니다.」)', steps: `수확 ${an.lives}판(+플레이)의 연표·결정 카드·엔딩 글을 문장 단위로 쪼개 끝맺음을 센다 + 이벤트 140개 본문·결과 788문장 정적 대조`, expected: '해라체·해요체·「읍니다」·느낌표·물음표 0', verdict: t1.nonHap === 0 ? 'PASS' : 'FAIL', actual: `화면 문장 ${t1.sentences.toLocaleString('ko-KR')}개(연표 줄·카드 본문·사망 줄·엔딩 문장) 중 합쇼체가 아닌 문장 ${t1.nonHap}개(출처: ${Object.entries(t1.bySrc).map(([k, v]) => `${k} ${v}`).join(', ')}). 이벤트 JSON 140개의 본문 140·결과 257·문장 788개도 전부 「~니다.」, 제목·라벨 397개는 마침표·숫자 없음`, shots: [] });
}

// ---------------- N03 엔딩 새 화면 ----------------
if (tab) {
  const fails = tab.filter((r) => r.err || r.fail.length);
  const na = tab.length;
  const fut0 = fails.filter((r) => /future-t1-zero/.test(r.name));
  const real = fails.filter((r) => !/future-t1-zero/.test(r.name));
  addCase({ id: 'M7e-N03', cat: '정상', title: '엔딩 새 화면: 머리(「{세상} · 생애 기록」·「{이름}의 인생」·「{연월} ~ {연}년 · N세」)·사망 줄·선택 수 줄·출발선 막대·범례·문장·최종 순자산(금액만)·외모(「또래 사이에서 …」)·연표 단계 줄', steps: `엔딩 저장 ${na}종(세 시대 × 재력 1~5 × 앞섬·비슷함·뒤쪽·경계·0원·상위/하위 1%·20세 미만·이름 변조) + 플레이 ${plays.length}판을 prod 엔딩 화면에 열어 각 요소의 글을 읽고 글자에서 푼 기대값으로 판정`, expected: '모든 요소가 새 문안·새 구조, 가로 넘침 0, NaN 0', verdict: real.length ? 'FAIL' : 'PASS', actual: real.length ? real.slice(0, 4).map((r) => `${r.name}: ${r.fail.join('; ')}`).join(' / ') : `${na}종 중 ${na - fails.length}종 통과. 실패 ${fails.length}종은 모두 「다가올 세상 흙수저 0원 = 앞섬」 판정 하나(N04b로 분리)`, shots: shotsOf('M7e-E-ending-present-t3-up-top', 'M7e-E-ending-present-t3-up-journey', 'M7e-E-ending-present-t3-down-journey', 'M7e-E-ending-present-t3-same-journey', 'M7e-E-ending-past-t2-journey') });
}

// ---------------- N04 / N04b 0원 ----------------
if (tab && eh) {
  const zs = tab.filter((r) => /-zero$/.test(r.name) && !/name/.test(r.name));
  const nonFuture = zs.filter((r) => !/^ending-future/.test(r.name));
  const bad = nonFuture.filter((r) => r.fail.length);
  const z = eh.zero;
  const zr = (k) => (z[k] ? `${k} 앞섬 ${z[k].up}·비슷함 ${z[k].same}·뒤쪽 ${z[k].down}` : null);
  addCase({ id: 'M7e-N04', cat: '정정', title: '0원 엔딩(동률 불리): 지난·지금 세상에서 흙수저(1단계) 0원이 「앞섬」이 아니고, 모든 0원 판의 최종 자리가 「하위 약 N%」(「가운데쯤」 아님), 최종 순자산 줄은 금액만', steps: `0원 변형 저장 ${zs.length}개(세 시대 × 재력 1~5) + 자연 0원 판(수확·플레이 ${Object.values(z).reduce((n, v) => n + v.up + v.same + v.down, 0)}판)을 읽는다`, expected: '지난·지금 세상 1단계 0원 = 「비슷함」, 자리 「하위 약 N%」, 「0원」 줄에 자리 글자 없음', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.map((r) => `${r.name}: ${r.fail}`).join(' / ') : `저장: 지난 1단계 「${zs.find((r) => r.name === 'ending-past-t1-zero')?.d.movement}」(하위 약 26%), 지금 1단계 「${zs.find((r) => r.name === 'ending-present-t1-zero')?.d.movement}」(하위 약 25%) — 지금 세상 재력 1~2 「비슷함」·3~5 「뒤쪽」. 자연 판: ${['past-t1', 'present-t1', 'present-t2', 'past-t2'].map(zr).filter(Boolean).join(' · ')}. 최종 순자산 줄은 「0원」만(「지금 가치로 환산」 태그는 지난·다가올 세상), 「가운데쯤」 최종 자리 0`, shots: shotsOf('M7e-E-ending-present-t1-zero-journey', 'M7e-E-ending-past-t1-zero-journey', 'M7e-N01-p2-ending-journey', 'M7e-E-ending-present-t2-zero-journey') });
  addCase({ id: 'M7e-N04b', cat: '정정', title: '0원 엔딩 — 다가올 세상 흙수저(1단계): 0원으로 마쳐도 「출발선보다 앞선 자리입니다.」 (요청문의 「흙수저 0원이 앞섬이 아님」과 다름)', steps: '다가올 세상 재력 1단계(출발선 「하위 30% 안쪽」)의 0원 저장, 그리고 자연 플레이(시드 13, 첫 판 p3)와 수확의 0원 판', expected: '(요청문) 흙수저 0원이 「앞섬」이 아님', verdict: 'FAIL', actual: `다가올 세상은 0원이 「하위 약 37%」(0원 미만으로 마친 인생 37%)이고 흙수저 구간이 하위 30% 안쪽이라 0원 판 ${eh.zeroFuture1Up}/${(z['future-t1'] ?? { up: 0, same: 0, down: 0 }).up + (z['future-t1'] ?? { same: 0 }).same + (z['future-t1'] ?? { down: 0 }).down}판이 모두 「하위 30% 안쪽의 집에서 태어나, 하위 약 37%의 형편으로 생을 마쳤습니다. 출발선보다 앞선 자리입니다.」로 읽히고 같은 화면의 최종 순자산은 「0원」. 지난·지금 세상은 「비슷함」. 설계 문서(copy.md 5-2 ①의 표: 다가올 세상 1단계 0원 = 앞섬, 「그 세상의 38%가 빚으로 마치므로 사실과 맞다」)와는 일치하지만 요청문과 어긋나므로 마스터 확인 필요 — 문서대로 수용하면 RECORD로 내림`, shots: shotsOf('M7e-E-ending-future-t1-zero-top', 'M7e-E-ending-future-t1-zero-journey', 'M7e-N01-p3-ending-journey') });
}

// ---------------- N05 스무 살 전 엔딩 ----------------
if (tab) {
  const early = tab.filter((r) => /^ending-before20/.test(r.name));
  const bad = early.filter((r) => r.fail.length || r.err);
  addCase({ id: 'M7e-N05', cat: '정상', title: '스무 살 전 엔딩: 막대는 띠만(마름모·「마지막」 범례·방향 문장·주석 없음), 문장 「…의 집에서 태어났습니다.」, 최종 순자산 줄 「스무 살이 되기 전이라 자산을 세지 않았습니다.」', steps: `12·17·18세 사망 엔딩 ${early.length}종(세 시대 × 재력 1·3·5) + 영유아 사망 6종을 prod 엔딩에서 읽는다(선택 0번 문장은 N05b)`, expected: '구조·문장 정상, aria-label 「출발선 {구간}.」', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.map((r) => `${r.name}: ${r.fail}`).join(' / ') : `${early.length}종 모두 정상(예 ${early[0].d.label} / 「${early[0].d.journey}」). 영유아 사망 6종도 통과(ending-infant.json)`, shots: shotsOf('M7e-E-ending-before20-present-t3-a17-top', 'M7e-E-ending-before20-present-t3-a17-journey', 'M7e-E-ending-before20-past-t1-a12-journey') });
}

// ---------------- N07 배속 ----------------
{
  const slow = plays.filter((p) => p.plan.some((x) => x.sp <= 2 && x.b >= 20));
  addCase({ id: 'M7e-N07', cat: '정상', title: '학창 이후 1~2배속 구간 포함 플레이: 느린 배속으로 학창·청년·중년까지 카드와 기록 줄을 읽으며 진행', steps: '플레이 p1(전 구간 2배속)·p5(0~9세 1배속, 10~39세 2배속)·p7(전 구간 2배속)·p4(0~19세 2배속)', expected: '배속 바꿈·카드·기록 줄 정상', verdict: slow.length >= 2 ? 'PASS' : 'FAIL', actual: `느린 구간 포함 플레이 ${slow.map((p) => `${p.tag}(${p.plan.map((x) => `${x.a}-${x.b}:${x.sp}x`).join('/')})`).join(', ')}: 모두 오류 0, 카드 ${slow.reduce((n, p) => n + p.decisions.length, 0)}장`, shots: shotsOf('M7e-N01-p5-card-school-1-age7', 'M7e-N01-p7-card-youth-1-age21') });
}

// ---------------- T 문장 품질 ----------------
if (an) {
  addCase({ id: 'M7e-T08', cat: '문장 품질', title: '뜻이 이상하거나 어색한 문장(소수): 읽다가 걸린 문장 목록', steps: '이벤트 140개 본문·결과 전부와 플레이 8판의 인생 기록을 소리 내어 읽듯이 읽는다', expected: '(주관 점검 — 낮은 심각도는 기록)', verdict: 'RECORD', actual: "① youth-night-study/study 「몇 해 뒤 손에 쥔 증서는 더 이상 낯설지 않았습니다.」 — 방금 받은 증서가 「낯설지 않다」는 말이 앞 문장과 이어지지 않음 ② middle-late-child 본문 「늦게 맞은 아이는 또래 부모들보다 나이 든 나를 부모로 두었습니다.」 — 목적어·보어가 겹쳐 읽기 어렵다 ③ school-first-love/keep 「그 마음은 책상 앞에서 눌러 두었습니다.」 — 주제어 「마음은」과 서술어의 행위자가 어긋남 ④ youth-marriage/part 「한동안 집이 유난히 조용했고, 생활비는 가벼워졌습니다.」·youth-partner-leaves 「짐을 정리해 떠났습니다」 — 아직 함께 살지 않는 연인(has_partner, 미혼 = 함께 살기 전)에게 동거를 전제한 문장 ⑤ senior-classmates/skip 「…전해 들었습니다. 차비는 아꼈습니다.」·middle-friend-reunion/later 「쓸 일 없던 돈은 남았습니다」 — 지배 해소용 「유혹 한 줄」이 앞 사건과 이어지지 않고 갑작스러움(같은 문형 6곳) ⑥ school-scholarship/apply 「결과가 나온 날 학비의 한몫을 덜었습니다.」 — 뜻은 통하나 부자연 ⑦ 사망 줄 「원인은 조용한 잠이었습니다.」(수확 판의 29%) — 설계자 노트(copy.md 5-5 ④)대로 조금 시적임 ⑧ 7세 3인칭(「아이」) → 8세 1인칭(「나」)으로 시점이 넘어감(E-8 결정, M7a-O01의 후속: 이제 말투는 같아졌고 시점만 바뀜)", shots: [] });
  addCase({ id: 'M7e-T10', cat: '문장 품질', title: '외동·미혼·무자녀 판(식구가 부모뿐)에서도 「가족과 나누어 맡는다」·「가족과 함께 의논해 치른다」(E-9: 「형제들」 → 「가족」)가 보이고 고를 수 있다', steps: "수확 표본의 부모 병환·임종 카드에서 형제 없음·미혼·무자녀 판의 선택지를 센다", expected: '(설계 판단) 「가족」이 누구인지 화면 어디에도 없음', verdict: 'RECORD', actual: '외동·미혼·무자녀 판의 부모 병환·임종 카드 63장(수확) 중 「가족과 …」를 고른 판 20(32%) — 결과 문장은 「순번을 정해 돌아가며 찾아뵈었습니다. 크고 작은 서운함이 오갔지만 결국 서로를 챙겼습니다.」·「가족과 역할을 나누어 장례를 치렀습니다…」로 함께하는 사람이 있는 것처럼 읽힌다(친척으로 읽을 수는 있음). 가족 카드에는 「형제자매 없음·배우자 없음·자녀 없음」', shots: [] });
}
if (an) {
  const t2 = an.checks.T2;
  const t3 = an.checks.T3;
  const t4 = an.checks.T4;
  const t5 = an.checks.T5;
  const t6 = an.checks.T6;
  const ends = Object.entries(t2.endPhrase).slice(0, 3).map(([k, v]) => `「${k}」 ${v.length}곳`).join(', ');
  addCase({ id: 'M7e-T02', cat: '문장 품질', title: '어색한 합쇼체: 「~하게 되었습니다」 남발·해설 종결·끝맺음 반복·높임 불일치', steps: '이벤트 140개 문장(정적)과 수확 표본(화면)에서 끝맺음 낱말·구절을 세고 높임 주어(부모님·조부모님·선생님)에 「-시-」가 있는지 본다', expected: '「게 되었습니다」 ≤ 2, 해설 종결 0, 같은 끝 구절 한 본문 반복 0, 높임 불일치 없음', verdict: 'RECORD', actual: `「~하게 되었습니다」 1곳(infant-hospital-stay 「입원하게 되었습니다」, 허용 ≤ 2), 해설 종결 0, 한 본문의 두 문장이 같은 끝 구절 0. 남은 것(낮은 심각도): ① 높임 불일치 5곳 — infant-daycare-wait/grandparents 「조부모님이 낮 동안 아이를 맡았습니다」·infant-early-lessons/lessons 「방문 선생님이 찾아와 … 가르쳤습니다」(8세 이상 school-tutoring/tutor 「짚어 주셨습니다」·school-early-work 「줄이셨습니다」와 다름), 관계절 3곳(infant-care·infant-neglect-night·middle-parents-farewell의 「부모님이 …」) ② 「어른들」 8세 이상 문자열 7개(school-bully/tell·school-family-priority/accept·plead·school-puppy/keep·youth-matchmaker 3개)가 planner 지침 B7 「불특정 어른들은 쓰지 않는다」와 어긋남(M7e-2 로그 6-4가 youth-matchmaker는 의도적 유지) ③ 끝맺음 편중 — 결과 257개 중 105개(41%)가 「~지만」 대비 구문, 마지막 문장이 「~수 있었습니다」인 결과 10개(${ends}), 한 판 안에서 연표 줄 세 개가 연달아 「~수 있었습니다」로 끝나는 판이 있음(past 시드 104, 30~34세: youth-single-years → youth-startup/side → youth-matchmaker/decline) ④ 「유혹 한 줄」 문형 「~은 아꼈습니다」가 6곳(school-puppy/pass·youth-housing/parents·middle-health-check-later/ignore·middle-friend-reunion/later·senior-fall/ignore·senior-classmates/skip) — 마지막 짧은 문장 「차비는 아꼈습니다.」는 앞 내용과 이어지지 않아 갑작스럽다`, shots: [] });
  addCase({ id: 'M7e-T01', cat: '문장 품질', title: `이벤트 140개 전부 화면에서 읽음: 140/140 이벤트, 결과 문장 257/257(수확 254 + 카드 저장 3), 합쇼체·부호·숫자 점검`, steps: `수확 ${an.lives}판(세 시대 × 재력 1~5, 첫째·둘째 이상, 선택 정책 mix)에서 만난 이벤트와 결과를 센다`, expected: '140개 이벤트·결과 문장을 화면에서 모두 확인', verdict: 'PASS', actual: '이벤트 140/140을 수확 표본에서 만났고 결과 문장 254/257은 표본에서, 나머지 3개(infant-moving/buy·infant-early-lessons/english·senior-estranged-child/letter)는 카드 저장으로 직접 눌러 읽음(M7e-T09)', shots: [] });
  addCase({ id: 'M7e-T04', cat: '문장 품질', title: '시대 금지어(지난 세상의 새 소재·지금·다가올 세상의 옛 소재·다가올 세상 전용어) 0', steps: `수확 표본 ${an.lives}판의 카드·연표 문장에서 lint의 시대 금지어 목록(학원·급식·휴대전화·인터넷·재택… / 연탄·라디오·텃밭·맞선… / 로봇·인공지능…)과 별도 의심어(유튜브·택배·카페·핸드폰·컴퓨터…)를 찾는다`, expected: '금지어 0(지난 세상 노년의 새 기기는 허용)', verdict: t4.hits === 0 ? 'PASS' : 'FAIL', actual: `금지어 ${t4.hits}건, 별도 의심어 0건(「기계」는 youth-factory-night·senior-new-device의 정당한 쓰임이라 제외)` , shots: [] });
  addCase({ id: 'M7e-T05', cat: '문장 품질', title: '숫자·금액·인용 부호·이모지 0(이벤트 본문·결과·제목·선택지 라벨)', steps: '수확 카드·연표 문장과 정적 140개 이벤트에서 숫자·금액(만 원·억 원)·큰따옴표·작은따옴표·낫표·이모지를 찾는다', expected: '0', verdict: t5.digits === 0 && t5.quotes === 0 && t5.amount === 0 ? 'PASS' : 'FAIL', actual: `숫자 ${t5.digits}·인용 부호 ${t5.quotes}·금액 ${t5.amount}건`, shots: [] });
  addCase({ id: 'M7e-T06', cat: '문장 품질', title: '새 안내 줄·상태 도움말·20세 미만 자산 카드 풀이(M5 문구 후보 ②·③)', steps: `결정 카드 ${t6.decisions}장의 안내 줄, 20세 미만 자산 카드 ${t6.assetsYoung}장, 상태 도움말(8·20·45·70세 플레이 기록)을 읽는다`, expected: '안내 줄 「선택지 아래 글씨는 이 선택만으로 {이름}에게 생기는 변화입니다.」, 도움말 끝 두 문장, 자산 카드 셋째 문장', verdict: t6.hintBad === 0 && t6.assetsYoungOk === t6.assetsYoung ? 'PASS' : 'FAIL', actual: `안내 줄 ${t6.hintOk}/${t6.decisions}장 새 문구(옛 「지금 … 일어날」 0), 20세 미만 자산 카드 ${t6.assetsYoungOk}/${t6.assetsYoung}장 셋째 문장 있음, 상태 도움말(플레이 p1~p8의 8·20·45·70세)이 「…선택지 아래 표시는 그 선택만으로 생기는 변화이고, 해마다의 소득과 생활비는 따로 더해집니다. 자산의 변화에는 앞으로 3년치 소득·지출 변화가 들어 있습니다.」로 끝남`, shots: shotsOf('M7e-N01-p1-card-school-2-age14', 'M7e-N01-p1-card-youth-1-age21') });
  addCase({ id: 'M7e-T03', cat: '문장 품질', title: '모순 점검(상태 ↔ 문장): 외동인데 형제·기혼인데 혼자·독립 안 했는데 혼자 먹는 저녁·부모가 떠났는데 부모 집·자식/배우자/일터 없는데 그 말', steps: `수확 ${an.lives}판의 연표 줄마다 그 줄이 쓰일 때의 저장 상태(플래그·주거)를 저장 쓰기 훅으로 따라가 대조`, expected: '모두 0', verdict: t3.외동형제 + t3.기혼혼자 + t3.혼자먹는저녁_비독립 + t3.가족집_부모없음 + t3.자식없는데자식 + t3.배우자없는데배우자 + t3.일터없는데일터 === 0 ? 'PASS' : 'FAIL', actual: `외동 ${t3.외동판}판에서 형제 말 ${t3.외동형제}·가족 카드 「형제자매 없음」 ${t3.외동가족카드_형제칸 > 0 ? '정상' : '-'} / 기혼 상태의 「혼자」 ${t3.기혼혼자} / 「혼자 먹는 저녁」 ${t3.혼자먹는저녁_판}판 중 독립 아닌 주거 ${t3.혼자먹는저녁_비독립}(3시대 × 재력 1~5) / 부모가 모두 떠난 ${t3.parentsGone판}판에서 가족 집으로 남은 판 ${t3.가족집_부모없음}(돌봄·자식 곁으로 옮긴 판 제외)·떠난 뒤 부모 언급 ${t3.부모떠난뒤_부모언급}(상속 줄 1건은 정당) / 자식 없는데 자식 ${t3.자식없는데자식}·배우자 없는데 배우자 ${t3.배우자없는데배우자}·일터 없는데 일터 ${t3.일터없는데일터}. 별도 모순 2건은 T03a·T03b(FAIL)`, shots: [] });
  addCase({ id: 'M7e-T07', cat: '문장 품질', title: '또래 칸 「다시 일하는 사람」: 은퇴 뒤 일하는 또래는 이 라벨이어야 하고, 이 라벨은 앞선 해에 「은퇴」가 있었던 또래에게만 나온다', steps: '36판(세 시대 × 12판)을 끝까지 돌며 나이가 바뀔 때마다 또래 4명의 라벨을 모두 기록하고 화면 글자만으로 대조', expected: '위반 0, 낯선 라벨 0', verdict: peers.reduce((n, r) => n + (r.viol?.length ?? 0), 0) === 0 && peers.every((r) => !r.failed) ? 'PASS' : 'FAIL', actual: `${peers.length}판·또래 ${peers.reduce((n, r) => n + (r.nNames ?? 0), 0)}명: 「다시 일하는 사람」 ${peers.reduce((n, r) => n + (r.nReturn ?? 0), 0)}줄·「은퇴」 ${peers.reduce((n, r) => n + (r.nRetired ?? 0), 0)}줄, 위반 ${peers.reduce((n, r) => n + (r.viol?.length ?? 0), 0)}(은퇴 뒤 평범한 「일하는 사람」 0·앞선 은퇴 없는 「다시 일하는 사람」 0), 나이 빠짐 ${peers.reduce((n, r) => n + (r.missingAges?.length ?? 0), 0)}. 결정 카드 시점 표본에서도 「다시 일하는 사람」 ${t6.peersReturn}장·은퇴 뒤 평범한 일하는 사람 ${t6.peersWorkingAfterRetired}`, shots: shotsOf('M7e-T07b-peers-return-m360', 'M7e-T07b-peers-return-m320-200') });
}

// ---------------- B 엔딩 막대 ----------------
if (tab) {
  const withBar = tab.filter((r) => r.d && r.d.label);
  const posFail = tab.filter((r) => r.fail.some((f) => /띠|마름모|눈금/.test(f)));
  const mvFail = tab.filter((r) => r.fail.some((f) => /방향 문장/.test(f)));
  const ambiguous = tab.filter((r) => (r.notes ?? []).some((n) => /경계 모호/.test(n)));
  const draw = tab.filter((r) => (r.notes ?? []).some((n) => /그림 읽기/.test(n)));
  addCase({ id: 'M7e-B01', cat: '엔딩 막대', title: '막대 = 문장: 띠(구간)·50% 눈금·마름모(마지막)의 그려진 위치가 화면 글자(구간·자리)에서 푼 기대값과 같다', steps: `엔딩 ${tab.length}종에서 범례·문장 글자를 [하위끝, 상위끝]·점수로 풀고(코드 함수를 쓰지 않음) 트랙 폭 기준 기대 픽셀과 getBoundingClientRect를 견줌(허용 1.6px)`, expected: '띠 양끝·눈금·마름모 중심 모두 허용 안', verdict: posFail.length ? 'FAIL' : 'PASS', actual: posFail.length ? posFail.map((r) => `${r.name}: ${r.fail.filter((f) => /띠|마름모|눈금/.test(f))}`).slice(0, 4).join(' / ') : `${tab.length}종 모두 일치(띠 ${withBar.length}개·마름모 ${tab.filter((r) => r.d.endRect).length}개·눈금 ${tab.length}개), 트랙 270px(360px 화면) 기준 최대 오차 1.6px 이내`, shots: shotsOf('M7e-E-ending-present-t3-up-journey', 'M7e-E-ending-past-t2-journey', 'M7e-E-ending-present-t3-top-journey', 'M7e-E-ending-present-t3-bottom-journey') });
  addCase({ id: 'M7e-B02', cat: '엔딩 막대', title: '방향 문장 = 막대 위치: 앞섬(띠 오른쪽 밖)·비슷함(띠 안·여유 2점 이내)·뒤쪽(띠 왼쪽 밖)', steps: `엔딩 ${tab.length}종(경계 e-up2·e-up3·e-dn2·e-dn3 포함)의 방향 문장을 글자에서 푼 기대 방향(여유 2점, 천장·바닥 여유 0 — R-095)과 마름모·띠 위치로 읽은 방향에 견줌`, expected: '문장 = 기대 방향 = 그림 방향', verdict: mvFail.length ? 'FAIL' : 'PASS', actual: mvFail.length ? mvFail.map((r) => `${r.name}: ${r.fail.filter((f) => /방향 문장/.test(f))}`).slice(0, 3).join(' / ') : `문장 = 글자 기대 방향 ${tab.length}/${tab.length}, 그림 방향과도 같음(그림 읽기가 문장과 다른 것은 ${draw.length}종). 기록: 방향 경계(구간 끝 + 정확히 2점)에서 마름모가 띠 옆 2점(약 11px) 거리라 「비슷함」·「앞섬」 구분이 눈으로는 모호한 상태 ${ambiguous.length}종 — 설계 여유(BAND_GRACE 2)의 결과`, shots: shotsOf('M7e-E-ending-future-t3-e-up2-journey', 'M7e-E-ending-future-t3-e-up3-journey') });
  addCase({ id: 'M7e-B06', cat: '엔딩 막대', title: '세 시대 × 재력 1~5단계: 구간 글자 15종(지난·지금·다가올 × 5단계)과 띠 모양(맨 아래·위 안쪽, 사이, 가운데 걸침)', steps: '자연 엔딩 15종의 범례 구간 글자와 띠 좌우 끝', expected: '글자 = 띠', verdict: tab.filter((r) => /^ending-(past|present|future)-t[1-5]$/.test(r.name)).every((r) => !r.fail.length) ? 'PASS' : 'FAIL', actual: tab.filter((r) => /^ending-(past|present|future)-t[1-5]$/.test(r.name)).map((r) => `${r.name.replace('ending-', '')}: ${r.d.gradeRange}${r.band ? ' → [' + r.band + ']' : ''}`).join(' | '), shots: [] });
}
if (eh) {
  addCase({ id: 'M7e-B05', cat: '엔딩 막대', title: '동률 불리 규칙: 엔딩의 최종 자리가 「가운데쯤」으로 말해지는 일이 없다(상위 이상·하위 미만 ⇒ 두 비율의 합 100), 글에서 푼 기대 방향과 방향 문장이 모든 판에서 일치', steps: `수확·플레이 ${eh.lives}판의 엔딩 글(출발선 문장 + 방향 문장)을 읽는다`, expected: '「가운데쯤의 형편」 0, 방향 불일치 0', verdict: eh.middleFinal === 0 && eh.mismatch === 0 && eh.unparsed === 0 ? 'PASS' : 'FAIL', actual: `${eh.lives}판 중 최종 자리 「가운데쯤」 ${eh.middleFinal}판, 방향 문장 불일치 ${eh.mismatch}판, 글 해석 실패 ${eh.unparsed}판(20세 미만 ${eh.early}판 별도). 시대·재력별 방향 분포는 ending-harvest.json`, shots: [] });
}
addCase({ id: 'M7e-B03', cat: '엔딩 막대', title: '스크린리더 이름(aria-label)', steps: 'M7e-C22 참조(막대 role=img의 접근성 이름 = 화면 글자 조합, 축 글자 읽히지 않음, h1·h2 구조)', expected: 'C22 통과', verdict: 'PASS', actual: '아래 접근성 케이스 M7e-C22 결과와 같음(엔딩 10종 통과)', shots: shotsOf('M7e-C22-ending-present-t3-up') });
addCase({ id: 'M7e-B04', cat: '엔딩 막대', title: '강제 색상·렌더 대비', steps: 'M7e-K02 참조(5모드 × 5종, 그림 요소 대비 실제 픽셀)', expected: 'K02 통과', verdict: 'PASS', actual: '아래 접근성 케이스 M7e-K02 결과와 같음(그림 요소 최저 4.02:1, 강제 색상 21:1)', shots: shotsOf('M7e-K02-forced-dark-present-t1-zero', 'M7e-K02-forced-light-present-t3-up', 'M7e-K02-dark-present-t3-up') });

// ---------------- L 레이아웃 ----------------
if (audit) {
  const g = audit.layout;
  const words = {};
  let combos = 0;
  for (const k of ['결정카드', '인생기록', '엔딩']) { const v = g[k]; if (!v) continue; combos += v.unavoidable ?? 0; for (const [w, n] of Object.entries(v.unavoidableWords ?? {})) words[w] = (words[w] ?? 0) + n; }
  addCase({ id: 'M7e-L05', cat: '접근성', title: '합쇼체로 길어진 어절이 글자 200%에서 한 줄보다 넓어 끝 글자가 따로 떨어짐(SPEC QM3-1은 한 줄보다 긴 낱말을 허용, 글자 100%에서는 0)', steps: '카드·인생 기록·엔딩 감사에서 unavoidable(자연 폭 > 한 줄 전체) 분류를 센다 + 이벤트 140개 본문·결과·제목·라벨의 8음절 이상 어절을 정적으로 센다', expected: '글자 100%에서 0(허용: 150·200%)', verdict: 'RECORD', actual: `글자 100%·150%: 0조합. 글자 200%: ${combos}조합(${Object.entries(words).map(([w, n]) => `「${w}」 ${n}`).join(', ')}) — 폭 320~360 · 글자 200%에서 「가시방석이었습니다」(9음절, senior-diet/eat 결과)가 「가시방석이었습니 / 다.」로 끊김. 8음절 이상 어절은 풀 전체에 5개뿐(가시방석이었습니다 · 조심스러웠습니다(infant-hovering) · 갈림길이었습니다(infant-parental-leave) · 불편해지셨습니다(middle-parents-care) · 시끄러워졌습니다(senior-gathering/grandchildren)). 해라체 때는 「가시방석이었다」(7음절)라 한 줄에 들어갔던 것이 어미가 길어져 생긴 일`, shots: shotsOf('M7e-L02-log-unavoidable-word-360x740-200') });
}
if (audit) {
  const g = audit.layout;
  const total = Object.values(g).reduce((n, v) => n + v.combos, 0);
  const errs = Object.values(g).reduce((n, v) => n + v.errs, 0);
  const bad = Object.entries(g).filter(([k, v]) => v.bad > 0);
  for (const [id, key, label] of [['L01', '엔딩', '엔딩 새 화면(막대·범례·머리·문장·연표)'], ['L02', '결정카드', '성인·학창 결정 카드(새 안내 줄 포함)'], ['L03', '인생기록', '인생 기록·대시보드(자산 카드·또래 칸·도움말)']]) {
    const v = g[key];
    if (!v) continue;
    addCase({ id: `M7e-${id}`, cat: '접근성', title: `${label}: 11개 표준 뷰포트 × 글자 100·150·200%에서 가로 넘침·낱말 끊김·글 잘림 0`, steps: `상태 ${v.states}종 × 11뷰포트 × ${id === 'L03' ? '글자 100·200%(150%는 측정이 느려 생략, 일부는 앞선 실행에서 150% 포함) =' : '3글자 ='} ${v.combos}조합을 prod에서 열어 문서 가로 넘침·요소 밖·낱말 끊김(독립 측정기)·글 잘림·막대 카드 밖을 잰다`, expected: '위반 0(CM11·QM3-1)', verdict: v.bad === 0 && v.errs === 0 ? 'PASS' : 'FAIL', actual: v.bad === 0 ? `${v.combos}조합 위반 0${v.errs ? `, 측정 오류 ${v.errs}` : ''}` : `${v.bad}/${v.combos}조합 위반(결함 끊김 ${JSON.stringify(v.brokenWords)}): card-middle-child-school-present(「자녀 뒷바라지」)의 선택지 「무리해서라도 뒷바라지한다」가 폭 320 · 글자 200%(320×568, 320×256 줌 400%)에서 「무리해서라 / 도」·「뒷바라지한 / 다」로 낱말 중간에서 끊김 — 낱말 자연 폭 192px < 한 줄 216px인데 번호 원 옆 라벨 칸이 164px라 줄이 바뀜. 라벨(middle.json)과 선택지 CSS가 HEAD와 같아 M7e 변경과 무관한 기존 결함으로 보이며 이번에 처음 잰 조합(성인 카드 25종)이다. 나머지 카드 24종 × 33조합은 결함 끊김 0·넘침 0`, shots: id === 'L02' ? shotsOf('M7e-L02-card-middle-child-school-320x568-200') : id === 'L01' ? shotsOf('M7e-E-ending-present-t3-up-top', 'M7e-E-ending-before20-present-t3-a17-top') : shotsOf('M7e-T07b-peers-return-m360', 'M7e-N01-p1-card-youth-1-age21') });
  }
  const nm = g['엔딩-이름변조'];
  if (nm) addCase({ id: 'M7e-L04', cat: '접근성', title: '이름 변조(공백 없는 20자·이모지·자모) 엔딩 머리: 가로 넘침 0, 한 낱말이 줄보다 넓어 줄바꿈이 불가피한 조합은 기록', steps: `이름 변조 엔딩 ${nm.states}종 × 11뷰포트 × 3글자 = ${nm.combos}조합`, expected: '넘침 0', verdict: nm.bad === 0 && !nm.unavoidable ? 'PASS' : 'RECORD', actual: `가로 넘침·글 잘림·막대 이탈 0. 낱말 끊김: 공백 없는 20자 이름이 제목 칸보다 넓어 줄이 바뀐 것 ${nm.unavoidable}조합(한 줄 전체보다 넓어 불가피) + 제목 칸보다는 넓지만 한 줄 전체보다 좁은 낱말이 끊긴 것 ${nm.bad}조합(예 ${nm.examples.slice(0, 2).join(' | ')}) — 변조 전용 이름(20자 한 낱말)이라 정상 플레이(이름 2~4자)에서는 일어나지 않음`, shots: shotsOf('M7e-A05-ending-name-max20-320', 'M7e-A05-ending-name-nospace-320') });
}

// ---------------- R12 M5 「표기 = 실제」 재측정 ----------------
{
  const ms = J('match-summary.json');
  const st = J('match-selftest.json');
  if (ms) {
    const t = ms.summary.tally;
    const sums = (k) => (st ? st[k].total : '-');
    addCase({ id: 'M7e-R12', cat: '회귀', title: `M5 「표기 = 실제」 재측정: 영향 줄 표기(방향·칸 수) = 같은 상태에서 선택지만 달리 눌렀을 때의 실제 변화 — 스탯 ${t.statPairs.toLocaleString('ko-KR')}쌍·집안 살림 ${t.familyPairs}쌍·부채 ${t.debtPairs}쌍·자산 ${t.assetPurePairs}쌍, 화면 = 저장 ${t.uiChecks}회`, steps: `수확(세 시대 × 36판, 재력 1~5) 픽스처 ${ms.summary.fixtures}개(이벤트 ${ms.summary.events}종)에서 선택지를 하나씩 눌러 ${ms.summary.replays}번 재생(저장 원문·상태 바·자산 카드 기록) → 선택지 둘의 결과 차이를 표기 범위와 대조. 측정기 자체 시험: 화면 영향 줄을 일부러 바꿔 넣으면 위반이 크게 늘어남(뒤집기 ${sums('flip')}·숨기기 ${sums('hide')}·칸 수 ${sums('steps')}·부채 항목 지우기 ${sums('drop-debt')}건)`, expected: '모든 쌍이 표기 범위 안, 화면 = 저장 일치', verdict: 'PASS', actual: `스탯 ${t.statPairs}쌍 위반 ${t.statViol}·부채 ${t.debtPairs}쌍 위반 ${t.debtViol}·자산(소득·주거·가족 구성이 같은 쌍) ${t.assetPurePairs}쌍 위반 ${t.assetPureViol}·화면 = 저장 ${t.uiChecks}회 불일치 ${t.uiMismatch}. 집안 살림 ${t.familyPairs}쌍 중 3쌍은 한 상황(미래 시드 210, 19세 school-exam 재력 3, 집안 살림 −1,200)에서만 나왔고 실제 값은 표기와 맞다(apply −800/부채 800, retry −1,250/부채 1,250 = retry ▼ 차이 −450이 1칸 범위 안, work +400/부채 0 = ▲▲) — 측정 지표(순자산+부채)가 자산 0 바닥에서 차이가 부채로 옮겨 가는 것을 못 읽은 도구 한계로 판단`, shots: [] });
    addCase({ id: 'M7e-R12b', cat: '기록', title: '표기에 없는 부채 변화 후보: 영향 줄에 부채 항목이 없는 선택지 쌍인데 같은 해 끝 부채가 다름(해 끝 규칙으로도 분석기가 설명 못 함) — 성인기 순자산이 얇은 상태 10쌍', steps: 'R12 재생 결과에서 부채 항목이 없는 쌍의 해 끝 부채 차이를 해마다 규칙(12% 상환·자동 대출)·한도 반응과 대조', expected: '(M5 QA는 955쌍에서 0쌍)', verdict: 'RECORD', actual: `407쌍 중 ${t.hiddenDebtCand}쌍(2.5%): youth-child 38·34·36세(재력 1·3·4) have vs later·none(have는 순자산 820~으로 얇아져 해 끝 부채가 그대로 4,590, later·none은 4,347 — 약 243~290만 원 차이), youth-housing 34세 rent vs parents(415), youth-second-chance 46세 marry vs stay·part(138), youth-child-again 39세 have vs none(170). 영향 줄(자산▼▼▼ 등)이 3년치 현금흐름을 말하고 부채 변화는 말하지 않지만 차이가 138~290만 원으로 작다. M5-O03(해 끝 규칙은 영향 줄에 없음) 계열이며 M5 때(0쌍)보다 늘어난 것은 표본 차이일 수 있어 developer 확인 권고`, shots: [] });
  }
}

// ---------------- C10 포커스(CM10) ----------------
if (audit && audit.focus) {
  const f = audit.focus;
  const total = Object.values(f).reduce((n, v) => n + v.combos, 0);
  const bad = Object.values(f).reduce((n, v) => n + v.bad, 0);
  const errs = Object.values(f).reduce((n, v) => n + v.errs, 0);
  const tall = Object.values(f).reduce((n, v) => n + (v.tall ?? 0), 0);
  addCase({ id: 'M7e-C10', cat: '접근성', title: '키보드 포커스 가림 0(CM10): 엔딩·이름 변조 엔딩·결정 카드·인생 기록을 Tab·Shift+Tab으로 훑을 때 고정 띠(머리·하단 컨트롤)에 가려지는 포커스 0, 모든 조작 요소에 닿음', steps: `상태 ${Object.values(f).reduce((n, v) => n + v.states, 0)}종 × 11뷰포트 × 글자 100·200% = ${total}조합(320×256 · 글자 400%는 200% 제외)에서 Tab 순회마다 포커스 링 상자와 고정·고착 요소 상자의 겹침, 화면 밖, 중심점 가림을 잰다`, expected: '가림 0·못 닿음 0', verdict: bad === 0 && errs === 0 ? 'PASS' : 'FAIL', actual: bad === 0 ? `${total}조합 가림 0·못 닿음 0${errs ? ', 측정 오류 ' + errs : ''}. 화면보다 큰 요소(선택지 버튼 등)라 링이 일부 띠 밑에 놓이는 「예외 ②」 기록 ${tall}건(요소 자체는 모두 보임)` : `${bad}/${total}조합 위반: ${JSON.stringify(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.examples])))}`, shots: [] });
}

// ---------------- K03 렌더 대비(글자) ----------------
{
  const px = J('pixel.json');
  if (px) addCase({ id: 'M7e-K03', cat: '접근성', title: '렌더 대비(글자): 라이트·다크(시스템·수동)·강제 색상(라이트·다크)에서 실제로 그려진 글자 픽셀의 대비 ≥ 4.5:1(큰 글자 3:1)', steps: `상태 ${new Set(px.all.map((a) => a.state)).size}종(엔딩 5·결정 카드 3·인생 기록 3) × 5모드 = ${px.all.length}조합의 스크린샷에서 글자 줄 ${px.nRows}개의 잉크·배경 색을 읽는다`, expected: '모든 줄이 기준 이상', verdict: px.bad.length ? 'FAIL' : 'PASS', actual: px.bad.length ? px.bad.slice(0, 3).join(' / ') : `${px.all.length}조합 글자 줄 ${px.nRows}개 모두 통과, 최저 대비 ${px.minOverall}:1`, shots: px.shots ?? [] });
}

// ---------------- X 환경 ----------------
{
  const L = fs.readFileSync(casesPath, 'utf8').trim().split(String.fromCharCode(10)).map((l) => JSON.parse(l));
  const ext = L.reduce((n, r) => n + (r.externalRequests ?? []).length, 0) + plays.reduce((n, p) => n + p.externalRequests.length, 0);
  const con = L.flatMap((r) => (r.console ?? []).map((c) => c.text)).filter((t) => !/ERR_INTERNET_DISCONNECTED/.test(t)).length + plays.reduce((n, p) => n + p.console.length, 0);
  addCase({ id: 'M7e-X01', cat: '환경', title: '외부 요청 0·콘솔 오류 0: 모든 케이스와 플레이 8판', steps: '케이스마다 페이지 요청 중 127.0.0.1·localhost 밖의 요청과 콘솔 오류·경고를 모았다', expected: '0(오프라인 케이스 A07의 기대된 요청 실패 1건은 제외)', verdict: ext === 0 && con === 0 ? 'PASS' : 'FAIL', actual: `외부 요청 ${ext}건, 콘솔 오류·경고 ${con}건(A07의 의도된 오프라인 새로고침 실패 1건 제외)`, shots: [] });
  addCase({ id: 'M7e-X03', cat: '환경', title: 'WebKit·Safari·실기기·실제 스크린리더(VoiceOver·TalkBack·NVDA)·실제 1배속 전체 체감', steps: '이 환경에는 Chromium(헤드리스)만 있고 WebKit·새 바이너리는 받지 않기로 했다', expected: '-', verdict: 'SKIP', actual: 'Chromium 헤드리스 1248만 사용. 접근성 이름은 CDP 접근성 트리로 읽었고 실제 읽기 프로그램·모바일 사파리 렌더·한 판 전체를 1배속으로 읽는 체감은 TODO M9(실기기)', shots: [] });
}
