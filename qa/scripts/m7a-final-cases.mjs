// QA-003 M7a 최종 집계: 수확·감사·플레이 결과 파일에서 숫자를 읽어 케이스 기록(cases.jsonl)에 덧붙인다. 판정은 이 스크립트가 아니라 QA가 정한 값을 적고, 숫자는 파일에서 읽는다.
// 사용: node qa/scripts/m7a-final-cases.mjs   (한 번만. 이미 있는 id는 건너뜀)
import fs from 'node:fs';
import path from 'node:path';
import { OUT } from './m7a-lib.mjs';
import { RP, SHOT_PREFIX } from './m7a-lib.mjs';

const rd = (f) => fs.readFileSync(path.join(OUT, RP + f), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const casesFile = path.join(OUT, RP + 'cases.jsonl');
const existing = new Set(rd('cases.jsonl').map((r) => r.id));
const add = (rec) => {
  if (existing.has(rec.id)) return;
  existing.add(rec.id);
  fs.appendFileSync(casesFile, JSON.stringify({ console: [], externalRequests: [], shots: [], at: new Date().toISOString(), ...rec }) + '\n');
  console.log(`[${rec.verdict}] ${rec.id}`);
};
const A = JSON.parse(fs.readFileSync(path.join(OUT, RP + 'analysis.json'), 'utf8'));
const A2 = JSON.parse(fs.readFileSync(path.join(OUT, RP + 'analysis2.json'), 'utf8'));
const era3 = ['past', 'present', 'future'];
const kr = { past: '지난', present: '지금', future: '다가올' };

// ---- N01: 6판 ----
const GAMES = [['past', 'past-t1-28', '재력 1단계(흙수저) 첫째 · 1배속'], ['present', 'present-t1-14', '재력 1단계 첫째 · 1배속'], ['future', 'future-t1-5', '재력 1단계 첫째 · 1배속'], ['past', 'past-t4-78', '재력 4단계(금수저) 첫째 · 2배속'], ['present', 'present-t5-70', '재력 5단계(다이아몬드수저) 첫째 · 2배속'], ['future', 'future-t5-78', '재력 5단계 첫째 · 2배속']];
for (const [era, tag, desc] of GAMES) {
  const s = JSON.parse(fs.readFileSync(path.join(OUT, RP + `play-${tag}.json`), 'utf8'));
  const h = s.final.history;
  const tl = s.ending.timeline;
  const infant = h.filter((x) => x.age <= 7);
  const ms = ['infant-vaccine', 'infant-first-steps', 'infant-first-word'].map((id) => h.find((x) => x.eventId === id)?.age ?? null);
  const byAge = {};
  for (const x of infant.filter((y) => y.kind !== 'stage')) byAge[x.age] = (byAge[x.age] ?? 0) + 1;
  const two = Object.entries(byAge).filter(([, n]) => n >= 2).map(([a]) => `${a}세`);
  const seven = h.filter((x) => x.age === 7 && x.eventId).map((x) => x.eventId).join(',') || '없음';
  const ok = s.errors.length === 0 && ms.every((a) => a !== null) && tl.length === h.length && s.console.length === 0 && s.externalRequests.length === 0;
  add({
    id: `M7a-N01-${tag}`,
    cat: '정상',
    title: `정상 플로우(${kr[era]} 세상, ${desc}): 첫 화면 → 룰렛 → 출생신고 → 0~7세를 느리게 읽으며 → 사망까지 → 엔딩 연표`,
    steps: `prod, 360×740 터치, 0~7세 ${tag.includes('t1') ? '1' : '2'}배속(8세부터 8배속)으로 직접 돌며 인생 기록 줄·결정 카드·가족 카드를 읽고 스크린샷`,
    expected: '마일스톤 3개 모두 1번, 한 해 두 줄 자연스러움, 결정 카드 영향 줄·안내 한 줄, 7세 학교 장면, 엔딩 연표에 영유아 줄 그대로, 콘솔·외부 요청 0',
    verdict: ok ? 'PASS' : 'FAIL',
    actual: `사망 ${s.final.age}세 · 마일스톤 나이 예방접종 ${ms[0]}·걸음마 ${ms[1]}·첫 말 ${ms[2]} · 한 해 두 줄 ${two.join(',')} · 0~7세 결정 카드 ${s.decisions.filter((d) => d.age <= 7).map((d) => d.key.split('@')[0]).join(',')} · 7세 장면 ${seven} · 저장 연표 ${h.length}줄 = 엔딩 연표 ${tl.length}줄(영유아 ${infant.length}줄 누락 0) · 콘솔 ${s.console.length}·외부 요청 ${s.externalRequests.length}`,
    shots: s.shots.slice(0, 6),
  });
}

// ---- N02 IN2 지표(수확 600판) ----
const e = A.eras;
add({
  id: 'M7a-N02', cat: '정상', title: 'IN2 실측(화면에서 읽은 600판, 시대별 200판): 0~7세 사건 없는 해·인생 기록 줄·선택지 수·한 해 두 줄',
  steps: '개발 서버 시간 배율 10·8배속으로 시드 1~200 × 세 시대를 실제 화면에서 0~8세까지 돌며 인생 기록 줄·결정 카드를 읽음(재력 1~5단계 섞임)',
  expected: '1차 목표: 빈 해 평균 ≤ 1.5·최대 ≤ 4, 기록 줄 평균 ≥ 9, 선택지 평균 ≥ 2.8 (2차: ≤ 1.0·≤ 3 / ≥ 10 / ≥ 3.0)',
  verdict: 'PASS',
  actual: era3.map((k) => `${kr[k]} ${e[k].n}판: 빈 해 ${e[k].blankYearsAvg.toFixed(2)}(최대 ${e[k].blankMax}) · 줄 ${e[k].infantLinesAvg.toFixed(2)} · 선택지 ${e[k].choicesAvg.toFixed(2)} · 한 해 두 줄이 나온 판 ${e[k].twoLineGames}/${e[k].n}`).join(' / ') + ` — 1차 목표 모두 충족, 2차 기준으로는 줄 평균 9.6~9.8(≥ 10에 못 미침)·선택지 평균 2.98~3.01(≥ 3.0 근접)`,
});
// ---- N03 마일스톤 ----
add({
  id: 'M7a-N03', cat: '정상', title: 'IN3 마일스톤: 예방접종(0세)·첫 걸음마(1~2세)·첫 말(1~3세)이 모든 판에서 각각 한 번 일어난다',
  steps: '수확 600판 + 정상 플레이 6판의 저장 seen·연표를 대조(그 전에 죽은 판 없음)',
  expected: '위반 0, 마일스톤 줄이 연표에 정확히 1번',
  verdict: 'PASS',
  actual: `600판 모두 3개 일어남(위반 0). 예방접종 0세 600/600 · 걸음마 1세 ${era3.reduce((a, k) => a + e[k].ms['infant-first-steps']['1'], 0)}·2세 ${era3.reduce((a, k) => a + e[k].ms['infant-first-steps']['2'], 0)} · 첫 말 1세 ${era3.reduce((a, k) => a + e[k].ms['infant-first-word']['1'], 0)}·2세 ${era3.reduce((a, k) => a + e[k].ms['infant-first-word']['2'], 0)}·3세 ${era3.reduce((a, k) => a + e[k].ms['infant-first-word']['3'], 0)}`,
});
// ---- N04 엔딩 연표 ----
add({ id: 'M7a-N04', cat: '정상', title: '엔딩 연표에 영유아 줄이 제대로 남는다(마일스톤·선택 결과·한 해 두 줄, 영유아 단계 묶음 아래)', steps: '정상 플레이 6판 엔딩의 연표 줄 전체를 저장 연표와 대조하고, 영유아 두 줄이 긴 엔딩 저장·영유아 사망 엔딩 6종을 화면에서 읽음', expected: '연표 줄 = 저장 줄, 나이 단조, 영유아 줄 누락 0', verdict: 'PASS', actual: '6판 모두 저장 연표(44~50줄) = 엔딩 연표, 영유아 줄 12~13줄 누락 0, 나이 단조. 「영유아 · 0~6세」 묶음 머리 아래에 마일스톤 줄(제목+본문)과 선택 줄(「선택: …」 굵게)이 순서대로. 7세 사건은 학창 묶음. N06·C23과 같은 결과', shots: ['qa/screenshots/003/M7a-N03-ending-timeline-infant-m360.png', 'qa/screenshots/003/M7a-N01-present-t1-14-ending-timeline.png'] });
// ---- N05 7세 학교 장면 ----
const sv = A.counts.seven;
add({
  id: 'M7a-N05', cat: '정상', title: '7세 학교 장면: 7세 해에 학교 전용 이벤트(school-)가 일어나고 인생 기록에 단계 진입 줄과 함께 남는다',
  steps: '수확 600판의 7세 줄을 센다',
  expected: '시대별로 7세 전용 4개(지난: 입학 준비물·첫 등교·첫 등굣길 / 지금·다가올: 입학 준비물·첫 등교·방과 후) 중 하나 이상이 일어남',
  verdict: 'PASS',
  actual: era3.map((k) => `${kr[k]}: ${Object.entries(sv[k]).map(([id, n]) => `${id.replace('infant-', '')} ${n}`).join(' · ')}`).join(' / ') + ` — 7세 해에 아무 사건이 없는 판 ${era3.reduce((a, k) => a + (e[k].n - Object.values(sv[k]).reduce((x, y) => x + y, 0)), 0)}판(7세 줄은 단계 진입 줄만)`,
});

// ---- T 문장 ----
add({ id: 'M7a-T01', cat: '문장', title: '어체: 화면에 뜬 새 이벤트 문장 54종은 모두 합쇼체·길이 한도(본문 74·결과 84·한 문장 52) 안·숫자·부호·이모지 0, 기존 이벤트 17종은 해라체 그대로', steps: '수확 600판의 인생 기록 줄(이벤트·선택별 고유 71종)과 결정 카드 본문을 문장 단위로 판정', expected: '새 이벤트 합쇼체 100%, 기존 이벤트 해라체(이행 기간)', verdict: 'PASS', actual: '위반 0 — 새 54종 합쇼체, 기존 17종(care·fever·stories·screen·village·grandparent-song·neglect-night·hovering·free-play) 해라체' });
add({ id: 'M7a-T03', cat: '문장', title: '동생·형제 정합(BR6·IN4): 동생 맞이는 첫째 판 2~4세에만, 동생의 장난감은 맞이 뒤에만, 형제를 따라 하는 아이는 위 형제가 있을 때만, 가족 카드와 맞음', steps: '수확 600판(첫째 277·둘째 이상 323)에서 이벤트 나이·가족 카드 동생 표시(나이·나이 차)·어머니 나이를 대조', expected: '모순 0', verdict: 'PASS', actual: `0건 — 첫째 ${era3.reduce((a, k) => a + e[k].firstBorn, 0)}판 중 동생 맞이 ${era3.reduce((a, k) => a + e[k].firstBornWithSibling, 0)}(지난 ${Math.round((100 * e.past.firstBornWithSibling) / e.past.firstBorn)}%·지금 ${Math.round((100 * e.present.firstBornWithSibling) / e.present.firstBorn)}%·다가올 ${Math.round((100 * e.future.firstBornWithSibling) / e.future.firstBorn)}%), 둘째 이상 323판의 동생 맞이 0, 장난감 ${era3.reduce((a, k) => a + e[k].toy, 0)}판(동생 없이 0), 어머니 나이 최대 ${A2.motherAtSib.max}세(≤ 45)` });
add({ id: 'M7a-T04', cat: '문장', title: '형편과 문구(CM9·IN8): 재력 4·5단계(여유 있는·아주 넉넉한 가정) 판에서 결과 문장이 「살림은 빠듯해졌습니다」로 끝나지 않는다', steps: '수확 600판에서 「빠듯」이 든 선택 결과를 재력별로 센다. 재현: 현재 세상 시드 197(재력 5·셋째) 3세 「유치원 고르기」→「집에서 더 돌본다」, 시드 111(재력 5) 0세 「일을 쉬는 한 해」→「한 사람이 일을 쉬고 돌본다」', expected: '0건', verdict: 'FAIL', severity: '중간', actual: `「집안 살림은 빠듯해졌습니다」(infant-parental-leave/one) 32건 중 재력 4·5단계 9건, 「살림은 빠듯해졌습니다」(infant-kindergarten/home) 11건 중 재력 4·5단계 4건 — 인생 기록 첫 줄이 「아주 넉넉한 가정에서 태어났습니다」인 판에서 나옴. 두 선택지는 재력 조건이 없다`, shots: ['qa/screenshots/003/M7a-F1a-log-result.png', 'qa/screenshots/003/M7a-F1b-log-result.png', 'qa/screenshots/003/M7a-F1a-log-birth-line.png'] });
add({ id: 'M7a-T05', cat: '문장', title: '주거와 문구(CM9): 출생신고 「사는 집: 자가」인 판에서 「빚을 내어 작은 집을 산다」가 나오지 않는다', steps: '수확 600판의 「이삿짐을 싸던 날」 카드를 출생 주거별로 센다. 재현: 지난 세상 시드 94(자가·재력 3·첫째) 6세 → 「빚을 내어 작은 집을 산다」, 지금 세상 시드 80(자가·재력 3) 5세', expected: '자가 판에는 「집을 산다」 선택지가 보이지 않음(또는 문구가 맞음)', verdict: 'FAIL', severity: '낮음~중간', actual: '「이삿짐을 싸던 날」 159장 중 자가 85장(53%). 「빚을 내어 작은 집을 산다」(buy)는 19장에서 보였고 15장(79%)이 자가 판 — 결과 「대출을 얻어 작은 집을 마련했습니다」. 지난 세상 1958년생 자가 판에서도 「대출」이 나옴', shots: ['qa/screenshots/003/M7a-F2a-birth-report-housing.png', 'qa/screenshots/003/M7a-F2a-card.png', 'qa/screenshots/003/M7a-F2a-log-result.png', 'qa/screenshots/003/M7a-F2b-card.png'] });
add({ id: 'M7a-T06', cat: '문장', title: '교육방식과 문구: 방임 판(출생신고 「방임」)에서 돌봄이 두터운 장면', steps: '수확 600판 중 방임 72판의 영유아 줄에서 돌봄 장면을 센다', expected: '(판단 필요) 기록', verdict: 'RECORD', actual: `방임 72판에서 백일(27판, 「이웃과 친척이 앞날을 빌어 주었습니다」)·건강검진(12)·입원 곁 지키기(19)·첫 생일(12)·학교 준비물 의논(22) 등. 「불 꺼진 집」(방임 전용, 48판)과 같은 판에 나올 수 있음. 예방접종은 마일스톤이라 방임 판에도 100% 나옴` });
add({ id: 'M7a-T07', cat: '문장', title: '시대 정합(IN6): 시대 금지어 0, 시대 전용 장면 9개가 모두 나온다, 지난 세상의 시대 의심어', steps: '수확 600판 문장에서 금지어(지난: 육아휴직·어린이집·영어 유치원·유아 영어·키즈카페·문화센터·산후조리원·층간소음·돌봄 도우미 / 지금·다가올: 탁아소·젖동냥·아랫목)와 의심어(포장된·대출·학원 …) 검색', expected: '금지어 0, 시대 전용 각 3개 이상 등장', verdict: 'RECORD', actual: `금지어 0, 시대 전용 9개 등장(지난: 겨울밤의 아랫목 107·장날의 손 86·처음 걷는 등굣길 32 / 지금: 일을 쉬는 한 해 61·어린이집 대기 25·이웃의 항의 35 / 다가올: 곁을 지키는 기계 65·말을 받아 주는 인형 75·나갈 수 없는 한낮 91). 의심어: 지난 세상 「포장된 이유식」 42/200판(1950~89년생), 「대출을 얻어 작은 집을 마련」 5판` });
add({ id: 'M7a-T08', cat: '문장', title: '같은 해 어체 섞임(이행 기간 — 기록)', steps: '수확 600판에서 한 해에 두 줄 이상인 해의 합쇼체·해라체 혼재를 센다', expected: '(이행 기간이라 RECORD)', verdict: 'RECORD', actual: `두 줄 이상인 해 중 ${A2.mixYears}해가 섞임(해라체 줄은 infant-fever 72·care 65·village 44·stories 41·hovering 40·free-play 22·screen 22·neglect-night 15·grandparent-song 7). 7세는 단계 진입 줄 「학교에 들어갈 나이가 되었다.」(해라체)가 새 합쇼체 7세 사건 앞에 붙는 판이 ${A2.sevenStageMix}/600. 엔딩 출발선 문장도 해라체(「…생을 마쳤다.」)` });
add({ id: 'M7a-T09', cat: '문장', title: '낙인·고정관념 관점(M-8·M-10: reviewer 확인 항목)', steps: '새 이벤트의 재력 갈림 선택지·결과 문장을 읽음', expected: '(판단 필요) 기록', verdict: 'RECORD', actual: '① 학교 준비물 「물려받은 것을 쓴다」 결과 「…지워진 이름 자리를 한참 만져 보았습니다」(행복▼)와 재력 4단계 이상에만 보이는 「또래들이 드는 것으로 맞춘다」 「…어깨를 폈습니다」(관계▲▲)가 짝으로 읽혀 형편 차이가 위축·자신감으로 대비됨 ② 방과 후 「혼자 집에서 기다리게 한다」에 「집안 살림 ▲」가 붙고 재력 1·2단계는 이 선택지와 「학교 안 돌봄」 둘뿐 ③ 「서운해서 울며 어른에게 매달린다」(지식▲)·「동생 손의 장난감을 가져가 숨긴다」(지식▲)처럼 표기와 문장이 어색한 곳' });
add({ id: 'M7a-T02', cat: '문장', title: '문장 품질 읽기(영유아 장면 30개 전부 + 선택지 결과 전부): 어색한 문장·본문과 선택지 불일치', steps: '이벤트 JSON 30개(서술 18·선택 12)와 화면에 뜬 모습을 전부 읽음', expected: '(판단 필요) 기록', verdict: 'RECORD', actual: '「학습 수업」(취학 전의 시간표 본문: 겹말) · 「시중에 파는 이유식을 쓴다」(이유식을 「쓴다」) · 「유치원 고르기」 본문이 「이름난 곳」을 말하는데 재력 1~3단계에는 그 선택지가 없음 · 「일을 쉬는 한 해」 본문 「태어난 첫해」가 1세에도 일어남(4/61) · 「아이는 … 아이는」 주어 반복 몇 곳 · 첫 말이 3세인 판 57%(1세 17%·2세 26%)이고 그중 37판은 같은 해 「묻기 시작한 아이」(이름과 까닭을 물음)가 이어짐' });

// ---- W 수저 차이 ----
const wui = rd('wealth-ui.jsonl');
const by = {};
for (const r of wui) {
  const m = /^w-(.*)-(past|present|future)-t(\d)$/.exec(r.name);
  (by[`${m[1]}|${m[2]}`] ??= {})[m[3]] = r.dash.choices.map((c) => c.id).join(',');
}
const diffEv = Object.entries(by).filter(([, t]) => t['1'] !== t['5']).map(([k]) => k.split('|')[0]);
const uniqDiff = [...new Set(diffEv)];
add({
  id: 'M7a-W01', cat: '수저', title: '수저 차이(G3·IN7): 같은 이벤트를 재력 1~5단계에서 열어 보이는 선택지 구성·영향 줄·카드 문장을 비교(16개 이벤트 × 가능한 시대 × 5단계 = 188 저장)',
  steps: '코어로 만든 재력별 저장(같은 이벤트·같은 나이, 난수만 이벤트가 나오게 조정)을 prod 화면에 열어 카드를 읽고 스크린샷(재력 1·5단계)',
  expected: '재력 장치 이벤트 8개 이상에서 재력 1~2단계와 4~5단계의 선택지 구성이 다름, 담담한 문장',
  verdict: 'PASS',
  actual: `보이는 선택지 구성이 재력 1단계와 5단계에서 다른 이벤트 ${uniqDiff.length}개: ${uniqDiff.join('·')} (선택지 수 1개 차이 10개, 이벤트 자체가 안 나옴 2개: 이웃의 항의는 재력 5단계, 이삿짐을 싸던 날은 4·5단계). 같은 선택지의 영향 줄이 재력 1·2단계에서 달라지는 것 3개(한밤의 열 「바로 병원으로」·일을 쉬는 한 해 「한 사람이」·병실 「한 사람이」: 1·2단계 「집안 살림 ▼▼」, 3단계~ 「▼」; 한밤의 열은 이 차이만 있음). 카드 본문은 재력과 무관하게 같다. 숨은 선택지를 알리는 문구·자물쇠 표시 없음`,
  shots: ['qa/screenshots/003/M7a-W-infant-early-lessons-present-t1.png', 'qa/screenshots/003/M7a-W-infant-early-lessons-present-t5.png', 'qa/screenshots/003/M7a-W-infant-kindergarten-present-t1.png', 'qa/screenshots/003/M7a-W-infant-kindergarten-present-t5.png', 'qa/screenshots/003/M7a-W-infant-first-birthday-present-t1.png', 'qa/screenshots/003/M7a-W-infant-first-birthday-present-t5.png', 'qa/screenshots/003/M7a-W-school-supplies-present-t1.png', 'qa/screenshots/003/M7a-W-school-supplies-present-t5.png'],
});
add({ id: 'M7a-W02', cat: '수저', title: '재력 조건 선택지·이벤트 조건이 실제 플레이에서 맞다(수확 600판의 결정 카드 전수)', steps: '수확 600판의 영유아 결정 카드 1,796장을 이벤트별 재력 조건(care/home ≥ 4 …·noise ≤ 4·moving ≤ 3)과 대조', expected: '어긋남 0', verdict: 'PASS', actual: '어긋남 0(보여야 할 선택지가 빠지거나 숨어야 할 선택지가 보인 카드 0, 재력 조건 밖에서 나온 이벤트 0). 영향 줄이 없는 선택지 0·선택지 수 2~3개 밖 0' });
add({ id: 'M7a-W03', cat: '수저', title: '시대 전용 영유아 장면 9개(IN6)와 지난 세상 금지어: 모두 일어나고 금지어 0', steps: '수확 600판', expected: '각 시대 전용 3개 이상, 금지어 0', verdict: 'PASS', actual: '9개 모두 등장(T07 참고), 금지어 0' });

// ---- 레이아웃·접근성 ----
const rows1 = rd('audit-layout.jsonl').filter((r) => r.state.startsWith('card-'));
const rowsL = rd('audit-layout-log2.jsonl');
const rowsE = rd('audit-layout-ending.jsonl');
const sumL = (rs) => ({ n: rs.length, words: rs.reduce((a, r) => a + r.wb.wordsN, 0), broken: rs.reduce((a, r) => a + r.wb.broken.length, 0), over: rs.filter((r) => r.m.docOverflow > 0 || r.m.over.length || r.m.card.impactOut.length || r.m.textBoxes.length).length });
const s1 = sumL(rows1), sL = sumL(rowsL), sE = sumL(rowsE);
add({ id: 'M7a-L01', cat: '접근성', title: '영유아 결정 카드 16종(가장 긴 문장 포함) × 뷰포트 11종 × 글자 100·150·200%: 가로 넘침 0·낱말 끊김 0·영향 줄이 칸 안', steps: '카드별 저장(재력이 높아 선택지가 모두 보임)을 prod에서 열고 글자 크기를 바꿔 문서 가로 넘침·요소 밖·낱말 끊김(글자 하나씩 줄 나눔 측정)·h1·영향 줄 칸을 잼', expected: '넘침 0·끊김 0', verdict: s1.over === 0 && s1.broken === 0 ? 'PASS' : 'FAIL', actual: `${s1.n}조합, 낱말 ${s1.words.toLocaleString()}개, 넘침 ${s1.over}·끊김 ${s1.broken}`, shots: ['qa/screenshots/003/M7a-L-card-parental-leave-m320-200.png', 'qa/screenshots/003/M7a-L-card-early-lessons-m320-200.png', 'qa/screenshots/003/M7a-L-card-daycare-wait-m360-150.png', 'qa/screenshots/003/M7a-L-card-after-hours-m320-150.png', 'qa/screenshots/003/M7a-L-card-hospital-stay-m375-200.png'] });
add({ id: 'M7a-L02', cat: '접근성', title: '인생 기록 한 해 두 줄(영유아 0~7세 가장 긴 줄 13개, 한 해 두 줄 5해) × 뷰포트 11 × 글자 3: 넘침 0·낱말 끊김 0·기록 영역을 위에서 아래까지 훑어 점검', steps: '8세 일시정지 저장을 열고 기록 영역을 0.7화면씩 스크롤하며 낱말 끊김을 모으고 마지막 줄 위치를 잼', expected: '넘침 0·끊김 0', verdict: sL.over === 0 && sL.broken === 0 ? 'PASS' : 'FAIL', actual: `${sL.n}조합(스크롤 지점 ${rowsL.reduce((a, r) => a + r.wb.scrolls, 0)}곳), 낱말 최대 ${sL.words.toLocaleString()}, 넘침 ${sL.over}·끊김 ${sL.broken}. 기록: 글자 200%에서 마지막 줄 하나(선택 결과 줄, 536~588px)가 기록 영역(314~486px)보다 큰 조합 ${rowsL.filter((r) => r.logInner.lastTall).length}개 — 스크롤로만 끝까지 읽힘`, shots: ['qa/screenshots/003/M7a-N02-log-two-lines-top-m360.png', 'qa/screenshots/003/M7a-N02-log-two-lines-bottom-m360.png', 'qa/screenshots/003/M7a-N02-log-two-lines-top-d1280.png', 'qa/screenshots/003/M7a-N02-log-two-lines-top-m320-200.png', 'qa/screenshots/003/M7a-N02-log-two-lines-bottom-m320-200.png'] });
add({ id: 'M7a-L03', cat: '접근성', title: '엔딩 연표(영유아 한 해 두 줄 포함)·출발선 문장: 엔딩 16종(세 시대 × 재력 1~5단계 + 영유아 두 줄 긴 연표) × 뷰포트 11 × 글자 3', steps: '엔딩 저장을 prod에서 열어 같은 방식으로 잼', expected: '넘침 0·끊김 0', verdict: sE.over === 0 && sE.broken === 0 ? 'PASS' : 'FAIL', actual: `${sE.n}조합, 낱말 ${sE.words.toLocaleString()}개, 넘침 ${sE.over}·끊김 ${sE.broken}(h1 「…의 인생」은 낱말마다 한 줄)`, shots: ['qa/screenshots/003/M7a-N03-ending-timeline-infant-m360.png', 'qa/screenshots/003/M7a-N03-ending-timeline-infant-m320-200.png', 'qa/screenshots/003/M7a-N03-ending-journey-m320-200.png', 'qa/screenshots/003/M7a-L-ending-journey-past-t1-m320-200.png', 'qa/screenshots/003/M7a-L-ending-journey-future-t5-m320-200.png'] });
add({ id: 'M7a-L04', cat: '접근성', title: '레이아웃 측정기 자체 시험: 글 상자를 96px로 좁히고 낱말을 아무 데서나 끊게·선택지를 520px로 키운 변조 CSS를 넣으면 잡힌다', steps: 'MUT_CSS로 카드·기록·엔딩 3상태 × 11뷰포트', expected: '변조 조합 전부 위반, 진짜는 0', verdict: 'PASS', actual: '변조 33/33조합을 위반으로 잡음(낱말 끊김 33, 문서 가로 넘침 5), 진짜 1,089조합은 0' });
const f1 = rd('audit-focus.jsonl');
const f2 = rd('audit-focus-cards2.jsonl');
const fAll = [...f1, ...f2];
const fInter = fAll.reduce((a, r) => a + r.interactive, 0);
add({ id: 'M7a-C10f', cat: '접근성', title: 'CM10 포커스 가림: 카드 16종·기록·엔딩 × 뷰포트 11 × 글자 100·200%에서 Tab·Shift+Tab 전체 순회 중 고정 띠에 가려지는 포커스 링', steps: '키보드로 앞으로·뒤로 한 바퀴 돌며 매번 링 상자(윤곽선 + 오프셋)와 고정 요소의 겹침·화면 밖·중심점 가림을 잼. 재현: 영어 유치원(재력 4·5단계 5~6세 「취학 전의 시간표」) 카드를 360×568·글자 200%에서 Tab으로 「영어 유치원에 보낸다」에 닿기', expected: '가림 0(링 상자가 가용 높이보다 큰 대상은 예외 ②)', verdict: 'FAIL', severity: '낮음', actual: `${fAll.length}조합·상호작용 요소 ${fInter.toLocaleString()}개·포커스 ${fAll.reduce((a, r) => a + r.fwd.length + r.bwd.length, 0).toLocaleString()}번 중 1조합 — 360×568·글자 200%의 choice-english: 선택지 높이 336px, 링 상자 347px가 가용 높이 352px에 들어가는데(예외 ② 아님) 스크롤 뒤 링 아래 1.7px가 하단 띠(352px~)에 가려지고 Shift+Tab에서는 링 위 2px가 화면 위로 나감. 버튼 자체는 모두 보임. 3번 재현. 닿지 못한 요소 0`, shots: ['qa/screenshots/003/M7a-C10f-focus-ring-early-lessons-english-360x568-200.png'] });
const tallN = fAll.reduce((a, r) => a + (r.tallNotes ? r.tallNotes.length : 0), 0);
const tallC = fAll.filter((r) => r.tallNotes).length;
add({ id: 'M7a-C10t', cat: '접근성', title: 'CM10 예외 ②(링 상자가 가용 높이보다 큰 선택지) 현황 — M5-O06 계승', steps: '같은 순회에서 예외 ②로 분류된 대상', expected: '(기록)', verdict: 'RECORD', actual: `${tallC}조합(${tallN}건)이 모두 320×568·360×568의 글자 200%. 링 위쪽 변은 화면 안, 아래쪽 일부가 하단 띠 아래. M5 때 8조합이었으나 영유아 카드(선택지 3개·영향 항목 4~5개)가 늘어 증가` });
add({ id: 'M7a-C10m', cat: '접근성', title: '포커스 측정기 자체 시험(M4 변조 CSS: scroll-padding 0·고정 높이 변수 0)', steps: '카드 2종 × 11뷰포트 × 글자 2 = 42조합', expected: '변조가 가림으로 잡힘', verdict: 'PASS', actual: '변조 35/42조합에서 가림을 잡음(고정 띠가 없는 넓은 뷰포트 7조합은 가릴 것이 없음)' });
const px = JSON.parse(fs.readFileSync(path.join(OUT, RP + 'pixel.json'), 'utf8'));
add({ id: 'M7a-K02', cat: '접근성', title: '색 대비(렌더 픽셀 실측): 라이트·다크(시스템)·수동 다크·강제 색상(라이트/다크) 5모드 × 영유아 카드 3종·기록·엔딩 2종', steps: '360폭 터치, 뷰포트를 문서 높이로 키워 한 장을 찍고 모든 보이는 글자 줄의 글자색·바탕색 대비를 잼', expected: '모든 줄 ≥ 4.5:1(큰 글자 3:1)', verdict: px.bad.length ? 'FAIL' : 'PASS', actual: `${px.all.length}조합 글자 줄 ${px.nRows.toLocaleString()}개 측정, 전체 최소 ${px.minOverall}:1, 미달 ${px.bad.length}`, shots: ['qa/screenshots/003/M7a-K01-dark-card-infant-kindergarten.png', 'qa/screenshots/003/M7a-K01-dark-log2.png', 'qa/screenshots/003/M7a-K01-dark-ending-long.png', 'qa/screenshots/003/M7a-K01-forced-card-infant-kindergarten.png', 'qa/screenshots/003/M7a-K01-forced-log2.png'] });

// ---- 회귀·환경 요약 ----
add({ id: 'M7a-X01', cat: '환경', title: '콘솔·외부 요청 집계', steps: '정상 플레이 6판·수확 600판·재력 비교 188장·감사·공격·접근성·회귀 전 케이스의 콘솔 오류·페이지 오류·외부 요청', expected: '외부 요청 0, 정상 플레이 콘솔 0', verdict: 'PASS', actual: '외부 요청 0건. 콘솔·페이지 오류 0건(수확 600판 오류 0, 재력 비교 188장 오류 0, 정상 플레이 6판 0). 기록 1건: A05 오프라인 새로고침의 net::ERR_INTERNET_DISCONNECTED(서비스 워커 없음 — M5-O09와 같음)' });
add({ id: 'M7a-X03', cat: '환경', title: 'WebKit·실기기·실제 스크린리더', steps: '-', expected: '-', verdict: 'SKIP', actual: '지시대로 새 브라우저 바이너리를 받지 않음. Playwright Chromium 헤드리스만 사용' });
