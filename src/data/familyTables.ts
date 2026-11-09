import tablesJson from './family/tables.json';
import type { FamilyDesign, FamilyTables } from '../core/gameData';

/**
 * 가족 모델의 표 덩어리 `familyData` (SPEC-009 FM4a, 설계 문서 D-4·A-10): 「태어나기」 뒤 게임 데이터(이벤트 풀·출생 연도 표·인용·이름 풀)와 **함께** 지연 로드된다.
 * 첫 화면은 이 파일을 정적으로 import하지 않는다(`tests/lazyBoundary.test.ts`가 잠근다) — `data/gameData.ts`가 동적 `import()`로만 부르고, 시험·스크립트는 `data/installAll.ts`가 정적으로 놓는다.
 *
 * 값은 `docs/data/fd-a-family.json`·`src/data/koreaStats.json`에서 `scripts/genFamilyTables.ts`(`npm run gen:family`)가 뽑은 `family/tables.json`이다 — 직접 고치지 않는다. 묶음 B(집 종류·방 수)·C(이사·실직·병환)·D(반려동물·가진 것)의 표는
 * 자료가 올 때 이 파일에 칸을 더한다 — 그 전에는 칸이 없고 코어가 「자료가 오기 전 동작」(설계 문서 11절)으로 돈다.
 */
/**
 * 코어가 쓰는 설계값 (R-534, CR-DATA): 확률·밸런스 값은 코어에 박지 않고 근거와 함께 여기 둔다 — 코어는 `familyTables().design`으로 읽는다. 값을 바꾸면 알려진 시드의 가족이 달라진다(배포 뒤에는 바꾸지 않는다).
 */
