/**
 * SPEC-004 GM3 시안 생성기 (designer 2026-10-27 · r2 게이트 ③ 형진 님 답 반영 · r3 형진 님 답 2차 반영(벤치마킹 `docs/design/benchmark-004.md`) · **r4 2026-10-27 형진 님 답 3차 반영** — 바탕 종이색 토큰·제목 크게·설명 두 줄·「한 판 약 30분」·캐러셀 대신 세대 그래프·누리집 하단). 정적 HTML 5장을 docs/design/mockups/gm3/에 만든다.
 * 실행: node node_modules/vite-node/vite-node.mjs scripts/design/buildGm3Mockups.mjs   (mockLib가 faceLayers.ts를 읽어 vite-node가 필요하다)
 *   (글꼴 조각 fonts/*.woff2·noto-sans-kr.css는 먼저 `node scripts/design/buildGm3Fonts.mjs`로 만든다 — 첫 화면·룰렛·출생신고 시안이 읽는다. 없으면 대체 글꼴로 보인다)
 *   title-004.html     첫 화면 세대 선택 — title-005.html(SPEC-005 r3 시안)을 읽어 머리(일러스트 없음·워드마크 84/64px·「한 판 약 30분」·설명 두 줄)·큰 슬롯(한 열 8줄 목록, 상자 없이 줄 + 줄마다 작은 소개)·**오른쪽 열 = 고른 세대를 따라 바뀌는 「한 해에 태어난 아기 수」 그래프 하나(r4 — 20장 캐러셀 없음)**·시도 선택·내 출신 시도 설정·**새 하단(r4)**을 바꾼다(한 장면).
 *                      ?gen=<id>|random(기본 random) · lived=a,b · region=pick · pick=<시도> · origin=set · open=origin · fold=open · state=new|saved · theme=dark · font=system(대체 글꼴로 — CLS 비교) · alt=cream(비교용: r3까지의 바탕 #f6f3ec — 기본은 r4 종이색 #f9f7f2, 형진 님 답 3차 1)
 *   roulette-004.html  세대 뽑기 단계 → **2릴(지역 · 수저)**. ?state=draw|spinning|result · gen=millennial(기본)|boomer(1940~1980 인구 비례) · region=picked · from=random(랜덤 세대 경로 — 머리에 「랜덤 세대에서 뽑힌」) · theme=dark · motion=reduce · font=system
 *                      r3: 연도 릴·연도 표 없음(연도는 보이지 않게 GS7 가중으로 뽑혀 출생신고에서 드러난다). 지역·수저 표는 **고른 세대 전체 기준**(연도 가중으로 섞은 값, 도는 동안 불변) — genMixture(). 값은 docs/data/dc2-dc7-births-regions.json(1981~2020 시도별 출생 비율·전국 출생아 수)·
 *                      dc7-province-population.json stairWeights(1940~1980 도별 인구 비례 계단식)·generations.md 3-2 wealthWeights(N29 연도별 설계값)에서 계산한다(가짜 값 0).
 *   birth-004.html     출생신고 — 연도가 처음 드러나는 자리(「세대」 칸 「밀레니얼 세대 · 1988년생」 + 첫 문장 + 출생 연월 + 각주). birth.html의 지난 세상 템플릿 위에. ?theme=dark · font=system
 *   dashboard-004.html 인생 기록의 연표 줄 4종 + 자산 카드 당시 화폐. ?state=then|now|projection|none
 *   ending-004.html    세대 표기·전망 구간·최종 순자산 전환·비교 카드. ?state=future|2010
 * 글자는 copy.md 16절의 확정 문구(GM3_TEXT) — 구현이 상수를 만들면 import로 되돌린다. 연표 문장은 설계 문서의 예시 뜻만 썼다(사실 수치 0, 실명 0). 금액은 economy-model.md 16-8 ② 예시 배율(2000년 0.5416 · 2010년 0.7407)로 계산한 값.
 * 외부 요청 0, 가짜 데이터(시안 표식).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { ROOT, esc, face, fitPair, gradeChip, headerLogo, icon, meter, page, reelSpoon } from './mockLib.mjs';

const OUT = `${ROOT}docs/design/mockups/gm3/`;
mkdirSync(OUT, { recursive: true });
/** DC2·DC7 자료(실제 값): 전국 출생아 수(births_national, 1970~2020 actual) · 시도별 출생 비율(birth_share_sido, 1981~2020 calc, 그해의 시·도 구분) */
const BR = JSON.parse(readFileSync(`${ROOT}docs/data/dc2-dc7-births-regions.json`, 'utf-8'));
/** 1940~1980 도별 인구 비례 계단식 가중(DC7 마스터 결정 5 — DC7-pop 2026-10-27 수집 완료, 11개 도 × 1940~1980). r3부터 실제 값(「예시」 표식 없음) */
const STAIR_FILE = `${ROOT}docs/data/dc7-province-population.json`;
if (!existsSync(STAIR_FILE)) throw new Error('dc7-province-population.json이 없다(1940~1980 지역 가중)');
const STAIR = JSON.parse(readFileSync(STAIR_FILE, 'utf-8')).stairWeights;

// ---------- 확정 문구 (copy.md 16절과 같은 글자) ----------
const GM3_TEXT = {
  tagLead: '다른 세대, 다른 삶, ',
  tagKeep: '같은 대한민국',
  question: '어느 세대로 살아보고 싶으세요?',
  lead: '다른 세대의 시간을 살아 보며 서로의 사정을 이해해 봐요.',
  /* r3 체험 한 줄 — 형진 님 답 2차 3 「② 세대를 바꿔 가며 그 시절의 한 사람으로 살아 봐요.」(copy.md 16-10 후보 ②, 16-11 확정). r2의 ①은 대체됨 */
  span: '세대를 바꿔 가며 그 시절의 한 사람으로 살아 봐요.',
  /* N30은 2026-10-27 종결(이름 「수저 게임」 그대로) — r2의 이름 비교 상태(?name=)는 지웠다 */
  randomTitle: '랜덤 세대',
  randomDesc: '일곱 세대 가운데 하나를 같은 확률로 뽑아요',
  randomMeta: { from: 1940, to: 2020 }, // 랜덤 줄의 「1940~2020년생 · 올해 6~86세」 — 일곱 세대 전체 범위(사실)
  listLabel: '태어날 세대',
  lived: '살아봄',
  foldSummary: '세대 범위는 자료마다 조금씩 달라요',
  /* r4(형진 님 답 3차 2 「설명 줄은 두 줄」 = r3 제안 9): GS1 안내 한 줄 「다른 세대의 시간을 …」이 목록 위에서 빠지고 접이식 본문의 첫 문장이 된다 — 머리에는 부제 + 체험 한 줄 둘만 남는다 */
  foldBody: '다른 세대의 시간을 살아 보며 서로의 사정을 이해해 봐요. 이 게임은 위 범위를 써요. 1960~1963년생은 베이비붐 세대와 86세대 어느 쪽으로도 살아볼 수 있어요. 출생 연도는 고른 세대의 범위 안에서 룰렛이 뽑아요.',
  /* r4 「한 판 약 30분」 — 제목 가까이 작게(벤치마킹 Trust 「playing time: 30 min」, 형진 님 답 3차 2). 구현은 `한 판 ${LIFE_LENGTH_TEXT[settings.lifeLength].title}`(인생 길이 분절과 같은 값) */
  heroTime: (len) => `한 판 ${len}`,
  lifeLengthShort: '약 30분',
  /* r4 세대 그래프(캐러셀 대신 — 형진 님 답 3차 2 + 마스터 해석 「왼쪽에서 고른 세대에 맞춰 바뀌는 그래프 하나」) — 글자는 copy.md 16-12 */
  chart: {
    title: '한 해에 태어난 아기 수',
    /* r5(형진 님 답 4차 3): 출생아 수 그래프는 캐러셀의 **첫 장**(슬라이드 꼴 — 표제어는 다른 장처럼 물음, 공식 통계명 자리에 세대 줄, 큰 값 = 한 해 평균) */
    insight: '고른 세대는 한 해에 몇 명이 태어났을까?',
    official: '출생아 수(1970~2020년)',
    bigLabel: '한 해 평균',
    anyGen: '어느 세대든',
    none: '연간 통계 없음',
    since1970: '1970년부터 자료가 있어요',
    noData: '자료 없음',
    kAge: '올해 나이',
    kAvg: '한 해 평균 출생아',
    kLife: '태어난 해의 기대수명',
    tableSummary: '표로 보기',
    /* 아래 넷은 {자리} 틀 — 그리기 함수가 Node와 브라우저에서 같은 글자로 채운다(JSON으로 넘기므로 함수가 아니라 글자) */
    tableCaption: '{who} 구간의 해마다 출생아 수',
    thYear: '연도',
    thBirths: '출생아 수',
    src: '출처: 국가데이터처 인구동향조사 출생아 <span class="keep-phrase">수(1970~2020년)와</span> 생명표 <span class="keep-phrase">기대수명(1970~2024년),</span> <span class="nowrap">2026-10-15</span> 조회. 1969년까지는 공식 연간 출생 통계가 없어 비워 두었어요.', // 괄호 묶음은 keep-phrase(구현 Glue ⑤) — 묶음은 320 · 200%(288px)에 들어가는 길이만
    labelAll: '1940년부터 2020년까지 한 해에 태어난 아기 수 그래프. 공식 연간 통계는 1970년부터 있어요. 1970~2020년은 한 해 평균 {avg} 명, 가장 많은 해는 {peakY}년 {peakV} 명, 2020년은 {lastV} 명이에요.',
    labelGen: '1940년부터 2020년까지 한 해에 태어난 아기 수 그래프. {name} {from}~{to}년생 구간을 강조했어요. {body}',
    labelGenData: '그 구간은 한 해 평균 {avg} 명, 가장 많은 해는 {peakY}년 {peakV} 명이에요.',
    labelGenNone: '그 구간은 공식 연간 출생 통계가 없어요.',
  },
  /* r4 하단(형진 님 답 3차 4 — 「80억분의 1」 하단은 **구조만** 참고, 문장·그림·연락처를 옮기지 않았다). 자리표시자 셋은 형진 님 답(2026-10-27)으로 채웠다: 운영자 cottonchild · 문의 kottonchild@gmail.com(mailto만) · 15세 이상 권장 */
  foot: {
    whatH: '이 게임은',
    what: '태어날 집도, 땅도, 해도 고를 수 없는 한국 인생 시뮬레이션이에요. 룰렛이 정한 집안 형편과 시대 속에서 한 사람의 삶을 해마다 따라가며, 출발선의 차이가 선택과 결과에 어떻게 닿는지 느껴 봐요.',
    whyH: '왜 만들었나',
    why: '「80억분의 1」을 한국 사정에 맞게 다시 만들어 보고 싶었어요. 부모와 자녀, 이웃 세대가 서로의 시절을 살아 보며 이야기 나누고 서로를 이해하길 바라며 만들었어요. 「80억분의 1」과는 관계없는 개인 프로젝트예요.',
    realH: '무엇이 실제 자료인가',
    real: (orgs) => `통계 그래프와 태어날 때의 바탕 수치(출생 월, 체중, 부모님 나이 등)는 ${orgs}의 공개 자료에서 옮겼어요. 수저 단계가 나올 확률, 선택지의 효과 같은 게임 속 확률과 수치는 게임을 위해 정한 설계값이에요. 통계가 아니에요. 사연과 인물은 만들어 낸 이야기예요.`,
    heavy: (gentle, help, age) => `아픈 일, 이별, 병, 죽음처럼 무거운 일도 일어나요. 자극적으로 그리지 않고 짧게 적어요. 「${gentle}」를 켜면 그런 장면의 글만 가려요. 힘든 마음을 혼자 견디지 않아도 돼요. ${help}로 전화할 수 있어요. ${age}.`,
    ai: '한 사람이 기획하고 AI(Anthropic의 Claude)와 함께 만든 시뮬레이션이에요. 숫자는 공개 통계와 게임의 설계값이고, 게임을 하는 동안 AI가 글을 새로 만들지는 않아요.',
    beta: '아직 다듬는 중이에요. 이상한 곳이나 바라는 점을 알려 주시면 살펴보고 고칠게요.',
    feedback: '의견 보내기',
    news: '새 소식',
    family: '가족과 함께라면 부모님이나 자녀의 세대를 골라 살아 보고, 그 시절 이야기를 나눠 보세요.',
    linkIntro: '소개',
    linkPrivacy: '개인정보 처리방침',
    linkTerms: '이용 안내',
    linkFeedback: '의견 보내기',
    contactLead: '그 밖의 문의',
    operatorLead: '운영자',
    operator: 'cottonchild',
    contact: 'kottonchild@gmail.com',
    age: '15세 이상 권장',
    gentleName: '무거운 장면 가리기',
    help: '자살예방 상담전화 109(24시간)',
    statsLead: '통계 출처: ',
    statsTail: '(통계표 이름과 기준 연도는 그래프와 통계 카드마다 적혀 있어요)',
    orgs: ['국가데이터처', '행정안전부', '교육부', '기상청'],
    version: 'v0.2.1 (a1b2c3d)',
  },
  regionTitle: '태어나는 시도',
  regionRoulette: '룰렛에 맡기기',
  regionPick: '직접 고르기',
  regionHint: '룰렛은 그해 <span class="keep-phrase">시·도별</span> 출생아 비율대로 돌아요.', // r2: 320 · 200%에서 「시·도별」이 가운뎃점에서 끊겨 keep-phrase
  regionPickHint: '지금의 시·도 이름으로 골라요. 출생신고에는 그 해의 행정구역 이름이 적혀요.',
  regionNone: (names) => `이 세대가 태어난 해에는 ${names}가 없었어요.`,
  originChip: (s) => `내 출신 시도 · ${s}`,
  originTitle: '내가 실제로 태어난 시도',
  originNone: '밝히지 않음',
  originClear: '지우기',
  originDesc: '이 기기에만 남고 밖으로 나가지 않아요. 인생이 끝난 뒤 「같은 사건, 다른 <span class="nowrap">자리」를</span> 견주는 데만 써요.', // r3: Noto Sans KR에서 320 · 200%에 「자리」를」이 닫는 괄호 뒤에서 끊겨 nowrap(구현은 Glue ⑤ 괄호 묶음)
  drawTitle: '어느 세대로 살아볼지 뽑는 중',
  drawNote: '일곱 세대 가운데 하나를 같은 확률로 뽑아요.',
  drawOdds: '일곱 세대가 같은 확률이에요(인구 비례가 아님).',
  /* r3 룰렛(형진 님 답 2차 2): 연도 릴을 뺀다 → 제목·안내는 SPEC-003 글자로 돌아간다(「해」 없음). 표는 「고른 세대 전체 기준」(연도 가중으로 섞은 값)이라 도는 동안 바뀌지 않는다 */
  spinTitle: '태어날 집과 땅을 고르는 중',
  spinNote: '어느 집, 어느 땅에 태어날지는 고를 수 없어요. 확률대로 돌아가요.',
  spinNotePicked: '태어나는 시도는 직접 골랐어요. 어느 집에 태어날지는 확률대로 돌아가요.',
  doneTitle: '태어날 곳이 정해졌습니다',
  genAmong: (from, to) => `${from}~${to}년생 가운데`,
  fromRandom: '랜덤 세대에서 뽑힌',
  regionReelTitle: '태어나는 지역',
  wealthTitle: '수저',
  oddsHead: (gen) => `${gen} 전체 기준`,
  /* 지역 표 주석: 무엇을 어떻게 섞었는지 한 문장 + 자료 갈래 한 문장(필요할 때) + 도중에 생긴 시·도 한 문장(있을 때) */
  regionNoteBirths: '해마다 그해 출생아 수만큼 무게를 두어 섞은 <span class="keep-phrase">시·도별</span> 출생아 비율이에요. 이름은 줄여 적었어요.',
  regionNoteUniform: '출생 통계가 없는 해라 해마다 같은 무게로 섞은 <span class="keep-phrase">시·도별</span> 비율이에요. 이름은 줄여 적었어요.',
  regionNotePop: '1981년 전은 출생 자료가 없어 도별 인구 비례로 셌어요.',
  regionNoteLater: (names) => `세대 범위 도중에 생긴 <span class="nowrap">${names}의</span> 몫은 생긴 뒤 해의 것만 들어 있어요.`, // 「의」는 받침과 무관해 이름이 바뀌어도 조사가 틀리지 않는다. 「광주·대전」은 가운뎃점에서 끊기지 않게 nowrap(1280 · 200% 측정)
  wealthNoteGen: (from, to) => `<span class="nowrap">${from}~${to}년생의</span> 설계값을 해마다 섞은 값이에요. 게임의 <span class="keep-phrase">설계값이에요(통계가</span> 아님).`, // 괄호 앞 끊김(320 · 200%) — 구현은 Glue ⑤ 괄호 묶음
  pickedRegion: '직접 고른 시도',
  /* r3 출생신고(연도가 처음 드러나는 자리 — 마스터 해석): 「세대」 칸에 GD2 꼴 「{세대} · {연도}년생」, 각주 한 문장(GS7 가중) */
  birthGenLabel: '세대',
  birthGen: (gen, year) => `${gen} · ${year}년생`,
  birthYearNote: '태어난 해는 고른 세대의 범위 안에서 그해 출생아 수에 비례해 정해졌어요. 룰렛에는 보이지 않고 이 서류에서 처음 적혀요.',
  afterNote: '돌림판은 연출이고, 결과는 돌기 전에 정해진 값이에요.',
  skip: '건너뛰기',
  seeReport: '출생신고 보기',
  tl: { year: '그해', bg: '배경', local: '지역 소식', proj: '전망' },
  projIntro: '여기서부터는 실제가 아니라 공식 전망을 바탕으로 한 이야기입니다.',
  scenario: (s) => `${s} 시나리오`,
  tagThen: '당시 화폐',
  tagNow: '2026년 가치',
  toNow: '지금 가치로 보기',
  toThen: '당시 화폐로 보기',
  basisThen: (y) => `${y}년의 물가로 환산한 금액입니다.`,
  basisNow: '2026년 가치로 환산한 금액입니다.',
  basisNone: '그해의 물가 자료가 없어 2026년 가치로 보입니다.',
  viewingThen: '(지금은 당시 화폐로 보는 중)',
  viewingNow: '(지금은 2026년 가치로 보는 중)',
  helpMoney: '자산은 2025년까지는 그해의 화폐로, 2026년부터는 2026년 가치로 보입니다. 「지금 가치로 보기」를 누르면 2026년 가치로 바꿔 볼 수 있습니다.',
  endingGen: (gen, year) => `${gen} · ${year}년생`,
  endingBorn: (place) => `${place}에서 태어남`,
  endingProj: (s) => `2026년부터는 공식 전망(${s} 시나리오)을 바탕으로 한 이야기입니다.`,
  projSplit: '2026년부터는 공식 전망',
  compareTitle: '같은 사건, 다른 자리',
  compareClose: '같은 일도 어디에서 지내는지에 따라 다르게 전해졌습니다.',
  compareSame: '당신의 출신 시도와 같은 곳에서 태어났습니다.',
};

