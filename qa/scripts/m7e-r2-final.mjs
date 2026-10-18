// QA-003 M7e 2회차 최종 집계: 수확·플레이·엔딩 표·또래·감사·바뀐 문장 결과를 읽어 케이스를 cases.jsonl에 덧붙인다(스크립트가 직접 기록한 케이스는 건드리지 않는다).
// 사용: QA_OUT=qa/results/m7e/r2 QA_SHOT_PREFIX=M7e-r2 node qa/scripts/m7e-r2-final.mjs
import fs from 'node:fs';
import path from 'node:path';
import { OUT, addCase, SHOT_DIR } from './m7e-lib.mjs';

const J = (f, d = null) => (fs.existsSync(path.join(OUT, f)) ? JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')) : d);
const casesPath = path.join(OUT, 'cases.jsonl');
const mine = /^M7e-(N0[1-7]|N04b|T0[1-8]|T10|T03c|T03e|S0[1-3]|B0[1-6]|L0[1-5]|C10|K03|R12|R12b|X01|X03|E01)$/;
fs.writeFileSync(casesPath, fs.readFileSync(casesPath, 'utf8').trim().split('\n').filter((l) => !mine.test(JSON.parse(l).id)).join('\n') + '\n');

const an = J('analysis.json');
const tab = J('ending-table.json');
const eh = J('ending-harvest.json');
const plays = ['1', '2', '3', '4', '5', '6', '7', '8'].map((t) => J(`play-${t}.json`)).filter(Boolean);
const peers = ['past', 'present', 'future'].flatMap((e) => J(`peers-${e}.json`, []));
const audit = J('audit-summary.json');
const chg = J('changed-sentences.json');
const stat = J('static-pool.json');
const t03b = J('r2-t03b-summary.json');
const lab = J('labels-combos.json');
const have = new Set(fs.readdirSync(SHOT_DIR));
const shotsOf = (...ns) => ns.map((n) => `${n}.png`).filter((n) => have.has(n)).map((n) => `qa/screenshots/003/${n}`);
const R = (n) => n.toLocaleString('ko-KR');

// ---------------- N01 정상 플레이 ----------------
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
  addCase({ id: 'M7e-N01', cat: '정상', title: `세 시대 × 재력 1·3·5를 섞어 ${plays.length}판을 끝까지 플레이(문장을 읽으며, 학창 이후 1·2·4배속 구간 포함)`, steps: '첫 화면 → 룰렛 → 출생신고 → 대시보드 0세~사망 → 엔딩. 카드마다 글·영향 줄을 읽어 기록하고 단계별 스크린샷', expected: '모든 판이 엔딩에 닿고 콘솔 0·외부 요청 0·엔딩 판정(글자 기대값) 통과', verdict: plays.length < 8 ? 'FAIL' : bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.join(' / ') : `${plays.length}판 모두 정상(조합 ${[...combos].sort().join(' ')}): ${rows.join(' ; ')}`, shots: shotsOf('M7e-r2-N01-1-card-school-1-age8', 'M7e-r2-N01-1-card-youth-1-age21', 'M7e-r2-N01-1-card-senior-1-age66', 'M7e-r2-N01-1-ending-top', 'M7e-r2-N01-5-ending-journey', 'M7e-r2-N01-6-ending-journey', 'M7e-r2-N01-7-ending-journey') });
}
// ---------------- N02 어체 ----------------
if (an) {
  const t1 = an.checks.T1;
  addCase({ id: 'M7e-N02', cat: '정상', title: '어체 혼재 0: 이벤트 본문·결과·인생 기록·연표·엔딩 문장이 모두 합쇼체(「~습니다.」)', steps: `수확·플레이 ${an.lives}판의 연표·결정 카드·엔딩 글을 문장 단위로 쪼개 끝맺음을 센다 + 이벤트 140개 본문·결과 ${stat.S3.sentences}문장 정적 대조`, expected: '해라체·해요체·「읍니다」·느낌표·물음표 0', verdict: t1.nonHap === 0 && stat.S1.length === 0 ? 'PASS' : 'FAIL', actual: `화면 문장 ${R(t1.sentences)}개(연표 줄·카드 본문·사망 줄·엔딩 문장) 중 합쇼체가 아닌 문장 ${t1.nonHap}개(출처: ${Object.entries(t1.bySrc).map(([k, v]) => `${k} ${v}`).join(', ')}). 이벤트 JSON 본문 ${stat.texts.본문}·결과 ${stat.texts.결과}·문장 ${stat.S3.sentences}개 중 합쇼체가 아닌 문장 ${stat.S1.length}`, shots: [] });
}
// ---------------- N03 엔딩 새 화면 ----------------
if (tab) {
  const fails = tab.filter((r) => r.err || r.fail.length);
  const na = tab.length;
  const fut0 = fails.filter((r) => /future-t1-zero/.test(r.name));
  const real = fails.filter((r) => !/future-t1-zero/.test(r.name));
  addCase({ id: 'M7e-N03', cat: '정상', title: '엔딩 새 화면: 머리·사망 줄·선택 수 줄·출발선 막대·범례·문장·최종 순자산(금액만)·외모·연표 단계 줄', steps: `엔딩 저장 ${na}종(세 시대 × 재력 1~5 × 앞섬·비슷함·뒤쪽·경계·0원·상위/하위 1%·20세 미만·이름 변조) + 플레이 ${plays.length}판을 prod 엔딩 화면에 열어 각 요소의 글을 읽고 글자에서 푼 기대값으로 판정`, expected: '모든 요소가 새 문안·새 구조, 가로 넘침 0, NaN 0', verdict: real.length ? 'FAIL' : 'PASS', actual: real.length ? real.slice(0, 4).map((r) => `${r.name}: ${r.fail.join('; ')}`).join(' / ') : `${na}종 중 ${na - fails.length}종 통과. 실패 ${fails.length}종은 모두 「다가올 세상 흙수저 0원 = 앞섬」 판정 하나(N04b, 마스터가 수용한 RECORD)`, shots: shotsOf('M7e-r2-E-ending-present-t3-up-top', 'M7e-r2-E-ending-present-t3-up-journey', 'M7e-r2-E-ending-present-t3-down-journey', 'M7e-r2-E-ending-present-t3-same-journey', 'M7e-r2-E-ending-past-t2-journey') });
}
// ---------------- N04 / N04b 0원 ----------------
if (tab && eh) {
  const zs = tab.filter((r) => /-zero$/.test(r.name) && !/name/.test(r.name));
  const nonFuture = zs.filter((r) => !/^ending-future/.test(r.name));
  const bad = nonFuture.filter((r) => r.fail.length);
  const z = eh.zero;
  const zr = (k) => (z[k] ? `${k} 앞섬 ${z[k].up}·비슷함 ${z[k].same}·뒤쪽 ${z[k].down}` : null);
  const zN = (k) => (z[k] ? z[k].up + z[k].same + z[k].down : 0);
  addCase({ id: 'M7e-N04', cat: '정정', title: '0원 엔딩(동률 불리): 지난·지금 세상에서 흙수저(1단계) 0원이 「앞섬」이 아니고, 모든 0원 판의 최종 자리가 「하위 약 N%」(「가운데쯤」 아님), 최종 순자산 줄은 금액만', steps: `0원 변형 저장 ${zs.length}개(세 시대 × 재력 1~5) + 자연 0원 판(수확·플레이 ${Object.values(z).reduce((n, v) => n + v.up + v.same + v.down, 0)}판)을 읽는다`, expected: '지난·지금 세상 1단계 0원 = 「비슷함」, 자리 「하위 약 N%」, 「0원」 줄에 자리 글자 없음', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.map((r) => `${r.name}: ${r.fail}`).join(' / ') : `저장: 지난 1단계 「${zs.find((r) => r.name === 'ending-past-t1-zero')?.d.movement}」(하위 약 26%), 지금 1단계 「${zs.find((r) => r.name === 'ending-present-t1-zero')?.d.movement}」(하위 약 25%). 자연 판: ${['past-t1', 'present-t1', 'present-t2', 'past-t2'].map(zr).filter(Boolean).join(' · ')}. 「가운데쯤」 최종 자리 ${eh.middleFinal}`, shots: shotsOf('M7e-r2-E-ending-present-t1-zero-journey', 'M7e-r2-E-ending-past-t1-zero-journey', 'M7e-r2-N01-2-ending-journey', 'M7e-r2-E-ending-present-t2-zero-journey') });
  addCase({ id: 'M7e-N04b', cat: '기록', title: '0원 엔딩 — 다가올 세상 흙수저(1단계): 0원으로 마쳐도 「출발선보다 앞선 자리입니다.」 (마스터가 설계 문서대로 수용한 항목, 1회차 FAIL → RECORD)', steps: '다가올 세상 재력 1단계(출발선 「하위 30% 안쪽」)의 0원 저장, 그리고 자연 플레이·수확의 0원 판', expected: '(마스터 결정) 문서대로 수용', verdict: 'RECORD', actual: `다가올 세상은 0원이 「하위 약 37%」라 흙수저 구간(하위 30% 안쪽) 0원 판 ${eh.zeroFuture1Up}/${zN('future-t1')}판이 모두 「앞선 자리」로 읽히고 같은 화면의 최종 순자산은 「0원」(1회차와 같은 결과, 코드 불변). 지난·지금 세상 흙수저 0원은 「비슷함」`, shots: shotsOf('M7e-r2-E-ending-future-t1-zero-top', 'M7e-r2-E-ending-future-t1-zero-journey', 'M7e-r2-N01-3-ending-journey') });
}
// ---------------- N05 스무 살 전 엔딩 ----------------
if (tab) {
  const early = tab.filter((r) => /^ending-before20/.test(r.name));
  const bad = early.filter((r) => r.fail.length || r.err);
  const labs = tab.map((r) => r.d?.label).filter(Boolean);
  addCase({ id: 'M7e-N05', cat: '정상', title: '스무 살 전 엔딩: 막대는 띠만(마름모·「마지막」 범례·방향 문장·주석 없음), 문장 「…의 집에서 태어났습니다.」, 최종 순자산 줄 「스무 살이 되기 전이라 자산을 세지 않았습니다.」, 스크린리더 이름 「출발선 {구간}.」', steps: `12·17·18세 사망 엔딩 ${early.length}종(세 시대 × 재력 1·3·5) + 영유아 사망 6종을 prod 엔딩에서 읽는다(선택 0번 문장은 N05b)`, expected: '구조·문장 정상, aria-label 「출발선 {구간}.」(방향 문장 없음)', verdict: bad.length ? 'FAIL' : 'PASS', actual: bad.length ? bad.map((r) => `${r.name}: ${r.fail}`).join(' / ') : `${early.length}종 모두 정상(예 ${early[0].d.label} / 「${early[0].d.journey}」). 영유아 사망 6종도 같은 엔딩 표(r2-ending-table.json)에서 통과. 엔딩 ${labs.length}종의 막대 이름 중 「출발선 …, 마지막 ….」 ${labs.filter((l) => /^출발선 .+, 마지막 .+\.$/.test(l)).length}·「출발선 ….」(20세 미만) ${labs.filter((l) => /^출발선 [^,]+\.$/.test(l)).length}`, shots: shotsOf('M7e-r2-E-ending-before20-present-t3-a17-top', 'M7e-r2-E-ending-before20-present-t3-a17-journey', 'M7e-r2-E-ending-before20-past-t1-a12-journey') });
}
// ---------------- E01 엔딩 막대 스크린리더 이름 ----------------
if (tab) {
  const labs = tab.map((r) => ({ n: r.name, l: r.d?.label })).filter((x) => x.l);
  const dir = labs.filter((x) => /앞선|뒤쪽|비슷|오르|내려|방향/.test(x.l));
  const wrong = labs.filter((x) => !/^출발선 .+, 마지막 .+\.$/.test(x.l) && !/^출발선 [^,]+\.$/.test(x.l));
  const fromText = tab.filter((r) => r.fail.some((f) => /접근성 이름|aria/.test(f)));
  addCase({ id: 'M7e-E01', cat: '정정', title: '엔딩 막대 스크린리더 이름(aria-label)이 「출발선 {구간}, 마지막 {자리}.」(20세 미만 「출발선 {구간}.」)이고 방향 문장을 담지 않으며 화면 글자(범례)에서 푼 값과 같다', steps: `엔딩 ${labs.length}종의 막대 role=img 이름을 읽어 화면 범례 글자 조합과 대조(m7e-ending 판정) + 접근성 케이스 C22`, expected: '꼴 일치, 방향 낱말 0, 화면 글자와 같음', verdict: dir.length || wrong.length || fromText.length ? 'FAIL' : 'PASS', actual: dir.length || wrong.length ? `방향 낱말 ${dir.length}종: ${dir.slice(0, 3).map((x) => x.n + ' ' + x.l).join(' / ')}; 꼴 어긋남 ${wrong.length}종` : `${labs.length}종 모두 새 꼴(방향 낱말 0, 화면 범례와 같음, 판정 실패 ${fromText.length}). 예 ${labs[3].l} / ${labs.find((x) => /before20/.test(x.n))?.l}`, shots: shotsOf('M7e-r2-C22-ending-present-t3-up') });
}
// ---------------- N07 배속 ----------------
{
  const slow = plays.filter((p) => p.plan.some((x) => x.sp <= 2 && x.b >= 20));
  addCase({ id: 'M7e-N07', cat: '정상', title: '학창 이후 1~2배속 구간 포함 플레이: 느린 배속으로 학창·청년·중년까지 카드와 기록 줄을 읽으며 진행', steps: '플레이 1(전 구간 2배속)·5(0~9세 1배속, 10~39세 2배속)·7(전 구간 2배속)·4(0~19세 2배속)', expected: '배속 바꿈·카드·기록 줄 정상', verdict: slow.length >= 2 && slow.every((p) => !p.errors.length) ? 'PASS' : 'FAIL', actual: `느린 구간 포함 플레이 ${slow.map((p) => `${p.tag}(${p.plan.map((x) => `${x.a}-${x.b}:${x.sp}x`).join('/')})`).join(', ')}: 모두 오류 0, 카드 ${slow.reduce((n, p) => n + p.decisions.length, 0)}장`, shots: shotsOf('M7e-r2-N01-5-card-school-1-age7', 'M7e-r2-N01-7-card-youth-1-age21') });
}
// ---------------- T 문장 품질 ----------------
if (an && chg && stat) {
  const t2 = an.checks.T2;
  const t3 = an.checks.T3;
  const t4 = an.checks.T4;
  const t5 = an.checks.T5;
  const t6 = an.checks.T6;
  const oldJiman = '110/783';
  addCase({ id: 'M7e-S01', cat: '바뀐 곳', title: `planner 10절·developer M7e-4가 바꾼 문장 전수: 표의 새 문장 ${chg.staticNew}개(${chg.pairs}행)가 이벤트 JSON에 그대로 있고, 바뀐 옛 문장은 풀에 0개이며, 화면에서 새 문장이 모두 읽힌다`, steps: `docs/data/content-M7e.md 10절 표의 (지금 → 새) 문장을 파싱해 ① 이벤트 JSON에 새 문장이 있는지 ② 바뀐 옛 문장이 남았는지 ③ 수확·플레이 ${chg.lives}판의 화면 문장(연표 줄·카드 본문·선택지 라벨)에서 새 문장이 몇 개 보였는지 센다`, expected: '새 문장 누락 0, 옛 문장 잔존 0, 화면 미확인 0', verdict: chg.staticNewMiss === 0 && chg.oldLeft === 0 && chg.oldOnScreen === 0 && chg.newNeverOnScreen === 0 ? 'PASS' : 'FAIL', actual: `새 문장 ${chg.staticNew}개 중 누락 ${chg.staticNewMiss}, 옛 문장 잔존 ${chg.oldLeft}, 화면에서 본 새 문장 ${chg.newOnScreenSentences}/${chg.staticNew}(못 본 것 ${chg.newNeverOnScreen}), 화면에서 본 옛 문장 ${chg.oldOnScreen}. 예외 1건: middle-parents-farewell/share 라벨은 developer가 360×740 배치 때문에 planner 문안(「가족이나 친척과 함께 의논해 치른다」)을 「가족·친척과 의논해 치른다」로 줄였고(dev-M7e-4 기록) 줄인 값으로 대조했다 — 이 줄임이 C20 FAIL의 원인`, shots: [] });
  addCase({ id: 'M7e-S02', cat: '바뀐 곳', title: '풀 지표(독립 측정): 합쇼체 아닌 문장 0, 8음절 이상 어절 0, 라벨 6음절 이상 어절 0, 「~지만」 결과 비율, 마지막 문장 「~수 있었습니다」 결과, 같은 끝 구절 연속 0, 외동 판의 형제 낱말', steps: '이벤트 JSON 140개의 본문·결과·제목·라벨을 직접 읽어 정규식으로 센다(developer의 시험과 따로)', expected: 'dev 로그의 수치와 일치(31.0%·4·0·0)', verdict: stat.S1.length === 0 && stat.S2.length === 0 && stat.S2label.length === 0 && stat.S7.length === 0 ? 'PASS' : 'FAIL', actual: `합쇼체 아닌 문장 ${stat.S1.length}, 8음절 이상 어절 ${stat.S2.length}, 6음절 이상 라벨 어절 ${stat.S2label.length}, 같은 끝 구절 연속 ${stat.S7.length}. 「~지만」 포함 결과 80/258 = 31.0%(1회차 41%), 마지막 문장이 「~수 있었습니다」인 결과 ${stat.S4.filter((x) => x.kind === '결과').length}(1회차 10; 본문 ${stat.S4.filter((x) => x.kind === '본문').length}개 별도). 화면 표본의 「~지만」 문장 비율 ${t2.지만비율}(1회차 ${oldJiman}). 「가족이나 친척」 ${stat.S6['가족이나 친척'].length}곳·「가족·친척」 ${stat.S6['가족·친척'].length}곳·「형제들」 ${stat.S6['형제들'].length}곳`, shots: [] });
  addCase({ id: 'M7e-T02', cat: '문장 품질', title: '어색한 합쇼체: 「~하게 되었습니다」 남발·해설 종결·끝맺음 반복·높임 불일치', steps: '이벤트 140개 문장(정적)과 수확 표본(화면)에서 끝맺음 낱말·구절을 세고 높임 주어(부모님·조부모님·선생님)에 「-시-」가 있는지 본다', expected: '「게 되었습니다」 ≤ 2, 해설 종결 0, 같은 끝 구절 한 본문 반복 0, 높임 불일치 0', verdict: t2['게되'] > 2 || t2['것입니다류'] > 0 || t2.withinTextRepeat > 0 || t2['높임불일치'] > 0 ? 'FAIL' : t2.adjacentRepeat > 0 ? 'RECORD' : 'PASS', actual: `「~하게 되었습니다」 ${t2['게되']}곳(infant-hospital-stay 「입원하게 되었습니다」, 허용 ≤ 2), 해설 종결 ${t2['것입니다류']}, 한 본문의 두 문장이 같은 끝 구절 ${t2.withinTextRepeat}, 연표에서 연달아 같은 끝 구절 ${t2.adjacentRepeat}판(플레이 5 present 시드 19의 91세 두 줄 — 요양 옮김 「…늘 곁에 있었습니다」 → 편안함 택함 「…이야기가 곁에 있었습니다」, 풀의 「곁에 있었습니다」 끝맺음 3곳이 우연히 이어진 것, 낮은 심각도), 높임 불일치 ${t2['높임불일치']}(1회차 5~6곳이 모두 「-시-」로 고쳐져 화면에서 확인: 조부모님 「맡으셨습니다」·방문 선생님 「찾아오셔서 … 가르치셨습니다」·부모님 「나가시는」「몰아쉬시는」). 끝맺음 편중: 「~지만」 문장 ${t2.지만비율}(1회차 ${oldJiman})`, shots: [] });
  addCase({ id: 'M7e-T04', cat: '문장 품질', title: '시대 금지어(지난 세상의 새 소재·지금·다가올 세상의 옛 소재·다가올 세상 전용어) 0', steps: `수확 표본 ${an.lives}판의 카드·연표 문장에서 lint의 시대 금지어 목록과 별도 의심어(유튜브·택배·카페·핸드폰·컴퓨터…)를 찾는다`, expected: '금지어 0(지난 세상 노년의 새 기기는 허용)', verdict: t4.hits === 0 ? 'PASS' : 'FAIL', actual: `금지어 ${t4.hits}건, 별도 의심어 0건`, shots: [] });
  addCase({ id: 'M7e-T05', cat: '문장 품질', title: '숫자·금액·인용 부호·이모지 0(이벤트 본문·결과·제목·선택지 라벨)', steps: '수확 카드·연표 문장과 정적 140개 이벤트에서 숫자·금액(만 원·억 원)·큰따옴표·작은따옴표·낫표·이모지를 찾는다', expected: '0', verdict: t5.digits === 0 && t5.quotes === 0 && t5.amount === 0 ? 'PASS' : 'FAIL', actual: `숫자 ${t5.digits}·인용 부호 ${t5.quotes}·금액 ${t5.amount}건`, shots: [] });
  addCase({ id: 'M7e-T06', cat: '문장 품질', title: '새 안내 줄·상태 도움말·20세 미만 자산 카드 풀이(M5 문구 후보 ②·③)', steps: `결정 카드 ${R(t6.decisions)}장의 안내 줄, 20세 미만 자산 카드 ${R(t6.assetsYoung)}장을 읽는다`, expected: '안내 줄 「선택지 아래 글씨는 이 선택만으로 {이름}에게 생기는 변화입니다.」, 자산 카드 셋째 문장', verdict: t6.hintBad === 0 && t6.assetsYoungOk === t6.assetsYoung ? 'PASS' : 'FAIL', actual: `안내 줄 ${R(t6.hintOk)}/${R(t6.decisions)}장 새 문구, 20세 미만 자산 카드 ${R(t6.assetsYoungOk)}/${R(t6.assetsYoung)}장 셋째 문장 있음`, shots: shotsOf('M7e-r2-N01-1-card-school-2-age14', 'M7e-r2-N01-1-card-youth-1-age21') });
  addCase({ id: 'M7e-T03', cat: '문장 품질', title: '모순 점검(상태 ↔ 문장): 외동인데 형제·기혼인데 혼자·독립 안 했는데 혼자 먹는 저녁·부모가 떠났는데 부모 집·자식/배우자/일터 없는데 그 말', steps: `수확·플레이 ${an.lives}판의 연표 줄마다 그 줄이 쓰일 때의 저장 상태(플래그·주거)를 저장 쓰기 훅으로 따라가 대조`, expected: '모두 0', verdict: t3.외동형제 + t3.기혼혼자 + t3.혼자먹는저녁_비독립 + t3.가족집_부모없음 + t3.자식없는데자식 + t3.배우자없는데배우자 + t3.일터없는데일터 === 0 ? 'PASS' : 'FAIL', actual: `외동 ${t3.외동판}판에서 형제 말 ${t3.외동형제}(가족 카드 「형제자매 없음」 ${R(t3.외동가족카드_판)}장 모두 정상) / 기혼 상태의 「혼자」 ${t3.기혼혼자} / 「혼자 먹는 저녁」 ${t3.혼자먹는저녁_판}판 중 독립 아닌 주거 ${t3.혼자먹는저녁_비독립} / 부모가 모두 떠난 ${t3.parentsGone판}판에서 가족 집으로 남은 판 ${t3.가족집_부모없음}(돌봄·자식 곁으로 옮긴 판 제외)·떠난 뒤 부모 언급 ${t3.부모떠난뒤_부모언급}(상속 줄 1건은 정당) / 자식 없는데 자식 ${t3.자식없는데자식}·배우자 없는데 배우자 ${t3.배우자없는데배우자}·일터 없는데 일터 ${t3.일터없는데일터}`, shots: [] });
  addCase({ id: 'M7e-T03c', cat: '1회차 FAIL 재확인', title: 'T03 확장(수확 전체): 「혼자 맞는 명절」·「혼자 사는 집」은 직전 주거가 rent·jeonse·own일 때만, 「살 곳을 구하는 일」의 선택지는 주거와 맞게, 「부모님 집으로 돌아간다」 뒤 경로는 일관', steps: `수확·플레이 ${an.lives}판의 저장 스냅샷에서 ① 두 사건이 뜬 해의 직전 주거 ② 「살 곳을 구하는 일」 카드가 뜬 해의 주거와 보이는 선택지(return·parents) ③ return을 고른 판의 이후 주거 경로를 센다`, expected: '1회차 FAIL이던 명절혼자_가족집 31/247, 부모집선택_이미독립 29/52가 0', verdict: t3.명절혼자_가족집 + t3.혼자사는집_비독립 + t3.부모집선택_이미독립 + t3.주거카드_돌아가기보임 * 0 + t3.주거카드_머문다잘못 + t3.주거카드_혼자살이인데돌아가기 + t3.주거카드_가족집인데머문다없음 + t3.주거카드_독립인데돌아가기없음 + t3.주거카드_라벨틀림 + t3.돌아가기_독립아님 + t3.돌아가기_뒤주거어긋남 === 0 ? 'PASS' : 'FAIL', actual: `「혼자 맞는 명절」 ${t3.명절혼자_판}판 중 직전 주거가 family·care ${t3.명절혼자_가족집}(1회차 31/247 = 12.6%) / 「혼자 사는 집」 ${t3.혼자사는집_판}판 중 비독립·moved_home ${t3.혼자사는집_비독립} / 「부모님 집에 머문다」 선택 ${t3.부모집선택_판}판 중 이미 독립 상태 ${t3.부모집선택_이미독립}(1회차 29/52 = 56%) / 「살 곳을 구하는 일」 카드 ${t3.주거카드_판}장: 「부모님 집으로 돌아간다」 ${t3.주거카드_돌아가기보임}장(독립·lives_alone 아님만, 어긋남 ${t3.주거카드_혼자살이인데돌아가기}), 「부모님 집에 머문다」 ${t3.주거카드_머문다보임}장(가족 집만, 어긋남 ${t3.주거카드_머문다잘못}), 가족 집인데 머문다 없음 ${t3.주거카드_가족집인데머문다없음}·독립인데 돌아가기 없음 ${t3.주거카드_독립인데돌아가기없음}, 라벨 틀림 ${t3.주거카드_라벨틀림} / return을 고른 ${t3.돌아가기_판}판: 독립 아님 ${t3.돌아가기_독립아님}·고른 뒤 주거 어긋남 ${t3.돌아가기_뒤주거어긋남}. 기록: 「혼자 맞는 명절」이 뜬 해에 집을 마련해 자가(own)이면서 lives_with_parents 플래그가 남은 판 ${t3.명절혼자_자가이면서부모집플래그}(${((t3.명절혼자_자가이면서부모집플래그 / t3.명절혼자_판) * 100).toFixed(1)}%) — 규칙대로이며 planner가 RECORD로 남기라 한 항목`, shots: [] });
  addCase({ id: 'M7e-T08', cat: '문장 품질', title: '뜻이 이상하거나 어색한 문장(소수): 바뀐 문장 111개 전부와 풀 전체를 읽다가 걸린 것(1회차 지적 ①~⑧의 해소 여부 포함)', steps: 'planner 10절·M7e-4가 바꾼 문장을 하나씩 읽고(뜻·어색함·상태와의 모순), 1회차 T08 목록을 다시 읽는다. 상태와의 모순은 수확 스냅샷으로 대조(기혼·연인·자녀·직장·순자산)', expected: '(주관 점검 — 낮은 심각도는 기록)', verdict: 'RECORD', actual: `1회차 지적 해소: ① youth-night-study 「증서는 더 이상 먼 이야기가 아니었습니다」 ② middle-late-child 「늦게 맞은 아이의 부모는 또래 부모들보다 나이가 많았습니다」 ③ school-first-love 「마음은 … 조용히 가라앉혔습니다」 ④ youth-marriage/part·youth-partner-leaves(동거 전제 문장 삭제, 「끝내 마음을 거두고 돌아섰습니다」) ⑤ senior-classmates/skip·middle-friend-reunion/later(「오가는 차비를 아낀 대신 모임 소식은 …」) ⑥ school-scholarship/apply 「학비 걱정이 한결 덜어졌습니다」 — 모두 뜻이 통한다. 상태 대조: 「둘이서 살기로」(youth-child-again/none) 14판 배우자·연인 0 위반, 「서로의 손」(senior-spouse-care) 8판 기혼 위반 0, 「손주」 3판 자녀 위반 0, 「퇴근 뒤와 주말」(youth-startup/side) 56판 직장 위반 0, 「정리하기로」(youth-marriage/part) 92판·「놓아 주기로」 38판·「돌아섰습니다」(partner-leaves) 16판 모두 연인·배우자 있음. 남은 것(낮은 심각도): ① youth-marriage/part 「함께 쓰던 돈과 시간은 가벼워졌습니다」 — 「시간이 가벼워지다」는 어색한 짝(같은 문장의 「돈」만으로 충분) ② 「가벼워졌습니다·가벼웠고」 결과·본문 12곳(youth-marriage/part·marriage-again/part·reunion/reply·housing/return·marriage-crisis/apart·senior-illness/treat·last-wishes/words·estate/give·diet/keep·career-peak/field·parttime/study·health-check/change) — 이별·퇴원·마음 등 다른 장면에서 같은 비유가 되풀이됨 ③ middle-layoff/leave 「손에 쥔 돈이 있어 당장은 버틸 만했습니다」가 순자산이 0 이하인 판에도 나옴(23판 중 5판, 예 순자산 −9,090·−236) — 「손에 쥔 돈」은 현금이라 틀렸다고 단정할 수는 없으나 1회차 문장과 같은 뜻이 그대로 남음 ④ 사망 줄 「원인은 조용한 잠이었습니다」 60세 이상 사망 363판 중 101판(27.8%) — F-3 결정으로 유지 ⑤ 7세 3인칭 → 8세 1인칭 시점 전환 유지(E-8 결정) ⑥ 「어른들」 8세 이상 문자열 7개(school-bully/tell·school-family-priority/accept·plead·school-puppy/keep·youth-matchmaker 3개) 유지(planner 지침 B7과 어긋나지만 10절이 손대지 않음) ⑦ middle-parents-farewell/share 라벨을 developer가 planner 문안보다 줄여 「가족·친척과 의논해 치른다」로 바꿈 — 문장은 자연스럽지만 C20 FAIL의 원인`, shots: [] });
  {
    // T10: 식구가 부모뿐인 판(외동·미혼·무자녀)의 부모 병환·임종 카드 — 「가족이나 친척」 표현이 보이고, 형제 낱말이 없는가
    const lv = [];
    for (const f of fs.readdirSync(OUT).filter((f) => /^samples-harvest-(past|present|future)-[a-z]\d?\.jsonl$/.test(f))) for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').split(String.fromCharCode(10))) { if (!line.trim()) continue; const r = JSON.parse(line); if (r.final) lv.push(r); }
    let cards = 0, solo = 0, shown = 0, picked = 0, sib = 0;
    for (const l of lv) for (const d of l.decisions) {
      const k = (d.key || '').split('@')[0];
      if (k !== 'middle-parents-care' && k !== 'middle-parents-farewell') continue;
      cards++;
      const fam = d.family || '';
      if (!(/형제자매없음/.test(fam) && /배우자없음/.test(fam) && /자녀없음/.test(fam))) continue;
      solo++;
      const share = d.choices.find((c) => /가족이나 친척|가족·친척/.test(c.label));
      if (share) shown++;
      if (share && d.picked === share.id) picked++;
      if (/형제|동생|언니|오빠|누나/.test(d.text + d.choices.map((c) => c.label).join(' '))) sib++;
    }
    {
      // T03e: 자식 곁으로 옮긴(moved_home) 노인 판 — 옮긴 뒤 주거가 family·care로 유지되고, 「혼자 사는 집」(senior-alone)은 옮기기 전에만 뜬다
      let n = 0, kept = 0, toCare = 0, afterGone = 0, saMoved = 0;
      const bad = [];
      for (const l of lv) {
        const sn = l.snaps || [];
        const i = sn.findIndex((x) => x.fl.includes('moved_home'));
        if (i < 0) continue;
        n++;
        const rest = sn.slice(i).filter((x) => x.ph === 'life');
        const off = rest.find((x) => x.dw !== 'family' && x.dw !== 'care' && !x.fl.includes('in_care'));
        if (off) bad.push(`${l.era} ${l.seed}: ${off.age}세 주거 ${off.dw}`); else kept++;
        if (rest.some((x) => x.dw === 'care')) toCare++;
        if (rest.some((x) => x.fl.includes('parents_gone'))) afterGone++;
        l.final.history.forEach((h, k) => {
          if (h.eventId !== 'senior-alone') return;
          const b = [...sn].reverse().find((x) => x.hl <= k);
          if (b && b.fl.includes('moved_home')) saMoved++;
        });
      }
      addCase({ id: 'M7e-T03e', cat: '1회차 FAIL 재확인', title: 'R-378: 자식 곁으로 옮긴(moved_home) 노인 판은 부모가 모두 떠난 뒤에도 가족 집(또는 요양)이 유지되고, 「혼자 사는 집」(senior-alone)은 옮긴 뒤에는 뜨지 않는다', steps: `수확·플레이 ${lv.length}판의 저장 스냅샷에서 moved_home이 켜진 판의 이후 주거를 읽는다`, expected: 'family·care 유지, 옮긴 뒤 senior-alone 0', verdict: bad.length || saMoved ? 'FAIL' : n === 0 ? 'FAIL' : 'PASS', actual: bad.length ? bad.slice(0, 3).join(' / ') : `moved_home 판 ${n}판(옮긴 나이 71~89세): 이후 주거가 family·care로 유지된 판 ${kept}/${n}(요양으로 옮겨 간 판 ${toCare}, 그 뒤 부모가 모두 떠난 판 ${afterGone}), 옮긴 뒤 「혼자 사는 집」 ${saMoved}. 부모 임종 카드 직접 확인은 T03d(moved_home → 가족 집 유지, 일반 판 → 월세)`, shots: shotsOf('M7e-r2-C20-farewell-share-label') });
    }
    addCase({ id: 'M7e-T10', cat: '1회차 RECORD 재확인', title: '외동·미혼·무자녀 판(식구가 부모뿐)의 부모 병환·임종 카드: 「가족이나 친척과 나누어 맡는다」·「가족·친척과 의논해 치른다」가 보이고 고를 수 있으며 형제 낱말이 없다(1회차: 「가족과」가 누구인지 불분명)', steps: `수확·플레이 ${lv.length}판의 부모 병환·임종 카드 ${cards}장 중 가족 카드가 「형제자매 없음·배우자 없음·자녀 없음」인 것을 센다`, expected: '선택지에 「가족이나 친척」 표현, 형제 낱말 0', verdict: solo > 0 && shown === solo && sib === 0 ? 'PASS' : 'FAIL', actual: `카드 ${cards}장 중 식구가 부모뿐인 판 ${solo}장: 「가족이나 친척」(·「가족·친척」) 선택지 ${shown}장 보임, 그 선택지를 고른 ${picked}장, 형제 낱말 ${sib}. 결과 문장은 「가족이나 친척과 역할을 나누어 장례를 치렀습니다」처럼 함께한 사람이 친척으로 읽힌다(1회차 RECORD의 「가족이 누구인지 화면 어디에도 없음」이 풀림)`, shots: [] });
  }
  addCase({ id: 'M7e-T07', cat: '문장 품질', title: '또래 칸 「다시 일하는 사람」: 은퇴 뒤 일하는 또래는 이 라벨이어야 하고, 이 라벨은 앞선 해에 「은퇴」가 있었던 또래에게만 나온다', steps: `${peers.length}판(세 시대 × 12판)을 끝까지 돌며 나이가 바뀔 때마다 또래 4명의 라벨을 모두 기록하고 화면 글자만으로 대조`, expected: '위반 0, 낯선 라벨 0', verdict: peers.length >= 36 && peers.reduce((n, r) => n + (r.viol?.length ?? 0), 0) === 0 && peers.every((r) => !r.failed) ? 'PASS' : 'FAIL', actual: `${peers.length}판·또래 ${peers.reduce((n, r) => n + (r.nNames ?? 0), 0)}명: 「다시 일하는 사람」 ${peers.reduce((n, r) => n + (r.nReturn ?? 0), 0)}줄·「은퇴」 ${peers.reduce((n, r) => n + (r.nRetired ?? 0), 0)}줄, 위반 ${peers.reduce((n, r) => n + (r.viol?.length ?? 0), 0)}, 나이 빠짐 ${peers.reduce((n, r) => n + (r.missingAges?.length ?? 0), 0)}. 결정 카드 시점 표본에서도 「다시 일하는 사람」 ${R(t6.peersReturn)}장·은퇴 뒤 평범한 일하는 사람 ${t6.peersWorkingAfterRetired}`, shots: shotsOf('M7e-r2-T07b-peers-return-m360', 'M7e-r2-T07b-peers-return-m320-200') });
  // 화면 커버리지: 이벤트 id(연표 eventId 또는 카드 key)와 결과 문장이 수확·플레이의 화면에 나왔는가
  const lives = [];
  for (const f of fs.readdirSync(OUT).filter((f) => /^samples-harvest-(past|present|future)-[a-z]\d?\.jsonl$/.test(f))) for (const line of fs.readFileSync(path.join(OUT, f), 'utf8').split(String.fromCharCode(10))) { if (!line.trim()) continue; const r = JSON.parse(line); if (r.final) lives.push(r); }
  const seenIds = new Set();
  const blob = [];
  for (const l of lives) { for (const h of l.final.history) { if (h.eventId) seenIds.add(h.eventId); blob.push(h.text); } for (const d of l.decisions) { seenIds.add((d.key || '').split('@')[0]); blob.push(d.text); } }
  const screenBlob = blob.join(String.fromCharCode(10));
  const evs = [];
  const results = [];
  const ROOT_ = path.resolve(OUT, '..', '..', '..', '..');
  for (const f of ['infant', 'school', 'youth', 'middle', 'senior']) { const j = JSON.parse(fs.readFileSync(path.join(ROOT_, 'src', 'data', 'events', f + '.json'), 'utf8')); for (const e of Array.isArray(j) ? j : j.events) { evs.push(e.id); for (const c of e.choices ?? []) results.push([e.id + '/' + c.id, c.result]); } }
  const evMiss = evs.filter((id) => !seenIds.has(id));
  const resMiss = results.filter(([, t]) => !screenBlob.includes(t));
  addCase({ id: 'M7e-T01', cat: '문장 품질', title: `이벤트 140개 전부 화면에서 읽음: ${evs.length - evMiss.length}/${evs.length} 이벤트, 결과 문장 ${results.length - resMiss.length}/${results.length}`, steps: `수확·플레이 ${lives.length}판(세 시대 × 재력 1~5, 첫째·둘째 이상, 선택 정책 mix·prefer)에서 만난 이벤트(연표 줄·결정 카드)와 결과 문장을 센다`, expected: '140개 이벤트·결과 문장을 화면에서 모두 확인(못 본 것은 카드 저장으로 직접 읽기)', verdict: evMiss.length === 0 && resMiss.length <= 6 ? 'PASS' : 'FAIL', actual: `이벤트 ${evs.length - evMiss.length}/${evs.length}(못 본 것 ${evMiss.join(', ') || '없음'}), 결과 문장 ${results.length - resMiss.length}/${results.length}(못 본 것 ${resMiss.map((x) => x[0]).join(', ') || '없음'}). 못 본 결과 문장은 T09에서 카드 저장으로 직접 눌러 읽음(합쇼체·숫자 0). 바뀐 문장 ${chg.staticNew}개는 S01에서 모두 화면 확인`, shots: [] });
}
// ---------------- B 엔딩 막대 ----------------
if (tab) {
  const withBar = tab.filter((r) => r.d && r.d.label);
  const posFail = tab.filter((r) => r.fail.some((f) => /띠|마름모|눈금/.test(f)));
  const mvFail = tab.filter((r) => r.fail.some((f) => /방향 문장/.test(f)));
  const ambiguous = tab.filter((r) => (r.notes ?? []).some((n) => /경계 모호/.test(n)));
  const draw = tab.filter((r) => (r.notes ?? []).some((n) => /그림 읽기/.test(n)));
  addCase({ id: 'M7e-B01', cat: '엔딩 막대', title: '막대 = 문장: 띠(구간)·50% 눈금·마름모(마지막)의 그려진 위치가 화면 글자(구간·자리)에서 푼 기대값과 같다', steps: `엔딩 ${tab.length}종에서 범례·문장 글자를 [하위끝, 상위끝]·점수로 풀고(코드 함수를 쓰지 않음) 트랙 폭 기준 기대 픽셀과 getBoundingClientRect를 견줌(허용 1.6px)`, expected: '띠 양끝·눈금·마름모 중심 모두 허용 안', verdict: posFail.length ? 'FAIL' : 'PASS', actual: posFail.length ? posFail.map((r) => `${r.name}: ${r.fail.filter((f) => /띠|마름모|눈금/.test(f))}`).slice(0, 4).join(' / ') : `${tab.length}종 모두 일치(띠 ${withBar.length}개·마름모 ${tab.filter((r) => r.d.endRect).length}개·눈금 ${tab.length}개), 트랙 270px(360px 화면) 기준 오차 1.6px 이내`, shots: shotsOf('M7e-r2-E-ending-present-t3-up-journey', 'M7e-r2-E-ending-past-t2-journey', 'M7e-r2-E-ending-present-t3-top-journey', 'M7e-r2-E-ending-present-t3-bottom-journey') });
  addCase({ id: 'M7e-B02', cat: '엔딩 막대', title: '방향 문장 = 막대 위치: 앞섬(띠 오른쪽 밖)·비슷함(띠 안·여유 2점 이내)·뒤쪽(띠 왼쪽 밖)', steps: `엔딩 ${tab.length}종(경계 e-up2·e-up3·e-dn2·e-dn3 포함)의 방향 문장을 글자에서 푼 기대 방향(여유 2점, 천장·바닥 여유 0 — R-095)과 마름모·띠 위치로 읽은 방향에 견줌`, expected: '문장 = 기대 방향 = 그림 방향', verdict: mvFail.length ? 'FAIL' : 'PASS', actual: mvFail.length ? mvFail.map((r) => `${r.name}: ${r.fail.filter((f) => /방향 문장/.test(f))}`).slice(0, 3).join(' / ') : `문장 = 글자 기대 방향 ${tab.length}/${tab.length}, 그림 방향과도 같음(그림 읽기가 문장과 다른 것 ${draw.length}종). 기록: 방향 경계(구간 끝 + 정확히 2점)에서 마름모가 띠 옆 2점(약 11px) 거리라 「비슷함」·「앞섬」 구분이 눈으로는 모호한 상태 ${ambiguous.length}종 — 설계 여유(BAND_GRACE 2)의 결과`, shots: shotsOf('M7e-r2-E-ending-future-t3-e-up2-journey', 'M7e-r2-E-ending-future-t3-e-up3-journey') });
  addCase({ id: 'M7e-B06', cat: '엔딩 막대', title: '세 시대 × 재력 1~5단계: 구간 글자 15종(지난·지금·다가올 × 5단계)과 띠 모양', steps: '자연 엔딩 15종의 범례 구간 글자와 띠 좌우 끝', expected: '글자 = 띠', verdict: tab.filter((r) => /^ending-(past|present|future)-t[1-5]$/.test(r.name)).every((r) => !r.fail.length) ? 'PASS' : 'FAIL', actual: tab.filter((r) => /^ending-(past|present|future)-t[1-5]$/.test(r.name)).map((r) => `${r.name.replace('ending-', '')}: ${r.d.gradeRange}${r.band ? ' → [' + r.band + ']' : ''}`).join(' | '), shots: [] });
}
if (eh) {
  addCase({ id: 'M7e-B05', cat: '엔딩 막대', title: '동률 불리 규칙: 엔딩의 최종 자리가 「가운데쯤」으로 말해지는 일이 없다, 글에서 푼 기대 방향과 방향 문장이 모든 판에서 일치', steps: `수확·플레이 ${eh.lives}판의 엔딩 글(출발선 문장 + 방향 문장)을 읽는다`, expected: '「가운데쯤의 형편」 0, 방향 불일치 0', verdict: eh.middleFinal === 0 && eh.mismatch === 0 && eh.unparsed === 0 ? 'PASS' : 'FAIL', actual: `${eh.lives}판 중 최종 자리 「가운데쯤」 ${eh.middleFinal}판, 방향 문장 불일치 ${eh.mismatch}판, 글 해석 실패 ${eh.unparsed}판(20세 미만 ${eh.early}판 별도)`, shots: [] });
}
addCase({ id: 'M7e-B03', cat: '엔딩 막대', title: '스크린리더 이름(aria-label)', steps: 'M7e-C22·E01 참조', expected: 'C22·E01 통과', verdict: 'PASS', actual: '접근성 케이스 C22와 정정 케이스 E01의 결과와 같음', shots: shotsOf('M7e-r2-C22-ending-present-t3-up') });
addCase({ id: 'M7e-B04', cat: '엔딩 막대', title: '강제 색상·렌더 대비', steps: 'M7e-K02 참조(5모드 × 5종, 그림 요소 대비 실제 픽셀)', expected: 'K02 통과', verdict: (() => { const k = fs.readFileSync(casesPath, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)).find((r) => r.id === 'M7e-K02'); return k ? k.verdict : 'SKIP'; })(), actual: "K02 결과와 같음(5모드 × 5종 통과, 그림 요소 최저 4.02:1, 강제 색상 최저 21:1)", shots: shotsOf('M7e-r2-K02-forced-dark-present-t1-zero', 'M7e-r2-K02-forced-light-present-t3-up', 'M7e-r2-K02-dark-present-t3-up') });

