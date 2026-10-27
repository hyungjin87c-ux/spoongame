import type { Housing, Occupation, ParentWealth } from '../core/types';

/**
 * 출생신고 상세(SPEC-003 BR2~BR4)의 **설계값** 표. 통계가 아니다 — 통계(출생 월·체중·부모 연령·직업 분포·점유형태·형제 순서)는 data/birthStats.ts가 koreaStats.json에서 읽고,
 * 이 파일은 그 통계에 얹는 「수저 단계별 보정」과 「시대 보정」, 그리고 화면 문구의 이름을 가진다(BR4: 단계별 보정 값은 설계값으로 구분한다).
 * 화면은 출생신고 하단에 설계 보정이 쓰였다는 한 줄을 적는다(data/birthReportText.ts#REPORT_NOTES).
 * 코드가 아니라 이 표만 고치면 되고, tests/birthReport.test.ts가 표 모양(합·범위·모든 칸 채움)과 분포를 확인한다.
 */

// ---------- 직업 (한국표준직업분류 8차 대분류 중 근거 통계표에 있는 9개) ----------

/** 근거 통계표(`occupation-proxy`)의 행 이름 — 통계 행과의 대응 */
export const OCCUPATION_STAT_ROW: Readonly<Record<Occupation, string>> = {
  manager: '관리자',
  professional: '전문가 및 관련 종사자',
  clerk: '사무 종사자',
  service: '서비스 종사자',
  sales: '판매 종사자',
  agri: '농림·어업 숙련 종사자',
  craft: '기능원 및 관련 기능 종사자',
  machine: '장치·기계 조작 및 조립 종사자',
  labor: '단순노무 종사자',
};

/** 서류에 적는 짧은 이름(「29세 · 판매직」) */
export const OCCUPATION_LABEL: Readonly<Record<Occupation, string>> = {
  manager: '관리직',
  professional: '전문직',
  clerk: '사무직',
  service: '서비스직',
  sales: '판매직',
  agri: '농림어업직',
  craft: '기능직',
  machine: '기계 조작직',
  labor: '단순노무직',
};

type JobTilt = Readonly<Record<Occupation, number>>;
const tilt = (manager: number, professional: number, clerk: number, service: number, sales: number, agri: number, craft: number, machine: number, labor: number): JobTilt => ({
  manager,
  professional,
  clerk,
  service,
  sales,
  agri,
  craft,
  machine,
  labor,
});

/**
 * 수저 단계별 직업 가중 배율(설계값). 통계의 30·40대 취업자 분포에 곱한 뒤 다시 정규화한다 — 1·2단계는 서비스·기능·기계·단순노무가, 4·5단계는 관리·전문이 늘어난다.
 * 3단계는 통계 그대로(배율 1). 통계에는 가정 형편별 부모 직업이 없어(`occupation-proxy`는 연령대 분포뿐) 방향만 정한 값이다.
 */
export const JOB_TILT_BY_WEALTH: Readonly<Record<ParentWealth, JobTilt>> = {
  1: tilt(0.2, 0.4, 0.6, 1.5, 1.2, 1.3, 1.5, 1.6, 2.4),
  2: tilt(0.5, 0.7, 0.9, 1.3, 1.1, 1.1, 1.3, 1.3, 1.6),
  3: tilt(1, 1, 1, 1, 1, 1, 1, 1, 1),
  4: tilt(3, 1.5, 1.3, 0.7, 0.9, 0.8, 0.7, 0.7, 0.5),
  5: tilt(15, 2.2, 1.4, 0.5, 0.8, 0.5, 0.4, 0.4, 0.2),
};

/** 어머니·아버지 직업 가중 배율(설계값): 통계표에 성별 구분이 없어 나눌 때 쓴다(BR4 「성별 구분이 없어 설계 보정이 필요」). */
export const JOB_TILT_BY_PARENT: Readonly<Record<'mother' | 'father', JobTilt>> = {
  mother: tilt(0.5, 1, 1.3, 1.4, 1.2, 0.8, 0.4, 0.4, 0.8),
  father: tilt(1.3, 1, 0.8, 0.7, 0.9, 1.1, 1.4, 1.4, 1.1),
};

/**
 * 출생 연도에 따른 출생신고 보정의 두 갈래 (SPEC-004 NR2 — 연도별 근거가 확보되지 않은 항목은 가장 가까운 확보 연도 값을 쓰고 「추정」으로 표기한다):
 * 1989년 이전 출생은 R1의 「지난 세상」 보정을, 1990년 이후 출생은 지금 통계 그대로(보정 없음)를 쓴다. 연도별 표(NR2)가 들어오기 전까지의 전환기 규칙이고 모두 설계값이다.
 */
export type ReportTilt = 'past' | 'present';
export const REPORT_TILT_LAST_PAST_YEAR = 1989;
export function reportTiltOf(birthYear: number): ReportTilt {
  return birthYear <= REPORT_TILT_LAST_PAST_YEAR ? 'past' : 'present';
}