// ---------- 세대 7종 (generations.md 2절·3-2·5절 — 이름·범위는 형진 님 표, 소개는 사건 셋 병렬, weights = NR1 설계값) ----------
// r2: 산업화 소개의 「한국전쟁」 → 「6·25전쟁」(DC1 결정 · 게이트 ③ 답 4). 86 소개는 그대로.
const NOW = 2026;
const W_PAST = [40, 32, 20, 7, 1];
const W_X = [33, 31, 24, 10, 2];
const W_NOW = [25, 30, 28, 14, 3];
const GENS = [
  { id: 'industrial', name: '산업화 세대 · 전후 세대', short: '산업화·전후 세대', from: 1940, to: 1954, basis: 'uniform', weights: W_PAST, intro: '6·25전쟁, 전후 복구, 산업화의 시기를 지나온 세대' },
  { id: 'boomer', name: '베이비붐 세대', from: 1955, to: 1963, basis: 'uniform', weights: W_PAST, intro: '과밀 학급, 고교 평준화, 산업화의 시기를 지나온 세대' },
  { id: 'g86', name: '86세대', from: 1960, to: 1969, basis: 'uniform', weights: W_PAST, intro: '직선제 개헌, 3저 호황, 신도시의 시기를 지나온 세대' },
  { id: 'genx', name: 'X세대', from: 1970, to: 1980, basis: 'births', weights: W_X, intro: '노래방, PC통신, 외환위기의 시기를 지나온 세대' },
  { id: 'millennial', name: '밀레니얼 세대', from: 1981, to: 1996, basis: 'births', weights: W_NOW, intro: '개인 홈페이지, 스마트폰, 글로벌 금융위기의 시기를 지나온 세대' },
  { id: 'genz', name: 'Z세대', from: 1997, to: 2012, basis: 'births', weights: W_NOW, intro: '스마트폰, 숏폼 영상, 코로나19의 시기를 지나온 세대' },
  { id: 'alpha', name: '알파 세대', from: 2013, to: 2020, basis: 'births', weights: W_NOW, intro: '대화형 인공지능, 학령인구 감소, 고교학점제의 시기에 자라는 세대', note: '2026년부터는 공식 전망을 바탕으로 한 이야기예요' },
];
const SIDO_NOW = ['서울', '부산', '대구', '인천', '대전', '울산', '세종', '경기', '강원', '충북', '충남', '전북', '전남광주', '경북', '경남', '제주'];
const FORMAL = { 세종: '세종특별자치시', 울산: '울산광역시' };
/** 안정 키 17(RG5) · 줄임 이름(3-2 규칙) · JSON의 현행 이름 — 표의 줄 순서는 이 순서로 고정 */
const SIDO = [
  ['seoul', '서울', '서울특별시'], ['busan', '부산', '부산광역시'], ['daegu', '대구', '대구광역시'], ['incheon', '인천', '인천광역시'], ['gwangju', '광주', '광주광역시'], ['daejeon', '대전', '대전광역시'], ['ulsan', '울산', '울산광역시'], ['sejong', '세종', '세종특별자치시'],
  ['gyeonggi', '경기', '경기도'], ['gangwon', '강원', '강원특별자치도'], ['chungbuk', '충북', '충청북도'], ['chungnam', '충남', '충청남도'], ['jeonbuk', '전북', '전북특별자치도'], ['jeonnam', '전남', '전라남도'], ['gyeongbuk', '경북', '경상북도'], ['gyeongnam', '경남', '경상남도'], ['jeju', '제주', '제주특별자치도'],
];

// ---------- r2 확률 계산(가짜 값 0 — developer가 같은 식으로 GM4에 옮긴다) ----------
/** 그 해 시·도별 출생 비율(%, 1981~2020 calc) — 없으면 null */
const shareOf = (year, key) => {
  const name = SIDO.find((s) => s[0] === key)[2];
  const r = BR.find((x) => x.series === 'birth_share_sido' && x.year === year && x.region === name);
  return r && typeof r.value === 'number' ? r.value : null;
};
/** 1940~1980 도별 인구 비례 계단식 가중(%) — 수집 중 파일이 있으면 그 값 */
const stairOf = (year, key) => {
  const r = STAIR.find((x) => x.year === year && x.region === key);
  return r && typeof r.share === 'number' ? r.share : null;
};
const regionShare = (year, key) => (year >= 1981 ? shareOf(year, key) : stairOf(year, key));
/** 그 세대 범위에서 한 번이라도 값이 있는 시·도(표의 고정 줄) */
const regionRowsFor = (g) => SIDO.filter(([key]) => { for (let y = g.from; y <= g.to; y++) if (regionShare(y, key) !== null) return true; return false; });
/** 그 해에 값이 있는 시·도(릴 칸) */
const regionsIn = (year) => SIDO.filter(([key]) => regionShare(year, key) !== null);
/** 전국 출생아 수(actual) — 없으면 null */
const birthsOf = (year) => { const r = BR.find((x) => x.series === 'births_national' && x.year === year); return r && typeof r.value === 'number' && r.status === 'actual' ? r.value : null; };
/** 연도 확률(그 세대 범위 안 합 100, GS7): births면 출생아 수 비례, uniform이면 균등 */
function yearOddsFor(g) {
  const years = Array.from({ length: g.to - g.from + 1 }, (_, i) => g.from + i);
  if (g.basis === 'uniform') return years.map((y) => ({ year: y, births: null, p: 100 / years.length }));
  const b = years.map((y) => birthsOf(y));
  if (b.some((v) => v === null)) throw new Error(`${g.id}: 출생아 수가 없는 해가 있다`);
  const sum = b.reduce((s, v) => s + v, 0);
  return years.map((y, i) => ({ year: y, births: b[i], p: (b[i] / sum) * 100 }));
}
/** 합 100 정수 보정(largestRemainder) — 내림 뒤 나머지 큰 순으로 1씩 */
function largestRemainder(raw, total = 100) {
  const fl = raw.map(Math.floor);
  let left = total - fl.reduce((s, v) => s + v, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; k < left; k++) fl[order[k][1]]++;
  return fl;
}
/** 수저 비율의 연도 변화(N29): 세대별 wealthWeights를 각 세대 범위의 가운데 해에 닻으로 두고 닻 사이는 직선, 첫 닻 앞·마지막 닻 뒤는 그 닻 값, 표시는 합 100 정수 */
const W_ANCHORS = GENS.map((g) => ({ y: (g.from + g.to) / 2, w: g.weights })).sort((a, b) => a.y - b.y);
function wealthFor(year) {
  if (year <= W_ANCHORS[0].y) return [...W_ANCHORS[0].w];
  const last = W_ANCHORS[W_ANCHORS.length - 1];
  if (year >= last.y) return [...last.w];
  let i = 0;
  while (!(W_ANCHORS[i].y <= year && year <= W_ANCHORS[i + 1].y)) i++;
  const a = W_ANCHORS[i], b = W_ANCHORS[i + 1];
  const t = (year - a.y) / (b.y - a.y);
  return largestRemainder(a.w.map((v, k) => v * (1 - t) + b.w[k] * t));
}
for (const g of GENS) { const s = wealthFor((g.from + g.to) / 2).reduce((a, b) => a + b, 0); if (s !== 100) throw new Error(`wealthFor 합 ${s}`); }
if (wealthFor(1988).join() !== W_NOW.join() || wealthFor(1947).join() !== W_PAST.join()) throw new Error('wealthFor 닻 값이 어긋난다');

const GM3_SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<symbol id="i-year" viewBox="0 0 24 24"><rect x="4" y="6" width="16" height="14" rx="2"/><path d="M4 10.5h16M8.5 4v4M15.5 4v4"/><circle cx="12" cy="15.5" r="1.7" fill="currentColor" stroke="none"/></symbol>
<symbol id="i-paper" viewBox="0 0 24 24"><path d="M5 4.5h14v15H5z"/><path d="M8.5 8.5h7M8.5 12h7M8.5 15.5h4"/></symbol>
<symbol id="i-talk" viewBox="0 0 24 24"><path d="M3.5 5h11v8H8.5l-3 2.5V13h-2z"/><path d="M15.5 9.5H20v7h-1.8v2.5L15.4 16.5H13v-2"/></symbol>
<symbol id="i-proj" viewBox="0 0 24 24"><path d="M3 17l5-6 4 3 4-5"/><path d="M16 9h3.5v3.5" stroke-dasharray="2.5 1.8"/><path d="M3 20h18" stroke-dasharray="2 2"/></symbol>
<symbol id="i-shuffle" viewBox="0 0 24 24"><path d="M4 7h3.5l7 10H20"/><path d="M4 17h3.5l2-2.9M13.5 9.9l1-1.4H20"/><path d="M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5"/></symbol>
</defs></svg>`;
const TL_ICON = { year: 'year', bg: 'paper', local: 'talk', proj: 'proj' };
const projChip = () => `<span class="chip chip--proj">${icon('proj')}전망</span>`;

function must(html, from, to, label) {
  if (!html.includes(from)) throw new Error(`title-005.html에서 못 찾음: ${label}`);
  return html.replace(from, to);
}

// ============================================================ ① 첫 화면 ============================================================
/** r3 한 줄 = 라디오 + 표식 + [이름(+「살아봄」) ········ 「{from}~{to}년생 · 올해 {나이}」] / [작은 글씨 소개 한 줄](형진 님 답 2차 1 — 1차 시안처럼 줄마다 작은 설명).
 *  이름 14px 700 · 메타 12px · 소개 12px(알파는 소개 뒤에 보조 문장). 접근 가능한 이름 = 이름 + 메타(aria-labelledby), 소개는 aria-describedby(한 줄의 글자가 그대로 설명).
 *  「랜덤 세대」도 같은 묶음의 첫 줄(라디오, 기본 선택 — 답 3). 메타는 일곱 세대 전체 범위(1940~2020년생 · 올해 6~86세, 사실) */
function genRow(g, { selected = false, random = false } = {}) {
  const from = random ? GM3_TEXT.randomMeta.from : g.from, to = random ? GM3_TEXT.randomMeta.to : g.to;
  const id = random ? 'random' : g.id;
  const name = random ? GM3_TEXT.randomTitle : g.name;
  const intro = random ? GM3_TEXT.randomDesc : g.intro;
  const note = !random && g.note ? g.note : '';
  // r5(형진 님 답 4차 1): 「랜덤 세대」 줄에는 메타(「1940~2020년생 · 올해 6~86세」)가 없다 — 접근 가능한 이름도 이름만
  const meta = random ? '' : `<span class="gen-row__meta" id="gen-meta-${id}"><span class="nowrap">${from}~${to}년생</span> · <span class="nowrap">올해 ${NOW - to}~${NOW - from}세</span></span>`;
  return `<label class="gen-row${selected ? ' is-selected' : ''}">
  <input type="radio" name="gen" value="${id}"${selected ? ' checked' : ''} aria-labelledby="gen-name-${id}${random ? '' : ` gen-meta-${id}`}" aria-describedby="gen-desc-${id}">
  <span class="gen-row__mark">${icon('check')}</span>
  <span class="gen-row__body">
    <span class="gen-row__line"><span class="gen-row__name" id="gen-name-${id}">${name}</span>${random ? '' : `<span class="gen-row__lived" hidden>${icon('check')}${GM3_TEXT.lived}</span>`}${meta}</span>
    <span class="gen-row__desc" id="gen-desc-${id}">${intro}${note ? `<span class="gen-row__note"> ${note}</span>` : ''}</span>
  </span>
  <span class="sr-only sel">${selected ? '선택됨' : ''}</span>