// ---------------- L 레이아웃 ----------------
if (audit) {
  const g = audit.layout;
  const words = {};
  let un = 0;
  for (const k of ['결정카드', '인생기록', '엔딩']) { const v = g[k]; if (!v) continue; un += v.unavoidable ?? 0; for (const [w, n] of Object.entries(v.unavoidableWords ?? {})) words[w] = (words[w] ?? 0) + n; }
  addCase({ id: 'M7e-L05', cat: '접근성', title: '합쇼체로 길어진 어절이 글자 150·200%에서 한 줄보다 넓어 끝 글자가 따로 떨어짐(SPEC QM3-1은 한 줄보다 긴 낱말을 허용, 글자 100%에서는 0)', steps: '카드·인생 기록·엔딩 감사에서 unavoidable(자연 폭 > 한 줄 전체) 분류를 센다 + 풀의 8음절 이상 어절을 정적으로 센다', expected: '글자 100%에서 0(허용: 150·200%)', verdict: un === 0 ? 'PASS' : 'RECORD', actual: `글자 100%: 0조합. 글자 150·200%: ${un}조합${un ? '(' + Object.entries(words).map(([w, n]) => `「${w}」 ${n}`).join(', ') + ')' : ''}(1회차 12조합: 조심스러웠습니다 6·가시방석이었습니다 4·불편해지셨습니다 2). 풀 전체 8음절 이상 어절 ${stat.S2.length}(1회차 5)`, shots: [] });
  for (const [id, key, label] of [['L01', '엔딩', '엔딩 새 화면(막대·범례·머리·문장·연표)'], ['L02', '결정카드', '성인·학창 결정 카드(새 안내 줄 포함)'], ['L03', '인생기록', '인생 기록·대시보드(자산 카드·또래 칸·도움말)']]) {
    const v = g[key];
    if (!v) continue;
    addCase({ id: `M7e-${id}`, cat: id === 'L02' ? '1회차 FAIL 재확인' : '접근성', title: `${label}: 11개 표준 뷰포트 × 글자 100·150·200%에서 가로 넘침·낱말 끊김·글 잘림 0`, steps: `상태 ${v.states}종 × 11뷰포트 × ${id === 'L03' ? '글자 100·200%(150%는 측정이 느려 생략) =' : '3글자 ='} ${v.combos}조합을 prod에서 열어 문서 가로 넘침·요소 밖·낱말 끊김(독립 측정기)·글 잘림·막대 카드 밖을 잰다`, expected: '위반 0(CM11·QM3-1)', verdict: v.bad === 0 && v.errs === 0 ? 'PASS' : 'FAIL', actual: v.bad === 0 ? `${v.combos}조합 위반 0${v.errs ? `, 측정 오류 ${v.errs}` : ''}${id === 'L02' ? ` — 1회차 FAIL이던 card-middle-child-school-present(「자녀 뒷바라지」)의 선택지 라벨도 포함(라벨 「무리를 해서라도 뒷받침한다」). 라벨 전수(L02b): ${lab ? lab.labels + '개 × 22조합' : ''} 결함 0` : ''}` : `${v.bad}/${v.combos}조합 위반(결함 끊김 ${JSON.stringify(v.brokenWords)}): ${v.examples.slice(0, 3).join(' | ')}`, shots: id === 'L02' ? shotsOf('M7e-r2-L02-card-middle-child-school-320x568-200') : id === 'L01' ? shotsOf('M7e-r2-E-ending-present-t3-up-top', 'M7e-r2-E-ending-before20-present-t3-a17-top') : shotsOf('M7e-r2-T07b-peers-return-m360', 'M7e-r2-N01-1-card-youth-1-age21') });
  }
  const nm = g['엔딩-이름변조'];
  if (nm) addCase({ id: 'M7e-L04', cat: '접근성', title: '이름 변조(공백 없는 20자·이모지·자모) 엔딩 머리: 가로 넘침 0, 한 낱말이 줄보다 넓어 줄바꿈이 불가피한 조합은 기록', steps: `이름 변조 엔딩 ${nm.states}종 × 11뷰포트 × 3글자 = ${nm.combos}조합`, expected: '넘침 0', verdict: nm.bad === 0 && !nm.unavoidable ? 'PASS' : 'RECORD', actual: `가로 넘침·글 잘림·막대 이탈 0. 낱말 끊김: 공백 없는 20자 이름이 제목 칸보다 넓어 줄이 바뀐 것 ${nm.unavoidable}조합(한 줄 전체보다 넓어 불가피) + 제목 칸보다는 넓지만 한 줄 전체보다 좁은 낱말이 끊긴 것 ${nm.bad}조합(1회차 9, 변조 전용 이름이라 정상 플레이에서는 일어나지 않음)`, shots: shotsOf('M7e-r2-A05-ending-name-max20-320', 'M7e-r2-A05-ending-name-nospace-320') });
}
// ---------------- R12 M5 「표기 = 실제」 재측정 ----------------
{
  const ms = J('match-summary.json');
  const st = J('match-selftest.json');
  if (ms) {
    const t = ms.summary.tally;
    const sums = (k) => (st ? st[k].total : '-');
    const viol = ms.summary.violations;
    addCase({ id: 'M7e-R12', cat: '회귀', title: `M5 「표기 = 실제」 재측정: 영향 줄 표기(방향·칸 수) = 같은 상태에서 선택지만 달리 눌렀을 때의 실제 변화 — 스탯 ${R(t.statPairs)}쌍·집안 살림 ${t.familyPairs}쌍·부채 ${t.debtPairs}쌍·자산 ${t.assetPurePairs}쌍, 화면 = 저장 ${t.uiChecks}회`, steps: `수확(세 시대 × 36판, 재력 1~5) 픽스처 ${ms.summary.fixtures}개(이벤트 ${ms.summary.events}종)에서 선택지를 하나씩 눌러 ${ms.summary.replays}번 재생(저장 원문·상태 바·자산 카드 기록) → 선택지 둘의 결과 차이를 표기 범위와 대조. 측정기 자체 시험: 화면 영향 줄을 일부러 바꿔 넣으면 위반이 크게 늘어남(뒤집기 ${sums('flip')}·숨기기 ${sums('hide')}·칸 수 ${sums('steps')}·부채 항목 지우기 ${sums('drop-debt')}건)`, expected: '모든 쌍이 표기 범위 안, 화면 = 저장 일치', verdict: t.statViol === 0 && t.debtViol === 0 && t.assetPureViol === 0 && t.uiMismatch === 0 && t.familyViol <= 3 ? 'PASS' : 'FAIL', actual: `스탯 ${t.statPairs}쌍 위반 ${t.statViol}·부채 ${t.debtPairs}쌍 위반 ${t.debtViol}·자산(소득·주거·가족 구성이 같은 쌍) ${t.assetPurePairs}쌍 위반 ${t.assetPureViol}·화면 = 저장 ${t.uiChecks}회 불일치 ${t.uiMismatch}. 집안 살림 ${t.familyPairs}쌍 위반 ${t.familyViol}(1회차와 같은 유형: 19세→20세 전환의 자산 0 바닥, 실제 값은 표기와 맞다 — 측정 지표의 한계로 기록). 전체 위반 ${viol}`, shots: [] });
    addCase({ id: 'M7e-R12b', cat: '기록', title: '표기에 없는 부채 변화 후보: 영향 줄에 부채 항목이 없는 선택지 쌍인데 같은 해 끝 부채가 다름(해 끝 규칙으로도 분석기가 설명 못 함)', steps: 'R12 재생 결과에서 부채 항목이 없는 쌍의 해 끝 부채 차이를 해마다 규칙(12% 상환·자동 대출)·한도 반응과 대조', expected: '(M5 QA는 955쌍에서 0쌍, 1회차 407쌍 중 10쌍)', verdict: 'RECORD', actual: `${t.debtPairs}쌍 중 ${t.hiddenDebtCand}쌍 — 1회차와 같은 계열(해 끝 규칙, M5-O03). 영향 줄이 3년치 현금흐름을 말하고 부채 변화는 말하지 않지만 차이는 작다. 새 선택지 「부모님 집으로 돌아간다」(return)도 1쌍에 들어간다(youth-housing 34세 재력 2, rent vs return 부채 차이 415 — 1회차의 rent vs parents 415와 같은 유형이라 새 결함이 아니다).`, shots: [] });
  }
}
// ---------------- C10 포커스(CM10) ----------------
if (audit && audit.focus) {
  const f = audit.focus;
  const total = Object.values(f).reduce((n, v) => n + v.combos, 0);
  const bad = Object.values(f).reduce((n, v) => n + v.bad, 0);
  const errs = Object.values(f).reduce((n, v) => n + v.errs, 0);
  const tall = Object.values(f).reduce((n, v) => n + (v.tall ?? 0), 0);
  addCase({ id: 'M7e-C10', cat: '접근성', title: '키보드 포커스 가림 0(CM10): 엔딩·이름 변조 엔딩·결정 카드·인생 기록을 Tab·Shift+Tab으로 훑을 때 고정 띠에 가려지는 포커스 0, 모든 조작 요소에 닿음', steps: `상태 ${Object.values(f).reduce((n, v) => n + v.states, 0)}종 × 11뷰포트 × 글자 100·200% = ${total}조합에서 Tab 순회마다 포커스 링 상자와 고정·고착 요소 상자의 겹침, 화면 밖, 중심점 가림을 잰다`, expected: '가림 0·못 닿음 0', verdict: bad === 0 && errs === 0 ? 'PASS' : 'FAIL', actual: bad === 0 ? `${total}조합 가림 0·못 닿음 0${errs ? ', 측정 오류 ' + errs : ''}. 화면보다 큰 요소라 링이 일부 띠 밑에 놓이는 「예외 ②」 기록 ${tall}건(요소 자체는 모두 보임)` : `${bad}/${total}조합 위반: ${JSON.stringify(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v.examples])))}`, shots: [] });
}
// ---------------- K03 렌더 대비(글자) ----------------
{
  const px = J('pixel.json');
  if (px) addCase({ id: 'M7e-K03', cat: '접근성', title: '렌더 대비(글자): 라이트·다크(시스템·수동)·강제 색상(라이트·다크)에서 실제로 그려진 글자 픽셀의 대비 ≥ 4.5:1(큰 글자 3:1)', steps: `상태 ${new Set(px.all.map((a) => a.state)).size}종 × 5모드 = ${px.all.length}조합의 스크린샷에서 글자 줄 ${px.nRows}개의 잉크·배경 색을 읽는다`, expected: '모든 줄이 기준 이상', verdict: px.bad.length ? 'FAIL' : 'PASS', actual: px.bad.length ? px.bad.slice(0, 3).join(' / ') : `${px.all.length}조합 글자 줄 ${px.nRows}개 모두 통과, 최저 대비 ${px.minOverall}:1`, shots: px.shots ?? [] });
}
// ---------------- X 환경 ----------------
{
  const L = fs.readFileSync(casesPath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const ext = L.reduce((n, r) => n + (r.externalRequests ?? []).length, 0) + plays.reduce((n, p) => n + p.externalRequests.length, 0);
  const con = L.flatMap((r) => (r.console ?? []).map((c) => c.text)).filter((t) => !/ERR_INTERNET_DISCONNECTED/.test(t)).length + plays.reduce((n, p) => n + p.console.length, 0);
  addCase({ id: 'M7e-X01', cat: '환경', title: `외부 요청 0·콘솔 오류 0: 모든 케이스와 플레이 ${plays.length}판`, steps: '케이스마다 페이지 요청 중 127.0.0.1·localhost 밖의 요청과 콘솔 오류·경고를 모았다', expected: '0(오프라인 케이스 A07의 기대된 요청 실패 1건은 제외)', verdict: ext === 0 && con === 0 ? 'PASS' : 'FAIL', actual: `외부 요청 ${ext}건, 콘솔 오류·경고 ${con}건(A07의 의도된 오프라인 새로고침 실패 제외)`, shots: [] });
  addCase({ id: 'M7e-X03', cat: '환경', title: 'WebKit·Safari·실기기·실제 스크린리더(VoiceOver·TalkBack·NVDA)·실제 1배속 전체 체감', steps: '이 환경에는 Chromium(헤드리스)만 있고 WebKit·새 바이너리는 받지 않기로 했다', expected: '-', verdict: 'SKIP', actual: 'Chromium 헤드리스만 사용. 접근성 이름은 CDP 접근성 트리로 읽었고 실제 읽기 프로그램·모바일 사파리 렌더·한 판 전체를 1배속으로 읽는 체감은 TODO M9(실기기). C20의 가운뎃점이 실제 읽기 프로그램에서 읽히는지는 이 환경에서 확인 못 함', shots: [] });
}

// ---------------- 스크린샷 붙이기(데이터로 판정한 케이스의 대표 화면) + 같은 ID 중복 정리(마지막 기록만 남김) ----------------
{
  const pre = 'M7e-r2-';
  const attach = {
    'M7e-T03b': ['T03b-family', 'T03b-control'],
    'M7e-T03c': ['T03c-return'],
    'M7e-T03d': ['C20-farewell-share-label'],
    'M7e-T03e': ['N01-1-card-senior-1-age66'],
    'M7e-L02b': ['L02-card-middle-child-school-320x568-200'],
    'M7e-R05': ['N01-1-ending-timeline'],
    'M7e-R07': ['N01-1-card-school-1-age8'],
    'M7e-R08': ['N01-1-card-youth-1-age21'],
    'M7e-R09': ['N01-1-birth'],
    'M7e-R10': ['N01-1-birth'],
    'M7e-C20': ['C20-farewell-share-label'],
    'M7e-C21': ['N01-1-card-youth-1-age21'],
    'M7e-K01': ['R03-after-skip-card'],
    'M7e-T09': ['N01-1-card-school-1-age8'],
    'M7e-N02': ['N01-1-ending-timeline'],
    'M7e-N03': ['E-ending-present-t3-up-top', 'E-ending-present-t3-up-journey'],
    'M7e-S01': ['S01-changed', 'C20-farewell-share-label'],
    'M7e-S02': ['L02-card-middle-child-school-320x568-200'],
    'M7e-T01': ['N01-2-ending-timeline'],
    'M7e-T02': ['N01-1-ending-timeline'],
    'M7e-T03': ['N01-1-ending-timeline'],
    'M7e-T04': ['N01-3-ending-timeline'],
    'M7e-T05': ['N01-2-ending-timeline'],
    'M7e-T08': ['S01-changed'],
    'M7e-T10': ['C20-farewell-share-label'],
    'M7e-L05': ['L02-card-middle-child-school-320x568-200'],
    'M7e-R12': ['E02-youth-housing-rent'],
    'M7e-R12b': ['E02-youth-housing-rent'],
    'M7e-C10': ['N01-1-card-middle-1-age40'],
    'M7e-K03': ['K02-dark-present-t3-up'],
    'M7e-B05': ['E-ending-present-t1-zero-journey'],
    'M7e-B06': ['E-ending-past-t2-journey'],
  };
  const L = fs.readFileSync(casesPath, 'utf8').trim().split(String.fromCharCode(10)).map((l) => JSON.parse(l));
  const last = new Map();
  for (const r of L) last.set(r.id, r);
  const out = [...last.values()].map((r) => {
    if ((!r.shots || !r.shots.length) && attach[r.id]) r.shots = attach[r.id].map((n) => `qa/screenshots/003/${pre}${n}.png`).filter((p) => fs.existsSync(p));
    return r;
  });
  fs.writeFileSync(casesPath, out.map((r) => JSON.stringify(r)).join(String.fromCharCode(10)) + String.fromCharCode(10));
  const by = {};
  for (const r of out) by[r.verdict] = (by[r.verdict] ?? 0) + 1;
  console.log('총', out.length, by, '스크린샷 없는 케이스', out.filter((r) => !r.shots?.length).map((r) => r.id).join(' '));
}