export const FAMILY_DESIGN: FamilyDesign = {
  paternalSideShare: { value: 0.7, basis: 'design', note: '함께 사는 조부모가 두 쪽 모두 후보일 때 친가를 고를 확률 — 통계가 없는 설계값(자료가 있으면 교체, 4-4절)' },
  divorceFatherLeaves: { value: 0.8, basis: 'design', note: '부모 이혼 때 따로 사는 쪽이 아버지일 확률 — 통계가 없는 설계값(4-7절 (2))' },
  maleShare: { value: 0.5, basis: 'design', note: '아래 동생의 성별은 균등(남 0.5) — 설계값(위 형제는 옛 계산의 성별을 따른다)' },
  leaveAge: { value: { min: 20, max: 30 }, basis: 'design', note: '형제 독립 나이는 20~30 균등 — 설계값(SPEC FA3)' },
  continueCap: { value: 0.9, basis: 'design', note: '아래 동생 이어짐 확률 a_1·a_2는 이 판의 출산 순위 비중 비로 구하고 0.9에서 자른다 — 설계값' },
  home: {
    value: {
      before1970AptPct: 0.1,
      shackYears: [1940, 1999],
      rentRoomPoints: [[1969, 0.85], [1990, 0.85], [2005, 0.6], [2020, 0.5]],
      roomFloorPermille: 50,
      regionClassOf: {
        seoul: 'capital', incheon: 'capital', gyeonggi: 'capital',
        busan: 'metro', daegu: 'metro', gwangju: 'metro', daejeon: 'metro', ulsan: 'metro', sejong: 'metro',
        gangwon: 'province', chungbuk: 'province', chungnam: 'province', jeonbuk: 'province', jeonnam: 'province', gyeongbuk: 'province', gyeongnam: 'province', jeju: 'province',
      },
      parentOf: { daegu: 'gyeongbuk', incheon: 'gyeonggi', gwangju: 'jeonnam', daejeon: 'chungnam', ulsan: 'gyeongnam', sejong: 'chungnam' },
      stepSegments: [[1975, 1980], [2000, 2005], [2010, 2015]],
    },
    basis: 'design',
    note: '집 종류 분포의 빈 구간을 메우는 규칙(fd-b-house.md 10절 마스터 결정): 센서스 해 사이는 선형 보간(추정), 분류가 바뀌는 구간(1975→80, 2000→05, 2010→15)은 가까운 해, 1969 이하는 1970 구성비(설계값, 아파트 칸 0.1%), 승격 전 광역시는 부모 도 줄. 점유 형태·소득계층·방 수는 센서스·주거실태조사 칸에서 독립 가정의 곱으로 얻고, 셋방 비율·방 수 문턱·지역 3분류·주택 이외의 거처 연도는 통계가 없는 설계값(전체 가구 기준이라 갓난아이 가구의 선택 효과는 보정하지 않았다)',
  },
  highOrderContinue: {
    // 어머니 출생 코호트(5년) → 3명 이상을 낳은 어머니가 한 명 더 낳을 확률. scripts/calibrateHighOrder.ts가 FD6 코호트 평균 출생아 수(fd6_mean_children_by_age_calc)에 맞춘 값 — 아래 표를 다시 만들 때는 그 스크립트를 쓴다
    value: [
      { upTo: 1900, cap: 0.98, q: 0.97, gapMax: 3 },
      { upTo: 1905, cap: 0.98, q: 0.97, gapMax: 3 },
      { upTo: 1910, cap: 0.98, q: 0.97, gapMax: 3 },
      { upTo: 1915, cap: 0.98, q: 0.954, gapMax: 3 },
      { upTo: 1920, cap: 0.98, q: 0.97, gapMax: 3 },
      { upTo: 1925, cap: 0.98, q: 0.97, gapMax: 3 },
      { upTo: 1930, cap: 0.98, q: 0.964, gapMax: 4 },
      { upTo: 1935, cap: 0.98, q: 0.909, gapMax: 5 },
      { upTo: 1940, cap: 0.98, q: 0.754, gapMax: 5 },
      { upTo: 1945, cap: 0.98, q: 0.469, gapMax: 5 },
    ],
    basis: 'design',
    note: '1945년 이전 출생 어머니의 3째 이후 이어짐 확률 — 공표 출산 순위 비중에서 유도한 값은 출산이 많던 코호트의 총 자녀 수를 낮게 만들어(모형 3.0~3.2명 vs FD6 3.4~5.6), 코호트별로 FD6 센서스 평균 출생아 수에 맞춘 설계값(1941~45는 FM4b 검수 R-565로 더했다)',
  },
  siblingLoss: {
    value: { enabled: true, scale: 1, maxBirthYear: 1969, sibAge: { min: 1, max: 11 }, heroAge: { min: 1, max: 19 } },
    basis: 'estimated',
    note: '어린 형제의 이른 별세(Q3): 1969년 이하 출생 판에서 구성에 있는 형제가 1~11세에 떠날 확률은 부모·조부모와 같은 코호트 생존 곡선(간이생명표 영아·아동 사망확률 — 1970~2024 확인, 1970 앞은 기대수명 척도 외삽 추정)으로 정한다. 배율 1.0(형진 님 2026-11-06 — 실제 생명표 그대로). 한 판 최대 한 명, 기록 전용(스탯·자산 불변). 숫자는 화면에 쓰지 않는다(GE5)',
  },
  earlyLoss: {
    value: {
      enabled: true,
      maxAge: 19,
      stats: { happiness: -8, relationships: -2, health: -1 },
      family: { father: -500, mother: -300, motherHomemaker: -150 },
      wealthMultiplier: [0.8, 1.0, 1.2, 1.6, 2.0],
    },
    basis: 'design',
    note: '주인공 19세 이하에 부모 한 분이 떠나는 해에만 한 번 — 행복 −8·관계 −2·건강 −1, 집안 살림은 아버지 −500·어머니 −300(집안일이면 −150)만 원에 재력 단계 배율 0.8~2.0. A-6 초안(통계 없는 설계값)이고 FM4b 재측정(docs/data/family-remeasure.md)으로 확인했다. 20세 이상은 기록 전용',
  },
  adult: {
    value: {
      spouseGap: { min: -4, max: 15, peak: 2.5, spread: 3.5 },
      spouseMinAge: 20,
      childCount: [
        { upTo: 1975, weights: [0.1, 0.25, 0.35, 0.3] },
        { upTo: 1985, weights: [0.2, 0.45, 0.25, 0.1] },
        { upTo: 1995, weights: [0.3, 0.52, 0.15, 0.03] },
        { upTo: 9999, weights: [0.4, 0.47, 0.11, 0.02] },
      ],
      childGap: { min: 2, max: 5 },
      childLastAge: 45,
      friendCount: [0.45, 0.35, 0.2],
      friendAgeOffset: { min: -2, max: 2 },
      fallbackAt: { spouse: 24, child: 28, friend: 12 },
      jobs: { studentAge: { min: 6, max: 22 }, retireAge: { agri: { min: 65, max: 75 }, other: { min: 55, max: 65 } }, homemakerRetireAge: 65 },
    },
    basis: 'design',
    note: '성인기 식구(배우자·자녀·가까운 친구)의 수와 나이는 통계가 아니라 게임이 정한 값이다 — 배우자 나이 차는 부모 나이 차(FATHER_GAP)와 같은 모양이되 처음 만난 해에는 20세 이상(표의 나이 차가 더 어리게 만들면 출생 연도를 당긴다, R-573), 자녀는 첫 자녀를 낳은 시대에 따라 1~4명(표시 전용 — 경제는 자녀 수를 읽지 않는다), 터울 2~5년, 친구는 1~3명. 출산력 코호트 분포(FD6)에 맞춘 값이 아니다',
  },
  closeness: {
    value: {
      base: { mother: 4, father: 4, grandparent: 3, sibling: 3, spouse: 4, child: 4, friend: 4 },
      parenting: { neglect: -2, strict: -1, free: 0, helicopter: 1 },
      seedStep: { down: 0.2, up: 0.2 },
      flags: [
        { flag: 'sibling_close', who: ['sibling'], delta: 1, note: '동생이 생겼을 때 곁에서 챙긴 일 — 관계 +3' },
        { flag: 'grandparent_close', who: ['grandparent'], delta: 1, floor: 4, note: '조부모가 돌봐 주었다 — 관계 +3 (켜진 판의 조부모 사이는 「가까움」 이상)' },
        { flag: 'cared_parents', who: ['mother', 'father'], delta: 1, note: '부모를 직접 돌봤다 — 관계 +4' },
        { flag: 'parent_strained', who: ['mother', 'father'], delta: -1, note: '떼를 쓰다 거절당해 서먹해졌다 — 관계 −1 (어린 시절, 평생 유지)' },
        { flag: 'child_distant', who: ['child'], delta: -2, note: '자녀와 서먹해졌다 — 관계 −3' },
        { flag: 'child_left', who: ['child'], delta: -1, note: '자녀가 독립해 떠났다 — 관계 −2' },
        { flag: 'friend_back', who: ['friend'], delta: 1, note: '친구가 곁으로 돌아왔다 — 관계 +5' },
        { flag: 'close_friend', when: 'off', who: ['friend'], cap: 1, note: '가까운 친구와 멀어졌다 — 관계 −3, −2 (친구는 「멀어진 친구」로 남는다)' },
        { flag: 'divorced', who: ['spouse'], cap: 1, note: '이혼 — 관계 −4' },
        { flag: 'mother_apart', who: ['mother'], delta: -1, note: '부모 이혼·별거로 따로 삶 (인생 기록 줄만, 점수 없음)' },
        { flag: 'father_apart', who: ['father'], delta: -1, note: '부모 이혼·별거로 따로 삶 (인생 기록 줄만, 점수 없음)' },
      ],
    },
    basis: 'design',
    note: '사이의 다섯 단계(아주 가까움~멀어짐)는 통계가 없다 — 호칭별 기본값 + 부모는 양육 방식 기울임(방임 −2, 엄격 −1, 자율 0, 과보호 +1) + 시드 ±1단계(각 20%)에 사건이 켠 플래그가 만드는 변화를 더한 설계값이다. 사건 없이 슬며시 바뀌지 않는다',
  },
  pets: {
    value: {
      names: ['바둑이', '누렁이', '흰둥이', '쫑이', '별이', '초코', '콩이', '보리', '나비', '구름', '두부', '몽이', '하루', '달이', '밤이', '복실이'],
      lifeYears: { dog: { min: 10, max: 16 }, cat: { min: 12, max: 18 }, other: { min: 2, max: 8 } },
    },
    basis: 'design',
    note: '반려동물의 이름 목록과 종별 수명(개 10~16년, 고양이 12~18년, 그 밖 2~8년 균등)은 공식 통계가 없는 설계값이다. 부모 집의 반려동물(마당 개 → 실내 반려동물)은 양육 가구 비율(FD22) 수집 전이라 아직 만들지 않는다 — 입양 사건이 켠 플래그만 읽는다',
  },
  possessions: {
    value: {
      wealthTilt: 0.5,
      displayMax: 8,
      items: [
        { id: 'radio', name: '라디오', start: 1945, points: [[1945, 1], [1955, 6], [1960, 15], [1965, 32], [1970, 55], [1975, 75], [1980, 86], [1990, 92]] },
        { id: 'telephone', name: '유선 전화', start: 1950, points: [[1950, 0.5], [1960, 2], [1970, 6], [1975, 12], [1980, 22], [1985, 48], [1990, 75], [1995, 92], [2000, 97], [2005, 98]] },
        { id: 'tv-bw', name: '흑백 텔레비전', start: 1961, tie: 'tv', points: [[1961, 0.3], [1965, 3], [1970, 7], [1975, 27], [1980, 75], [1985, 92], [1990, 96]] },
        { id: 'tv-color', name: '컬러 텔레비전', start: 1980, tie: 'tv', supersedes: 'tv-bw', points: [[1980, 0.5], [1985, 15], [1990, 70], [1995, 94], [2000, 98]] },
        { id: 'refrigerator', name: '냉장고', start: 1965, points: [[1965, 0.5], [1970, 3], [1975, 10], [1980, 32], [1985, 62], [1990, 90], [1995, 98]] },
        { id: 'washer', name: '세탁기', start: 1969, points: [[1969, 0.5], [1975, 6], [1980, 18], [1985, 38], [1990, 62], [1995, 82], [2000, 92], [2010, 97]] },
        { id: 'fan', name: '선풍기', start: 1950, points: [[1950, 0.5], [1960, 4], [1970, 20], [1980, 58], [1990, 90], [2000, 97]] },
        { id: 'aircon', name: '에어컨', start: 1980, tie: 'aircon', points: [[1980, 0.5], [1990, 5], [2000, 22], [2005, 38], [2010, 60], [2015, 70], [2020, 82], [2025, 86]] },
        { id: 'microwave', name: '전자레인지', start: 1985, points: [[1985, 0.5], [1990, 8], [1995, 25], [2000, 50], [2005, 70], [2010, 86], [2015, 92]] },
        { id: 'car', name: '승용차', start: 1970, tie: 'car', points: [[1970, 0.5], [1980, 2.5], [1990, 20], [2000, 58], [2010, 76], [2020, 83], [2025, 84]] },
        { id: 'computer', name: '컴퓨터', start: 1985, points: [[1985, 0.5], [1990, 5], [1995, 16], [2000, 50], [2005, 76], [2010, 80]] },
        { id: 'internet', name: '인터넷', start: 1994, points: [[1994, 0.5], [1997, 5], [2000, 40], [2003, 70], [2005, 78], [2010, 92], [2015, 98]] },
        { id: 'mobile', name: '휴대전화', start: 1988, points: [[1988, 0.2], [1995, 6], [2000, 62], [2003, 85], [2005, 95]] },
        { id: 'smartphone', name: '스마트폰', start: 2009, points: [[2009, 0.5], [2011, 35], [2013, 70], [2015, 86], [2020, 95]] },
      ],
    },
    basis: 'design',
    note: '가진 것의 보급 연도와 가구 보급률 곡선은 가구 내구재 보급률 통계(FD23)를 수집하기 전에 상식 수준으로 정한 **설계값**이다 — 항목마다 처음 보급된 해와 그 뒤의 증가 모양만 맞췄다. 수저 단계 기울임(0.5)도 소득계층별 자료가 없어 설계값이고, 전체 가구의 평균이 이 곡선이 되도록 평균 보존 방식으로 얹었다. 2025년 뒤에는 새 물건을 만들지 않고 2025년 세트를 유지한다. 보급률 숫자는 화면에 쓰지 않는다',
  },
};