</label>`;
}
/** r4: 안내 한 줄(`.slot__lead`)은 접이식 안으로(형진 님 답 3차 2). 목록 아래 `#gen-chart-slot`은 좁은 화면(< 960px)에서 세대 그래프가 들어오는 자리(한 노드를 미디어 질의로 옮긴다 — 넓은 화면은 오른쪽 열) */
function genSlot() {
  return `<fieldset class="slot slot--big slot--gen8"><legend class="group-title">${GM3_TEXT.question}</legend>
      <div class="gen-list" role="radiogroup" aria-label="${GM3_TEXT.listLabel}">
      ${genRow(null, { random: true, selected: true })}
      ${GENS.map((g) => genRow(g)).join('\n      ')}
      </div>
      <details class="disclosure slot__fold"><summary>${GM3_TEXT.foldSummary}</summary><p>${GM3_TEXT.foldBody}</p></details></fieldset>`;
}
// r5: r4의 #gen-chart-slot(좁은 화면에서 그래프를 목록 아래로 옮기던 자리)은 없다 — 캐러셀(고정 높이, R-200)을 목록과 설정 사이에 두면 짧은 장 아래 빈 띠(≈ 430px)가 본문 한가운데 생긴다. 좁은 화면은 r3 자리(본문 뒤, 하단 앞)로

// ============================================================ ①-1 r4 세대 그래프 (캐러셀 대신 — 형진 님 답 3차 2, 마스터 해석) ============================================================
/** 값은 저장소의 실제 값만: 전국 출생아 수 1970~2020(DC2 `births_national` actual = koreaStats `births`와 같은 표) · 기대수명 1970~2024(koreaStats `life-expectancy`). 1940~1969는 공식 연간 출생 통계가 없어 **비워 둔다**(DC2 3-2절 — 1943·44는 한반도 전체, 1946~48·1960은 범위·정의가 달라 가중 근거로 못 쓴다 → 그림에도 올리지 않는다. 「추정」 표시 규칙(N1·M12)은 추정값을 보일 때의 규칙이라 여기서는 「연간 통계 없음」 글자로 둔다) */
const KS = JSON.parse(readFileSync(`${ROOT}src/data/koreaStats.json`, 'utf-8'));
const LIFE = KS.indicators.find((i) => i.id === 'life-expectancy').series.map((p) => [p.year, p.value]);
const BIRTHS_1970 = BR.filter((x) => x.series === 'births_national' && x.status === 'actual' && x.year >= 1970 && x.year <= 2020).map((x) => [x.year, x.value]);
if (BIRTHS_1970.length !== 51) throw new Error(`출생아 수 1970~2020이 51개가 아니다: ${BIRTHS_1970.length}`);
for (const y of [1943, 1944, 1946, 1947, 1948, 1960]) if (BIRTHS_1970.some((p) => p[0] === y)) throw new Error('1970년 전 값이 그래프 데이터에 들어갔다');
/** 그래프 데이터(브라우저에도 그대로 박힌다 — 세대를 바꿀 때 같은 함수가 다시 그린다) */
const CHART_DATA = {
  now: NOW,
  gens: GENS.map((g) => ({ id: g.id, name: g.name, from: g.from, to: g.to })),
  births: BIRTHS_1970,
  life: LIFE,
  geom: { L: 46, R: 392, T: 16, B: 172, Y0: 1940, Y1: 2020, YMAX: 1200000 }, // 플롯 상자 — 축 글자 왼쪽 차선 46, 위 눈금(120만)은 최댓값(1971년 102만) 위
  text: GM3_TEXT.chart,
};
/** 그리기 함수(ES5 — Node가 첫 상태를 그리고, 같은 글자가 브라우저에서 라디오가 바뀔 때 다시 그린다. 구현은 React 부품 `GenChart`로 옮긴다 — diff-004 D4-61).
 *  규칙(dataviz 스킬 + app-screens §6): 한 계열 · 강조 = 고른 세대 구간만 쪽빛 2.5px + 옅은 쪽빛 띠, 나머지는 보조 1.5px · 격자 3줄 + 기준선 · y 눈금 0/40만/80만/120만(최댓값 위) · x 눈금 5개(끝 둘은 안쪽으로) · 직접 라벨은 구간 최댓값 하나 · 범례 없음(한 계열) · 점선 격자 없음 · 글자는 잉크 토큰(계열 색을 글자에 쓰지 않는다) */
const GEN_CHART_FN = `function genChartRender(D, id) {
  var G = D.geom, L = G.L, R = G.R, T = G.T, B = G.B, Y0 = G.Y0, Y1 = G.Y1, YMAX = G.YMAX, X = D.text;
  var step = (R - L) / (Y1 - Y0);
  var x = function (y) { return L + (y - Y0) * step; };
  var yv = function (v) { return B - (v / YMAX) * (B - T); };
  var r1 = function (n) { return Math.round(n * 10) / 10; };
  var man = function (v) { return Math.round(v / 10000).toLocaleString('ko-KR') + '만'; };
  var fmt = function (tpl, o) { return tpl.replace(/\\{(\\w+)\\}/g, function (m, k) { return k in o ? String(o[k]) : m; }); };
  var g = null; D.gens.forEach(function (q) { if (q.id === id) g = q; });
  var all = !g, from = g ? g.from : Y0, to = g ? g.to : Y1, name = g ? g.name : X.anyGen;
  var inSpan = function (y) { return y >= from && y <= to; };
  var rows = D.births.filter(function (p) { return inSpan(p[0]); });
  var avg = rows.length ? rows.reduce(function (s, p) { return s + p[1]; }, 0) / rows.length : null;
  var peak = rows.length ? rows.reduce(function (m, p) { return p[1] > m[1] ? p : m; }) : null;
  var leRows = D.life.filter(function (p) { return inSpan(p[0]); });
  var leA = leRows.length ? leRows[0] : null, leB = leRows.length ? leRows[leRows.length - 1] : null;
  var age = (D.now - to) + '~' + (D.now - from) + '세';
  var s = '';
  [400000, 800000, 1200000].forEach(function (v) { s += '<line class="grid" x1="' + L + '" x2="' + R + '" y1="' + r1(yv(v)) + '" y2="' + r1(yv(v)) + '"/>'; });
  if (!all) s += '<rect class="gchart__band" x="' + r1(x(from) - step / 2) + '" y="' + (T - 6) + '" width="' + r1((to - from + 1) * step) + '" height="' + (B - T + 6) + '"/>';
  [400000, 800000, 1200000].forEach(function (v) { s += '<text class="gchart__tick" x="' + (L - 6) + '" y="' + r1(yv(v) + 4) + '" text-anchor="end">' + man(v) + '</text>'; });
  s += '<text class="gchart__tick" x="' + (L - 6) + '" y="' + (B + 4) + '" text-anchor="end">0</text>';
  s += '<line class="axis" x1="' + L + '" x2="' + R + '" y1="' + B + '" y2="' + B + '"/>';
  [1940, 1960, 1980, 2000, 2020].forEach(function (y) { var a = y === Y0 ? 'start' : y === Y1 ? 'end' : 'middle'; s += '<text class="gchart__tick" x="' + r1(x(y)) + '" y="' + (B + 16) + '" text-anchor="' + a + '">' + y + '</text>'; });
  s += '<text class="gchart__none" x="' + r1(x(1954.5)) + '" y="' + (B - 10) + '" text-anchor="middle">' + X.none + '</text>';
  var pts = function (arr) { return arr.map(function (p) { return r1(x(p[0])) + ',' + r1(yv(p[1])); }).join(' '); };
  s += '<polyline class="gchart__line gchart__line--rest" points="' + pts(D.births) + '"/>';
  if (rows.length) s += '<polyline class="gchart__line gchart__line--span" points="' + pts(rows) + '"/>';
  if (peak) { var px = r1(x(peak[0])), py = r1(yv(peak[1])); var lx = Math.min(Math.max(px, L + 48), R - 48); s += '<circle class="gchart__dot" cx="' + px + '" cy="' + py + '" r="4"/><text class="gchart__peak" x="' + lx + '" y="' + r1(py - 9) + '" text-anchor="middle">' + peak[0] + '년 ' + man(peak[1]) + '</text>'; }
  s += '<rect class="gchart__hit" x="' + L + '" y="' + T + '" width="' + (R - L) + '" height="' + (B - T) + '"/>';
  s += '<line class="gchart__cursor" x1="0" x2="0" y1="' + (T - 2) + '" y2="' + B + '" hidden="hidden"/><circle class="gchart__cursor-dot" r="4" hidden="hidden"/><text class="gchart__cursor-text" y="' + (T - 4) + '" text-anchor="middle" hidden="hidden"></text>';
  var dash = '<span class="sr-only">' + X.noData + '</span><span class="gen-chart__dash" aria-hidden="true">—</span>';
  var cell = function (dt, dd, sub) { return '<div><dt>' + dt + '</dt><dd><span class="gen-chart__val">' + dd + '</span>' + (sub ? '<small>' + sub + '</small>' : '') + '</dd></div>'; };
  var nums = cell(X.kAge, age, '') + cell(X.kLife, leA ? leA[1].toFixed(1) + '~' + leB[1].toFixed(1) + '세' : dash, leA ? leA[0] + '·' + leB[0] + '년생' : X.since1970);
  /* r5: 큰 값 = 한 해 평균(슬라이드의 .slide__value 자리). 자료 없는 세대는 「—」 + 이유 */
  var big = avg === null ? '<span class="gen-chart__dash" aria-hidden="true">—</span><span class="sr-only">' + X.noData + '</span><small class="slide__unit"></small>' : '<span>' + man(avg) + '</span><small class="slide__unit">명</small>';
  var bigSub = X.bigLabel + (avg === null ? ' · ' + X.since1970 : ' · ' + rows[0][0] + '~' + rows[rows.length - 1][0] + '년');
  var live = (g ? '<b>' + name + '</b>' : '<b>' + X.anyGen + '</b>') + ' · ' + from + '~' + to + '년생';
  var label = all ? fmt(X.labelAll, { avg: man(avg), peakY: peak[0], peakV: man(peak[1]), lastV: man(D.births[D.births.length - 1][1]) }) : fmt(X.labelGen, { name: name, from: from, to: to, body: peak ? fmt(X.labelGenData, { avg: man(avg), peakY: peak[0], peakV: man(peak[1]) }) : X.labelGenNone });
  var table = '';
  if (from <= 1969) table += '<tr><th scope="row">' + Math.max(from, Y0) + '~' + Math.min(to, 1969) + '년</th><td>' + dash + '</td></tr>';
  rows.forEach(function (p) { table += '<tr><th scope="row">' + p[0] + '년</th><td>' + p[1].toLocaleString('ko-KR') + '명</td></tr>'; });
  return { svg: s, nums: nums, big: big, bigSub: bigSub, live: live, label: label, table: table, caption: fmt(X.tableCaption, { who: g ? name + ' ' + from + '~' + to + '년생' : '1940~2020년생' }) };
}`;
// eslint-disable-next-line no-new-func
const renderGenChart = new Function(`${GEN_CHART_FN}; return genChartRender;`)();
const CHART_VIEWBOX = '0 0 400 196';
/** 그래프 카드(첫 상태 = 「랜덤 세대」 — 띠 없이 전체) */
function genChartCard(id = 'random') {
  const X = GM3_TEXT.chart;
  const o = renderGenChart(CHART_DATA, id);
  return `<section class="card gen-chart" aria-labelledby="gen-chart-title" data-gen="${id}">
      <div class="gen-chart__head"><h2 class="gen-chart__title" id="gen-chart-title">${X.title}</h2><p class="gen-chart__gen" aria-live="polite">${o.live}</p></div>
      <svg class="chart gchart gen-chart__plot" viewBox="${CHART_VIEWBOX}" role="img" aria-label="${esc(o.label)}" focusable="false">${o.svg}</svg>
      <dl class="gen-chart__nums">${o.nums}</dl>
      <details class="disclosure gen-chart__table"><summary>${X.tableSummary}</summary><table><caption class="sr-only gen-chart__caption">${o.caption}</caption><thead><tr><th scope="col">${X.thYear}</th><th scope="col">${X.thBirths}</th></tr></thead><tbody class="gen-chart__tbody">${o.table}</tbody></table></details>
      <p class="gen-chart__src">${X.src}</p>
    </section>`;
}
const genChartAside = () => `<aside class="title__side title__side--r4">\n    ${genChartCard('random')}\n  </aside>\n`; // r4 꼴(기록용 — r5는 아래 genChartSlide)
/** r5(형진 님 답 4차 3): 같은 그래프를 캐러셀 **첫 장**(슬라이드 꼴)으로 — 표제어(물음) · 세대 줄(공식 통계명 자리, aria-live) · 큰 값 = 한 해 평균 · 그림 · 숫자 둘 · 표로 보기 · 출처. 세대 라디오를 바꾸면 캐러셀이 이 장으로 돌아온다(TITLE_STATE_JS) */
function genChartSlide(id = 'random', total = 21) {
  const X = GM3_TEXT.chart;
  const o = renderGenChart(CHART_DATA, id);
  return `    <article class="slide slide--gen is-active" data-slide-id="gen-births" aria-roledescription="슬라이드" aria-label="1/${total} ${X.insight}, ${X.official}">
      <h3 class="slide__insight">${X.insight}</h3>
      <p class="slide__official gen-chart__gen" aria-live="polite">${o.live}</p>
      <p class="slide__value gen-chart__big" style="--value-em:2.6;--unit-chars:1">${o.big}</p>
      <p class="gen-chart__bigsub">${o.bigSub}</p>
      <svg class="chart gchart gen-chart__plot" viewBox="${CHART_VIEWBOX}" role="img" aria-label="${esc(o.label)}" focusable="false">${o.svg}</svg>
      <dl class="gen-chart__nums gen-chart__nums--2">${o.nums}</dl>
      <details class="disclosure gen-chart__table"><summary>${X.tableSummary}</summary><table><caption class="sr-only gen-chart__caption">${o.caption}</caption><thead><tr><th scope="col">${X.thYear}</th><th scope="col">${X.thBirths}</th></tr></thead><tbody class="gen-chart__tbody">${o.table}</tbody></table></details>
      <p class="slide__meta">${X.src}</p>
    </article>
`;
}
for (const g of GENS) { const o = renderGenChart(CHART_DATA, g.id); if (!o.label.includes(g.name)) throw new Error(`${g.id}: 그래프 읽기 이름에 세대 이름이 없다`); }
{ const o = renderGenChart(CHART_DATA, 'genx'); if (!o.big.includes('89만') || !o.nums.includes('62.3~66.1세') || !o.svg.includes('1971년 102만')) throw new Error(`X세대 그래프 값 검산 실패: ${o.big} ${o.nums}`); } // 1970~1980 합 9,844,474 ÷ 11 = 894,952 → 89만 · 최대 1971년 1,024,773 → 102만

