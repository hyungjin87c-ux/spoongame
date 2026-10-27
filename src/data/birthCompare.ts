import { R1_PRESENT, type ParentWealth, type ProfileId } from '../core/types';
import { HOUSING_CLASS_PRIMARY, INCOME_CLASS_ROW, NATIONAL_ROW } from './birthReportTable';
import { formatNumber, getUsableIndicator, type UsableIndicator } from './koreaStatsAccess';

/**
 * 출생신고의 비교 표 「다른 집 아이들과 견주면」 (SPEC-003 BR5, G3: 수저의 영향 체감). **출처가 확인된 행만** 넣는다 — 값은 모두 검증된 지표(koreaStatsAccess)에서 읽고,
 * 지표를 못 읽으면(없거나 미확인) 그 행을 뺀다(조용히 가짜 값을 채우지 않는다). 대학 진학률의 소득별 차이(`income-college-gap`)는 출처를 확인하지 못해 넣지 않았다.
 *
 * **지금 세상에서만 보인다**(REV-003-M3-1 R-263, 마스터 결정): 통계가 2024~2025년 값이라 지난·다가올 세상의 가정과 견주면 시대가 어긋난다(`compareShown`).
 * **표에는 가정 형편에 맞춘 소득 구간의 값만 둔다**(R-260·R-261): 개인 근로·사업소득 5분위의 1년 이동 통계(`income-mobility`)는 가구 속성이 아니고 세대 간 이동도 아니라서 쓰지 않는다.
 * 소득 상·하위 20%의 기대수명 차이(`life-expectancy-income-gap`)는 이 가정을 겨냥하지 않는 **한 줄 서술**(`lifeGapLine`)로 모든 단계에 같게 보인다.
 *
 * 열: 「전체 평균」은 그 통계의 전체 대상(학생·가구) 평균이고, 「이 가정 형편」은 이 가정의 수저 단계에 **맞춘 소득 구간**의 값이다.
 * 수저 단계 ↔ 소득 구간의 대응은 게임의 설계값이다(표 아래에 한 줄 밝힌다). 행마다 출처·기준 연도를 함께 적는다.
 * (시안의 열 이름 「올해 출생아 평균」은 쓰지 않았다 — 통계가 올해 출생아의 평균이 아니라 학생·가구 전체의 평균이라 사실과 맞지 않는다. ai-log dev-M3 「시안과 다른 점」.)
 *
 * 행 만들기는 지표를 꺼내는 함수를 받는다(기본은 검증된 지표 접근자) — 테스트가 지표를 못 읽는 상황을 주입해 「행을 뺀다」를 직접 확인한다(R-273).
 */

export interface ComparisonRow {
  id: 'private-edu-participation' | 'private-edu-cost' | 'owner-share';
  /** 항목 이름 (예: 사교육 참여율) */
  label: string;
  /** 「전체 평균」 칸 */
  average: string;
  /** 「이 가정 형편」 칸 */
  child: string;
  /** 이 가정 칸이 어떤 집단의 값인지 짧은 설명 (예: 「월 소득 300만 원 미만 가구의 학생」) */
  childNote: string;
  /** 출처 줄: 「국가데이터처, 교육부, 초중고사교육비조사 (2025년)」 (기관, 조사 이름 (기준 연도) — 쉼표 나열) */
  source: string;
  basisId: string;
}

/** 지표를 id로 꺼내는 함수 (기본: 검증된 지표만 돌려주는 접근자) */
export type IndicatorGetter = (id: string) => UsableIndicator | undefined;

/**
 * 비교 표(와 기대수명 서술)를 보여 주는 판: 통계가 지금(2024~2025년) 값이라 2026년생 전용이었다(R-263). **2026년생이 없는 지금은 어떤 세대의 출생신고에도 보이지 않는다**(SPEC-004 NR2·N20 마스터 결정 2026-10-27: 숨긴다) —
 * 코드·데이터는 지우지 않고 남겨, 나중에 세대별 공식 통계로 비교 표를 다시 열 때 쓴다. 시험 전용 R1 프로필(2026년생)만 R1 때처럼 보인다.
 */
export const COMPARE_PROFILE: ProfileId = R1_PRESENT;

/** 이 판의 출생신고에 비교 표를 보여 주는가 (세대 7종은 모두 false) */
export function compareShown(profile: ProfileId): boolean {
  return profile === COMPARE_PROFILE;
}

/** 수저 단계 → 사교육비조사의 가구 월평균 소득 구간 (설계 대응, 8구간 중) */
export const PRIVATE_EDU_BAND_BY_WEALTH: Readonly<Record<ParentWealth, string>> = {
  1: '300만 원 미만',
  2: '300~400만 원 미만',
  3: '500~600만 원 미만',
  4: '700~800만 원 미만',
  5: '800만 원 이상',
};

/** 주거실태조사의 소득계층 이름 (수저 단계 → 계층은 birthReportTable#HOUSING_CLASS_PRIMARY) */
export const HOUSING_CLASS_LABEL = { low: '저소득층', mid: '중소득층', high: '고소득층' } as const;

/**
 * 출처 줄: 「국가데이터처·교육부, 초중고사교육비조사 (2025년)」 (기관, 조사 이름 (기준 연도)). 항목이 셋인 나열이라 가운뎃점 사슬(「A · B · C」)이 아니라 **쉼표 나열**이다 —
 * 글자 200%·폭 320에서 한 줄을 넘어도 구분 기호가 줄 끝·첫머리에 혼자 남지 않는다(SPEC-003 QM2-10 규칙 2).
 */
