import type { Era, Gender, Housing, ParentingStyle, ParentWealth } from '../core/types';
import { BIRTH_ORDER_LABEL, HOUSING_LABEL } from './birthReportTable';

/**
 * 룰렛·출생신고 화면의 문구 (SPEC-003 RL·BR). 문구 기준은 docs/design/copy.md다 — 화면 코드에 글자를 흩어 두지 않고 여기에 모았다.
 * 어조: 화면 안내는 「~해요」, 서류·기록·카드 본문은 「~습니다」(copy.md 3-2절). 느낌표·이모지 없음. 수저 이름은 룰렛·출생신고·또래 목록에서만 쓴다(C4 허용 화면).
 * 외모는 어디서도 점수(N점)로 적지 않는다 — 「상위/하위 약 N%」(data/birthText.ts#standingLabel)만(R-135).
 */

// ---------- 수저 이름 (룰렛·출생신고 허용 화면, RL4 「다이아몬드수저」) ----------

export const GRADE_NAME = { 1: '흙수저', 2: '동수저', 3: '은수저', 4: '금수저', 5: '다이아몬드수저' } as const;

/** 수저 칩의 점 5개 읽기용 이름 (「5단계 중 1단계」) */
export function gradeDotsLabel(grade: number): string {
  return `5단계 중 ${grade}단계`;
}

// ---------- 룰렛 ----------

export const ROULETTE_TEXT = {
  /** 헤더 오른쪽 화면 이름 */
  headName: '출생',
  spinTitle: '태어날 집과 땅을 고르는 중',
  /** 회전 중 안내: 화면 안내문은 해요체 한 문단 안에서 통일한다(QM3-4, 마스터 확인 2 — 「확률대로 돌아가요.」) */
  spinNote: '어느 집, 어느 땅에 태어날지는 고를 수 없어요. 확률대로 돌아가요.',
  doneTitle: '태어날 곳이 정해졌습니다',
  /** 움직임 줄이기: 회전 없이 결과만 보인다는 안내 한 줄 (R-171) */
  motionNote: '움직임 줄이기가 켜져 있어 돌림판을 돌리지 않고 결과만 보여 드려요.',
  /** 결과 아래 작은 글 — 정직한 고지는 결과 뒤에 (R-132) */
  afterNote: '돌림판은 연출이고, 결과는 돌기 전에 정해진 값이에요.',
  wealthTitle: '수저',
  regionTitle: '태어나는 지역',
  wealthOddsCaption: '수저별 확률',
  regionOddsCaption: '지역별 확률',
  /** 수저 확률표 주석 (RL3) */
  wealthOddsNote: '게임의 설계값이에요(통계가 아님).',
  skip: '건너뛰기',
  toBirth: '출생신고 보기',
} as const;

/** 지역 확률표 주석 (RL3·R-187): 지금 세상은 출생 통계에서 합친 파생값(출처·기준 연도), 지난·다가올 세상은 설계값 */
export function regionOddsNote(basis: 'statistic-derived' | 'design', era: Era, source: { org: string; year: number }): string {
  if (basis === 'statistic-derived') {
    return `${source.year}년 시·도별 출생아 수 비율(${source.org}, ${source.year}년 출생 통계). 광주·전남은 통합(2026)에 맞춰 합산. 이름은 줄여 적었어요.`;
  }
  return era === 'past'
    ? `지금 통계를 바탕으로 한 설계값이에요. ${source.year}년 시·도별 출생아 수 비율을 그 시기의 시·도 구분에 맞게 합친 값이고, 실제 당시 분포가 아니에요. 이름은 줄여 적었어요.`
    : `지금 통계를 바탕으로 한 설계값이에요. ${source.year}년 시·도별 출생아 수 비율(${source.org}, ${source.year}년 출생 통계)을 광주·전남 통합(2026)에 맞춰 합산해 그대로 옮겼어요. 이름은 줄여 적었어요.`;
}

// ---------- 제목(h1) 글자 크기 상한 (QM3-2) ----------

/** 낱말(공백으로 가른 덩어리)의 글자 수 중 가장 큰 값 */
export function longestWordLength(texts: readonly string[]): number {
  return Math.max(...texts.flatMap((t) => t.split(/\s+/).filter((w) => w !== '').map((w) => [...w].length)));
}

/**
 * 룰렛 제목(h1)의 가장 긴 낱말 글자 수 — 회전 중·결과 두 제목에서 계산한다(「정해졌습니다」 6글자). 제목 글자 크기 상한이 이 값으로 정해진다:
 * `font-size: min(기본, 줄 폭 ÷ (이 값 + 여유 1))` (src/styles/doc.css `.roulette__lead .t-title`, RouletteScreen이 CSS 변수 `--title-chars`로 넘긴다).
 * 새 제목 문구가 더 긴 낱말을 가져도 상한이 따라가고, tests/titleCap.test.ts가 이 값이 실제 제목의 가장 긴 낱말과 같음을 단언한다.
 */