/** 시대 보정(설계값): 1989년 이전 출생은 농림어업·기능직·단순노무가 많고 전문·사무·관리가 적다. 그 뒤는 지금 통계 그대로. */
export const JOB_TILT_BY_ERA: Readonly<Record<ReportTilt, JobTilt>> = {
  past: tilt(0.5, 0.3, 0.5, 1, 1, 8, 2, 1.2, 2),
  present: tilt(1, 1, 1, 1, 1, 1, 1, 1, 1),
};

// ---------- 부모 나이 ----------

/**
 * 수저 단계별 어머니 평균 나이 차이(설계값, 살): 형편이 넉넉할수록 조금 늦게 낳는다. 나이를 통째로 밀지 않고 단계별 어머니 나이 분포를 **구간 안에서만 기울여** 평균 차이를 만든다
 * (data/parentAgeModel.ts) — 전체 구간 비중·평균은 공표값 그대로다. 단계 비율로 가중한 평균을 뺀 차이로 쓰므로 전체 평균은 바뀌지 않는다
 * (지금 세상 단계 비율 25·30·28·14·3% 기준 가중 평균 −0.08살). 아버지는 어머니와의 나이 차 규칙으로 따라온다.
 */
export const PARENT_AGE_SHIFT_BY_WEALTH: Readonly<Record<ParentWealth, number>> = { 1: -1, 2: 0, 3: 0, 4: 1, 5: 1 };

/** 부모 나이의 허용 범위(설계 상한·하한): 시대 보정(ERA_REPORT_ADJUST.parentAgeShift)을 더한 뒤 이 안으로 맞춘다. 지금 세상의 통계 나이(어머니 16~49·아버지 20~54)는 이 안에 있다. */
export const PARENT_AGE_LIMITS = { min: 16, max: 56 } as const;

// ---------- 형제 순서 ↔ 어머니 나이 (R-330, BR6·CM9) ----------

/*
 * 출생 순서(N째)와 어머니 나이는 서로 어긋나면 안 된다: 위 형제가 N−1명이면 어머니는 최소 첫 출산 나이(16)에 낳기 시작해 형제마다 최소 2살 터울로 낳았어야 한다.
 * **출생 생성기(core/birthReport.ts#rollParentAges)와 식구 카드(core/family.ts#familyOf)가 이 한 곳의 상수·함수를 같이 쓴다** — 한쪽만 바뀌어 출생신고 문장의 「둘째입니다」와
 * 식구 카드의 위 형제 수가 어긋나는 일이 없게 하려는 것이다(설계값, 통계가 아님).
 */
/** 어머니가 첫 아이를 낳을 수 있는 가장 어린 나이 — 출생신고의 부모 나이 하한과 같다 */
export const MIN_FIRST_BIRTH_AGE = PARENT_AGE_LIMITS.min;
/** 위 형제 한 명당 나이 차 범위(살) — 시드로 고른다. min은 어머니의 최소 터울이기도 하다 */
export const SIBLING_GAP = { min: 2, max: 5 } as const;
/** 위 형제 수의 상한 (형제 순서 5 = 「다섯째 이상」) */
export const MAX_OLDER_SIBLINGS = 4;

/** 형제 순서(1~5)가 말하는 위 형제 수: N째이면 N−1명, 다섯째 이상은 4명 */
export function olderSiblingsOf(order: number): number {
  return Math.min(MAX_OLDER_SIBLINGS, Math.max(0, order - 1));
}

/** 출생 때 어머니 나이가 이 값일 때 위로 낳을 수 있었던 형제 수의 한도: ⌊(어머니 나이 − 16) / 2⌋ */
export function olderSiblingLimit(motherAge: number): number {
  return Math.floor(Math.max(0, motherAge - MIN_FIRST_BIRTH_AGE) / SIBLING_GAP.min);
}

/** 이 형제 순서로 태어나려면 출생 때 어머니가 적어도 몇 살이어야 하는가 (첫째 16, 둘째 18, 셋째 20, 넷째 22, 다섯째 이상 24) */
export function minMotherAgeForOrder(order: number): number {
  return MIN_FIRST_BIRTH_AGE + SIBLING_GAP.min * olderSiblingsOf(order);
}

/**
 * 아버지 − 어머니 나이 차 규칙(설계값): 통계에는 부부 나이 차의 분포가 없다. 어머니·아버지의 공표 연령 분포(구간 비중·평균)를 그대로 가장자리로 하고, 그 둘을 잇는 결합 분포를
 * 나이 차가 [min, max] 안인 조합으로만 만든다. peak·spread는 결합 분포의 초기 모양(peak 둘레의 종 모양, 폭 spread)일 뿐이고 실제 나이 차 평균은 두 공표 평균의 차(36.1 − 33.8 = 2.3살)로 정해진다.
 * 시대 보정은 두 부모에게 같은 살수를 더하므로 나이 차는 그대로다(data/parentAgeModel.ts, core/birthReport.ts#rollParentAges).
 */
export const FATHER_GAP = { min: -4, max: 15, peak: 2.5, spread: 3.5 } as const;