// ============================================================ ①-2 r4 누리집 하단 (형진 님 답 3차 4 — 구조만 참고, 자리표시자는 형진 님 답으로 채움) ============================================================
/** 상자 안에 상자를 넣지 않고 가는 줄과 작은 글씨로만 나눈다. (a) 세 칸 → (b) 무거운 일 → (c) AI 고지 → (d) 의견 + 단추 둘 → (f) 가족 한 줄 → (e) 아주 작은 링크 줄 → (g) 출처·운영자·버전. 순서는 마스터 초안의 (e)(f)를 바꿨다 — 법률 꼬리(링크 줄·출처)는 맨 아래에 모은다 */
function footerHtml(credit) {
  const F = GM3_TEXT.foot;
  const orgs = F.orgs.join(', ');
  return `<footer class="title-foot title-foot--r4">
    <div class="foot-cols">
      <section><h2>${F.whatH}</h2><p>${F.what}</p></section>
      <section><h2>${F.whyH}</h2><p>${F.why}</p></section>
      <section><h2>${F.realH}</h2><p>${F.real(orgs)}</p></section>
    </div>
    <p class="foot-p">${F.heavy(F.gentleName, F.help, F.age)}</p>
    <p class="foot-p">${F.ai}</p>
    <div class="foot-beta"><p class="foot-p">${F.beta}</p><span class="foot-beta__actions"><a class="btn btn--secondary btn--sm" href="#" data-panel="feedback">${F.feedback}</a><a class="btn btn--secondary btn--sm" href="#" data-panel="news">${F.news}</a></span></div>
    <p class="foot-p foot-family">${F.family}</p>
    <p class="foot-small foot-links"><a href="#" data-panel="intro">${F.linkIntro}</a> <span aria-hidden="true">·</span> <a href="#" data-panel="privacy">${F.linkPrivacy}</a> <span aria-hidden="true">·</span> <a href="#" data-panel="terms">${F.linkTerms}</a> <span aria-hidden="true">·</span> <a href="#" data-panel="feedback">${F.linkFeedback}</a> <span aria-hidden="true">·</span> <span class="nowrap">${F.contactLead}</span> <a href="mailto:${F.contact}">${F.contact}</a></p>
    ${credit}
    <p class="foot-small">${F.statsLead}${orgs} ${F.statsTail}</p>
    <p class="foot-small"><span class="nowrap">${F.operatorLead} ${F.operator}</span> <span aria-hidden="true">·</span> <span class="num">${F.version}</span></p>
    <p class="foot-small"><span class="mock-tag">시안 — 개인정보 처리방침과 이용 안내 초안은 copy.md 17절, 법률 검토 전. 이름 출처 줄은 title-005 시안의 것 그대로</span></p>
  </footer>`;
}
function regionSlot() {
  const chip = (s, { disabled = false, origin = false } = {}) =>
    `<label class="chip-opt${disabled ? ' is-disabled' : ''}${origin ? ' chip-opt--origin' : ''}"${disabled ? ' aria-disabled="true"' : ''}${origin ? ' hidden' : ''}><input type="radio" name="sido" value="${s}"${disabled ? ' disabled' : ''}>${icon('check')}<span>${origin ? GM3_TEXT.originChip(s) : s}</span></label>`;
  // X세대(1970~1980)의 어느 해에도 없던 시·도: 세종(2012 출범) — 목록은 DC7 연혁 표가 정한다(시안은 SPEC RG2 (b)의 예시만)
  const none = ['세종'];
  return `      <fieldset class="slot slot--small slot--region">
        <legend class="group-title group-title--inline">${GM3_TEXT.regionTitle}</legend>
        <div class="seg" role="radiogroup" aria-label="태어나는 시도를 정하는 방법">
          <label class="seg__opt is-selected"><input type="radio" name="regmode" value="roulette" checked>${icon('check')}<span>${GM3_TEXT.regionRoulette}</span><span class="sr-only">선택됨</span></label>
          <label class="seg__opt"><input type="radio" name="regmode" value="pick">${icon('check')}<span>${GM3_TEXT.regionPick}</span></label>
        </div>
        <p class="seg__hint seg__hint--roulette">${GM3_TEXT.regionHint}</p>
        <div class="chipset" role="radiogroup" aria-label="태어나는 시도" hidden>${chip('부산', { origin: true })}${SIDO_NOW.map((s) => chip(s, { disabled: none.includes(s) })).join('')}</div>
        <p class="seg__hint chipset__note" hidden>${GM3_TEXT.regionPickHint} ${GM3_TEXT.regionNone(none.map((s) => FORMAL[s]).join(', '))}</p>
      </fieldset>`;
}
function originSetting() {
  return `        <details class="disclosure origin" id="origin"><summary>${GM3_TEXT.originTitle} <span class="tag origin__cur">${GM3_TEXT.originNone}</span></summary>
          <div class="origin__body"><label><span class="sr-only">${GM3_TEXT.originTitle}</span><select class="origin__select"><option>${GM3_TEXT.originNone}</option>${SIDO_NOW.map((s) => `<option>${s}</option>`).join('')}</select></label><button type="button" class="btn btn--ghost btn--sm">${GM3_TEXT.originClear}</button><p class="origin__desc">${GM3_TEXT.originDesc}</p></div>
        </details>`;
}
const TITLE_STATE_JS = `(function(){var q=new URLSearchParams(location.search);var r=document.documentElement;
var gen=q.get('gen')||'random';r.setAttribute('data-gen',gen);
/* r3 시안 전용 상태: ?font=system 이면 글꼴을 시스템 글꼴로(기본은 Noto Sans KR 조각 — CLS 측정·비교용), ?alt=paper 는 형진 님께 보일 대안(바탕 한 단 밝게 — 캐러셀 평면화는 마스터 결정으로 정본이 됐다) */
if(q.get('font')==='system')r.setAttribute('data-font','system');
if(q.get('alt')==='paper')r.setAttribute('data-alt','paper');
/* r3 세대 목록(구현은 GM4 — 같은 규칙): 라디오가 바뀌면 고른 줄의 면·막대·체크를 칠하고, 고른 줄을 목록 창 안에 둔다 — 목록의 scrollTop만 움직인다(문서는 스크롤하지 않는다: scrollIntoView는 페이지까지 끌어올린다). 소개는 줄마다 있으므로 따로 보일 것이 없다 */
var list=document.querySelector('.gen-list');var rows=Array.prototype.slice.call(document.querySelectorAll('.gen-row'));
function reveal(row){if(!list)return;var top=row.offsetTop,bottom=top+row.offsetHeight;if(top<list.scrollTop)list.scrollTop=top;else if(bottom>list.scrollTop+list.clientHeight)list.scrollTop=bottom-list.clientHeight;}
function paintGen(){rows.forEach(function(row){var i=row.querySelector('input');var on=i.checked;row.classList.toggle('is-selected',on);var sr=row.querySelector('.sr-only.sel');if(sr)sr.textContent=on?'선택됨':'';if(on)reveal(row);});}
document.querySelectorAll('input[name=gen]').forEach(function(i){i.checked=i.value===gen;i.addEventListener('change',paintGen);});
if(!document.querySelector('input[name=gen]:checked')){var f0=document.querySelector('input[name=gen][value=random]');if(f0)f0.checked=true;}
/* 처음 칠할 때(저장된 선택 복원)는 즉시 스크롤 — smooth가 진행 중이면 첫 그림에서 고른 줄이 반쯤 걸친다(강제 색상 검사에서 잡힘). 사용자의 조작 뒤부터 smooth */
if(list){list.style.scrollBehavior='auto';}paintGen();if(list){list.style.scrollBehavior='';}
var region=q.get('region')==='pick'?'pick':'roulette';r.setAttribute('data-region',region);
function paintRegion(){var pick=r.getAttribute('data-region')==='pick';document.querySelectorAll('.chipset,.chipset__note').forEach(function(e){e.hidden=!pick;});var hint=document.querySelector('.seg__hint--roulette');if(hint)hint.hidden=pick;document.querySelectorAll('input[name=regmode]').forEach(function(i){var on=(i.value==='pick')===pick;i.checked=on;i.closest('.seg__opt').classList.toggle('is-selected',on);});}
document.querySelectorAll('input[name=regmode]').forEach(function(i){i.addEventListener('change',function(){r.setAttribute('data-region',i.value);paintRegion();});});
paintRegion();
var origin=q.get('origin')==='set'?'set':'none';r.setAttribute('data-origin',origin);
if(origin==='set'){var cur=document.querySelector('.origin__cur');if(cur)cur.textContent='부산';var sel=document.querySelector('.origin__select');if(sel)sel.value='부산';var oc=document.querySelector('.chip-opt--origin');if(oc)oc.hidden=false;}
if(q.get('open')==='origin'){var det=document.getElementById('origin');if(det)det.open=true;}
var pick=q.get('pick')||(region==='pick'?'부산':'');
function paintSido(){document.querySelectorAll('input[name=sido]').forEach(function(j){j.closest('.chip-opt').classList.toggle('is-selected',j.checked&&!j.disabled);});}
document.querySelectorAll('input[name=sido]').forEach(function(i){if(i.value===pick&&!i.disabled&&!i.closest('.chip-opt').hidden)i.checked=true;i.addEventListener('change',paintSido);});paintSido();
(q.get('lived')||'').split(',').filter(Boolean).forEach(function(id){var c=document.querySelector('input[name=gen][value="'+id+'"]');if(c){var p=c.closest('.gen-row').querySelector('.gen-row__lived');if(p)p.hidden=false;}});
if(q.get('fold')==='open'){var f=document.querySelector('.slot__fold');if(f)f.open=true;}
/* r4 비교용: ?alt=cream 이면 r3까지의 바탕(#f6f3ec)으로 — 기본은 종이색 토큰(html[data-paper], gm3.css) */
if(q.get('alt')==='cream')r.removeAttribute('data-paper');
/* r4 세대 그래프(구현은 GM4 — 같은 규칙, diff-004 D4-61): 라디오가 바뀌면 같은 그리기 함수로 그림·숫자·표·읽기 이름을 다시 만든다. 세대 줄(aria-live=polite)만 알린다 — 그림(role=img)의 aria-label 변경은 알리지 않는다(과하지 않게). 처음 그림은 HTML에 박혀 있어(랜덤) 스크립트 없이도 보인다 */
var CD=${JSON.stringify(CHART_DATA)};
${GEN_CHART_FN}
function paintChart(id){var c=document.querySelector('.slide--gen');if(!c)return;var o=genChartRender(CD,id);var svg=c.querySelector('.gen-chart__plot');svg.innerHTML=o.svg;svg.setAttribute('aria-label',o.label);c.querySelector('.gen-chart__gen').innerHTML=o.live;c.querySelector('.gen-chart__big').innerHTML=o.big;c.querySelector('.gen-chart__bigsub').textContent=o.bigSub;c.querySelector('.gen-chart__nums').innerHTML=o.nums;c.querySelector('.gen-chart__tbody').innerHTML=o.table;c.querySelector('.gen-chart__caption').textContent=o.caption;c.setAttribute('data-gen',id);bindHover();}
/* 가리킴(dataviz 스킬 「십자선이 x를 찾는다」): 플롯 위에서 가장 가까운 해의 값을 세로 가는 선 + 점 + 글자로 — 값은 표(표로 보기)에도 모두 있어 가리킴이 없어도 읽을 수 있다 */
function bindHover(){var svg=document.querySelector('.gen-chart__plot');if(!svg)return;var hit=svg.querySelector('.gchart__hit'),ln=svg.querySelector('.gchart__cursor'),dot=svg.querySelector('.gchart__cursor-dot'),tx=svg.querySelector('.gchart__cursor-text');if(!hit)return;var G=CD.geom,step=(G.R-G.L)/(G.Y1-G.Y0);
function hide(){[ln,dot,tx].forEach(function(e){e.setAttribute('hidden','hidden');});}
function at(ev){var pt=svg.createSVGPoint();pt.x=ev.clientX;pt.y=ev.clientY;var p=pt.matrixTransform(svg.getScreenCTM().inverse());var year=Math.round(G.Y0+(p.x-G.L)/step);var v=null;CD.births.forEach(function(b){if(b[0]===year)v=b[1];});if(v===null){hide();return;}var x=G.L+(year-G.Y0)*step,y=G.B-(v/G.YMAX)*(G.B-G.T);ln.setAttribute('x1',x);ln.setAttribute('x2',x);dot.setAttribute('cx',x);dot.setAttribute('cy',y);tx.textContent=year+'년 · '+Math.round(v/10000).toLocaleString('ko-KR')+'만 명';tx.setAttribute('x',Math.min(Math.max(x,G.L+70),G.R-70));[ln,dot,tx].forEach(function(e){e.removeAttribute('hidden');});}
hit.addEventListener('pointermove',at);hit.addEventListener('pointerleave',hide);}
if(gen!=='random')paintChart(gen);else bindHover();
/* r5 캐러셀(형진 님 답 4차 3 — 구현은 GM4 StatsCarousel, 같은 규칙 diff-004 D4-71): 21장, 자동 넘김 9초(마스터 결정 M8), 전환은 .slide의 불투명도 크로스페이드(가벼운 320ms — 움직임 줄이기면 즉시).
   WCAG 2.2.2: 보이는 멈춤/재생 단추(.carousel__pause) · 카드에 포인터가 올라오거나 키보드 초점이 들면 멈추고 나가면 이어감(손으로 멈춘 뒤에는 이어 가지 않음) · prefers-reduced-motion 또는 게임 설정(html[data-motion=reduce])이면 자동 넘김 자체가 없고 단추를 숨김(data-autoplay=none) · 자동으로 넘어갈 때는 알리지 않고 손으로(화살표·키보드) 넘길 때만 .carousel__live(aria-live=polite)에 「{i} / {N} · {표제어}」.
   세대 라디오를 바꾸면 첫 장(세대 그래프)으로 돌아오고 타이머를 다시 센다(알림은 세대 줄의 aria-live가 이미 한다). ?paused=1 처음부터 멈춤 · ?auto=<ms> 시안 검사용 간격 · ?slide=<id> */
var car=document.querySelector('.carousel--005');
if(car){var slides=Array.prototype.slice.call(car.querySelectorAll('.slide')),st=car.querySelector('.carousel__status'),live=car.querySelector('.carousel__live'),pb=car.querySelector('.carousel__pause'),pbUse=pb&&pb.querySelector('use'),vp=car.querySelector('.carousel__viewport');
var cur=Math.max(0,slides.findIndex(function(s){return s.classList.contains('is-active');}));
var MS=parseInt(q.get('auto')||'9000',10);var reduce=r.getAttribute('data-motion')==='reduce'||(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var timer=null,userPaused=q.get('paused')==='1',hovering=false,focused=false;
function show(k,manual){cur=(k+slides.length)%slides.length;slides.forEach(function(s,j){s.classList.toggle('is-active',j===cur);});if(st)st.textContent=(cur+1)+' / '+slides.length;if(manual&&live){var h=slides[cur].querySelector('.slide__insight');live.textContent=(cur+1)+' / '+slides.length+' · '+(h?h.textContent:'');}}
function running(){return !reduce&&!userPaused&&!hovering&&!focused;}
function tick(){if(timer){clearInterval(timer);timer=null;}if(running())timer=setInterval(function(){show(cur+1,false);},MS);car.setAttribute('data-autoplay',reduce?'none':userPaused?'paused':running()?'on':'held');if(pb){pb.hidden=reduce;pb.setAttribute('aria-label',userPaused?'자동 넘김 다시 시작':'자동 넘김 일시정지');pb.setAttribute('aria-pressed',userPaused?'true':'false');if(pbUse)pbUse.setAttribute('href',userPaused?'#i-play':'#i-pause');}}
var prev=car.querySelector('.carousel__prev'),next=car.querySelector('.carousel__next');
if(prev)prev.addEventListener('click',function(){show(cur-1,true);tick();});if(next)next.addEventListener('click',function(){show(cur+1,true);tick();});
if(pb)pb.addEventListener('click',function(){userPaused=!userPaused;tick();});
car.addEventListener('pointerenter',function(){hovering=true;tick();});car.addEventListener('pointerleave',function(){hovering=false;tick();});
car.addEventListener('focusin',function(){focused=true;tick();});car.addEventListener('focusout',function(e){if(!car.contains(e.relatedTarget)){focused=false;tick();}});
if(vp)vp.addEventListener('keydown',function(e){if(e.key==='ArrowRight'){e.preventDefault();show(cur+1,true);tick();}else if(e.key==='ArrowLeft'){e.preventDefault();show(cur-1,true);tick();}});
document.addEventListener('visibilitychange',function(){tick();});
document.querySelectorAll('input[name=gen]').forEach(function(i){i.addEventListener('change',function(){paintChart(i.value);show(0,false);tick();});});
show(cur,false);tick();window.__mockCarousel={show:function(k){show(k,true);tick();},state:function(){return {cur:cur,autoplay:car.getAttribute('data-autoplay'),timer:!!timer};}};}
/* 자리(r5): 넓은 화면은 오른쪽 열(카드 sticky), 좁은 화면은 r3와 같이 본문 뒤·하단 앞 — 노드를 옮기지 않는다(위 genSlot 주석) */
})();`;

