// QA-003 M7a 2회차 최종 집계: 수확·감사·플레이 결과 파일에서 숫자를 읽어 r2-cases.jsonl에 덧붙인다(판정은 QA가 정한 값, 숫자는 파일에서).
// 사용: QA_RP=r2- node qa/scripts/m7a-final-cases-r2.mjs   (한 번만. 이미 있는 id는 건너뜀)
import fs from 'node:fs';
import path from 'node:path';
import { OUT, RP } from './m7a-lib.mjs';

const rd = (f) => fs.readFileSync(path.join(OUT, f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const casesFile = path.join(OUT, `${RP}cases.jsonl`);
const existing = new Set(rd(`${RP}cases.jsonl`).map((r) => r.id));
const add = (rec) => {
  if (existing.has(rec.id)) return;
  existing.add(rec.id);
  fs.appendFileSync(casesFile, JSON.stringify({ console: [], externalRequests: [], shots: [], at: new Date().toISOString(), ...rec }) + '\n');
  console.log(`[${rec.verdict}] ${rec.id}`);
};
const A = JSON.parse(fs.readFileSync(path.join(OUT, `${RP}analysis.json`), 'utf8'));
const era3 = ['past', 'present', 'future'];
const kr = { past: '지난', present: '지금', future: '다가올' };
const e = A.byEra;
const S = (k, f) => era3.reduce((a, x) => a + e[x][k], 0);
const fc = A.findingCounts;
const shot = (n) => `qa/screenshots/003/M7a-r2-${n}.png`;

// ---- N01: 3판 ----
const GAMES = [['past', 'past-t1-28', '재력 1단계(흙수저) 임차 첫째 · 2배속'], ['present', 'present-t5-70', '재력 5단계(다이아몬드수저) 자가 첫째 · 2배속'], ['future', 'future-t1-5', '재력 1단계 자가 첫째 · 1배속']];
for (const [era, tag, desc] of GAMES) {
  const s = JSON.parse(fs.readFileSync(path.join(OUT, `${RP}play-${tag}.json`), 'utf8'));
  const h = s.final.history;
  const tl = s.ending.timeline;
  const infant = h.filter((x) => x.age <= 7);
  const byAge = {};
  for (const x of infant.filter((y) => y.kind !== 'stage')) byAge[x.age] = (byAge[x.age] ?? 0) + 1;
  const ms = ['infant-vaccine', 'infant-first-steps', 'infant-first-word'].map((id) => h.find((x) => x.eventId === id)?.age ?? null);
  const ok = s.errors.length === 0 && ms.every((a) => a !== null) && tl.length === h.length && s.console.length === 0 && s.externalRequests.length === 0 && byAge[1] >= 3;
  add({
    id: `M7a-N01-${tag}`, cat: '정상', title: `정상 플로우(${kr[era]} 세상, ${desc})`,
    steps: `prod 360×740 터치, 0~7세를 ${tag.includes('t1-5') ? '1' : '2'}배속(8세부터 8배속)으로 직접 읽으며 사망·엔딩까지`,
    expected: '마일스톤 3개 1번씩, 1세 세 줄, 카드 영향 줄, 7세 장면, 엔딩 연표에 영유아 줄, 콘솔·외부 요청 0',
    verdict: ok ? 'PASS' : 'FAIL',
    actual: `사망 ${s.final.age}세 · 마일스톤 나이 ${ms.join('·')}(예방접종·걸음마·첫 말) · 1세 줄 ${byAge[1]}개 · 0~7세 결정 카드 ${s.decisions.filter((d) => d.age <= 7).map((d) => d.key.split('@')[0].replace('infant-', '')).join(',')} · 7세 줄 ${h.filter((x) => x.age === 7).map((x) => x.text.slice(0, 12)).join(' / ')} · 저장 연표 ${h.length}줄 = 엔딩 연표 ${tl.length}줄 · 콘솔 ${s.console.length}·외부 요청 ${s.externalRequests.length}`,
    shots: s.shots.slice(0, 4),
  });
}
add({ id: 'M7a-N02', cat: '정상', title: 'IN2 실측(화면 수확 600판, 시대별 200판)', steps: '개발 서버 배율 10·8배속으로 시드 1~200 × 세 시대를 0~8세까지 돌며 인생 기록 줄·결정 카드를 읽음', expected: '1차: 빈 해 ≤ 1.5(최대 ≤ 4)·줄 ≥ 9·선택지 ≥ 2.8', verdict: 'PASS', actual: era3.map((k) => `${kr[k]} 빈 해 ${e[k].blankAvg.toFixed(2)}(최대 ${e[k].blankMax})·줄 ${e[k].linesAvg.toFixed(2)}·선택지 ${e[k].choicesAvg.toFixed(2)}`).join(' / ') + ` — 1차 충족(1회차 빈 해 0.79·0.94·0.82/최대 3, 줄 9.76·9.59·9.72, 선택지 3.01·2.98·2.98). 지금 세상 빈 해 최대가 4(1차 한계 ≤ 4에 닿음). 판당 0~7세 카드 1장 20·2장 134·3장 306·4장 140판` });
add({ id: 'M7a-N03', cat: '정상', title: '마일스톤: 예방접종 0세 · 첫 걸음마 1세 · 첫 말 1세가 600판 모두 각 1번, 1세 줄 순서가 걸음마 → 첫 말', steps: '600판의 seen·연표 대조(MS·MS-ORDER 점검)', expected: '위반 0', verdict: (fc.MS ?? 0) + (fc['MS-ORDER'] ?? 0) === 0 ? 'PASS' : 'FAIL', actual: `위반 ${(fc.MS ?? 0) + (fc['MS-ORDER'] ?? 0)}건. 1세 줄 수: 3줄 ${S('threeLineGames')}판(${Math.round((100 * S('threeLineGames')) / 600)}%, 걸음마+첫 말+일반 사건), 2줄 ${600 - S('threeLineGames')}판(일반 사건 없음). 1세 셋째 줄은 밤마다 깨는 아이·건강검진·형제 따라 하기·첫 생일·한밤의 열 …` });
add({ id: 'M7a-N05', cat: '정상', title: '7세 학교 장면', steps: '600판의 7세 줄을 셈', expected: '학교 전용 장면이 일어남', verdict: 'PASS', actual: era3.map((k) => `${kr[k]}: ${Object.entries(A.ms.seven[k]).map(([id, n]) => `${id.replace('infant-', '').replace('_none', '사건 없음')} ${n}`).join(' · ')}`).join(' / ') });

// ---- T ----
add({ id: 'M7a-T01', cat: '문장', title: '어체(R-366): 영유아 구간(0~7세) 인생 기록 줄 전부가 합쇼체 — 합쇼체로 바뀐 기존 9개와 7세 단계 줄 포함', steps: '600판의 0~7세 인생 기록 줄 6,532개·문장 12,301개를 문장 단위로 판정(출생 문장 뒤 체중 괄호 제외)', expected: '해라체 문장 0', verdict: (fc.TONE ?? 0) === 0 ? 'PASS' : 'FAIL', actual: `해라체·마침표 없음 문장 ${fc.TONE ?? 0}건. 1회차는 해라체 줄이 328해(한 해 두 줄 이상 해 중)에 섞이고 7세 단계 진입 줄이 525/600판에서 합쇼체 앞에 붙었으나 지금은 0. 8세 이후 학창 이벤트·단계 줄은 아직 해라체(T08 RECORD)` });
add({ id: 'M7a-T04', cat: '문장', title: '1회차 FAIL T04 재확인: 재력 4·5단계 판의 영유아 줄에 형편 낱말(빠듯·숨통·겨우·만만치·형편이 어려·넉넉하지) 0', steps: '수확 600판(재력 4·5단계 99판·영유아 줄 1,168개)에서 13-1 정규식 검색. 같은 시드 111(재력 5)·시드 26(재력 4)을 다시 돌려 화면 확인', expected: '0건', verdict: (fc.T04 ?? 0) === 0 ? 'PASS' : 'FAIL', actual: `재력 4·5단계 형편 낱말 ${fc.T04 ?? 0}건. 고쳐진 문장이 화면에 나옴: 「…아이의 하루는 일정했고 한 사람의 벌이는 줄었습니다.」(시드 111, 인생 기록 첫 줄 「아주 넉넉한 가정」), 「…돌보는 사람의 벌이는 줄었습니다.」(시드 26 재력 4). 넓게 본 낱말(「벌이는 줄」)은 4·5단계 10건(일을 쉬는 한 해 8·유치원 집에서 더 돌본다 2) — 사실 서술이라 RECORD(O11)`, shots: [shot('T04a-card'), shot('T04a-log-result'), shot('T04a-log-birth-line'), shot('T04b-log-result')] });
add({ id: 'M7a-T05', cat: '문장', title: '1회차 FAIL T05 재확인: 출생 주거 「자가」인 판에 「이삿짐을 싸던 날」이 나오지 않고, 임차·무상 판에서는 나온다', steps: '수확 600판(자가 321·임차 267·무상 12)의 이삿짐 카드를 주거별로 셈, 코어 탐침 73개(자가 재력 1~3 × 3~6세 × 세 시대 36 + 대조), 같은 시드 94·80(1회차 자가 판)을 8세까지 다시 돌리고 임차 판에서 「빚을 내어」를 고름', expected: '자가 0, 임차·무상 > 0, 결과 문구 「빚을 내어」', verdict: A.t05.ownMoving === 0 && (fc.T05 ?? 0) === 0 ? 'PASS' : 'FAIL', actual: `자가 판 이삿짐 ${A.t05.ownMoving}건(자가·재력 ≤ 3 판 258개 중), 임차 ${A.t05.movingByHousing.rent}·무상 ${A.t05.movingByHousing.free}장(임차·무상·재력 ≤ 3 판 243개 중). 「빚을 내어 작은 집을 산다」는 임차 ${A.t05.buyShown.rent}·무상 ${A.t05.buyShown.free}장에만 보임. 코어 탐침 73개 모두 기대대로(자가 재력 1~3의 3~6세 12,000개 난수에서 0, 임차·무상 나옴). 시드 94·80은 8세까지 이삿짐 줄 0, 임차 시드 3(5세)에서 결과 「빚을 내어 작은 집을 마련했습니다. 이사 걱정은 줄었지만 어른들의 한숨은 길어졌습니다.」`, shots: [shot('T05a-birth-report'), shot('T05a-log-at-age8'), shot('T05b-log-at-age8'), shot('T05c-card'), shot('T05c-log-result')] });
add({ id: 'M7a-T03', cat: '문장', title: '동생·형제 정합(BR6·IN4)', steps: '수확 600판(첫째 277·둘째 이상 323)에서 이벤트 나이·가족 카드 동생 표시·어머니 나이 대조', expected: '모순 0', verdict: (fc.SIB ?? 0) === 0 ? 'PASS' : 'FAIL', actual: `${fc.SIB ?? 0}건. 첫째 ${S('firstborn')}판 중 동생 맞이 ${S('sibGames')}(지난 ${Math.round((100 * e.past.sibGames) / e.past.firstborn)}%·지금 ${Math.round((100 * e.present.sibGames) / e.present.firstborn)}%·다가올 ${Math.round((100 * e.future.sibGames) / e.future.firstborn)}%), 둘째 이상 ${S('later')}판의 동생 맞이 ${S('laterSib')}, 장난감 ${S('toy')}판(동생 없이 0)` });
add({ id: 'M7a-W04', cat: '동생', title: '동생 맞이 카드(R-367·O06): 조부모 플래그 있음·없음 모두 선택지 3개, 문장·영향 줄', steps: '재력 1·5단계 × 세 시대 × 플래그 있음·없음 저장 21장을 prod에 열어 카드를 읽고, 수확 600판의 동생 카드 전수 확인', expected: '늘 3개(플래그 있음: help·sulk·grandma / 없음: help·sulk·notice), 영향 줄이 13-6 표와 같음', verdict: S('cardsAll') === S('cards3') && (fc['SIB-CARD'] ?? 0) === 0 ? 'PASS' : 'FAIL', actual: `수확 동생 카드 ${S('cardsAll')}장 모두 3개(grandma ${S('grandma')}·notice ${S('notice')}). 저장 비교: 없음 「동생을 예뻐하며 돌본다 [관계▲▲ 행복▼] / 서운해서 울며 어른에게 매달린다 [관계▼ 행복▼ 지식▲] / 일부러 장난을 쳐서 눈길을 끈다 [관계▲ 행복▼ 건강▲]」, 있음은 마지막이 「조부모님 품에서 마음을 달랜다 [관계▲ 행복▲ 건강▲]」. 재력과 무관. 결과 문장: help 「안기고 싶은 마음은 속으로 참았지만…」, sulk 「…서운한 마음을 말로 풀어놓는 법도 조금씩 익혔습니다」, notice 「…꾸중을 들었지만 눈길은 아이에게 돌아왔습니다」`, shots: [shot('W-infant-new-sibling-present-t1'), shot('W-infant-new-sibling-gc-present-t1')] });
add({ id: 'M7a-W05', cat: '문장', title: '맡김 경로(R-363, 1회차 모순 (a)(b)(c)): 육아휴직 복귀 뒤 대기·맡김 0 · 맡김 장면이 한 판에 둘 0 · 「놀이」·첫 책과 입학 문구 모순 0', steps: '수확 600판(육아휴직 복귀 22판·맡김 장면이 나온 판 170·「놀이」와 첫 책이 함께 나온 판 16)과 코어 탐침(childcare_set 켠 판에서 「맡겨지는 낮」·「어린이집 대기」가 나오는 난수 12,000개 탐색)', expected: '(a)(b)(c) 0', verdict: ((fc['CHILDCARE-a'] ?? 0) + (fc['CHILDCARE-b'] ?? 0) + (fc['CHILDCARE-c'] ?? 0)) === 0 ? 'PASS' : 'FAIL', actual: `(a) ${fc['CHILDCARE-a'] ?? 0}건 (b) ${fc['CHILDCARE-b'] ?? 0}건 (c) ${fc['CHILDCARE-c'] ?? 0}건. 맡김 장면은 보살핌 ${A.childcare.careOnly}판·어린이집 대기 ${A.childcare.waitOnly}판으로 갈려 한 판에 하나. 코어 탐침: 맡김이 정해진 판의 「맡겨지는 낮」(세 시대)·「어린이집 대기」(1·2세) 모두 12,000개 난수에서 0, 정해지지 않은 판에서는 나옴` });
add({ id: 'M7a-T06', cat: '문장', title: '방임 판 정합(O04)', steps: '방임 72판의 영유아 줄에서 단정 문구(「아이를 데리고 건강검진」·「의논했습니다」·「생각이 서로 달랐」) 검색', expected: '단정 문구 0', verdict: (fc.O04 ?? 0) === 0 ? 'PASS' : 'FAIL', actual: `단정 문구 ${fc.O04 ?? 0}건. 남은 것(의도, 13-9): 방임 판에도 백일 28·입원 21·첫 책 34·건강검진·학교 준비물 등이 일어남(문구는 중립). 예방접종·걸음마·첫 말은 마일스톤이라 100%` });
add({ id: 'M7a-T07', cat: '문장', title: '시대 정합(O03): 금지어 0, 지난 세상의 「포장된 이유식」·「대출」·「시중에 파는」 0, 시대 전용 9개 등장', steps: '수확 600판 문장 검색', expected: '0', verdict: (fc.BAN ?? 0) + (fc['PAST-WORD'] ?? 0) + (fc.O03 ?? 0) === 0 ? 'PASS' : 'FAIL', actual: `금지어 ${fc.BAN ?? 0}·시대 의심어 ${(fc['PAST-WORD'] ?? 0) + (fc.O03 ?? 0)}건(1회차 「포장된」 42/200판·「대출」 5판). 「남이 만든 것을 사다 먹이며 끼니를 해결했습니다」가 세 시대에 나옴` });
add({ id: 'M7a-T02', cat: '문장', title: '문장 정리(O07)와 새로 바뀐 문장 읽기', steps: '화면에 새로 뜬 문장 38종(1회차에 없던 것)을 전부 읽고 1회차 지적 문구를 검색', expected: '「학습 수업」·유치원 본문 「이름난 곳」·「태어난 첫해」 1세·주어 반복 0', verdict: (fc.O07 ?? 0) === 0 ? 'PASS' : 'FAIL', actual: `O07 위반 ${fc.O07 ?? 0}건(육아휴직 0세만, 「학습 수업」·「이름난 곳」 본문 0). 새 문장은 모두 합쇼체·담담. 기록: 「한 사람이 일을 쉬고… 한 사람의 벌이는 줄었습니다」 「한 사람」 반복, 「조용한 병실에서 아이는 덜 보채고…」 등은 자연스러움` });
add({ id: 'M7a-T08', cat: '문장', title: '어체 혼재(O01): 영유아 구간 0, 8세 이후 학창 이벤트·단계 줄은 아직 해라체(이행 기간 — 기록)', steps: '600판 0~7세 줄 + 정상 플레이 3판의 8세 줄', expected: '영유아 0, 8세 이후는 RECORD', verdict: 'RECORD', actual: `영유아 구간 혼재 0(T01). 8세 이후: 정상 플레이 3판 중 2판의 8세 첫 줄이 해라체(「…문득 떠올랐다.」「…섞여 있었다.」)라 7세 합쇼체 줄 바로 뒤에서 말투가 바뀜. 엔딩 출발선 문장(「…생을 마쳤다.」)도 해라체` });
add({ id: 'M7a-T09', cat: '문장', title: '낙인·고정관념(O05): 처리 확인', steps: '재력 갈림 선택지·결과 문장 읽기', expected: '(판단 필요)', verdict: 'RECORD', actual: '처리됨: 「또래들이 드는 것」 결과에 「몇 달 뒤 또래 사이의 유행이 바뀌었습니다」(행복 ▲ 한 칸으로) · 울며 매달림 「말로 풀어놓는 법도」 · 떼쓰기 「싫다는 말이 부쩍 늘었습니다」로 지식 ▲의 이유가 문장에 있음. 의도로 그대로: 「물려받은 것을 쓴다」 「…지워진 이름 자리를 한참 만져 보았습니다」(M-10), 방과 후 「혼자 집에서 기다리게 한다」의 집안 살림 ▲. 새 기록: 동생 맞이에서 sulk가 두 상태 모두 표시상 가장 불리하고(지식 ▲ 하나만 앞섬) grandma는 3.5%만 보임' });

// ---- W 수저 ----
const wui = rd(`${RP}wealth-ui.jsonl`).filter((r) => !r.err);
const by = {};
for (const r of wui) {
  const m = /^w-(.*)-(past|present|future)-t(\d)$/.exec(r.name);
  (by[`${m[1]}|${m[2]}`] ??= {})[m[3]] = r.dash.choices.map((c) => c.id).join(',');
}
const diff = [...new Set(Object.entries(by).filter(([k, t]) => !k.startsWith('infant-new-sibling-gc') && t['1'] !== t['5']).map(([k]) => k.split('|')[0]))];
add({ id: 'M7a-W01', cat: '수저', title: '수저 차이(G3·IN7): 같은 이벤트를 재력 1~5단계에서 열어 비교(200 저장)', steps: '코어로 만든 재력별 저장을 prod 화면에 열어 카드·선택지·영향 줄 읽기', expected: '재력 1·5단계 선택지 구성이 다른 이벤트 8개↑', verdict: 'PASS', actual: `구성이 다른 이벤트 ${diff.length}개: ${diff.join('·')}(1회차 12개와 같음). 이삿짐은 재력 4·5단계에서, 이웃의 항의는 5단계에서 안 나옴, 카드 본문은 재력과 무관하게 같음. 숨은 선택지를 알리는 문구·자물쇠 없음(조용함)`, shots: [shot('W-infant-early-lessons-present-t1'), shot('W-infant-early-lessons-present-t5'), shot('W-infant-moving-present-t3')] });
add({ id: 'M7a-W02', cat: '수저', title: '재력 조건 선택지·이벤트 조건이 실제 플레이에서 맞다(수확 600판 결정 카드 전수)', steps: '수확 결정 카드를 이벤트별 재력 조건과 대조', expected: '어긋남 0', verdict: A.wealthViol === 0 && !fc.WEALTH && !fc.IMPACT && !fc.CHOICES ? 'PASS' : 'FAIL', actual: `어긋남 ${A.wealthViol}·영향 줄 없는 선택지 ${fc.IMPACT ?? 0}·선택지 2~3개 밖 ${fc.CHOICES ?? 0}` });

// ---- 접근성·레이아웃 ----
const cardsL = rd(`${RP}audit-layout-cards.jsonl`);
const log2L = rd(`${RP}audit-layout-log2.jsonl`);
const endL = rd(`${RP}audit-layout-ending.jsonl`);
const sumL = (rs) => ({ n: rs.length, words: rs.reduce((a, r) => a + r.wb.wordsN, 0), broken: rs.reduce((a, r) => a + r.wb.broken.length, 0), over: rs.filter((r) => r.m.docOverflow > 0 || r.m.over.length || r.m.card.impactOut.length || r.m.textBoxes.length).length });
const s1 = sumL(cardsL), s2 = sumL(log2L), s3 = sumL(endL);
add({ id: 'M7a-L01', cat: '접근성', title: '영유아 결정 카드 17종(동생 맞이 조부모 플래그 변형 포함) × 뷰포트 11 × 글자 100·150·200%', steps: '카드별 저장을 prod에서 열고 문서 가로 넘침·요소 밖·낱말 끊김·영향 줄 칸을 잼', expected: '넘침 0·끊김 0', verdict: s1.over === 0 && s1.broken === 0 ? 'PASS' : 'FAIL', actual: `${s1.n}조합, 낱말 ${s1.words.toLocaleString()}개, 넘침 ${s1.over}·끊김 ${s1.broken}` });
add({ id: 'M7a-L02', cat: '접근성', title: '인생 기록(1세 한 해 세 줄 포함 13줄) × 11 × 3, 기록 영역을 위에서 아래까지 훑어 점검', steps: '8세 일시정지 저장(0세 두 줄·1세 세 줄 …)을 열고 0.7화면씩 스크롤하며 낱말 끊김을 모음', expected: '넘침 0·끊김 0', verdict: s2.over === 0 && s2.broken === 0 ? 'PASS' : 'FAIL', actual: `${s2.n}조합(스크롤 지점 ${log2L.reduce((a, r) => a + r.wb.scrolls, 0)}곳), 넘침 ${s2.over}·끊김 ${s2.broken}. 기록: 글자 150·200%에서 마지막 줄 하나가 기록 영역보다 큰 조합 ${log2L.filter((r) => r.logInner.lastTall).length}개(1회차 9) — 스크롤로만 끝까지 읽힘` });
add({ id: 'M7a-L03', cat: '접근성', title: '엔딩 16종(세 시대 × 재력 1~5단계 + 영유아 두 줄·세 줄 긴 연표) × 11 × 3', steps: '같은 방식', expected: '넘침 0·끊김 0', verdict: s3.over === 0 && s3.broken === 0 ? 'PASS' : 'FAIL', actual: `${s3.n}조합, 낱말 ${s3.words.toLocaleString()}개, 넘침 ${s3.over}·끊김 ${s3.broken}` });
const fa = rd(`${RP}audit-focus-a.jsonl`);
const fb = rd(`${RP}audit-focus-b.jsonl`);
const f399 = [...fa, ...fb].filter((r) => r.state !== 'card-infant-new-sibling-gc');
const fIss = [...fa, ...fb].reduce((a, r) => a + r.issues.length, 0);
add({ id: 'M7a-C10f', cat: '접근성', title: '1회차 FAIL C10f 재확인: 360×568·글자 200%의 「영어 유치원에 보낸다」 포커스 링 + 포커스 감사 1회차와 같은 범위(19상태 × 11 × 100·200%) 전체', steps: '같은 조건에서 Tab으로 choice-english에 닿아 링·하단 띠 위치를 5번 재고, 감사 전체(동생 맞이 조부모 변형 1상태 추가 = 420조합)', expected: '가림 0', verdict: fIss === 0 ? 'PASS' : 'FAIL', actual: `choice-english 링 상자 2.6~348.9px(띠 352px~) — 1회차 7~353.7(1.7px 겹침)에서 가용 영역 가운데로 옮겨져 겹침 0, 5번 모두 같음. 감사 ${[...fa, ...fb].length}조합(1회차 범위 ${f399.length}조합·요소 ${f399.reduce((a, r) => a + r.interactive, 0).toLocaleString()}개·포커스 ${f399.reduce((a, r) => a + r.fwd.length + r.bwd.length, 0).toLocaleString()}번) 가림 ${fIss}, 닿지 못한 요소 0`, shots: [shot('C10f-focus-ring-early-lessons-english-360x568-200')] });
const tallN = [...fa, ...fb].reduce((a, r) => a + (r.tallNotes ? r.tallNotes.length : 0), 0);
add({ id: 'M7a-C10t', cat: '접근성', title: 'CM10 예외 ②(링 상자가 가용 높이보다 큰 대상) 현황', steps: '같은 순회의 예외 ② 대상', expected: '(기록)', verdict: 'RECORD', actual: `1회차 범위 ${f399.filter((r) => r.tallNotes).length}조합(${f399.reduce((a, r) => a + (r.tallNotes ? r.tallNotes.length : 0), 0)}건)(1회차 14조합·24건)과 거의 같고, 조부모 변형 포함 ${[...fa, ...fb].filter((r) => r.tallNotes).length}조합(${tallN}건). 모두 320×568·360×568의 글자 200%` });
const px = JSON.parse(fs.readFileSync(path.join(OUT, `${RP}pixel.json`), 'utf8'));
add({ id: 'M7a-K02', cat: '접근성', title: '색 대비(렌더 픽셀 실측) 5모드 × 영유아 카드 3종·기록·엔딩 2종', steps: '라이트·다크·수동 다크·강제 색상(라이트·다크)에서 모든 글자 줄의 대비', expected: '≥ 4.5:1(큰 글자 3:1)', verdict: px.bad.length ? 'FAIL' : 'PASS', actual: `${px.all.length}조합 글자 줄 ${px.nRows.toLocaleString()}개, 최저 ${px.minOverall}:1, 미달 ${px.bad.length}` });
add({ id: 'M7a-X03', cat: '환경', title: 'WebKit·실기기·실제 스크린리더', steps: '-', expected: '-', verdict: 'SKIP', actual: '새 브라우저 바이너리를 받지 않음. Playwright Chromium 헤드리스만 사용' });