export const ROULETTE_TITLE_LONGEST_WORD = longestWordLength([ROULETTE_TEXT.spinTitle, ROULETTE_TEXT.doneTitle]);

/** 상한이 줄 폭을 나누는 칸 수: 가장 긴 낱말 글자 수 + 여유 1글자 (한글 한 글자 ≈ 글자 크기 1배) */
export const ROULETTE_TITLE_CHARS = ROULETTE_TITLE_LONGEST_WORD + 1;

// ---------- 출생신고 ----------

/**
 * 대시보드의 「같은 해 태어난 사람들」 칸(VP4)이 배포돼 있는가 (QM3-3: 화면 문구는 없는 기능을 가리키지 않는다).
 * **M4가 VP4(대시보드 또래 칸, ui/dash/Cards.tsx#PeersNowCard)를 넣는 변경에서 `true`로 켰다** — 켜면 출생신고의 또래 안내 둘째 문장이 보이고,
 * e2e(e2e/m4-peers-note.spec.ts)가 「출생신고 → 살아가기 → 대시보드」에서 안내가 가리키는 또래 칸이 실제로 보임을 단언한다(문구 ⇔ 기능).
 */
export const DASHBOARD_PEERS_SHIPPED = true;

/**
 * 또래 카드 안내: 첫 문장은 설정 설명(화면을 가리키지 않는다), 둘째 문장은 대시보드 또래 칸이 있을 때만.
 * 둘째 문장은 위치(「오른쪽 칸」)가 아니라 **사용자가 곧 누를 버튼 이름 + 칸 제목**으로 가리킨다 — 좁은 화면(1열)에서는 그 칸이 맨 아래라 위치 서술이 틀리고,
 * 「대시보드」는 화면에 적히지 않는 내부 이름이다(M4 착수 결정 3, docs/design/copy.md 출생신고 또래 안내 행). 칸 제목은 `DASH_TEXT.peersTitle`과 같은 글자다.
 */
export function peersNoteText(dashboardShipped: boolean): string {
  const first = '네 사람도 같은 세상에서 나이를 먹습니다.';
  return dashboardShipped ? `${first} 살아가기를 누르면 「같은 해 태어난 사람들」 칸에서 요즘 모습을 볼 수 있습니다.` : first;
}

export const BIRTH_TEXT = {
  headName: '출생 신고',
  docTitle: '출생 신고',
  /** 문서 띠 오른쪽 표기: 두 항목의 짧은 쌍(ui/FitPair가 한 줄이면 「A · B」, 좁으면 두 줄로 나눈다) */
  docTag: ['수저 게임', '가상의 서류'],
  stamp: '접수',
  nameLabel: '이름',
  next: '살아가기',
  gridLabels: {
    gender: '성별',
    month: '출생 연월',
    place: '태어난 곳',
    wealth: '집안 형편',
    mother: '어머니',
    father: '아버지',
    housing: '사는 집',
    weight: '출생 체중',
    order: '형제 순서',
    looks: '외모',
    parenting: '교육방식',
  },
  /** 외모 값 옆 보조 문구 (원점수는 적지 않는다, R-135) */
  looksSub: '또래 사이에서',
  peersTitle: '같은 해 태어난 사람들',
  /** 또래 카드 안내. 둘째 문장은 대시보드 또래 칸(VP4, M4)이 배포된 뒤에만 보인다 — `DASHBOARD_PEERS_SHIPPED`, `peersNoteText` (QM3-3) */
  peersNote: peersNoteText(DASHBOARD_PEERS_SHIPPED),
  compareTitle: '다른 집 아이들과 견주면',
  compareCaption: '전체 평균과 이 아이 가정과 비슷한 형편의 비교',
  compareColItem: '항목',
  compareColAll: '전체 평균',
  compareColThis: '이 가정 형편',
  /** 비교 표 아래 안내(서류 본문이라 합쇼체로 통일 — QM3-4): 평균이 출생아 평균이 아니라는 것, 대응이 설계값이라는 것 */
  compareNote: '평균은 각 통계의 전체 대상(학생, 가구) 기준이고, 이 가정 열은 수저 단계에 맞춘 소득 구간의 값입니다. 단계와 소득 구간의 대응은 게임의 설계값입니다.',
} as const;

export function genderLabel(gender: Gender): string {
  return gender === 'male' ? '남성' : '여성';
}

export function babyLabel(gender: Gender): string {
  return gender === 'male' ? '남자아이' : '여자아이';
}

/** 「2026년 1월」 */
export function yearMonthText(year: number, month: number): string {
  return `${year}년 ${month}월`;
}

/** 출생 체중 「3.3kg」 (소수 첫째 자리) */
export function formatKg(kg: number): string {
  return `${kg.toFixed(1)}kg`;
}

export function housingText(h: Housing): string {
  return HOUSING_LABEL[h];
}

export function orderText(order: number): string {
  const label = BIRTH_ORDER_LABEL[order];
  if (label === undefined) throw new RangeError(`orderText: 형제 순서 ${order}`);
  return label;
}