/** 출산 순위 셋째 이상을 넷째·다섯째로 나누는 비중(설계값, 합 100): 통계에는 「셋째 이상」 한 칸뿐이다. */
export const THIRD_PLUS_SPLIT: readonly [third: number, fourth: number, fifthPlus: number] = [74, 19, 7];

/** 출생 연도 갈래 보정(설계값): 부모 나이 보정(살)과 형제 순서(첫째·둘째·셋째 이상, %) 덮어쓰기. null이면 지금 통계(지역별) 그대로. */
export interface EraReportAdjust {
  parentAgeShift: number;
  orderShares: readonly [first: number, second: number, thirdPlus: number] | null;
}
export const ERA_REPORT_ADJUST: Readonly<Record<ReportTilt, EraReportAdjust>> = {
  /** 1989년 이전 출생: 어머니 평균 출산 연령 20대 후반, 형제가 많다 */
  past: { parentAgeShift: -6, orderShares: [26, 26, 48] },
  present: { parentAgeShift: 0, orderShares: null },
};

// ---------- 사는 집 ----------

/**
 * 사는 집 이름. 임차는 「임차(전세, 월세)」로 쉼표 나열이다 — 가운뎃점(「전세·월세」)이면 글자 150~200%·좁은 폭에서 「임차(전세·」가 줄 끝에 혼자 남는다(SPEC-003 QM2-10 규칙 2:
 * 한 줄을 넘을 수 있는 나열은 쉼표 나열. REV-003-M3-1 R-262 표본(e2e/m3Variants.ts)이 잡은 결함). 쉼표는 앞 낱말에 붙어 줄 끝에 오는 것이 정상 조판이다.
 */
export const HOUSING_LABEL: Readonly<Record<Housing, string>> = { own: '자가', rent: '임차(전세, 월세)', free: '무상 거주' };

/**
 * 수저 단계 → 소득 계층 섞는 비율(설계값). 주거실태조사의 점유형태는 전국 값, 지역별 값, **소득계층별 값(저소득·중소득·고소득)**이 있다.
 * 지역별 분포에 「소득계층 분포 ÷ 전국 분포」 배율을 곱해 다시 정규화한다(수저 단계는 가까운 계층의 배율을 섞는다).
 */
export type IncomeClass = 'low' | 'mid' | 'high';
export const INCOME_CLASS_BLEND: Readonly<Record<ParentWealth, ReadonlyArray<readonly [IncomeClass, number]>>> = {
  1: [['low', 1]],
  2: [
    ['low', 0.5],
    ['mid', 0.5],
  ],
  3: [['mid', 1]],
  4: [
    ['mid', 0.5],
    ['high', 0.5],
  ],
  5: [['high', 1]],
};

/**
 * 비교 표의 「이 가정 형편」 칸에 보여 줄 대표 소득계층(설계값): 1·2단계 저소득층, 3단계 중소득층, 4·5단계 고소득층.
 * 사는 집 확률은 위 INCOME_CLASS_BLEND로 두 계층을 섞지만, 표에는 한 집단의 값만 보여 주므로 섞는 비중이 같은 2·4단계는 어느 쪽을 보일지 따로 정해 둔다
 * (동수저는 저소득 쪽, 금수저는 고소득 쪽 — 단계 이름이 가리키는 방향).
 */
export const HOUSING_CLASS_PRIMARY: Readonly<Record<ParentWealth, IncomeClass>> = { 1: 'low', 2: 'low', 3: 'mid', 4: 'high', 5: 'high' };

/** 통계표(`housing-tenure`)의 소득계층 행 이름 */
export const INCOME_CLASS_ROW: Readonly<Record<IncomeClass, string>> = { low: '전국·저소득층', mid: '전국·중소득층', high: '전국·고소득층' };
/** 통계표(`housing-tenure`)의 전국 행 이름 */
export const NATIONAL_ROW = '전국';

// ---------- 문장·격자 문구 ----------

/**
 * 한 줄 서술문의 형편 서술(BR3 「{형편 서술} 가정」): 수저 이름·구간을 쓰지 않는다 — 같은 문장이 인생 기록의 첫 줄이 되고 인생 기록에는 등급명을 쓰지 않는다(C4).
 * (예전 출생 화면의 집안 형편 묘사와 같은 결이다 — 그 화면의 묘사는 이 서술문과 출생신고 격자로 대체되어 없어졌다.)
 */
export const WEALTH_ADJECTIVE: Readonly<Record<ParentWealth, string>> = {
  1: '형편이 빠듯한',
  2: '넉넉하지는 않은',
  3: '평범한',
  4: '여유 있는',
  5: '아주 넉넉한',
};

/** 형제 순서 이름 (BirthReport.birthOrder 1~5; 5는 다섯째 이상) */
export const BIRTH_ORDER_LABEL: Readonly<Record<number, string>> = { 1: '첫째', 2: '둘째', 3: '셋째', 4: '넷째', 5: '다섯째 이상' };