function sourceLine(ind: UsableIndicator, survey: string): string {
  // 기관이 둘 이상인 값(「국가데이터처·교육부」)은 쉼표 나열로 바꿔 쓴다 — 칸이 좁아 한 줄을 넘으면 「·」가 줄 끝에 혼자 남는다(QM2-10 규칙 2)
  const org = ind.source.org.split('·').map((o) => o.trim()).join(', ');
  return `${org}, ${survey} (${ind.latest.year}년)`;
}

function rowOf(ind: UsableIndicator, key: string, value: string): Record<string, unknown> | undefined {
  return (ind.rows ?? []).find((r) => r[key] === value);
}

function numOf(row: Record<string, unknown> | undefined, key: string): number | null {
  const v = row?.[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * 이 수저 단계의 비교 표 행들(최대 3개, 순서: 사교육 참여율 · 월평균 사교육비 · 자가 점유 비율). 지표를 못 읽는 행은 뺀다.
 * 모든 단계에서 행 구성이 같고 값(이 가정 형편 칸)만 단계에 맞춘 소득 구간으로 달라진다 — 흙수저만 행이 더 많거나 하는 일이 없다(R-260·R-261).
 */
export function buildComparison(wealth: ParentWealth, getIndicator: IndicatorGetter = getUsableIndicator): ComparisonRow[] {
  const rows: ComparisonRow[] = [];

  // 1·2. 사교육 참여율·월평균 사교육비 (가구 월평균 소득 구간별, 2025)
  const edu = getIndicator('private-education-by-income');
  if (edu !== undefined) {
    const all = rowOf(edu, 'band', '전체');
    const mine = rowOf(edu, 'band', PRIVATE_EDU_BAND_BY_WEALTH[wealth]);
    const note = `월 소득 ${PRIVATE_EDU_BAND_BY_WEALTH[wealth]} 가구의 학생`;
    const p = [numOf(all, 'participationPct'), numOf(mine, 'participationPct')];
    if (p[0] !== null && p[1] !== null) {
      rows.push({
        id: 'private-edu-participation',
        label: '사교육 참여율',
        average: `${formatNumber(p[0], 1)}%`,
        child: `${formatNumber(p[1], 1)}%`,
        childNote: note,
        source: sourceLine(edu, '초중고사교육비조사'),
        basisId: edu.basisId,
      });
    }
    const c = [numOf(all, 'monthlyCostMan'), numOf(mine, 'monthlyCostMan')];
    if (c[0] !== null && c[1] !== null) {
      rows.push({
        id: 'private-edu-cost',
        label: '월평균 사교육비',
        average: `${formatNumber(c[0], 1)}만 원`,
        child: `${formatNumber(c[1], 1)}만 원`,
        childNote: note,
        source: sourceLine(edu, '초중고사교육비조사'),
        basisId: edu.basisId,
      });
    }
  }

  // 3. 자가 점유 비율 (소득계층별, 2024)
  const housing = getIndicator('housing-tenure');
  if (housing !== undefined) {
    const national = numOf(rowOf(housing, 'label', NATIONAL_ROW), 'own');
    const main = HOUSING_CLASS_PRIMARY[wealth];
    const mine = numOf(rowOf(housing, 'label', INCOME_CLASS_ROW[main]), 'own');
    if (national !== null && mine !== null) {
      rows.push({
        id: 'owner-share',
        label: '자기 집에 사는 가구',
        average: `${formatNumber(national, 1)}%`,
        child: `${formatNumber(mine, 1)}%`,
        childNote: `${HOUSING_CLASS_LABEL[main]} 가구`,
        source: sourceLine(housing, '주거실태조사'),
        basisId: housing.basisId,
      });
    }
  }
  return rows;
}

/** 기대수명 소득 격차 한 줄 서술 (R-261) */
export interface LifeGapLine {
  /** 「소득 상위 20%와 하위 20%의 기대수명 차이는 6.48세입니다(2017년). 집단의 평균 차이입니다.」 — 모든 수저 단계에 같다 */
  text: string;
  /** 출처 줄 (기관, 조사 이름 (기준 연도)) */
  source: string;
  basisId: string;
}

/**
 * 소득 상위 20%와 하위 20%의 기대수명 차이 한 줄 서술. **이 가정을 겨냥하지 않는다** — 수저 단계를 받지 않으므로 모든 단계에 같은 글이 나가고,
 * 「이 아이는 더 오래/짧게 산다」로 읽히지 않게 집단의 평균 차이라고 밝힌다. 값·기준 연도는 검증된 지표에서 읽고, 못 읽으면 null(서술을 뺀다). 합쇼체.
 */
export function lifeGapLine(getIndicator: IndicatorGetter = getUsableIndicator): LifeGapLine | null {
  const ind = getIndicator('life-expectancy-income-gap');
  const gap = ind?.latest.value;
  if (ind === undefined || typeof gap !== 'number' || !Number.isFinite(gap)) return null;
  return {
    text: `소득 상위 20%와 하위 20%의 기대수명 차이는 ${formatNumber(gap, ind.decimals)}세입니다(${ind.latest.year}년). 집단의 평균 차이입니다.`,
    source: sourceLine(ind, '한국의 사회동향 2019'),
    basisId: ind.basisId,
  };
}