/** 출생신고 하단 표기 (BR4): 어떤 값이 통계이고 어떤 값이 설계값인가 */
export const REPORT_NOTES = {
  /** 출생 월, 체중, 부모 연령, 형제 순서, 직업, 주거가 어떤 통계에서 왔는가(한 줄을 넘을 수 있는 나열이라 가운뎃점이 아니라 쉼표 나열 — QM2-10 규칙 2) */
  stats:
    '출생 월, 출생 체중, 부모의 나이, 형제 순서는 2025년 출생 통계(국가데이터처), 부모의 직업은 30·40대 취업자 직업 분포(2024년), 사는 집은 주거실태조사 점유형태(국토교통부, 2024년)를 바탕으로 했습니다. 출생 체중 순위는 같은 성별 출생아 가운데 값입니다.',
  /** 수저 단계별 보정이 설계값이라는 고지 */
  design: '수저 단계에 따른 부모 나이, 직업, 사는 집의 차이는 게임의 설계값이며 통계가 아닙니다.',
  /**
   * 지난·다가올 세상 한 줄 (BR4). 범위는 **이 서류 격자의 항목**(출생 월, 출생 체중, 부모의 나이와 직업, 형제 순서, 사는 집)이다 — 비교 표는 이 세상에서 보이지 않고(지금 세상만, R-263),
   * 태어난 곳의 시·군·구 이름은 따로 밝힌다(`regionPast`·getRegionFootnote). 지난 세상은 그중 부모 나이·직업·형제 순서를 그 시대에 맞게 조정했다(ERA_REPORT_ADJUST·JOB_TILT_BY_ERA).
   */
  eraPast:
    '지난 세상의 출생 월, 출생 체중, 부모의 나이와 직업, 형제 순서, 사는 집은 지금(2025년) 통계를 바탕으로 한 설계값이며 실제 당시 통계가 아닙니다. 부모의 나이, 직업, 형제 순서는 그 시대에 맞게 조정했습니다.',
  eraFuture: '다가올 세상의 출생 월, 출생 체중, 부모의 나이와 직업, 형제 순서, 사는 집은 지금(2025년) 통계를 바탕으로 조금 조정한 설계값이며 예측이 아닙니다.',
  /** 지난 세상의 지역 표기 (R-264): 시·군·구 이름이 2025년 행정구역 이름이다 — 지금·다가올 세상의 「2026년에 바뀐 시·도…」 문구(getRegionFootnote)는 쓰지 않는다 */
  regionPast: '시·군·구 이름은 지금(2025년) 행정구역 이름이며 당시와 다를 수 있습니다.',
  /** 사는 집 통계의 한계 */
  housing: '사는 집은 출생아 가구가 아니라 일반 가구 전체의 점유형태를 바탕으로 한 근사입니다.',
} as const;

// ---------- 교육방식 (서류 본문, 합쇼체) ----------

/**
 * 출생신고 「교육방식」 값 옆 설명 (합쇼체 — 서류·카드 본문은 합쇼체, copy.md 3-2절). 옛 출생 화면의 해라체 묘사(data/birthText.ts#parentingText)와 같은 뜻이다.
 * 자유·헬리콥터·엄격은 재력과 무관하게 성립하는 문구 하나, 방임은 「왜 돌보지 못했는가」가 형편에 따라 달라서 재력 단계별로 나눈다(R-013: 4·5단계에 「먹고사는 일에 쫓겨」가 붙으면 형편과 모순).
 */
const PARENTING_DOC_BASE = {
  free: '부모님은 아이가 하고 싶어 하는 일을 웬만하면 말리지 않았습니다.',
  helicopter: '부모님은 아이의 하루를 곁에서 챙겼습니다. 숙제부터 친구 관계까지 모르는 것이 없었습니다.',
  strict: '집에는 지켜야 할 규칙이 많았고, 부모님은 엄했습니다.',
} as const;

const PARENTING_DOC_NEGLECT: Readonly<Record<ParentWealth, string>> = {
  1: '부모님은 먹고사는 일에 쫓겨 아이를 돌볼 여유가 없었습니다. 아이는 대체로 스스로 자랐습니다.',
  2: '부모님은 일하느라 하루의 대부분을 밖에서 보냈습니다. 아이는 대체로 스스로 자랐습니다.',
  3: '부모님은 일에 매여 아이에게 시간을 내기 어려웠습니다. 아이는 대체로 스스로 자랐습니다.',
  4: '부모님은 각자의 일로 바빠 집에 있는 시간이 드물었습니다. 아이는 대체로 스스로 자랐습니다.',
  5: '부모님은 각자의 일로 바빠 집에 있는 시간이 드물었습니다. 아이는 대체로 스스로 자랐습니다.',
};

export function parentingDocText(parenting: ParentingStyle, wealth: ParentWealth): string {
  return parenting === 'neglect' ? PARENTING_DOC_NEGLECT[wealth] : PARENTING_DOC_BASE[parenting];
}