/** r3 글꼴(형진 님 답 2차 4 — Noto Sans KR을 가볍게): 조각 @font-face(fonts/noto-sans-kr.css, 생성 buildGm3Fonts.mjs) + 첫 화면 조각(s0 400·700) 미리 받기. 외부 주소 0. <html data-font="noto">가 --font-sans를 바꾼다(gm3.css) */
const FONT_LINKS = `<link rel="preload" href="fonts/NotoSansKR-400.s0.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="fonts/NotoSansKR-700.s0.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="fonts/noto-sans-kr.css">`;
function buildTitle() {
  let html = readFileSync(`${ROOT}docs/design/mockups/title-005.html`, 'utf-8');
  html = must(html, '<html lang="ko">', '<html lang="ko" data-font="noto" data-paper="1">', 'html tag'); // r4: 종이색 바탕 토큰(형진 님 답 3차 1)
  html = must(html, '<title>수저 게임 · 시안 · 첫 화면(SPEC-005 QI2)</title>', '<title>수저 게임 · 시안 · 첫 화면 세대 선택(SPEC-004 GM3 r4)</title>', 'title');
  html = must(html, '<link rel="stylesheet" href="../../../src/styles/tokens.css">', '<link rel="stylesheet" href="../../../../src/styles/tokens.css">', 'tokens');
  html = must(html, '<link rel="stylesheet" href="ds.css">', '<link rel="stylesheet" href="../ds.css">', 'ds');
  html = must(html, '<link rel="stylesheet" href="title-005.css">', `<link rel="stylesheet" href="../title-005.css">\n${FONT_LINKS}\n<link rel="stylesheet" href="gm3.css">`, 'title-005.css');
  html = html.replaceAll('../../../src/assets/home/', '../../../../src/assets/home/');
  html = must(html, `r.setAttribute('data-slot',q.get('slot')==='gen8'?'gen8':'era3')`, `r.setAttribute('data-slot','gen8')`, 'slot default');
  html = must(html, `r.setAttribute('data-hero',q.get('hero')==='illust'?'illust':'picto')`, `r.setAttribute('data-hero','illust')`, 'hero default');
  html = must(html, `r.setAttribute('data-seen',q.get('seen')==='1'?'1':'0')`, `r.setAttribute('data-seen',q.get('seen')==='0'?'0':'1')`, 'seen default');
  html = html.replace(/<p class="hero__tag">[\s\S]*?<\/p>/, `<p class="hero__tag">${GM3_TEXT.tagLead}<span class="nowrap">${GM3_TEXT.tagKeep}</span></p>`);
  // r2(게이트 ③ 답 1): 한반도 일러스트를 뺀다 — 넓은 화면의 오른쪽 열 맨 위(.illust--top)와 좁은 화면의 배너(.illust--banner) 둘 다(같은 자산). 오른쪽 열은 통계 캐러셀로 바로 시작한다. data-hero='illust'의 캐러셀 색(하늘 띠·차가운 테두리)은 형진 님 결정(12-6)이라 그대로 — diff-004 D4-34
  html = html.replace(/\n[ \t]*<!-- hero=illust, 좁은 화면[^\n]*\n[ \t]*<figure class="illust illust--banner"[\s\S]*?<\/figure>/, '');
  html = html.replace(/\n[ \t]*<!-- hero=illust, 넓은 화면[^\n]*\n[ \t]*<figure class="illust illust--top"[\s\S]*?<\/figure>/, '');
  if (html.includes('class="illust')) throw new Error('일러스트 figure가 남아 있다');
  html = must(html, '<header class="hero hero--005">', '<header class="hero hero--005 hero--r2 hero--r3 hero--r4">', 'hero class');
  html = must(html, '<div class="title title--005">', '<div class="title title--005 title--r4">', 'title class');
  // 「51,284명이 …」 큰 줄 + 안내 → 체험 한 줄(작은 글씨)
  html = html.replace(/<p class="hero__pop">[\s\S]*?<\/p>\n[ \t]*<p class="hero__note">[\s\S]*?<\/p>/, `<p class="hero__span">${GM3_TEXT.span}</p>`);
  if (html.includes('hero__pop') || html.includes('hero__note')) throw new Error('hero__pop/hero__note가 남아 있다');
  // r5(형진 님 답 4차 4·5): 수저 다섯 자루 줄 삭제 · 「한 판 약 30분」 없음(r4 D4-60의 time 줄 취소)
  html = html.replace(/\n[ \t]*<ul class="spoon-lineup"[\s\S]*?<\/ul>/, '');
  if (html.includes('spoon-lineup')) throw new Error('수저 다섯 자루 줄이 남아 있다');
  html = must(html, '<header class="hero hero--005 hero--r2 hero--r3 hero--r4">', '<header class="hero hero--005 hero--r2 hero--r3 hero--r4 hero--r5">', 'hero r5');
  html = must(html, '<div class="title title--005 title--r4">', '<div class="title title--005 title--r4 title--r5">', 'title r5');
  // r5(형진 님 답 4차 3): 캐러셀은 3차 구조 그대로(20장 + 넘김 + 자동 넘김) — 4차의 세대 그래프는 **첫 장**이 된다(21장). 번호 「N/20」 → 「N+1/21」, 처음 보이는 장 = 첫 장
  const total = 21;
  html = html.replace(/aria-label="(\d+)\/20 /g, (m, n) => `aria-label="${Number(n) + 1}/${total} `);
  html = must(html, '<span class="carousel__status num" aria-hidden="true">1 / 20</span>', `<span class="carousel__status num" aria-hidden="true">1 / ${total}</span>`, 'status');
  html = must(html, '<article class="slide is-active" data-slide-id="tfr"', `${genChartSlide('random', total)}    <article class="slide" data-slide-id="tfr"`, 'first slide');
  if ((html.match(/<article class="slide/g) || []).length !== total) throw new Error('슬라이드 수가 21이 아니다');
  // 접근 가능한 알림(손으로 넘길 때만) 자리 + 조작 줄 그대로(작은 화살표 · 보이는 멈춤/재생)
  html = must(html, '<div class="carousel__viewport"', '<p class="sr-only carousel__live" aria-live="polite"></p>\n      <div class="carousel__viewport"', 'live region');
  // 시안 스크립트의 옛 캐러셀 조작(이전·다음·일시정지 핸들러)을 걷고 r5 스크립트(자동 넘김·가리킴/초점 멈춤·움직임 줄이기·키보드·알림)로 바꾼다
  html = html.replace(/var idx=at;function show\(k\)[\s\S]*?(?=\}\);\}\)\(\);<\/script>)/, 'var idx=at;');
  if (html.includes('carousel__prev\');var next')) throw new Error('옛 캐러셀 핸들러가 남아 있다');
  // r4: 하단 새로 짜기(그대로)
  const credit = html.match(/<p class="credit">[\s\S]*?<\/p>/);
  if (!credit) throw new Error('푸터 이름 출처 줄이 없다');
  html = html.replace(/<footer class="title-foot">[\s\S]*?<\/footer>/, footerHtml(credit[0].replace('class="credit"', 'class="foot-small credit"')));
  if (!html.includes('title-foot--r4')) throw new Error('하단이 바뀌지 않았다');
  // 시안 스크립트: 패널을 여는 링크 선택자를 새 하단(링크 줄 + 단추)으로 넓히고, 세대 라디오의 옛 .radio-card 핸들러(목록에는 카드가 없다)를 뺀다
  html = html.replaceAll(`.title-foot__links a[data-panel]`, `.title-foot [data-panel="news"], .title-foot [data-panel="intro"]`).replaceAll(`.title-foot__links a[data-panel="`, `.title-foot [data-panel="`);
  html = must(html, `input[type=radio][name=era],input[type=radio][name=gen]`, `input[type=radio][name=era]`, 'era radio handler');
  const era3 = html.match(/<fieldset class="slot slot--big slot--era3">[\s\S]*?<\/fieldset>\n/);
  if (!era3) throw new Error('era3 slot');
  html = html.replace(era3[0], '');
  const gen8 = html.match(/<fieldset class="slot slot--big slot--gen8">[\s\S]*?<\/fieldset>/);
  if (!gen8) throw new Error('gen8 slot');
  html = html.replace(gen8[0], genSlot());
  html = must(html, '      <div class="slot slot--setting">', `${regionSlot()}\n      <div class="slot slot--setting">`, 'setting slot');
  html = must(html, '        </button>\n      </div>\n    </div>\n  </main>', `        </button>\n${originSetting()}\n      </div>\n    </div>\n  </main>`, 'origin insert');
  html = must(html, '</body>', `<script>${TITLE_STATE_JS}</script>\n</body>`, 'state script');
  writeFileSync(`${OUT}title-004.html`, html);
}

// ============================================================ ② 룰렛 ============================================================
const WEALTH_REEL_ORDER = [1, 2, 3, 4, 5, 4, 3, 2];
const SPOON_NAMES = ['흙수저', '동수저', '은수저', '금수저', '다이아몬드<wbr>수저'];
/** r3 시안의 두 경우(연도는 화면에 보이지 않지만 릴 칸·출생신고에 쓴다): 밀레니얼(주 캡처 — births · 결과 1988 경기 동수저) · 베이비붐(uniform · 1940~1980 도별 인구 비례 계단식, 결과 1959 경북 동수저) */
const ROULETTE_CASES = {
  millennial: { gen: GENS[4], year: 1988, regionKey: 'gyeonggi', grade: 2 },
  boomer: { gen: GENS[1], year: 1959, regionKey: 'gyeongbuk', grade: 2 },
};
/** 구간 글자(3-1 bandLabel 꼴): 「하위 a%와 상위 b% 사이」, 양 끝은 「안쪽」 */
const bandOf = (w, grade) => {
  const below = w.slice(0, grade - 1).reduce((s, v) => s + v, 0), above = w.slice(grade).reduce((s, v) => s + v, 0);
  return grade === 1 ? `하위 ${w[0]}% 안쪽` : grade === 5 ? `상위 ${w[4]}% 안쪽` : `하위 ${below}%와 상위 ${above}% 사이`;
};
/** r3 「고른 세대 전체 기준」(형진 님 답 2차 2): 연도 가중 P(연도|세대) = yearOddsFor(GS7 — births 비례 / uniform 균등)로 섞는다 — 도는 동안 바뀌지 않는다.
 *  지역 = Σ P(y) × 그해 시·도 비율(1981~2020 birth_share_sido, 1940~1980 stairWeights; 그 해에 없던 시·도는 0) → 줄은 세대 범위에서 한 번이라도 있던 시·도(어느 해에도 없던 시·도는 뺀다), 일부 해에만 있던 시·도는 섞인 값 그대로.
 *  수저 = Σ P(y) × wealthFor(y)(N29 연도별 설계값). 표시는 합 100 — 지역은 소수 1자리(1000분의 1 단위 largestRemainder), 수저는 정수. developer는 같은 식을 src/core로 옮긴다(diff-004 D4-47) */
function genMixture(g) {
  const odds = yearOddsFor(g);
  const rows = regionRowsFor(g);
  if (rows.length === 0) throw new Error(`${g.id}: 지역 자료가 없다`);
  const regionRaw = rows.map(([key]) => odds.reduce((s, o) => s + (o.p / 100) * (regionShare(o.year, key) ?? 0), 0));
  const tenths = largestRemainder(regionRaw.map((v) => v * 10), 1000);
  const wealthRaw = [0, 0, 0, 0, 0];
  for (const o of odds) { const w = wealthFor(o.year); for (let k = 0; k < 5; k++) wealthRaw[k] += (o.p / 100) * w[k]; }
  const wealth = largestRemainder(wealthRaw);
  // 세대 범위 도중에 생긴 시·도(첫 해에 없고 뒤 해에 있는 것) — 주석 한 문장의 재료
  const later = rows.filter(([key]) => regionShare(g.from, key) === null).map(([, short]) => short);
  return { odds, region: rows.map(([key, short], i) => ({ key, short, pct: (tenths[i] / 10).toFixed(1) })), wealth, later, popYears: g.from < 1981 };
}
for (const g of GENS) { const m = genMixture(g); const rs = m.region.reduce((s, r) => s + Number(r.pct) * 10, 0); const ws = m.wealth.reduce((s, v) => s + v, 0); if (Math.round(rs) !== 1000 || ws !== 100) throw new Error(`${g.id} 섞은 값 합이 100이 아니다: 지역 ${rs / 10} 수저 ${ws}`); }

/** fast = 흐림·줄무늬(빠른 회전) */
function reel(cells, { spinning, resultIdx, cls = '', picked = false, pos = 17.4, fast = true, ariaHidden = true }) {
  const n = cells.length;
  let items;
  if (spinning) {
    const reps = Math.ceil(40 / n) + 1;
    items = Array.from({ length: reps * n }, (_, k) => cells[k % n]);
    return `<div class="reel is-spinning${fast ? ' is-fast' : ''} ${cls}" aria-hidden="${ariaHidden}" data-state="spinning"><div class="reel__window"></div><ul class="reel__list" style="transform:translate3d(0, calc(var(--reel-item-h) * -${pos}), 0)">${items.map((c) => `<li class="reel__item${c.cls ? ` ${c.cls}` : ''}">${c.html}</li>`).join('')}</ul></div>`;
  }
  const idx = Array.from({ length: 5 }, (_, e) => (((resultIdx + e - 2) % n) + n) % n);
  return `<div class="reel${picked ? ' is-picked' : ''} ${cls}" aria-hidden="${ariaHidden}" data-state="${picked ? 'still' : 'done'}"><div class="reel__window"></div><ul class="reel__list">${idx.map((i, e) => `<li class="reel__item${cells[i].cls ? ` ${cells[i].cls}` : ''}${e === 2 ? ' is-result' : ''}">${cells[i].html}</li>`).join('')}</ul></div>`;
}
const oddsTable = (caption, rows, note, cls = '') =>
  `<div class="odds ${cls}"><table><caption class="sr-only">${caption}</caption><tbody>${rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>${note ? `<p class="odds__note">${note}</p>` : ''}</div>`;

/** state: draw(세대 뽑기 단계) | spinning | result · picked: 시도를 직접 고른 판 · caseId · fromRandom: 「랜덤 세대」 경로(세대가 먼저 정해져 머리에 보인다) */
function rouletteMain(state, picked, caseId = 'millennial', fromRandom = false) {
  const c = ROULETTE_CASES[caseId];
  const gx = c.gen;
  const genLine = `<p class="roulette__gen">${fromRandom ? `<span class="roulette__from">${GM3_TEXT.fromRandom}</span>` : ''}<span class="gen-tag">${gx.name}</span><span>${GM3_TEXT.genAmong(gx.from, gx.to)}</span></p>`;
  if (state === 'draw') {
    const cells = GENS.map((g) => ({ html: `<span>${g.short || g.name}</span><small>${g.from}~${g.to}</small>`, cls: 'reel__item--gen' }));
    return `<div class="page roulette-page is-spinning" data-state="draw">
${headerLogoRow()}
<main class="roulette">
  <div class="roulette__lead"><h1 class="t-title" style="--title-chars:5">${GM3_TEXT.drawTitle}</h1><p class="t-muted" role="status">${GM3_TEXT.drawNote}</p></div>
  <div class="reels"><div class="reel-col reel-col--gen">${reel(cells, { spinning: false, resultIdx: 3, cls: 'reel--gen' })}
    ${oddsTable('세대별 확률', GENS.map((g) => [g.name, '1/7']), GM3_TEXT.drawOdds, 'odds--gen odds--r3')}</div></div>
  <p class="t-xs t-faint roulette__after" aria-hidden="true">${GM3_TEXT.afterNote}</p>
</main>
<div class="page-end-space"></div>
<div class="bottom-bar"><button class="btn btn--secondary btn--lg" type="button">${GM3_TEXT.skip}</button></div>
</div>`;
  }
  const spinning = state !== 'result';
  const mix = genMixture(gx);
  // 릴 칸 = 최종 연도의 시·도 목록(결과는 돌기 전에 정해진다, RL2). 표의 줄 = 세대 범위의 시·도 합집합(고정 — 도는 동안 바뀌지 않는다)
  const reelRegions = regionsIn(c.year);
  const regionCells = reelRegions.map(([, s]) => ({ html: s }));
  const regionIdx = Math.max(0, reelRegions.findIndex(([k]) => k === c.regionKey));
  const spoonCells = WEALTH_REEL_ORDER.map((n) => ({ html: reelSpoon(n) }));
  const regionReel = picked ? reel(regionCells, { spinning: false, resultIdx: regionIdx, picked: true }) : reel(regionCells, { spinning, resultIdx: regionIdx, pos: 21.5 });
  const spoonReel = reel(spoonCells, { spinning, resultIdx: c.grade - 1, pos: 19.6 });
  const head = `<p class="odds__head">${GM3_TEXT.oddsHead(gx.name)}</p>`;
  const regionNotes = [gx.basis === 'uniform' ? GM3_TEXT.regionNoteUniform : GM3_TEXT.regionNoteBirths, mix.popYears ? GM3_TEXT.regionNotePop : '', mix.later.length ? GM3_TEXT.regionNoteLater(mix.later.join('·')) : ''].filter(Boolean).join(' ');
  const regionOdds = picked
    ? `<p class="odds__picked">${GM3_TEXT.pickedRegion}</p>`
    : `<div class="odds odds--cols odds--region odds--r3">${head}<table><caption class="sr-only">지역별 확률 — ${GM3_TEXT.oddsHead(gx.name)}</caption><tbody>${mix.region.map((r) => `<tr><th scope="row">${r.short}</th><td>${r.pct}%</td></tr>`).join('')}</tbody></table><p class="odds__note">${regionNotes}</p></div>`;
  const spoonOdds = `<div class="odds odds--spoon odds--r3">${head}<table><caption class="sr-only">수저별 확률 — ${GM3_TEXT.oddsHead(gx.name)}</caption><tbody>${mix.wealth.map((v, i) => `<tr><th scope="row">${SPOON_NAMES[i]}</th><td>${v}%</td></tr>`).join('')}</tbody></table><p class="odds__note">${GM3_TEXT.wealthNoteGen(gx.from, gx.to)}</p></div>`;
  const regionShort = SIDO.find((s) => s[0] === c.regionKey)[1];
  // 결과 줄: 시도 + 수저 칩(구간은 세대 전체 기준의 섞은 값 — 표와 같은 숫자를 쓴다. 연도는 적지 않는다)
  const status = spinning
    ? `<p class="t-muted" role="status">${picked ? GM3_TEXT.spinNotePicked : GM3_TEXT.spinNote}</p>`
    : `<p class="roulette__result" role="status"><span class="roulette__place">${regionShort}</span><span class="grade-line">${gradeChip(c.grade, { range: bandOf(mix.wealth, c.grade) })}</span></p>`;
  return `<div class="page roulette-page${spinning ? ' is-spinning' : ''}" data-state="${spinning ? 'spinning' : 'done'}">
${headerLogoRow()}
<main class="roulette">
  <div class="roulette__lead"><h1 class="t-title" style="--title-chars:${spinning ? 4 : 7}">${spinning ? GM3_TEXT.spinTitle : GM3_TEXT.doneTitle}</h1>${genLine}${status}</div>
  <div class="reels reels--2">
    <div class="reel-col"><h2 class="reel-col__title">${GM3_TEXT.regionReelTitle}</h2>${regionReel}${regionOdds}</div>
    <div class="reel-col"><h2 class="reel-col__title">${GM3_TEXT.wealthTitle}</h2>${spoonReel}${spoonOdds}</div>
  </div>
  <p class="t-xs t-faint roulette__after" aria-hidden="true">${GM3_TEXT.afterNote}</p>
</main>
<div class="page-end-space"></div>
<div class="bottom-bar"><button class="btn ${spinning ? 'btn--secondary' : 'btn--primary'} btn--lg" type="button">${spinning ? GM3_TEXT.skip : GM3_TEXT.seeReport}</button></div>
</div>`;
}
const headerLogoRow = () => `<header class="site-head">${headerLogo()}<span class="site-head__name">출생</span></header>`;

function buildRoulette() {
  const body = `${GM3_SPRITE}
${rouletteMain('spinning', false)}
<template id="state-draw">${rouletteMain('draw', false)}</template>
<template id="state-result">${rouletteMain('result', false)}</template>
<template id="state-spinning-picked">${rouletteMain('spinning', true)}</template>
<template id="state-result-picked">${rouletteMain('result', true)}</template>
<template id="state-spinning-boomer">${rouletteMain('spinning', false, 'boomer')}</template>
<template id="state-result-boomer">${rouletteMain('result', false, 'boomer')}</template>
<template id="state-spinning-random">${rouletteMain('spinning', false, 'millennial', true)}</template>
<template id="state-result-random">${rouletteMain('result', false, 'millennial', true)}</template>
<p class="mock-tag" style="margin:0 var(--gutter) var(--sp-3)">시안 — 지역 비율은 실제 자료(DC2·DC7 JSON)를 연도 가중으로 섞은 값, 수저 비율은 설계값(N29 보간)을 섞은 값. 연도는 화면에 없다(출생신고에서 드러남)</p>
<script>(function(){var q=new URLSearchParams(location.search);var s=q.get('state')||'spinning';var picked=q.get('region')==='picked';var gen=q.get('gen')==='boomer'?'boomer':'';var from=q.get('from')==='random';var id='state-'+s+(picked&&s!=='draw'?'-picked':'')+(gen&&s!=='draw'&&!picked?'-'+gen:'')+(from&&s!=='draw'&&!picked&&!gen?'-random':'');var t=document.getElementById(id);if(!t)return;var cur=document.querySelector('.page');cur.replaceWith(t.content.cloneNode(true));if(q.get('font')==='system')document.documentElement.setAttribute('data-font','system');})();</script>`;
  const html = page({ title: '수저 게임 · 시안 · 룰렛 두 릴(SPEC-004 GM3 r4)', body, head: `${FONT_LINKS}\n<link rel="stylesheet" href="gm3.css">` })
    .replace('<html lang="ko">', '<html lang="ko" data-font="noto" data-paper="1">')
    .replace('href="../../../src/styles/tokens.css"', 'href="../../../../src/styles/tokens.css"')
    .replace('href="ds.css"', 'href="../ds.css"');
  writeFileSync(`${OUT}roulette-004.html`, html);
}

// ============================================================ ②-1 출생신고 — 연도가 처음 드러나는 자리 (r3, 마스터 해석) ============================================================
/** birth.html(SPEC-003 시안)의 「지난 세상」 템플릿을 밀레니얼 1988년생(룰렛 주 캡처와 같은 판: 경기 · 동수저)으로 바꾼다. 연도는 ① 「세대」 칸 「밀레니얼 세대 · 1988년생」(GD2 꼴) ② 첫 문장 ③ 「출생 연월」 칸에 적히고, 각주 한 문장이 GS7 가중을 말한다 */
function buildBirth() {
  const src = readFileSync(`${ROOT}docs/design/mockups/birth.html`, 'utf-8');
  const past = src.match(/<template id="era-past">([\s\S]*?)<\/template>/);
  if (!past) throw new Error('birth.html: era-past 템플릿이 없다');
  const c = ROULETTE_CASES.millennial;
  const g = c.gen;
  const mix = genMixture(g);
  let main = past[1];
  main = must(main, '<div><p class="label">이름</p><p class="doc__name">박기철</p></div>', `<div class="doc__who"><div><p class="label">이름</p><p class="doc__name">김지혜</p></div><div><p class="label">${GM3_TEXT.birthGenLabel}</p><p class="doc__gen">${GM3_TEXT.birthGen(g.name, c.year)}</p></div></div>`, 'who');
  main = main.replace(/<p class="doc__sentence">[\s\S]*?<\/p>/, `<p class="doc__sentence">${c.year}년 3월, 경기도 안양시의 형편이 빠듯한 가정에서 3.2kg 여자아이로 태어났습니다. 둘째입니다. <span class="keep-phrase">(3.2kg은 상위 약 48%)</span></p>`);
  const grid = main.match(/<dl class="doc__grid">[\s\S]*?<\/dl>/);
  if (!grid) throw new Error('birth.html: doc__grid');
  let dl = grid[0]
    .replace('<dt>성별</dt><dd>남성</dd>', '<dt>성별</dt><dd>여성</dd>')
    .replace('<dt>출생 연월</dt><dd>1961년 5월</dd>', `<dt>출생 연월</dt><dd>${c.year}년 3월</dd>`)
    .replace('<dt>태어난 곳</dt><dd>경기도 용인시 처인구</dd>', '<dt>태어난 곳</dt><dd>경기도 안양시</dd>')
    .replace('grade grade--1 grade--lg', 'grade grade--2 grade--lg').replace('href="#sp-1"', 'href="#sp-2"').replace('<span>흙수저</span>', '<span>동수저</span>')
    .replace('aria-label="5단계 중 1단계"><i class="on"></i><i class=""></i>', 'aria-label="5단계 중 2단계"><i class="on"></i><i class="on"></i>')
    .replace('(하위 40% 안쪽)', `(${bandOf(mix.wealth, c.grade)})`)
    .replace('data-a="27세" data-b="전문직"><span class="fit-pair__probe" data-text="27세 · 전문직" aria-hidden="true"></span>27세 · 전문직', 'data-a="26세" data-b="사무직"><span class="fit-pair__probe" data-text="26세 · 사무직" aria-hidden="true"></span>26세 · 사무직')
    .replace('data-a="28세" data-b="기계 조작직"><span class="fit-pair__probe" data-text="28세 · 기계 조작직" aria-hidden="true"></span>28세 · 기계 조작직', 'data-a="29세" data-b="생산직"><span class="fit-pair__probe" data-text="29세 · 생산직" aria-hidden="true"></span>29세 · 생산직')
    .replace('<dt>사는 집</dt><dd>자가</dd>', '<dt>사는 집</dt><dd>임차(전세, 월세)</dd>')
    .replace('<dt>출생 체중</dt><dd>3.6kg <span class="cell-sub">(상위 약 17%)</span></dd>', '<dt>출생 체중</dt><dd>3.2kg <span class="cell-sub">(상위 약 48%)</span></dd>')
    .replace('<dt>형제 순서</dt><dd>셋째</dd>', '<dt>형제 순서</dt><dd>둘째</dd>')
    .replace('<dt>외모</dt><dd>상위 약 23%', '<dt>외모</dt><dd>상위 약 40%')
    .replace(/<dt>교육방식<\/dt><dd>[\s\S]*?<\/dd>/, '<dt>교육방식</dt><dd>엄격 <span class="cell-sub">집에는 지켜야 할 규칙이 많았고, 부모님은 엄했습니다.</span></dd>');
  // 옛 값 점검: 격자 칸에는 1961년 판의 값이 남으면 안 되고(또래 목록의 수저 칩은 다른 사람의 값이라 제외), 본문에는 옛 연도·이름·지명이 남으면 안 된다
  for (const needle of ['1961', '박기철', '용인시', '흙수저', '전문직']) if (dl.includes(needle)) throw new Error(`출생신고 격자에 옛 값이 남아 있다: ${needle}`);
  for (const needle of ['1961', '박기철', '용인시']) if (main.replace(grid[0], '').includes(needle)) throw new Error(`출생신고 본문에 옛 값이 남아 있다: ${needle}`);
  main = main.replace(grid[0], dl);
  main = must(main, '<div class="doc-notes t-xs t-faint">', `<div class="doc-notes t-xs t-faint">\n    <p>${GM3_TEXT.birthYearNote}</p>`, 'notes');
  let html = src.replace(/<main class="doc-page" data-era="present">[\s\S]*?<\/main>/, main.trim()).replace(/<template id="era-past">[\s\S]*?<\/template>\n?/, '').replace(/<template id="era-future">[\s\S]*?<\/template>\n?/, '');
  html = must(html, '<html lang="ko">', '<html lang="ko" data-font="noto" data-paper="1">', 'html tag');
  html = must(html, '<title>수저 게임 · 시안 · 출생신고</title>', '<title>수저 게임 · 시안 · 출생신고 — 연도가 처음 드러나는 자리(SPEC-004 GM3 r4)</title>', 'title');
  html = must(html, '<link rel="stylesheet" href="../../../src/styles/tokens.css">', '<link rel="stylesheet" href="../../../../src/styles/tokens.css">', 'tokens');
  html = must(html, '<link rel="stylesheet" href="ds.css">', `<link rel="stylesheet" href="../ds.css">\n${FONT_LINKS}\n<link rel="stylesheet" href="gm3.css">`, 'ds');
  html = html.replace('</body>', `<script>(function(){var q=new URLSearchParams(location.search);if(q.get('font')==='system')document.documentElement.setAttribute('data-font','system');})();</script>\n</body>`);
  writeFileSync(`${OUT}birth-004.html`, html);
}

// ============================================================ ③ 대시보드 ============================================================
const won = (man) => {
  if (man === 0) return '0원';
  const abs = Math.abs(man);
  const eok = Math.floor(abs / 10000);
  const rest = abs % 10000;
  const body = eok > 0 ? `${eok}억${rest > 0 ? ` ${rest.toLocaleString('ko-KR')}만` : ''} 원` : `${rest.toLocaleString('ko-KR')}만 원`;
  return (man < 0 ? '−' : '') + body;
};
const conv = (man, ratio) => (man < 0 ? -1 : 1) * Math.round(Math.abs(man) * ratio);

/** 자산 카드 (EY10·EY11·EY12). mode: then|now|future|none */
function assetsCard({ mode, year, net, income, debt }) {
  const ratio = mode === 'then' ? { 2000: 0.5416, 2010: 0.7407 }[year] : 1;
  const v = (m) => won(conv(m, ratio));
  const tag = mode === 'then' ? GM3_TEXT.tagThen : GM3_TEXT.tagNow;
  let view = '';
  if (mode === 'then') view = `<div class="assets__view"><button type="button" class="btn btn--ghost btn--sm" aria-describedby="assets-basis">${GM3_TEXT.toNow}<span class="sr-only"> ${GM3_TEXT.viewingThen}</span></button><p class="assets__basis">${GM3_TEXT.basisThen(year)}</p></div>`;
  else if (mode === 'now') view = `<div class="assets__view"><button type="button" class="btn btn--ghost btn--sm" aria-describedby="assets-basis">${GM3_TEXT.toThen}<span class="sr-only"> ${GM3_TEXT.viewingNow}</span></button><p class="assets__basis">${GM3_TEXT.basisNow}</p></div>`;
  else if (mode === 'none') view = `<div class="assets__view"><p class="assets__basis">${GM3_TEXT.basisNone}</p></div>`;
  return `<section class="card card--assets" aria-labelledby="assets-title" data-testid="assets-card"><div class="card__head"><h2 id="assets-title" class="card__title">자산 현황</h2><span class="tag" id="assets-basis" data-testid="assets-basis">${tag}</span></div><dl class="assets" data-testid="assets" aria-describedby="assets-basis"><div class="assets__row"><dt>순자산</dt><dd class="nowrap">${v(net)}</dd></div><div class="assets__row"><dt>연 소득</dt><dd class="nowrap">${v(income)}</dd></div><div class="assets__row"><dt>부채</dt><dd class="nowrap">${v(debt)}</dd></div></dl>${view}<p class="assets__note">순자산은 가진 것에서 부채를 뺀 값입니다. 0보다 작으면 부채가 가진 것보다 많다는 뜻입니다.</p></section>`;
}
const tlLabel = (kind) => `<span class="log__tl">${icon(TL_ICON[kind])}<span>${GM3_TEXT.tl[kind]}</span></span>`;
/** 인생 기록 한 줄. kind: '' | stage | tl(year|bg|local|proj) | intro */
function logRow({ age, year, kind = '', tl, text, latest = false, scenario }) {
  const ageCell = `<span class="log__age">${age}세${year ? `<small class="log__year">${year}</small>` : ''}</span>`;
  if (kind === 'intro') return `<li class="log__row log__row--proj-intro" data-kind="projection-intro">${ageCell}<span class="log__text"><span class="log__tl">${projChip()}<span class="log__scn">${GM3_TEXT.scenario(scenario)}</span></span><span class="log__sent">${text}</span></span></li>`;
  if (tl) return `<li class="log__row log__row--tl${latest ? ' log__row--latest' : ''}" data-kind="timeline" data-tl="${tl}">${ageCell}<span class="log__text">${tlLabel(tl)}<span class="log__sent">${text}</span></span></li>`;
  return `<li class="log__row${kind === 'stage' ? ' log__row--stage' : ''}${latest ? ' log__row--latest' : ''}">${ageCell}<span class="log__text">${text}</span></li>`;
}
const PEOPLE = {
  smin: { name: '김성민', gender: 'male', born: 1972, place: '부산직할시 동래구', placeNow: '부산광역시 동래구', grade: 2, range: '하위 33%와 상위 36% 사이', gen: 'X세대' },
  ysu: { name: '박영수', gender: 'male', born: 1940, place: '경상북도 안동군', placeNow: '경상북도 안동시', grade: 1, range: '하위 40% 안쪽', gen: '산업화 세대 · 전후 세대' },
};
// 1972년생 X세대 김성민의 기록(최신순). 연표 문장은 설계 문서 예시(timeline-schema.md 2-4·SPEC 부록 A H-C05·RG6)의 뜻만 — 실제 사건 문장은 DC1·reviewer 판독 뒤 확정
const ROWS_2000 = [
  { age: 28, text: '일하던 곳과 계약이 한 해 더 이어졌습니다.', latest: true },
  { age: 27, text: '보증금을 올려 달라는 연락을 받아 월세 집으로 옮겼습니다.' },
  { age: 26, text: '계약직으로 첫 직장에 들어갔습니다.' },
  { age: 25, year: 1997, tl: 'year', text: '졸업했지만 채용 공고가 사라졌습니다.' },
  { age: 24, text: '군 복무를 마치고 학교로 돌아왔습니다.' },
  { age: 20, kind: 'stage', text: '스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.' },
  { age: 19, year: 1991, tl: 'year', text: '시험이 끝난 날 친구들과 처음 노래방에 갔습니다.' },
  { age: 15, year: 1987, tl: 'bg', text: '이 해 헌법이 바뀌어 대통령을 국민이 직접 뽑게 되었습니다.' },
  { age: 8, year: 1980, tl: 'local', text: '그해 5월 광주에서 있었던 일을 라디오 뉴스로 전해 들었습니다.' },
  { age: 8, text: '학교에 들어갔습니다.' },
  { age: 0, text: '1972년 5월, 부산직할시 동래구의 형편이 보통인 가정에서 3.2kg 남자아이로 태어났습니다. 둘째입니다.' },
];
const ROWS_2031 = [
  { age: 59, year: 2031, tl: 'proj', text: '정년을 두고 회사 안에서 이야기가 오갈 수도 있습니다.', latest: true },
  { age: 58, text: '큰아이가 집을 떠나 혼자 살기 시작했습니다.' },
  { age: 57, year: 2029, tl: 'proj', text: '돌봄이 필요한 식구가 생길 수도 있습니다.' },
  { age: 55, text: '건강검진에서 쉬어 가라는 말을 들었습니다. <em>(선택: 일을 줄인다)</em>' },
  { age: 54, year: 2026, kind: 'intro', scenario: '기준', text: GM3_TEXT.projIntro },
  { age: 53, text: '주변에서 일터를 떠나는 사람이 부쩍 늘었습니다.' },
  { age: 50, text: '집에서 일하는 날이 늘었습니다. <em>(선택: 경계를 흐리게 둔다)</em>' },
  { age: 40, kind: 'stage', text: '어느덧 마흔이 되었습니다.' },
  { age: 25, year: 1997, tl: 'year', text: '졸업했지만 채용 공고가 사라졌습니다.' },
];
const ROWS_1963 = [
  { age: 23, text: '공장에서 일자리를 얻어 도시로 나왔습니다.', latest: true },
  { age: 20, kind: 'stage', text: '스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.' },
  { age: 13, year: 1953, tl: 'bg', text: '이 해 전쟁이 멈추고 휴전이 이루어졌습니다.' },
  { age: 0, text: '1940년 3월, 경상북도 안동군의 형편이 어려운 가정에서 2.9kg 남자아이로 태어났습니다. 셋째입니다.' },
];

function dashboard(state) {
  const p = state === 'none' ? PEOPLE.ysu : PEOPLE.smin;
  const year = state === 'projection' ? 2031 : state === 'none' ? 1963 : 2000;
  const age = year - p.born;
  const rows = state === 'projection' ? ROWS_2031 : state === 'none' ? ROWS_1963 : ROWS_2000;
  const ageGroup = age >= 55 ? 'middle' : 'young';
  const assets = state === 'none' ? assetsCard({ mode: 'none', year, net: 300, income: 900, debt: 0 }) : state === 'projection' ? assetsCard({ mode: 'future', year, net: 18400, income: 4100, debt: 6200 }) : assetsCard({ mode: state, year, net: -1200, income: 3200, debt: 4800 });
  const family = state === 'projection'
    ? `<dt>어머니</dt><dd>86세<small>${fitPair('은퇴', '돌봄 필요')}</small></dd><dt>아버지</dt><dd>세상을 떠남<small>2027년</small></dd><dt>배우자</dt><dd>56세<small>${fitPair('사무직', '건강함')}</small></dd><dt>자녀</dt><dd>딸 27세, 아들 24세</dd>`
    : state === 'none'
      ? `<dt>어머니</dt><dd>50세<small>${fitPair('농업', '건강함')}</small></dd><dt>아버지</dt><dd>54세<small>${fitPair('농업', '허리가 아픔')}</small></dd><dt>형제자매</dt><dd>형 27세, 누나 25세, 남동생 19세</dd><dt>배우자</dt><dd>없음</dd>`
      : `<dt>어머니</dt><dd>55세<small>${fitPair('판매직', '건강함')}</small></dd><dt>아버지</dt><dd>58세<small>${fitPair('기계 조작직', '건강함')}</small></dd><dt>형제자매</dt><dd>누나 31세 <small>3세 위</small></dd><dt>배우자</dt><dd>없음</dd><dt>자녀</dt><dd>없음</dd>`;
  const peers = state === 'none'
    ? [['이영자', '여성', '전라남도 나주군', 1, '농사일'], ['김철수', '남성', '서울특별시 영등포구', 3, '일하는 사람'], ['박순자', '여성', '경상남도 밀양군', 1, '집안일'], ['정기호', '남성', '강원도 삼척군', 2, '일하는 사람']]
    : [['이정훈', '남성', '서울특별시 관악구', 1, state === 'projection' ? '일하는 사람' : '구직 중'], ['박미경', '여성', '전라남도 순천시', 2, '일하는 사람'], ['최성호', '남성', '대구광역시 북구', 4, '일하는 사람'], ['김은주', '여성', '경상남도 진주시', 1, state === 'projection' ? '돌봄' : '일하는 사람']];
  // 연도와 「전망」 칩은 한 칸(.year-row__year) — .year-row의 둘째 자식(진행률 바)이 늘어나는 구조를 지킨다
  const headYear = `<span class="year-row__year"><span class="num">${year}년</span>${state === 'projection' ? projChip() : ''}</span>`;
  return `<header class="dash-head"><div class="dash-head__inner">
    <div class="dash-head__top">${headerLogo()}<div class="who"><h1 class="who__name">${p.name}</h1><span class="who__age"><b>${age}</b>세</span></div></div>
    <div class="year-row">${headYear}<div class="year-progress" role="progressbar" aria-label="올해 진행률" aria-valuemin="0" aria-valuemax="100" aria-valuenow="38"><div class="year-progress__fill" style="width:38%"></div></div><span class="year-row__pct num">38%</span></div>
  </div></header>
  <div class="toolbar"><div class="toolbar__inner">
    <div class="controls-fixed" role="group" aria-label="진행 조작" data-testid="bottom-bar">
      <div class="controls__speed"><button class="btn btn--sm" type="button">${icon('pause', 'icon--sm')}<span>일시정지</span></button><button class="btn btn--sm" type="button" aria-pressed="true">1배</button><button class="btn btn--sm" type="button">2배</button><button class="btn btn--sm" type="button">4배</button><button class="btn btn--sm" type="button">8배</button></div>
      <div class="controls__more"><button class="btn btn--sm btn--secondary" type="button">${icon('next', 'icon--sm')}<span>다음 결정으로</span></button><button class="btn btn--sm btn--secondary" type="button" aria-pressed="false">${icon('auto', 'icon--sm')}<span>자동 모드 꺼짐</span></button></div>
    </div>
    <div class="controls__tools" role="group" aria-label="도구"><button class="btn btn--tool" type="button" data-tool="bgm" aria-pressed="false">${icon('music')}<span>BGM</span><span class="sr-only"></span></button><button class="btn btn--tool" type="button" data-tool="note" aria-haspopup="dialog">${icon('pencil')}<span>생각 남기기</span></button><button class="btn btn--tool" type="button" data-tool="dark" aria-pressed="false">${icon('moon')}<span>다크 모드</span><span class="sr-only"></span></button><button class="btn btn--tool" type="button" data-tool="feedback" aria-pressed="false">${icon('message')}<span>의견 보내기</span><span class="sr-only"></span></button><button class="btn btn--tool" type="button" data-tool="exit" aria-pressed="false">${icon('exit')}<span>나가기</span><span class="sr-only"></span></button></div>
  </div></div>
<main class="dash">
  <div class="col">
    <section class="card profile" aria-label="프로필">
  <div class="profile__top">${face(ageGroup, p.gender, 3, `${p.name}의 얼굴`, 'face--lg')}<div><p class="profile__name">${p.name}</p><p class="t-sm t-muted">남성</p></div></div>
  <dl class="facts">
    <dt>출생</dt><dd>${p.born}년 ${p === PEOPLE.ysu ? 3 : 5}월</dd>
    <dt>세대</dt><dd>${p.gen}</dd>
    <dt>거주</dt><dd>${state === 'projection' ? '경기도 용인시 수지구' : state === 'none' ? '경상북도 대구시' : p.placeNow}</dd>
    <dt>출신 가정</dt><dd><span class="grade-line">${gradeChip(p.grade, { range: p.range })}</span></dd>
    <dt>학력</dt><dd>${state === 'none' ? '초등학교 졸업' : '대학교 졸업'}</dd>
    <dt>외모</dt><dd>상위 약 52% <small>또래 사이에서</small></dd>
  </dl></section>
    <section class="card stack stack--sm" aria-label="상태" data-testid="stats"><div class="card__head card__head--flush"><h2 class="card__title">상태</h2></div>${meter('health', state === 'none' ? 70 : state === 'projection' ? 58 : 74)}${meter('happy', 58)}${meter('knowledge', state === 'none' ? 38 : 66)}${meter('relation', 62)}<details class="disclosure"><summary>상태와 자산의 뜻 보기</summary><p>0에서 100 사이의 값입니다. 건강은 몸의 상태, 행복은 마음의 만족, 지식은 배우고 익힌 정도, 관계는 <span class="keep-phrase">가족·친구와의</span> 유대입니다. ${GM3_TEXT.helpMoney} 순자산, 연 소득, 부채는 내 가구 기준이며 결혼한 뒤에는 배우자와 자녀의 몫까지 합한 값입니다. 선택지 아래 표시는 <span class="keep-phrase">그 선택만으로</span> 생기는 변화이고, 해마다의 소득과 생활비는 따로 더해집니다.</p></details></section>
    ${assets}
  </div>
  <div class="col col--center"><section class="card log" aria-label="인생 기록"><div class="card__head" style="margin-bottom:var(--sp-2)"><h2 class="card__title">인생 기록</h2><span class="t-xs t-faint"><span class="keep-phrase">최신순 · 아래로</span> 스크롤하면 지난 기록</span></div>
  <div class="log__list" role="region" aria-label="인생 기록" tabindex="0"><ol class="log__rows" aria-live="polite" aria-relevant="additions">${rows.map(logRow).join('')}</ol></div></section></div>
  <div class="col">
    <section class="card family" aria-label="식구"><h2 class="card__title" style="margin-bottom:var(--sp-3)">식구</h2><dl class="family-list">${family}</dl></section>
    <section class="card peers-now" aria-labelledby="peers-now-t"><div class="card__head" style="margin-bottom:var(--sp-1)"><h2 id="peers-now-t" class="card__title">같은 해 태어난 사람들</h2><span class="card__sub">요즘 모습</span></div><ul class="people">${peers.map(([n, g, pl, gr, now]) => `<li><div class="people__who"><div class="people__line"><span class="name">${n}</span> <span class="sub">${g}</span></div><div class="sub">${pl}</div></div>${gradeChip(gr)}<span class="people__now">${now}</span></li>`).join('')}</ul><p class="t-xs t-faint">나이와 수저에 따라 정한 설계값입니다(통계가 아님).</p></section>
    <p class="mock-tag">시안 · 가짜 데이터 — 연표 문장은 설계 문서 예시, 확정 전</p>
  </div>
</main>
<div class="page-end-space"></div>`;
}
function buildDashboard() {
  const body = `${GM3_SPRITE}
${dashboard('then')}
${['now', 'projection', 'none'].map((s) => `<template id="state-${s}">${dashboard(s)}</template>`).join('\n')}
<script>(function(){var s=new URLSearchParams(location.search).get('state');if(!s||s==='then')return;var t=document.getElementById('state-'+s);if(!t)return;['.dash-head','.toolbar','main.dash','.page-end-space'].forEach(function(sel){var el=document.querySelector(sel);if(el)el.remove();});document.body.appendChild(t.content.cloneNode(true));})();</script>`;
  const html = page({ title: '수저 게임 · 시안 · 인생 기록 연표 줄·자산 카드 당시 화폐(SPEC-004 GM3)', body, bodyClass: 'is-dash', head: '<link rel="stylesheet" href="gm3.css">' })
    .replace('<html lang="ko">', '<html lang="ko" data-paper="1">')
    .replace('href="../../../src/styles/tokens.css"', 'href="../../../../src/styles/tokens.css"')
    .replace('href="ds.css"', 'href="../ds.css"');
  writeFileSync(`${OUT}dashboard-004.html`, html);
}

// ============================================================ ④ 엔딩 ============================================================
function tlItem({ age, year, tl, text, kind = 'event', cls = '' }) {
  const ageCell = `<span class="log__age">${age}세${year ? `<small class="log__year">${year}</small>` : ''}</span>`;
  if (tl) return `<li class="is-tl" data-kind="timeline" data-tl="${tl}">${ageCell}<span>${tlLabel(tl)}<span class="tl-text">${text}</span></span></li>`;
  return `<li class="${cls}" data-kind="${kind}">${ageCell}<span>${text}</span></li>`;
}
const splitRow = () => `<li class="timeline__split" aria-label="${GM3_TEXT.projSplit}">${projChip()}<span>${GM3_TEXT.projSplit} · 기준 시나리오</span></li>`;

function ending(state) {
  const future = state !== '2010';
  const p = future ? PEOPLE.smin : PEOPLE.ysu;
  const deathYear = future ? 2041 : 2010;
  const deathAge = deathYear - p.born;
  const originSet = future; // 비교 카드는 내 출신 시도 설정이 있을 때만(RG4)
  const finalNet = future
    ? `<dl class="final-net"><dt>최종 순자산</dt><dd><span class="final-net__value nowrap">${won(18400)}</span><span class="final-net__view"><span class="tag" id="final-basis">${GM3_TEXT.tagNow}</span></span></dd></dl>`
    : `<dl class="final-net"><dt>최종 순자산</dt><dd><span class="final-net__value nowrap">${won(conv(12345, 0.7407))}</span><span class="final-net__view"><span class="tag" id="final-basis">${GM3_TEXT.tagThen}</span><button type="button" class="btn btn--ghost btn--sm" aria-describedby="final-basis">${GM3_TEXT.toNow}<span class="sr-only"> ${GM3_TEXT.viewingThen}</span></button></span><span class="final-net__basis">${GM3_TEXT.basisThen(2010)}</span></dd></dl>`;
  const groups = future
    ? [
        ['영유아 · 0~6세', [tlItem({ age: 0, text: '1972년 5월, 부산직할시 동래구의 형편이 보통인 가정에서 3.2kg 남자아이로 태어났습니다. 둘째입니다.' })]],
        ['학창 · 7~19세', [tlItem({ age: 8, year: 1980, tl: 'local', text: '그해 5월 광주에서 있었던 일을 라디오 뉴스로 전해 들었습니다.' }), tlItem({ age: 15, year: 1987, tl: 'bg', text: '이 해 헌법이 바뀌어 대통령을 국민이 직접 뽑게 되었습니다.' }), tlItem({ age: 19, year: 1991, tl: 'year', text: '시험이 끝난 날 친구들과 처음 노래방에 갔습니다.' })]],
        ['청년 · 20~39세', [tlItem({ age: 20, kind: 'stage', text: '스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.' }), tlItem({ age: 25, year: 1997, tl: 'year', text: '졸업했지만 채용 공고가 사라졌습니다.' }), `<li class="is-choice" data-kind="choice"><span class="log__age">31세</span><span><strong>살 곳을 구하는 일</strong><span class="tl-picked">선택: 보증금이 낮은 월세방을 구한다</span><span class="tl-text">보증금이 낮은 월세방을 구했습니다.</span></span></li>`]],
        ['중년 · 40~64세', [tlItem({ age: 40, kind: 'stage', text: '어느덧 마흔이 되었습니다.' }), tlItem({ age: 53, text: '주변에서 일터를 떠나는 사람이 부쩍 늘었습니다.' }), splitRow(), tlItem({ age: 57, year: 2029, tl: 'proj', text: '돌봄이 필요한 식구가 생길 수도 있습니다.' }), tlItem({ age: 59, year: 2031, tl: 'proj', text: '정년을 두고 회사 안에서 이야기가 오갈 수도 있습니다.' })]],
        ['노년 · 65세~', [tlItem({ age: 65, kind: 'stage', text: '예순다섯이 되었습니다. 일에서 한 걸음 물러설 나이입니다.' }), tlItem({ age: 67, year: 2039, tl: 'proj', text: '연금을 받기 시작하는 나이가 지금과 다를 수도 있습니다.' }), tlItem({ age: 69, kind: 'death', text: '세상을 떠났습니다. 원인은 오랜 병이었습니다.' })]],
      ]
    : [
        ['영유아 · 0~6세', [tlItem({ age: 0, text: '1940년 3월, 경상북도 안동군의 형편이 어려운 가정에서 2.9kg 남자아이로 태어났습니다. 셋째입니다.' })]],
        ['학창 · 7~19세', [tlItem({ age: 10, year: 1950, tl: 'bg', text: '이 해 전쟁이 시작되었습니다.' }), tlItem({ age: 13, year: 1953, tl: 'bg', text: '이 해 전쟁이 멈추고 휴전이 이루어졌습니다.' })]],
        ['청년 · 20~39세', [tlItem({ age: 20, kind: 'stage', text: '스무 살이 되었습니다. 이제부터는 집안 형편이 아니라 내가 가진 것으로 살아갑니다.' }), tlItem({ age: 23, text: '공장에서 일자리를 얻어 도시로 나왔습니다.' }), tlItem({ age: 33, year: 1973, tl: 'year', text: '기름값이 올라 가게마다 값표가 바뀐다는 말을 들었습니다.' })]],
        ['중년 · 40~64세', [tlItem({ age: 40, kind: 'stage', text: '어느덧 마흔이 되었습니다.' }), tlItem({ age: 57, year: 1997, tl: 'year', text: '회사에서 명예퇴직을 권유받았습니다.' })]],
        ['노년 · 65세~', [tlItem({ age: 65, kind: 'stage', text: '예순다섯이 되었습니다. 일에서 한 걸음 물러설 나이입니다.' }), tlItem({ age: 70, kind: 'death', text: '세상을 떠났습니다. 원인은 노환이었습니다.' })]],
      ];
  const compare = originSet
    ? `<section class="card same-event" aria-labelledby="compare-title"><h2 id="compare-title" class="card__title card__title--gap">${GM3_TEXT.compareTitle}</h2>
    <ul class="same-event__list"><li class="same-event__item"><span class="log__age">8세<small class="log__year">1980</small></span><span><span class="tl-text">그해 5월 광주에서 있었던 일</span><span class="same-event__facts"><span>직접 영향 시도 <b>광주</b></span><span>이 판(부산) <b>라디오 뉴스로 전해 들었습니다</b></span><span>내 출신 시도(서울) <b>그 밖 지역</b></span></span></span></li></ul>
    <p class="same-event__close">${GM3_TEXT.compareClose}</p><p class="t-xs t-faint">내 출신 시도는 설정에서 고른 값이고 <span class="keep-phrase">이 기기</span> 밖으로 나가지 않습니다. 관계는 공공 기록의 지리 사실이며, 그곳 사람들의 체감을 말하지 않습니다.</p></section>`
    : '';
  return `<main class="ending" data-state="${state}">
  <div class="ending__head">${face(deathAge >= 65 ? 'senior' : 'middle', p.gender, 3, `${p.name}의 얼굴`, 'face--lg')}
    <div class="ending__who"><p class="label">생애 기록</p><h1 class="t-title" style="--title-chars:5">${p.name}의 인생</h1><p class="t-muted"><span class="nowrap">${p.born}년 ${p === PEOPLE.ysu ? 3 : 5}월</span> ~ <span class="keep-phrase"><span class="nowrap">${deathYear}년</span> · <span class="nowrap">${deathAge}세</span></span></p>
    <div class="ending__meta"><span><b>${GM3_TEXT.endingGen(p.gen, p.born)}</b></span><span>${GM3_TEXT.endingBorn(p.place)}</span>${future ? `<span>${projChip()}${GM3_TEXT.endingProj('기준')}</span>` : ''}</div></div></div>
  <section class="card stack--sm stack" aria-label="사망과 선택"><p>${deathAge}세에 세상을 떠났습니다. 원인은 ${future ? '오랜 병' : '노환'}이었습니다.</p><p class="t-muted">살아오며 ${future ? 24 : 21}번의 선택을 했습니다.</p></section>
  <section class="card" aria-labelledby="ending-journey-title"><h2 id="ending-journey-title" class="card__title card__title--gap">출발선에서 마지막까지</h2>
    <div class="journey">
      <div class="journey__bar" role="img" aria-label="${future ? '출발선 하위 33%와 상위 36% 사이, 마지막 상위 약 41%.' : '출발선 하위 40% 안쪽, 마지막 하위 약 46%.'}">
        <div class="journey__track"><span class="journey__band" style="${future ? '--from:33%;--to:64%' : '--from:0%;--to:40%'}"></span><span class="journey__mid"></span><span class="journey__end" style="--at:${future ? 59 : 46}%"></span></div>
        <div class="journey__axis" aria-hidden="true"><span>하위</span><span>상위</span></div></div>
      <dl class="journey__legend">
        <div><dt><i class="journey__key journey__key--band" aria-hidden="true"></i>출발선</dt><dd class="grade-line">${gradeChip(p.grade, { range: p.range })}</dd></div>
        <div><dt><i class="journey__key journey__key--end" aria-hidden="true"></i>마지막</dt><dd><span class="nowrap">${future ? '상위 약 41%' : '하위 약 46%'}</span></dd></div>
      </dl>
      <p>${future ? '<span class="nowrap">하위 33%와</span> <span class="nowrap">상위 36%</span> 사이의 집에서 태어나, <span class="nowrap">상위 약 41%의</span> 형편으로 생을 마쳤습니다.' : '<span class="nowrap">하위 40%</span> <span class="nowrap">안쪽의</span> 집에서 태어나, <span class="nowrap">하위 약 46%의</span> 형편으로 생을 마쳤습니다.'}</p>
      <p>${future ? '출발선과 비슷한 자리입니다.' : '출발선과 비슷한 자리입니다.'}</p><p class="t-xs t-faint">재산은 어릴 때는 집안 형편이고 스무 살부터는 내가 가진 것이라, 숫자를 빼서 견주지 않고 같은 세대 안의 자리로 견주었습니다.</p>
    </div></section>
  <section class="card stack stack--sm ending-stats" aria-labelledby="ending-stats-title"><h2 id="ending-stats-title" class="card__title">최종 스탯</h2>${meter('health', 41)}${meter('happy', 66)}${meter('knowledge', future ? 66 : 44)}${meter('relation', 72)}${finalNet}</section>
  ${compare}
  <section class="card" aria-labelledby="ending-timeline-title"><h2 id="ending-timeline-title" class="card__title card__title--gap">생애 연표</h2>${groups.map(([h, items]) => `<div class="tl-group"><h3>${h}</h3><ol class="timeline">${items.join('')}</ol></div>`).join('')}</section>
  <section class="rebirth"><button class="btn btn--primary btn--lg btn--block" type="button">다시 태어나기</button><p class="t-sm t-muted">첫 화면의 세대 선택으로 돌아갑니다. 다시 태어나면 <span class="keep-phrase">이 인생의</span> 기록은 사라집니다.</p></section>
  <p class="mock-tag">시안 · 가짜 데이터 — 연표 문장은 설계 문서 예시, 확정 전</p>
</main>`;
}
function buildEnding() {
  const body = `${GM3_SPRITE}
${ending('future')}
<template id="state-2010">${ending('2010')}</template>
<script>(function(){var s=new URLSearchParams(location.search).get('state');var t=document.getElementById('state-'+s);if(!t)return;document.querySelector('main.ending').replaceWith(t.content.cloneNode(true));})();</script>`;
  const html = page({ title: '수저 게임 · 시안 · 엔딩 세대 표기·최종 순자산(SPEC-004 GM3)', body, head: '<link rel="stylesheet" href="gm3.css">' })
    .replace('<html lang="ko">', '<html lang="ko" data-paper="1">')
    .replace('href="../../../src/styles/tokens.css"', 'href="../../../../src/styles/tokens.css"')
    .replace('href="ds.css"', 'href="../ds.css"');
  writeFileSync(`${OUT}ending-004.html`, html);
}

buildTitle();
buildRoulette();
buildBirth();
buildDashboard();
buildEnding();
console.log('gm3 mockups →', OUT.replace(ROOT, ''), ['title-004', 'roulette-004', 'birth-004', 'dashboard-004', 'ending-004'].join(' · '));