/**
 * 표의 근거 표시 (FA0-4 `basis`): `official` 확인, `calc` 확인(환산), `estimated` 추정, `design` 설계값. **화면의 접이식 「이 칸은 어떻게 정했나요」(가족과 삶 카드 맨 아래)가 그대로 읽는 글**이라
 * 합쇼체 한 두 문장이고 내부 이름(표 번호·파일 경로·상수 이름)을 쓰지 않는다 — 시험(`tests/familyCard.test.ts`)이 그것을 지킨다. 값의 출처와 정리 규칙은 `docs/data/family-model.md`·`fd-a-family.md`에 있다.
 */
const pct = (x: number): string => `${Math.round(x * 100)}%`;
/** 직업 줄의 나이 값 — 근거 칸 글이 이 값으로 조립된다(표와 글이 갈리지 않게, R-582) */
const JOBS = FAMILY_DESIGN.adult.value.jobs;
export const FAMILY_BASIS: ReadonlyArray<{ id: string; basis: 'official' | 'calc' | 'estimated' | 'design'; note: string }> = [
  { id: 'mortality-1970-2024', basis: 'official', note: '식구가 몇 살까지 사셨는지는 통계청 간이생명표(1970~2024년)의 나이대별 사망확률로 정했습니다. 2024년 뒤에는 2024년 값을 그대로 씁니다.' },
  { id: 'mortality-before-1970', basis: 'estimated', note: '1970년 앞의 생명표는 없어서, 1970년 값에 배율을 곱해 기대수명이 1970년대 추세선을 거꾸로 이은 값이 되게 맞췄습니다(30세 아래로는 내리지 않았습니다).' },
  { id: 'mother-age-1981+', basis: 'official', note: '어머니가 아이를 낳은 나이는 인구동향조사의 연령별 출생아 구성비(1981~2025년)를 썼습니다.' },
  { id: 'mother-age-1956-1980', basis: 'calc', note: '1956~1980년은 인구총조사의 어머니 연령별 자녀 수를 거슬러 계산했습니다(오차 ±0.5세).' },
  { id: 'mother-age-before-1956', basis: 'estimated', note: '1956년 앞 출생은 1966년 인구총조사 표본의 출산 어머니 나이 분포(평균 29.7세)를 그대로 거슬러 썼습니다. 한 해의 분포를 앞 시대에 이은 추정입니다.' },
  { id: 'grand-cohabit-2000-2005', basis: 'calc', note: '조부모와 함께 사는 비율은 인구총조사의 아동 가구 세대 구성(2000년과 2005년)에서 계산했습니다.' },
  { id: 'grand-cohabit-other', basis: 'estimated', note: '그 밖의 해는 3세대 이상 가구 비율에 1.85를 곱해 이었습니다(2000년과 2005년의 실제 배율 1.73과 1.99의 가운데).' },
  { id: 'grand-side', basis: 'design', note: `함께 사는 조부모가 친가인지 외가인지는 통계가 없어 친가 ${pct(FAMILY_DESIGN.paternalSideShare.value)}, 외가 ${pct(1 - FAMILY_DESIGN.paternalSideShare.value)}로 정했습니다.` },
  { id: 'parent-divorce-1993+', basis: 'calc', note: '부모의 이혼은 이혼 건수에 미성년 자녀 수의 하한을 곱해 미성년 인구로 나눈 근사입니다(1993~2025년).' },
  { id: 'parent-divorce-before-1993', basis: 'estimated', note: '1993년 앞은 1993년 값에 조이혼율의 비를 곱해 줄였습니다.' },
  { id: 'parent-divorce-grandparents', basis: 'design', note: '이혼으로 떠난 부모와 같은 쪽 조부모는 다음 해부터 따로 사는 것으로 했습니다. 이혼 뒤 그 집안 조부모와 함께 사는 일은 드물다고 본 설계값입니다.' },
  { id: 'home-kind-census', basis: 'calc', note: '집의 종류는 인구총조사 거처의 종류별 가구 수(시도별, 1970~2025년)에서 여섯 칸 구성비를 계산했습니다. 전체 가구 기준이라 갓난아이가 있는 가구의 특성은 따로 보정하지 않았습니다.' },
  { id: 'home-kind-between-census', basis: 'estimated', note: '조사한 해 사이는 두 해를 이어 계산하고, 분류가 바뀐 구간(1975→80, 2000→05, 2010→15)은 가까운 해의 값을 썼습니다. 시도 줄이 없던 승격 전 광역시는 부모 도의 줄을 썼습니다.' },
  { id: 'home-kind-before-1970', basis: 'design', note: '1969년 이하 출생은 1970년 구성비를 거슬러 썼습니다(건물 종류 표가 없습니다). 아파트는 0.1%, 다세대는 0으로 두고, 주택 이외의 거처는 1940~1999년 출생에서만 나옵니다.' },
  { id: 'home-tenure-income', basis: 'design', note: '자가, 임차, 무상과 소득계층(수저 단계)은 인구총조사와 주거실태조사의 표를 서로 독립이라고 가정해 곱했습니다. 수저 단계를 소득계층으로 섞는 방법은 출생신고와 같고, 시도를 수도권, 광역시 등, 도지역 세 갈래로 묶은 것은 게임이 정했습니다.' },
  { id: 'home-rent-room', basis: 'design', note: '단독주택에 임차로 사는 가구 가운데 셋방인 비율(1990년 앞 85%, 2005년 60%, 2020년 50%)은 통계가 없어 게임이 정했습니다.' },
  { id: 'home-rooms', basis: 'calc', note: '방 수는 인구총조사(1980~2010년)의 거처 종류와 가구원 수별 표에서 뽑았습니다. 1980년 앞은 1980년, 2010년 뒤는 2010년 값을 쓰고, 그해에 아주 드문 방 수는 쓰지 않았습니다.' },
  { id: 'siblings-old-cohort', basis: 'design', note: '1945년 이전 출생 어머니는 자녀가 많던 시대라, 형제 수가 인구총조사의 평균 출생아 수와 ±0.45명 안에서 맞도록 게임이 값을 조정했습니다.' },
  { id: 'early-loss', basis: 'design', note: '19세 이하에 부모 한 분이 떠난 해에는 한 번만 건강 −1, 관계 −2, 행복 −8과 집안 살림(아버지 −500만 원, 어머니 −300만 원에 재력 배율 0.8~2.0)이 더해집니다. 통계가 없는 설계값입니다.' },
  {
    id: 'siblings',
    basis: 'design',
    note: `아래 동생 수는 출생 순위별 출생 비중에서 유도한 근사이고, 터울 2~5년, 독립 나이 ${FAMILY_DESIGN.leaveAge.value.min}~${FAMILY_DESIGN.leaveAge.value.max}세, 성별은 반반으로 게임이 정했습니다.`,
  },
  { id: 'names', basis: 'design', note: '식구 이름은 그 사람의 출생 연도에 맞는 이름 풀에서 뽑았습니다. 1940년대보다 앞서 태어난 분(주로 조부모)은 가장 오래된 1940년대 풀을, 2020년 뒤에 태어난 자녀는 가장 최근 풀을 대신 썼고, 1940년대 풀 자체도 통계가 아닌 추정 목록입니다. 성은 아버지 쪽과 형제가 주인공과 같고 어머니와 조모는 따로 뽑았습니다.' },
  { id: 'parent-job-retire', basis: 'design', note: `부모의 직업은 출생신고에 적힌 값입니다. 은퇴 나이는 농림어업 ${JOBS.retireAge.agri.min}~${JOBS.retireAge.agri.max}세, 그 밖 ${JOBS.retireAge.other.min}~${JOBS.retireAge.other.max}세로 게임이 정했고, 그 나이가 되면 직업 줄이 「은퇴」로 바뀝니다.` },
  { id: 'relatives-job', basis: 'design', note: `형제, 배우자, 자녀, 친구, 조부모의 직업은 통계가 없어, 출생신고의 직업 분포에 시대 보정을 한 값에서 한 번 뽑았습니다. ${JOBS.studentAge.min}~${JOBS.studentAge.max}세는 「학생」으로 봅니다.` },
  { id: 'adult-family', basis: 'design', note: `배우자, 자녀, 가까운 친구의 수와 나이는 통계가 아니라 게임이 정했습니다. 배우자와의 나이 차는 부모 나이 차와 같은 모양이되 처음 만난 해에 ${FAMILY_DESIGN.adult.value.spouseMinAge}세 이상이고, 자녀는 첫 자녀를 낳은 시대에 따라 1~4명(경제에는 쓰이지 않고 보이기만 합니다), 터울은 2~5년, 친구는 1~3명입니다.` },
  { id: 'closeness', basis: 'design', note: '사이의 다섯 단계(아주 가까움~멀어짐)는 통계가 없습니다. 호칭별 기본값, 부모는 양육 방식, 사람마다 한 단계 안팎의 차이에 더해 사건이 바꾼 것만 반영합니다. 사건 없이 슬며시 바뀌지 않습니다.' },
  { id: 'pets', basis: 'design', note: '반려동물의 이름 목록과 수명(개 10~16년, 고양이 12~18년, 그 밖 2~8년)은 통계가 없어 게임이 정했습니다. 부모 집의 반려동물은 아직 만들지 않고, 사건으로 들인 동물만 보입니다.' },
  { id: 'possessions', basis: 'design', note: '집에 있는 것의 보급된 해와 보급 속도는 가구 내구재 보급 통계를 찾아 맞추기 전에 게임이 정한 값입니다. 수저 단계가 높을수록 일찍 들이지만 전체 평균은 이 곡선 그대로입니다. 2025년 뒤에는 새 물건을 만들지 않고, 보급률 숫자는 화면에 쓰지 않습니다.' },
];

export const FAMILY_TABLES: FamilyTables = { ...(tablesJson as unknown as Omit<FamilyTables, 'design' | 'basis'>), design: FAMILY_DESIGN, basis: FAMILY_BASIS };
